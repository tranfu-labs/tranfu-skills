# 部署流程：初始化 + 更新统一入口

**所有 Coolify 部署相关请求都走这一份**——首次上线 / 改域名 / 改 env / 改 compose / 部署故障都进同一份流程，Step 1 入口分流自动选「初始化部署分支」或「更新部署分支」。

## 设计原则

- **作用域硬约束**：只处理当前 GitHub repo 对应的那一个 project / service，**不扫描、不列举、不操作 Coolify 实例上其他资源**
- **每个 Step 三段**：Check 当前状态 → Diff 期望状态 → Diff 空 skip / 非空 Act
- **整套幂等**：第二次跑、第三次跑都收敛到同一终态
- **全程 autonomous, 中途零停顿**：user 给出 GitHub URL 等初始指令 = 全链路隐式 ack, agent 一路跑到 Step 10 收尾, **不在中途等用户回应**。act 前 GET 当前状态用于事后告知 diff, 不是用于等 ack。**唯一例外**: Step 1 入口后用户意图模糊 (如更新分支只说"看下 X") → 询问意图后继续 autonomous
- **任一 Step act 失败 → 中止**，不静默推进
- **同名硬约束**：`REPO_NAME == PROJECT_NAME == SVC_NAME`，从 GitHub URL 唯一派生

## 工作单元契约

- **输入**：
  - 用户触发语，**必须含一个 GitHub URL**（如 `https://github.com/tranfu-labs/markdown-kits-app`）
  - URL 推导唯一锚点：`REPO_NAME = PROJECT_NAME = SVC_NAME = <x>-app`
  - cwd 不要求事先在 repo——Step 1 决定要不要 clone
- **输出**：所有 Step 全 ✓ + 公网域名 2xx/3xx
- **Ownership**：写动作流程——所有写操作 act 前 diff，act 后 GET 校验
- **完成判据**（可观测）：Step 10 的 `curl -I <public-url>` 5min 内返 2xx / 3xx

## 入口分流（先跑 Step 0 + Step 1，由 Step 1 决定走哪条分支）

```
Step 0: preflight (工具 / 凭据 / Coolify 活性)
   ↓
Step 1: 同名 project 探测
   ↓
┌──── project 不存在 ────────┐   ┌──── project 已存在 ────────────────┐
│ 初始化部署分支 (固定流程)  │   │ 更新部署分支 (按意图条件触发)       │
│ Step 2I:  mktemp + clone   │   │ Step 2U: 按用户意图 act (可组合):   │
│ Step 3I:  compose 合规     │   │   A. redeploy → POST /deploy        │
│           (subagent 修)    │   │   B. 改域名 → PATCH urls            │
│ Step 4I:  POST project +   │   │   C. 改 env → POST envs + A         │
│           service          │   │   D. 改源码/compose →                │
│ Step 5I:  GH secrets +     │   │      mktemp clone + subagent +      │
│           auto env + vars  │   │      push + PATCH compose           │
│ Step 6I:  service env      │   │   E. 改 GH 配置 → gh secret/var set │
│ Step 7I:  autonomous push  │   │ (agent autonomous, 不依赖 user cwd) │
└─────────────┬──────────────┘   └─────────────┬───────────────────────┘
              ↓                                ↓
              └─────── 共用收尾 (按条件 skip / act) ──────┘
                  Step 8: 等 GHA + 验 CI 无错 (仅 push 路径跑)
                  Step 9: 30s 验 Coolify 启动部署 (仅触发部署的 act 跑)
                  Step 10: 5min 轮询公网域名 (总跑)
```

## TODO list 模板

agent 启动时 create — 初始化分支跑全套, 更新分支只 create 涉及到的 act：

**初始化分支 TODO**（project 不存在）：

