# reconcile-deployment：唯一流程文档

**所有部署相关请求都走这一份**——新项目 / 部署故障 / 临时改东西（域名 / env / compose）都进 reconcile flow，让流程自己识别要做什么。

## 设计原则

- **每个 Step 三段：Check 当前状态 → Diff 期望状态 → Diff 空 skip / 非空 Act**
- **整套幂等**：第二次跑、第三次跑、第 N 次跑都收敛到同一终态——已经对的不动，缺的补，错的改
- **不允许跳步**：从 Step 0 顺序跑到 Step 9，每步要么 ✓ skip 要么 act 完才进下一步
- **Act 前一律先把 diff 摆出来等用户确认**——动 Coolify 上活资源前的硬纪律
- **任一 Step act 失败 → 中止，不静默推进**

## 工作单元契约

- **输入**：用户触发语 + 当前 git 仓库 + Coolify 实例当前状态
- **输出**：所有 9 个 Step 全 ✓ + 公网域名 2xx/3xx 可访问
- **Ownership**：reconcile 是写动作流程——所有写操作都 act 前 diff，act 后 GET 校验
- **完成判据**（可观测）：Step 9 的 `curl -I <public-url>` 返 2xx 或 3xx

## 触发分流

agent 进 skill 时根据用户措辞**选择起点 Step**（但仍从 Step 0 顺序跑下来，触发分流只是给 agent 一个"这个项目大概落在哪 step 出问题"的预判，不能跳）：

| 用户措辞 | 预判落点 | 但仍从 Step 0 跑 |
|---|---|---|
| 上 coolify / 新项目部署 / onboard | Step 2-7 大概率全要 act | 全跑 |
| 部署挂了 / 部署没成功 | Step 8 或 Step 9 fail | 全跑——前 7 步若已 ✓ 会快速 skip |
| 改 / 加域名 | Step 5 act | 全跑 |
| 加 / 改 env | Step 6 act | 全跑 |
| 改 compose | Step 4 act | 全跑 |
| 一切都对就是访问不了 | Step 9 fail | 全跑 |

## TODO list 模板（agent 启动时 create）

跑 reconcile 前 create 9 项 TODO（编号保留 Step 0 + Step 2-9，Step 1 已并入 Step 0），每跑完一个 Step 更新状态：

```
[ ] Step 0: preflight (环境 + 凭据 + 权限 + Coolify 活性 一次性 check)
[ ] Step 2: 仓库代码侧四件套
[ ] Step 3: Coolify Service 资源存在
[ ] Step 4: Compose 内容一致
[ ] Step 5: 域名 (sub-application.fqdn)
[ ] Step 6: Env 变量
[ ] Step 7: GitHub repo secrets/vars
[ ] Step 8: 触发 + 部署链路通
[ ] Step 9: 公网域名可访问
```

---

## Step 0: preflight（独立脚本 · 一次性全部前置）

跑 [`../assets/preflight.sh`](../assets/preflight.sh)，一个脚本覆盖**所有**前置检测——工具 / git 仓库状态 / 命名 / GitHub 凭据与权限 / Coolify 凭据活性 / Coolify 写权限 / GHCR registry credential 手工 ack。

```bash
# cd 到目标项目根目录后跑（路径相对 skill 根）
bash <SKILL_ROOT>/assets/preflight.sh

# 或显式指定 base url
bash <SKILL_ROOT>/assets/preflight.sh http://120.77.223.183:8000
```

退出码：

| 退出码 | 含义 | 下一步 |
|---|---|---|
| `0` | 全部 ✓ | 进 Step 2 |
| `1` | 任一硬 check ✗ | 终止，按脚本输出的 `✗ <reason>` 修完再跑 |
| `2` | 仅 ⚠（如 GHCR credential 未 ack）| 终止 + 让用户去 Coolify UI 配 ghcr.io credential，回来重跑 |

preflight 覆盖的 check 清单（脚本里硬编码顺序，详见 [../commands/prerequisites.md](../commands/prerequisites.md)）：

- **工具**：`gh / jq / curl / git / base64` 全装
- **Git**：在仓库根 + 有 origin remote + tranfu-labs 命名合规 + working tree clean
- **GitHub**：`gh auth status` 通 + token scope 含 `'repo'` + 用户对本 repo 有 admin permission
- **Coolify**：`$COOLIFY_API_TOKEN` 存在 + 拨 `/api/v1/version` 200 + PATCH dummy uuid 期望 404/422（验写权限）
- **GHCR**：手工 ack 一次"Coolify UI 已挂 ghcr.io registry credential"（API 探测不到，per-Coolify 实例只配一次）

**Token 安全纪律**：preflight.sh 永不打印 token 任何字节（长度 / 前缀都不打），失败原因只描述"哪一层挂了"。

