---
name: tranfu-coolify-ops
version: 0.6.0
author: aquarius-wing
origin: own
updated_at: 2026-06-30
description: >
  把 tranfu-labs 下的 -app 仓库从源码部署到公司 Coolify 实例 (默认 http://120.77.223.183:8000, 可覆盖)。
  Step 1 入口分流: project 不存在 = 初始化分支 (固定流程: mktemp clone / 四件套合规改造(spawn subagent) /
  创建 project+service / GH secrets+自动建 environment / autonomous push); project 已存在 = 更新分支
  (按用户意图条件触发: A redeploy / B 改域名 / C 改 env / D 改 compose 或源码 / E 改 GH 配置)。
  agent 全程 autonomous, 永远不依赖 user cwd; 共用收尾验 CI + 30s deploy-start 窗口 + 5min 公网轮询。
  作用域硬约束: 只处理用户给的 GitHub URL 对应的那一个 project / service, 同名硬约束
  (REPO_NAME == PROJECT_NAME == SVC_NAME), 不扫描 Coolify 上其他资源。
  触发短语：服务器运维机器人请帮忙部署 / 确认并部署 https://github.com/tranfu-labs/<x>-app、
  把 tranfu-labs/<x>-app 上 coolify、coolify 一下、改下这个项目的域名 / env / compose、
  redeploy / 重新部署 / 重启、部署挂了 / 部署没成功、coolify 上访问不了。
  不要用于：非 tranfu-labs 仓库（命名不合规直接终止）；非公司 Coolify 实例；纯网页 UI 操作
  （如挂 GHCR credential）；与部署无关的代码改造。
---

# tranfu Coolify 部署运维

把 tranfu-labs/<x>-app 端到端部署到公司 Coolify 实例。新项目 / 故障修复 / 临时改动**全部走同一份 reconcile 流程**——流程自己识别要做什么，整套幂等可重跑。

## Token 纪律（硬约束，写在最前面）

`$COOLIFY_API_TOKEN` 是高敏感凭据。**全 skill 范围**遵守：

1. **校验脚本只输出 ✓ / ✗**——长度、前缀都不打（见 [assets/preflight.sh](assets/preflight.sh)）
2. **agent 给 Bash tool 的命令字符串里永远只引用 `$COOLIFY_API_TOKEN` 变量名**——token 原文只在 shell 内展开，不进对话转录
3. **禁止 `echo $COOLIFY_API_TOKEN`** 来"看一眼对不对"——校验只能通过 preflight.sh
4. **gh secret 用 `--body "$COOLIFY_API_TOKEN"`**，不写明文
5. **curl 用 `-H "Authorization: Bearer $COOLIFY_API_TOKEN"`**，不写明文
6. **Coolify 返回的 env value 是明文**——agent 拿来做 diff，**不展示**，hash 比较代替明文显示
7. **用户给的 `.env` 文件**——读完直接打 API，不在对话里 echo 内容

这套纪律比"四件套合规"还硬——违反一次 token 就外泄。

## 心智模型（读一遍再开干）

- **GitHub repo name == Coolify project name == Coolify service name**——三者同名是硬约束。给一个 `https://github.com/tranfu-labs/markdown-kits-app`，立刻派生 `REPO_NAME = PROJECT_NAME = SVC_NAME = markdown-kits-app`，全 skill 围绕这一个锚点定位资源，**不扫描其他 project / 不让用户从列表里挑**
- **Docker Compose Empty = Service 资源**（不是 Application）——UI 上"+New Resource → Services → Docker Compose Empty"，API 走 `/api/v1/services` 命名空间。详见 [references/service-vs-application.md](references/service-vs-application.md)
- **一个 Service = 一份 compose + 内嵌 sub-applications 数组**——compose 里有 N 个 service，sub-applications 数组就有 N 条，每条有独立 uuid + fqdn
- **改域名走 `urls` 字段**（不是 `domains`、不是 `docker_compose_domains`、不是 compose 里 `SERVICE_FQDN_*`）——详见 [references/urls-vs-docker-compose-domains.md](references/urls-vs-docker-compose-domains.md)
- **`SERVICE_FQDN_*` 是 Coolify → 容器的 output**，不是 user → Coolify 的 input——compose 里写 `''` 即可，写真值无效。详见 [references/service-fqdn-trap.md](references/service-fqdn-trap.md)
- **部署链路**：GHA push GHCR → curl `$BASE/api/v1/deploy?uuid=...` → Coolify pull 重启。Coolify 上**关 Auto Deploy on Push / Webhook**，触发权归 workflow。详见 [commands/deploy-trigger.md](commands/deploy-trigger.md)
- **CLI 不靠谱**——Coolify CLI 1.x 命令未文档化，service create 的 type 字段语义不明。本 skill **全部走 HTTP API**，CLI 不依赖

## 唯一流程入口

[`scenarios/reconcile-deployment.md`](scenarios/reconcile-deployment.md)。所有触发都走它。

**Step 0 + Step 1 必跑**, 由 Step 1 入口分流到「初始化部署分支」(固定流程) 或「更新部署分支」(按意图条件触发), 最后两条分支汇合到共用收尾。

### 初始化分支 (project 不存在, 固定流程)

| # | Step | 主要参考 |
|---|---|---|
| 0 | preflight (工具 / 凭据 / Coolify 活性 / 命名 / GHCR ack) | [assets/preflight.sh](assets/preflight.sh) |
| 1 | 同名 project 探测 (入口分流) | [commands/service-crud.md](commands/service-crud.md) |
| 2I | `mktemp -d` 临时目录 + git clone (永远不污染 user cwd) | — |
| 3I | compose 合规 check → 不合规 **spawn subagent** 按规则修源码 | [references/file-generation-rules.md](references/file-generation-rules.md) |
| 4I | 创建 project + service (POST 一次带 compose + urls), 拿 `$SERVICE_UUID` **并明确告知用户** | [commands/service-crud.md](commands/service-crud.md) + [references/coolify-api-fields.md](references/coolify-api-fields.md) |
| 5I | GH secrets + **自动建 environment** (`gh api PUT`) + env vars | [commands/deploy-trigger.md](commands/deploy-trigger.md) §"GitHub 端配置" |
| 6I | service env (POST /envs) | [commands/service-env.md](commands/service-env.md) |
| 7I | agent autonomous `git add + commit + git push` (push 前给用户看 diff stat) | — |

### 更新分支 (project 已存在, agent autonomous, 不依赖 user cwd, 按意图条件触发)

**乐观假设**: project 已部署好。**不主动核对源码 / 不主动改文件 / 不主动 push**, 只按用户意图执行最小 act。

| act | 用户意图关键词 | 做什么 | 主要参考 |
|---|---|---|---|
| **A** | redeploy / 重新部署 / 重启 | POST `/api/v1/deploy?uuid=$SERVICE_UUID` | [commands/deploy-trigger.md](commands/deploy-trigger.md) |
| **B** | 改 / 加 / 删域名 | PATCH `urls` | [commands/domain.md](commands/domain.md) |
| **C** | 改 / 加 / 删 env | POST/PATCH `/envs` + 隐式 A | [commands/service-env.md](commands/service-env.md) |
| **D** | 改 compose / Dockerfile / 改源码 | `mktemp -d` clone + subagent 改 + push + PATCH `docker_compose_raw` | [references/file-generation-rules.md](references/file-generation-rules.md) + [commands/service-crud.md](commands/service-crud.md) |
| **E** | 改 GH secrets/vars | `gh secret set` / `gh variable set` | [commands/deploy-trigger.md](commands/deploy-trigger.md) §"GitHub 端配置" |

意图模糊 → **询问用户**, 不要乱猜或默认 redeploy。

### 共用收尾 (按条件 skip / act)

| # | Step | 必跑 | 跳过 |
|---|---|---|---|
| 8 | 等 GHA + 验 CI 无错 + 无 "缺变量" 类 silent fail | 初始化 / 更新 D 路径 | 更新分支 A/B/C/E 单跑 |
| 9 | 30s 验 Coolify 启动部署, 未启动 → POST `/deploy` fallback | 初始化 / 更新 A/C/D | 更新分支单跑 B (域名 traefik 即时生效) / E |
| 10 | 5min 轮询公网域名 2xx/3xx, 超时报排障入口 | **总跑** | — |

**关键变化（vs 0.4.x）**：

- **agent 主动 git clone + 主动 git push**, 永远不依赖 user cwd (旧设计让 user 自己 cd / push)
- **Step 3I / 更新 D 路径不合规调 subagent 修源码** (旧设计是 reconcile 自己改; subagent 改完明确告知用户改了什么)
- **入口先判"初始化 vs 更新"**, 不再无脑跑全 9 步
- **更新分支按意图条件触发**, 项目已存在 = 乐观假设已部署好, 只做用户指派的事; 不主动核对源码
- **Step 5I 自动建 environment** (`gh api PUT`), 不再让用户去 settings 手工建
- **COOLIFY_BASE_URL 三层 strip 尾斜杠** (preflight / gh secret set / deploy.yml.template 防 `//api` 404)
- **Step 9/10 有窗口与超时** (30s deploy-start + 5min 域名轮询), 不再单次 curl
- **Step 4I 创建 service 后必须明确把 `$SERVICE_UUID` 告知用户** — 这是 GH workflow 配置的关键值

**Act 前一律先把 diff 摆给用户确认** — 动 Coolify 上活资源 / agent autonomous push 前的硬纪律。

## 不做什么

- ✗ 非 tranfu-labs 仓库 / 非公司 Coolify 实例（硬编码假设，扩展前不要套用）
- ✗ 替用户安装 gh / jq / curl
- ✗ **建任意名字的 Coolify project**——只在"同名 project 不存在"时自动建 `$REPO_NAME` 那一个；不让用户挑、不接受其他名字
- ✗ 挂 GHCR registry credential——这是 UI 一次性配置，agent 不替做（per-Coolify 实例只配一次）
- ✗ **要求 user "先 cd 到 repo"**——任何需要源码的 act 都 agent 自己 `mktemp -d` clone
- ✗ 在用户 cwd 直接 clone——必须 `mktemp -d` 临时目录，用完即弃
- ✗ agent 自己改源码——必须 spawn subagent 按 file-generation-rules.md 修, agent 只组装 prompt + 转发结果
- ✗ 更新分支主动核对源码 / 主动 push——project 已存在 = 乐观假设已部署好, 只做用户指派的事
- ✗ 更新分支意图模糊就乱猜或默认 redeploy——询问用户
- ✗ push 前不给用户看 diff——即便 agent autonomous push，diff stat + 文件清单必须先摆出来
- ✗ Coolify UI 上的点击（agent 全走 API）
- ✗ DELETE service / 清空 volume / 删 project（破坏性操作，专门 reference 处理）
- ✗ 多 Coolify 实例 / 多 server 调度（公司目前单实例单 server，硬编码进 [commands/prerequisites.md](commands/prerequisites.md)）
- ✗ **扫描 / 列举 / 操作除当前 repo 对应的那一个 project / service 之外的任何资源**——全程围绕单一锚点
- ✗ Step 10 无限轮询——5min 硬上限，到点就给排障入口
- ✗ `COOLIFY_BASE_URL` 末尾带 `/`——会拼出 `//api/v1/deploy` → Coolify 404; preflight / gh secret set / deploy.yml.template 三层都 strip

## 文件树

```
own-skills/tranfu-coolify-ops/
├── SKILL.md                              ← 本文件
├── assets/
│   ├── preflight.sh                      ← Step 0 一次性全部前置 (独立脚本)
│   └── deploy.yml.template               ← Step 2 GHA workflow 模板
├── scenarios/
│   └── reconcile-deployment.md           ← 唯一流程文档, Step 0/1 入口分流 + 初始化/更新双分支 + 共用收尾
├── commands/                             ← 实际操作速查（curl 命令片段 + CLI ad-hoc）
│   ├── prerequisites.md                  ← Step 0 索引 (preflight.sh 的人话说明)
│   ├── service-crud.md                   ← Step 3-4 (HTTP API)
│   ├── service-env.md                    ← Step 6 (HTTP API)
│   ├── domain.md                         ← Step 5 (HTTP API)
│   ├── deploy-trigger.md                 ← Step 7-9 (HTTP API + GHA)
│   ├── tranfu-naming.md                  ← Step 0 命名约束
│   ├── app.md                            ← CLI ad-hoc 速查 (排障 / 临时操作)
│   ├── context.md                        ← CLI ad-hoc 速查
│   ├── conventions.md                    ← CLI ad-hoc 全局 flag 约定
│   ├── project.md                        ← CLI ad-hoc 速查
│   └── server.md                         ← CLI ad-hoc 速查
└── references/                           ← 心智模型 / 字段语义 / 排障
    ├── service-vs-application.md         ← Service 不是 Application
    ├── service-fqdn-trap.md              ← SERVICE_FQDN_* 是 output 不是 input
    ├── urls-vs-docker-compose-domains.md ← 改域名走 urls, 不是 domains
    ├── coolify-api-fields.md             ← openapi 字段速查
    ├── file-generation-rules.md          ← 四件套生成 / 校验规范
    ├── archived-coolify-deploy.md        ← 旧 coolify-deploy skill 归档说明
    ├── coolify-compose-deploy-failure-triage.md  ← Step 8 排障 (DEPRECATED-CLI)
    ├── coolify-docker-inspection.md      ← Step 9 容器证据采集 (DEPRECATED-CLI)
    ├── coolify-clear-deployments-and-redeploy.md ← 清部署历史 + 重 deploy (DEPRECATED-CLI)
    ├── coolify-disk-capacity-and-prune.md← 服务器磁盘运维 (DEPRECATED-CLI)
    ├── coolify-cli-1.6.2-onboard-quirks.md ← CLI 1.6.2 onboard 怪癖 (ad-hoc)
    └── coolify-env-redeploy.md           ← CLI 改 env + redeploy (ad-hoc)
```

## 完成判据（可观测）

跑完后：

- [ ] 所走分支 (初始化 / 更新) 内的 Step 全 ✓ + 共用收尾 Step 8/9/10 全 ✓
- [ ] 5min 内 `curl -I <public-fqdn>` 返 2xx / 3xx
- [ ] Coolify service status = running
- [ ] GHA 最近一次 deploy.yml run = success + log 无 "missing variable" 类报错
- [ ] 仓库根四件套（Dockerfile / .dockerignore / compose.yml / deploy.yml）全在且合规

任一未达 → 流程中止在对应 Step，按该 Step 的失败文案给用户。

<example>
用户："服务器运维机器人，请帮忙确认并部署项目：https://github.com/tranfu-labs/markdown-kits-app"

正确做法 (初始化部署分支)：
1. create 11 项 TODO (Step 0/1 + Step 2I-7I + Step 8/9/10)
2. Step 0: preflight.sh "https://github.com/tranfu-labs/markdown-kits-app" → 全部 ✓
3. Step 1: GET /api/v1/projects 找 name=`markdown-kits-app` → 没找到 → 走初始化部署分支
4. Step 2I: mktemp -d 临时目录 → git clone → cd
5. Step 3I: bash 跑 compose check → compose.yml 不存在 + Dockerfile 不存在 → spawn subagent 按 file-generation-rules.md 生成四件套 → subagent 回报 "新建: Dockerfile, .dockerignore, compose.yml, .github/workflows/deploy.yml" → 明确告知用户"已按 coolify-deploy 修改源码"
6. Step 4I: POST /api/v1/projects (name=markdown-kits-app) → $PROJECT_UUID; POST /api/v1/services 带 compose + urls + project/server/env → $SERVICE_UUID → 明确告知 "Service: markdown-kits-app ($SERVICE_UUID), Coolify URL: ..."
7. Step 5I: gh secret set COOLIFY_API_TOKEN / COOLIFY_BASE_URL; gh variable set --env main 三条 (COOLIFY_APP_UUID=$SERVICE_UUID 等); environment 不存在 → 给 settings URL 让用户手工建
8. Step 6I: 用户给 .env → POST /envs 逐条加 (值不打印)
9. Step 7I: git add . / git status / git diff --stat 给用户看 → ack → git commit + git push -u origin main
10. Step 8: gh run watch → success, log 无 missing/undefined
11. Step 9: 轮询 30s 看到 status=deploying → ✓ (无需手动触发)
12. Step 10: 轮询 curl -I 公网 → 1min 后返 200 → ✓ 收尾报告
</example>

<example>
用户："markdown-kits-app 改下域名到 board.tranfu.com"

正确做法 (更新分支, B 路径)：
1. Step 0: preflight ✓ (无需 user cwd)
2. Step 1: GET /api/v1/projects 找 name=markdown-kits-app 同名存在 → 走更新分支
3. Step 2U: 意图 = 改域名 → 选 act B
   - GET /api/v1/services/$SERVICE_UUID 拿当前 urls
   - 摆 diff 给用户: "当前 https://markdown-kits-app.tranfu.com:8787 → 期望 https://board.tranfu.com:8787"
   - 用户 ack → PATCH urls → GET 校验 ✓
4. Step 8: 无 push, skip
5. Step 9: 改域名是 traefik 即时生效, 不需要重启容器, skip
6. Step 10: curl -I https://board.tranfu.com → 200 → ✓ 收尾
</example>

<example>
用户："markdown-kits-app 重新部署一下"

正确做法 (更新分支, A 路径)：
1. Step 0/1 → 走更新分支
2. Step 2U: 意图 = redeploy → 选 act A
   - 摆给用户 "将 POST /api/v1/deploy?uuid=$SERVICE_UUID, ack?"
   - ack → POST → 拿 deployment id
3. Step 8: 无 push, skip
4. Step 9: 5s 后看到 status=deploying → ✓ (不需要 fallback POST, 因为 A 就是手工 POST)
5. Step 10: 轮询公网 → 1min 后 200 → ✓
</example>

<example>
用户："markdown-kits-app 加个 env DATABASE_URL=postgres://..."

正确做法 (更新分支, C 路径 = 改 env + 隐式 A redeploy)：
1. Step 0/1 → 走更新分支
2. Step 2U: 意图 = 改 env → 选 act C
   - GET /envs 拿当前列表 (不打印 value, 只 key)
   - 摆 diff: "新增 key=DATABASE_URL (value 隐藏)"
   - 用户 ack → POST /envs → GET 校验 key 在 ✓
   - 隐式 A: POST /api/v1/deploy (env 改了必须 redeploy)
3. Step 8 skip; Step 9 ✓ (看到 deploying); Step 10 ✓
</example>

<example>
用户："markdown-kits-app 部署挂了，帮我看下"

正确做法 (意图模糊 → 询问用户, 不要乱猜)：
1. Step 0/1 → 走更新分支
2. Step 2U: 意图模糊 — "挂了" 可能是任何原因
   - 不要默认 redeploy, 也不要主动核对源码
   - 询问用户: "你要 (a) 看最近一次 GHA / Coolify status 诊断 (b) 直接 redeploy 一下试试 (c) 改某个具体配置 (env / 域名 / compose)?"
3. 若用户选 (a): 跑诊断 (GET service.status / gh run view --log-failed / Coolify service logs), 给报告, 终止
4. 若用户选 (b): 走 A 路径
5. 若用户选 (c): 按具体走 B/C/D
</example>

<example>
用户："markdown-kits-app 的 compose 加个 redis service"

正确做法 (更新分支, D 路径)：
1. Step 0/1 → 走更新分支
2. Step 2U: 意图 = 改 compose → 选 act D
   - mktemp 临时目录 + git clone markdown-kits-app
   - spawn subagent 按 file-generation-rules.md 加 redis service (含 SERVICE_PASSWORD_REDIS 魔法变量, 不写 ports)
   - subagent 返回改了 compose.yml, agent 明确告知改了什么
   - autonomous git add + commit + push (push 前给用户看 diff stat)
   - PATCH /api/v1/services/$SERVICE_UUID 的 docker_compose_raw
3. Step 8: 等 GHA build redis 镜像 (其实 ghcr.io 上 image 不变, 但 deploy.yml 会跑) → success
4. Step 9: 30s 内看到 deploying → ✓
5. Step 10: 轮询公网 → 200 → ✓
</example>

<bad-example>
错误：
(a) 用户给 GitHub URL, agent 没跑 Step 1 入口分流就开始 git clone — 已有 project 时 clone 是浪费, 应该走更新分支
(b) Step 2I / 更新 D 路径在用户 cwd 直接 `git clone` — 污染工作区, 必须 `mktemp -d` 临时目录
(c) 要求 user "先 cd 到 markdown-kits-app repo 再来" — agent autonomous, 永远不依赖 user cwd
(d) Step 3I / 更新 D 路径 agent 自己 Write 四件套文件 — 必须 spawn subagent, agent 不直接改源码
(e) subagent 改完没明确告知用户改了哪些文件 — 必须输出清单 "新建/修改 + 主要改了什么"
(f) Step 4I 创建 service 后只把 $SERVICE_UUID 存到变量, 没告诉用户 — 必须明确报 "Service: $REPO_NAME ($SERVICE_UUID), Coolify URL: ..."
(g) `git push` 前没给用户看 diff stat — 即便 autonomous, push 前 ack 是硬纪律
(h) `gh secret set COOLIFY_API_TOKEN --body "<原文>"` — 必须保持 `$VAR`, 让 shell 展开
(i) Step 9 30s 内没看到部署启动, agent 重新 `git push` 想再触发一次 — fallback 是 `POST /api/v1/deploy`, 不是再 push
(j) Step 10 改成无限轮询 — 5min 硬上限, 到点就报排障入口
(k) Coolify service 已存在但 compose 不对, agent 直接 DELETE 重建 — 应该走更新分支 D 路径 PATCH
(l) 用户的 .env 内容 echo 到对话里 — 永不
(m) Step 1 同名 project 没找到, agent 把所有 project 列出来让用户挑 — 同名约束消除歧义, 没找到走初始化分支自动建
(n) Step 1 找 service 只按 name filter 不带 project_uuid — 跨 project 同名会误命中
(o) 更新分支 agent 主动跑四件套合规核对, 发现 compose 不"完美" 就 spawn subagent 改, push 一堆用户没要求的改动 — project 已存在 = 乐观假设已部署好, **只做用户指派的事**
(p) 更新分支用户说"看下 markdown-kits-app", agent 默认跑 redeploy — 意图模糊必须询问, 不要乱猜
(q) Step 5I 报 "environment '$DEFAULT_BRANCH' 不存在, 请去 settings 手工建" — 用 `gh api -X PUT repos/.../environments/<name>` 自动建, REST API 支持
(r) `gh secret set COOLIFY_BASE_URL --body "http://120.77.223.183:8000/"` — 末尾斜杠会拼出 `//api` Coolify 404, 必须 `${BASE%/}` strip
</bad-example>
