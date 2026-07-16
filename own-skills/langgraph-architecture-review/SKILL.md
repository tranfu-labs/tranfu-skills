---
name: langgraph-architecture-review
description: >-
  Inspect, explain, visualize, and improve Python LangGraph architecture in an existing project. Use when the user asks to map or draw a LangGraph workflow, understand StateGraph nodes and edges, review state/reducers/persistence/HITL/tool boundaries, compare a graph with current LangGraph guidance, or propose architecture changes for a concrete feature or task. Also matches Chinese requests such as “梳理 LangGraph 架构”, “画节点流程图”, “检查 Agent 工作流”, and “结合业务优化 LangGraph”. Do not use for generic AI architecture selection, ordinary code review without LangGraph, TypeScript-only graphs, or implementing a new graph when no architecture inspection is requested.
version: 0.1.0
author: griffithkk3-del
updated_at: 2026-07-16
origin: own
---

# LangGraph Architecture Review

## Outcome

Turn the project's real LangGraph code into a traceable architecture review:

- a Mermaid graph grounded in source locations;
- state, node, edge, persistence, HITL, model, tool, and side-effect boundaries;
- a feature-level explanation of how the graph delivers the user's task;
- prioritized improvements with evidence, expected effect, risk, and verification.

The source code and compiled graph are evidence. A plausible diagram is not evidence.

## Ownership

Default to `review-only`: inspect and report without editing project code. Only modify a graph when the user explicitly requests implementation after reviewing the architecture.

The named output is `LANGGRAPH_ARCHITECTURE_PACKET`. Read [references/review-contract.md](references/review-contract.md) before writing the final report. Read [references/upstream-sources.md](references/upstream-sources.md) when the user asks for current APIs, latest architecture, framework comparison, persistence, HITL, or migration guidance.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW:

1. Resolve the project root. Read applicable `AGENTS.md` and architecture docs. If no readable project exists, report a blocker and stop.
2. Find LangGraph dependencies and imports. Record the installed Python package version; never infer the version from training data.
3. If the user asks for “latest” or current best practices, check the official release and live documentation listed in `references/upstream-sources.md`. If network access fails, mark the comparison `local-only` instead of guessing.
4. Run the static inventory from the project root:

   ```bash
   python /absolute/path/to/langgraph-architecture-review/scripts/inspect_langgraph.py . \
     --output /tmp/langgraph-architecture.md \
     --json /tmp/langgraph-architecture.json
   ```

5. Read every discovered graph entrypoint, state schema, node callable, router, persistence configuration, and graph-facing API. If the scanner misses dynamic construction, add that evidence manually with file and line references.
6. Use runtime introspection only when importing the graph is demonstrably side-effect free. Prefer the public API:

   ```python
   compiled_graph.get_graph(xray=True).draw_mermaid()
   ```

   Never import a module merely to draw it when import can open database connections, call providers, start servers, mutate files, or run migrations.
7. Map the graph to the concrete product task: user action, inputs, deterministic processing, LLM decisions, tools, human checkpoints, persistence, outputs, and failure behavior. Explain why each node exists.
8. Review the architecture against the checks below. Every finding must cite source evidence or be labeled `unverified`.
9. Validate the generated inventory:

   ```bash
   python /absolute/path/to/langgraph-architecture-review/scripts/validate_report.py \
     /tmp/langgraph-architecture.md
   ```

10. Produce `LANGGRAPH_ARCHITECTURE_PACKET` and end. Do not expose chain-of-thought, secrets, credentials, or private streamed state.

## Review Checks

### Product and graph fit

- Distinguish a deterministic workflow with LLM nodes from an autonomous tool loop.
- Verify that LangGraph adds useful branching, interruption, durable execution, parallelism, or inspectability. Flag graph-shaped linear code when a plain function pipeline would be clearer.
- Reject planner, critic, supervisor, or multi-agent additions unless the task has a measured need that simpler nodes cannot satisfy.

### State and context

- List graph input, internal, private, and output channels separately.
- Record each reducer and all parallel writers. A list without a reducer is overwritten; a reducer on a replace-only field can duplicate data.
- Keep run-scoped configuration in runtime context, thread state in the checkpointer, cross-thread memory in a Store, and business truth in the application database.
- Warn that private state schemas do not automatically redact streamed values; require restricted output keys for sensitive channels.

