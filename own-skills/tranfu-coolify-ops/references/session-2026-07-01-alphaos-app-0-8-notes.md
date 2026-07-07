# Session notes: alphaos-app 0.8 Application onboard / runtime diagnosis (2026-07-01)

Scope: `tranfu-labs/alphaos-app` onboarded to Coolify Application (`private-github-app` + `dockercompose`) with a multi-service compose (postgres + api + web + optional poller). These notes generalize pitfalls for future multi-service Application deploys.

## What worked

- Use the repo name as the single anchor: `REPO_NAME = PROJECT_NAME = APP_NAME = alphaos-app`.
- If the project already exists but has no Application, reuse the empty project and create the Application.
- Current Tranfu Coolify requires `docker_compose_location: "/compose.yml"` in the Application create body; `"compose.yml"` can 422.
- Creating the Application with `is_auto_deploy_enabled=false`, then letting GHA build/push GHCR and POST `/api/v1/deploy?uuid=<app>&force=false`, is valid.
- For a monorepo with Python API + Next web, a single GHCR image can contain both runtimes; compose can run `api` and `web` from the same `${IMAGE_REF}` image with different commands/working dirs.

## GitHub Actions / Coolify API pitfalls observed

- `curl --oauth2-bearer "$COOLIFY_API_TOKEN"` returned 401 against the Coolify API in GitHub Actions. Use the explicit header form instead:
  `-H "Authorization: Bearer $COOLIFY_API_TOKEN"`.
- `PATCH /api/v1/applications/{uuid}/envs` rejected payloads containing unsupported fields such as `is_build_time` with 422. The safe IMAGE_REF payload is only:
  `{key: "IMAGE_REF", value: "ghcr.io/<org>/<repo>:sha-<commit>", is_literal: true}`.
- `gh secret set` only proves a secret name exists / was updated; if the shell variable was wrong or empty, the workflow can still fail. After writing secrets, verify the live token locally with `/api/v1/version` (without printing it), then rerun the workflow if the first run saw empty/invalid secrets.

## Multi-service Application domain pitfall

For dockercompose Applications with multiple services, `docker_compose_domains` determines which sub-service gets Traefik/Caddy labels and therefore which service Coolify effectively exposes/tracks.

- If the desired product surface is the Next web app, bind the public domain to the `web` service and its container port:
  `[{"name":"web","domain":"https://alphaos-app.tranfu.com:3300"}]`.
- Binding only `api` (for example `[{"name":"api","domain":"https://alphaos-api-app.tranfu.com:8000"}]`) exposes the API service and leaves web without external labels. This can make the UI confusing: the deployment may finish and initial healthchecks may pass, while later Application status shows `exited:unhealthy` / restart counters for the tracked API side instead of the intended web surface.
- Keep the API internal unless the user explicitly asks for a public API domain. If both API and web must be public, configure both domains deliberately and verify each sub-service independently.

## Diagnosing `Exited / restarts N` after a finished deployment

A finished deployment does not mean the Application stayed healthy after Coolify's post-deploy observation window.

Read these fields first:

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/applications/$APP_UUID" \
  | jq '{status,restart_count,max_restart_count,last_restart_at,last_restart_type,last_online_at,docker_compose_domains,fqdn}'
```

Then compare with latest deployment:

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/deployments/applications/$APP_UUID" \
  | jq -r '.deployments | sort_by(.created_at) | reverse | .[0] | {status,commit,finished_at,deployment_url}'
```

Interpretation seen in this session:

- Deployment log showed `postgres Healthy`, `api Healthy`, `web Started`, `New container started`, and deployment `finished`.
- Later Application showed `status=exited:unhealthy`, `restart_count=13`, `max_restart_count=10`, `last_restart_type=crash`.
- The deployed containers had already been removed from `docker ps -a`, so direct `docker logs` evidence was unavailable. In that case, rely on Application restart fields + stored `docker_compose` / `docker_compose_domains`, then do a controlled redeploy only after fixing the likely config/code issue.

## Reporting discipline

When asked “why does Coolify still show Exited / restarts N?” distinguish:

1. Deployment record status (build/deploy pipeline finished or failed)
2. Current Application runtime status and restart counters
3. Which compose service is bound to the public domain
4. Whether containers still exist for direct logs
5. The next reversible fix path (usually repo change + commit/push, or bootstrap-safe PATCH with a before snapshot)
