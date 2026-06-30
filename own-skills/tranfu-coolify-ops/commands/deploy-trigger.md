# 部署触发链路

reconcile Step 7 / Step 8 用。

## 链路总览

```
git push -> GitHub Actions deploy.yml -> docker build -> push GHCR
                                              ↓
                                     curl POST $BASE/api/v1/deploy?uuid=<service-uuid>
                                              ↓
                              Coolify 收到 -> pull 新镜像 -> restart container
```

Coolify 端**关掉 "Auto Deploy on Push / Webhook"**——触发权归 workflow。

## GitHub 端配置（reconcile Step 5I）

### Repo-level secrets

```bash
# strip 尾斜杠防 //api 404
gh secret set COOLIFY_API_TOKEN --body "$COOLIFY_API_TOKEN"
gh secret set COOLIFY_BASE_URL  --body "${BASE%/}"
```

**注意命令字符串里只能引用 `$COOLIFY_API_TOKEN`，不能把 token 原文写进去**——shell 展开发生在执行时，命令字符串本身（agent 写给 Bash tool 的字符串）必须保持 `$VAR` 不变。

校验是否已设：

```bash
gh secret list | grep -E '^COOLIFY_API_TOKEN|^COOLIFY_BASE_URL'
```

### 自动建 environment（gh api 直通 REST API）

`gh` CLI 子命令没有 `create environment`，但 REST API 支持。reconcile Step 5I 用：

```bash
gh api -X PUT "repos/$REPO_ORG/$REPO_NAME/environments/$DEFAULT_BRANCH" >/dev/null
```

- 是 PUT 不是 POST — idempotent，已存在不报错
- 空 body 即可（不需要配 reviewers / wait_timer 之类）
- 需要 token 有 `repo` scope + admin permission（preflight Step 0 check 过）

