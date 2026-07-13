---
prompt_examples:
  - prompt: I want to build a college-major picking web app for gaokao students — no code yet, run the strategy consensus and land the default control-plane docs.
    scene: Plan a new MVP
  - prompt: Don't hand-roll anything — first search mature GitHub projects and ecosystem defaults, tell me what to adopt / absorb / reject, then draft the stack doc.
    scene: Reuse existing tools
  - prompt: After we agree on the strategy, land AGENTS.md, strategy.md, north-star.md, technical-stack.md and roadmap.md for this repo.
    scene: Write the project plan
  - prompt: No files yet — just walk me through the strategic goal, product shape and non-goals over a few rounds and stop at consensus checkpoints.
    scene: Discuss before building
  - prompt: This existing repo has drifted — reset the strategy, re-search mature projects, and update the technical-stack doc without touching production code.
    scene: Revisit the architecture
  - prompt: Help me pick the provider, model and deployment target grounded in strategic goal and constraints — decision packet only, no code.
    scene: Choose a service provider
---

[English](./README.md) | [中文](./README.zh.md)

# Strategy-First Development

Turn a vague or high-impact product / engineering request into a shared project control plane before coding — via multi-round strategic consensus, mature-project research, stack selection, roadmap slicing, and default control-plane docs.

## When to use it

**Greenfield / new MVP without strategy locked**:

Target user, primary workflow, north star and non-goals are still fluid — you want an agent that first discusses direction and only writes docs after consensus, not one that jumps straight into Next.js + Tailwind scaffolding.

**Avoid reinventing mature engines**:

Before choosing a stack, you want the agent to search GitHub, official docs, package registries and ecosystem defaults, then classify findings as `adopt` / `absorb` / `reject` / `inspect_later` — with a written reason if something must remain custom.

**Materialize the project control plane**:

You want the five canonical strategy docs — `AGENTS.md`, `docs/product/strategy.md`, `docs/product/north-star.md`, `docs/architecture/technical-stack.md`, `docs/product/roadmap.md` — created or updated in place, with existing canonical docs preserved over duplicated.

**Provider / deployment / architecture-upgrade decision**:

The question is which model, provider, deployment target or module boundary to commit to — you want it tied to strategic requirements and mature-project findings, not personal taste.

**Discuss only, don't touch files**: sometimes you just want the multi-round consensus and a strategy packet, with `may_write_docs: false` — the agent stops at the consensus checkpoint.

**Not for**: single-line commands, small copy edits, translations, already-scoped bug fixes, pure code review, release / publish work, or skill / prompt / agent meta-tasks — those route to their own workflows.

## What it produces

**Documentation artifacts only — never edits production code, dependencies or deployment files during strategy materialization.**

- **Consensus checkpoints**: each round records `Agreed / Still Open / Proposed Default / Need Your Decision` — no long questionnaire, several short rounds instead.
- **Strategy packet**: strategic goal, target user, product shape, primary workflow, non-goals, constraints, risks, open questions — in a stable YAML schema.
- **Mature-project findings**: candidates with source, maturity, strategic fit, reusable parts, what to absorb, risks — each carrying one of `adopt` / `absorb` / `reject` / `inspect_later`.
- **Technical stack direction**: chosen stack, adopted libraries, absorbed patterns, rejected alternatives, custom-build surface with strategic reason, temporary choices with exit conditions.
- **Roadmap**: `Now` / `Next` / `Later` / `Not Doing`, each slice with a gate or evidence requirement.
- **Default artifacts**: the five control-plane docs, all marked `draft` unless the user explicitly accepts, with visible assumptions and open questions.
- **Verification report**: intended files exist, canonical docs were not duplicated, no production code changed, mature-project search status is visible.

## Prerequisites & boundaries

**Prerequisites**:

A workspace the agent can read and a user willing to run several short consensus rounds. Network access is preferred for mature-project search — if unavailable, the search is marked `incomplete_with_reason` and the stack is not presented as fully validated.

**Adjacent skills**:

| Task | Route to |
|---|---|
| Write a PRD / feature spec after strategy is set | **write-spec** |
| Evaluate whether an AI workflow is worth the investment | **project-scoring** |
| Audit / clean architecture drift on an existing project | **architecture-hygiene** |
| Add AGENTS.md and basic AI-collaboration docs to an existing repo | **project-init-docs** |
| Create, review or improve a skill / SKILL.md | **skill-create-workflow** / **skill-improve-workflow** / **prompt-review** |

**Out of scope**: skill / prompt / agent meta-work; single-line commands, small edits, translations, already-scoped bug fixes; overwriting user-authored content in canonical docs; claiming implementation completion from doc edits alone; hand-rolling mature engines (auth, payments, charts, media, scheduling, search, queues, model clients) without a written reason.

**Subtle edges**:

- Explicit user authorization to generate default files covers documentation edits only — never production code
- When mature-project search cannot complete, draft docs may still ship, but `technical-stack.md` must carry the research gap
- Existing canonical docs are updated in place; duplicate paths must be surfaced and confirmed before creating a second copy
