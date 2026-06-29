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

## GitHub 端配置（reconcile Step 7）

### Repo-level secrets

```bash
gh secret set COOLIFY_API_TOKEN --body "$COOLIFY_API_TOKEN"
gh secret set COOLIFY_BASE_URL  --body "http://120.77.223.183:8000"
```

**注意命令字符串里只能引用 `$COOLIFY_API_TOKEN`，不能把 token 原文写进去**——shell 展开发生在执行时，命令字符串本身（agent 写给 Bash tool 的字符串）必须保持 `$VAR` 不变。

校验是否已设：

```bash
gh secret list | grep -E '^COOLIFY_API_TOKEN|^COOLIFY_BASE_URL'
```

### Environment-level vars（每个部署分支一个同名 environment）

例如 `main` environment：

```bash
gh variable set COOLIFY_APP_UUID       --env main --body "<service-uuid>"
gh variable set IMAGE_TAG_ROLLING      --env main --body "latest"
gh variable set IMAGE_TAG_SHA_PREFIX   --env main --body ""
```

多环境（dev）：

```bash
gh variable set COOLIFY_APP_UUID       --env dev --body "<dev-service-uuid>"
gh variable set IMAGE_TAG_ROLLING      --env dev --body "dev"
gh variable set IMAGE_TAG_SHA_PREFIX   --env dev --body "dev-"
```

### 探测 environment 是否存在

`gh` CLI 当前没有"create environment"命令——必须用户去 [Settings → Environments](https://github.com/${{ github.repository }}/settings/environments) 手工建。reconcile Step 7 act 时若 environment 不存在，**输出该 URL 让用户手工建**。

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

## reconcile Step 8: 跟首次部署 / 链路验证

```bash
# 1. 看 GHA 最近一次 run
gh run list --workflow=deploy.yml --branch main --limit 1

# 2. 看 Coolify service 当前 status
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID" \
  | jq '{status, applications: [.applications[] | {name, fqdn}]}'

# 3. 看 Coolify 容器 logs（如果 API 暴露）
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID/logs?lines=200"
```

GHA 红 → 看具体 step；通常是测试卡口 / docker build / GHCR auth / Coolify webhook 401 四类。每类的根因和 fix 在 [../references/coolify-compose-deploy-failure-triage.md](../references/coolify-compose-deploy-failure-triage.md)。

Coolify service status 不是 running → 容器在跑但 healthcheck 没过；走 [../references/coolify-docker-inspection.md](../references/coolify-docker-inspection.md) 抓证据。

## reconcile Step 9: 公网可访问

```bash
# 取当前 fqdn
FQDN=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID" \
  | jq -r '.applications[0].fqdn')

# strip 掉容器端口（公网走 443 / 80），保留 scheme + host
PUBLIC_URL=$(echo "$FQDN" | sed -E 's#:[0-9]+/?$##')

curl -sS -o /dev/null -w "HTTP=%{http_code}\n" -I --max-time 15 "$PUBLIC_URL"
```

- 2xx / 3xx → ✓ 部署到家
- 5xx → 应用起来了但内部错；看 [../references/coolify-compose-deploy-failure-triage.md](../references/coolify-compose-deploy-failure-triage.md)
- 502 → traefik 转发但 upstream 没响应；八成 healthcheck 没过或端口对不上
- 404 → traefik 没收到这个域名；urls 没正确同步
- DNS 解析失败 → 域名 A 记录还没指过来，让用户去 DNS 服务商配
- Connection refused → traefik 没在 443 上；通常 Coolify 实例本身有问题，去 UI 看
