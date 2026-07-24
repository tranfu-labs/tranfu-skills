#!/usr/bin/env python3
"""Prepare large agent transcripts for bounded, resumable knowledge extraction."""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import re
import shutil
import sqlite3
import sys
import tempfile
from collections import Counter, deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Iterator, Sequence


PIPELINE_VERSION = "v1"
MANIFEST_SCHEMA = "session-to-knowledge-run/v1"
DEFAULT_UNKNOWN_BUDGET = 4096
MAX_DEFAULT_BUDGET = 32 * 1024
MIN_CHUNK_BYTES = 512
MAX_GENERIC_JSON_BYTES = 16 * 1024 * 1024
SESSION_ID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


class SourceError(RuntimeError):
    """Raised when a transcript cannot be resolved or safely normalized."""


@dataclass
class SourceInfo:
    path: Path
    kind: str
    snapshot_size: int
    session_id: str | None = None
    cwd: str | None = None
    context_tokens: int | None = None
    archived: bool = False


@dataclass
class ParseContext:
    warnings: list[str] = field(default_factory=list)
    ignored: Counter[str] = field(default_factory=Counter)
    metadata: dict[str, Any] = field(default_factory=dict)


class Redactor:
    """Apply deterministic high-risk redaction before transcript text reaches a model."""

    _pem = re.compile(
        r"-----BEGIN [^-\r\n]+-----.*?-----END [^-\r\n]+-----",
        re.IGNORECASE | re.DOTALL,
    )
    _sensitive_header = re.compile(
        r"(?im)(?P<prefix>\b(?:authorization|proxy-authorization|cookie|set-cookie)[ \t]*:[ \t]*)"
        r"(?P<value>[^\s\r\n\"'][^\r\n\"']*)"
    )
    _secret_assignment = re.compile(
        r"(?i)(?P<quote>\\*[\"']?)\b(?P<key>[A-Z0-9_]*(?:API[_-]?KEY|TOKEN|PASSWORD|PASSWD|SECRET|"
        r"COOKIE|AUTHORIZATION)[A-Z0-9_]*)\b(?P=quote)(?P<sep>[ \t]*[:=][ \t]*)"
        r"(?P<value>\\\"(?:\\\\.|[^\"\\\r\n])*\\\"|\\'(?:\\\\.|[^'\\\r\n])*\\'|"
        r"\"[^\"\r\n]*\"|'[^'\r\n]*'|[^\s,}\]]+)"
    )
    _secret_flag = re.compile(
        r"(?i)(?P<flag>--(?:api[-_]?key|token|password|passwd|secret|cookie|authorization)[ \t]+)"
        r"(?P<value>\\\"(?:\\\\.|[^\"\\\r\n])*\\\"|\\'(?:\\\\.|[^'\\\r\n])*\\'|"
        r"\"[^\"\r\n]*\"|'[^'\r\n]*'|\S+)"
    )
    _bearer = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{8,}")
    _basic = re.compile(r"(?i)\bBasic\s+[A-Za-z0-9+/=]{8,}")
    _known_token = re.compile(
        r"\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|"
        r"github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|"
        r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b"
    )
    _data_url = re.compile(r"data:[^\s;,]+;base64,[A-Za-z0-9+/=\r\n]{32,}", re.I)
    _long_base64 = re.compile(r"(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]{100,}={0,2}(?![A-Za-z0-9+/=])")
    _url = re.compile(r"https?://[^\s<>\"']+", re.I)
    _email = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)
    _uuid = re.compile(
        r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
        r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"
    )
    _ipv4 = re.compile(
        r"(?<!\d)(?:25[0-5]|2[0-4]\d|1?\d?\d)"
        r"(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}(?!\d)"
    )
    _private_host = re.compile(r"\b[A-Za-z0-9.-]+\.(?:internal|local|lan)\b", re.I)
    _windows_path = re.compile(r"\b[A-Za-z]:\\(?:[^\\\s\"'`<>]+\\)*[^\\\s\"'`<>]*")
    _posix_path = re.compile(
        r"(?<![\w:])/(?:[A-Za-z0-9._~@%+=:,()-]+/)"
        r"+(?:[A-Za-z0-9._~@%+=:,()-]+)"
    )
    _long_id = re.compile(r"\b[0-9a-fA-F]{24,}\b")
    _placeholder = re.compile(
        r"<(?:secret|binary-data|(?:email|url|path|host|ip|id)-(?:\d+|[0-9a-f]{12}))>"
    )
    _max_stable_values = 4096

    def __init__(self) -> None:
        self._values: dict[str, dict[str, str]] = {}

    def _stable(self, category: str, value: str) -> str:
        values = self._values.setdefault(category, {})
        digest = hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()
        if digest in values:
            return values[digest]
        if len(values) >= self._max_stable_values:
            return f"<{category}-{digest[:12]}>"
        values[digest] = f"<{category}-{len(values) + 1}>"
        return values[digest]

    def redact(self, text: str) -> str:
        text = self._pem.sub("<secret>", text)
        text = self._sensitive_header.sub(lambda match: f"{match.group('prefix')}<secret>", text)
        text = self._secret_assignment.sub(
            lambda match: f"{match.group('quote')}{match.group('key')}{match.group('quote')}"
            f"{match.group('sep')}<secret>",
            text,
        )
        text = self._secret_flag.sub(lambda match: f"{match.group('flag')}<secret>", text)
        text = self._bearer.sub("Bearer <secret>", text)
        text = self._basic.sub("Basic <secret>", text)
        text = self._known_token.sub("<secret>", text)
        text = self._data_url.sub("<binary-data>", text)
        text = self._long_base64.sub("<binary-data>", text)
        text = self._url.sub(lambda match: self._stable("url", match.group(0)), text)
        text = self._email.sub(lambda match: self._stable("email", match.group(0)), text)
        text = self._windows_path.sub(lambda match: self._stable("path", match.group(0)), text)
        text = self._posix_path.sub(lambda match: self._stable("path", match.group(0)), text)
        text = self._private_host.sub(lambda match: self._stable("host", match.group(0)), text)
        text = self._ipv4.sub(lambda match: self._stable("ip", match.group(0)), text)
        text = self._uuid.sub(lambda match: self._stable("id", match.group(0)), text)
        text = self._long_id.sub(lambda match: self._stable("id", match.group(0)), text)
        return text

    @classmethod
    def scan(cls, text: str) -> dict[str, int]:
        text = cls._placeholder.sub("", text)
        patterns = {
            "pem": cls._pem,
            "sensitive_header": cls._sensitive_header,
            "secret_assignment": cls._secret_assignment,
            "secret_flag": cls._secret_flag,
            "bearer": cls._bearer,
            "basic": cls._basic,
            "known_token": cls._known_token,
            "data_url": cls._data_url,
            "long_base64": cls._long_base64,
            "url": cls._url,
            "email": cls._email,
            "uuid": cls._uuid,
            "ip": cls._ipv4,
            "private_host": cls._private_host,
            "windows_path": cls._windows_path,
            "posix_path": cls._posix_path,
            "long_id": cls._long_id,
        }
        return {name: len(pattern.findall(text)) for name, pattern in patterns.items() if pattern.search(text)}


def _json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _atomic_json(path: Path, value: Any, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, mode)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def _snapshot_lines(path: Path, snapshot_size: int) -> Iterator[tuple[int, str, bool]]:
    remaining = snapshot_size
    line_number = 0
    with path.open("rb") as handle:
        while remaining > 0:
            raw = handle.readline(remaining)
            if not raw:
                break
            remaining -= len(raw)
            line_number += 1
            yield line_number, raw.decode("utf-8", errors="replace"), raw.endswith(b"\n")


def _snapshot_bytes(path: Path, snapshot_size: int) -> Iterator[bytes]:
    remaining = snapshot_size
    with path.open("rb") as handle:
        while remaining > 0:
            block = handle.read(min(1024 * 1024, remaining))
            if not block:
                break
            remaining -= len(block)
            yield block


def _source_hash(path: Path, snapshot_size: int) -> str:
    digest = hashlib.sha256()
    for block in _snapshot_bytes(path, snapshot_size):
        digest.update(block)
    return digest.hexdigest()


def _read_json_line(line: str, line_number: int, complete: bool, context: ParseContext) -> dict[str, Any] | None:
    stripped = line.strip()
    if not stripped:
        return None
    try:
        value = json.loads(stripped)
    except json.JSONDecodeError as error:
        if not complete:
            raise SourceError(
                f"incomplete trailing JSON at line {line_number}; wait for the session writer and retry"
            ) from error
        raise SourceError(f"invalid JSON at line {line_number}: {error.msg}") from error
    if not isinstance(value, dict):
        raise SourceError(f"expected a JSON object at line {line_number}")
    return value


def _content_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list):
        parts = [_content_text(item) for item in value]
        return "\n".join(part for part in parts if part)
    if not isinstance(value, dict):
        return str(value)
    content_type = str(value.get("type", "")).lower()
    if content_type in {
        "analysis",
        "chain_of_thought",
        "reasoning",
        "redacted_reasoning",
        "thinking",
        "redacted_thinking",
    }:
        return ""
    if content_type in {"image", "input_image", "audio", "input_audio", "file", "attachment"}:
        return f"<{content_type}>"
    if content_type and content_type not in {"input_text", "message", "output_text", "text"}:
        return ""
    for key in ("text", "message", "output_text", "input_text"):
        if key in value and isinstance(value[key], str):
            return value[key]
    for key in ("content", "output", "result"):
        if key in value:
            nested = _content_text(value[key])
            if nested:
                return nested
    safe = {
        key: item
        for key, item in value.items()
        if key not in {"encrypted_content", "image_url", "data", "blob", "base64"}
    }
    return _json_dump(safe) if safe else ""


def _event(
    line_number: int,
    role: str,
    kind: str,
    content: str,
    *,
    timestamp: str | None = None,
    turn_id: str | None = None,
    call_id: str | None = None,
) -> dict[str, Any]:
    value: dict[str, Any] = {
        "ordinal": line_number,
        "role": role,
        "kind": kind,
        "content": content,
    }
    if timestamp:
        value["timestamp"] = timestamp
    if turn_id:
        value["turn_id"] = turn_id
    if call_id:
        value["call_id"] = call_id
    return value


