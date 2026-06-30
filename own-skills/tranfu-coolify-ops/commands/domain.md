# Domain (urls) 操作速查

术语见 SKILL.md ## 心智模型 (Coolify Service Resource / sub-application / compose service)。

## 输入 / 输出 / 完成标准

输入: $COOLIFY_BASE_URL (不带末尾斜杠) / $COOLIFY_API_TOKEN (write 权限) / $COOLIFY_APP_UUID / $EXPECTED_NAME / $EXPECTED_URL
输出: 已校验同步的 sub-application.fqdn
完成 = PATCH 返 200 且 GET /services/$COOLIFY_APP_UUID 复核 .applications[].fqdn == $EXPECTED_URL

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
  "$COOLIFY_BASE_URL/api/v1/services/$COOLIFY_APP_UUID" \
  | jq --arg name "$EXPECTED_NAME" --arg url "$EXPECTED_URL" '
    .applications[] | select(.name == $name) |
    if .fqdn == $url then "✓ 已是期望域名"
    elif (.fqdn // "") | contains("sslip.io") then "✗ 还是 sslip.io fallback"
    else "✗ 不一致: 当前=" + (.fqdn // "null") + " 期望=" + $url
    end'
```

`jq` 输出首字符 `==` ✓ → check 通过, 跳过 act; 否则非零退出并打印当前 fqdn, 进 act。

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
  "$COOLIFY_BASE_URL/api/v1/services/$COOLIFY_APP_UUID"
```

返回 200 + `{uuid, domains}`。**立刻** GET 一次校验 sub-application.fqdn 真变了：

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_BASE_URL/api/v1/services/$COOLIFY_APP_UUID" \
  | jq '.applications[] | {name, fqdn}'
```

`HTTP=200` 且 GET 复核 `.applications[].fqdn == $EXPECTED_URL` → DONE。

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
  "$COOLIFY_BASE_URL/api/v1/services/$COOLIFY_APP_UUID"
```

**注意**：`urls` 数组是**全量替换**而非 merge。如果你只发一条，其它 sub-application 的域名不会被清，但**也不会被同步更新**（保持原值）。

**MUST** 在 reconcile Step 5 act 中一次发齐全部期望 urls; **NEVER** 只 PATCH 单条 urls 用于多 sub-app 场景, 否则会造成静默半更新。

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

**NEVER** set `force_domain_override=true` before GET-verifying the conflicting owner; **MUST** 先 GET 冲突资源确认归属, 再决定替换或换名, unless GET 已确认且用户授权强制覆盖。如果确认替换，body 加 `"force_domain_override": true`。

## 不要做的事

- **不要在 compose env 里写 `SERVICE_FQDN_*: 'https://x.tranfu.com'`** —— 看 [service-fqdn-trap.md](../references/service-fqdn-trap.md)，那是 output 不是 input。compose 里 SERVICE_FQDN_* 永远写 `''`。
- **不要 PATCH `/api/v1/applications/<sub-app-uuid>`** —— 404，sub-application 不在那个 namespace。
- **不要试图 PATCH `applications[].fqdn` 字段** —— 那是只读派生。
