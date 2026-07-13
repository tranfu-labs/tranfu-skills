---
prompt_examples:
  - prompt: Push this project to the GitHub main branch.
    scene: Prepare a delivery
  - prompt: This is the product's first commit — create the repo, complete the README, push to main.
    scene: Create a repository
  - prompt: We already have a repo; complete the README deployment section, verify locally, then push.
    scene: Update a repository
  - prompt: Check whether this project can install, build, start, and be verified.
    scene: Check before delivery
  - prompt: Prepare this project so engineers can deploy it directly — spell out the deployment config.
    scene: Hand off to engineers
---

[English](./README.md) | [中文](./README.zh.md)

# GitHub Delivery Check

Turns a product project into a deployable, hand-offable, trackable GitHub delivery — the skill classifies the project, completes the README deployment section, verifies locally, and pushes straight to main by default.

## When to use it

**Prepare a delivery**:

The product code is largely finished and I want the skill to push it straight to the GitHub main branch instead of opening a PR to merge later.

**Create a repository**:

This product is landing on GitHub for the first time. I want the skill to create the repo, name it under the tranfu convention (lowercase + hyphens + `-app`), derive the production URL, complete the README, and push to main.

**Update a repository**:

There's already a GitHub remote. I just want the skill to align the README deployment section, run local verification, and push the latest changes to main.

**Check before delivery**:

I want it to run real commands to prove the project can install, build, start, and be exercised (Node install + build/test, Web serve + HTTP hit, Docker build/compose) — not static inspection only.

**Hand off to engineers**:

An engineer is going to deploy this. I want the skill to emit a GitHub Delivery Card that lists env-var field names and target locations clearly, while real secret values move through a private channel.

**Not this skill**: ordinary code changes → normal coding workflow; code review → `review`; production deployment not tied to GitHub delivery → `deploy`; tagging / version bumps → `release`; explicit "discuss only / don't push" → the skill reports without touching Git.

## What it produces

**Pushes straight to main by default; does not open a PR by default** — the most counterintuitive part. A PR is used only when branch protection or permissions block a direct push, the repo isn't directly maintained by the team, or the user explicitly asks for one.

- **Project-type classification**: frontend / backend / full-stack / Docker / static site / server deployment — inspect files first, ask the user second, never the other way around.
- **First-push product metadata**: Chinese name, English name, summary, repo name (lowercase-hyphen + `-app`), production URL (`https://{repo}.tranfu.com/`), GitHub owner — all required before pushing.
- **Pre-push secret scan**: tracked files, staged files, and hidden files (excluding `.git`, dependency directories, and build output); a secret already in Git history is called `暂不建议推送` and stops.
- **README deployment gate**: install, run locally, build, env vars, port, deploy, production URL, health check — any missing piece is completed before pushing.
- **Real local verification**: Node runs build/test/lint, Web hits HTTP 200, API hits the health endpoint, Docker runs build/compose — failures are fixed and re-run; nothing runnable means verdict `未推送: 需先修复`.
- **GitHub Delivery Card**: the conclusion is exactly one of `已推送完成` / `未推送: 待 GitHub 授权` / `未推送: 需先修复` / `暂不建议推送`; the card lists env-var names + target location and says real values are "provided privately."
- **Never does**: claim a GitHub push equals production; invent auth codes / repo URLs / production URLs; commit `.env` / private keys / DB files / dependency dirs / build caches; open a PR to replace a direct push without permission.

## Prerequisites & boundaries

**Prerequisites**:

The target directory is readable and `git` is available; pushing to GitHub requires `gh` CLI or an equivalent authenticated GitHub tool (`gh auth status`); local verification requires the matching runtime (Node / Docker / Python, etc.) to be available locally.

**Adjacent skills**:

| Situation | Skill |
|---|---|
| Turn current changes into a reviewed PR | `github:yeet` |
| Full release + changelog + version bump | `ship` / `release` |
| Cold-start `AGENTS.md` + `openspec/` scaffolding | `project-init-docs` |

**Subtle boundaries**:

- Real secrets may live in a local uncommitted `.env` or in server environment variables; they must not appear in GitHub, README, `.env.example`, screenshots, or the final reply.
- When GitHub authorization is missing, the skill hands the user the real link and one-time code printed by `gh auth login --web` — it never invents them.
- Repo-existence conflict (`owner/repo` exists but may belong to a different project) → stops at `未推送: 需先修复` and asks the user to confirm before pushing.
- "Push to the GitHub main branch" triggers this skill; "merge to main and go live" does not (that is `deploy`); code review before landing does not (that is `review`).
