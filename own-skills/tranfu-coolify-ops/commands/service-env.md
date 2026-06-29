# Service Env 操作速查

reconcile Step 6 用。Env 维度可独立增删改查，**不需要重 PATCH 整个 compose**。

公共环境变量（同 service-crud.md）：

```bash
BASE="http://120.77.223.183:8000"
SERVICE_UUID="<service-uuid>"
```

## 列出现有 envs（reconcile Step 6 check）

```bash
curl -sS \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID/envs" \
  | jq '[.[] | {uuid, key, value, is_literal}]'
```

返回数组，每条含 `uuid`（env 的）+ `key` + `value` + 几个 flag。

**注意**：`value` 在响应里**是明文**（除非 `is_shown_once: true`）——agent 看到也不要 echo / 不要写日志。

## 对比仓库 .env 与 Coolify 现状（reconcile Step 6 check）

```bash
REMOTE_KEYS=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID/envs" | jq -r '.[].key' | sort)

LOCAL_KEYS=$(grep -v '^\s*#' .env | grep '=' | cut -d= -f1 | sort)

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
    "$BASE/api/v1/services/$SERVICE_UUID/envs" \
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
  "$BASE/api/v1/services/$SERVICE_UUID/envs"
```

**`is_literal: true` 是默认推荐**——不让 Coolify 对 `$` `#` 等做 shell 转义，避免密码含特殊字符时被吞。

返回 `{uuid: <env-uuid>}`。

## 改一个 env 的值

```bash
ENV_UUID="<env-uuid>"   # 从 list 拿

curl -sS -X PATCH \
  -w "\nHTTP=%{http_code}\n" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg v "new_value" '{value: $v}')" \
  "$BASE/api/v1/services/$SERVICE_UUID/envs/$ENV_UUID"
```

## 批量改（bulk）

如果一次要改很多，**不要**串行打 PATCH（慢 + 容易半成功），用 bulk endpoint（如果 server 支持）。本 skill 先不用 bulk，串行 N 个足够，因为 reconcile 跑频次不高。

## 删除一个 env

```bash
curl -sS -X DELETE \
  -w "\nHTTP=%{http_code}\n" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID/envs/$ENV_UUID"
```

**reconcile flow 不主动删 Coolify 上多出来的 env**——只补缺、不删多余。多余 env 一般是用户在 UI 上手动加的（debug / 临时关），自动删会扯到用户的临时状态。Step 6 检测到多余 env 时只**告知用户**，由用户决定。

## 关于 `SERVICE_PASSWORD_*` / `SERVICE_FQDN_*` 这类 Coolify 魔法变量

- **不要往 envs endpoint 写 `SERVICE_PASSWORD_*` 或 `SERVICE_FQDN_*`**——它们是 Coolify 自动生成 / 注入容器的"特殊键"，写进 envs 表反而会被忽略或冲突。
- `SERVICE_PASSWORD_*` 在 compose 里 `${SERVICE_PASSWORD_FOO}` 引用即可，Coolify 自己生成、自己持久化。
- `SERVICE_FQDN_*` 见 [../references/service-fqdn-trap.md](../references/service-fqdn-trap.md)，是 output 不是 input。
- reconcile Step 6 检查时**自动 skip 这些前缀**，不参与 diff。

## 安全纪律

- 任何打印 env 内容的命令都**不直接输出到对话**——用 hash / 长度 / 数量统计代替明文展示。
- 用户给的 `.env` 文件**也不复读**——读完直接打 API，不在对话里 echo 内容。
- Coolify API 返回 env 列表里 `value` 是明文——agent 拿来做 diff，**不展示**。
