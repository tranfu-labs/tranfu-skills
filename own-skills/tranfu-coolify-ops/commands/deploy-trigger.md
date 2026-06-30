# 部署触发链路

reconcile Step 7 / Step 8 用。术语 (Coolify Service Resource / sub-application / compose service / Coolify Application Resource) 见 SKILL.md ## 心智模型。

## 输入 / 输出 / 完成判据

输入: $COOLIFY_BASE_URL, $COOLIFY_API_TOKEN, $COOLIFY_APP_UUID (已 reconcile Step 3 拿到)
输出: GHA secrets/vars 已配 + 至少一次 deploy 成功
完成 = gh run list --workflow=deploy.yml --limit 1 最近一次 status=success 且 Step 9 curl 返 2xx/3xx

## 链路总览

```
git push -> GitHub Actions deploy.yml -> docker build -> push GHCR
                                              ↓
                                     curl POST $COOLIFY_BASE_URL/api/v1/deploy?uuid=<service-uuid>
                                              ↓
                              Coolify 收到 -> pull 新镜像 -> restart container
```

MUST 在 Coolify UI 关闭 Auto Deploy on Push / Webhook (触发权归 GHA workflow); 未关 → 双触发 / 镜像 race, 列为 BLOCKER 前置条件。

## GitHub 端配置（reconcile Step 7）

### Repo-level secrets

```bash
gh secret set COOLIFY_API_TOKEN --body "$COOLIFY_API_TOKEN"
gh secret set COOLIFY_BASE_URL  --body "http://120.77.223.183:8000"
```

**MUST NEVER 把 token 原文写入命令字符串 / 日志 / 错误信息; MUST 仅以 `$COOLIFY_API_TOKEN` 引用; 违反 = secret 泄漏进 transcript / 命令历史。** shell 展开发生在执行时，命令字符串本身（agent 写给 Bash tool 的字符串）必须保持 `$VAR` 不变。

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
  "$COOLIFY_BASE_URL/api/v1/deploy?uuid=$COOLIFY_APP_UUID&force=false"
```

`force=true` 仅用于以下场景: (a) 镜像 tag 没变但要强制重 pull (Coolify 检测不到镜像变化); (b) 容器内 state 卡死要硬重启; (c) compose 配置已改但 Coolify 未识别到需要 recreate。其余情况 MUST 用 `force=false` (副作用小, 仅在镜像变化时滚动重启)。

## webhook URL 构造

```
${COOLIFY_BASE_URL}/api/v1/deploy?uuid=${COOLIFY_APP_UUID}&force=false
```

- `COOLIFY_BASE_URL`: `http://120.77.223.183:8000`
- `COOLIFY_APP_UUID`: reconcile Step 3 拿到的 service uuid
- Auth: `Authorization: Bearer $COOLIFY_API_TOKEN` 必须

写进 deploy.yml.template 的方式：环境变量里读 `COOLIFY_BASE_URL` + `COOLIFY_APP_UUID`，模板里拼字符串。

## reconcile Step 8: 跟首次部署 / 链路验证

```bash
# 1. 看 GHA 最近一次 run
gh run list --workflow=deploy.yml --branch main --limit 1

# 2. 看 Coolify service 当前 status
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$COOLIFY_BASE_URL/api/v1/services/$COOLIFY_APP_UUID" \
  | jq '{status, applications: [.applications[] | {name, fqdn}]}'

# 3. 看 Coolify 容器 logs（如果 API 暴露）
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$COOLIFY_BASE_URL/api/v1/services/$COOLIFY_APP_UUID/logs?lines=200"
```

GHA 红 → 看具体 step 走精确路由表 (详见 [../references/coolify-compose-deploy-failure-triage.md](../references/coolify-compose-deploy-failure-triage.md)):

- step=Test 失败 → 测试本身有 bug, 修测试 / 修代码
- step=Build 失败 → Dockerfile / 编译错, 看 build log 定位语法 / 依赖问题
- step=Push 失败 → GHCR 401, 检查 workflow 里 `permissions: packages: write` 和 `GITHUB_TOKEN` 是否注入
- step=Deploy + HTTP=401 → Coolify webhook 401, `COOLIFY_API_TOKEN` 失效或拼错, 去 Coolify UI 重新生成
- step=Deploy + HTTP=404 → `COOLIFY_APP_UUID` 错或 service 已删, 走 reconcile Step 3 重取 uuid

Coolify service status 不是 running → 容器在跑但 healthcheck 没过；走 [../references/coolify-docker-inspection.md](../references/coolify-docker-inspection.md) 抓证据。

## reconcile Step 9: 公网可访问

```bash
# 取当前 fqdn
FQDN=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$COOLIFY_BASE_URL/api/v1/services/$COOLIFY_APP_UUID" \
  | jq -r '.applications[0].fqdn')

# strip 掉容器端口（公网走 443 / 80），保留 scheme + host
PUBLIC_URL=$(echo "$FQDN" | sed -E 's#:[0-9]+/?$##')

curl -sS -o /dev/null -w "HTTP=%{http_code}\n" -I --max-time 15 "$PUBLIC_URL"
```

按 HTTP code 精确路由 (详见 [../references/coolify-compose-deploy-failure-triage.md](../references/coolify-compose-deploy-failure-triage.md)):

- 2xx / 3xx 且响应 body 非 traefik 默认错误页 → DONE
- 5xx → 应用起来了但内部错: `kubectl logs <pod>` 或 `docker logs <container>` 抓 stack trace
- 502 → upstream 没响应: 先 `docker exec <container> curl localhost:<healthcheck-port>` 确认容器内服务起来了; HTTP 失败 → healthcheck 没起 (看应用启动 log); HTTP OK 但 traefik 仍 502 → 端口对不上, 对照 compose `expose` / `ports` vs Dockerfile `EXPOSE` vs Coolify UI 配的 port
- 504 → upstream 超时: 容器内服务起来了但响应慢, 看应用 log / DB 连接 / 外部依赖
- 404 → traefik 没收到这个域名: urls 没正确同步, 走 commands/domain.md 校验
- DNS 解析失败 → 域名 A 记录还没指过来, 让用户去 DNS 服务商配
- Connection refused → traefik 没在 443 上: 通常 Coolify 实例本身有问题, 去 UI 看
