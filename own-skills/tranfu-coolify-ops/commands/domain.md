# Domain (urls) 操作速查

reconcile Step 5 用。心智模型见 [../references/urls-vs-docker-compose-domains.md](../references/urls-vs-docker-compose-domains.md) 和 [../references/service-fqdn-trap.md](../references/service-fqdn-trap.md)。

## tranfu 域名规范

- 形式：`https://<sub-app-name>.tranfu.com:<container-port>`
- `<sub-app-name>` = compose `services.<name>`（命名约束：烤肉串 + 全小写）
- `:<container-port>` = 容器内部端口（Coolify 翻译成 traefik label，公网仍走 443）
- 不带 path（不写 `/api`、`/v2` 之类——多个 path 走多个 sub-application）

## Check：当前域名 vs 期望（reconcile Step 5）

```bash
EXPECTED_NAME="<sub-app-name>"
EXPECTED_URL="https://${EXPECTED_NAME}.tranfu.com:<port>"

curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID" \
  | jq --arg name "$EXPECTED_NAME" --arg url "$EXPECTED_URL" '
    .applications[] | select(.name == $name) |
    if .fqdn == $url then "✓ 已是期望域名"
    elif (.fqdn // "") | contains("sslip.io") then "✗ 还是 sslip.io fallback"
    else "✗ 不一致: 当前=" + (.fqdn // "null") + " 期望=" + $url
    end'
```

输出 `✓` → check 通过，跳过 act。`✗` → 进 act。

## Act：写域名（单 sub-application）

```bash
JSON_BODY=$(jq -nc \
  --arg name "$EXPECTED_NAME" \
  --arg url "$EXPECTED_URL" \
  '{urls: [{name: $name, url: $url}]}')

curl -sS -X PATCH \
  -w "\nHTTP=%{http_code}\n" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$JSON_BODY" \
  "$BASE/api/v1/services/$SERVICE_UUID"
```

返回 200 + `{uuid, domains}`。**立刻** GET 一次校验 sub-application.fqdn 真变了：

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$BASE/api/v1/services/$SERVICE_UUID" \
  | jq '.applications[] | {name, fqdn}'
```

## Act：多 sub-application 一次写（reconcile Step 5 多服务场景）

```bash
JSON_BODY=$(jq -nc '{
  urls: [
    {name: "web",   url: "https://app.tranfu.com:3000"},
    {name: "api",   url: "https://api.tranfu.com:4000"},
    {name: "admin", url: "https://admin.tranfu.com:5000"}
  ]
}')

curl -sS -X PATCH \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$JSON_BODY" \
  "$BASE/api/v1/services/$SERVICE_UUID"
```

**注意**：`urls` 数组是**全量替换**而非 merge。如果你只发一条，其它 sub-application 的域名不会被清，但**也不会被同步更新**（保持原值）。所以 reconcile Step 5 act 时应该**把全部期望域名一起发**，避免半更新。

## 常见 422 错误

| 错误 message | 原因 | 修正 |
|---|---|---|
| `domains: This field is not allowed.` | 字段名错了 | 改用 `urls` |
| `docker_compose_domains: This field is not allowed.` | 用了 Application namespace 的字段 | 同上 |
| `urls.0.url: must be a valid URL` | 域名格式错（少 scheme / 含中文 / 等） | 修域名 |
| 静默 200 但 fqdn 不变 | shape 错（object-keyed 而不是数组） | 改 `[{name, url}]` |

## 域名冲突（409）

```json
{
  "message": "Domain conflicts detected. Use force_domain_override=true to proceed.",
  "conflicts": [
    {"domain": "...", "resource_name": "...", "resource_type": "application"}
  ]
}
```

**不要**直接 `force_domain_override=true`。先 GET 占用者，确认是要替换还是另起一个域名。如果确认替换，body 加 `"force_domain_override": true`。

## 不要做的事

- **不要在 compose env 里写 `SERVICE_FQDN_*: 'https://x.tranfu.com'`** —— 看 [service-fqdn-trap.md](../references/service-fqdn-trap.md)，那是 output 不是 input。compose 里 SERVICE_FQDN_* 永远写 `''`。
- **不要 PATCH `/api/v1/applications/<sub-app-uuid>`** —— 404，sub-application 不在那个 namespace。
- **不要试图 PATCH `applications[].fqdn` 字段** —— 那是只读派生。
