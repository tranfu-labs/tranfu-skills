---
description: "Deploy, update, or troubleshoot a tranfu-labs app on the company Coolify service until its public URL works."
prompt_examples:
  - prompt: Deploy https://github.com/tranfu-labs/markdown-kits-app to Coolify.
    scene: Deploy for the first time
  - prompt: Redeploy markdown-kits-app.
    scene: Deploy a new version
  - prompt: Move markdown-kits-app domain to board.tranfu.com.
    scene: Change the domain
---

# Tranfu Coolify Deployment

End-to-end deploy / config change / triage for `tranfu-labs/<x>-app` repos on the company Coolify instance — one flow figures out what to do, runs fully autonomously until the public URL responds, never leans on your cwd.

## When to use it

**Deploy for the first time**:

I hand a `tranfu-labs/<x>-app` GitHub URL and want the skill to run the whole path — clone, generate the four-piece kit (Dockerfile / .dockerignore / compose.yml / deploy.yml), create the Coolify project + Application, wire GitHub secrets and env, push the commit, and hold until the public URL returns 2xx.

**Deploy a new version**:

I flipped an env or want a rolling refresh — "redeploy / restart / 重新部署" fires a single Coolify deploy API call, no source reconciliation, no extra edits.

**Domain / env change**:

I want the domain moved to `board.tranfu.com` or a new `DATABASE_URL` env — skill PATCHes the Coolify API directly, env changes auto-trigger a redeploy, and sensitive values never appear in the transcript (key + hash only).

**Deploy source changes**:

I need to touch `compose.yml` or `Dockerfile` — skill spins up a `mktemp -d` clone, spawns a subagent to edit per `references/file-generation-rules.md`, and autonomously commits + pushes without touching my working directory.

**Troubleshoot a deployment**:

I say "the deploy is broken / Coolify is unreachable" — skill refuses to guess, and asks whether to (a) pull a GHA + Coolify status diagnostic, (b) fire a redeploy, or (c) change a specific config.

**Won't take**:

Repos outside `tranfu-labs` / any Coolify instance other than the company one → hard-coded scope, immediate stop. UI-only ops (GitHub App integration install, GHCR credential attach) → one-time ops setup, skill only touches the API. Ordinary feature work unrelated to deployment → use **openspec-driven-development**.

## What it produces / what you'll see

**Once you give the initial instruction the skill runs straight through to public URL 2xx — the GET calls before each write are for post-hoc diff, not for asking permission** — the most counterintuitive part; don't expect a mid-flow stop.

- **API calls**: Coolify HTTP API (`/api/v1/projects` / `/api/v1/applications` / `/api/v1/deploy`) creates resources, patches config, triggers deploys. If the Application already exists, the update branch takes over and only performs the single act the user asked for.
- **Git actions**: temp-dir clone of `tranfu-labs/<x>-app`, subagent edits per `references/file-generation-rules.md`, autonomous `git add / commit / git push -u`, and reports commit sha + diff summary + GitHub link once pushed.
- **GitHub wiring**: `gh secret set` for `COOLIFY_API_TOKEN` / `COOLIFY_BASE_URL`, `gh api PUT` auto-creates the environment (no manual clicking in settings), `gh variable set` writes `COOLIFY_APP_UUID`.
- **Finish gate**: waits for GHA success with no `missing variable` silent fail, a 30-second window to see Coolify enter `deploying`, then a 5-minute poll on the public domain for 2xx / 3xx — 5 minutes is a hard cap, then it hands you a triage entry.
- **Secret discipline**: only the variable name `$COOLIFY_API_TOKEN` ever appears in shell commands; your `.env`, Coolify-returned env values, and any secret you paste stay out of the transcript and out of generated scripts.
- **Never**: attaches GHCR credentials, installs the Coolify GitHub App integration, DELETEs an Application, wipes a volume, touches the legacy `/services` namespace, clones into your cwd, defaults to "redeploy" when intent is unclear, or polls forever.

## Prerequisites & boundaries

**Prerequisites**:

The Coolify instance has the GitHub App integration installed once (organization = `tranfu-labs`), reused across every tranfu-labs project. Local `gh` / `jq` / `curl` available. `COOLIFY_API_TOKEN` and `COOLIFY_BASE_URL` are exported (trailing slash is auto-stripped in three places).

**Hard scope**:

Only `tranfu-labs/<x>-app` repos, single company Coolify instance, single server. `REPO_NAME == PROJECT_NAME == APP_NAME` is a naming invariant — no picking a different name, no creating a project under a different name.

**Adjacent skills**:

| Action | Hand off to |
|---|---|
| Generic Docker / CI bootstrap on a fresh project (non-Coolify) | **coolify-deploy** |
| Version tag / changelog / version-number policy | **release** |
| Destructive DELETE / volume wipe / removing duplicates | **reversible-ops** |
| Ordinary feature work unrelated to deployment | **openspec-driven-development** |

**Won't handle**:

- Repos outside `tranfu-labs`, Coolify instances other than the company one, multi-server scheduling
- UI-only ops (GitHub App integration install, GHCR credential attach, deleting resources through the dashboard)
- Guessing "redeploy" when intent is ambiguous — skill always asks first
- Reconciling source when the Application already exists — the update branch is intentionally lazy

**Subtle edges**:

- Existing 0.8-shape Application (Application + `private-github-app` + `dockercompose`) → update branch, minimum act per user intent
- Existing 0.7 legacy Service in the way → stop and ask the user to DELETE it manually; skill never creates an Application around a leftover service
- Only a Coolify UI URL given → read-only normalization to derive `git_repository`, then re-check the `tranfu-labs/<x>-app` hard scope; legacy-shape Applications are not taken over
- Any "stop / cancel / pause" mid-flow → hard cancel: no more push, no more PATCH, no more deploy triggers, and the boundary between done and not-done is reported
