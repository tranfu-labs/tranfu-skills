# Application onboard runtime/env pitfalls

Use this reference when `tranfu-coolify-ops` successfully creates a 0.8 Application and GitHub Actions succeeds, but the public URL is still 5xx or the Coolify Application becomes `exited:unhealthy` / `restarting:unknown`.

## Observed Tranfu Coolify 0.8 pitfalls

### `docker_compose_location` may need `/compose.yml`

On the current Tranfu Coolify instance, `POST /api/v1/applications/private-github-app` can reject `docker_compose_location: "compose.yml"` with HTTP 422. Retry with a leading slash:

```json
{"docker_compose_location":"/compose.yml"}
```

After creation, verify with:

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/applications/$APP_UUID" \
  | jq '{uuid, build_pack, git_repository, git_branch, docker_compose_location}'
```

### Domain conflict with historical Service

If `docker_compose_domains` returns a 409 conflict and the conflicting resource is a historical `service`, do **not** use `force_domain_override=true` during onboard. Prefer creating the new Application on a temporary test domain, validate it becomes `running:healthy`, then plan a separate reversible cutover/old-service cleanup.

### GitHub env var with empty body can 422

`gh variable set IMAGE_TAG_SHA_PREFIX --body ""` may return HTTP 422 (`object is missing required key: value`). If the workflow has defaults and the run succeeds, do not block the deployment solely on this empty optional var. Still verify `COOLIFY_APP_UUID` and `IMAGE_TAG_ROLLING` are set for the target environment.

## Debug path after GHA success but Coolify unhealthy

1. Confirm latest workflow conclusion is `success`.
2. Read Application summary without secrets:

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/applications/$APP_UUID" \
  | jq '{uuid,name,status,fqdn,git_repository,git_branch,build_pack,docker_compose_location}'
```

3. Read latest deployment record/logs:

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/deployments/applications/$APP_UUID" \
  | jq -r '.deployments | sort_by(.created_at) | reverse | .[0] | {deployment_uuid,status,commit,created_at,updated_at}'
```

4. If deploy status is `finished` but Application is unhealthy, inspect the running/restarting container logs. This is read-only and often shows missing runtime envs directly:

```bash
docker ps -a --format '{{.ID}} {{.Names}} {{.Status}} {{.Image}}' \
  | grep "$APP_UUID\|$APP_NAME"

docker logs --tail 200 <container-id>
```

5. If logs show a missing required environment variable, add it to the Application envs endpoint without echoing the value, then redeploy:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg k "$KEY" --arg v "$VALUE" '{key:$k,value:$v,is_literal:true}')" \
  "$BASE/api/v1/applications/$APP_UUID/envs"

curl -sSL --fail-with-body -X POST \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/deploy?uuid=$APP_UUID&force=false"
```

6. Verify both Coolify status and public URL:

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/applications/$APP_UUID" | jq -r .status
curl -k -I --max-time 15 "$PUBLIC_URL"
```

## Reporting

Report:

- GitHub run URL + conclusion
- Application UUID + status
- latest deployment UUID + status + commit
- decisive container/deployment log line
- public URL HTTP status
- rollback command for `COOLIFY_APP_UUID` if a new Application was created
