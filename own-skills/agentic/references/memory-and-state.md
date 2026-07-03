# Memory And State

Use this reference when an agentic design touches persistence, memory, knowledge, checkpoints, or learning.

## Separate The Layers

| Layer | Purpose | Typical Storage | May Mutate At Runtime? |
|---|---|---|---|
| Working state | Current run inputs, step outputs, control flags | in-process state, graph state, job payload | yes, within one run |
| Checkpoint | Durable resume point for long or interruptible runs | Postgres, Redis, file store, framework saver | yes, by orchestrator |
| Runtime memory | User/session/task preferences and history | Mem0, DB tables, vector store | yes, with policy |
| Canonical knowledge | Source-grounded facts, product rules, domain truth | DB, vector DB, knowledge graph, docs | no, except governed ingestion |
| Audit log | What happened, tools called, decisions made | append-only DB/log/event stream | append-only |

## Rules

- Keep canonical knowledge separate from runtime memory.
- Treat user conversations and tool outputs as runtime artifacts, not ground truth.
- Require provenance and review gates before runtime discoveries become canonical knowledge.
- Use checkpointing for resume/retry, not as a long-term memory substitute.
- Give every memory scope an owner: user, tenant, agent, run, session, project, or organization.
- Define retention, deletion, and privacy rules before public use.

## Design Questions

- What state must survive process restart?
- What state must survive a session?
- What can be recomputed from source data?
- What must be auditable later?
- What memory can users inspect or delete?
- What knowledge requires human review before promotion?

## Anti-Patterns

- Storing authoritative domain knowledge in chat memory.
- Letting an agent update its own policy or persona from user feedback.
- Mixing user preferences with global product rules.
- Using vector search as the only source of authorization or truth.
- Adding memory before defining retrieval, write policy, and deletion policy.

## Recommended Output

For any agentic architecture, define:

```yaml
state_model:
  working_state:
  checkpoint:
  runtime_memory:
  canonical_knowledge:
  audit_log:
memory_write_policy:
  allowed:
  forbidden:
  review_required:
  retention:
```
