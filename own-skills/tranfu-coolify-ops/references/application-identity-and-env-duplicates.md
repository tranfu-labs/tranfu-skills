# Application identity + duplicate env pitfalls

Session note distilled from AgentReach ↔ AlphaOS interop setup (2026-07-01). Use this when an Application exists but Step 1/resource selection or env updates are ambiguous.

## 1. Do not identify an Application by `git_repository` alone

Coolify can contain multiple Application records bound to the same `git_repository` and `git_branch` during migrations or failed onboards. Example pattern:

- one Application is the live public service (`running:healthy`, has the production domain in `docker_compose_domains`)
- another older duplicate has the same `name` and `git_repository` but is `exited:unhealthy` or has no domain

Before any env write or deploy trigger, resolve the target Application using all available anchors:

1. user-provided public domain / expected domain in `docker_compose_domains`
2. known Application UUID from the current session (strongest if already verified)
3. status (`running:healthy` beats stale `exited:unhealthy` duplicates)
4. `git_repository` + `git_branch`
5. project/environment path from deployment URLs or UI URLs, when available

If two candidates remain, stop and ask/inspect more. Never write secrets to the first match from `git_repository` alone.

## 2. `project_uuid` may be null in application list/get output

Some Application API responses can return `project_uuid: null` even when deployment URLs clearly show a project/environment path. In that case, the Step 1 `name + project_uuid` filter may miss the real Application.

Fallback read-only reconciliation:

- list Applications and filter by `git_repository`
- inspect each candidate with `GET /api/v1/applications/{uuid}`
- compare `docker_compose_domains`, `ports_exposes`, `status`, `created_at/updated_at`, and recent deployment URL paths
- choose the candidate whose domain/status matches the user-facing service

## 3. Duplicate env keys are possible

The Application env endpoint may show duplicate rows for the same key. In one observed case AlphaOS env keys each appeared twice with empty values. Treat this as an unsafe overwrite/delete situation outside bootstrap:

- It is OK to list key names, counts, UUIDs, and value hashes/shapes.
- Do not print values.
- Do not assume `PATCH {key,value}` will normalize all duplicates.
- Do not delete duplicate env rows automatically outside bootstrap; deletion loses whatever historical value existed.
- For existing empty/duplicate secrets outside bootstrap, provide a manual `PATCH`/UI instruction and explain that reversible-ops blocks automatic overwrite.

## 4. Secret-generating interop flows

For inter-service setup where AgentReach generates app IDs/API keys/webhook secrets for another service:

- Generate secrets locally with `openssl rand -hex 32` or `secrets.token_hex(32)`.
- Store generated values only in a restricted temp file (`umask 077`, mode `0600`) for the duration of the task.
- Output non-sensitive IDs (e.g. `app_id`, `webhook_id`) and at most a short API-key prefix; never output full API keys/tokens/secrets.
- When shell quoting/redaction makes token-bearing `curl` fragile, use a small Python `urllib.request` script that reads secrets from env/temp files and only prints non-sensitive IDs/status.
