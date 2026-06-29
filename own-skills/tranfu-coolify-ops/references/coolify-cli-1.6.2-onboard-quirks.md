> ⚠️ **ad-hoc 速查**: 本文件是 CLI ad-hoc 速查（排障 / 临时操作用），reconcile flow 主链路不依赖；命令需要时手动跑。reconcile 主链路全走 HTTP API，见 [../scenarios/reconcile-deployment.md](../scenarios/reconcile-deployment.md) 和 [coolify-api-fields.md](coolify-api-fields.md)。

# Coolify CLI 1.6.2 onboard quirks observed in tranfu ops

Session: onboard `tranfu-labs/alphaos-app` to `local-coolify`.

These are durable CLI/API behavior notes for future onboard runs; do not copy token values into this file.

## Prefer direct shell commands for this workflow

The user explicitly objected when the flow switched to ad-hoc Python wrappers for simple Coolify/JQ parsing. For this class of work, keep the workflow legible by running direct `coolify ... | jq ...` shell commands. Use Python/execute_code only when a direct command cannot reasonably do the job, and say why before doing it.

## Select the tranfu-labs GitHub App, not “the only GitHub App”

A context may contain both a generic `Public GitHub` entry (`organization: null`, often `id: 0`) and the real tranfu-labs GitHub App. Do not abort merely because `coolify github list` length is greater than 1. Filter by organization and require exactly one `organization == "tranfu-labs"` candidate:

```bash
GH_JSON=$(coolify github list --context="$CONTEXT" --format json)
GITHUB_APP_ID=$(printf '%s' "$GH_JSON" \
  | jq -r '.[] | select(.organization == "tranfu-labs") | .id' | head -n1)
GITHUB_APP_UUID=$(printf '%s' "$GH_JSON" \
  | jq -r '.[] | select(.organization == "tranfu-labs") | .uuid' | head -n1)
```

If that filtered set is 0 or greater than 1, stop and list only those candidates for the user. Ignore `Public GitHub` for tranfu-labs private repo onboarding.

## `coolify github repos` may require numeric `id`, not UUID

With Coolify CLI `1.6.2`, `coolify github list --format json` returns both:

```json
{"id": 3, "uuid": "d14i0x7lt7dxnhc890w8u75j", "organization": "tranfu-labs"}
```

Although `coolify github repos --help` says `<app_uuid>`, passing the UUID produced a Coolify 500:

```text
invalid input syntax for type bigint: "d14i0x7lt7dxnhc890w8u75j"
SQL: select * from "github_apps" where "id" = d14i0x7lt7dxnhc890w8u75j
```

Passing the numeric `id` worked for repository visibility checks:

```bash
coolify github repos --context="$CONTEXT" "$GITHUB_APP_ID" --format json \
  | jq -e --arg fullname "tranfu-labs/$REPO" '.[] | select(.full_name == $fullname)' > /dev/null
```

Still use `GITHUB_APP_UUID` for `coolify app create github --github-app-uuid`.

## `app create github` requires an environment on current CLI

Current CLI rejects create without an environment:

```text
Error: either --environment-name or --environment-uuid must be provided
```

Use the team default unless the user specifies otherwise:

```bash
--environment-name production
```

## Deployment list field name is `deployment_uuid`

`coolify app deployments list --format json` may return `deployment_uuid` rather than `uuid`. Extract with fallback:

```bash
DEPLOYMENT_UUID=$(coolify app deployments list --context="$CONTEXT" "$APP_UUID" --format json \
  | jq -r 'sort_by(.created_at // .id) | last | (.deployment_uuid // .uuid)')
```

## App names may be decorated; match by git repository too

`coolify app list` names can look like `repo:main-<uuid>`, not just `repo`. For same-app checks and post-create lookup, match both repository and decorated name:

```bash
coolify app list --context="$CONTEXT" --format json \
  | jq -r --arg repo "tranfu-labs/$REPO" --arg name "$REPO" \
      '.[] | select(.git_repository == $repo or .name == $name or (.name | startswith($name + ":"))) | .uuid'
```

## Docker compose location fallback via API

The CLI still has no `--docker-compose-location` flag. Some creates defaulted to `/docker-compose.yaml`; if deployment fails with:

```text
Deployment failed: Docker Compose file not found at: /docker-compose.yaml
```

and the repo uses `/docker-compose.yml`, patch the app through the Coolify API, then redeploy:

```bash
CONFIG="$HOME/.hermes/profiles/ops/home/.config/coolify/config.json"
TOKEN=$(jq -r '.instances[] | select(.name=="local-coolify") | .token' "$CONFIG")
BASE=$(jq -r '.instances[] | select(.name=="local-coolify") | .fqdn' "$CONFIG")

curl -sS -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  --data '{"docker_compose_location":"/docker-compose.yml"}' \
  "$BASE/api/v1/applications/$APP_UUID"

coolify app start --context="$CONTEXT" "$APP_UUID" --instant-deploy
```

Never print the token. If using another context, derive `TOKEN`/`BASE` from that context name, not hard-coded `local-coolify`.
