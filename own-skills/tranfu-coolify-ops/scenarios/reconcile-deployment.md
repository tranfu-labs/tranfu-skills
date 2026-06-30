# reconcile-deployment：唯一流程文档

**所有部署相关请求都走这一份**——新项目 / 部署故障 / 临时改东西（域名 / env / compose）都进 reconcile flow，让流程自己识别要做什么。

## 设计原则

- **每个 Step 三段：Check 当前状态 → Diff 期望状态 → Diff 空 skip / 非空 Act**
- **整套幂等**：第二次跑、第三次跑、第 N 次跑都收敛到同一终态——已经对的不动，缺的补，错的改
- **MUST NEVER 跳步**: 从 Step 0 顺序跑到 Step 9 (Step 1 已并入 Step 0, 共 9 个 Step, 编号保留与历史 commit 对齐)
- **MUST 在 Act 前把 diff 摆给用户, 等用户显式确认, NEVER 在未确认时执行写操作 (POST/PATCH/DELETE)**
- **任一 Step act 失败 → MUST 中止, NEVER 静默推进**

## 工作单元契约

- **输入**：用户触发语 + 当前 git 仓库 + Coolify 实例当前状态
- **输出**：所有 9 个 Step 全 ✓ + 公网域名 2xx/3xx 可访问
- **Ownership**：reconcile 是写动作流程——所有写操作都 act 前 diff，act 后 GET 校验
- **完成判据**（可观测）：Step 9 的 `curl -I <public-url>` 对所有 sub-application.fqdn 都返 2xx 或 3xx

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
| 其他 / 措辞不匹配 | 无预判, 仍从 Step 0 顺序跑 | 全跑 |

## TODO list 模板（agent 启动时 create）

跑 reconcile 前 create 9 项 TODO（编号保留 Step 0 + Step 2-9，Step 1 已并入 Step 0），每跑完一个 Step 更新状态：

```
[ ] Step 0: preflight (环境 + 凭据 + 权限 + Coolify 活性 一次性 check)  — 产出: $COOLIFY_BASE_URL / $SERVER_UUID / $REPO_ORG / $REPO_NAME / $SVC_NAME
[ ] Step 2: 仓库代码侧四件套  — 产出: 仓库根四件套合规
[ ] Step 3: Coolify Service 资源存在  — 产出: $COOLIFY_APP_UUID
[ ] Step 4: Compose 内容一致  — 产出: docker_compose_raw 已同步
[ ] Step 5: 域名 (sub-application.fqdn)  — 产出: 全量 sub-application.fqdn 集合
[ ] Step 6: Env 变量  — 产出: service envs 同步
[ ] Step 7: GitHub repo secrets/vars  — 产出: GHA secrets/vars 同步
[ ] Step 8: 触发 + 部署链路通  — 产出: 一次 deploy 触发
[ ] Step 9: 公网域名可访问  — 产出: 所有 fqdn HTTP 2xx/3xx
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

**CRITICAL: preflight.sh MUST NEVER 打印 token 任何字节** (长度 / 前缀都不打), 失败原因只描述"哪一层挂了".

**Diff / Act**: 无 act——这步只读 + fail-fast. preflight ✗ → 全部修完才能继续.

**产出**: 公共变量 (脚本算出, 传给后续 Step):

```
$COOLIFY_BASE_URL = http://120.77.223.183:8000
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

四件套: `Dockerfile` / `.dockerignore` / `compose.yml` / `.github/workflows/deploy.yml`

1. 读取目标四件套并记每个文件存在状态. (Check, 动作)

   ```bash
   for f in Dockerfile .dockerignore compose.yml .github/workflows/deploy.yml; do
     [ -f "$f" ] && echo "✓ $f" || echo "✗ $f 缺失"
   done
   ```

