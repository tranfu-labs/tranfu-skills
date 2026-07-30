#!/usr/bin/env python3
"""Publish finalized session knowledge to a configured Lark Wiki parent."""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import html
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence
from urllib.parse import urlparse

import session_source


MINIMUM_LARK_CLI_VERSION = (1, 0, 77)
CONFIG_SCHEMA = "session-to-knowledge-lark/v1"
PUBLICATIONS_SCHEMA = "session-to-knowledge-publications/v1"
CONFIG_FILE = "lark.json"
PUBLICATIONS_FILE = "lark-publications.json"
PUBLICATIONS_LOCK_FILE = ".lark-publications.lock"
NOTIFIER_ENV = {
    "LARKSUITE_CLI_NO_UPDATE_NOTIFIER": "1",
    "LARKSUITE_CLI_NO_SKILLS_NOTIFIER": "1",
}


class PublishError(RuntimeError):
    """Raised when Lark configuration or publishing cannot proceed safely."""


@dataclass(frozen=True)
class CommandResult:
    returncode: int
    stdout: str
    stderr: str


@dataclass(frozen=True)
class FetchedDocument:
    content: str
    revision_id: int | None


class SubprocessRunner:
    """Run lark-cli without shell interpretation."""

    def which(self, executable: str) -> str | None:
        return shutil.which(executable)

    def run(self, argv: Sequence[str], input_text: str | None = None) -> CommandResult:
        environment = os.environ.copy()
        environment.update(NOTIFIER_ENV)
        try:
            completed = subprocess.run(
                list(argv),
                input=input_text,
                text=True,
                capture_output=True,
                env=environment,
                check=False,
                timeout=60,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            raise PublishError("unable to run lark-cli") from error
        return CommandResult(completed.returncode, completed.stdout, completed.stderr)


class LarkCommandError(PublishError):
    def __init__(self, operation: str, result: CommandResult, payload: Any = None) -> None:
        super().__init__(f"lark-cli {operation} failed")
        self.operation = operation
        self.result = result
        self.payload = payload


class LarkClient:
    def __init__(self, runner: Any | None = None, executable: str = "lark-cli") -> None:
        self.runner = runner or SubprocessRunner()
        self.executable = executable

    def available(self) -> bool:
        return self.runner.which(self.executable) is not None

    def run(self, arguments: Sequence[str], input_text: str | None = None) -> CommandResult:
        return self.runner.run([self.executable, *arguments], input_text=input_text)

    def json(
        self,
        arguments: Sequence[str],
        *,
        input_text: str | None = None,
        operation: str,
    ) -> dict[str, Any]:
        result = self.run(arguments, input_text=input_text)
        payload = _parse_json_output(result)
        if result.returncode != 0 or not isinstance(payload, dict) or payload.get("ok") is False:
            raise LarkCommandError(operation, result, payload)
        return payload


def _parse_json_output(result: CommandResult) -> Any:
    for candidate in (result.stdout.strip(), result.stderr.strip()):
        if not candidate:
            continue
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return None


def _config_root(environ: Mapping[str, str] | None = None) -> Path:
    environment = environ or os.environ
    xdg = environment.get("XDG_CONFIG_HOME", "").strip()
    if xdg:
        base = Path(xdg).expanduser()
    else:
        home = environment.get("HOME", "").strip()
        base = (Path(home).expanduser() if home else Path.home()) / ".config"
    return base / "session-to-knowledge"


def _paths(environ: Mapping[str, str] | None = None) -> tuple[Path, Path, Path]:
    root = _config_root(environ)
    return root, root / CONFIG_FILE, root / PUBLICATIONS_FILE


def _reject_symlink(path: Path) -> None:
    if path.is_symlink():
        raise PublishError(f"refusing symbolic link: {path}")


def _ensure_config_root(root: Path) -> None:
    _reject_symlink(root)
    root.mkdir(parents=True, mode=0o700, exist_ok=True)
    _reject_symlink(root)
    if not root.is_dir():
        raise PublishError(f"configuration path is not a directory: {root}")
    os.chmod(root, 0o700)


def _read_json(path: Path) -> dict[str, Any] | None:
    _reject_symlink(path)
    if not path.exists():
        return None
    _reject_symlink(path.parent)
    parent_metadata = path.parent.stat()
    if not stat.S_ISDIR(parent_metadata.st_mode) or stat.S_IMODE(parent_metadata.st_mode) != 0o700:
        raise PublishError(f"configuration directory must have mode 0700: {path.parent}")
    metadata = path.stat()
    if not stat.S_ISREG(metadata.st_mode):
        raise PublishError(f"configuration path is not a regular file: {path}")
    if stat.S_IMODE(metadata.st_mode) != 0o600:
        raise PublishError(f"configuration file must have mode 0600: {path}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise PublishError(f"invalid JSON configuration: {path}") from error
    if not isinstance(value, dict):
        raise PublishError(f"configuration must be a JSON object: {path}")
    return value


def _atomic_json(path: Path, value: Mapping[str, Any]) -> None:
    root = path.parent
    _ensure_config_root(root)
    _reject_symlink(path)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=root)
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        _reject_symlink(path)
        os.replace(temporary, path)
        os.chmod(path, 0o600)
    finally:
        temporary.unlink(missing_ok=True)


@contextlib.contextmanager
def _publication_lock(root: Path):
    _ensure_config_root(root)
    lock_path = root / PUBLICATIONS_LOCK_FILE
    _reject_symlink(lock_path)
    flags = os.O_RDWR | os.O_CREAT
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(lock_path, flags, 0o600)
    with os.fdopen(descriptor, "r+b") as handle:
        os.chmod(lock_path, 0o600)
        if os.name == "nt":
            import msvcrt

            if lock_path.stat().st_size == 0:
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


def _load_config(path: Path) -> dict[str, str] | None:
    value = _read_json(path)
    if value is None:
        return None
    if value.get("schema") != CONFIG_SCHEMA:
        raise PublishError("unsupported Lark configuration schema")
    expected = {"schema", "identity", "parent_node_token", "space_id"}
    if set(value) != expected:
        raise PublishError("Lark configuration contains unsupported fields")
    identity = value.get("identity")
    parent = value.get("parent_node_token")
    space_id = value.get("space_id")
    if identity not in {"user", "bot"} or not all(
        isinstance(item, str) and item for item in (parent, space_id)
    ):
        raise PublishError("Lark configuration is incomplete")
    return {
        "schema": CONFIG_SCHEMA,
        "identity": identity,
        "parent_node_token": parent,
        "space_id": space_id,
    }


def _load_publications(path: Path) -> dict[str, Any]:
    value = _read_json(path)
    if value is None:
        return {"schema": PUBLICATIONS_SCHEMA, "publications": {}}
    if value.get("schema") != PUBLICATIONS_SCHEMA or not isinstance(value.get("publications"), dict):
        raise PublishError("invalid publication ledger")
    if set(value) != {"schema", "publications"}:
        raise PublishError("publication ledger contains unsupported fields")
    return value


def _version_tuple(output: str) -> tuple[int, int, int] | None:
    match = re.search(r"(?<!\d)(\d+)\.(\d+)\.(\d+)(?!\d)", output)
    if not match:
        return None
    return tuple(int(value) for value in match.groups())  # type: ignore[return-value]


def _probe_version(client: LarkClient) -> tuple[tuple[int, int, int], str]:
    if not client.available():
        raise PublishError("lark-cli was not found on PATH")
    result = client.run(["--version"])
    version = _version_tuple(f"{result.stdout}\n{result.stderr}")
    if result.returncode != 0 or version is None:
        raise PublishError("unable to determine lark-cli version")
    rendered = ".".join(str(part) for part in version)
    if version < MINIMUM_LARK_CLI_VERSION:
        minimum = ".".join(str(part) for part in MINIMUM_LARK_CLI_VERSION)
        raise PublishError(f"lark-cli {rendered} is unsupported; version {minimum} or newer is required")
    return version, rendered


def _auth_status(client: LarkClient) -> tuple[CommandResult, dict[str, Any] | None]:
    result = client.run(["auth", "status", "--json", "--verify"])
    payload = _parse_json_output(result)
    return result, payload if isinstance(payload, dict) else None


def _identity_ready(payload: Mapping[str, Any], identity: str) -> bool:
    identities = payload.get("identities")
    entry = identities.get(identity) if isinstance(identities, dict) else None
    if isinstance(entry, dict):
        status_value = str(entry.get("status", "")).casefold()
        token_status = str(entry.get("tokenStatus", entry.get("token_status", ""))).casefold()
        if status_value in {"error", "expired", "invalid", "missing", "not_configured", "unauthenticated"}:
            return False
        if token_status in {"error", "expired", "invalid", "missing"}:
            return False
        if entry.get("verified") is False:
            return False
        if entry.get("available") is False:
            return False
        if (
            status_value in {"active", "ready", "valid", "verified"}
            or token_status in {"active", "ready", "valid", "verified"}
            or entry.get("available") is True
            or entry.get("verified") is True
        ):
            return True
    return payload.get("identity") == identity and payload.get("verified") is True


def _ensure_ready(client: LarkClient, identity: str) -> str:
    _version, rendered = _probe_version(client)
    result, payload = _auth_status(client)
    if (
        result.returncode != 0
        or payload is None
        or payload.get("ok") is False
        or not _identity_ready(payload, identity)
    ):
        if identity == "user":
            raise PublishError(
                "Lark user authentication is not ready; run lark-cli auth login "
                "--domain docs --domain drive --domain wiki --no-wait --json"
            )
        raise PublishError(
            "Lark bot authentication is not ready; check the application credentials and Wiki/Docs scopes"
        )
    return rendered


def status(
    *,
    environ: Mapping[str, str] | None = None,
    runner: Any | None = None,
) -> dict[str, Any]:
    _root, config_path, _publications_path = _paths(environ)
    config = _load_config(config_path)
    client = LarkClient(runner)
    if not client.available():
        return {
            "ok": False,
            "cli": {"found": False, "compatible": False},
            "auth": {"ready": False},
            "configured": config is not None,
            "config": config,
        }
    result = client.run(["--version"])
    version = _version_tuple(f"{result.stdout}\n{result.stderr}")
    compatible = result.returncode == 0 and version is not None and version >= MINIMUM_LARK_CLI_VERSION
    auth_result, auth_payload = _auth_status(client) if compatible else (CommandResult(1, "", ""), None)
    identity = config["identity"] if config else None
    identity_status = {
        candidate: bool(auth_payload and _identity_ready(auth_payload, candidate))
        for candidate in ("user", "bot")
    }
    auth_ready = bool(
        auth_result.returncode == 0
        and auth_payload
        and auth_payload.get("ok") is not False
        and (identity_status.get(identity, False) if identity else any(identity_status.values()))
    )
    return {
        "ok": bool(compatible and auth_ready and config),
        "cli": {
            "found": True,
            "version": ".".join(str(part) for part in version) if version else None,
            "compatible": compatible,
        },
        "auth": {"ready": auth_ready, "identity": identity, "identities": identity_status},
        "configured": config is not None,
        "config": config,
    }


def _validate_parent_input(parent: str) -> str:
    value = parent.strip()
    if not value:
        raise PublishError("parent Wiki URL or token is required")
    if "://" in value:
        parsed = urlparse(value)
        segments = [segment for segment in parsed.path.split("/") if segment]
        if parsed.scheme not in {"http", "https"} or "wiki" not in segments:
            raise PublishError("parent must be an existing Wiki page, not a Drive Docx document")
        index = segments.index("wiki")
        if index + 1 >= len(segments) or not segments[index + 1]:
            raise PublishError("parent Wiki URL does not contain a node token")
        return value
    if not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise PublishError("parent must be a Wiki URL or raw node token")
    return value


def _node_mapping(payload: Mapping[str, Any]) -> Mapping[str, Any]:
    data = payload.get("data")
    if isinstance(data, dict):
        node = data.get("node")
        if isinstance(node, dict):
            return node
        return data
    node = payload.get("node")
    return node if isinstance(node, dict) else payload


def _required_string(mapping: Mapping[str, Any], *names: str) -> str:
    for name in names:
        value = mapping.get(name)
        if isinstance(value, str) and value:
            return value
    raise PublishError(f"lark-cli response is missing {names[0]}")


def _optional_string(mapping: Mapping[str, Any], *names: str) -> str | None:
    for name in names:
        value = mapping.get(name)
        if isinstance(value, str) and value:
            return value
    return None


def configure(
    identity: str,
    parent: str,
    *,
    replace: bool = False,
    environ: Mapping[str, str] | None = None,
    runner: Any | None = None,
) -> dict[str, Any]:
    if identity not in {"user", "bot"}:
        raise PublishError("identity must be user or bot")
    parent_input = _validate_parent_input(parent)
    root, config_path, _publications_path = _paths(environ)
    client = LarkClient(runner)
    version = _ensure_ready(client, identity)
    payload = client.json(
        [
            "wiki",
            "+node-get",
            "--node-token",
            parent_input,
            "--as",
            identity,
            "--format",
            "json",
        ],
        operation="Wiki parent validation",
    )
    node = _node_mapping(payload)
    obj_type = _required_string(node, "obj_type", "objType").casefold()
    if obj_type != "docx":
        raise PublishError("parent Wiki node must contain a Docx document")
    node_token = _required_string(node, "node_token", "nodeToken")
    space_id = _required_string(node, "space_id", "spaceId", "resolved_space_id")
    if identity == "bot":
        space_type = str(node.get("space_type", node.get("spaceType", ""))).casefold()
        if space_id == "my_library" or space_type in {"my_library", "personal", "person"}:
            raise PublishError("bot identity cannot publish to a personal Wiki library")
    value = {
        "schema": CONFIG_SCHEMA,
        "identity": identity,
        "parent_node_token": node_token,
        "space_id": space_id,
    }
    with _publication_lock(root):
        existing = _load_config(config_path)
        if existing and existing != value and not replace:
            raise PublishError("Lark root is already configured; pass --replace to change it")
        if existing != value:
            _atomic_json(config_path, value)
    return {"configured": True, "unchanged": existing == value, "version": version, **value}


def _read_final_markdown(path: Path) -> tuple[bytes, str, str]:
    try:
        resolved = path.expanduser().resolve(strict=True)
    except OSError as error:
        raise PublishError(f"final Markdown file does not exist: {path}") from error
    if not resolved.is_file() or resolved.suffix.casefold() != ".md":
        raise PublishError("publish requires a local .md file")
    if resolved.parent.name != "session-knowledge" or not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}-\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*(?:-\d+)?\.md",
        resolved.name,
    ):
        raise PublishError("publish requires a finalized session-knowledge Markdown file")
    raw = resolved.read_bytes()
    try:
        text = session_source._validate_article_body(raw)
    except session_source.SourceError as error:
        raise PublishError(f"final Markdown failed the local publication gate: {error}") from error
    match = re.match(
        r"\A\ufeff?(?:[ \t]*(?:\r?\n))*[ \t]*#(?!#)[ \t]+(.+?)[ \t]*(?:#+[ \t]*)?(?:\r?\n|\Z)",
        text,
    )
    if not match:
        raise PublishError("final Markdown must begin with a level-one heading")
    title = match.group(1).strip()
    body = text[match.end() :].lstrip("\r\n")
    if not title or not body.strip():
        raise PublishError("final Markdown must contain a title and body")
    return raw, title, body


