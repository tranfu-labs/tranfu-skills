# Technical Stack And Workflow

Use this reference when the user asks for recommendations based on a project's concrete vision, goals, current technical architecture, or existing workflow.

## Inspect Before Recommending

Read the project before making architecture claims:

- product strategy, roadmap, north star, AGENTS.md, README;
- frontend routes, backend APIs, workers, jobs, CLI, MCP servers, plugins;
- current AI/provider layer, prompts, RAG, tool-calling, embeddings, queues;
- database schema, vector DB, object storage, cache, event stream, memory layer;
- tests, build scripts, lint/typecheck, deployment files, observability;
- existing constraints and rejected technologies.

If the project is unreadable or key docs are missing, report the gap and avoid confident stack claims.

## Context Fields

Extract these before producing `AGENTIC_PACKET`:

```yaml
project_context:
  vision:
  target_users:
  primary_user_action:
  success_evidence:
  current_product_surface:
  existing_stack:
  data_sources:
  current_workflow:
  constraints:
  non_goals:
```

## Workflow Mapping

Convert product flow into an execution map:

| Workflow Element | Questions |
|---|---|
| Input | What starts the job: user message, file, event, schedule, webhook, API call? |
| Deterministic steps | Which steps are rules, parsing, validation, scoring, DB writes, or permissions? |
| AI-assisted steps | Which steps need interpretation, planning, extraction, synthesis, ranking, or critique? |
| Tool calls | Which external systems are called and what permissions do they require? |
| State transitions | What state is produced after each step and where is it stored? |
| Human checkpoints | Where must the user clarify, approve, review, or correct? |
| Output | What artifact, API response, report, action, or UI state proves value? |
| Evaluation | What baseline and tests prove this workflow beats a simpler one? |

## Stack Decision Vocabulary

Classify every stack recommendation:

- `keep`: already present and fits the agentic design.
- `add`: required to meet state, memory, tool, orchestration, or evaluation needs.
- `defer`: promising but unnecessary for the first verified slice.
- `reject`: conflicts with constraints, adds unjustified complexity, or is superseded by existing stack.

Each `add` must include:

- why existing code cannot cover it;
- official docs or primary-source check needed before implementation;
- smallest integration point;
- verification command or observable gate;
- exit/sunset condition if temporary.

## Common Stack Components

Map components to needs, not fashion:

| Need | Candidate Categories |
|---|---|
| Typed LLM outputs | Pydantic, Zod, JSON schema, provider response formats |
| Orchestration | plain workflow, graph runtime, job queue, typed agent SDK |
| Checkpoint/resume | Postgres, Redis, framework checkpointer, durable job state |
| Runtime memory | DB tables, Mem0, vector memory, app-specific memory service |
| Canonical knowledge | relational DB, vector DB, knowledge graph, source registry |
| Tool access | MCP, internal service clients, API gateway, CLI wrappers |
| Human-in-loop | interrupt events, approval tables, UI cards, ticket workflow |
| Evaluation | pytest/vitest, golden tasks, trajectory logs, LLM evals, human rubric |
| Observability | structured logs, traces, run ledger, cost/latency metrics |

## Output Shape

Include this section in the packet when stack/workflow is requested:

```yaml
technical_stack:
  keep:
    - component:
      reason:
  add:
    - component:
      reason:
      smallest_integration:
      docs_to_check:
      verification:
      exit_condition:
  defer:
    - component:
      reason:
      revisit_when:
  reject:
    - component:
      reason:
product_workflow:
  current_flow:
  recommended_flow:
  deterministic_steps:
  ai_assisted_steps:
  tool_calls:
  state_transitions:
  human_checkpoints:
  output_artifacts:
```

## Anti-Patterns

- Replacing a working deterministic service with an agent because the roadmap says AI.
- Recommending a greenfield stack without mapping to current modules.
- Adding memory before defining what may be remembered and what must remain canonical.
- Adding graph orchestration when a job queue and typed steps are enough.
- Adding multi-agent collaboration when a single worker plus validation is enough.
- Ignoring existing deployment constraints, data residency, provider policy, or cost limits.
