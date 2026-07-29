# Privy documentation MCP protocol

Use this reference only for transport diagnostics or raw-client maintenance. The normal workflow belongs in `SKILL.md`.

## Contract verified on 2026-07-29

- Endpoint: `https://docs.privy.io/mcp`
- Transport: Streamable HTTP; POST responses currently use Server-Sent Events.
- Anonymous access: supported for the public documentation surface.
- Negotiated protocol: `2025-03-26`.
- Server identity: `Privy Docs` version `1.0.0`.
- Resource guidance: `mintlify://skills/privy`.

The live server can change. Discover capabilities for every task instead of treating this snapshot as permanent.

## Allowed JSON-RPC methods

The bundled client exposes only:

| Client command | JSON-RPC method or tool | Mutates external state |
|---|---|---|
| `server-info` | `initialize` | No |
| `list-tools` | `tools/list` | No |
| `list-resources` | `resources/list` | No |
| `read-skill` | `resources/read` | No |
| `search` | `tools/call` → `search_privy_docs` | No |
| `docs-query` | `tools/call` → `query_docs_filesystem_privy_docs` | No |

The server also advertises `submit_feedback`. Do not call it: its annotations declare `readOnlyHint: false`, `idempotentHint: false`, and `openWorldHint: true`.

## SSE response shape

The endpoint currently returns one or more SSE events:

```text
event: message
data: {"result": {...}, "jsonrpc": "2.0", "id": 1}
```

Join consecutive `data:` lines within an event, parse each event as JSON, and select the response matching the request ID. A JSON-RPC `error` object is a failed request even when HTTP status is 200.

## Troubleshooting

1. Confirm the endpoint with `server-info` once.
2. If HTTP status, content type, or JSON-RPC parsing fails, repeat once with `--verbose`; the client prints metadata only and never prints request headers.
3. Do not retry indefinitely. Use Privy's official `llms.txt`/`llms-full.txt` fallback and mark MCP unavailable.
4. A `GET` response of `405 Method Not Allowed` is expected for this endpoint and does not prove POST failure.

## Citation conversion

Search results already contain complete URLs. For virtual filesystem reads, convert a path such as:

```text
/basics/react/advanced/automatic-wallet-creation.mdx
```

to:

```text
https://docs.privy.io/basics/react/advanced/automatic-wallet-creation
```