[GitHub REST API 文档](https://docs.github.com/en/rest/deployments/environments#create-or-update-an-environment)。

### Environment-level vars（每个部署分支一个同名 environment）

默认分支（如 `main`）：

```bash
gh variable set COOLIFY_APP_UUID       --env main --body "<service-uuid>"
gh variable set IMAGE_TAG_ROLLING      --env main --body "latest"
gh variable set IMAGE_TAG_SHA_PREFIX   --env main --body ""
```

多环境（dev）— 也先 `gh api PUT` 建 environment 再 set vars：

```bash
gh api -X PUT "repos/$REPO_ORG/$REPO_NAME/environments/dev" >/dev/null
gh variable set COOLIFY_APP_UUID       --env dev --body "<dev-service-uuid>"
gh variable set IMAGE_TAG_ROLLING      --env dev --body "dev"
gh variable set IMAGE_TAG_SHA_PREFIX   --env dev --body "dev-"
```

校验某分支的 vars 是否齐：

```bash
gh variable list --env main | grep -E '^COOLIFY_APP_UUID|^IMAGE_TAG_'
```

## 手工触发部署

正常通过 push 触发。临时手工触发用：

```bash
# 1. 触发已有 workflow（推荐，走完整 build + push + deploy 链路）
gh workflow run deploy.yml --ref main

# 2. 直接 ping Coolify deploy API（绕过 GHA，用 Coolify 上已有的镜像 tag 重新部署）
curl -sSL --fail-with-body -X POST \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/deploy?uuid=$SERVICE_UUID&force=false"
```

`force=false` 是常态。`force=true` 会强制重启——副作用大，少用（用法：镜像 tag 没变但要强制重 pull）。

## webhook URL 构造

```
${BASE}/api/v1/deploy?uuid=${SERVICE_UUID}&force=false
```

- `BASE`: `http://120.77.223.183:8000`
- `SERVICE_UUID`: reconcile Step 3 拿到的 service uuid
- Auth: `Authorization: Bearer $COOLIFY_API_TOKEN` 必须

写进 deploy.yml.template 的方式：环境变量里读 `COOLIFY_BASE_URL` + `COOLIFY_APP_UUID`，模板里拼字符串。

## reconcile Step 8: 等 GHA 完成 + 验 CI 无错

```bash
# 1. 拿 push 之后那个 run id
RUN_ID=$(gh run list --workflow=deploy.yml --branch "$DEFAULT_BRANCH" --limit 1 \
  --json databaseId --jq '.[0].databaseId')

# 2. 跟到完成 (阻塞直到结束)
gh run watch "$RUN_ID" --exit-status
RUN_EXIT=$?

# 3. 验 conclusion
CONCLUSION=$(gh run view "$RUN_ID" --json conclusion --jq .conclusion)
echo "conclusion: $CONCLUSION"

# 4. 验 log 无 "缺变量" 类 silent fail (CI 跑成功但 secret/var 没设)
LOG_WARN=$(gh run view "$RUN_ID" --log 2>/dev/null \
  | grep -iE "missing|undefined|not set|缺少|未定义|secret.*empty|variable.*empty" \
  | head -10)

if [ -n "$LOG_WARN" ]; then
  echo "⚠ log 命中可疑 silent-fail 行:"
  echo "$LOG_WARN"
fi
```

判定：

| `CONCLUSION` | `LOG_WARN` | 结论 |
|---|---|---|
| `success` | 空 | ✓ 进 Step 9 |
| `success` | 非空 | 终止, 通常 `COOLIFY_APP_UUID` 之类没 set, 让用户去 GH settings 检查 |
| 非 `success` | — | 终止, `gh run view $RUN_ID --log-failed` 排障 |

GHA 红常见根因：测试卡口失败 / docker build 失败 / GHCR auth / Coolify webhook 401。每类的根因和 fix 在 [../references/coolify-compose-deploy-failure-triage.md](../references/coolify-compose-deploy-failure-triage.md)。

## reconcile Step 9: 30s 内验 Coolify 启动部署（fallback 手动触发）

CI 通过后, Coolify 应该在几秒内收到 webhook 并启动部署。给 30s 窗口, 超时 fallback 主动触发：

```bash
T0=$(date +%s)
DEADLINE=$((T0 + 30))
DEPLOYED=0

while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  STATUS=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    "$BASE/api/v1/services/$SERVICE_UUID" | jq -r .status)

  case "$STATUS" in
    deploying|starting|running)
      echo "✓ Coolify 启动部署 (status=$STATUS)"
      DEPLOYED=1
      break ;;
  esac
  sleep 5
done

if [ "$DEPLOYED" = "0" ]; then
  echo "⚠ 30s 内 Coolify 没启动部署 — fallback 主动 POST /api/v1/deploy"
  curl -sSL --fail-with-body -X POST \
    -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    "$BASE/api/v1/deploy?uuid=$SERVICE_UUID&force=false"
fi
```

> fallback 不是再 push 一次——重新 push 触发的是另一个 GHA run，时间更长且可能掩盖 webhook 问题。直接 POST `/deploy` API 才是绕过 webhook 的正路。

## reconcile Step 10: 5min 轮询公网域名

```bash
FQDN=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID" \
  | jq -r '.applications[0].fqdn')
PUBLIC_URL=$(echo "$FQDN" | sed -E 's#:[0-9]+/?$##')

T0=$(date +%s)
DEADLINE=$((T0 + 300))  # 5min
LAST_CODE="000"

while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  LAST_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -I --max-time 10 "$PUBLIC_URL" || echo "000")
  case "$LAST_CODE" in
    2*|3*)
      echo "✓ $PUBLIC_URL → HTTP $LAST_CODE (耗时 $(( $(date +%s) - T0 ))s)"
      exit 0 ;;
  esac
  sleep 10
done

echo "✗ 5min 超时, $PUBLIC_URL → HTTP $LAST_CODE"
exit 1
```

- 2xx / 3xx → ✓ 部署到家
- 5xx (非 502) → 应用起来了但内部错；看 [../references/coolify-compose-deploy-failure-triage.md](../references/coolify-compose-deploy-failure-triage.md)
- 502 → traefik 转发但 upstream 没响应；八成 healthcheck 没过或端口对不上
- 404 → traefik 没收到这个域名；urls 没正确同步, 重跑更新分支 Step 3U
- DNS 解析失败 → 域名 A 记录还没指过来, 让用户去 DNS 服务商配
- Connection refused → traefik 没在 443 上；通常 Coolify 实例本身有问题, 去 UI 看
