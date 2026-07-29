---
name: privy-mcp
description: Use Privy's official documentation MCP to research and implement Privy authentication, embedded wallets, wallet ownership, controls, policies, transactions, funding, webhooks, SDK migrations, or related integrations. Trigger for requests such as "用 Privy MCP 查文档", "对接 Privy", "检查 Privy 官方 API", and Privy-related code or architecture work. Do not trigger for generic wallet/blockchain work that does not involve Privy, Privy dashboard administration, production credential operations, or product support. Treat the MCP as public documentation only; never send secrets or call its feedback-writing tool.
version: 0.1.0
author: griffithkk3-del
updated_at: 2026-07-29
origin: own
---

# Privy MCP

Use current official Privy documentation as evidence, reconcile it with the target project's installed SDK and architecture, then implement and verify the requested integration. Prefer an MCP server already exposed by the runtime. If the project configures Privy only for another editor, use the bundled read-only client without changing Codex configuration.

## Required outcome

Produce a named `PRIVY_EVIDENCE_PACKET` containing:

- the question and detected project context;
- official Privy claims with exact documentation URLs;
- project constraints and conflicts kept separate from vendor claims;
- the implementation or recommendation derived from both;
- deterministic checks run, results, and unverified items.

For implementation requests, MUST edit only files authorized by the user and the project rules. For research-only requests, NEVER edit project files.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW:

1. Read project agent rules, package manifests, relevant source/tests, architecture decisions, and MCP config candidates such as `.cursor/mcp.json`, `.mcp.json`, `.vscode/mcp.json`, and Codex MCP registrations. If the request is ambiguous about the desired behavior, ask one focused question and stop.
2. Record the target runtime, installed Privy package names and versions, authentication boundary, wallet ownership model, chains, and requested outcome. Never infer an API shape solely from prior knowledge.
3. Select the documentation path:
   - If a Privy MCP tool is already exposed, use it.
   - Otherwise run `python3 <skill-dir>/scripts/privy_mcp.py server-info`, then use the same client for the remaining calls.
   - If the endpoint is unavailable, use `https://docs.privy.io/llms.txt`, `https://docs.privy.io/llms-full.txt`, and the linked official pages as read-only fallbacks. Mark the MCP path unverified.
4. Read the MCP resource `mintlify://skills/privy` once per task when available. Treat it as navigation guidance, not sufficient evidence for version-sensitive code.
5. Search broadly with `search_privy_docs`, then read the most relevant `.mdx` pages with `query_docs_filesystem_privy_docs`. For REST details, inspect the official OpenAPI material exposed in the documentation filesystem. Read migration pages when installed SDK major versions or examples conflict.
6. Build an evidence table before editing. Label each row `official_doc`, `project_constraint`, or `inference`; include a precise URL for every `official_doc` row. If official pages conflict, prefer the page matching the installed SDK/platform and report the conflict.
7. For an implementation request, make the smallest change consistent with both the evidence table and project architecture. Never let a vendor recipe silently override an accepted ADR, ownership boundary, or server trust boundary.
8. Run deterministic verification in repository-defined order: targeted tests, type check, lint, build, then any manual or live check explicitly authorized by the user. A documentation result is not runtime verification.
9. Emit `PRIVY_EVIDENCE_PACKET` and end. State changed files, every verification command and result, exact citations, and all unverified behavior.

## MCP tool policy

Allowed operations:

- `initialize`, `tools/list`, `resources/list`, and `resources/read` for discovery;
- `search_privy_docs` for semantic discovery;
- `query_docs_filesystem_privy_docs` for exact read-only searches and page reads.

NEVER call `submit_feedback`. It creates external state, is not read-only, and is outside this skill's scope. NEVER call an unknown tool even if a future server advertises it. Never send API keys, app secrets, access tokens, cookies, user data, wallet material, private repository content, or unsanitized logs/code in an MCP query.