2. 对每个存在的文件按 [../references/file-generation-rules.md](../references/file-generation-rules.md) 跑合规校验 (端口六处一致 / 不写 `ports:` / 不写 `build:` / healthcheck 防代理 / deploy.yml 走 vars 不走 inline UUID 等); 若全合规 → 标 ✓ 进 Step 3; 否则 → 列 diff (缺文件 + 不合规文件违反的规则) 进 3. (Check → Diff, 分支)
3. **MUST 在 Act 前** 把生成 / 改造的完整文件内容摆给用户预览, 等用户显式确认; **NEVER** 在未确认时写文件. (动作)
4. 若用户不确认 → 终止 reconcile, 记录卡点报告; 否则 → 进 5. (卫语句)
5. 按 [../references/file-generation-rules.md](../references/file-generation-rules.md) 对每个 diff 文件**完整覆盖写入**: Dockerfile / .dockerignore / compose.yml 按对应 §节生成; deploy.yml 拷 [`../assets/deploy.yml.template`](../assets/deploy.yml.template) 并替换 `{{DEFAULT_BRANCH}}` 与 `{{TESTS_STEP}}`. (Act, 动作)
6. 若写入失败 (权限 / 路径不对) → 终止并报权限/路径错, 让用户处理. (失败有出口)
7. **不在这一步**: commit / push, git 操作留给用户. **产出**: 仓库根四件套合规, 进 Step 3. (显式终止 + 命名产物)

---

## Step 3: Coolify Service 资源存在

1. 按 name 在 `$COOLIFY_BASE_URL/api/v1/services` 查 Service Resource. (Check, 动作)

   ```bash
   EXISTING=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
     "$COOLIFY_BASE_URL/api/v1/services" \
     | jq -r --arg n "$SVC_NAME" '.[] | select(.name == $n) | .uuid')
   ```

2. 若 `$EXISTING` 非空 → 存 `$COOLIFY_APP_UUID=$EXISTING`, 标 ✓ 直接进 Step 4; 否则 → 进 3. (Diff, 分支)
3. 列 project 让用户选 (按 name 显示), 因 reconcile **不自动建 project**. (动作)

   ```bash
   curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_BASE_URL/api/v1/projects" \
     | jq '[.[] | {uuid, name}]'
   ```

4. 若 project 列表为空 → 终止 reconcile, 让用户去 `$COOLIFY_BASE_URL/projects` 手工建一个再回头重跑; 否则 → 取用户选的 `$PROJECT_UUID` 进 5. (卫语句)
5. **MUST 在 Act 前** 把待 POST 的 body (project_uuid / server_uuid / environment_name / name / docker_compose_raw / urls / instant_deploy) 摆给用户预览, 等用户显式确认; **NEVER** 在未确认时 POST. (动作)
6. 若用户不确认 → 终止 reconcile, 记录卡点报告; 否则 → 进 7. (卫语句)
7. 按 [../commands/service-crud.md](../commands/service-crud.md) §"创建 Docker Compose Empty Service" POST 创建 (带 compose + urls 一次到位). `<port>` 从 compose.yml 的 expose 字段解析; 多 sub-application 时 `urls` 数组每个 compose service 一条. (Act, 动作)

   ```
   project_uuid: $PROJECT_UUID
   server_uuid: $SERVER_UUID
   environment_name: production
   name: $SVC_NAME
   docker_compose_raw: base64(cat compose.yml)
   urls: [{name: $SVC_NAME, url: "https://$SVC_NAME.tranfu.com:<port>"}]
   instant_deploy: false
   ```

8. 按返回 HTTP 状态路由: 2xx → 存 `$COOLIFY_APP_UUID=<返回的 uuid>`; 400 missing required → 终止并报 project_uuid / server_uuid 不存在; 409 domain conflict → 终止并按 [../commands/domain.md](../commands/domain.md) §"域名冲突" 查占用者由用户决定是否覆盖; 422 → 终止并报 shape 错 (重点查 `urls` 是数组不是对象, `docker_compose_raw` 是 base64 单行); 否则 → 终止并报未知错. (派发)
9. **产出**: `$COOLIFY_APP_UUID` (= service uuid), 进 Step 4. (显式终止 + 命名产物)