def _codex_metadata(path: Path, snapshot_size: int, strict: bool = True) -> tuple[dict[str, Any], ParseContext]:
    context = ParseContext()
    high_user = False
    high_agent = False
    current_turn: str | None = None
    for line_number, line, complete in _snapshot_lines(path, snapshot_size):
        try:
            record = _read_json_line(line, line_number, complete, context)
        except SourceError:
            if strict:
                raise
            continue
        if not record:
            continue
        record_type = record.get("type")
        payload = record.get("payload") if isinstance(record.get("payload"), dict) else {}
        payload_type = payload.get("type")
        if record_type == "session_meta":
            context.metadata.update(
                {
                    "session_id": payload.get("id") or payload.get("session_id"),
                    "cwd": payload.get("cwd"),
                }
            )
        elif record_type == "event_msg" and payload_type == "task_started":
            current_turn = payload.get("turn_id") or current_turn
            window = payload.get("model_context_window")
            if isinstance(window, int) and window > 0:
                context.metadata["context_tokens"] = window
        elif record_type == "event_msg" and payload_type == "user_message":
            high_user = True
        elif record_type == "event_msg" and payload_type == "agent_message":
            high_agent = True
    context.metadata["has_high_user"] = high_user
    context.metadata["has_high_agent"] = high_agent
    if current_turn:
        context.metadata["last_turn_id"] = current_turn
    return context.metadata, context


def _tool_content(payload: dict[str, Any], output: bool) -> str:
    keys = ("output", "result", "content", "error", "status", "exit_code", "success") if output else (
        "name",
        "arguments",
        "input",
        "query",
        "action",
    )
    selected = {key: payload[key] for key in keys if key in payload}
    normalized = {
        key: value if isinstance(value, (str, int, float, bool)) or value is None else _content_text(value)
        for key, value in selected.items()
    }
    return _json_dump(normalized)


INTERNAL_AGENT_TOOLS = {
    "create_thread",
    "followup_task",
    "fork_thread",
    "handoff_thread",
    "interrupt_agent",
    "list_agents",
    "list_threads",
    "navigate_to_codex_page",
    "read_thread",
    "send_message",
    "send_message_to_thread",
    "set_thread_archived",
    "set_thread_pinned",
    "set_thread_title",
    "spawn_agent",
    "wait_agent",
    "wait_threads",
}