### Nodes and model calls

- Classify each node as deterministic, LLM, tool, retrieval, persistence, HITL, validation, or side effect.
- Record model/tool call counts on the happy path and each retry/loop path.
- Require structured model output when routing or business state depends on model semantics.
- Keep authorization, idempotency, fact admission, money, identity, and destructive actions deterministic.

### Edges and termination

- Enumerate static edges, conditional edges, `Command` destinations, `Send` fan-out, subgraphs, and terminal paths.
- Detect unreachable nodes, dead ends, unbounded loops, missing fallback routes, and a `Command(goto=...)` combined with an unintended static edge.
- For parallel branches, verify reducers, concurrency limits, partial-failure behavior, and deterministic aggregation.

### Persistence and HITL

- Checkpointer state is thread-scoped execution state, not a replacement for business persistence.
- Store data is cross-thread application memory, not automatically trusted knowledge.
- `interrupt()` requires a checkpointer and the same `thread_id` on resume.
- Code before `interrupt()` re-runs. Side effects before it must be idempotent, moved after the interrupt, or isolated in another node.

### Reliability and evaluation

- Match transient failures to bounded retry policies; let programming errors surface.
- Require stable error states and visible degraded behavior for provider failures.
- Test nodes and routers deterministically, then graph trajectories, interruption/resume, persistence isolation, failure paths, and real-provider smoke separately.
- Recommend LangSmith only when trace/evaluation value justifies external telemetry and data policy permits it; do not require it by default.

## Recommendation Rules

Each recommendation must include:

1. `priority`: P0, P1, or P2;
2. `evidence`: file/line, graph inventory, test, or trace;
3. `problem`: observable failure or unnecessary complexity;
4. `change`: exact node/state/edge/module adjustment;
5. `effect`: user-visible or engineering result;
6. `risk`: migration, latency, cost, safety, or compatibility risk;
7. `verification`: deterministic command or observable acceptance check.

Do not recommend a framework feature because it is fashionable. Tie it to the task and graph evidence.

## Failure Paths

- No LangGraph dependency/imports: report `not_a_langgraph_project`; do not fabricate a graph.
- TypeScript-only graph: report `unsupported_language` and stop; the bundled scanner is intentionally Python-only.
- Graph assembled dynamically or through factories: report scanner gaps, inspect factories manually, and keep uncertain edges labeled `unverified`.
- Import has side effects: stay static-only and report why runtime introspection was skipped.
- Official docs/release unavailable: use the installed version and mark current-version comparison incomplete.
- Mermaid renderer unavailable: emit Mermaid source; rendering is optional, diagram text is required.
- Tests or provider credentials unavailable: report `not_run`; never claim runtime behavior was verified.

## Examples

<example>
User: “梳理当前简历优化的 LangGraph 节点，画清楚分析、人工确认、改写和导出的流程，并指出哪里设计过度。”

Action: inspect the real graph builders and API boundaries, generate the Mermaid diagram, map nodes to the resume workflow, count model calls and persistence transitions, then recommend only evidence-backed simplifications.
</example>

<example>
User: “我们升级了 LangGraph，检查 interrupt 和 checkpointer 的用法是不是最新的。”

Action: record the installed version, read live official persistence/HITL docs, inspect thread IDs and side effects before interrupts, run interruption tests if available, and report compatibility gaps.
</example>

<bad-example>
WRONG: Draw `User -> Planner -> Researcher -> Critic -> Writer` because it looks agentic.

Reason: the nodes were not discovered in source, the diagram invents architecture, and no task evidence justifies multiple agents.
</bad-example>

<bad-example>
WRONG: Recommend putting user facts in the LangGraph checkpointer so every node can access them.

Reason: checkpoint state is execution state. Canonical business facts need an owned database model, provenance, authorization, and lifecycle outside graph memory.
</bad-example>

## Boundaries

- Do not replace generic agent architecture selection; use this Skill only after a project uses or is concretely considering LangGraph.
- Do not treat diagrams, prompts, checkpoints, stores, traces, or model memory as canonical business state.
- Do not install, upgrade, or refactor LangGraph unless the user explicitly requests that follow-up.
- Do not copy upstream Skill text or scripts without checking license and compatibility. Use official live docs as the API source of truth.
