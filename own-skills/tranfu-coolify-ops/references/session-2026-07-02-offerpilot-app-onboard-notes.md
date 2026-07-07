# Session notes: offerpilot-app Application onboarding (2026-07-02)

Context: `tranfu-labs/offerpilot-app` was onboarded to Coolify 0.8 Application + GitHub App + dockercompose. The same-name Coolify project already existed but had no Application and no legacy Service, so initialization reused the project.

## Durable lessons

- Current Tranfu Coolify rejects `docker_compose_location: "compose.yml"` on `POST /api/v1/applications/private-github-app` with `422 docker compose location field format is invalid`; send `"/compose.yml"` in the API body. The repo file remains `compose.yml`.
- Immediately after creating the Application, `GET /api/v1/applications/{uuid}` may report `status=exited:unhealthy`, `project_uuid=null`, `github_app_uuid=null`, and `is_auto_deploy_enabled=null` before the first successful GHA-driven deploy. Do not treat this alone as create failure. Validate with stronger anchors: UUID returned by POST, `git_repository`, `git_branch`, `build_pack=dockercompose`, `docker_compose_location`, successful GHA deploy, final status, and public HTTP.
- `docker_compose_domains` may be returned as a JSON string object such as `{"web":{"domain":"https://offerpilot-app.tranfu.com:8080"}}`, not an array. Step 10 URL derivation should parse both object and array shapes, strip the internal port, and prefer this field over top-level `fqdn`.
- During deployment transition, public URL may briefly return `503` and Application status may remain `exited:unhealthy`; keep polling until either timeout or status becomes `running:healthy` with public `2xx/3xx`.
- The Step 8 log grep for `missing|undefined|not set` can match the workflow source lines (`missing=()`, checks for empty vars) or action epilogues like `State not set` even when the run succeeded. Treat these as suspicious context, not automatic failure; fail only when there is an actual error/missing configuration message or non-success conclusion.
- Subagent-generated workflow files must be re-read before commit. Specifically verify authorization headers still contain `$TOKEN` (not a masked literal or malformed quote) and that the IMAGE_REF PATCH step does not use `--fail-with-body` before the 404 fallback handling.

## Verification observed

- `npm run typecheck`, `npm run build`, and `docker compose config` passed locally.
- GHA deploy run succeeded and wrote `IMAGE_REF=ghcr.io/tranfu-labs/offerpilot-app:sha-<commit>` before POSTing Coolify deploy.
- Final observed state: Application `running:healthy`; `https://offerpilot-app.tranfu.com` returned HTTP 200.
