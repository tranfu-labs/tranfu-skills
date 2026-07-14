---
prompt_examples:
  - prompt: "I am starting a new AI web product. Discuss strategy first, inventory every decision-worthy capability, compare broad candidate pools, and do not write code yet."
    scene: "Plan a greenfield product"
  - prompt: "Before choosing the stack, research mature products and compare each Tier A/B/C building block against current primary evidence."
    scene: "Run first stack selection"
  - prompt: "The existing stack is accepted. Evaluate only the new search subsystem and keep all unrelated ADRs frozen."
    scene: "Make a targeted stack change"
  - prompt: "We have consensus. Materialize AGENTS.md, strategy, north-star, technical-stack, and roadmap docs without touching production code."
    scene: "Write the control plane"
---

[English](./README.md) | [中文](./README.zh.md)

# Strategy-First Development

Turn a high-impact product or engineering request into a shared control plane before implementation: strategic consensus, mature-reference research, per-capability technology selection, roadmap gates, and canonical project documents.

## When to use it

- A greenfield product or MVP has no accepted strategy or stack.
- A core runtime, database, auth, orchestration, deployment, or state owner must be selected or replaced.
- A provider, model, UI, data, search, jobs, or observability decision needs evidence rather than familiar defaults.
- The team wants strategy and stack decisions materialized before code.

Do not use it for skill/prompt meta-work, small copy edits, translations, already-scoped bug fixes, pure code review, or deployment of an already-selected architecture.

## What it produces

- `STRATEGY_PACKET` and `CONSENSUS_GATE`.
- Mature product and architecture findings with `adopt / absorb / spike / defer / reject` decisions.
- `CAPABILITY_BLOCK_INVENTORY`, frozen decision briefs, candidate records, shortlists, spikes, and `STACK_SELECTION_GATE`.
- Whole-stack coherence review across runtime, ownership, security, deployment, operations, and exit paths.
- `Now / Next / Later / Not Doing` roadmap slices.
- Canonical `AGENTS.md`, strategy, north-star, technical-stack, and roadmap documents in write-enabled modes.

Strategy materialization is docs-only. It never installs dependencies, scaffolds runtime modules, edits deployment files, or claims implementation completion.

## First-selection defaults

| Tier | Typical impact | Discover | Credible | Archetypes | E2 deep reads |
|---|---|---:|---:|---:|---:|
| A | state/security/topology owner; expensive migration | 7 | 5 | 3 | 3 |
| B | meaningful production subsystem | 5 | 3 | 3 | 2 |
| C | local, low-risk, replaceable utility | 3 | 2 | 2 | 1 |

Counts are floors, not padding targets. Same-engine wrappers, toy projects, incompatible choices, and search-only evidence do not count. Tier A acceptance requires a representative spike unless recent equivalent evidence exists for the same major version, deployment shape, workload, and constraints.

## Selection funnel

1. Inspect current code, docs, manifests, ADRs, and ownership boundaries.
2. Inventory every applicable decision-worthy capability.
3. Freeze must-haves, hard filters, weights, and candidate floors.
4. Discover candidates across distinct solution archetypes and source classes.
5. Verify current version, license, lifecycle, compatibility, security, and maintenance.
6. Hard-reject ineligible options before scoring.
7. Deep-read finalists, run sensitivity analysis, and define or execute required spikes.
8. Select per block, then run whole-stack coherence.
9. Keep unresolved decisions provisional; only passed gates may become accepted.

The full protocol lives in [`references/technology-selection-protocol.md`](./references/technology-selection-protocol.md).

## Boundaries

- `discuss-only` and `strategy-packet` never write files.
- Accepted ADRs stay frozen during `targeted_change` unless new evidence invalidates them.
- Network gaps, stale evidence, incomplete candidate coverage, or unresolved Tier A spikes keep the stack provisional.
- User-facing products must define agent role, authority, hidden internal details, and role-specific quality bars.
- `AGENTS.md` remains canonical; `CLAUDE.md` and `CODEX.md` are pointer/overlay files, not duplicated strategy.

## 同类 Skill 对比

> Drafted through tranfu-publish and approved by `griffithkk3-del`.

### 公司库内

- [Project Docs Initialization](../project-init-docs/SKILL.md) — initializes existing-repo documentation; **difference**: this skill reaches strategy and stack consensus first.
- [Agent Architecture Decision](../agent-architecture-decision/SKILL.md) — decides agent workflow shape; **difference**: this skill governs the whole product and technology stack.
- [AI Project Scoring](../project-scoring/SKILL.md) — evaluates whether to invest; **difference**: this skill plans how an accepted product is delivered.

### 外部世界

- 暂无

### 本 skill 独特价值

- Per-capability candidate pools
- Evidence-gated convergence
- Strategy documents before code

## 使用技巧

> Drafted through tranfu-publish and approved by `griffithkk3-del`.

### 材料方案

- Start from canonical docs and ADRs.
- Verify dynamic facts from primary sources.
- Keep a native/no-dependency baseline.

### 推荐用法

- Begin with `discuss-only` when uncertain.
- Use `wide_first_selection` for greenfield work.
- Use `targeted_change` for accepted stacks.

### 已知限制

- Broad first-selection research takes time.
- Offline evidence remains provisional.
- Tier A usually needs an authorized spike.