def _publication_key(identity: str, parent_node_token: str, raw: bytes) -> str:
    digest = hashlib.sha256()
    digest.update(identity.encode("utf-8"))
    digest.update(parent_node_token.encode("utf-8"))
    digest.update(raw)
    return digest.hexdigest()


def _publication_url(node: Mapping[str, Any], node_token: str) -> str:
    for name in ("url", "node_url", "wiki_url"):
        value = node.get(name)
        if isinstance(value, str) and value:
            return value
    return f"https://www.feishu.cn/wiki/{node_token}"


def _fetch_markdown(client: LarkClient, identity: str, obj_token: str) -> FetchedDocument:
    payload = client.json(
        [
            "docs",
            "+fetch",
            "--doc",
            obj_token,
            "--doc-format",
            "markdown",
            "--detail",
            "simple",
            "--as",
            identity,
            "--format",
            "json",
        ],
        operation="document fetch",
    )
    data = payload.get("data")
    document = data.get("document") if isinstance(data, dict) else None
    content = document.get("content") if isinstance(document, dict) else payload.get("content")
    if not isinstance(content, str):
        raise PublishError("lark-cli document fetch response is missing Markdown content")
    revision_id = document.get("revision_id") if isinstance(document, dict) else None
    if isinstance(revision_id, bool) or not isinstance(revision_id, int):
        revision_id = None
    return FetchedDocument(content, revision_id)


