# Application Env 操作速查

reconcile Step 6I / 更新分支 C 用。Env 维度可独立增删改查，**不需要重 PATCH 整个 application**。

公共环境变量（同 application-crud.md）：

```bash
BASE="http://120.77.223.183:8000"
APP_UUID="<application-uuid>"
```

## 列出现有 envs（reconcile Step 6 check）

```bash
curl -sS \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/applications/$APP_UUID/envs" \
  | jq '[.[] | {uuid, key, value, is_literal}]'
```

返回数组，每条含 `uuid`（env 的）+ `key` + `value` + 几个 flag。

**注意**：`value` 在响应里**是明文**（除非 `is_shown_once: true`）——agent 看到也不要 echo / 不要写日志。

## 对比仓库 .env 与 Coolify 现状（reconcile Step 6 check）

**必须 grep 过滤 Coolify 魔法变量前缀** (详见本文末尾"关于 Coolify 魔法变量"段), 否则每次都误诊 "Coolify 多了一堆 key"：

```bash
MAGIC_PREFIXES='^(SERVICE_PASSWORD_|SERVICE_PASSWORDWITHSYMBOLS_|SERVICE_REALBASE64_|SERVICE_HEX_|SERVICE_FQDN_)'

REMOTE_KEYS=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/applications/$APP_UUID/envs" \
  | jq -r '.[].key' \
  | grep -vE "$MAGIC_PREFIXES" \
  | sort)

LOCAL_KEYS=$(grep -v '^\s*#' .env | grep '=' | cut -d= -f1 \
  | grep -vE "$MAGIC_PREFIXES" \
  | sort)

echo "缺的 (本地有，Coolify 没):"
comm -23 <(echo "$LOCAL_KEYS") <(echo "$REMOTE_KEYS")
echo "多的 (Coolify 有，本地没):"
comm -13 <(echo "$LOCAL_KEYS") <(echo "$REMOTE_KEYS")
```

值的对比单独做（值不打印到屏幕，用文件 diff 或 hash 对比）：

```bash
# 不打印明文，只显示哪些 key 的值不同
for key in $(comm -12 <(echo "$LOCAL_KEYS") <(echo "$REMOTE_KEYS")); do
  local_val_hash=$(grep "^${key}=" .env | cut -d= -f2- | sha256sum | cut -c1-8)
  remote_val_hash=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    "$BASE/api/v1/applications/$APP_UUID/envs" \
    | jq -r --arg k "$key" '.[] | select(.key==$k) | .value' \
    | sha256sum | cut -c1-8)
  [ "$local_val_hash" != "$remote_val_hash" ] && echo "$key: 不同 (本地 ${local_val_hash} vs Coolify ${remote_val_hash})"
done
```

## 创建一个 env（reconcile Step 6 act：补缺）

```bash
curl -sS -X POST \
  -w "\nHTTP=%{http_code}\n" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg k "MY_KEY" --arg v "my_value" \
    '{key: $k, value: $v, is_literal: true}')" \
  "$BASE/api/v1/applications/$APP_UUID/envs"
```

**`is_literal: true` 是默认推荐**——不让 Coolify 对 `$` `#` 等做 shell 转义，避免密码含特殊字符时被吞。

返回 `{uuid: <env-uuid>}`。

## 改一个 env 的值

PATCH endpoint 接受 `key + value` body (相同 key 即覆盖)：

```bash
curl -sS -X PATCH \
  -w "\nHTTP=%{http_code}\n" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg k "MY_KEY" --arg v "new_value" '{key: $k, value: $v}')" \
  "$BASE/api/v1/applications/$APP_UUID/envs"
```

## 批量改（bulk）

OpenAPI 暴露 `PATCH /api/v1/applications/{uuid}/envs/bulk`, body 是 `{"data": [{key, value, ...}]}`：

```bash
curl -sS -X PATCH \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc '{data: [
    {key: "K1", value: "v1", is_literal: true},
    {key: "K2", value: "v2", is_literal: true}
  ]}')" \
  "$BASE/api/v1/applications/$APP_UUID/envs/bulk"
```

本 skill 默认串行 N 次 POST/PATCH (好定位错), 仅当一次性 >10 条时考虑 bulk。

## 删除一个 env

```bash
ENV_UUID="<env-uuid>"   # 从 list 拿

curl -sS -X DELETE \
  -w "\nHTTP=%{http_code}\n" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/applications/$APP_UUID/envs/$ENV_UUID"
```

**reconcile flow 不主动删 Coolify 上多出来的 env**——只补缺、不删多余。多余 env 一般是用户在 UI 上手动加的（debug / 临时关），自动删会扯到用户的临时状态。Step 6 检测到多余 env 时只**告知用户**，由用户决定。

## 关于 Coolify 魔法变量

**核心规则**: 魔法变量在 compose.yml 里声明 (例如 `SERVICE_PASSWORD_REDIS: ''`), Coolify 部署时自动生成 + 注入容器 env + 自动塞一份到 application envs 表 (UI 可见但不可改)。**reconcile 绝不再往 envs endpoint 重复 POST** — 要么被忽略要么冲突, 还会污染 .env diff。

reconcile Step 6I + 更新分支 C 路径自动 skip 的前缀:

| 前缀 | 用途 | 常见变体 |
|---|---|---|
| `SERVICE_PASSWORD_` | 普通随机密码, 无特殊符号 (数据库 / Redis 密码用) | `_64_` |
| `SERVICE_PASSWORDWITHSYMBOLS_` | 含特殊符号随机密码 (应用层强密码 / OAuth client secret) | `_64_` |
| `SERVICE_REALBASE64_` | Base64 编码随机串 (JWT / session key) | `_64_` |
| `SERVICE_HEX_` | 十六进制随机串 (API token / encryption key) | `_32_` / `_64_` / `_128_` |
| `SERVICE_FQDN_` | output 方向: Coolify → 容器, 注入 service 自己的对外 fqdn | 见 [../references/service-fqdn-trap.md](../references/service-fqdn-trap.md) |

完整 grep regex (上面 5 类前缀完全覆盖, `_32_` / `_64_` / `_128_` 都被前缀包含):

```bash
MAGIC_PREFIXES='^(SERVICE_PASSWORD_|SERVICE_PASSWORDWITHSYMBOLS_|SERVICE_REALBASE64_|SERVICE_HEX_|SERVICE_FQDN_)'
```

同一 `<ID>` 跨 service 引用拿到的是同一个值 (Coolify 按 ID 持久化, 不按 service / application), 应用栈内不会出现"应用持的密码和数据库持的密码对不上"。

## 安全纪律

- 任何打印 env 内容的命令都**不直接输出到对话**——用 hash / 长度 / 数量统计代替明文展示。
- 用户给的 `.env` 文件**也不复读**——读完直接打 API，不在对话里 echo 内容。
- Coolify API 返回 env 列表里 `value` 是明文——agent 拿来做 diff，**不展示**。
