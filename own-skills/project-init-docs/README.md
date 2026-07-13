---
prompt_examples:
  - prompt: Init this repo.
    scene: Set up project docs
  - prompt: This legacy project still has no AGENTS.md — pin down the project docs in one pass, grounded in real facts.
    scene: Document existing code
  - prompt: Init the project docs and pin down the structure, commands, and business domains in one go.
    scene: Prepare for AI work
  - prompt: Add wireframes to this project, one clear layout per page.
    scene: Add page wireframes
  - prompt: Set up a DEPLOY.md that spells out where we deploy, how we build, and how to roll back.
    scene: Record deployment sources
---

[English](./README.md) | [中文](./README.zh.md)

# Project Documentation Init

When you say "init" at a repo root, this skill probes real facts and lays down the AI-collaboration baseline in one pass — `AGENTS.md` / `DEPLOY.md` / `spec.md` / wireframes, all aligned to the same contract.

## When to use it

**Standard init**:

I'm at the root of a repo that already runs, and I say "init" — I want the skill to scan the real stack and directory layout and lay down the AI-collaboration baseline in one pass, not copy a blank template over.

**Backfilling existing code**:

The code is there but the docs never caught up — no `AGENTS.md`, no `module-map.md`, no `DEPLOY.md`. I want the skill to backfill everything from real facts: commands lifted from actual scripts, modules from actual directories.

**Prepare for AI work**:

I want any future AI to be productive the moment it clones the repo — `AGENTS.md` for the do-not-touch list, `DEPLOY.md` for how to ship, `module-map.md` for dependencies, `openspec/` and `docs/wireframes/` for the contract and layout facts.

**Explicit ask**:

I name a specific piece — "set up the `AGENTS.md` hierarchy / add a `DEPLOY.md` / lay down wireframes" — and I want the skill to apply the same skeleton, aligning the requested piece together with its related sections.

**Not this skill**:

Running scaffolding commands like `npm init` / `create-react-app` — unrelated to this skill; writing a single `README` or contribution guide — plain editing; tweaking one section of `AGENTS.md` — plain editing; tagging / version bumps — **release**; day-to-day coding loop — **openspec-driven-development**.

## What it produces / What you'll see

**By default a preflight summary comes first — nothing gets written until you confirm; every per-directory instruction file is `AGENTS.md` + `CLAUDE.md`, never `README`** — those are the two most counterintuitive rules.

- **Probe the repo**: scan `package.json` / `Dockerfile` / CI workflows / routes and extract real commands, modules, business domains, deployment shape, and page inventory; surface the planned file list for you to confirm
- **Write out the skeleton**: run `scripts/fill.sh` to lay down the static skeleton (per-directory `CLAUDE.md` pointers, `changes/AGENTS.md` + `_template/`, `adr/AGENTS.md` + ADR 0000, `docs/wireframes/` skeleton) plus fact-file stubs (section headings + `TODO`)
- **Fill in the facts**: populate root `AGENTS.md`, `DEPLOY.md`, `module-map.md`, every `spec.md`, `page.md`, `flow.md` from what was actually detected; anything unprobeable stays as `TODO: needs human confirmation`
- **Wireframes laid down by default**: the `docs/wireframes/` skeleton + `flow.md` are always generated; if routes exist, `--pages` appends `pages/<page>.md`; whether to keep them is left to the deletion rule in root `AGENTS.md`
- **Safe to rerun**: existing files are read first; the skill only fills missing sections or reports diffs, and any overwrite requires your confirmation
- **Never does**: run scaffolding commands (`npm init` / `create-react-app` / `cargo new`); write real secret values into `DEPLOY.md`; invent commands or dependencies it couldn't detect; use `README` as a directory guide

## Prerequisites & boundaries

**Prerequisites**:

A cloned repo root with `bash` available to run `scripts/probe.sh` and `scripts/fill.sh`; projects with routes also need `python3` (wireframe column widths are measured with `east_asian_width`, never `awk length` or `wc -L`).

**Adjacent skills**:

| Action | Skill |
|---|---|
| Day-to-day dev loop (plan → branch → change → archive) | **openspec-driven-development** |
| Tagging / changelog / version bumps | **release** |
| Reviewing or refining a prompt / SKILL.md | **prompt-review** |

**Out of scope**:

- Scaffolding commands (`git init` / `npm init` / `create-react-app` / `cargo new`)
- Creating a single doc ("write a `README`" / "write a contribution guide")
- Localized edits to an existing `AGENTS.md` (that's plain editing)
- Writing business code / fixing bugs

**Subtle boundaries**:

- Saying "init" at a repo root → triggers; saying "init" outside a repo → doesn't
- "Set up the `AGENTS.md` hierarchy / add a `DEPLOY.md` / lay down wireframes" → triggers (still part of the baseline); "edit the deploy section of `AGENTS.md`" → doesn't (localized edit)
- Headless tools / libraries → the `docs/wireframes/` skeleton is still laid down and the deletion rule preserved; init won't decide for you whether the project has a UI
