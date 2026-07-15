---
description: "Take \"build X\" goals from a one-liner to a real artifact — commit to the most probable shape first, then verify it against a roleplay-able persona through a doc-relay pipeline."
prompt_examples:
  - prompt: Help me build a Monte Carlo simulation website — plan it end to end.
    scene: Plan a new project
  - prompt: Thinking of a small budgeting tool. How would you design it? Talk it through first.
    scene: Discuss an idea first
  - prompt: The homepage card list drifted — please fix it. goal-docs/ is already there.
    scene: Fix an existing project
---

# Goal-Driven Decomposition

Take "build X" goals from a one-liner to a real artifact — commit to the most probable shape first, then verify it against a roleplay-able persona through a doc-relay pipeline.

## When to use it

**Plan a new project**:

I drop a one-liner like "make a Monte Carlo site" or "build a tool" and there's no `goal-docs/` yet. I want it to prior-weight the most probable shape, propose a one-layer-deeper true goal, and only proceed after I nod.

**Discuss an idea first**:

I'm asking "how would you design X" or "let's talk it through first" — I haven't committed to building. I want it to still open a persona and dimensions so I can see the shape before I decide.

**Fix an existing project**:

I say "X drifted" or "the homepage is off" with `goal-docs/` already in place. I want it to skip re-design and drop the mismatch straight into the validation-fix loop.

**Add a new feature**:

I say "add Y" or "also support Z". I want it to re-run only the affected dimensions, not drag the rest through again.

**Change the target users**:

I say "the audience is now Z" — the old persona is basically void. I want it to stop and ask me: redo all, redo selectively, or start a fresh `goal-docs/` as a new project.

**Won't take**:

Zero-dimension one-shot edit (typo fix / rename a var) → no trigger; `goal-docs/` exists but I'm only asking, not changing → no trigger; commercial fit "should we build this at all" → **business-analysis-pipeline**; article draft review → **credibility-review**; publish a skill to the company library → **tranfu-publish**.

## What it produces / what you'll see

**Plan first by default; the goal is never silently reinterpreted without your sign-off** — the most counterintuitive part. Your literal wording sits verbatim in `user_goal_surface.md` as an audit mirror; the one-layer-deeper true goal only lands in `00-true-goal-r{N}.md` once you approve.

- **Files under `goal-docs/`**: `user_goal_surface.md` for the literal wording, `00-true-goal-r{N}.md` for the underlying goal, `00-用户画像-r{N}.md` for the roleplay-able persona, `20-goal-tree-r{N}.md` for the goal tree and slices, per-dimension `0X-{dim}-r{N}-{turn}-{role}.md`, plus `40-build-plan`, `90-validation-plan`, `91-validation-run`, `92-fix-attempt`, `99-retro`
- **Local screenshots**: sample-track dims (UI / visual / typography / copy tone) require 1-3 hero-ref and 1-3 anti-ref screenshots saved under `goal-docs/_refs/` — a product name alone is not enough
- **Candidate PNGs**: every sample-track dim MUST render PNGs first for the persona Agent to react to — a text-only revision does not count
- **Fresh Agents everywhere**: persona / scope / DoD / goal-tree / build-plan / validation / fix Agents each get a clean context; the main agent does not author artifacts itself
- **Real artifact**: the final output is real code / site / CLI — not a mock, not a screenshot
- **Never**: silently rewrite your literal wording without approval; touch `git` (no commit / push / branch switch); send any external notification; and if the per-dim validation-fix loop cannot pass in 3 rounds, it surfaces to you rather than looping on silently

## Prerequisites & boundaries

**Prerequisites**:

A writable directory (`goal-docs/` will be created); for any sample-track dim (UI / visual / typography / copy tone), place 1-3 hero-ref and 1-3 anti-ref screenshots under `goal-docs/_refs/` ahead of time.

**Neighbor skill split**:

| Action | Hand off to |
|---|---|
| Cold-start scaffolding for `AGENTS.md` / `openspec/` | **project-init-docs** |
| Single-change loop inside an existing `openspec/` project | **openspec-driven-development** |
| Whether an AI product should be built / commercial fit | **business-analysis-pipeline** |
| Reviewing whether an article draft reads like clickbait | **credibility-review** |
| Publishing a local skill to the company library | **tranfu-publish** |

**Scenarios it declines**:

- Zero-dimension one-shot edit (typo fix / rename a var)
- `goal-docs/` exists but I'm only asking, not changing
- Already in another skill's scope (commercial / review / publish)

**Subtle edges**:

- Cold start vs iteration is decided by whether `00-用户画像-r{N}.md` exists under `goal-docs/` — missing = cold start
- enumerate-track vs sample-track: does the spec compress losslessly into text? Yes → enumerate (features / stack / deployment); no → sample (UI / visual / typography / copy tone) → forced PNG render + blind-compare check
- "Add X" when no matching module exists in the goal tree → allocates the next free integer and appends; never spills into reserved bands
