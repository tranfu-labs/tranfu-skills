---
prompt_examples:
  - prompt: Take a quick look at this SKILL.md and tell me what it's really doing.
    scene: Diagnose a skill quickly
  - prompt: Reverse-engineer this skill top to bottom — I want the full structural report.
    scene: Analyze a skill in depth
  - prompt: The trigger on this SKILL.md reads too vague — rewrite it for me.
    scene: Find improvement areas
  - prompt: Generate a trigger benchmark so I can tell whether this skill fires on the requests I care about.
    scene: Test when it triggers
  - prompt: Compare these three skills and extract the shared creation formula.
    scene: Compare two skills
  - prompt: Package this prompt workflow into a marketplace-ready skill.
    scene: Prepare for publishing
---

[English](./README.md) | [中文](./README.zh.md)

# skill-reverse-engineer

Treat any visible skill artifact as a designed system — read out its trigger logic, workflow, output contract, risks, and reusable creation formula, keeping evidence and inference cleanly separated.

## When to use it

**Diagnose a skill quickly**:

You're staring at a SKILL.md and want a fast read on what it's really doing, why it triggers where it triggers, and whether it's any good — no oversized report.

**Analyze a skill in depth**:

You want to understand end to end how a skill was built — trigger mechanism, workflow steps, reused design patterns, and the creation formula behind it.

**Find improvement areas**:

The skill is weak — vague trigger, missing output contract, overlong body — and you want a targeted patch list or a fully rewritten SKILL.md.

**Test when it triggers**:

You want to know whether the skill actually fires on the requests you care about — should-trigger / should-not / ambiguous / edge queries with reasons.

**Compare two skills**:

You hand over multiple skills and want the shared formula, the differences, and a reusable template extracted.

**Prepare for publishing**:

Turn a raw prompt workflow into a marketplace-ready skill — positioning, folder structure, SKILL.md, tests, release checklist.

**Won't take**:

Bootstrapping a brand-new skill from a blank page → **skill-create-workflow**; naming a skill's slug / display name → **skill-domain-framing** / **skill-name-generation**; deciding whether raw material is worth crystallizing into a skill → **skill-content-fit**; installing / listing / running an existing skill → runtime CLI, not this skill.

## What it produces

**Evidence-labeled analysis, mode-sized to the request. It rewrites a full SKILL.md only when you ask.**

- **Mode first**: Picks Quick / Full / Audit / Trigger-test / Package / Compare before writing anything, so a light question doesn't come back as a full report.
- **Evidence discipline**: Every material claim is tagged — "from the visible content" / "reasonable to infer" / "cannot be determined because" / "to verify this, test". Never claims access to hidden system prompts, private routing, or marketplace ranking logic.
- **Structural diagnosis**: Trigger logic, workflow steps, output contract, resource strategy, risks and failure modes.
- **Trigger benchmark**: When trigger reliability matters, produces 10 should-trigger / 10 should-not / 5 ambiguous / 5 edge queries, each with expected activation and reason.
- **Quality scoring**: 15 dimensions (intent clarity, trigger precision / recall, workflow completeness, output consistency, safety, portability, context efficiency, marketplace readiness, ...) plus an overall rating.
- **Creation formula**: 16-point reusable formula summarizing how the skill was likely built — target user, repeated task, workflow pattern, trigger strategy, resource strategy, output contract.

## Boundaries

Only reads what the user pastes or points to; never claims platform-internal knowledge (hidden system prompts, marketplace ranking, private routing); missing evidence is called out, not fabricated.

**Adjacent skills**:

| Task | Route to |
|---|---|
| Bootstrap a brand-new skill from a blank page | **skill-create-workflow** |
| Name a skill's slug / display name | **skill-domain-framing** / **skill-name-generation** |
| Decide whether raw material is worth crystallizing into a skill | **skill-content-fit** |

**Subtle edges**:

- Partial artifacts are analyzed with missing sections explicitly labeled — never fabricates closure
- A fully rewritten SKILL.md is emitted only when the user asks for it, or when patch-style advice is too weak to help