**Diff / Act**：无 act——这步只读 + fail-fast。preflight ✗ → 全部修完才能继续。

输出公共变量（脚本算出，传给后续 Step）：

```
$BASE = http://120.77.223.183:8000
$SERVER_UUID = oz7r53ilv7aeaubx7ewuqw0m
$REPO_ORG = tranfu-labs
$REPO_NAME = <user-repo>
$SVC_NAME = $REPO_NAME
```

---

## Step 1: (已并入 Step 0)

原 Step 1 (token 活性) 已合并到 Step 0 的 preflight.sh。编号保留 1 以避免 Step 2-9 全部 reindex 破坏外部引用。

---

## Step 2: 仓库代码侧四件套

四件套：`Dockerfile` / `.dockerignore` / `compose.yml` / `.github/workflows/deploy.yml`

**Check**：对照 [../references/file-generation-rules.md](../references/file-generation-rules.md) 的规则：

```bash
# 文件存在性
for f in Dockerfile .dockerignore compose.yml .github/workflows/deploy.yml; do
  [ -f "$f" ] && echo "✓ $f" || echo "✗ $f 缺失"
done
```

对每个存在的文件按 file-generation-rules.md 跑合规校验（端口六处一致、不写 `ports:`、不写 `build:`、healthcheck 防代理、deploy.yml 走 vars 不走 inline UUID 等）。

**Diff**：

- 缺的文件 → 列出
- 存在但不合规的 → 列出哪些规则违反

**Act**（每个文件**完整覆盖写入**，不输出 diff）：