---

## Step 4: Compose 内容一致

1. 拉远端 `docker_compose_raw` 与本地 `compose.yml` 做字面对比. (Check, 动作)

   ```bash
   REMOTE=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
     "$COOLIFY_BASE_URL/api/v1/services/$COOLIFY_APP_UUID" | jq -r .docker_compose_raw)
   LOCAL=$(cat compose.yml)
   ```

2. 若 `$REMOTE` = `$LOCAL` → 标 ✓ skip 进 Step 5; 否则 → 跑 `diff <(echo "$REMOTE") <(echo "$LOCAL") | head -30` 形成 diff 进 3. (Diff, 分支)
3. **MUST 在 Act 前** 把 diff 摆给用户预览, 等用户显式确认; **NEVER** 在未确认时 PATCH. (动作)
4. 若用户不确认 → 终止 reconcile, 记录卡点报告; 否则 → 进 5. (卫语句)
5. 按 [../commands/service-crud.md §"更新 compose"](../commands/service-crud.md) PATCH `docker_compose_raw`. (Act, 动作)

   ```bash
   COMPOSE_B64=$(cat compose.yml | base64 | tr -d '\n')
   curl -sS -X PATCH \
     -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d "$(jq -nc --arg sb "$COMPOSE_B64" '{docker_compose_raw: $sb}')" \
     "$COOLIFY_BASE_URL/api/v1/services/$COOLIFY_APP_UUID"
   ```

6. Act 后 GET 一次校验 `docker_compose_raw` 真变了; 若未变 → 终止并报失败. (失败有出口)
7. 按返回 HTTP 状态路由: 2xx 且校验通过 → 进 Step 5; 422 base64 → 终止并提示没 `| tr -d '\n'` (macOS base64 折行); Invalid JSON → 终止并提示 compose 含未转义双引号, 应用 jq 构造 body (而非手拼字符串); 否则 → 终止并报未知错. (派发)
8. **产出**: docker_compose_raw 已同步, 进 Step 5. (显式终止 + 命名产物)

---

## Step 5: 域名 (sub-application.fqdn)

每个 compose service (= sub-application) 都要有期望域名 `https://<name>.tranfu.com:<port>`.

1. 拉远端所有 sub-application 的 `{name, fqdn}` 列表. (Check, 动作)

   ```bash
   curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
     "$COOLIFY_BASE_URL/api/v1/services/$COOLIFY_APP_UUID" \
     | jq '.applications[] | {name, fqdn}'
   ```

2. 按 sub-application 路由: `fqdn` = 期望 → ✓; `fqdn` 含 `sslip.io` → ✗ fallback 未设; `fqdn` ≠ 期望 → ✗ 错域名; `fqdn` = null → ✗ 未设; 否则 → ✗ 未知. (派发)
3. 若所有 sub-application 都 ✓ → 标 ✓ skip 进 Step 6; 否则 → 形成 diff 进 4. (Diff, 分支)
4. **MUST 在 Act 前** 把全量 urls (含未变的) 摆给用户预览, 等用户显式确认; **NEVER** 在未确认时 PATCH. (动作)
5. 若用户不确认 → 终止 reconcile, 记录卡点报告; 否则 → 进 6. (卫语句)
6. 按 [../commands/domain.md](../commands/domain.md) PATCH `urls` 字段, **全量发** 所有 sub-application 域名 (不只发改的那条), 避免半更新. (Act, 动作)

   ```bash
   URLS_JSON='[{"name":"web","url":"https://web.tranfu.com:3000"},{"name":"api","url":"https://api.tranfu.com:4000"}]'
   curl -sS -X PATCH \
     -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d "$(jq -nc --argjson urls "$URLS_JSON" '{urls: $urls}')" \
     "$COOLIFY_BASE_URL/api/v1/services/$COOLIFY_APP_UUID"
   ```

