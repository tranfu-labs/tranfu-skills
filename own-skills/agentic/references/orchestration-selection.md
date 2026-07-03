# Orchestration Selection

Use this reference when choosing between custom workflows and agent frameworks. Check official current docs for any framework before implementation.

## Framework Fit

| Option | Best For | Watch For |
|---|---|---|
| Plain Python/TypeScript workflow | Fixed flow, MVP, deterministic jobs | Reimplementing checkpoint, interruption, or tool loops later |
| Pydantic models + direct LLM calls | Typed extraction, structured outputs, low framework weight | No orchestration by itself |
| PydanticAI | Typed agents and tools with compact ergonomics | Framework fit depends on persistence and graph needs |
| LangGraph | Stateful graphs, conditional edges, checkpointing, human-in-loop | Avoid dragging in unwanted wrapper ecosystems if project rejects them |
| OpenAI Agents SDK | OpenAI-first agent + tool + handoff workflows | Provider lock-in or linear handoff limits may matter |
| CrewAI | Role/task oriented collaboration | Easy to overuse for roles that are not independently verifiable |
| AutoGen | Research and experimental multi-agent conversation | Production complexity and cost |
| Custom supervisor | Strict contracts and full control | Higher maintenance cost |

## Selection Flow

1. If the workflow is fixed, start with plain code and typed LLM calls.
2. If stateful branching or checkpointing is central, consider a graph runtime.
3. If typed tool ergonomics are the main need, consider a typed agent SDK.
4. If provider portability is required, avoid provider-specific orchestration as the core.
5. If multiple roles are needed, prove each role has unique context, tools, outputs, and evaluation.
6. If the project already has a framework decision, respect it unless there is current evidence it blocks the goal.

## Required Decision Record

Record:

- adopted framework and why;
- rejected alternatives and why;
- what stays custom;
- what is temporary;
- exit conditions for replacing the choice;
- official docs checked, with date or source when relevant.

## Red Flags

- Choosing an orchestration framework before defining state.
- Choosing a multi-agent framework before defining worker contracts.
- Hiding provider-specific calls behind a fake abstraction with no exit plan.
- Adding two orchestration frameworks for one runtime path.
- Using a framework's memory feature without matching product privacy and provenance needs.