class _CallIdFilter:
    """Bounded-memory membership filter that never evicts an internal call ID."""

    def __init__(self, byte_size: int = 1024 * 1024) -> None:
        self._bits = bytearray(byte_size)
        self._bit_count = byte_size * 8

    def _positions(self, call_id: str) -> Iterator[int]:
        digest = hashlib.sha256(call_id.encode("utf-8")).digest()
        for offset in range(0, len(digest), 8):
            yield int.from_bytes(digest[offset : offset + 8], "big") % self._bit_count

    def add(self, call_id: str) -> None:
        for position in self._positions(call_id):
            self._bits[position // 8] |= 1 << (position % 8)

    def __contains__(self, call_id: object) -> bool:
        if not isinstance(call_id, str):
            return False
        return all(
            self._bits[position // 8] & (1 << (position % 8))
            for position in self._positions(call_id)
        )


def _is_internal_agent_tool(name: Any) -> bool:
    normalized = str(name or "").lower().replace("-", "_")
    basename = re.split(r"[./:]|__", normalized)[-1]
    return basename in INTERNAL_AGENT_TOOLS or any(
        normalized.endswith(f"_{tool_name}") for tool_name in INTERNAL_AGENT_TOOLS
    )


def _iter_codex_events(path: Path, snapshot_size: int, context: ParseContext) -> Iterator[dict[str, Any]]:
    metadata, metadata_context = _codex_metadata(path, snapshot_size)
    context.metadata.update(metadata)
    context.warnings.extend(metadata_context.warnings)
    has_high_user = bool(metadata.get("has_high_user"))
    has_high_agent = bool(metadata.get("has_high_agent"))
    current_turn: str | None = None
    seen_high_messages: set[tuple[str, str]] = set()
    seen_message_order: deque[tuple[str, str]] = deque()
    ignored_call_ids = _CallIdFilter()

    def message_key(role: str, turn_id: str | None, content: str) -> tuple[str, str]:
        digest = hashlib.sha256(f"{turn_id or ''}\0{content}".encode("utf-8")).hexdigest()
        return role, digest

    def remember_message(key: tuple[str, str]) -> None:
        if key in seen_high_messages:
            return
        if len(seen_message_order) >= 4096:
            seen_high_messages.discard(seen_message_order.popleft())
        seen_message_order.append(key)
        seen_high_messages.add(key)

    def remember_ignored_call(call_id: str) -> None:
        ignored_call_ids.add(call_id)
    tool_calls = {
        "function_call",
        "custom_tool_call",
        "web_search_call",
        "tool_search_call",
    }
    tool_outputs = {
        "function_call_output",
        "custom_tool_call_output",
        "web_search_call_output",
        "tool_search_call_output",
    }
    status_events = {
        "task_started",
        "task_complete",
        "turn_aborted",
        "thread_rolled_back",
        "context_compacted",
        "patch_apply_end",
        "web_search_end",
    }
    for line_number, line, complete in _snapshot_lines(path, snapshot_size):
        record = _read_json_line(line, line_number, complete, context)
        if not record:
            continue
        record_type = str(record.get("type", ""))
        timestamp = record.get("timestamp") if isinstance(record.get("timestamp"), str) else None
        payload = record.get("payload") if isinstance(record.get("payload"), dict) else {}
        payload_type = str(payload.get("type", ""))
        if record_type == "session_meta":
            continue
        if record_type == "event_msg" and payload_type == "task_started":
            current_turn = str(payload.get("turn_id") or current_turn or "") or None
            seen_high_messages.clear()
            seen_message_order.clear()
            yield _event(line_number, "runtime", "turn_status", "task_started", timestamp=timestamp, turn_id=current_turn)
            continue
        if record_type == "event_msg" and payload_type in status_events:
            safe_status = {key: payload[key] for key in ("type", "status", "reason") if key in payload}
            yield _event(
                line_number,
                "runtime",
                "turn_status",
                _json_dump(safe_status),
                timestamp=timestamp,
                turn_id=current_turn,
            )
            continue
        if record_type == "event_msg" and payload_type == "user_message":
            content = _content_text(payload.get("message"))
            key = message_key("user", current_turn, content)
            remember_message(key)
            yield _event(line_number, "user", "message", content, timestamp=timestamp, turn_id=current_turn)
            continue
        if record_type == "event_msg" and payload_type == "agent_message":
            content = _content_text(payload.get("message"))
            key = message_key("assistant", current_turn, content)
            remember_message(key)
            yield _event(line_number, "assistant", "message", content, timestamp=timestamp, turn_id=current_turn)
            continue
        if record_type != "response_item":
            if record_type not in {"turn_context", "world_state", "compacted"}:
                context.ignored[f"{record_type}/{payload_type or '-'}"] += 1
            continue
        if payload_type in {"reasoning", "agent_message"}:
            context.ignored[f"response_item/{payload_type}"] += 1
            continue
        if payload_type == "message":
            role = str(payload.get("role", ""))
            if role in {"system", "developer"}:
                context.ignored[f"message/{role}"] += 1
                continue
            if role not in {"user", "assistant"}:
                context.ignored[f"message/{role or '-'}"] += 1
                continue
            phase = str(payload.get("phase", ""))
            content = _content_text(payload.get("content"))
            key = message_key(role, current_turn, content)
            use_fallback = (role == "user" and not has_high_user) or (
                role == "assistant" and not has_high_agent
            )
            if role == "assistant" and phase == "final_answer":
                use_fallback = True
            if use_fallback and key not in seen_high_messages:
                yield _event(line_number, role, "message", content, timestamp=timestamp, turn_id=current_turn)
            else:
                context.ignored[f"duplicate_message/{role}"] += 1
            continue
        call_id_value = payload.get("call_id") or payload.get("id")
        call_id = str(call_id_value) if call_id_value is not None else None
        if payload_type in tool_calls:
            if _is_internal_agent_tool(payload.get("name")):
                if call_id:
                    remember_ignored_call(call_id)
                context.ignored["internal_agent_tool"] += 1
                continue
            yield _event(
                line_number,
                "tool",
                "tool_call",
                _tool_content(payload, output=False),
                timestamp=timestamp,
                turn_id=current_turn,
                call_id=call_id,
            )
            continue
        if payload_type in tool_outputs:
            if call_id and call_id in ignored_call_ids:
                context.ignored["internal_agent_tool_output"] += 1
                continue
            event = _event(
                line_number,
                "tool",
                "tool_result",
                _tool_content(payload, output=True),
                timestamp=timestamp,
                turn_id=current_turn,
                call_id=call_id,
            )
            for key in ("status", "exit_code", "success"):
                if isinstance(payload.get(key), (str, int, bool)):
                    event[key] = payload[key]
            yield event
            continue
        context.ignored[f"response_item/{payload_type or '-'}"] += 1


def _generic_record_event(record: dict[str, Any], ordinal: int) -> dict[str, Any] | None:
    record_type = str(record.get("type", "")).lower()
    if record_type in {"reasoning", "system", "developer", "world_state", "turn_context"}:
        return None
    message = record.get("message") if isinstance(record.get("message"), dict) else record
    role = str(message.get("role") or record.get("role") or record_type).lower()
    if role in {"system", "developer"}:
        return None
    if role not in {"user", "assistant", "tool"}:
        if record_type not in {"user", "assistant", "tool", "tool_call", "tool_result"}:
            return None
        role = "tool" if record_type.startswith("tool") else record_type
    is_tool_result = record_type == "tool_result" or (
        role == "tool" and any(key in record for key in ("output", "result", "status", "exit_code", "success"))
    )
    is_tool_call = record_type == "tool_call"
    if is_tool_result or is_tool_call:
        content = _tool_content(record, output=is_tool_result)
    else:
        content = _content_text(
            message.get("content") if "content" in message else message.get("text") or message.get("message")
        )
    if not content:
        return None
    kind = "message" if role in {"user", "assistant"} else (
        "tool_call" if is_tool_call else "tool_result"
    )
    timestamp = record.get("timestamp") if isinstance(record.get("timestamp"), str) else None
    call_value = record.get("call_id") or message.get("call_id")
    event = _event(
        ordinal,
        role,
        kind,
        content,
        timestamp=timestamp,
        call_id=str(call_value) if call_value is not None else None,
    )
    if is_tool_result:
        for key in ("status", "exit_code", "success"):
            if isinstance(record.get(key), (str, int, bool)):
                event[key] = record[key]
    return event


def _generic_internal_record(
    record: dict[str, Any],
    ignored_call_ids: _CallIdFilter,
) -> bool:
    message = record.get("message") if isinstance(record.get("message"), dict) else record
    record_type = str(record.get("type", "")).lower()
    call_value = record.get("call_id") or message.get("call_id") or record.get("id")
    call_id = str(call_value) if call_value is not None else None
    if record_type in {"custom_tool_call", "function_call", "tool_call"} and _is_internal_agent_tool(
        record.get("name") or message.get("name") or record.get("tool_name")
    ):
        if call_id:
            ignored_call_ids.add(call_id)
        return True
    return bool(
        call_id
        and call_id in ignored_call_ids
        and record_type in {"custom_tool_call_output", "function_call_output", "tool_result"}
    )


def _iter_generic_jsonl(path: Path, snapshot_size: int, context: ParseContext) -> Iterator[dict[str, Any]]:
    ignored_call_ids = _CallIdFilter()
    for line_number, line, complete in _snapshot_lines(path, snapshot_size):
        record = _read_json_line(line, line_number, complete, context)
        if not record:
            continue
        if _generic_internal_record(record, ignored_call_ids):
            context.ignored["internal_agent_tool"] += 1
            continue
        event = _generic_record_event(record, line_number)
        if event:
            yield event
        else:
            context.ignored[str(record.get("type", "unknown"))] += 1


def _iter_generic_json(path: Path, snapshot_size: int, context: ParseContext) -> Iterator[dict[str, Any]]:
    if snapshot_size > MAX_GENERIC_JSON_BYTES:
        raise SourceError(
            "generic JSON transcripts over 16 MiB must be converted to JSONL before recovery"
        )
    raw = b"".join(_snapshot_bytes(path, snapshot_size))
    try:
        value = json.loads(raw.decode("utf-8", errors="strict"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise SourceError(f"invalid JSON transcript: {error}") from error
    if isinstance(value, dict):
        for key in ("messages", "conversation", "items", "events"):
            if isinstance(value.get(key), list):
                value = value[key]
                break
        else:
            value = [value]
    if not isinstance(value, list):
        raise SourceError("JSON transcript must be an array or contain messages/conversation/items/events")
    ignored_call_ids = _CallIdFilter()
    for ordinal, record in enumerate(value, start=1):
        if not isinstance(record, dict):
            context.ignored["non_object"] += 1
            continue
        if _generic_internal_record(record, ignored_call_ids):
            context.ignored["internal_agent_tool"] += 1
            continue
        event = _generic_record_event(record, ordinal)
        if event:
            yield event
        else:
            context.ignored[str(record.get("type", "unknown"))] += 1


def _iter_text(path: Path, snapshot_size: int, _context: ParseContext) -> Iterator[dict[str, Any]]:
    buffer: list[str] = []
    start_line = 1
    for line_number, line, _complete in _snapshot_lines(path, snapshot_size):
        if not buffer:
            start_line = line_number
        buffer.append(line.rstrip("\r\n"))
        if not line.strip() or sum(len(item) for item in buffer) >= 2048:
            content = "\n".join(buffer).strip()
            if content:
                yield _event(start_line, "unknown", "transcript_text", content)
            buffer = []
    content = "\n".join(buffer).strip()
    if content:
        yield _event(start_line, "unknown", "transcript_text", content)


def _detect_kind(path: Path, snapshot_size: int) -> str:
    suffix = path.suffix.lower()
    if suffix == ".jsonl":
        context = ParseContext()
        for line_number, line, complete in _snapshot_lines(path, snapshot_size):
            record = _read_json_line(line, line_number, complete, context)
            if not record:
                continue
            if record.get("type") in {"session_meta", "event_msg", "response_item", "turn_context", "world_state"}:
                return "codex-jsonl"
            return "generic-jsonl"
        return "generic-jsonl"
    if suffix == ".json":
        return "generic-json"
    return "text"


def _verify_session_file(path: Path, session_id: str) -> bool:
    snapshot_size = path.stat().st_size
    context = ParseContext()
    for line_number, line, complete in _snapshot_lines(path, min(snapshot_size, 1024 * 1024)):
        record = _read_json_line(line, line_number, complete, context)
        if not record:
            continue
        if record.get("type") != "session_meta":
            continue
        payload = record.get("payload") if isinstance(record.get("payload"), dict) else {}
        value = payload.get("id") or payload.get("session_id")
        return str(value) == session_id
    return False


def _sqlite_candidates(codex_home: Path, session_id: str) -> list[Path]:
    paths: list[Path] = []
    for database in (codex_home / "state_5.sqlite", codex_home / "sqlite" / "state_5.sqlite"):
        if not database.is_file():
            continue
        try:
            connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
            try:
                row = connection.execute("SELECT rollout_path FROM threads WHERE id = ?", (session_id,)).fetchone()
            finally:
                connection.close()
        except sqlite3.Error:
            continue
        if row and row[0]:
            paths.append(Path(str(row[0])).expanduser())
    return paths


def locate_codex_session(session_id: str, codex_home: Path | None = None) -> Path:
    if not SESSION_ID_RE.fullmatch(session_id):
        raise SourceError("Codex task id must be a UUID")
    home = (codex_home or Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))).expanduser()
    candidates = _sqlite_candidates(home, session_id)
    for root in (home / "sessions", home / "archived_sessions"):
        if root.is_dir():
            candidates.extend(root.rglob(f"*-{session_id}.jsonl"))
    verified: list[Path] = []
    seen: set[Path] = set()
    for candidate in candidates:
        try:
            resolved = candidate.resolve(strict=True)
        except (OSError, RuntimeError):
            continue
        if resolved in seen or not resolved.is_file():
            continue
        seen.add(resolved)
        if _verify_session_file(resolved, session_id):
            verified.append(resolved)
    if not verified:
        raise SourceError(f"no persisted Codex rollout found for task {session_id}")
    if len(verified) > 1:
        joined = "\n".join(str(path) for path in verified)
        raise SourceError(f"multiple verified rollouts found; choose one explicitly:\n{joined}")
    return verified[0]


def resolve_source(source: str, codex_home: Path | None = None) -> SourceInfo:
    if SESSION_ID_RE.fullmatch(source):
        path = locate_codex_session(source, codex_home)
        archived = "archived_sessions" in path.parts
    else:
        path = Path(source).expanduser().resolve(strict=True)
        archived = "archived_sessions" in path.parts
    if not path.is_file():
        raise SourceError(f"source is not a file: {path}")
    snapshot_size = path.stat().st_size
    kind = _detect_kind(path, snapshot_size)
    session_id: str | None = source if SESSION_ID_RE.fullmatch(source) else None
    cwd: str | None = None
    context_tokens: int | None = None
    if kind == "codex-jsonl":
        metadata, _context = _codex_metadata(path, snapshot_size)
        detected_id = metadata.get("session_id")
        if session_id and detected_id != session_id:
            raise SourceError("rollout session metadata does not match the requested task id")
        session_id = str(detected_id) if detected_id else session_id
        cwd = str(metadata.get("cwd")) if metadata.get("cwd") else None
        value = metadata.get("context_tokens")
        context_tokens = value if isinstance(value, int) else None
    return SourceInfo(path, kind, snapshot_size, session_id, cwd, context_tokens, archived)


def _split_text(text: str, max_bytes: int) -> list[str]:
    if len(text.encode("utf-8")) <= max_bytes:
        return [text]
    parts: list[str] = []
    current: list[str] = []
    current_bytes = 0
    for character in text:
        size = len(character.encode("utf-8"))
        if current and current_bytes + size > max_bytes:
            parts.append("".join(current))
            current = []
            current_bytes = 0
        current.append(character)
        current_bytes += size
    if current:
        parts.append("".join(current))
    return parts


def _fit_event(event: dict[str, Any], max_bytes: int) -> list[dict[str, Any]]:
    encoded = (_json_dump(event) + "\n").encode("utf-8")
    if len(encoded) <= max_bytes:
        return [event]
    content = str(event.get("content", ""))
    already_split = isinstance(event.get("part"), int) and isinstance(event.get("parts"), int)
    base_path = event.get("part_path")
    base_totals = event.get("part_totals")
    if not isinstance(base_path, list) or not all(isinstance(value, int) for value in base_path):
        base_path = [int(event["part"])] if already_split else []
    if not isinstance(base_totals, list) or not all(isinstance(value, int) for value in base_totals):
        base_totals = [int(event["parts"])] if already_split else []
    probe = {
        **event,
        "content": "",
        "part": int(event["part"]) if already_split else 1,
        "parts": int(event["parts"]) if already_split else 1,
        "part_path": [*base_path, 1],
        "part_totals": [*base_totals, 1],
    }
    overhead = len((_json_dump(probe) + "\n").encode("utf-8"))
    text_budget = max(64, max_bytes - overhead - 32)
    while text_budget >= 16:
        texts = _split_text(content, text_budget)
        parts = []
        for index, text in enumerate(texts, 1):
            part = {
                **event,
                "content": text,
                "part": int(event["part"]) if already_split else index,
                "parts": int(event["parts"]) if already_split else len(texts),
                "part_path": [*base_path, index],
                "part_totals": [*base_totals, len(texts)],
            }
            parts.append(part)
        if all(len((_json_dump(part) + "\n").encode("utf-8")) <= max_bytes for part in parts):
            return parts
        text_budget //= 2
    raise SourceError(f"event metadata at ordinal {event.get('ordinal')} exceeds the chunk budget")


def _redacted_events(info: SourceInfo, context: ParseContext, redactor: Redactor) -> Iterator[dict[str, Any]]:
    if info.kind == "codex-jsonl":
        events = _iter_codex_events(info.path, info.snapshot_size, context)
    elif info.kind == "generic-jsonl":
        events = _iter_generic_jsonl(info.path, info.snapshot_size, context)
    elif info.kind == "generic-json":
        events = _iter_generic_json(info.path, info.snapshot_size, context)
    else:
        events = _iter_text(info.path, info.snapshot_size, context)
    for event in events:
        redacted = dict(event)
        redacted["content"] = redactor.redact(str(event.get("content", "")))
        if "turn_id" in redacted:
            redacted["turn_id"] = redactor._stable("id", str(redacted["turn_id"]))
        if "call_id" in redacted:
            redacted["call_id"] = redactor._stable("id", str(redacted["call_id"]))
        yield redacted


def _event_units(events: Iterable[dict[str, Any]], max_bytes: int) -> Iterator[list[dict[str, Any]]]:
    pending: list[dict[str, Any]] = []
    pending_call: str | None = None
    pending_bytes = 0
    for event in events:
        call_id = event.get("call_id")
        event_bytes = len((_json_dump(event) + "\n").encode("utf-8"))
        same_call = bool(pending and pending_call and call_id == pending_call)
        if same_call and pending_bytes + event_bytes <= max_bytes:
            pending.append(event)
            pending_bytes += event_bytes
            continue
        if pending:
            yield pending
        pending = [event]
        pending_bytes = event_bytes
        pending_call = str(call_id) if call_id else None
    if pending:
        yield pending


def _write_chunk(path: Path, records: Sequence[dict[str, Any]]) -> dict[str, Any]:
    body = "".join(_json_dump(record) + "\n" for record in records)
    try:
        with path.open("x", encoding="utf-8") as handle:
            handle.write(body)
    except FileExistsError as error:
        raise SourceError(f"refusing to overwrite prepared chunk: {path.name}") from error
    os.chmod(path, 0o600)
    ordinals = [int(record["ordinal"]) for record in records if isinstance(record.get("ordinal"), int)]
    return {
        "file": str(path.name),
        "bytes": len(body.encode("utf-8")),
        "sha256": hashlib.sha256(body.encode("utf-8")).hexdigest(),
        "event_count": len(records),
        "source_ordinals": [min(ordinals), max(ordinals)] if ordinals else [],
        "status": "pending",
    }


def _chunk_events(
    events: Iterable[dict[str, Any]],
    chunks_dir: Path,
    max_bytes: int,
    id_prefix: str = "",
) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    current: list[dict[str, Any]] = []
    current_bytes = 0

    def flush() -> None:
        nonlocal current, current_bytes
        if not current:
            return
        number = len(chunks) + 1
        chunk_id = f"{id_prefix}{number}" if id_prefix else f"{number:04d}"
        file_name = f"chunk-{chunk_id.replace('.', '-')}.jsonl"
        metadata = _write_chunk(chunks_dir / file_name, current)
        metadata["id"] = chunk_id
        metadata["file"] = f"chunks/{file_name}"
        chunks.append(metadata)
        current = []
        current_bytes = 0

    for unit in _event_units(events, max_bytes):
        fitted: list[dict[str, Any]] = []
        for event in unit:
            fitted.extend(_fit_event(event, max_bytes))
        unit_bytes = sum(len((_json_dump(event) + "\n").encode("utf-8")) for event in fitted)
        if current and current_bytes + unit_bytes > max_bytes:
            flush()
        for event in fitted:
            event_bytes = len((_json_dump(event) + "\n").encode("utf-8"))
            if current and current_bytes + event_bytes > max_bytes:
                flush()
            current.append(event)
            current_bytes += event_bytes
    flush()
    return chunks


def _ensure_private_directory(path: Path) -> None:
    if path.is_symlink():
        raise SourceError(f"refusing to use a symlinked private directory: {path}")
    path.mkdir(parents=True, exist_ok=True)
    if not path.is_dir():
        raise SourceError(f"private path is not a directory: {path}")
    os.chmod(path, 0o700)


@contextlib.contextmanager
def _run_lock(run_dir: Path) -> Iterator[None]:
    lock_path = run_dir / ".manifest.lock"
    if lock_path.is_symlink():
        raise SourceError("refusing to follow a symlinked run lock")
    flags = os.O_RDWR | os.O_CREAT
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(lock_path, flags, 0o600)
    with os.fdopen(descriptor, "r+b") as handle:
        os.chmod(lock_path, 0o600)
        if os.name == "nt":
            import msvcrt

            if handle.tell() == 0:
                handle.write(b"0")
                handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
            try:
                yield
            finally:
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def _ensure_work_ignore(work_root: Path) -> None:
    if work_root.name != ".work":
        return
    knowledge_dir = work_root.parent
    knowledge_dir.mkdir(parents=True, exist_ok=True)
    ignore_path = knowledge_dir / ".gitignore"
    if ignore_path.is_symlink():
        raise SourceError("refusing to follow a symlinked session-knowledge/.gitignore")
    flags = os.O_RDWR | os.O_CREAT
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(ignore_path, flags, 0o644)
    with os.fdopen(descriptor, "r+", encoding="utf-8") as handle:
        existing = handle.read()
        lines = existing.splitlines()
        additions = [entry for entry in (".work/", ".session-to-knowledge-*.draft.md") if entry not in lines]
        if additions:
            suffix = "" if not existing or existing.endswith("\n") else "\n"
            addition_text = "\n".join(additions)
            handle.seek(0, os.SEEK_END)
            handle.write(f"{suffix}{addition_text}\n")


def _budget_for(info: SourceInfo, requested: int | None) -> int:
    if requested is not None:
        if requested < 1024:
            raise SourceError("--max-bytes must be at least 1024")
        return requested
    if info.context_tokens:
        return max(1024, min(MAX_DEFAULT_BUDGET, int(info.context_tokens * 0.4)))
    return DEFAULT_UNKNOWN_BUDGET


def _active_chunks(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    return [chunk for chunk in manifest["chunks"] if chunk.get("status") != "split"]


def _coverage_commitment(manifest: dict[str, Any]) -> dict[str, Any]:
    chunk_ids = [str(chunk["id"]) for chunk in _active_chunks(manifest)]
    digest = hashlib.sha256("\n".join(chunk_ids).encode("utf-8")).hexdigest()
    return {"chunk_count": len(chunk_ids), "leaf_ids_sha256": digest}


def _refresh_estimate(manifest: dict[str, Any], preserve_confirmation: bool = False) -> None:
    chunks = _active_chunks(manifest)
    source_bytes = sum(int(chunk["bytes"]) for chunk in chunks)
    estimate = source_bytes * 3 + len(chunks) * 4096
    requires = len(chunks) > 50 or estimate > 250_000
    budget = manifest["budget"]
    budget.update(
        {
            "active_chunk_count": len(chunks),
            "redacted_source_bytes": source_bytes,
            "estimated_input_tokens": estimate,
            "requires_confirmation": requires,
        }
    )
    previous = manifest.get("confirmation", {})
    confirmed_estimate = previous.get("confirmed_estimate")
    keep_confirmation = (
        preserve_confirmation
        and previous.get("status") == "confirmed"
        and isinstance(confirmed_estimate, int)
        and estimate <= confirmed_estimate
    )
    if requires:
        manifest["confirmation"] = (
            previous if keep_confirmation else {"status": "required", "confirmed_estimate": None}
        )
    else:
        manifest["confirmation"] = {"status": "not_required", "confirmed_estimate": None}


def _prepare_summary(run_dir: Path, manifest: dict[str, Any], resumed: bool) -> dict[str, Any]:
    return {
        "resumed": resumed,
        "run_dir": str(run_dir),
        "source_sha256": manifest["source"]["sha256"],
        "active_chunk_count": manifest["budget"]["active_chunk_count"],
        "coverage_commitment": _coverage_commitment(manifest),
        "max_chunk_bytes": manifest["budget"]["max_chunk_bytes"],
        "estimated_input_tokens": manifest["budget"]["estimated_input_tokens"],
        "confirmation": manifest["confirmation"]["status"],
        "warning_count": len(manifest.get("warnings", [])),
    }


CARD_LIST_FIELDS = (
    "problem_evidence",
    "constraints",
    "actions",
    "root_cause_evidence",
    "solution_evidence",
    "verification_evidence",
    "important_failures",
    "open_questions",
)
PROVENANCE_FIELDS = CARD_LIST_FIELDS[:-1]


def _validate_card(
    card: Any,
    label: str,
    allowed_ordinals: set[int] | None = None,
    call_ids_by_ordinal: dict[int, set[str]] | None = None,
) -> None:
    if not isinstance(card, dict):
        raise SourceError(f"{label} contains an invalid card")
    if not isinstance(card.get("candidate"), str) or not card["candidate"].strip():
        raise SourceError(f"{label} card has no candidate")
    if card.get("problem_type") not in {"task", "agent"}:
        raise SourceError(f"{label} card has an invalid problem_type")
    if card.get("confidence") not in {"high", "medium", "low"}:
        raise SourceError(f"{label} card has an invalid confidence")
    for field_name in CARD_LIST_FIELDS:
        if not isinstance(card.get(field_name), list):
            raise SourceError(f"{label} card field {field_name} must be a list")
    for field_name in PROVENANCE_FIELDS:
        for evidence in card[field_name]:
            if not isinstance(evidence, dict) or not isinstance(evidence.get("ordinal"), int):
                raise SourceError(f"{label} {field_name} item must contain an ordinal")
            if allowed_ordinals is not None and evidence["ordinal"] not in allowed_ordinals:
                raise SourceError(f"{label} cites an ordinal outside its source chunk")
            if "call_id" in evidence and not isinstance(evidence["call_id"], str):
                raise SourceError(f"{label} contains an invalid call_id")
            expected_call_ids = (call_ids_by_ordinal or {}).get(evidence["ordinal"], set())
            if expected_call_ids and evidence.get("call_id") not in expected_call_ids:
                raise SourceError(f"{label} must preserve the source call_id")


def _validate_map_package(
    value: Any,
    expected_chunk_id: str,
    allowed_ordinals: set[int],
    call_ids_by_ordinal: dict[int, set[str]],
) -> None:
    if not isinstance(value, dict) or value.get("chunk_id") != expected_chunk_id:
        raise SourceError(f"map artifact chunk_id does not match {expected_chunk_id}")
    coverage = value.get("coverage")
    if not isinstance(coverage, dict) or coverage.get("complete") is not True:
        raise SourceError(f"map artifact coverage is incomplete for {expected_chunk_id}")
    cards = value.get("cards")
    if not isinstance(cards, list) or len(cards) > 8:
        raise SourceError(f"map artifact must contain at most 8 cards for {expected_chunk_id}")
    for card in cards:
        _validate_card(
            card,
            f"map artifact for {expected_chunk_id}",
            allowed_ordinals,
            call_ids_by_ordinal,
        )


def _chunk_source_index(body: bytes) -> tuple[set[int], dict[int, set[str]]]:
    ordinals: set[int] = set()
    call_ids: dict[int, set[str]] = {}
    for line in body.decode("utf-8").splitlines():
        value = json.loads(line)
        if isinstance(value, dict) and isinstance(value.get("ordinal"), int):
            ordinal = value["ordinal"]
            ordinals.add(ordinal)
            if isinstance(value.get("call_id"), str):
                call_ids.setdefault(ordinal, set()).add(value["call_id"])
    return ordinals, call_ids


def _safe_artifact(
    run_dir: Path,
    relative: str,
    require_json: bool = True,
    expected_chunk_id: str | None = None,
    allowed_ordinals: set[int] | None = None,
    call_ids_by_ordinal: dict[int, set[str]] | None = None,
    max_bytes: int | None = None,
    privacy_safe_literals: Sequence[str] = (),
) -> dict[str, Any]:
    path = (run_dir / relative).resolve()
    try:
        path.relative_to(run_dir)
    except ValueError as error:
        raise SourceError("artifact must stay inside the run directory") from error
    if not path.is_file():
        raise SourceError(f"artifact does not exist: {relative}")
    if max_bytes is not None and path.stat().st_size > max_bytes:
        raise SourceError(f"artifact exceeds the worker byte budget: {relative}")
    body = path.read_bytes()
    if max_bytes is not None and len(body) > max_bytes:
        raise SourceError(f"artifact exceeds the worker byte budget: {relative}")
    if require_json:
        try:
            value = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise SourceError(f"artifact is not valid JSON: {relative}") from error
        if expected_chunk_id is not None:
            _validate_map_package(
                value,
                expected_chunk_id,
                allowed_ordinals or set(),
                call_ids_by_ordinal or {},
            )
        privacy_text = body.decode("utf-8")
        for literal in privacy_safe_literals:
            privacy_text = privacy_text.replace(literal, "")
        findings = Redactor.scan(privacy_text)
        if findings:
            categories = ", ".join(sorted(findings))
            raise SourceError(f"artifact privacy scan failed ({categories}): {relative}")
    return {
        "path": relative,
        "bytes": len(body),
        "sha256": hashlib.sha256(body).hexdigest(),
    }


def _artifact_json_value(run_dir: Path, relative: str) -> Any:
    path = (run_dir / relative).resolve()
    try:
        path.relative_to(run_dir)
    except ValueError as error:
        raise SourceError("artifact must stay inside the run directory") from error
    return json.loads(path.read_text(encoding="utf-8"))


def _active_source_index(
    run_dir: Path,
    manifest: dict[str, Any],
) -> tuple[set[int], dict[int, set[str]]]:
    ordinals: set[int] = set()
    call_ids: dict[int, set[str]] = {}
    for chunk in _active_chunks(manifest):
        body = (run_dir / str(chunk["file"])).read_bytes()
        chunk_ordinals, chunk_calls = _chunk_source_index(body)
        ordinals.update(chunk_ordinals)
        for ordinal, values in chunk_calls.items():
            call_ids.setdefault(ordinal, set()).update(values)
    return ordinals, call_ids


def _validate_reduce_package(run_dir: Path, manifest: dict[str, Any], value: Any) -> None:
    if not isinstance(value, dict):
        raise SourceError("reduce artifact must be a JSON object")
    coverage = value.get("coverage")
    expected_coverage = _coverage_commitment(manifest)
    if not isinstance(coverage, dict) or coverage.get("complete") is not True:
        raise SourceError("reduce artifact coverage is incomplete")
    if any(coverage.get(key) != expected for key, expected in expected_coverage.items()):
        raise SourceError("reduce artifact does not cover every active chunk")
    cards = value.get("cards")
    if not isinstance(cards, list) or not 1 <= len(cards) <= 8:
        raise SourceError("reduce artifact must contain 1 to 8 cards")
    ordinals, call_ids = _active_source_index(run_dir, manifest)
    for card in cards:
        _validate_card(card, "reduce artifact", ordinals, call_ids)


def _source_events_for_ordinals(
    run_dir: Path,
    manifest: dict[str, Any],
    wanted: set[int],
) -> dict[int, list[dict[str, Any]]]:
    found: dict[int, list[dict[str, Any]]] = {}
    for chunk in _active_chunks(manifest):
        path = run_dir / str(chunk["file"])
        for line in path.read_text(encoding="utf-8").splitlines():
            event = json.loads(line)
            ordinal = event.get("ordinal") if isinstance(event, dict) else None
            if ordinal in wanted:
                found.setdefault(ordinal, []).append(event)
    return found


def _tool_result_succeeded(event: dict[str, Any]) -> bool:
    if event.get("role") != "tool" or event.get("kind") != "tool_result":
        return False
    result = {key: event[key] for key in ("status", "exit_code", "success") if key in event}
    if not result:
        try:
            result = json.loads(str(event.get("content", "")))
        except json.JSONDecodeError:
            return False
    if not isinstance(result, dict):
        return False
    if result.get("success") is False:
        return False
    if isinstance(result.get("exit_code"), int) and result["exit_code"] != 0:
        return False
    status = str(result.get("status", "")).lower()
    if status in {"failed", "error", "cancelled", "canceled"}:
        return False
    return result.get("success") is True or result.get("exit_code") == 0 or status in {
        "passed",
        "succeeded",
        "success",
    }


def _explicit_user_confirmation(event: dict[str, Any], evidence: dict[str, Any]) -> bool:
    if event.get("role") != "user" or event.get("kind") != "message":
        return False
    content = str(event.get("content", ""))
    quote = evidence.get("quote")
    if not isinstance(quote, str) or not quote.strip():
        return False
    normalized_content = " ".join(content.split())
    normalized_quote = " ".join(quote.split())
    if normalized_quote != normalized_content or len(normalized_content) > 240:
        return False
    if "?" in normalized_content or "？" in normalized_content:
        return False
    normalized = normalized_content
    return bool(
        re.fullmatch(
            r"(?i)(?:(?:yes|thanks|thank you)[,! ]+)?(?:confirmed|resolved|fixed|succeeded|"
            r"it works now|now it works|tests? passed|the tests? passed|"
            r"(?:it|this|the issue|the problem) is (?:fixed|resolved)|"
            r"i confirm (?:it|this|the issue|the problem) is (?:fixed|resolved))[.! ]*",
            normalized,
        )
        or re.fullmatch(
            r"(?:(?:好的|确认|谢谢)[，,！!。 ]*)?(?:问题)?(?:已解决|解决了|已修复|修复了|可以了|"
            r"验证通过|测试通过|确认成功)[！!。 ]*",
            normalized,
        )
    )


def _validate_evidence_reference(
    evidence: Any,
    label: str,
    source_events: dict[int, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    if (
        not isinstance(evidence, dict)
        or not isinstance(evidence.get("ordinal"), int)
        or not isinstance(evidence.get("fact"), str)
        or not evidence["fact"].strip()
    ):
        raise SourceError(f"{label} must contain ordinal and fact")
    events = source_events.get(evidence["ordinal"], [])
    if not events:
        raise SourceError(f"{label} cites an unknown source ordinal")
    if "call_id" in evidence:
        if not isinstance(evidence["call_id"], str):
            raise SourceError(f"{label} contains an invalid call_id")
        events = [event for event in events if event.get("call_id") == evidence["call_id"]]
        if not events:
            raise SourceError(f"{label} call_id does not match the source event")
    elif any(isinstance(event.get("call_id"), str) for event in events):
        raise SourceError(f"{label} must preserve the source call_id")
    return events


def _validate_verify_package(
    run_dir: Path,
    manifest: dict[str, Any],
    value: Any,
    reduce_value: Any,
) -> None:
    if not isinstance(value, dict):
        raise SourceError("verify artifact must be a JSON object")
    coverage = value.get("coverage")
    if not isinstance(coverage, dict) or coverage.get("complete") is not True:
        raise SourceError("verify artifact coverage is incomplete")
    candidates = value.get("candidates")
    if not isinstance(candidates, list) or not 1 <= len(candidates) <= 3:
        raise SourceError("verify artifact must contain 1 to 3 accepted candidates")
    reduced_names = {
        card.get("candidate")
        for card in reduce_value.get("cards", [])
        if isinstance(card, dict)
    }
    reference_fields = (
        "problem_evidence",
        "action_evidence",
        "root_cause_evidence",
        "solution_evidence",
        "verification_evidence",
    )
    wanted = {
        evidence.get("ordinal")
        for candidate in candidates
        if isinstance(candidate, dict)
        for field_name in reference_fields
        for evidence in candidate.get(field_name, [])
        if isinstance(evidence, dict) and isinstance(evidence.get("ordinal"), int)
    }
    source_events = _source_events_for_ordinals(run_dir, manifest, wanted)
    for candidate in candidates:
        if not isinstance(candidate, dict) or candidate.get("accepted") is not True:
            raise SourceError("verify artifact contains an unaccepted candidate")
        if candidate.get("candidate") not in reduced_names:
            raise SourceError("verify artifact candidate is absent from the reduce result")
        if candidate.get("contradictions") != []:
            raise SourceError("verify artifact contains unresolved contradictions")
        for field_name in reference_fields:
            evidence_items = candidate.get(field_name)
            if not isinstance(evidence_items, list) or not evidence_items:
                raise SourceError(f"verify candidate is missing {field_name}")
            for evidence in evidence_items:
                events = _validate_evidence_reference(
                    evidence,
                    f"verify {field_name}",
                    source_events,
                )
                if field_name != "verification_evidence":
                    continue
                kind = evidence.get("verification_kind")
                if kind == "tool_result" and any(_tool_result_succeeded(event) for event in events):
                    continue
                if kind == "user_confirmation" and any(
                    _explicit_user_confirmation(event, evidence) for event in events
                ):
                    continue
                raise SourceError("verification evidence is not a successful tool result or user confirmation")


def _safe_stage_artifact(
    run_dir: Path,
    manifest: dict[str, Any],
    stage: str,
    relative: str,
) -> dict[str, Any]:
    safe_literals: tuple[str, ...] = ()
    if stage == "reduce":
        safe_literals = (str(_coverage_commitment(manifest)["leaf_ids_sha256"]),)
    metadata = _safe_artifact(
        run_dir,
        relative,
        max_bytes=int(manifest["budget"]["max_chunk_bytes"]),
        privacy_safe_literals=safe_literals,
    )
    value = _artifact_json_value(run_dir, relative)
    if stage == "reduce":
        _validate_reduce_package(run_dir, manifest, value)
    elif stage == "verify":
        reduce_artifact = manifest.get("stage_artifacts", {}).get("reduce")
        if not isinstance(reduce_artifact, dict):
            raise SourceError("verify requires a validated reduce artifact")
        reduce_value = _artifact_json_value(run_dir, str(reduce_artifact.get("path", "")))
        _validate_reduce_package(run_dir, manifest, reduce_value)
        _validate_verify_package(run_dir, manifest, value, reduce_value)
    else:
        raise SourceError(f"unsupported artifact stage: {stage}")
    return metadata


def _validate_chunk_file(run_dir: Path, manifest: dict[str, Any], chunk: dict[str, Any]) -> None:
    path = (run_dir / str(chunk["file"])).resolve()
    try:
        path.relative_to(run_dir)
    except ValueError as error:
        raise SourceError(f"chunk escapes the run directory: {chunk.get('id')}") from error
    if not path.is_file():
        raise SourceError(f"missing prepared chunk: {chunk.get('id')}")
    if path.stat().st_size != int(chunk["bytes"]):
        raise SourceError(f"prepared chunk failed integrity validation: {chunk.get('id')}")
    body = path.read_bytes()
    if hashlib.sha256(body).hexdigest() != chunk["sha256"]:
        raise SourceError(f"prepared chunk failed integrity validation: {chunk.get('id')}")
    artifact = chunk.get("artifact")
    if chunk.get("status") == "completed":
        if not isinstance(artifact, dict):
            raise SourceError(f"completed chunk has no validated artifact: {chunk.get('id')}")
        ordinals, call_ids = _chunk_source_index(body)
        checked = _safe_artifact(
            run_dir,
            str(artifact.get("path", "")),
            expected_chunk_id=str(chunk.get("id", "")),
            allowed_ordinals=ordinals,
            call_ids_by_ordinal=call_ids,
            max_bytes=int(manifest["budget"]["max_chunk_bytes"]),
        )
        if checked != artifact:
            raise SourceError(f"chunk artifact failed integrity validation: {chunk.get('id')}")


def _validate_chunk_files(run_dir: Path, manifest: dict[str, Any]) -> None:
    for chunk in manifest["chunks"]:
        _validate_chunk_file(run_dir, manifest, chunk)


def _require_confirmation(manifest: dict[str, Any]) -> None:
    if manifest.get("confirmation", {}).get("status") == "required":
        raise SourceError("cost confirmation is required before workers may run")


def prepare(source: str, work_root: Path, codex_home: Path | None, max_bytes: int | None) -> dict[str, Any]:
    info = resolve_source(source, codex_home)
    source_sha256 = _source_hash(info.path, info.snapshot_size)
    budget = _budget_for(info, max_bytes)
    work_root = work_root.expanduser()
    if not work_root.is_absolute():
        work_root = Path.cwd() / work_root
    knowledge_dir = work_root.parent
    if work_root.name != ".work" or knowledge_dir.name != "session-knowledge":
        raise SourceError("--work-root must be the session-knowledge/.work directory")
    if knowledge_dir.is_symlink() or work_root.is_symlink():
        raise SourceError("refusing to use symlinked session-knowledge work directories")
    knowledge_dir.mkdir(parents=True, exist_ok=True)
    expected_knowledge = knowledge_dir.parent.resolve() / "session-knowledge"
    if knowledge_dir.resolve() != expected_knowledge:
        raise SourceError("session-knowledge must stay inside the selected project root")
    _ensure_private_directory(work_root)
    _ensure_work_ignore(work_root)
    work_root = work_root.resolve()
    run_dir = work_root / f"{source_sha256[:16]}-{PIPELINE_VERSION}"
    if run_dir.is_symlink():
        raise SourceError("refusing to use a symlinked run directory")
    manifest_path = run_dir / "manifest.json"
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (
            manifest.get("schema") == MANIFEST_SCHEMA
            and manifest.get("pipeline_version") == PIPELINE_VERSION
            and manifest.get("source", {}).get("sha256") == source_sha256
            and manifest.get("budget", {}).get("max_chunk_bytes") == budget
        ):
            _validate_chunk_files(run_dir, manifest)
            return _prepare_summary(run_dir, manifest, resumed=True)
        raise SourceError(f"existing run directory has incompatible state: {run_dir}")
    if run_dir.exists():
        raise SourceError(f"incomplete run directory exists without a manifest: {run_dir}")
    staging = Path(
        tempfile.mkdtemp(prefix=f".{run_dir.name}.", suffix=".preparing", dir=work_root)
    )
    os.chmod(staging, 0o700)
    try:
        chunks_dir = staging / "chunks"
        cards_dir = staging / "cards"
        reductions_dir = staging / "reductions"
        for directory in (chunks_dir, cards_dir, reductions_dir):
            _ensure_private_directory(directory)
        context = ParseContext()
        redactor = Redactor()
        chunks = _chunk_events(_redacted_events(info, context, redactor), chunks_dir, budget)
        if not chunks:
            raise SourceError("no user-visible transcript events were found")
        current_size = info.path.stat().st_size
        if current_size < info.snapshot_size:
            raise SourceError("source was truncated while it was being prepared")
        if _source_hash(info.path, info.snapshot_size) != source_sha256:
            raise SourceError("source changed inside the captured snapshot while it was being prepared")
        manifest = {
            "schema": MANIFEST_SCHEMA,
            "pipeline_version": PIPELINE_VERSION,
            "source": {
                "path": str(info.path),
                "kind": info.kind,
                "sha256": source_sha256,
                "snapshot_size": info.snapshot_size,
                "session_id": info.session_id,
                "cwd": info.cwd,
                "archived": info.archived,
            },
            "budget": {
                "max_chunk_bytes": budget,
                "max_worker_concurrency": 4,
            },
            "warnings": context.warnings,
            "ignored_event_counts": dict(sorted(context.ignored.items())),
            "chunks": chunks,
            "stages": {"map": "pending", "reduce": "pending", "verify": "pending", "write": "pending"},
        }
        _refresh_estimate(manifest)
        _atomic_json(staging / "manifest.json", manifest)
        staging.rename(run_dir)
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    return _prepare_summary(run_dir, manifest, resumed=False)


def _load_manifest(run_dir: Path, allow_cleaning: bool = False) -> tuple[Path, dict[str, Any]]:
    run_dir = run_dir.expanduser().resolve(strict=True)
    if run_dir.parent.name != ".work":
        raise SourceError("run directory must stay directly under session-knowledge/.work")
    manifest_path = run_dir / "manifest.json"
    if not manifest_path.is_file():
        raise SourceError(f"missing manifest: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema") != MANIFEST_SCHEMA:
        raise SourceError("refusing to operate on an unknown run directory")
    if manifest.get("pipeline_version") != PIPELINE_VERSION:
        raise SourceError("run directory uses an incompatible pipeline version")
    if manifest.get("cleaning") is True and not allow_cleaning:
        raise SourceError("run cleanup is already in progress")
    return manifest_path, manifest


STAGE_ORDER = ("map", "reduce", "verify", "write")


def _require_mutable(manifest: dict[str, Any]) -> None:
    if manifest.get("stages", {}).get("write") in {"finalizing", "completed"}:
        raise SourceError("a finalizing or completed run cannot be changed")


def _invalidate_from(manifest: dict[str, Any], stage: str) -> None:
    start = STAGE_ORDER.index(stage)
    stage_artifacts = manifest.setdefault("stage_artifacts", {})
    for name in STAGE_ORDER[start:]:
        manifest["stages"][name] = "pending"
        stage_artifacts.pop(name, None)
    manifest.pop("final_artifact", None)


def _invalidate_after(manifest: dict[str, Any], stage: str) -> None:
    index = STAGE_ORDER.index(stage) + 1
    if index < len(STAGE_ORDER):
        _invalidate_from(manifest, STAGE_ORDER[index])


def mark(run_dir: Path, chunk_id: str | None, stage: str | None, status: str, artifact: str | None) -> dict[str, Any]:
    resolved = run_dir.expanduser().resolve(strict=True)
    with _run_lock(resolved):
        manifest_path, manifest = _load_manifest(resolved)
        _require_mutable(manifest)
        if bool(chunk_id) == bool(stage):
            raise SourceError("select exactly one of --chunk or --stage")
        if status in {"running", "completed"}:
            _require_confirmation(manifest)
        result: dict[str, Any]
        if chunk_id:
            item = next((chunk for chunk in manifest["chunks"] if chunk.get("id") == chunk_id), None)
            if item is None:
                raise SourceError(f"unknown chunk id: {chunk_id}")
            _validate_chunk_file(resolved, manifest, item)
            if item.get("status") == "split":
                raise SourceError("a split parent cannot be marked as a worker result")
            new_artifact: dict[str, Any] | None = None
            if status == "completed":
                if not artifact:
                    raise SourceError("completed chunks require --artifact")
                body = (resolved / str(item["file"])).read_bytes()
                ordinals, call_ids = _chunk_source_index(body)
                new_artifact = _safe_artifact(
                    resolved,
                    artifact,
                    expected_chunk_id=chunk_id,
                    allowed_ordinals=ordinals,
                    call_ids_by_ordinal=call_ids,
                    max_bytes=int(manifest["budget"]["max_chunk_bytes"]),
                )
            elif artifact:
                raise SourceError("--artifact is only valid with completed status")
            changed = item.get("status") != status or item.get("artifact") != new_artifact
            if changed:
                _invalidate_from(manifest, "map")
            if status == "running" and item.get("status") != "running":
                running_count = sum(
                    1
                    for chunk in _active_chunks(manifest)
                    if chunk.get("status") == "running" and chunk.get("id") != chunk_id
                )
                if running_count >= int(manifest["budget"]["max_worker_concurrency"]):
                    raise SourceError("maximum map worker concurrency is already in use")
                attempts = int(item.get("attempts", 0)) + 1
                if attempts > 4:
                    raise SourceError(f"chunk retry limit exceeded: {chunk_id}")
                item["attempts"] = attempts
            if new_artifact is None:
                item.pop("artifact", None)
            else:
                item["artifact"] = new_artifact
            item["status"] = status
            result = {"chunk": chunk_id, "status": status, "artifact": item.get("artifact")}
        else:
            if stage not in manifest["stages"]:
                raise SourceError(f"unknown stage: {stage}")
            if stage == "write":
                raise SourceError("the write stage can only be completed by finalize")
            if stage == "map" and status == "completed":
                _validate_chunk_files(resolved, manifest)
                leaves = _active_chunks(manifest)
                if any(chunk.get("status") != "completed" for chunk in leaves):
                    raise SourceError("map cannot complete until every active chunk has a validated artifact")
                if artifact:
                    raise SourceError("map completion does not take an artifact")
                if manifest["stages"].get("map") != "completed":
                    _invalidate_after(manifest, "map")
                manifest["stages"]["map"] = "completed"
            elif stage == "map":
                if artifact:
                    raise SourceError("map status does not take an artifact")
                _invalidate_from(manifest, "map")
                manifest["stages"]["map"] = status
            elif status == "completed" and stage in {"reduce", "verify"}:
                _validate_chunk_files(resolved, manifest)
                prerequisite = "map" if stage == "reduce" else "reduce"
                if manifest["stages"].get(prerequisite) != "completed":
                    raise SourceError(f"{stage} requires completed {prerequisite}")
                if not artifact:
                    raise SourceError(f"completed {stage} requires --artifact")
                stage_artifact = _safe_stage_artifact(resolved, manifest, stage, artifact)
                previous = manifest.get("stage_artifacts", {}).get(stage)
                if manifest["stages"].get(stage) != "completed" or previous != stage_artifact:
                    _invalidate_from(manifest, stage)
                    manifest.setdefault("stage_artifacts", {})[stage] = stage_artifact
                    manifest["stages"][stage] = "completed"
            else:
                if artifact:
                    raise SourceError("--artifact is only valid when completing reduce or verify")
                _invalidate_from(manifest, stage)
                manifest["stages"][stage] = status
            result = {
                "stage": stage,
                "status": status,
                "artifact": manifest.get("stage_artifacts", {}).get(stage),
            }
        _atomic_json(manifest_path, manifest)
        return result


def bisect_chunk(run_dir: Path, chunk_id: str) -> dict[str, Any]:
    resolved = run_dir.expanduser().resolve(strict=True)
    with _run_lock(resolved):
        manifest_path, manifest = _load_manifest(resolved)
        _require_mutable(manifest)
        parent = next((chunk for chunk in manifest["chunks"] if chunk.get("id") == chunk_id), None)
        if parent is None:
            raise SourceError(f"unknown chunk id: {chunk_id}")
        _validate_chunk_file(resolved, manifest, parent)
        if parent.get("status") in {"split", "completed"}:
            raise SourceError(f"chunk cannot be split from status {parent.get('status')}: {chunk_id}")
        chunk_path = manifest_path.parent / str(parent["file"])
        records: list[dict[str, Any]] = []
        for number, line in enumerate(chunk_path.read_text(encoding="utf-8").splitlines(), 1):
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise SourceError(f"invalid prepared chunk line {number}: {error.msg}") from error
            if not isinstance(value, dict):
                raise SourceError(f"invalid prepared chunk record at line {number}")
            records.append(value)
        if not records:
            raise SourceError("cannot split an empty chunk")
        target = max(MIN_CHUNK_BYTES, int(parent["bytes"]) // 2)
        if int(parent["bytes"]) <= MIN_CHUNK_BYTES:
            raise SourceError("chunk is already at the minimum byte budget")
        child_prefix = f"chunk-{chunk_id.replace('.', '-')}-"
        referenced_files = {Path(str(chunk["file"])).name for chunk in manifest["chunks"]}
        for orphan in (manifest_path.parent / "chunks").glob(f"{child_prefix}*.jsonl"):
            if orphan.name not in referenced_files:
                orphan.unlink()
        children = _chunk_events(records, manifest_path.parent / "chunks", target, id_prefix=f"{chunk_id}.")
        if len(children) < 2:
            for child in children:
                (manifest_path.parent / str(child["file"])).unlink()
            target = max(MIN_CHUNK_BYTES, target // 2)
            children = _chunk_events(records, manifest_path.parent / "chunks", target, id_prefix=f"{chunk_id}.")
        if len(children) < 2:
            raise SourceError("chunk could not be divided further")
        _invalidate_from(manifest, "map")
        parent["status"] = "split"
        parent["children"] = [child["id"] for child in children]
        insert_at = manifest["chunks"].index(parent) + 1
        manifest["chunks"][insert_at:insert_at] = children
        _refresh_estimate(manifest, preserve_confirmation=True)
        _atomic_json(manifest_path, manifest)
        return {
            "parent": chunk_id,
            "target_bytes": target,
            "children": [child["id"] for child in children],
            "confirmation": manifest["confirmation"]["status"],
        }


def claim(run_dir: Path, limit: int) -> dict[str, Any]:
    if not 1 <= limit <= 4:
        raise SourceError("claim limit must be between 1 and 4")
    resolved = run_dir.expanduser().resolve(strict=True)
    with _run_lock(resolved):
        manifest_path, manifest = _load_manifest(resolved)
        _require_mutable(manifest)
        _require_confirmation(manifest)
        claimed: list[dict[str, Any]] = []
        exhausted: list[str] = []
        running_count = sum(
            1 for chunk in _active_chunks(manifest) if chunk.get("status") == "running"
        )
        available = max(0, int(manifest["budget"]["max_worker_concurrency"]) - running_count)
        claim_limit = min(limit, available)
        for chunk in _active_chunks(manifest):
            if len(claimed) == claim_limit:
                break
            if chunk.get("status") != "pending":
                continue
            _validate_chunk_file(resolved, manifest, chunk)
            attempts = int(chunk.get("attempts", 0))
            if attempts >= 4:
                chunk["status"] = "failed"
                exhausted.append(str(chunk["id"]))
                continue
            chunk["attempts"] = attempts + 1
            chunk["status"] = "running"
            claimed.append(
                {
                    "id": chunk["id"],
                    "file": chunk["file"],
                    "bytes": chunk["bytes"],
                    "source_ordinals": chunk["source_ordinals"],
                    "attempt": chunk["attempts"],
                }
            )
        if claimed or exhausted:
            _invalidate_from(manifest, "map")
            for item in claimed:
                chunk = next(value for value in manifest["chunks"] if value["id"] == item["id"])
                chunk["status"] = "running"
            for chunk_id in exhausted:
                chunk = next(value for value in manifest["chunks"] if value["id"] == chunk_id)
                chunk["status"] = "failed"
            _atomic_json(manifest_path, manifest)
        return {"claimed": claimed, "exhausted": exhausted, "remaining_pending": sum(
            1 for chunk in _active_chunks(manifest) if chunk.get("status") == "pending"
        )}


def requeue_running(run_dir: Path) -> dict[str, Any]:
    resolved = run_dir.expanduser().resolve(strict=True)
    with _run_lock(resolved):
        manifest_path, manifest = _load_manifest(resolved)
        _require_mutable(manifest)
        running = [chunk for chunk in _active_chunks(manifest) if chunk.get("status") == "running"]
        if running:
            _invalidate_from(manifest, "map")
            for chunk in running:
                chunk["status"] = "pending"
            _atomic_json(manifest_path, manifest)
        return {"requeued": len(running), "remaining_pending": sum(
            1 for chunk in _active_chunks(manifest) if chunk.get("status") == "pending"
        )}


def status(run_dir: Path) -> dict[str, Any]:
    resolved = run_dir.expanduser().resolve(strict=True)
    with _run_lock(resolved):
        _manifest_path, manifest = _load_manifest(resolved)
        counts = Counter(str(chunk.get("status", "unknown")) for chunk in _active_chunks(manifest))
        return {
            "source_sha256": manifest["source"]["sha256"],
            "active_chunks": dict(sorted(counts.items())),
            "coverage_commitment": _coverage_commitment(manifest),
            "split_parent_count": sum(1 for chunk in manifest["chunks"] if chunk.get("status") == "split"),
            "stages": manifest["stages"],
            "confirmation": manifest["confirmation"]["status"],
            "estimated_input_tokens": manifest["budget"]["estimated_input_tokens"],
        }


def confirm(run_dir: Path) -> dict[str, Any]:
    resolved = run_dir.expanduser().resolve(strict=True)
    with _run_lock(resolved):
        manifest_path, manifest = _load_manifest(resolved)
        _require_mutable(manifest)
        if not manifest["budget"]["requires_confirmation"]:
            manifest["confirmation"] = {"status": "not_required", "confirmed_estimate": None}
        else:
            manifest["confirmation"] = {
                "status": "confirmed",
                "confirmed_estimate": manifest["budget"]["estimated_input_tokens"],
            }
        _atomic_json(manifest_path, manifest)
        return {
            "confirmation": manifest["confirmation"]["status"],
            "estimated_input_tokens": manifest["budget"]["estimated_input_tokens"],
            "active_chunk_count": manifest["budget"]["active_chunk_count"],
        }


def _validate_stage_artifacts(run_dir: Path, manifest: dict[str, Any]) -> None:
    for stage in ("reduce", "verify"):
        if manifest["stages"].get(stage) != "completed":
            continue
        stored = manifest.get("stage_artifacts", {}).get(stage)
        if not isinstance(stored, dict):
            raise SourceError(f"completed {stage} stage has no validated artifact")
        checked = _safe_stage_artifact(run_dir, manifest, stage, str(stored.get("path", "")))
        if checked != stored:
            raise SourceError(f"{stage} artifact failed integrity validation")


ARTICLE_HEADINGS = (
    "## 结果摘要",
    "## 背景与约束",
    "## 问题表现",
    "## 诊断",
    "## 关键失败",
    "## 根因",
    "## 解决方案",
    "## 验证证据",
    "## 可迁移的方法",
    "## 行动清单",
)
ARTICLE_HEADINGS_ENGLISH = (
    "## Outcome Summary",
    "## Background and Constraints",
    "## Problem Symptoms",
    "## Diagnosis",
    "## Key Failures",
    "## Root Cause",
    "## Solution",
    "## Verification Evidence",
    "## Transferable Methods",
    "## Action Checklist",
)


def _validate_article_body(body: bytes) -> str:
    try:
        text = body.decode("utf-8")
    except UnicodeDecodeError as error:
        raise SourceError("article must be UTF-8 Markdown") from error
    findings = Redactor.scan(text)
    if findings:
        categories = ", ".join(sorted(findings))
        raise SourceError(f"privacy scan failed; resolve these categories: {categories}")
    lines = text.splitlines()
    if not lines or not lines[0].startswith("# ") or lines[0].startswith("## "):
        raise SourceError("article must start with one level-one title")
    heading_indexes = [index for index, line in enumerate(lines) if line.startswith("## ")]
    if len(heading_indexes) != len(ARTICLE_HEADINGS):
        raise SourceError("article must contain exactly ten level-two sections")
    headings = tuple(lines[index].strip() for index in heading_indexes)
    if headings not in {ARTICLE_HEADINGS, ARTICLE_HEADINGS_ENGLISH}:
        raise SourceError("article sections must use the required semantic headings and order")
    for position, start in enumerate(heading_indexes):
        end = heading_indexes[position + 1] if position + 1 < len(heading_indexes) else len(lines)
        if not any(line.strip() and not line.startswith("#") for line in lines[start + 1 : end]):
            raise SourceError("every article section must contain content")
    return text


def _validated_final_output(path: Path, metadata: dict[str, Any]) -> bytes:
    if not path.is_file():
        raise SourceError("final article is missing")
    body = path.read_bytes()
    if len(body) != metadata.get("bytes") or hashlib.sha256(body).hexdigest() != metadata.get("sha256"):
        raise SourceError("final article failed integrity validation")
    _validate_article_body(body)
    return body


def finalize(run_dir: Path, article: Path, output: Path) -> dict[str, Any]:
    resolved = run_dir.expanduser().resolve(strict=True)
    knowledge_dir = resolved.parent.parent.resolve()
    article_path = article.expanduser().resolve()
    output_path = output.expanduser().resolve()
    if article_path.parent != knowledge_dir or output_path.parent != knowledge_dir:
        raise SourceError("article and output must stay directly inside session-knowledge")
    if not re.fullmatch(
        r"\.session-to-knowledge-[a-z0-9]+(?:-[a-z0-9]+)*\.draft\.md",
        article_path.name,
    ):
        raise SourceError("temporary article must use .session-to-knowledge-*.draft.md")
    if not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}-\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*(?:-\d+)?\.md",
        output_path.name,
    ):
        raise SourceError("final output must use YYYY-MM-DD-HHmm-<ascii-slug>.md")
    filename_findings = Redactor.scan(output_path.name)
    if filename_findings:
        categories = ", ".join(sorted(filename_findings))
        raise SourceError(f"final filename privacy scan failed: {categories}")
    with _run_lock(resolved):
        manifest_path, manifest = _load_manifest(resolved)
        _validate_chunk_files(resolved, manifest)
        _validate_stage_artifacts(resolved, manifest)
        _require_confirmation(manifest)
        if any(chunk.get("status") != "completed" for chunk in _active_chunks(manifest)):
            raise SourceError("cannot finalize while any active chunk is incomplete")
        for stage in ("map", "reduce", "verify"):
            if manifest["stages"].get(stage) != "completed":
                raise SourceError(f"cannot finalize before {stage} is completed")
        relative_output = str(output_path.relative_to(knowledge_dir))
        write_status = manifest["stages"].get("write")
        final_artifact = manifest.get("final_artifact")
        if write_status in {"finalizing", "completed"}:
            if not isinstance(final_artifact, dict) or final_artifact.get("path") != relative_output:
                raise SourceError("finalize recovery must use the original output path")
            if final_artifact.get("source_article") != article_path.name:
                raise SourceError("finalize recovery must use the original temporary article")
            if output_path.exists():
                article_body = _validated_final_output(output_path, final_artifact)
                if article_path.is_file():
                    temporary_body = article_path.read_bytes()
                    if (
                        len(temporary_body) != final_artifact.get("bytes")
                        or hashlib.sha256(temporary_body).hexdigest() != final_artifact.get("sha256")
                    ):
                        raise SourceError("finalize recovery received a different temporary article")
                manifest["stages"]["write"] = "completed"
                _atomic_json(manifest_path, manifest)
                if article_path.is_file() and article_path != output_path:
                    article_path.unlink()
                return {
                    "output": str(output_path),
                    "bytes": len(article_body),
                    "sha256": final_artifact["sha256"],
                    "recovered": write_status == "finalizing",
                }
            if write_status == "completed":
                raise SourceError("completed run is missing its final article")
        elif output_path.exists():
            raise SourceError("final output already exists; choose an unused filename")

        if not article_path.is_file():
            raise SourceError("temporary article is missing")
        article_body = article_path.read_bytes()
        _validate_article_body(article_body)
        article_hash = hashlib.sha256(article_body).hexdigest()
        proposed = {
            "path": relative_output,
            "source_article": article_path.name,
            "bytes": len(article_body),
            "sha256": article_hash,
        }
        if write_status == "finalizing" and final_artifact != proposed:
            raise SourceError("temporary article changed after finalization began")
        manifest["stages"]["write"] = "finalizing"
        manifest["final_artifact"] = proposed
        _atomic_json(manifest_path, manifest)

        descriptor, publish_name = tempfile.mkstemp(
            prefix=f".{output_path.name}.", suffix=".publishing", dir=knowledge_dir
        )
        publish_temp = Path(publish_name)
        try:
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(article_body)
                handle.flush()
                os.fsync(handle.fileno())
            os.chmod(publish_temp, 0o600)
            try:
                os.link(publish_temp, output_path)
            except FileExistsError as error:
                manifest["stages"]["write"] = "pending"
                manifest.pop("final_artifact", None)
                _atomic_json(manifest_path, manifest)
                raise SourceError("final output appeared during publication; it was not overwritten") from error
            except OSError:
                manifest["stages"]["write"] = "pending"
                manifest.pop("final_artifact", None)
                _atomic_json(manifest_path, manifest)
                raise
        finally:
            publish_temp.unlink(missing_ok=True)
        _validated_final_output(output_path, proposed)
        manifest["stages"]["write"] = "completed"
        _atomic_json(manifest_path, manifest)
        article_path.unlink()
        return {"output": str(output_path), "bytes": len(article_body), "sha256": article_hash, "recovered": False}


def clean(run_dir: Path) -> None:
    resolved = run_dir.expanduser().resolve(strict=True)
    with _run_lock(resolved):
        manifest_path, manifest = _load_manifest(resolved, allow_cleaning=True)
        if manifest["stages"].get("write") != "completed":
            raise SourceError("refusing to clean a run before finalization")
        final_artifact = manifest.get("final_artifact")
        if not isinstance(final_artifact, dict):
            raise SourceError("completed run has no final artifact metadata")
        knowledge_dir = resolved.parent.parent.resolve()
        final_path = (knowledge_dir / str(final_artifact.get("path", ""))).resolve()
        try:
            final_path.relative_to(knowledge_dir)
        except ValueError as error:
            raise SourceError("final artifact escapes session-knowledge") from error
        if final_path.parent != knowledge_dir:
            raise SourceError("final article must stay directly inside session-knowledge")
        _validated_final_output(final_path, final_artifact)
        if resolved.parent.name != ".work":
            raise SourceError("refusing to remove a run directory outside .work")
        manifest["cleaning"] = True
        _atomic_json(manifest_path, manifest)
    shutil.rmtree(resolved)


def _path_argument(value: str) -> Path:
    return Path(value).expanduser()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    locate_parser = subparsers.add_parser("locate", help="Locate and verify a persisted Codex task")
    locate_parser.add_argument("session_id")
    locate_parser.add_argument("--codex-home", type=_path_argument)

    prepare_parser = subparsers.add_parser("prepare", help="Normalize, redact, and chunk a transcript")
    prepare_parser.add_argument("source", help="Codex task UUID or transcript path")
    prepare_parser.add_argument("--work-root", type=_path_argument, required=True)
    prepare_parser.add_argument("--codex-home", type=_path_argument)
    prepare_parser.add_argument("--max-bytes", type=int)

    mark_parser = subparsers.add_parser("mark", help="Update resumable run state")
    mark_parser.add_argument("run_dir", type=_path_argument)
    mark_parser.add_argument("--chunk")
    mark_parser.add_argument("--stage")
    mark_parser.add_argument("--status", required=True, choices=("pending", "running", "completed", "failed"))
    mark_parser.add_argument("--artifact")

    bisect_parser = subparsers.add_parser("bisect", help="Halve a chunk after a 413 response")
    bisect_parser.add_argument("run_dir", type=_path_argument)
    bisect_parser.add_argument("chunk_id")

    claim_parser = subparsers.add_parser("claim", help="Claim up to four pending map chunks")
    claim_parser.add_argument("run_dir", type=_path_argument)
    claim_parser.add_argument("--limit", type=int, default=4)

    requeue_parser = subparsers.add_parser(
        "requeue", help="Return stranded running map chunks to pending"
    )
    requeue_parser.add_argument("run_dir", type=_path_argument)

    status_parser = subparsers.add_parser("status", help="Summarize a resumable run")
    status_parser.add_argument("run_dir", type=_path_argument)

    confirm_parser = subparsers.add_parser("confirm", help="Confirm the displayed cost estimate")
    confirm_parser.add_argument("run_dir", type=_path_argument)

    scan_parser = subparsers.add_parser("scan", help="Fail if a generated article contains high-risk text")
    scan_parser.add_argument("path", type=_path_argument)

    finalize_parser = subparsers.add_parser("finalize", help="Validate and publish a completed article")
    finalize_parser.add_argument("run_dir", type=_path_argument)
    finalize_parser.add_argument("--article", type=_path_argument, required=True)
    finalize_parser.add_argument("--output", type=_path_argument, required=True)

    clean_parser = subparsers.add_parser("clean", help="Remove a completed run's private work state")
    clean_parser.add_argument("run_dir", type=_path_argument)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "locate":
            path = locate_codex_session(args.session_id, args.codex_home)
            info = resolve_source(str(path), args.codex_home)
            result = {
                "session_id": info.session_id,
                "path": str(path),
                "cwd": info.cwd,
                "context_tokens": info.context_tokens,
                "archived": info.archived,
                "size_bytes": info.snapshot_size,
            }
        elif args.command == "prepare":
            result = prepare(args.source, args.work_root, args.codex_home, args.max_bytes)
        elif args.command == "mark":
            result = mark(args.run_dir, args.chunk, args.stage, args.status, args.artifact)
        elif args.command == "bisect":
            result = bisect_chunk(args.run_dir, args.chunk_id)
        elif args.command == "claim":
            result = claim(args.run_dir, args.limit)
        elif args.command == "requeue":
            result = requeue_running(args.run_dir)
        elif args.command == "status":
            result = status(args.run_dir)
        elif args.command == "confirm":
            result = confirm(args.run_dir)
        elif args.command == "scan":
            path = args.path.expanduser().resolve(strict=True)
            findings = Redactor.scan(path.read_text(encoding="utf-8"))
            result = {"path": str(path), "safe": not findings, "finding_counts": findings}
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if not findings else 3
        elif args.command == "finalize":
            result = finalize(args.run_dir, args.article, args.output)
        elif args.command == "clean":
            clean(args.run_dir)
            result = {"removed": str(args.run_dir)}
        else:
            parser.error("unknown command")
            return 2
    except (OSError, SourceError, ValueError, sqlite3.Error) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