7. Act 后立刻 GET 校验所有 sub-application.fqdn 真变了; 若未变 → 进 8 派发. (失败有出口)
8. 按返回状态路由: 2xx 且校验通过 → 进 Step 6; 422 `domains: not allowed` → 终止并提示字段名错改用 `urls`; 409 域名冲突 → 终止并指向 [../commands/domain.md §"域名冲突"](../commands/domain.md); 200 但 fqdn 不变 → 终止并提示大概率 shape 错 (object-keyed), 改成数组; 否则 → 终止并报未知错. (派发)
9. **产出**: 全量 sub-application.fqdn 集合, 进 Step 6. (显式终止 + 命名产物)

---

## Step 6: Env 变量

1. 拉两端的 key 列表: Coolify 端 envs + 本地端 `.env` (如果有) 或用户指定的 KV 列表. (Check, 动作)

   ```bash
   # Coolify 端
   curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
     "$COOLIFY_BASE_URL/api/v1/services/$COOLIFY_APP_UUID/envs" \
     | jq '[.[] | {uuid, key}]'

   # 本地端 (如果有 .env)
   grep -v '^\s*#' .env 2>/dev/null | grep '=' | cut -d= -f1
   ```

2. 按 [../commands/service-env.md §"对比仓库 .env 与 Coolify 现状"](../commands/service-env.md) 跑对比, 自动 skip key `SERVICE_PASSWORD_*` / `SERVICE_FQDN_*` (Coolify 魔法变量). 形成三类 diff: 缺 key (本地有 Coolify 没) / 多 key (Coolify 有本地没) / 值不同 (hash 比较, 不打明文). (Check → Diff, 动作)
3. 若三类 diff 都为空 → 标 ✓ skip 进 Step 7; 否则 → 进 4. (分支)
4. **MUST 在 Act 前** 把三类 diff 摆给用户预览 (仅 key 名, **CRITICAL: value MUST NEVER 打印到对话**), 等用户显式确认; **NEVER** 在未确认时 POST/PATCH. (动作)
5. 若用户不确认 → 终止 reconcile, 记录卡点报告; 否则 → 进 6. (卫语句)
6. 按 diff 类型派发: 缺 key → `POST /envs`; 值不同 → `PATCH /envs/{env_uuid}`; 多 key → **MUST NEVER 删**, 仅列名告知用户由用户决定. 详见 [../commands/service-env.md](../commands/service-env.md). (Act, 派发)
7. **Act 纪律**: 读 .env 的命令也 NEVER echo 内容. 若任一写操作返回非 2xx → 终止并报失败. (失败有出口)
8. **产出**: service envs 同步, 进 Step 7. (显式终止 + 命名产物)

---

## Step 7: GitHub repo secrets/vars

1. 拉两类清单: repo-level secrets + environment-level vars (按部署分支). (Check, 动作)

   ```bash
   # Repo-level secrets
   gh secret list | awk '{print $1}' | grep -E '^COOLIFY_API_TOKEN$|^COOLIFY_BASE_URL$'

   # Environment-level vars (每个部署分支)
   DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD | sed 's@^origin/@@')
   gh variable list --env "$DEFAULT_BRANCH" | awk '{print $1}' \
     | grep -E '^COOLIFY_APP_UUID$|^IMAGE_TAG_ROLLING$|^IMAGE_TAG_SHA_PREFIX$'
   ```

