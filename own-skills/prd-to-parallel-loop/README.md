---
description: "Splits a PRD or milestone doc into several openspec changes, gives each one its own git worktree and codex session, and hands you a start command you can paste to run them in parallel."
prompt_examples:
  - prompt: Break down docs/roadmap/milestone-5-main-conversation.md and set it up to run in parallel.
    scene: Kick off a milestone
  - prompt: Let's ship this PRD. Talk me through how you'd split it into changes first.
    scene: Split a PRD
  - prompt: The changes under openspec/changes are already written — just wire up the parallel runtime.
    scene: Wire up the runtime only
---

# prd-to-parallel-loop

Splits a product doc into N openspec changes, gives each change its own git worktree and codex session, and scaffolds a heartbeat-driven setup that's ready to run.

## When to use it

**Kick off a milestone**:

I have a `docs/roadmap/milestone-N-xxx.md` that already lists the changes, their dependencies, and the acceptance numbers. I want it to turn that list into openspec changes and wire up the parallel runtime — without dragging me back through a discussion I already had.

**Split a PRD**:

All I have is a PRD, and I haven't decided how to carve it up. I want it to lay the acceptance criteria out first and ask, one by one, "where does this actually live — which field, which module?" — then propose a split I can sign off on before anything lands on disk.

**Wire up the runtime only**:

I already wrote the change directories myself. What's missing is everything that makes them run in parallel: the state file, the scheduling instructions, the start command. The changes I wrote should stay untouched.

**Pick up mid-flight**:

A few items in the milestone doc are already checked off. It should recognize those as done, record them in the state file without scheduling them, and only run the rest in parallel.

**Won't take**:

Writing or reviewing the product doc itself → **project-init-docs** and **credibility-review**; a repo with no `openspec/` directory yet → scaffold it with **openspec-driven-development** first; a split that yields a single change → not worth a loop, also **openspec-driven-development**.

## What it produces / what you'll see

**It builds the stage, it doesn't write the feature code** — the actual implementation happens later, in a separate conversation where you run `/loop`, carried out by codex inside each worktree.

- **Change skeletons**: Under `{repo}/openspec/changes/<change-id>/`, copied from the project's own `_template/` and filled in — proposal / design / tasks / spec-delta. Directories that already exist are left alone.
- **Shared tooling**: Three scheduling scripts land in `~/dev-loops/bin/`. If a file of the same name is already there, it's skipped — never overwritten.
- **Runtime state**: Under `~/dev-loops/<project>/<batch>/` it writes `runtime.json` (the single source of truth for dependencies), the scheduling instructions, and the start command. The PRD path also produces a map of where each acceptance criterion lands.
- **One stop by default**: Starting from a PRD, the proposed split is shown to you first and only lands once you say it's right. That stop is skipped only when the milestone list is complete enough to read directly.
- **Never**: Edits your PRD or milestone doc; touches an existing change directory; rewrites git history or product code; overwrites a `runtime.json` that's already running; pushes or merges to a remote.

## Prerequisites & boundaries

**Prerequisites**:

The project root is a git repo and has `openspec/changes/_template/`; the codex CLI is installed; `openspec-driven-development` is installed (codex references its steps inside each worktree); `~/dev-loops/` is writable.

**Neighbor skill split**:

| Action | Hand off to |
|---|---|
| Cold-start scaffolding of `openspec/` | **openspec-driven-development** |
| Only one change to make | **openspec-driven-development** |
| Writing or reviewing PRDs and milestone docs | **project-init-docs** / **credibility-review** |

**Scenarios it declines**:

- Running a one-off codex task with no product doc as the starting point
- Compiling a PRD straight into code, skipping openspec changes entirely
- Updating a batch that's already running — it only scaffolds from scratch, so starting over means clearing the old state directory by hand

**Subtle edges**:

- No change list can be read out of the milestone doc → it doesn't error out; it treats the doc as a PRD, negotiates the split with you, and says so up front
- A change id collides with an existing directory under `openspec/changes/` → it stops and asks whether to reuse or rename, never picks for you
- You say "you decide" during the split discussion → it saves the candidate list as a pending file and stops there instead of writing anything to openspec
- It can't detect the project's verification commands → not a blocker; it leaves a placeholder note for you to fill in later