MUST keep queries minimal and sanitized. The public docs MCP does not need authentication. NEVER modify Codex, Cursor, Claude, or project MCP configuration unless the user explicitly asks for that configuration change.

Use the bundled client as follows:

```bash
python3 <skill-dir>/scripts/privy_mcp.py server-info
python3 <skill-dir>/scripts/privy_mcp.py list-tools
python3 <skill-dir>/scripts/privy_mcp.py read-skill
python3 <skill-dir>/scripts/privy_mcp.py search "React embedded wallet automatic creation v3"
python3 <skill-dir>/scripts/privy_mcp.py docs-query 'head -120 /basics/react/advanced/automatic-wallet-creation.mdx'
```

Read [references/mcp-protocol.md](references/mcp-protocol.md) when diagnosing transport errors, inspecting raw responses, or verifying the client/server contract.

## Evidence and implementation rules

- Cite `https://docs.privy.io/<path>` after removing `.mdx` from a virtual filesystem path.
- Prefer a full relevant page section over a search snippet for version-sensitive configuration.
- Inspect installed type definitions or package exports when documentation and the installed SDK disagree; report the mismatch rather than forcing either shape.
- Separate public App ID configuration from private App Secret handling. Never expose a secret in client code, logs, tests, MCP prompts, or the final answer.
- Treat authentication, wallet ownership/signers, policy enforcement, and transaction authorization as security boundaries. Preserve fail-closed behavior and add negative tests when behavior changes.
- Do not claim MCP access to a Privy dashboard, authenticated project data, private support content, application state, wallets, or transactions.

## Failure paths

- If project MCP config exists but the server is not loaded in the current runtime, state that distinction and use the bundled client; do not claim the configured editor's tool is active.
- If `initialize` or repeated requests return protocol, channel, or transport errors, stop retrying after one confirmation attempt. Report the endpoint, HTTP/protocol error without secret headers, and use the static official-doc fallback.
- If a query returns no useful results, reformulate it once with exact SDK symbols or feature names, then inspect the docs tree with a targeted `rg`. If still empty, report insufficient official evidence.
- If official guidance conflicts with project governance, do not implement the vendor recipe. Identify the governing project decision and request approval for any architecture change.
- If deterministic verification fails, fix in-scope defects or report the exact failure. Never describe the integration as complete.
- If the task requires dashboard changes, real transactions, production credentials, or documentation feedback, stop at instructions/evidence unless the user separately authorizes that exact external action.

## Output format

```text
PRIVY_EVIDENCE_PACKET
Question: <requested outcome>
Project context: <runtime, SDK/version, auth/ownership/chains>
MCP path: <loaded tool | bundled read-only client | static fallback>
Evidence:
- [official_doc] <claim> — <exact https://docs.privy.io/... URL>
- [project_constraint] <claim> — <file:line>
- [inference] <claim and reasoning>
Decision: <implementation or recommendation>
Changed files: <absolute paths or none>
Verification:
- `<command>` — PASS|FAIL|NOT RUN: <evidence>
Unverified: <concrete list or none>
```

<example>
User: "用 Privy MCP 检查 React v3 自动创建用户钱包的配置，并按项目现有架构实现。"

Correct behavior: inspect the installed `@privy-io/react-auth` version and project ADRs; query automatic wallet creation and the v3 migration page; read the full relevant pages; distinguish Privy's current nested `embeddedWallets.ethereum.createOnLogin` shape from project ownership rules; edit targeted source/tests; run deterministic checks; return a cited `PRIVY_EVIDENCE_PACKET`.
</example>

<bad-example>
WRONG: Read `.cursor/mcp.json`, claim "Privy MCP is available in Codex", copy the first search snippet into code, send an environment dump to the query, call `submit_feedback`, and report "done" without tests.

Reason: configuration is not runtime tool availability, search snippets may be version-incomplete, secrets/private content must not leave the workspace, feedback mutates external state, and documentation lookup does not verify runtime behavior.
</bad-example>
