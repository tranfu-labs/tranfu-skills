---
prompt_examples:
  - prompt: This postmortem — help me frame what kind of skill it should become before I write SKILL.md.
    scene: Name from a postmortem
  - prompt: A rule fell out of this issue thread — what container should this crystallize into?
    scene: Name from an issue
  - prompt: I want to call it cache-debug-fix — score my name against alternatives before I commit.
    scene: Review a proposed name
  - prompt: PR discussion attached — lift the right skill container out of it, don't just pick the noun I already used.
    scene: Name from a pull request
  - prompt: skill-content-fit passed this postmortem — frame the container so skill-create-workflow can pick it up.
    scene: Continue after fit review
  - prompt: Skim docs/postmortems/ and frame a container for each one that has enough signal.
    scene: Name several skills
---

[English](./README.md) | [中文](./README.zh.md)

# Skill Domain Framing

Frame the container for a not-yet-created skill from raw material (postmortem / guardrail / PR / issue / doc) — score 4+ candidates on trigger alignment, hand off a decision, never write SKILL.md.

## When to use it

**Name from a postmortem**:

I have a postmortem in hand and want to crystallize the corrective pattern into a skill, but I don't yet know what to call the container — and I don't want the incident's cache / vendor / file names to hijack the name.

**Explicit framing question**:

"What kind of skill should this become?" — I want the scope, the boundary, and the success signal locked before I open a SKILL.md scaffold.

**Review a proposed name**:

I already have a container name in mind. I want the score table to challenge it — if it survives, great; if a higher-scoring alternative shows up, argue me out of the one I brought.

**Doc / PR / issue material**:

A guardrail block in `AGENTS.md`, a PR discussion, an issue thread — I want the skill to lift the right container out of the noise instead of adopting whichever noun I happened to type.

**Hand-off after fit-check**:

`skill-content-fit` just returned pass. Before `skill-create-workflow` can start, I need the container name locked and the source material placed in the right layer (main path / verification / failure branch).

**Not for**:

Input is already a skill / `SKILL.md` / installed skill → **skill-improve-workflow**; judging whether the material even qualifies as a skill → **skill-content-fit**; naming the paired `display_name` / `display_name_zh` → **skill-name-generation**; writing the SKILL.md body after the container is chosen → **skill-create-workflow**.

## What it produces

**Framework decision only — never writes SKILL.md.** That's the most counterintuitive part.

- **Candidate score table**: at least 4 candidates covering at least 3 abstraction axes (user-outcome / repeatable-task / action-orchestration / implementation-object / platform / code-location); each scored 0–2 on three dimensions (trigger alignment / boundary clarity / path layering); one-line rationale per row explaining any non-max score.
- **Three machine-read summary lines**: `Top1` / `Top1-Top2 margin` / `user-proposed candidate` — `skill-create-workflow §4` reads these directly to route the next step.
- **Scope block**: what the container includes / excludes / where the source experience lands (main path, conditional branch, verification checklist, failure diagnosis, examples).
- **Path layering**: normal / verification / failure — never lets an incident's debug trail (probes, log queries, cache bypasses, rollbacks) impersonate the main workflow.
- **Trigger-scene and acceptance-criteria drafts**: plain sentences the downstream skill author can lift straight into SKILL.md.
- **Will never**: write SKILL.md, touch any repo file, or auto-adopt the user-proposed name — even a name the user brought has to earn its rank, and a low score is used to argue against it, not to hide it.

## Prerequisites & boundaries

**Prerequisites**:

A piece of raw material to read — postmortem, guardrail note, issue / PR discussion, `AGENTS.md` excerpt, project doc. The material must expose at least one of: an actual failure, a rule, or a workflow. If none is visible, up to 3 clarifying questions; still missing → blocking status, never force-fit.

**Adjacent skills**:

| Task | Route to |
|---|---|
| Judge whether material qualifies as a skill at all | **skill-content-fit** |
| Write the SKILL.md scaffold after the container is chosen | **skill-create-workflow** |
| Name paired `display_name` / `display_name_zh` | **skill-name-generation** |
| Review or refine an existing skill | **skill-improve-workflow** |

**Out of scope**:

- Input is already a skill / `SKILL.md` / installed skill content
- Renaming an existing skill's slug
- Choosing the paired English + Chinese display names
- Reviewing / fixing an existing skill

**Subtle edges**:

- A user-proposed name doesn't auto-win — it enters the score table like any other candidate; a low score is used to argue against it, never to silently drop it
- Action / orchestration verbs (`create` / `review` / `improve`) are legitimate first-axis names when the skill's job literally is that verb — never penalized for "being a verb"; the real test is whether users will use that word when asking for the capability
- If the material can't produce 4 candidates across 3 axes → blocking, ask for more material rather than pad the table with near-duplicates