def _normalized_title(title: str) -> str:
    return " ".join(html.unescape(title).split())


def _without_document_title(markdown: str, expected_title: str) -> str:
    normalized = markdown.replace("\r\n", "\n").lstrip("\ufeff\n")
    xml_title = re.match(r"\A<title>(.*?)</title>[ \t]*(?:\n|\Z)", normalized)
    if xml_title:
        if _normalized_title(xml_title.group(1)) != _normalized_title(expected_title):
            return normalized.strip()
        normalized = normalized[xml_title.end() :]
    else:
        heading = re.match(
            r"\A#(?!#)[ \t]+(.+?)[ \t]*(?:#+[ \t]*)?(?:\n|\Z)",
            normalized,
        )
        if heading:
            if _normalized_title(heading.group(1)) != _normalized_title(expected_title):
                return normalized.strip()
            normalized = normalized[heading.end() :]
    return normalized.strip()


def _remote_matches(expected: str, remote: str, expected_title: str) -> bool:
    if session_source.SafetyScanner.scan(remote):
        return False
    expected_body = _without_document_title(expected, expected_title)
    remote_body = _without_document_title(remote, expected_title)
    return remote_body == expected_body


def _remote_is_empty(remote: str, expected_title: str) -> bool:
    return not _without_document_title(remote, expected_title)


