---
description: "Scans an existing GitHub repo, produces a P0-P3 missing-item checklist, then walks you through each gap one at a time — you approve before it writes anything."
prompt_examples:
  - prompt: Check what this project is missing before I open source it.
    scene: Prepare for open source
  - prompt: Scan the repo for completeness and give me a P0-P3 checklist first.
    scene: Audit the repository
  - prompt: This repo has no CI or issue templates — add them.
    scene: Add CI templates
---

# GitHub Repo Completeness

Scans an existing GitHub repo, produces a P0-P3 missing-item checklist, then walks you through each gap one at a time — you approve before it writes anything.

## When to use it

**Prepare for open source**:

I'm getting the repo ready for GitHub or open source. I want the skill to scan first, hand me a checklist, and let me pick what to fix.

**Fill specific gaps**:

I already know something's missing — README / LICENSE / CI / issue templates — and I want the skill to walk me through the stack-appropriate fix.

**Periodic health check**:

The project has been running for a while. I want a quick audit to see if the structure is still complete or has drifted to WEAK.

**Check multiple repositories**:

I'm short on time. I say "all defaults", the skill runs the whole set, and I review at the end.

**Not for**:

Drafting a PRD from scratch → **write-spec**; cold-starting a new project's full doc set → **project-init-docs**; tagging / releasing → **release**; deploying → **coolify-deploy**; scaffolding an empty project skeleton → generic scaffolding skills.

## What it produces

**Guides you item by item — never writes everything in one shot unless you explicitly say "all defaults"** — the most counter-intuitive point.

- **P0-P3 checklist table**: four columns = priority / item / status (OK / WEAK / MISSING / N/A) / note
- **Guided fills**: each item asks your preference first (which license / how deep the CI / which issue templates) before generating
- **Files touched**: may add `README.md` / `LICENSE` / `.gitignore` / `CONTRIBUTING.md` / `CHANGELOG.md` / `.github/workflows/ci.yml` / `.github/ISSUE_TEMPLATE/*.yml` / `.github/pull_request_template.md`
- **Final rescan**: re-runs the scan to confirm the items you picked moved from MISSING / WEAK to OK, then hands you a summary for sign-off
- **Never does**: pick a license for you / tag a release / push to remote / write all missing files without approval

## Prerequisites & boundaries

**Prereq**:

cwd must be the git repo root (`git rev-parse --show-toplevel` returns and matches pwd); outside a repo it stops and asks.

**Adjacent skill split**:

| Action | Goes to |
|---|---|
| Draft a PRD / requirements doc | **write-spec** |
| Cold-start a full doc set for a new project | **project-init-docs** |
| Tag / changelog / release | **release** |
| Deploy | **coolify-deploy** |
| Publish a skill to the company library | **tranfu-publish** |

**Not for**:

- Writing code / fixing bugs / code review
- Scaffolding an empty project skeleton (use scaffolding skills)
- Editing GitHub remote metadata (description / topics)

**Subtle edges**:

- Single-stack repos work best; for monorepo or mixed stacks the skill asks you to name the primary stack rather than guess
- License is always "ask you, never pick" — if you want it fast, say "just use MIT" upfront rather than expecting a default
