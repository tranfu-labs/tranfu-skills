---
description: "Turns day-to-day development into a closed loop — proposal (pauses for your sign-off) → spec → code → archive → commit → asks about the PR — so the plan, the code, and the source of truth stay in sync."
prompt_examples:
  - prompt: Add a "bulk export" option to the card export flow.
    scene: Build a new feature
  - prompt: When I delete an operator, why does the delete preview list a whole chain of related operators? Let's talk it through before touching anything.
    scene: Investigate a bug
  - prompt: Add bulk delete. I don't need to review the plan — run the rest on autopilot.
    scene: Unlock auto-advance
---

# openspec-driven-development

Turns day-to-day development into a closed loop — proposal (pauses for your sign-off) → spec → code → archive → commit → asks about the PR — so the plan, the code, and the source of truth stay in sync.

## When to use it

**Build a new feature**:

I'm adding a feature / fixing a bug / refactoring in a repo that follows the openspec convention, and I want it to draft a plan for me to sign off on before touching code, then handle writing files, coding, and archiving end-to-end — and ask me once at the end whether to open a PR.

**Consulting-style opener**:

I'm asking things like "how would you change this," "where should this feature live," or "why isn't this working," and I want it to steer the discussion toward a concrete proposal instead of drifting. If the answer turns out to be "no code change needed," it just explains and stops — never manufactures a change.

**Implement an approved plan**:

I already wrote the proposal for `openspec/changes/<X>` in another conversation. When I say "implement this change," it should jump straight to coding — not restart the interview from scratch.

**Check against the plan**:

"I'm done implementing — check whether the code matches the plan and whether anything's missing." It walks through the change item by item; if something is off, it drops back to the coding step and fills the gap.

**Fast lane**:

A one-or-two-line tweak, a copy change, a default value — I don't want the full loop crushing me. Skip writing the change to disk, but keep the reflection and commit, and still ask me about the PR at the end.

**Unlock auto-advance**:

"Start coding automatically once the plan is written" / "run the rest on autopilot" — this releases the plan-confirmation stop and lets it run straight through to commit. The PR is never part of "autopilot": it still pauses to ask. To delegate the PR too, say so explicitly ("open a PR at the end").

**Won't take**:

Cold-start scaffolding of `openspec/` → **project-init-docs**; tagging / writing changelogs / picking version numbers → **release**; abstract "is this whole project compliant?" audits with no concrete change → doesn't trigger; pure lookup / research / running a command that doesn't touch code → doesn't trigger.

## What it produces / what you'll see

**Two default stops: after the plan lands on disk it waits for you to say "start coding"; after the commit it asks whether to open a PR** — don't expect it to hammer out code the moment you show up, and don't worry about it pushing anything out on its own.

- **Progress plan**: On entry it lays out `interviewing → interview-confirmed → plan-written ⏹stop⏹ code-written → code-verified → committed ⏹ask-PR⏹` so you can name stop points, release the auto-advance, or add items. "Autopilot" only releases the plan stop — the PR and branch creation always require explicit words.
- **Interview & diagnosis**: The interview stage naturally pauses for your answers; the closing question is always "anything to add?" — it never answers for you and never skips.
- **In-chat proposal**: The plan appears in chat first (ASCII wireframes for page changes; unit tests and AI-validation cases when there's testable logic or a single-file diff over 200 lines), and only lands on disk after it passes its own self-review.
- **No branch by default**: It writes, codes, and commits on the current branch — `main` included. It only cuts a feature branch when you explicitly ask for one, or when you explicitly asked for a PR and one is needed to carry it.
- **Write the change**: Under `openspec/changes/<change-id>/`, drops proposal / design / tasks / spec-delta. Page changes get a separate `wireframes.md` — never crammed into `design.md`.
- **Code to spec**: Implements the test cases the plan defined; runs unit tests or the AI validation flow (playwright screenshots / running a command and reading the output / a manual walk-through).
- **Archive in three moves**: The change directory moves to `openspec/changes/archive/<date>-<id>/`; the spec-delta merges into `openspec/specs/<domain>/`; wireframes flow back to `docs/wireframes/pages/<page>.md` and `flow.md`.
- **Close by asking about the PR**: Updates `AGENTS.md`, commits to the current branch; with a remote it pauses and asks "open a PR?" — defaulting the target to `dev` when the remote has one, otherwise `main`. Only after you agree does it cut a branch to carry the commits, push, and run `gh pr create` (body is the `proposal.md`; if an issue number showed up in the conversation, `Closes #<n>` goes on the first line), then reports the PR URL.
- **Never**: Pushes or opens a PR without asking or being explicitly told; cuts a branch uninvited; merges its own PR; answers interview questions on your behalf; scaffolds `openspec/` into a repo that doesn't have it; recycles an archived proposal as a fresh plan.

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
- "Autopilot" only releases the plan-confirmation stop — the interview still pauses (a dialogue can't be answered on your behalf), the PR question still gets asked, and no branch gets created. When the scope of "automatic" is ambiguous, it reads it narrowly.
- The fast lane skips writing the change to disk but still runs the reflection, the commit, and the PR question; if the tweak turns out non-trivial mid-way (testable logic, multiple files, well past a few lines), it immediately returns to the interview and runs the full loop.
