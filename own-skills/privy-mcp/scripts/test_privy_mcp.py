#!/usr/bin/env python3

from __future__ import annotations

import argparse
import contextlib
import importlib.util
import io
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("privy_mcp.py")
SPEC = importlib.util.spec_from_file_location("privy_mcp", MODULE_PATH)
assert SPEC and SPEC.loader
privy_mcp = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(privy_mcp)


class MockMcpHandler(BaseHTTPRequestHandler):
    response_mode = "sse"
    last_request: dict[str, object] | None = None

    def do_POST(self) -> None:
        length = int(self.headers["Content-Length"])
        request = json.loads(self.rfile.read(length))
        type(self).last_request = request
        if request["method"] == "fail/test":
            response = {
                "jsonrpc": "2.0",
                "id": request["id"],
                "error": {"code": -32000, "message": "expected failure"},
            }
        else:
            response = {
                "jsonrpc": "2.0",
                "id": request["id"],
                "result": {"method": request["method"], "params": request["params"]},
            }
        encoded = json.dumps(response).encode()
        self.send_response(200)
        if type(self).response_mode == "json":
            self.send_header("Content-Type", "application/json")
            body = encoded
        else:
            self.send_header("Content-Type", "text/event-stream")
            body = b"event: message\ndata: " + encoded + b"\n\n"
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        return


class PrivyMcpTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), MockMcpHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.endpoint = f"http://127.0.0.1:{cls.server.server_port}/mcp"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_parse_sse(self) -> None:
        messages = privy_mcp.parse_sse(
            'event: message\ndata: {"jsonrpc":"2.0",\ndata: "id":1,"result":{}}\n\n'
        )
        self.assertEqual(messages[0]["result"], {})

    def test_rpc_decodes_sse_and_sends_expected_request(self) -> None:
        MockMcpHandler.response_mode = "sse"
        result = privy_mcp.rpc(self.endpoint, "tools/list", {}, 9, 2, False)
        self.assertEqual(result, {"method": "tools/list", "params": {}})
        self.assertEqual(MockMcpHandler.last_request["jsonrpc"], "2.0")

    def test_rpc_decodes_plain_json(self) -> None:
        MockMcpHandler.response_mode = "json"
        result = privy_mcp.rpc(self.endpoint, "resources/list", {}, 2, 2, False)
        self.assertEqual(result["method"], "resources/list")

    def test_rpc_raises_for_json_rpc_error(self) -> None:
        with self.assertRaisesRegex(privy_mcp.McpError, "expected failure"):
            privy_mcp.rpc(self.endpoint, "fail/test", {}, 3, 2, False)

    def test_build_call_exposes_only_read_only_tools(self) -> None:
        search = privy_mcp.build_call("search", "wallet policies")
        docs = privy_mcp.build_call("docs-query", "head -20 /quickstart.mdx")
        self.assertEqual(search[1]["name"], "search_privy_docs")
        self.assertEqual(docs[1]["name"], "query_docs_filesystem_privy_docs")
        with self.assertRaises(privy_mcp.McpError):
            privy_mcp.build_call("submit-feedback", "anything")

    def test_endpoint_rejects_non_privy_remote_hosts(self) -> None:
        with self.assertRaises(argparse.ArgumentTypeError):
            privy_mcp.validate_endpoint("https://example.com/mcp")
        self.assertEqual(privy_mcp.validate_endpoint(self.endpoint), self.endpoint)

    def test_nonempty_limited_rejects_invalid_values(self) -> None:
        with self.assertRaises(argparse.ArgumentTypeError):
            privy_mcp.nonempty_limited("  ")
        with self.assertRaises(argparse.ArgumentTypeError):
            privy_mcp.nonempty_limited("x" * 4001)

    def test_parser_accepts_only_declared_commands(self) -> None:
        parser = privy_mcp.make_parser()
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                parser.parse_args(["submit-feedback"])


if __name__ == "__main__":
    unittest.main()
