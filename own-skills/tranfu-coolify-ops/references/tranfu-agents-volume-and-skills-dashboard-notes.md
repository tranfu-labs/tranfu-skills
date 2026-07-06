# tranfu-agents App: tf-data volume vs `/skills` dashboard

Use this when debugging a Tranfu Coolify Application for `tranfu-agents-app` where a Docker volume contains a large `/data/tf.db`, but `https://.../skills` shows only a few rows.

## Key lessons

- A large `tf.db` does **not** imply `/skills` should show many skills. The `/skills` page is backed by `/api/skills?days=<N>` and primarily displays recent usage aggregations (default 30 days), not every raw telemetry row or every catalog/installed skill.
- `/api/skills` can legitimately show a tiny `table`/`daily` result while still returning larger `funnel.catalog`, `funnel.installed`, `funnel.idle`, or `catalog.count` sections.
- Do not assume the volume named like `<app_uuid>_tf-data` is the one currently mounted. Coolify docker-compose Application volume names can be prefixed/expanded, e.g. `<app_uuid>_<app_uuid>-tf-data`, and older deployment attempts may leave similarly named stale volumes.
- The authoritative source for the live DB path is the running container mount list, not a guessed `/var/lib/docker/volumes/...` path.

## Read-only triage flow

1. Identify the running container for the Application UUID or repo name:

```bash
docker ps --format '{{.ID}} {{.Names}} {{.Image}} {{.Status}}' \
  | grep -E '<app_uuid>|tranfu-agents'
```

2. Inspect its actual `/data` mount:

```bash
docker inspect <container_id> --format '{{json .Mounts}}' | jq .
```

3. Compare matching volumes without deleting anything:

```bash
docker volume ls --format '{{.Name}}' | grep '<app_uuid>.*tf-data'
for v in $(docker volume ls --format '{{.Name}}' | grep '<app_uuid>.*tf-data'); do
  docker volume inspect "$v" --format '{{.Name}} {{.Mountpoint}}'
done
```

4. Check what the dashboard API is actually showing:

```bash
curl -sS 'https://<domain>/api/skills?days=30' | jq '{
  days, today,
  daily_rows: (.daily | length),
  table_rows: (.table | length),
  operator_daily_rows: (.operator_daily | length),
  operator_table_rows: (.operator_table | length),
  used_30d: (.funnel.used_30d // [] | map(.name)),
  installed_count: (.funnel.installed // [] | length),
  catalog_count: .catalog.count
}'
```

5. If DB size needs explanation, use schema/size-only SQLite probes; avoid dumping raw telemetry content:

```bash
sqlite3 /path/to/tf.db 'PRAGMA quick_check; PRAGMA page_size; PRAGMA page_count; PRAGMA freelist_count;'
sqlite3 /path/to/tf.db "SELECT name, sum(pgsize) AS bytes, count(*) AS pages FROM dbstat GROUP BY name ORDER BY bytes DESC LIMIT 20;"
sqlite3 /path/to/tf.db "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

## Pitfalls

- Do not conclude “data missing” from `/skills` showing only a few rows until you verify `/api/skills` aggregation windows and the live container mount.
- Do not clean up or remove similarly named volumes during diagnosis. Stale volumes may still be needed for rollback or forensic comparison; destructive volume actions remain outside AI execution under `reversible-ops`.
- Do not read or paste raw telemetry/session rows unless the user explicitly asks and privacy impact is acceptable. Prefer counts, table names, and `dbstat` sizes.
