# college-fit-app data bootstrap / no available server notes (2026-07-02)

## Symptom

A deployment can show as successful at both GitHub Actions and Coolify deployment-record level while the public site still returns:

```text
HTTP/2 503
no available server
```

Coolify Application status may oscillate through `restarting:unknown` and settle at `exited:unhealthy`.

## Evidence path

1. Confirm the GHA deploy workflow pushed an immutable image tag and queued Coolify deploy.
2. Check Coolify deployment list/logs for the new deployment UUID; `finished` only proves compose/image startup was attempted, not that the app stayed healthy.
3. Check the Application status.
4. If `coolify app logs <uuid> --lines N` says `Application is not running`, fall back to read-only Docker inspection on the deployment host:

```bash
docker ps -a --filter 'name=<app_uuid>' --format '{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}'
CID=$(docker ps -a --filter 'name=<app_uuid>' --format '{{.ID}}' | head -1)
docker logs --tail 200 "$CID"
```

Note: the Coolify CLI log flag is `--lines` / `-n`, not `--tail`.

## Root cause seen in college-fit-app

The runtime container exited because its entrypoint required a seeded SQLite database or SQL dump, but none was available:

```text
entrypoint: DB missing/empty at /data/collegefit.sqlite (admission_records=0), installing data...
Source not found: /work/dist/collegefit-data.sql.gz
Hint: /work/dist is empty inside the container. Set CF_DATA_DIR to a host directory that Coolify can mount, or set CF_DATA_SQL to a reachable artifact URL.
```

For this class of apps, `no available server` is a downstream symptom: Traefik has no healthy backend because the app container exits before it can serve.

## Fix options

Recommended immediate recovery:

1. Publish or identify a reachable `collegefit-data.sql.gz` artifact URL.
2. Add application env `CF_DATA_SQL=<reachable-url>` without printing the value in chat/logs.
3. Redeploy.
4. Verify:
   - Application status becomes `running:healthy`.
   - `/healthz` returns 200.
   - Public route returns 2xx/3xx.

Alternative fixes:

- Mount a host directory containing `collegefit-data.sql.gz` and set `CF_DATA_SQL=/seed/collegefit-data.sql.gz`.
- Bake the data package into the image, only if image size/build time are acceptable.

## Pitfall

Do not report “deployment succeeded” solely from GHA success or Coolify deployment `finished`. For data-bootstrapping apps, continue until runtime logs and public health checks confirm the container stayed healthy.