```
[ ] Step 0:  preflight
[ ] Step 1:  入口分流 → 初始化
[ ] Step 2I: mktemp 临时目录 + git clone
[ ] Step 3I: compose 合规 (不合规 spawn subagent)
[ ] Step 4I: 建 project + service, 告知用户 $SERVICE_UUID
[ ] Step 5I: GH secrets + 自动建 environment + vars
[ ] Step 6I: service env (POST /envs)
[ ] Step 7I: autonomous git push
[ ] Step 8:  等 GHA + 验 CI
[ ] Step 9:  30s 验 Coolify 启动部署
[ ] Step 10: 5min 轮询公网域名
```

**更新分支 TODO**（project 已存在, agent autonomous, 不依赖 user cwd）— 按用户意图条件创建：

```
[ ] Step 0:  preflight
[ ] Step 1:  入口分流 → 更新
[ ] Step 2U: 按意图 act (从 A/B/C/D/E 里挑)
[ ] Step 8:  仅 D 路径跑
[ ] Step 9:  仅 A/C/D 跑
[ ] Step 10: 总跑
```

---

## Step 0: preflight

跑 [`../assets/preflight.sh`](../assets/preflight.sh)，传入 GitHub URL：

```bash
bash <SKILL_ROOT>/assets/preflight.sh "https://github.com/tranfu-labs/<repo>"
```

preflight 覆盖：

- **工具**：`gh / jq / curl / git / base64` 全装
- **GitHub**：`gh auth status` 通 + token scope 含 `'repo'` + 用户对该 repo 有 admin permission
- **Coolify**：`$COOLIFY_API_TOKEN` 存在 + `/api/v1/version` 200 + 写权限探测
- **GHCR**：手工 ack 一次"Coolify UI 已挂 ghcr.io credential"
- **Git (软检查)**：解析 URL 拿 `REPO_ORG / REPO_NAME` + 校验命名（`tranfu-labs/<x>-app`）。**不强制 cwd 在 repo**——首次部署 cwd 还不会在 repo，Step 2I 才 clone

退出码：

| 退出码 | 含义 | 下一步 |
|---|---|---|
| `0` | 全 ✓ | 进 Step 1 |
| `1` | 硬 check ✗（工具 / 凭据 / 命名）| 终止 |
| `2` | 仅 ⚠（GHCR ack 未通过）| 配完 ghcr.io credential 回来重跑 |

输出公共变量：

```
$BASE         = http://120.77.223.183:8000
$SERVER_UUID  = oz7r53ilv7aeaubx7ewuqw0m
$REPO_ORG     = tranfu-labs
$REPO_NAME    = <user-repo>
$PROJECT_NAME = $REPO_NAME
$SVC_NAME     = $REPO_NAME
```

**Token 安全纪律**：preflight.sh 永不打印 token 任何字节。

---

## Step 1: 同名 project 探测（入口分流）

**Check**：

```bash
PROJECT_UUID=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/projects" \
  | jq -r --arg n "$PROJECT_NAME" '.[] | select(.name == $n) | .uuid')

if [ -n "$PROJECT_UUID" ]; then
  echo "✓ Project '$PROJECT_NAME' 已存在: $PROJECT_UUID → 走更新部署分支"
else
  echo "✗ Project '$PROJECT_NAME' 不存在 → 走初始化部署分支"
fi
```

> Coolify API 没暴露 `?name=` filter，list 一次 + jq filter 是唯一方式；但**只接受 name 完全等于 `$PROJECT_NAME` 那一条**，不展示其他 project、不让用户选。

**分流**：

