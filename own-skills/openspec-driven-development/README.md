---
description: "Turns day-to-day development into a closed loop — proposal → feature branch → spec → code → archive → PR — so the plan, the code, and the source of truth stay in sync."
prompt_examples:
  - prompt: Add a "bulk export" option to the card export flow.
    scene: Build a new feature
  - prompt: When I delete an operator, why does the delete preview list a whole chain of related operators? Let's talk it through before touching anything.
    scene: Investigate a bug
  - prompt: How would you migrate "user preferences" from localStorage to the backend? Talk it through first — don't start coding yet.
    scene: Discuss an approach
---

# openspec-driven-development

Turns day-to-day development into a closed loop — proposal → feature branch → spec → code → archive → PR — so the plan, the code, and the source of truth stay in sync.

## When to use it

**Build a new feature**:

I'm adding a feature / fixing a bug / refactoring in a repo that follows the openspec convention, and I want it to draft a plan for me to sign off on before touching code, then handle writing files, cutting the branch, and opening the PR end-to-end.

**Consulting-style opener**:

I'm asking things like "how would you change this," "where should this feature live," or "why isn't this working," and I want it to steer the discussion toward a concrete proposal instead of drifting. If the answer turns out to be "no code change needed," it just explains and stops — never manufactures a change.

**Implement an approved plan**:

I already wrote the proposal for `openspec/changes/<X>` in another conversation. When I say "implement this change," it should jump straight to coding — not restart the interview from scratch.

**Check against the plan**:

"I'm done implementing — check whether the code matches the plan and whether anything's missing." It walks through the change item by item; if something is off, it drops back to the coding step and fills the gap.

**Fast lane**:

A one-or-two-line tweak, a copy change, a default value — I don't want the full loop crushing me. Skip writing the change to disk, but keep the reflection, commit, and PR.

**Pause after planning**:

"Run the openspec loop but stop at `plan-written` so I can look" — it respects the requested pause point and waits patiently after writing the plan.

**Won't take**:

Cold-start scaffolding of `openspec/` → **project-init-docs**; tagging / writing changelogs / picking version numbers → **release**; abstract "is this whole project compliant?" audits with no concrete change → doesn't trigger; pure lookup / research / running a command that doesn't touch code → doesn't trigger.

## What it produces / what you'll see

**Plan first by default. Unless the progress plan skips the `plan-written` stop, it won't touch code until you explicitly say "start coding"** — the most counterintuitive part; don't expect it to hammer out code the moment you show up.

- **Progress plan**: On entry it lays out `interviewing → interview-confirmed → plan-written → code-written → code-verified → pr-opened` so you can name a stop point or add items; this is your one chance up front to say "stop here" or "also do this."
- **Interview & diagnosis**: The interview stage naturally pauses for your answers; the closing question is always "anything to add?" — it never answers for you and never skips.
- **In-chat proposal**: The plan appears in chat first (ASCII wireframes for page changes; unit tests and AI-validation cases when there's testable logic or a single-file diff over 200 lines), and only lands on disk after it passes its own self-review.
- **Cut the branch**: After `git fetch`, it cuts a feature branch off the latest `origin/main` — never touches `main` / `master`. Reuses an existing feature branch for the same change if one is around.
- **Write the change**: Under `openspec/changes/<change-id>/`, drops proposal / design / tasks / spec-delta. Page changes get a separate `wireframes.md` — never crammed into `design.md`.
- **Code to spec**: Implements the test cases the plan defined; runs unit tests or the AI validation flow (playwright screenshots / running a command and reading the output / a manual walk-through).
- **Archive in three moves**: The change directory moves to `openspec/changes/archive/<date>-<id>/`; the spec-delta merges into `openspec/specs/<domain>/`; wireframes flow back to `docs/wireframes/pages/<page>.md` and `flow.md`.
- **Close with a PR**: Updates `AGENTS.md`, commits to the feature branch; with a remote, runs `git push -u` and `gh pr create` (body is the `proposal.md`; if an issue number showed up in the conversation, `Closes #<n>` goes on the first line), then reports the PR URL to you.
- **Never**: Merges its own PR; writes or commits directly on `main` / `master`; answers interview questions on your behalf; scaffolds `openspec/` into a repo that doesn't have it; recycles an archived proposal as a fresh plan.

## Prerequisites & boundaries

**Prerequisites**:

The repo root has an `openspec/` directory (`openspec/specs/` + `openspec/changes/`); `git` is runnable; opening a PR against a remote needs `gh` (or an equivalent like `glab mr create`).

**Neighbor skill split**:

| Action | Hand off to |
|---|---|
| Cold-start scaffolding of `AGENTS.md` + `openspec/` skeleton | **project-init-docs** |
| Tagging / writing changelogs / version-number policy | **release** |
| Judging whether raw material is worth cementing into a skill / spec | Content-fit chain — not this skill's job |

**Scenarios it declines**:

- Pure lookup / research / running a command that doesn't touch code
- Compliance audits with no concrete change attached
- Amending an already-archived `archive/<date>-<id>/` — start a fresh change instead

**Subtle edges**:

- "Does the code match the plan / a specific change?" → triggers the compliance review; "is the whole project compliant?" → does not trigger (that's an audit detached from any change)
- The explicit "implement openspec/changes/<X>" phrasing goes straight to coding — as long as the plan is complete. If it's incomplete, it drops back to the interview instead of muscling through.
- The fast lane skips writing the change to disk but still runs the reflection and PR steps; if the tweak turns out non-trivial mid-way (testable logic, multiple files, well past a few lines), it immediately returns to the interview and runs the full loop.