def _save_publications(path: Path, ledger: Mapping[str, Any]) -> None:
    _atomic_json(path, ledger)


def _completed_result(key: str, record: Mapping[str, Any], *, resumed: bool) -> dict[str, Any]:
    return {
        "published": True,
        "resumed": resumed,
        "publication_id": key,
        "node_token": record.get("node_token"),
        "url": record.get("url"),
    }


def _creation_outcome_is_unknown(error: LarkCommandError) -> bool:
    if not isinstance(error.payload, dict):
        return True
    rendered = json.dumps(error.payload, ensure_ascii=False).casefold()
    ambiguous_terms = (
        "timeout",
        "timed out",
        "deadline",
        "network",
        "connection",
        "transport",
        "eof",
        "unavailable",
        "internal server",
        "gateway",
        "超时",
        "网络",
        "连接",
        "服务不可用",
    )
    return any(term in rendered for term in ambiguous_terms) or bool(
        re.search(r"(?<!\d)(?:500|502|503|504)(?!\d)", rendered)
    )


def publish(
    final_markdown: Path | str,
    *,
    environ: Mapping[str, str] | None = None,
    runner: Any | None = None,
    sleeper: Any = time.sleep,
) -> dict[str, Any]:
    raw, title, body = _read_final_markdown(Path(final_markdown))
    root, config_path, publications_path = _paths(environ)
    if _load_config(config_path) is None:
        raise PublishError("Lark is not configured; run lark_publish.py configure first")
    with _publication_lock(root):
        config = _load_config(config_path)
        if config is None:
            raise PublishError("Lark configuration changed while publishing; retry")
        identity = config["identity"]
        parent_node_token = config["parent_node_token"]
        ledger = _load_publications(publications_path)
        publications = ledger["publications"]
        key = _publication_key(identity, parent_node_token, raw)
        record = publications.get(key)
        if record is not None and not isinstance(record, dict):
            raise PublishError("invalid publication ledger entry")
        if record and record.get("status") == "completed":
            return _completed_result(key, record, resumed=True)
        if record and record.get("status") in {"creating", "unknown"}:
            raise PublishError(
                "the previous node creation outcome is unknown; inspect the Wiki before changing the ledger"
            )

        client = LarkClient(runner)
        _ensure_ready(client, identity)
        resumed = False
        revision_id: int | None = None

        node_token: str
        if record and record.get("status") == "created":
            resumed = True
            node_token = _required_string(record, "node_token")
            obj_token = _optional_string(record, "obj_token")
            if obj_token is None:
                recovered_payload = client.json(
                    [
                        "wiki",
                        "+node-get",
                        "--node-token",
                        node_token,
                        "--as",
                        identity,
                        "--format",
                        "json",
                    ],
                    operation="Wiki child recovery",
                )
                recovered_node = _node_mapping(recovered_payload)
                if _required_string(recovered_node, "node_token", "nodeToken") != node_token:
                    raise PublishError("Wiki child recovery returned a different node token")
                if _required_string(recovered_node, "obj_type", "objType").casefold() != "docx":
                    raise PublishError("the recorded Wiki child is not a Docx document")
                obj_token = _required_string(recovered_node, "obj_token", "objToken")
                record["obj_token"] = obj_token
                _save_publications(publications_path, ledger)
            fetched = _fetch_markdown(client, identity, obj_token)
            if _remote_matches(body, fetched.content, title):
                record["status"] = "completed"
                _save_publications(publications_path, ledger)
                return _completed_result(key, record, resumed=True)
            if not _remote_is_empty(fetched.content, title):
                raise PublishError("the existing Lark page contains different content; refusing to overwrite it")
            if fetched.revision_id is None:
                raise PublishError("Lark recovery fetch omitted revision_id; refusing an unconditional overwrite")
            revision_id = fetched.revision_id
        elif record:
            raise PublishError("invalid publication state")
        else:
            record = {"status": "creating"}
            publications[key] = record
            _save_publications(publications_path, ledger)
            try:
                payload = client.json(
                    [
                        "wiki",
                        "+node-create",
                        "--space-id",
                        config["space_id"],
                        "--parent-node-token",
                        parent_node_token,
                        "--obj-type",
                        "docx",
                        "--title",
                        title,
                        "--as",
                        identity,
                        "--format",
                        "json",
                    ],
                    operation="Wiki node creation",
                )
                node = _node_mapping(payload)
                node_token = _required_string(node, "node_token", "nodeToken")
                record.clear()
                record.update(
                    {
                        "status": "created",
                        "node_token": node_token,
                        "url": _publication_url(node, node_token),
                    }
                )
                _save_publications(publications_path, ledger)
                if _required_string(node, "obj_type", "objType").casefold() != "docx":
                    raise PublishError("created Wiki node is not a Docx document")
                obj_token = _required_string(node, "obj_token", "objToken")
                record["obj_token"] = obj_token
                _save_publications(publications_path, ledger)
            except LarkCommandError as error:
                if not _creation_outcome_is_unknown(error):
                    publications.pop(key, None)
                    _save_publications(publications_path, ledger)
                    raise PublishError(
                        "Wiki node creation was rejected; fix authentication, scopes, or parent permissions and retry"
                    ) from error
                record.clear()
                record["status"] = "unknown"
                _save_publications(publications_path, ledger)
                raise PublishError(
                    "Wiki node creation did not return a recoverable node token; refusing to retry automatically"
                ) from error
            except PublishError as error:
                if record.get("status") == "created":
                    raise PublishError(
                        "Wiki node was created and recorded; publishing can resume only on that node"
                    ) from error
                record.clear()
                record["status"] = "unknown"
                _save_publications(publications_path, ledger)
                raise PublishError(
                    "Wiki node creation did not return a recoverable node token; refusing to retry automatically"
                ) from error

        update_arguments = [
            "docs",
            "+update",
            "--doc",
            obj_token,
            "--command",
            "overwrite",
            "--doc-format",
            "markdown",
            "--content",
            "-",
        ]
        if revision_id is not None:
            update_arguments.extend(("--revision-id", str(revision_id)))
        update_arguments.extend(("--as", identity, "--format", "json"))
        try:
            client.json(
                update_arguments,
                input_text=body,
                operation="document update",
            )
        except (LarkCommandError, PublishError) as error:
            raise PublishError(
                "Lark write failed; the local Markdown is intact and publishing can resume on the same node"
            ) from error

        remote: str | None = None
        for attempt in range(2):
            if attempt:
                sleeper(1.0)
            try:
                remote = _fetch_markdown(client, identity, obj_token).content
            except PublishError:
                remote = None
            if remote is not None and _remote_matches(body, remote, title):
                record["status"] = "completed"
                _save_publications(publications_path, ledger)
                return _completed_result(key, record, resumed=resumed)
        if remote is not None and not _remote_is_empty(remote, title):
            raise PublishError("Lark verification found different content; refusing another overwrite")
        raise PublishError(
            "Lark write could not be verified; the local Markdown is intact and publishing can resume on the same node"
        )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("status", help="check lark-cli, authentication, and configuration")
    configure_parser = subparsers.add_parser("configure", help="bind an existing Wiki Docx parent")
    configure_parser.add_argument("--identity", choices=("user", "bot"), required=True)
    configure_parser.add_argument("--parent", required=True, help="existing Wiki URL or node token")
    configure_parser.add_argument("--replace", action="store_true")
    publish_parser = subparsers.add_parser("publish", help="publish finalized Markdown")
    publish_parser.add_argument("final_markdown", type=Path)
    return parser


def main(
    argv: Sequence[str] | None = None,
    *,
    environ: Mapping[str, str] | None = None,
    runner: Any | None = None,
) -> int:
    arguments = _parser().parse_args(argv)
    try:
        if arguments.command == "status":
            result = status(environ=environ, runner=runner)
        elif arguments.command == "configure":
            result = configure(
                arguments.identity,
                arguments.parent,
                replace=arguments.replace,
                environ=environ,
                runner=runner,
            )
        else:
            result = publish(arguments.final_markdown, environ=environ, runner=runner)
    except PublishError as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1
    print(json.dumps({"ok": True, **result}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