- 存在 → 跳到 [Step 2U](#step-2u-复用-cwd)（更新部署分支）
- 不存在 → 进 [Step 2I](#step-2i-git-clone-到临时目录)（初始化部署分支）

---

## 初始化部署分支（Step 2I → Step 7I）

### Step 2I: git clone 到临时目录

不在 cwd 直接 clone（避免污染用户工作区）：

```bash
WORKDIR=$(mktemp -d -t coolify-onboard-XXXXXX)
git clone "https://github.com/$REPO_ORG/$REPO_NAME.git" "$WORKDIR/$REPO_NAME"
cd "$WORKDIR/$REPO_NAME"
echo "✓ clone 到 $WORKDIR/$REPO_NAME"
```

`mktemp -d` 出的目录 git remote `origin` 完整保留——Step 7I git push 仍走原 GitHub repo。流程结束后用户可以删 `$WORKDIR`。

**Act 失败**：

- clone 失败（404 / auth 拒）→ 终止，让用户检查 repo 可见性 / `gh auth status`

### Step 3I: compose.yml 合规 check（不合规 → spawn subagent 修源码）

**Check**（关键约束：`image` 必须有、`build` 必须没有——Coolify 只拉镜像不构建）：

```bash
COMPOSE_ISSUES=()

[ -f compose.yml ] || COMPOSE_ISSUES+=("缺 compose.yml")

if [ -f compose.yml ]; then
  grep -qE '^\s*build\s*:' compose.yml && COMPOSE_ISSUES+=("compose.yml 含 build: (Coolify 不构建镜像)")
  grep -qE '^\s*image\s*:' compose.yml || COMPOSE_ISSUES+=("compose.yml 缺 image: (Coolify 需要拉镜像)")
fi

for f in Dockerfile .dockerignore .github/workflows/deploy.yml; do
  [ -f "$f" ] || COMPOSE_ISSUES+=("缺 $f")
done

if [ ${#COMPOSE_ISSUES[@]} -gt 0 ]; then
  printf '✗ %s\n' "${COMPOSE_ISSUES[@]}"
fi
```

**Diff**：

- `COMPOSE_ISSUES` 空 → ✓ skip，进 Step 4
- 非空 → 进 Act

**Act**：**spawn subagent 按 [../references/file-generation-rules.md](../references/file-generation-rules.md) 修源码**（agent 自己不直接改文件）：

```
Agent({
  subagent_type: "general-purpose",
  description: "按 coolify-deploy 规则修源码",
  prompt: "你的任务：在 cwd ($WORKDIR/$REPO_NAME) 内, 按照 SKILL_ROOT/own-skills/tranfu-coolify-ops/references/file-generation-rules.md 的规则, 把仓库改造成 Coolify 可部署形态。

  必须满足的硬约束:
  - compose.yml 只写 image: ghcr.io/<org>/<repo>:<tag>, 禁止 build:
  - Dockerfile 多阶段 + HEALTHCHECK 用 runtime 自带工具
  - .dockerignore 包含 node_modules / .git / .env*
  - .github/workflows/deploy.yml 拷贝 SKILL_ROOT/own-skills/tranfu-coolify-ops/assets/deploy.yml.template 并替换 {{DEFAULT_BRANCH}} {{TESTS_STEP}}
  - 端口六处一致 (Dockerfile EXPOSE / 应用 listen / compose expose / compose env PORT / Dockerfile healthcheck / compose healthcheck)

  当前 check 发现的问题:
  ${COMPOSE_ISSUES[@]}

  改完后请输出明确清单: 哪些文件新建 / 哪些修改 / 主要改了什么 (一行一文件), 不要输出整个文件内容。"
})
```

Subagent 返回后，agent 给用户**明确告知**：

```
✓ 已按 coolify-deploy (file-generation-rules.md) 修改源码:
  新建: Dockerfile, .dockerignore, .github/workflows/deploy.yml
  修改: compose.yml (删 build, 改 image: ghcr.io/...)
```

> **不在 Step 3I 做 commit/push**——所有修改累积到 Step 7I 一起 push。

**Act 失败**：subagent 没改成 → 终止，把 subagent 的失败原因贴给用户，让人工干预。

### Step 4I: 创建 Coolify project + service

**前提**：Step 1 已确认 project 不存在；Step 3I 已让源码合规。

**Act**（无 Check 段——入口分流就是基于"project 不存在"）：

```bash
# 4I.1 建同名 project
PROJECT_UUID=$(curl -sS -X POST \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg n "$PROJECT_NAME" '{name: $n}')" \
  "$BASE/api/v1/projects" \
  | jq -r .uuid)

# 4I.2 建同名 service (一次带 compose + urls)
COMPOSE_B64=$(cat compose.yml | base64 | tr -d '\n')
URLS_JSON='[{"name":"'"$SVC_NAME"'","url":"https://'"$SVC_NAME"'.tranfu.com:<port>"}]'  # <port> 从 compose expose 解析

SERVICE_UUID=$(curl -sS -X POST \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc \
    --arg n "$SVC_NAME" \
    --arg p "$PROJECT_UUID" \
    --arg s "$SERVER_UUID" \
    --arg sb "$COMPOSE_B64" \
    --argjson urls "$URLS_JSON" \
    '{name:$n, project_uuid:$p, server_uuid:$s, environment_name:"production", docker_compose_raw:$sb, urls:$urls, instant_deploy:false}')" \
  "$BASE/api/v1/services" \
  | jq -r .uuid)
```

详见 [../commands/service-crud.md](../commands/service-crud.md) §"创建 Docker Compose Empty Service"。

**Act 后明确告知用户**：

```
✓ 已创建 Coolify 资源:
  Project:  $PROJECT_NAME ($PROJECT_UUID)
  Service:  $SVC_NAME ($SERVICE_UUID)
  Coolify URL: $BASE/services/$SERVICE_UUID
  接下来 GH workflow 会用到 COOLIFY_APP_UUID = $SERVICE_UUID, 这个 uuid 也会写入 GH environment vars (Step 5I)。
```

**Act 失败**：

- 400 missing required → 检查 `$PROJECT_UUID` / `$SERVER_UUID` 真存在
- 409 domain conflict → 该域名被别的资源占用，[../commands/domain.md §"域名冲突"](../commands/domain.md)
- 422 → `urls` 必须是数组不是对象、`docker_compose_raw` base64 单行

### Step 5I: GitHub repo secrets + environment vars

```bash
# repo-level secrets (strip 尾斜杠防 //api 404)
gh secret set COOLIFY_API_TOKEN --body "$COOLIFY_API_TOKEN"
gh secret set COOLIFY_BASE_URL  --body "${BASE%/}"

DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD | sed 's@^origin/@@')

# 5I.1 自动建 environment (gh CLI 子命令不支持, gh api 直通 REST API)
gh api -X PUT "repos/$REPO_ORG/$REPO_NAME/environments/$DEFAULT_BRANCH" >/dev/null
echo "✓ environment '$DEFAULT_BRANCH' ready"

# 5I.2 environment-level vars
gh variable set COOLIFY_APP_UUID     --env "$DEFAULT_BRANCH" --body "$SERVICE_UUID"
gh variable set IMAGE_TAG_ROLLING    --env "$DEFAULT_BRANCH" --body "latest"
gh variable set IMAGE_TAG_SHA_PREFIX --env "$DEFAULT_BRANCH" --body ""
```

> environment 自动建走 [`gh api -X PUT repos/{owner}/{repo}/environments/{name}`](https://docs.github.com/en/rest/deployments/environments#create-or-update-an-environment) — REST API 是支持的, 只是 `gh` 没暴露子命令。空 body PUT 即创建 (或 idempotent 更新)。

**Act 纪律**：永远写 `--body "$COOLIFY_API_TOKEN"`，shell 展开，命令字符串本身不含 token 原文。

**Act 失败**：

- `gh api PUT environments/...` 403 → token scope 缺 `repo` 或对该 repo 没 admin (preflight Step 0 已 check, 走到这一步报错说明 token 中途换过)
- gh auth 失效 → `gh auth refresh`

### Step 6I: service env 变量

仓库根有 `.env` → 逐条 POST `/api/v1/services/$SERVICE_UUID/envs`（详见 [../commands/service-env.md](../commands/service-env.md)）。

没有 `.env` → skip（用户后续可以单独补）。

**Act 纪律**：值永不打印到对话；读 `.env` 的命令不 echo 内容。

### Step 7I: git add + commit + push（agent autonomous）

```bash
git add .
git commit -m "chore: coolify onboard (tranfu-coolify-ops skill)"
git push -u origin "$DEFAULT_BRANCH"
```

**Act 后告知** (autonomous, 不等 ack)：把 `git diff --cached --stat`（commit 前抓）+ `git rev-parse HEAD` + push 的 stdout 一并报给用户:

```
✓ 已 commit + push:
  commit: <sha> "chore: coolify onboard ..."
  branch: $DEFAULT_BRANCH
  改了: <文件列表 + 行数>
  GitHub: https://github.com/$REPO_ORG/$REPO_NAME/commit/<sha>
```

**Act 失败**：

- push rejected (non-fast-forward) → 终止，给用户 "需 `git pull --rebase` 后重跑"
- auth 失败 → `gh auth refresh` / 检查 origin URL

> 跳到共用收尾 [Step 8](#step-8-等-gha-跑完--验-ci-无错)。

---

## 更新部署分支（Step 2U，project 已存在）

**乐观假设**：project 已存在 = 已部署好。agent **不主动核对源码 / 不主动改文件 / 不主动 push** — 只按用户原话提炼的意图执行最小 act, 共用收尾自动验。

**agent autonomous, 不依赖 user cwd**：跟初始化分支一样, 任何需要源码的 act 都自己 `mktemp -d` clone, **永远不要求 user "先 cd 到 repo"**。

### Step 2U: 按用户意图条件触发 act（可组合, 可全 skip）

agent 从用户原话提炼意图, 按下表执行对应 act：

| 用户意图关键词 | act 编号 | 做什么 | 主要参考 |
|---|---|---|---|
| `redeploy` / 重新部署 / 重启 / 重新拉镜像 | **A** | POST `/api/v1/deploy?uuid=$SERVICE_UUID&force=false` | [../commands/deploy-trigger.md](../commands/deploy-trigger.md) §"手工触发部署" |
| 改 / 加 / 删域名 | **B** | PATCH `/api/v1/services/$SERVICE_UUID` 改 `urls` 字段 | [../commands/domain.md](../commands/domain.md) |
| 改 / 加 / 删 env 变量 | **C** | POST/PATCH `/api/v1/services/$SERVICE_UUID/envs` → 后接 A (env 改了必须 redeploy 才生效) | [../commands/service-env.md](../commands/service-env.md) |
| 改 compose / Dockerfile / 改源码 / 改 deploy.yml | **D** | `mktemp -d` clone → spawn subagent 按 [../references/file-generation-rules.md](../references/file-generation-rules.md) 改 → autonomous push → PATCH `docker_compose_raw` (若 compose 变了) | [../commands/service-crud.md](../commands/service-crud.md) §"更新 compose" |
| 改 GH secrets / vars | **E** | `gh secret set` / `gh variable set` (按需) | [../commands/deploy-trigger.md](../commands/deploy-trigger.md) §"GitHub 端配置" |
| 用户意图模糊或不在上表 | — | **询问用户具体要做什么**, 不要乱猜更不要默认全跑 |

**纪律 (act 共用)**：

- act 前 GET 当前状态记录 diff (用于事后告知, 不等 ack)
- 直接 act, 完成后 GET 校验真生效, 把 diff + 校验结果一并告知用户
- 多 act 串行执行, 不批量 PATCH (易踩 422 / 难定位错)
- D 路径 push 同 Step 7I — autonomous, 推完告知

**示例 act 组合**：

```
"markdown-kits-app 改下域名到 foo.tranfu.com"      → B
"markdown-kits-app 加个 env DATABASE_URL=..."     → C (含隐式 A)
"markdown-kits-app 重新部署一下"                   → A
"markdown-kits-app 的 compose 加个 redis"          → D
"markdown-kits-app 改完域名再重启一下"             → B + A
```

**不在 Step 2U 做**：

- 不主动核对四件套合规 (project 已存在 = 假设当时合规, 不重审)
- 不主动核对 service compose vs Coolify (假设当时已对齐, 后续若不一致由 D 路径用户主动触发)
- 不主动核对 envs / urls / secrets (除非用户明说要改)

> 任一 act 完跳到共用收尾 [Step 8](#step-8-等-gha-跑完--验-ci-无错)（Step 8/9/10 内部自判断要不要 act, 无需上层 tracking）。

---

## 共用收尾（两条分支汇合，Step 8 → Step 10）

**执行条件矩阵**：每个 Step 看上游 act 是否需要它, 不需要就 skip — 不靠 path tracking, 看 act 自然产物即可。

| Step | 必跑场景 | 跳过场景 |
|---|---|---|
| 8 | 初始化分支 (Step 7I 必 push) / 更新分支 D 路径 (改源码 push) | 更新分支 A/B/C/E 单跑 (没 push) |
| 9 | 初始化分支 / 更新分支 A/C/D (触发了部署) | 更新分支单跑 B (改域名, traefik 即时生效) / 单跑 E (改 GH 配置, 不影响 Coolify) |
| 10 | **总跑** (验公网是真验收) | — |

### Step 8: 等 GHA 跑完 + 验 CI 无错

```bash
# 1. 拿最新 run id (用 git push 之后那个)
RUN_ID=$(gh run list --workflow=deploy.yml --branch "$DEFAULT_BRANCH" --limit 1 \
  --json databaseId --jq '.[0].databaseId')

# 2. 跟到完成
gh run watch "$RUN_ID" --exit-status
RUN_EXIT=$?

# 3. 验 conclusion
CONCLUSION=$(gh run view "$RUN_ID" --json conclusion --jq .conclusion)

# 4. 验 log 无 "缺变量" 类报错 (CI 跑成功但 secret 没设的 silent fail)
LOG_WARN=$(gh run view "$RUN_ID" --log 2>/dev/null \
  | grep -iE "missing|undefined|not set|缺少|未定义|secret.*empty|variable.*empty" \
  | head -10)
```

**Diff**：

- `CONCLUSION == "success"` && `LOG_WARN` 空 → ✓ 进 Step 9
- `CONCLUSION != "success"` → 终止，输出 `gh run view $RUN_ID --log-failed`
- `LOG_WARN` 非空 → 终止，把命中的行贴给用户（通常是 `COOLIFY_APP_UUID` 之类没 set）

### Step 9: 30s 内验 Coolify 启动部署（fallback 手动触发）

```bash
T0=$(date +%s)
DEADLINE=$((T0 + 30))
DEPLOYED=0

while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  STATUS=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    "$BASE/api/v1/services/$SERVICE_UUID" | jq -r .status)

  case "$STATUS" in
    deploying|starting|running)
      echo "✓ Coolify 已启动部署 (status=$STATUS)"
      DEPLOYED=1; break ;;
  esac
  sleep 5
done

if [ "$DEPLOYED" = "0" ]; then
  echo "⚠ 30s 内 Coolify 没启动部署 — fallback 手动触发"
  curl -sSL --fail-with-body -X POST \
    -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    "$BASE/api/v1/deploy?uuid=$SERVICE_UUID&force=false"
fi
```

**Diff / Act**：

- 30s 内启动 → ✓
- 未启动 + 手动 POST 200 → ✓（webhook 失灵，但 fallback 救了）
- 手动 POST 非 200 → 终止，看 [../commands/deploy-trigger.md](../commands/deploy-trigger.md) 排障

### Step 10: 5min 轮询公网域名

```bash
FQDN=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services/$SERVICE_UUID" | jq -r '.applications[0].fqdn')
PUBLIC_URL=$(echo "$FQDN" | sed -E 's#:[0-9]+/?$##')  # 公网走 443，strip 容器端口

T0=$(date +%s)
DEADLINE=$((T0 + 300))  # 5min
LAST_CODE="000"

while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  LAST_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -I --max-time 10 "$PUBLIC_URL" || echo "000")
  case "$LAST_CODE" in
    2*|3*)
      echo "✓ $PUBLIC_URL → HTTP $LAST_CODE"
      exit 0 ;;
  esac
  sleep 10
done

echo "✗ 5min 超时, 公网仍不可访问 ($PUBLIC_URL → HTTP $LAST_CODE)"
exit 1
```

**5min 超时 → 终止**，给排障入口（详见 [../commands/deploy-trigger.md §"reconcile Step 9"](../commands/deploy-trigger.md)）：

| HTTP/错误 | 大概率根因 | 修哪儿 |
|---|---|---|
| 502 | healthcheck 没过 / 端口对不上 | [../references/coolify-docker-inspection.md](../references/coolify-docker-inspection.md) |
| 404 | traefik 没收到这个域名 | 重跑 Step 3U / Step 4I（urls 没同步）|
| 5xx (非 502) | 应用内部错 | Coolify service logs / 应用代码 |
| DNS 失败 | A 记录没指过来 | DNS 服务商配，不在 reconcile 范围 |
| connection refused | traefik 没在 443 | Coolify 实例本身问题，去 UI 看 |

---

## 收尾报告

全 Step ✓ → 输出：

```
✓ 部署完成
  分支:        初始化 / 更新
  Service:     $SVC_NAME ($SERVICE_UUID)
  Coolify URL: $BASE/services/$SERVICE_UUID
  公网:        $PUBLIC_URL → HTTP 2xx/3xx
  GHA:         https://github.com/$REPO_ORG/$REPO_NAME/actions/runs/$RUN_ID
```

任一 Step 失败 → "卡在 Step X，原因：..." 的报告，让用户决定下一步。

## 反例

- **不要忽略 Step 1 入口分流**：project 已存在还跑 Step 2I clone 是浪费 + 跟用户预期不一致
- **不要在用户 cwd 直接 clone**：Step 2I / 更新分支 D 路径必须 `mktemp -d`，用完即弃 — **永远不要求 user "先 cd 到 repo"**
- **更新分支不要主动核对源码 / 不要主动 push**：project 已存在 = 乐观假设已部署好, 只处理用户指派的任务; 主动 PR 一堆"我顺手改了你的 Dockerfile"是事故
- **更新分支 Step 2U 意图模糊不要乱猜**：用户说"看下 markdown-kits-app", 不要默认跑 redeploy; 询问"你想 redeploy / 改域名 / 改 env 还是别的?"
- **不要 reconcile 自己改源码**：Step 3I / 更新分支 D 路径不合规必须 spawn subagent 按 file-generation-rules.md 修；agent 只组装 prompt + 转发结果，明确告知用户改了什么
- **不要 Step 3I 改完直接 commit/push**：初始化分支所有改动累积到 Step 7I 一次性 push
- **不要 push 前停下等 ack**：autonomous 的意思是直接 push, 推完把 commit sha / diff stat / GitHub link 一并告知。user 已经在初始指令里 ack 了整条链路, 中途再问是浪费 user 注意力 (user 给完指令往往离线了, 回不来卡死流程)
- **不要 Step 9 看不到部署就重新 git push**：fallback 是 `POST /api/v1/deploy` 主动触发，不是再 push 一次
- **不要 Step 10 改成无限轮询**：5min 硬上限，到点就报排障入口
- **不要让用户去 settings 手工建 environment**：Step 5I 用 `gh api -X PUT repos/.../environments/<name>` 自动建, REST API 是支持的, gh CLI 只是没暴露子命令
- **Step 1 不要列 project 让用户挑**：同名约束消除歧义，没找到就由 Step 4I 自动建
- **Step 1 不要只按 name filter service**（如果走更新分支）：必须 `name + project_uuid` 双重 filter
- **COOLIFY_BASE_URL 末尾不要带 `/`**：会拼出 `//api/v1/deploy` → Coolify 404; preflight + gh secret set + deploy.yml template 三层都 strip
- **Token 安全**：永不 `echo $COOLIFY_API_TOKEN`、永不在命令字符串里写 token 原文、永不打印 `.env` 内容
