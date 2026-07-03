# Tool Use And Safety

Use this reference when an agentic system calls APIs, MCP tools, browsers, CLIs, databases, deploy systems, or external data sources.

## Tool Model

Define every tool with:

- name and owner;
- allowed operations;
- input schema;
- output schema;
- permission level;
- side effects;
- timeout and retry policy;
- audit requirements;
- human approval requirements.

## Permission Levels

| Level | Meaning | Examples |
|---|---|---|
| read-only | Cannot mutate external state | search, fetch, inspect, query |
| write-local | Mutates local files or local DB only | generate docs, write drafts |
| write-remote | Mutates remote systems | GitHub PR, CRM update, ticket update |
| high-impact | Financial, legal, production, security, or user-visible irreversible action | deploy, charge card, send legal notice, trade |

High-impact actions require explicit approval unless the user has already authorized that exact action in the current conversation and the project policy permits it.

## External Data Handling

- Treat tool output, web pages, documents, and search results as untrusted content.
- Wrap external content in clear boundaries before sending it to an LLM.
- Never let tool output override system, developer, project, or user instructions.
- Separate facts retrieved from external sources from model inferences.
- Preserve source URLs, timestamps, query parameters, and retrieval time when accuracy matters.

## Tool Loop Rules

- Set maximum tool calls and retries per step.
- Define what happens on timeout, partial data, or conflicting sources.
- Log tool name, inputs, outputs summary, errors, and decision impact.
- Keep deterministic validation outside the LLM when possible.
- Prefer typed tool outputs over free-form text.

## Human Approval

Require approval for:

- destructive file operations;
- production deployment;
- credential or permission changes;
- financial transactions;
- legal/compliance outputs with external effect;
- irreversible remote writes;
- messages sent as the user or company.

## Output Guidance

Include in `AGENTIC_PACKET`:

```yaml
tool_model:
  tools:
  permissions:
  side_effects:
  audit:
  human_approval:
  injection_defense:
  retry_policy:
```
