---
prompt_examples:
  - prompt: I want to crystallize this postmortem into a skill — is it good enough?
    scene: Postmortem
  - prompt: I hit a snag on this project and wrote a summary — is it worth turning into a skill?
    scene: Lesson learned
  - prompt: This user-preference block in AGENTS.md — can it be crystallized into a skill?
    scene: Doc snippet
  - prompt: Can this material be turned into a capability? I'm not sure — judge it first.
    scene: Explicit doubt
  - prompt: Run every postmortem under docs/postmortems/ through the check and pick the ones worth skilling.
    scene: Batch triage
  - prompt: The rule from this issue thread — should it be a skill? Just give me pass or reject.
    scene: Issue crystallization
---

[English](./README.md) | [中文](./README.zh.md)

# Skill Content Fit Check

Judge whether a piece of raw material qualifies as a reusable skill — verdict is **pass / reject**, and on reject the skill only lists what's missing rather than inventing a fake workflow.

## When to use it

**Postmortem crystallization**:

I just wrapped a production postmortem and I have the corrective pattern in hand — I want the skill to judge whether this is a reusable process or a one-off fact before I decide whether to crystallize it.

**Lesson-learned reuse**:

The project hit a snag, I've written up a summary — I want a plain answer on whether it qualifies as a skill. If yes, route it downstream; if no, tell me exactly what's missing.

**Doc snippet upgrade**:

A chunk of project docs / `AGENTS.md` / an issue discussion feels like it could be crystallized into a capability, but I'm not sure — I'd rather run the acceptance check first than jump straight into writing.

**Batch triage**:

I have a pile of incident notes / feedback / lesson fragments and I want the skill to filter which ones deserve crystallization, so the rest can just be archived.

**Not for**:

Content is already a skill / `SKILL.md` / installed skill → **skill-improve-workflow**; naming a skill's slug (lowercase, hyphenated) → **skill-domain-framing**; paired display names → **skill-name-generation**; writing `SKILL.md` after a pass verdict → **skill-create-workflow**.

## What it produces

**On reject, never fabricates a fake workflow — only lists what's missing.** That's the most counterintuitive part.

- **Verdict**: two states only — **pass** (all six acceptance checks met) / **reject** (any hard condition missing)
- **Six-axis judgement**: repeatability / trigger / executable flow / verification / boundary & counter-example — each must have at least one piece of evidence extractable from the input
- **Reject comes with a missing-fields list**: what's absent from the input plus what the user needs to supply, so the next round can pass in one go
- **Pass comes with crystallization notes**: draft points on trigger / workflow / counter-example / acceptance criteria for the downstream skill author
- **Will never**: invent a workflow to force a reject into a pass, nor decide what to do with disqualified content (keep, archive, delete — that's your call)

## Prerequisites & boundaries

**Prerequisites**:

A piece of content to paste in — postmortem, lesson summary, doc snippet, or feedback log. Too-short input or pure background material gets rejected on sight.

**Adjacent skills**:

| Task | Route to |
|---|---|
| Write `SKILL.md` scaffold after a pass verdict | **skill-create-workflow** |
| Name a skill's slug (lowercase, hyphenated) | **skill-domain-framing** |
| Paired English + Chinese display names | **skill-name-generation** |
| Generate README after a pass verdict | **skill-readme-generation** |
| Content is already a skill, review / refine it | **skill-improve-workflow** |

**Out of scope**:

- Input is already a skill / `SKILL.md` / installed skill content
- Just a snippet of code / a command with a "make it a skill" wrapper — no trigger scene, no boundary
- Rewriting disqualified content into something acceptable (that's the skill author's job)

**Subtle edges**:

- High-risk scenes (legal / finance / compliance / production release) relax the repeatability count, but flow and verification stay mandatory
- One-off facts / single-user preferences / emotional feedback → always rejected, no soft-pass "check again later"