| 缺 | 用什么生成 |
|---|---|
| Dockerfile | 按 [file-generation-rules.md §Dockerfile](../references/file-generation-rules.md#dockerfile) 生成 |
| .dockerignore | 按 [file-generation-rules.md §.dockerignore](../references/file-generation-rules.md#dockerignore) 生成 |
| compose.yml | 按 [file-generation-rules.md §compose](../references/file-generation-rules.md#composeyml) 生成 |
| deploy.yml | 拷 [`../assets/deploy.yml.template`](../assets/deploy.yml.template)，替换 `{{DEFAULT_BRANCH}}` 和 `{{TESTS_STEP}}` |

Act 前：把生成 / 改造内容摆给用户预览，让用户确认后再写。

Act 失败：写不进文件（权限 / 路径不对）→ 终止，让用户处理。

**不在这一步**：commit / push。git 操作留给用户。

---

## Step 3: Coolify Service 资源存在

**Check**：

```bash
EXISTING=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services" \
  | jq -r --arg n "$SVC_NAME" '.[] | select(.name == $n) | .uuid')

if [ -n "$EXISTING" ]; then
  echo "✓ Service '$SVC_NAME' 已存在: $EXISTING"
  SERVICE_UUID="$EXISTING"
else
  echo "✗ Service '$SVC_NAME' 不存在，待建"
fi
```

**Diff**：

- 存在 → 存 `$SERVICE_UUID`，直接进 Step 4
- 不存在 → 进 Act

**Act**：

需要 `${project-uuid}`——Coolify 上必须先有一个 project。**reconcile 不自动建 project**。

```bash
# 列 project 让用户选（按 name 显示）
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$BASE/api/v1/projects" \
  | jq '[.[] | {uuid, name}]'
```

- 用户选一个 → 拿 `$PROJECT_UUID`
- 一个都没有 → 让用户去 UI 建一个（https://120.77.223.183:8000/projects），跑完再回头

POST 创建（带 compose + urls 一次到位）：

按 [../commands/service-crud.md](../commands/service-crud.md) §"创建 Docker Compose Empty Service"。Body 关键字段：

```
project_uuid: $PROJECT_UUID
server_uuid: $SERVER_UUID
environment_name: production
name: $SVC_NAME
docker_compose_raw: base64(cat compose.yml)
urls: [{name: $SVC_NAME, url: "https://$SVC_NAME.tranfu.com:<port>"}]
instant_deploy: false
```

`<port>` 从 compose.yml 的 expose 字段解析得到。多 sub-application 时 `urls` 数组每个 service 一条。

返回 `{uuid, domains}` → 存 `$SERVICE_UUID`。

**Act 失败**：

- 400 missing required → 检查 project_uuid / server_uuid 是不是真存在
- 409 domain conflict → 该域名被别的资源占用，先查占用者（[../commands/domain.md](../commands/domain.md) §"域名冲突"），由用户决定是否覆盖
- 422 → shape 错，重点查 `urls` 是数组不是对象，`docker_compose_raw` 是 base64 单行

---

## Step 4: Compose 内容一致

**Check**：

```bash
REMOTE=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID" | jq -r .docker_compose_raw)
LOCAL=$(cat compose.yml)

if [ "$REMOTE" = "$LOCAL" ]; then
  echo "✓ Coolify compose 与本地一致"
else
  echo "✗ Coolify compose 与本地不一致，待 PATCH"
  diff <(echo "$REMOTE") <(echo "$LOCAL") | head -30
fi
```

**Diff** 一致 → skip；不一致 → 展示给用户 + Act。

**Act**：按 [../commands/service-crud.md §"更新 compose"](../commands/service-crud.md) PATCH。

```bash
COMPOSE_B64=$(cat compose.yml | base64 | tr -d '\n')
curl -sS -X PATCH \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg sb "$COMPOSE_B64" '{docker_compose_raw: $sb}')" \
  "$BASE/api/v1/services/$SERVICE_UUID"
```

Act 后 GET 一次校验 `docker_compose_raw` 真变了。

**Act 失败**：

- 422 base64 → 没 `| tr -d '\n'`，macOS base64 折行了
- Invalid JSON → compose 内容含未转义双引号；用 jq 构造 body（而非手拼字符串）

---

## Step 5: 域名 (sub-application.fqdn)

**Check**：每个 compose service 都要有期望域名（`https://<name>.tranfu.com:<port>`）。

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID" \
  | jq '.applications[] | {name, fqdn}'
```

对每个 sub-application：

- `fqdn` = 期望域名 → ✓
- `fqdn` 含 `sslip.io` → ✗ fallback，未设
- `fqdn` ≠ 期望 → ✗ 错域名
- `fqdn` = null → ✗ 未设

**Diff** 全 ✓ → skip；任一 ✗ → Act。

**Act**：按 [../commands/domain.md](../commands/domain.md) PATCH urls 字段。**全量发**所有 sub-application 域名（不是只发要改的那条），避免半更新。

```bash
URLS_JSON='[{"name":"web","url":"https://web.tranfu.com:3000"},{"name":"api","url":"https://api.tranfu.com:4000"}]'
curl -sS -X PATCH \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --argjson urls "$URLS_JSON" '{urls: $urls}')" \
  "$BASE/api/v1/services/$SERVICE_UUID"
```

Act 后立刻 GET 校验 sub-application.fqdn 真变了。

**Act 失败**：

- 422 `domains: not allowed` → 字段名错了，改用 `urls`
- 409 域名冲突 → 看 [../commands/domain.md §"域名冲突"](../commands/domain.md)
- 200 但 fqdn 不变 → 大概率 shape 错（object-keyed），改成数组

---

## Step 6: Env 变量

**Check**：仓库 `.env`（如果有）或用户指定的 KV 列表 vs Coolify 上现有 envs。

```bash
# Coolify 端
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID/envs" \
  | jq '[.[] | {uuid, key}]'

# 本地端（如果有 .env）
grep -v '^\s*#' .env 2>/dev/null | grep '=' | cut -d= -f1
```

对比详见 [../commands/service-env.md §"对比仓库 .env 与 Coolify 现状"](../commands/service-env.md)。

**自动 skip 的 key**：`SERVICE_PASSWORD_*` / `SERVICE_FQDN_*`（Coolify 魔法变量，不参与 diff）

**Diff**：

- 缺的 key（本地有 Coolify 没）→ 列出
- 多的 key（Coolify 有本地没）→ 列出**但不删**，告知用户
- 值不同（hash 比较，不打明文）→ 列出 key

**Act**：

- 补缺：`POST /envs`
- 改值：`PATCH /envs/{env_uuid}`
- 多余：**不删**，只告知用户决定

详见 [../commands/service-env.md](../commands/service-env.md)。

**Act 纪律**：值永不打印到对话。读 .env 的命令也不 echo 内容。

---

## Step 7: GitHub repo secrets/vars

**Check**：

```bash
# Repo-level secrets
gh secret list | awk '{print $1}' | grep -E '^COOLIFY_API_TOKEN$|^COOLIFY_BASE_URL$'

# Environment-level vars（每个部署分支）
DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD | sed 's@^origin/@@')
gh variable list --env "$DEFAULT_BRANCH" | awk '{print $1}' \
  | grep -E '^COOLIFY_APP_UUID$|^IMAGE_TAG_ROLLING$|^IMAGE_TAG_SHA_PREFIX$'
```

**Diff**：

| 缺什么 | 怎么 act |
|---|---|
| repo secret `COOLIFY_API_TOKEN` | `gh secret set COOLIFY_API_TOKEN --body "$COOLIFY_API_TOKEN"` |
| repo secret `COOLIFY_BASE_URL` | `gh secret set COOLIFY_BASE_URL --body "$BASE"` |
| environment `$DEFAULT_BRANCH` 不存在 | 让用户去 https://github.com/$REPO_ORG/$REPO_NAME/settings/environments 手工建（gh CLI 不能建 environment） |
| env var `COOLIFY_APP_UUID` | `gh variable set COOLIFY_APP_UUID --env $DEFAULT_BRANCH --body "$SERVICE_UUID"` |
| env var `IMAGE_TAG_ROLLING` | `gh variable set IMAGE_TAG_ROLLING --env $DEFAULT_BRANCH --body "latest"`（默认分支用 `latest`，dev 分支用 `dev` 等） |
| env var `IMAGE_TAG_SHA_PREFIX` | `gh variable set IMAGE_TAG_SHA_PREFIX --env $DEFAULT_BRANCH --body ""`（默认分支空字符串，dev 分支 `dev-` 等） |

**Act 纪律**：`gh secret set ... --body "$COOLIFY_API_TOKEN"`——shell 内展开，命令字符串本身不含原文。

**Act 失败**：

- environment 不存在 → 给用户 settings URL 让手工建，不能自动
- gh auth 失效 → `gh auth refresh` 让用户处理

---

## Step 8: 触发 + 部署链路通

**Check**：

```bash
# 1. GHA 最近一次 deploy.yml run
gh run list --workflow=deploy.yml --branch "$DEFAULT_BRANCH" --limit 1 --json status,conclusion,createdAt

# 2. Coolify service 当前 status
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID" \
  | jq '{status, applications: [.applications[] | {name, fqdn}]}'
```

**Diff**：

- GHA 从未跑过 + Coolify status != running → 进 Act
- GHA 上一次成功 + Coolify status = running → ✓ skip
- GHA 上一次失败 → 进 Act（让用户看 log）
- GHA 在 running → 等

**Act**：

- 没跑过：让用户 `git push` 或 `gh workflow run deploy.yml --ref $DEFAULT_BRANCH`
- 上次失败：`gh run view <run-id> --log-failed` 抓失败 step，按 [../commands/deploy-trigger.md §"reconcile Step 8"](../commands/deploy-trigger.md) 排障
- 在 running：等 + 跟 logs

跟 GHA logs：

```bash
gh run watch
```

GHA 红了的常见根因：测试卡口失败 / docker build 失败 / GHCR auth 失败 / Coolify webhook 401（token 错）。

---

## Step 9: 公网域名可访问

**Check**：

```bash
for FQDN in $(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID" | jq -r '.applications[].fqdn'); do
  # strip 容器端口（公网走 443/80）
  PUBLIC_URL=$(echo "$FQDN" | sed -E 's#:[0-9]+/?$##')
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" -I --max-time 15 "$PUBLIC_URL")
  echo "$PUBLIC_URL → HTTP=$CODE"
done
```

**Diff**：

- 2xx / 3xx → ✓ 部署到家
- 5xx / 502 / 404 / DNS 失败 / connection refused → ✗

**Act**：

排障映射（详见 [../commands/deploy-trigger.md §"reconcile Step 9"](../commands/deploy-trigger.md)）：

| HTTP/错误 | 大概率根因 | 修哪儿 |
|---|---|---|
| 502 | 容器 healthcheck 没过 / 端口对不上 | 走 [../references/coolify-docker-inspection.md](../references/coolify-docker-inspection.md) 抓容器证据 |
| 404 | traefik 没收到这个域名 | Step 5 urls 没正确同步，重跑 Step 5 |
| 5xx (非 502) | 应用内部错 | 看 GHA logs / Coolify service logs，应用代码层面 |
| DNS 失败 | A 记录还没指过来 | 让用户去 DNS 服务商配，不在 reconcile 范围 |
| connection refused | traefik 没在 443 上 | Coolify 实例本身问题，去 UI 看 / 联系运维 |

Act 失败 → 终止，让用户参考 references 排障。

---

## 收尾

9 个 Step 全 ✓ → reconcile 完成。

输出最终报告：

```
✓ reconcile-deployment 完成
  服务: $SVC_NAME ($SERVICE_UUID)
  Coolify URL: $BASE/services/$SERVICE_UUID
  公网: $PUBLIC_URL
  GHA: https://github.com/$REPO_ORG/$REPO_NAME/actions
  最近一次部署: <run-id>，状态：<conclusion>
```

任一 Step 失败 → 输出"卡在 Step X，原因：..."的报告，让用户决定下一步。

## 反例（不要这么做）

- **不要"只修 Step 5 域名"就 return**——必须从 Step 0 跑完所有 Step，确认全 ✓ 再 return（reconcile 的核心价值就是顺手发现别的不对的地方）
- **不要批量 act**（Step 4 + Step 5 一起 PATCH）——一步一步走，每步 act 完 GET 校验再下一步
- **不要 act 前不给 diff**——所有写动作前必须摆 diff 等用户确认（防止今天 markdown-kits-app compose 简化事故重演）
- **不要因为某一步用户没答应继续就跳过这一步**——明确终止，不静默推进
