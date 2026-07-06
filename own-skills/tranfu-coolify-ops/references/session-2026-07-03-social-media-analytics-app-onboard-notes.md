# social-media-analytics-app Coolify onboard notes (2026-07-03)

Session-specific notes from onboarding `tranfu-labs/social-media-analytics-app` to Coolify Application + GHCR.

## Scope

- Repo: `tranfu-labs/social-media-analytics-app`
- App UUID: `fq7tko8db24mm3d5385tuv8p`
- Project UUID: `kkrk91h49r4cyswhsm8gzrx0`
- Domain target: `https://social-media-analytics-app.tranfu.com:3000`
- Main service: `app`, internal port `3000`
- Persistent volume: `social-media-analytics-app-data:/app/data`

## Coolify API quirks hit

1. `docker_compose_location` creation payload must use `"/compose.yml"`, not `"compose.yml"`.
   - `"compose.yml"` returned `422` with `docker_compose_location field format is invalid`.
2. Coolify 4.1.2 may echo `project_uuid=null`, `github_app_uuid` absent/null, `is_auto_deploy_enabled=null`, and `ports_exposes="80"` after Application creation even though the deploy binding works.
   - Do not fail solely on these echo fields.
   - Cross-check `git_repository`, `git_branch`, `build_pack`, `docker_compose_location`, `docker_compose_domains`, deployment logs, and container image.
3. Application env list can contain duplicate keys for preview/non-preview rows.
   - Example: `PUBLIC_BASE_URL` and `REPORT_TIMEZONE` appeared once with `is_preview=false` and once with `is_preview=true`.
   - Do not delete duplicates automatically.
   - For update, prefer bulk PATCH (`/envs/bulk`) or key-level PATCH endpoint documented in `commands/application-env.md`; per-env UUID PATCH may return `404` on this Coolify version.

## Workflow mismatch pitfall

The repo's pushed workflow used older variable names/conditions:

- `vars.COOLIFY_APPLICATION_UUID`
- `secrets.COOLIFY_API_URL`
- `secrets.COOLIFY_WEBHOOK` / `secrets.COOLIFY_TOKEN`

The skill's current setup writes:

- `vars.COOLIFY_APP_UUID`
- `secrets.COOLIFY_BASE_URL`
- `secrets.COOLIFY_API_TOKEN`

Result: GitHub Actions showed success, but `Update Coolify IMAGE_REF` and `Deploy to Coolify` were skipped. Always inspect the actual workflow in GitHub after user says it was pushed; success can mean build-only.

## Runtime failure root cause

Coolify successfully pulled and started:

`ghcr.io/tranfu-labs/social-media-analytics-app:7e3e6244af90081cac755d1f659dcfeeef6a6446`

The container restarted because runtime startup executed `pnpm install`/dependency status checks and failed with:

```text
ERR_PNPM_IGNORED_BUILDS Ignored build scripts: better-sqlite3, esbuild, sharp
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

Fix pattern:

1. Pin package manager in `package.json`:

```json
"packageManager": "pnpm@10.26.1"
```

2. Use `pnpm-workspace.yaml` with `onlyBuiltDependencies`, not the old `allowBuilds` map:

```yaml
packages:
  - .

onlyBuiltDependencies:
  - better-sqlite3
  - esbuild
  - sharp
```

3. Keep any existing `minimumReleaseAgeExclude` entries that are needed by the lockfile/supply-chain policy.

## Ops profile `.env` loader pitfall

Direct shell sourcing of `/home/hermes/.hermes/profiles/ops/.env` can fail if the file contains a malformed bare token line. For scripts that only need env vars, use a safe loader that accepts only `KEY=VALUE` lines and never prints values.

```python
import os, re
from pathlib import Path

for raw in Path('/home/hermes/.hermes/profiles/ops/.env').read_text(errors='ignore').splitlines():
    line = raw.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    key, value = line.split('=', 1)
    key = key.strip().removeprefix('export ').strip()
    if re.match(r'^[A-Za-z_][A-Za-z0-9_]*$', key):
        os.environ.setdefault(key, value.strip().strip('"').strip("'"))
```

## Verification path used

- `gh run watch <run-id> --exit-status` for GHA.
- `GET /api/v1/deployments/applications/<app_uuid>` for deploy logs.
- `docker ps -a --filter name=<app_uuid>` and one-shot `docker logs --tail 200 <container>` when `coolify app logs` returns `Application is not running`.
- `docker inspect <container> --format '{{json .State}}'` for restart/health evidence.
