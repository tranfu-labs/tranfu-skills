---
prompt_examples:
  - prompt: Can I run `docker compose down -v` on this stack right now?
    scene: command paste
  - prompt: Clean up the old .log files under /var/log/nginx/ for me.
    scene: casual cleanup
  - prompt: Here's a Python cleanup script — walk it line by line before I run it.
    scene: script review
  - prompt: Take this app off Coolify — `coolify app delete 8f3a-staging-uuid --force`.
    scene: coolify delete
  - prompt: Update DATABASE_URL on service abc-uuid to the new endpoint.
    scene: env change
  - prompt: Run `git reset --hard origin/main` to sync my feature branch.
    scene: git destructive
---

[English](./README.md) | [中文](./README.zh.md)

# reversible-ops

A review-only safety gate for ops commands — I never execute writes for you, I rewrite reversible ones for you to run manually, and I refuse the irreversible outright.

## When to use it

**Command paste**:

I'm about to run something like `rm`, `docker rm`, `git reset --hard`, or `coolify app delete` and I want the skill to judge reversibility before I commit.

**Casual ask**:

I say "clean up these old logs" or "kill those stale images" — I want the skill to translate colloquial intent into concrete, reversible commands.

**Script review**:

I wrote a Python or shell script; before I run it, I want the skill to walk each line through the four ironclad rules and rewrite the risky parts.

**Coolify high-risk**:

I'm touching a Coolify app / database / service — especially delete, env, or private-key — and I want the blacklist plus bootstrap-window rules to backstop me.

**Not for**:

Writing Dockerfile / compose.yml to make a repo deployable → **coolify-deploy**; in-repo code tasks (new feature / refactor) → **openspec-driven-development**; the tranfu team's Coolify business flows (onboard / redeploy) → **tranfu-coolify-ops** (this skill is its safety floor, not a replacement for the workflow itself).

## What it produces

**By default I never execute writes for you** — the most counterintuitive point.

- **Reversible rewrite**: `rm` becomes `mv` into `/tmp/trash-<timestamp>/`; overwriting `.env` gets a `cp` backup first — commands are pasted for you to copy and run
- **Irreversible refusal**: four-block output (original command / reason it can't be undone / reversible alternative / if you insist, run it in your own terminal)
- **Receipt table**: after each write, an "old location → new location" line plus a matching restore command, one row per operation
- **Six exception categories** I may execute directly: CI/CD rerun, single-app env add, tfs maintenance, resource create, symmetric start/stop, bootstrap-window PATCH — each behind strict preconditions
- **Blacklist hard-refuse**: Coolify instance / persistent volume / integration root, raw DELETE REST endpoints, dangerous flags (`--force` / `--yes` / `--delete-volumes`) — no window and no user authorization opens these
- **Will never**: run blacklisted commands, add `--force` / `--yes` type flags on its own, or paste sensitive values (env-get output, `.env` contents, keys) back into the chat

## Prerequisites & boundaries

**Prerequisites**:

Local bash / Docker / Coolify environments. Coolify commands rely on `coolify-cli-llm.txt` being present — without it, unknown-command refusal kicks in and I won't guess command names.

**Adjacent skills**:

| Scenario | Skill |
|---|---|
| Writing Dockerfile / compose.yml so a repo can deploy to Coolify | **coolify-deploy** |
| In-repo code tasks (new feature / bugfix / refactor) | **openspec-driven-development** |
| tranfu team Coolify business flows (onboard / redeploy) | **tranfu-coolify-ops** (this skill is its safety floor) |

**Not for**:

- Pure read-only commands (`ls`, `cat` of non-sensitive files, `docker ps`, `docker inspect`, `coolify list`) — allowed by default, no need to route through this skill
- Project docs, SEO, chart, or design work
- Documentation lookups (just answer directly)

**Subtle edges**:

- Deleting a Coolify project / environment / team — CLI intentionally doesn't expose it (cascades through every app / database / service); I route you to the UI and warn about the blast radius
- Bootstrap-window PATCH gets a pass (resource has never deployed successfully); once the window closes, PATCH falls back to review-only, no downgrade
- User authorization ("I approve" / "I'll take the blame") does not bypass the blacklist — blacklist runs before every other check
- Adding a new env KEY to a single app is allowed in any window; overwriting an existing KEY is allowed only inside the app's bootstrap window
- Reading `.env` or `coolify env get <SECRET>` for values is a hard refuse — copy it yourself, don't paste it back
