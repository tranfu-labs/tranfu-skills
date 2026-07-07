# 2026-07-01 markdown-kits-app 0.8 deployment notes

Concise session-derived notes for future `tranfu-coolify-ops` runs.

## Coolify docker_compose_location quirk

On the current Tranfu Coolify instance, creating a private GitHub Application with dockercompose rejected `docker_compose_location: "compose.yml"` with HTTP 422. The accepted value was:

```json
{"docker_compose_location": "/compose.yml"}
```

When creating 0.8 Application resources via HTTP API, prefer `/compose.yml` and verify the returned Application field after creation.

## Domain conflict handling

The original domain `https://markdown-kits-app.tranfu.com:8787` was already owned by a legacy service resource:

- conflict resource type: `service`
- conflict uuid: `ky3fmex4efpt1ooh4mr75cys`

Do not use `force_domain_override=true` automatically. Use a temporary domain for the new Application, finish deployment/health verification, then handle legacy service/domain cutover explicitly through reversible-ops.

## Environment var gap discovered after first deploy

The GitHub workflow and Coolify deploy can both succeed while the container restarts if required runtime env is absent. For `markdown-kits-app`, container logs showed:

```text
Error: LIST_PAGE_PASSWORD must be set in production
```

Fix pattern:

1. Use read-only deployment/container logs to identify the missing env key.
2. Confirm the key is absent by listing env key names only.
3. Add the missing key to the new Application envs with `is_literal: true`; do not print the value.
4. Trigger `POST /api/v1/deploy?uuid=$APP_UUID&force=false`.
5. Verify `running:healthy` and public HTTP 2xx/3xx.

## GitHub variable empty string quirk

`gh variable set IMAGE_TAG_SHA_PREFIX --env main --body ""` returned GitHub API 422 (`object is missing required key: value`). The deployment still succeeded with `COOLIFY_APP_UUID` and `IMAGE_TAG_ROLLING=latest` set. Avoid assuming empty-string GitHub environment variables can be set reliably with `gh variable set --body ""`; omit the var or use workflow defaults unless a non-empty prefix is needed.
