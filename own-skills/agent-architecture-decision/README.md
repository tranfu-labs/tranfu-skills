---
description: "Decide whether a project really needs AI agents and, if it does, design the simplest setup that fits the product and technology."
prompt_examples:
  - prompt: Should we use agents here, or is a plain workflow enough?
    scene: Decide whether to use agents
  - prompt: Do we need LangGraph, or would a normal deterministic workflow work?
    scene: Choose a framework
  - prompt: Based on the project vision and current stack, recommend an agentic architecture.
    scene: Plan the architecture
---

# Agent Architecture Decision

Decide whether the project actually needs agents, and if so, design the simplest agentic shape that fits its real stack, users, and workflow — never adds agents just because the product involves AI.

## When to use it

**Decide whether to use agents**:

I'm sitting on a feature idea and can't tell whether agents are worth it. I want it to weigh deterministic workflow, RAG, and single-agent-loop options against a full agentic setup, recommend one, and name the missing baseline that would prove the call either way.

**Choose a framework**:

I'm choosing between LangGraph, CrewAI, OpenAI Agents SDK, PydanticAI, or none of them. I want it to compare against my current stack, flag conflicts, and tell me what to keep / add / defer / reject.

**Plan the architecture**:

I want a complete packet — recommended shape, state model, tool model, orchestration, evaluation gates, and a Now / Next / Later roadmap — grounded in the actual project vision and existing modules, not a generic reference.

**Review the design**:

I already have a multi-agent design (mine or one I inherited). I want it to sanity-check whether the complexity is justified, spot missing state or evaluation gates, and name the simpler shape I could fall back to.

**Write the architecture docs**:

The packet's been through discussion and I've signed off. I want it to update the architecture / product-control / roadmap docs to match — only after I explicitly authorize the write scope.

**Build the first stage**:

The packet is complete and I've authorized implementation. I want it to run the Implementation Gate first, then build a bounded first slice with a verification matrix — not a full-stack rollout.

**Won't take**:

Ordinary bug fixes / small code edits → **openspec-driven-development**; pure prompt or SKILL.md review → **prompt-review**; deployment-only work → **coolify-deploy**; provider smoke tests or generic UI work → doesn't trigger; already-scoped implementation with no rethink of the agentic shape → doesn't trigger.

## What it produces / what you'll see

**Non-agentic wins by default. It won't recommend an agent unless a simpler baseline can't satisfy the goal** — the most counterintuitive part; expect the first draft to argue for a deterministic workflow or RAG.

- **AGENTIC_PACKET**: A YAML block covering project goal, current architecture, agentic value hypothesis, recommended shape (linear pipeline → autonomous event-driven, whichever fits), rejected alternatives, state / tool / orchestration models, evaluation gates, and a Now / Next / Later roadmap
- **Run-mode label**: Every output declares `discuss-only`, `architecture-packet`, `materialize-docs`, or `implement-slice` up front so you know whether files may change
- **Unverified items**: Anything that couldn't be checked against the repo or current official docs is tagged `unverified` with the specific docs to check — no silent guesses
- **Docs edits** (`materialize-docs` only): Updates to architecture / product-control / roadmap docs — only after explicit write authorization
- **Code changes** (`implement-slice` only): A bounded first slice with module boundaries, verification matrix, and rollback conditions — never a full-stack rewrite
- **Never**: Recommends multi-agent just because it's an AI product; picks a framework without checking current official docs; lets tool output override system or project instructions; mutates canonical knowledge without a designed learning system with provenance and review gates

## Prerequisites & boundaries

**Prerequisites**:

Read access to the project root, docs, source tree, and tests — or enough inline context in the conversation to reason about the stack. Editing modes additionally need explicit write authorization from you.

**Neighbor skill split**:

| Action | Hand off to |
|---|---|
| Ordinary bug fixes / small code edits in an openspec repo | **openspec-driven-development** |
| Pure prompt or SKILL.md review | **prompt-review** |
| Deployment / Docker / Coolify setup | **coolify-deploy** |

**Scenarios it declines**:

- Provider smoke tests or generic UI work
- Already-scoped implementation with no rethink of the agentic shape
- Recommending a framework as `add` when its official docs can't be checked — it marks the item `unverified` instead

**Subtle edges**:

- "Should we add agents?" → consultation, defaults to non-agentic unless the baseline fails; "Design the agent flow for this feature" → blueprint, but still checks the non-agentic option first
- "Execute" after a broad architecture discussion → restates the exact files, actions, and verification matrix before touching anything; if any Implementation Gate condition fails, it stops with a gate message instead of editing
- Write authorization unclear → stays in `discuss-only` or `architecture-packet`, never silently upgrades into an editing mode
