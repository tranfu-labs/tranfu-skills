#!/usr/bin/env python3
"""Strictly read-only client for Privy's public documentation MCP server."""

from __future__ import annotations

import argparse
import ipaddress
import json
import math
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


DEFAULT_ENDPOINT = "https://docs.privy.io/mcp"
SKILL_RESOURCE = "mintlify://skills/privy"
MAX_RESPONSE_BYTES = 4 * 1024 * 1024


class McpError(RuntimeError):
    pass


def validate_endpoint(value: str) -> str:
    parsed = urllib.parse.urlparse(value)
    if value == DEFAULT_ENDPOINT:
        return value
    try:
        is_loopback = ipaddress.ip_address(parsed.hostname or "").is_loopback
    except ValueError:
        is_loopback = parsed.hostname == "localhost"
    if parsed.scheme == "http" and is_loopback and parsed.port:
        return value
    raise argparse.ArgumentTypeError(
        "endpoint must be the official Privy URL or an explicit loopback HTTP URL for tests"
    )


def parse_sse(raw: str) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    data_lines: list[str] = []
    for line in raw.splitlines() + [""]:
        if line == "":
            if data_lines:
                try:
                    value = json.loads("\n".join(data_lines))
                except json.JSONDecodeError as exc:
                    raise McpError(f"invalid SSE JSON payload: {exc}") from exc
                if isinstance(value, dict):
                    messages.append(value)
                data_lines = []
            continue
        if line.startswith("data:"):
            data_lines.append(line[5:].lstrip())
    if not messages:
        raise McpError("SSE response contained no JSON data events")
    return messages


def decode_response(raw: bytes, content_type: str) -> list[dict[str, Any]]:
    text = raw.decode("utf-8")
    if "text/event-stream" in content_type or text.lstrip().startswith(("event:", "data:")):
        return parse_sse(text)
    try:
        value = json.loads(text)
    except json.JSONDecodeError as exc:
        raise McpError(f"response was neither valid SSE nor JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise McpError("JSON-RPC response must be an object")
    return [value]


def rpc(
    endpoint: str,
    method: str,
    params: dict[str, Any],
    request_id: int,
    timeout: float,
    verbose: bool,
) -> dict[str, Any]:
    payload = json.dumps(
        {"jsonrpc": "2.0", "id": request_id, "method": method, "params": params},
        separators=(",", ":"),
    ).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=payload,
        method="POST",
        headers={
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
            "User-Agent": "codex-privy-mcp-readonly/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
            content_type = response.headers.get("Content-Type", "")
            status = response.status
    except urllib.error.HTTPError as exc:
        detail = exc.read(2048).decode("utf-8", errors="replace")
        raise McpError(f"HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise McpError(f"transport error: {exc.reason}") from exc
    if len(raw) > MAX_RESPONSE_BYTES:
        raise McpError(f"response exceeded {MAX_RESPONSE_BYTES} bytes")
    if verbose:
        print(
            f"endpoint={endpoint} status={status} content_type={content_type} bytes={len(raw)}",
            file=sys.stderr,
        )
    for message in decode_response(raw, content_type):
        if message.get("id") != request_id:
            continue
        if "error" in message:
            error = message["error"]
            raise McpError(f"JSON-RPC error: {json.dumps(error, ensure_ascii=False)}")
        if "result" not in message:
            raise McpError("matching JSON-RPC response has no result")
        return message["result"]
    raise McpError(f"no JSON-RPC response matched request id {request_id}")


def build_call(command: str, value: str | None) -> tuple[str, dict[str, Any]]:
    if command == "server-info":
        return (
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "codex-privy-mcp-readonly", "version": "1.0.0"},
            },
        )
    if command == "list-tools":
        return "tools/list", {}
    if command == "list-resources":
        return "resources/list", {}
    if command == "read-skill":
        return "resources/read", {"uri": SKILL_RESOURCE}
    if command == "search":
        return "tools/call", {"name": "search_privy_docs", "arguments": {"query": value}}
    if command == "docs-query":
        return (
            "tools/call",
            {"name": "query_docs_filesystem_privy_docs", "arguments": {"command": value}},
        )
    raise McpError(f"unsupported command: {command}")


def nonempty_limited(value: str) -> str:
    value = value.strip()
    if not value:
        raise argparse.ArgumentTypeError("value must not be empty")
    if len(value) > 4000:
        raise argparse.ArgumentTypeError("value must not exceed 4000 characters")
    return value


def make_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint", type=validate_endpoint, default=DEFAULT_ENDPOINT)
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--verbose", action="store_true")
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("server-info", "list-tools", "list-resources", "read-skill"):
        subparsers.add_parser(command)
    search = subparsers.add_parser("search")
    search.add_argument("value", type=nonempty_limited)
    docs_query = subparsers.add_parser("docs-query")
    docs_query.add_argument("value", type=nonempty_limited)
    return parser


def main() -> int:
    args = make_parser().parse_args()
    if not math.isfinite(args.timeout) or args.timeout <= 0 or args.timeout > 120:
        print("error: timeout must be greater than 0 and at most 120 seconds", file=sys.stderr)
        return 2
    try:
        method, params = build_call(args.command, getattr(args, "value", None))
        result = rpc(args.endpoint, method, params, 1, args.timeout, args.verbose)
    except (McpError, UnicodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