2. 形成缺项 diff (按下表). 若全在 → 标 ✓ skip 进 Step 8; 否则 → 进 3. (Diff, 分支)

   | 缺什么 | act 命令 |
   |---|---|
   | repo secret `COOLIFY_API_TOKEN` | `gh secret set COOLIFY_API_TOKEN --body "$COOLIFY_API_TOKEN"` |
   | repo secret `COOLIFY_BASE_URL` | `gh secret set COOLIFY_BASE_URL --body "$COOLIFY_BASE_URL"` |
   | environment `$DEFAULT_BRANCH` 不存在 | 让用户去 `https://github.com/$REPO_ORG/$REPO_NAME/settings/environments` 手工建 (gh CLI 不能建 environment) |
   | env var `COOLIFY_APP_UUID` | `gh variable set COOLIFY_APP_UUID --env $DEFAULT_BRANCH --body "$COOLIFY_APP_UUID"` |
   | env var `IMAGE_TAG_ROLLING` | `gh variable set IMAGE_TAG_ROLLING --env $DEFAULT_BRANCH --body "latest"` (默认分支 `latest`, dev 分支 `dev` 等) |
   | env var `IMAGE_TAG_SHA_PREFIX` | `gh variable set IMAGE_TAG_SHA_PREFIX --env $DEFAULT_BRANCH --body ""` (默认分支空字符串, dev 分支 `dev-` 等) |

3. **MUST 在 Act 前** 把缺项 diff 摆给用户预览, 等用户显式确认; **NEVER** 在未确认时跑 `gh secret set` / `gh variable set`. (动作)
4. 若用户不确认 → 终止 reconcile, 记录卡点报告; 否则 → 进 5. (卫语句)
5. 若缺 environment → 终止并给用户 settings URL 让手工建, NEVER 自动建 (gh CLI 不支持); 否则 → 进 6. (卫语句)
6. 按表执行 act 命令. **MUST 用 shell 展开传 token, NEVER 把原文写进命令字符串** (即 `--body "$COOLIFY_API_TOKEN"` 而非 `--body "ghp_xxx..."`). (Act, 动作)
7. 若任一 `gh` 调用失败: gh auth 失效 → 终止并提示 `gh auth refresh`; 否则 → 终止并报失败. (失败有出口)
8. **产出**: GHA secrets/vars 同步, 进 Step 8. (显式终止 + 命名产物)

---

## Step 8: 触发 + 部署链路通

1. 拉两端最新状态: GHA 最近一次 deploy.yml run + Coolify service 当前 status. (Check, 动作)

   ```bash
   # 1. GHA 最近一次 deploy.yml run
   gh run list --workflow=deploy.yml --branch "$DEFAULT_BRANCH" --limit 1 --json status,conclusion,createdAt

   # 2. Coolify service 当前 status
   curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
     "$COOLIFY_BASE_URL/api/v1/services/$COOLIFY_APP_UUID" \
     | jq '{status, applications: [.applications[] | {name, fqdn}]}'
   ```

2. 按 GHA 状态路由: 从未跑过 + Coolify status != running → 进 3 触发; 上一次成功 + Coolify status = running → 标 ✓ skip 进 Step 9; 上一次失败 → 进 5 排障; in_progress → 进 4 轮询; 否则 → 终止并报未知状态. (派发)
3. 没跑过分支: **MUST 在 Act 前** 把"将触发部署"摆给用户, 等用户显式确认; 确认后让用户 `git push` 或跑 `gh workflow run deploy.yml --ref $DEFAULT_BRANCH`. 触发后转 4 轮询. (动作)
4. in_progress 分支: 轮询 status; 若 > 10 分钟仍 in_progress → 终止并报 timeout, 让用户决定 (继续等 / 取消 / 排障); 完成且 conclusion = success → 进 Step 9; conclusion = failure → 进 5. (卫语句)

   ```bash
   gh run watch
   ```

5. 上次失败分支: 跑 `gh run view <run-id> --log-failed` 抓失败 step, 按 [../commands/deploy-trigger.md §"reconcile Step 8"](../commands/deploy-trigger.md) 排障. 常见根因: 测试卡口失败 / docker build 失败 / GHCR auth 失败 / Coolify webhook 401 (token 错). (Act, 动作)
6. 排障后是否重触发由用户决定; 若用户不重试 → 终止并记录卡点报告; 重试 → 回 3. (卫语句)
7. **产出**: 一次 deploy 触发 (GHA conclusion = success + Coolify status = running), 进 Step 9. (显式终止 + 命名产物)

