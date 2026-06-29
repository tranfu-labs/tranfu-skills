# Service CRUD 操作速查

reconcile Step 3 / Step 4 用。字段语义详见 [../references/coolify-api-fields.md](../references/coolify-api-fields.md)。

公共环境变量假设：

```bash
BASE="http://120.77.223.183:8000"
# COOLIFY_API_TOKEN 已在 shell env 中（不要在命令字符串里写原文，永远用 $COOLIFY_API_TOKEN）
```

## 列出所有 service

```bash
curl -sS \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services" \
  | jq '[.[] | {uuid, name, service_type, status}]'
```

按 name 找一个（reconcile Step 3）：

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$BASE/api/v1/services" \
  | jq --arg name "<svc-name>" '.[] | select(.name == $name) | .uuid'
```

## 创建 Docker Compose Empty Service

```bash
COMPOSE_B64=$(cat compose.yml | base64 | tr -d '\n')   # macOS base64 默认折行，必须 tr -d '\n'

JSON_BODY=$(jq -nc \
  --arg sb "$COMPOSE_B64" \
  --arg name "<svc-name>" \
  --arg proj "<project-uuid>" \
  --arg srv "<server-uuid>" \
  --arg env "production" \
  --argjson urls '[{"name":"<compose-svc-name>","url":"https://<svc>.tranfu.com:<port>"}]' \
  '{
    name: $name,
    project_uuid: $proj,
    server_uuid: $srv,
    environment_name: $env,
    docker_compose_raw: $sb,
    urls: $urls,
    instant_deploy: false
  }')

curl -sS -X POST \
  -w "\nHTTP=%{http_code}\n" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$JSON_BODY" \
  "$BASE/api/v1/services"
```

返回 `{uuid, domains}`。**立刻** GET 一次拿全量：

```bash
SERVICE_UUID=$(... | jq -r .uuid)
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$BASE/api/v1/services/$SERVICE_UUID" | jq
```

### POST 常见 4xx

- **400 missing required** → 必传字段没给（`server_uuid` / `project_uuid` / `environment_name`）
- **409 domain conflict** → 该域名已被别的资源占用。**不要**直接 `force_domain_override=true`，先 GET 看占用者是谁，确认是要替换还是另起一个 service
- **422 validation** → 字段名错或 shape 错。重点查 `urls` 是不是 `[{name, url}]` 数组（不是对象），`docker_compose_raw` 是不是 base64 单行

## 更新 compose（reconcile Step 4）

```bash
COMPOSE_B64=$(cat compose.yml | base64 | tr -d '\n')

curl -sS -X PATCH \
  -w "\nHTTP=%{http_code}\n" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg sb "$COMPOSE_B64" '{docker_compose_raw: $sb}')" \
  "$BASE/api/v1/services/$SERVICE_UUID"
```

partial update — 只发要改的字段。返回 `{uuid, domains}`。

### 对比 Coolify 上 compose 与本地 compose（reconcile Step 4 check 用）

```bash
REMOTE=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$BASE/api/v1/services/$SERVICE_UUID" \
  | jq -r .docker_compose_raw)
LOCAL=$(cat compose.yml)

diff <(echo "$REMOTE") <(echo "$LOCAL")
```

无 diff → check ✓ 跳过 act。有 diff → 展示给用户后 PATCH。

## 删除 Service（谨慎）

**默认会删 volume，丢数据**。生产用一定显式 `delete_volumes=false`：

```bash
curl -sS -X DELETE \
  -w "\nHTTP=%{http_code}\n" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID?delete_volumes=false&delete_configurations=true&docker_cleanup=true&delete_connected_networks=true"
```

reconcile flow **不调** DELETE。删 service 是人工动作，要走 [coolify-clear-deployments-and-redeploy.md](../references/coolify-clear-deployments-and-redeploy.md) 那类显式确认路径。
