# college-fit-app APP_MODE=auto background bootstrap notes (2026-07-02)

## Context

`tranfu-labs/college-fit-app` moved from a preseeded/full DB expectation to an image that supports lightweight serving while a national DB bootstrap runs in the background.

The important runtime distinction:

- `APP_MODE=static` skips DB bootstrap entirely. The app can be healthy, but `/healthz` reports static mode and no admission record count; national recommendation data will not download/import.
- `APP_MODE=auto` is the desired mode for first-run production recovery when the DB is not already preloaded. The container starts the web app and bootstraps `/data/collegefit.sqlite` in the background.
- Do not set `APP_MODE=full` for first-run bootstrap. Full mode expects the DB to already be present and ready.

## Required Coolify env for auto bootstrap

For the Coolify Application `college-fit-app`, confirm/update these keys before redeploying:

```text
APP_MODE=auto
DB_PATH=/data/collegefit.sqlite
DB_READONLY=1
DB_BOOTSTRAP_MODE=preseed
PORT=3000
```

Do not manually set `CF_DATA_SQL` for the current image lineage unless the repo/operator explicitly asks. The image's `scripts/install-data.sh` defaults to:

```text
https://github.com/tranfu-labs/college-fit-data-public/releases/download/data-20260703/collegefit-data.sql.gz
```

## Expected logs after redeploy

Healthy auto-bootstrap startup should show logs similar to:

```text
entrypoint: APP_MODE=auto, starting national DB bootstrap in background
entrypoint: background DB bootstrap writing /data/collegefit.sqlite.bootstrap
↓ downloading https://github.com/tranfu-labs/college-fit-data-public/releases/download/data-20260703/collegefit-data.sql.gz
✓ sha256 verified
→ applying schema to /data/collegefit.sqlite.bootstrap
→ loading data
✓ loaded. row counts:
admission_records=2343644
entrypoint: background DB bootstrap ready at /data/collegefit.sqlite
```

During download/import, `/gaokao` should continue opening normally and `/api/recommend` may temporarily return `data_initializing`. After import completes, `/api/recommend` should begin returning national recommendation results.

## Operational pitfall

If the app is healthy but not downloading/importing data, check for stale `APP_MODE=static` in Coolify env first. This can happen after earlier lightweight web deployments and will override compose defaults.

If `coolify app logs` fails because the Application is not running/restarting, use narrow Docker read-only inspection as a fallback:

```bash
docker ps -a --filter 'name=<app_uuid>' --format '{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}'
docker logs --tail 220 <container_id>
```

This exposed the earlier failure mode where the container repeatedly exited because `/data/collegefit.sqlite` was empty and `/work/dist/collegefit-data.sql.gz` was missing.