---

## Step 9: 公网域名可访问

1. 拉所有 sub-application.fqdn, 逐个 curl -I 取 HTTP code + curl 退出码. (Check, 动作)

   ```bash
   for FQDN in $(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
     "$COOLIFY_BASE_URL/api/v1/services/$COOLIFY_APP_UUID" | jq -r '.applications[].fqdn'); do
     # strip 容器端口 (公网走 443/80)
     PUBLIC_URL=$(echo "$FQDN" | sed -E 's#:[0-9]+/?$##')
     CODE=$(curl -sS -o /dev/null -w "%{http_code}" -I --max-time 15 "$PUBLIC_URL")
     RC=$?
     echo "$PUBLIC_URL → HTTP=$CODE (curl rc=$RC)"
   done
   ```

2. 按结果路由: 2xx / 3xx → ✓ 该 URL 部署到家; curl 退出码非 0 / 超时 → ✗ 视为 connection 失败终止; 4xx (非 404) → ✗ 按 5xx 处理走 logs; 其余 (404 / 502 / 5xx / DNS / connection refused) → ✗ 进 4 排障. (派发)
3. 若所有 sub-application.fqdn 都 ✓ → 标 ✓ 进收尾; 否则 → 进 4. (分支)
4. 按 HTTP/错误路由排障 (详见 [../commands/deploy-trigger.md §"reconcile Step 9"](../commands/deploy-trigger.md)). (Act, 派发)

   | HTTP/错误 | 大概率根因 | 修哪儿 |
   |---|---|---|
   | 502 | 容器 healthcheck 没过 / 端口对不上 | 走 [../references/coolify-docker-inspection.md](../references/coolify-docker-inspection.md) 抓容器证据 |
   | 404 | traefik 没收到这个域名 | Step 5 urls 没正确同步, 重跑 Step 5 |
   | 4xx (非 404) | 应用路由 / 鉴权层错 | 看 GHA logs / Coolify service logs, 应用代码层面 |
   | 5xx (非 502) | 应用内部错 | 看 GHA logs / Coolify service logs, 应用代码层面 |
   | DNS 失败 | A 记录还没指过来 | 让用户去 DNS 服务商配, 不在 reconcile 范围 |
   | connection refused / curl 超时 | traefik 没在 443 上 | Coolify 实例本身问题, 去 UI 看 / 联系运维 |

5. Act 失败 → 终止, 让用户参考 references 排障. (失败有出口)
6. **产出**: 所有 sub-application.fqdn HTTP 2xx/3xx, 进收尾. (显式终止 + 命名产物)

---

## 收尾

9 个 Step 全 ✓ → reconcile 完成。

输出最终报告：

```
✓ reconcile-deployment 完成
  服务: $SVC_NAME ($COOLIFY_APP_UUID)
  Coolify URL: $COOLIFY_BASE_URL/services/$COOLIFY_APP_UUID
  公网 (全量 sub-application.fqdn):
    - https://web.tranfu.com → HTTP=200
    - https://api.tranfu.com → HTTP=200
  GHA: https://github.com/$REPO_ORG/$REPO_NAME/actions
  最近一次部署: <run-id>, 状态: <conclusion>
```

任一 Step 失败 → 输出"卡在 Step X，原因：..."的报告，让用户决定下一步。

## 反例（不要这么做）

- **不要"只修 Step 5 域名"就 return**——必须从 Step 0 跑完所有 Step，确认全 ✓ 再 return（reconcile 的核心价值就是顺手发现别的不对的地方）
- **不要批量 act**（Step 4 + Step 5 一起 PATCH）——一步一步走，每步 act 完 GET 校验再下一步
- **不要 act 前不给 diff**——所有写动作前必须摆 diff 等用户确认（防止今天 markdown-kits-app compose 简化事故重演）
- **不要因为某一步用户没答应继续就跳过这一步**——明确终止，不静默推进
