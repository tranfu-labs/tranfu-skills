# 部署流程：初始化 + 更新统一入口

**所有 Coolify 部署相关请求都走这一份**——首次上线 / 改域名 / 改 env / 改 compose / 部署故障都进同一份流程，Step 1 入口分流自动选「初始化部署分支」或「更新部署分支」。

## 设计原则

- **作用域硬约束**：只处理当前 GitHub repo 对应的那一个 project / service，**不扫描、不列举、不操作 Coolify 实例上其他资源**
- **每个 Step 三段**：Check 当前状态 → Diff 期望状态 → Diff 空 skip / 非空 Act
- **整套幂等**：第二次跑、第三次跑都收敛到同一终态
- **Act 前一律先把 diff 摆出来等用户确认**——动 Coolify 上活资源前的硬纪律
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
┌──── project 不存在 ────────┐   ┌──── project 已存在 ────────┐
│ 初始化部署分支             │   │ 更新部署分支               │
│ Step 2I:  git clone 临时   │   │ Step 2U:  复用 cwd          │
│ Step 3I:  compose 合规     │   │ Step 3U:  四件套 + service  │
│           (subagent 修)    │   │           compose / env     │
│ Step 4I:  POST project +   │   │           PATCH 收敛        │
│           service          │   │ Step 4U:  GH secrets/vars   │
│ Step 5I:  GH secrets/vars  │   │           核对              │
│ Step 6I:  service env      │   │ Step 5U:  service env 核对  │
│ Step 7I:  git push         │   │ Step 6U:  git push (若有新  │
│                            │   │           commit)           │
└─────────────┬──────────────┘   └─────────────┬──────────────┘
              ↓                                ↓
              └────────── 共用收尾 ─────────────┘
                  Step 8: 等 GHA + 验 CI 无错
                  Step 9: 30s 内验 Coolify 启动部署
                         (没启动 → POST /deploy fallback)
                  Step 10: 5min 轮询公网域名
```

## TODO list 模板

agent 启动时 create：

```
[ ] Step 0:  preflight
[ ] Step 1:  入口分流 (探同名 project)
[ ] Step 2:  clone / 复用 cwd
[ ] Step 3:  compose 合规 (subagent 修源码)
[ ] Step 4:  Coolify project + service
[ ] Step 5:  GH secrets/vars
[ ] Step 6:  service env
[ ] Step 7:  git push (autonomous)
[ ] Step 8:  等 GHA + 验 CI
[ ] Step 9:  30s 内验 Coolify 启动部署
[ ] Step 10: 5min 轮询公网域名
```

Step 2-7 在初始化分支按 `2I/3I/...` 跑；在更新分支按 `2U/3U/...` 跑（语义见各 Step 内 §I / §U 小节）。

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
# repo-level
gh secret set COOLIFY_API_TOKEN --body "$COOLIFY_API_TOKEN"
gh secret set COOLIFY_BASE_URL  --body "$BASE"

# environment-level (default branch)
DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD | sed 's@^origin/@@')

gh variable set COOLIFY_APP_UUID     --env "$DEFAULT_BRANCH" --body "$SERVICE_UUID"
gh variable set IMAGE_TAG_ROLLING    --env "$DEFAULT_BRANCH" --body "latest"
gh variable set IMAGE_TAG_SHA_PREFIX --env "$DEFAULT_BRANCH" --body ""
```

**Act 纪律**：永远写 `--body "$COOLIFY_API_TOKEN"`，shell 展开，命令字符串本身不含 token 原文。

**Act 失败**：

- environment 不存在 → 输出 `https://github.com/$REPO_ORG/$REPO_NAME/settings/environments` 让用户手工建后回来重跑（`gh` CLI 不支持建 environment）
- gh auth 失效 → `gh auth refresh`

### Step 6I: service env 变量

仓库根有 `.env` → 逐条 POST `/api/v1/services/$SERVICE_UUID/envs`（详见 [../commands/service-env.md](../commands/service-env.md)）。

没有 `.env` → skip（用户后续可以单独补）。

**Act 纪律**：值永不打印到对话；读 `.env` 的命令不 echo 内容。

### Step 7I: git add + commit + push（agent autonomous）

```bash
git add .
git status  # 给用户看一眼要 commit 的文件清单
git diff --cached --stat  # 给用户看 diff stat
```

**Act 前**：把上面两段输出贴给用户，告知"即将 commit + push"，等用户 ack 后执行：

```bash
git commit -m "chore: coolify onboard (tranfu-coolify-ops skill)"
git push -u origin "$DEFAULT_BRANCH"
```

**Act 失败**：

- push rejected (non-fast-forward) → 终止，让用户先 `git pull --rebase`
- auth 失败 → `gh auth refresh` / 检查 origin URL

> 跳到共用收尾 [Step 8](#step-8-等-gha-跑完--验-ci-无错)。

---

## 更新部署分支（Step 2U → Step 6U，project 已存在）

### Step 2U: 复用 cwd

要求用户已经 cd 到目标 repo（preflight Step 0 软警告里若 cwd 不匹配 `$REPO_NAME` 会提示）。cwd 不对 → 终止，让用户 cd 过去再重跑（不替用户切目录，避免覆盖未保存改动）。

### Step 3U: 核对四件套 + service compose + urls

按 [../references/file-generation-rules.md](../references/file-generation-rules.md) 跑四件套合规 check，按 [../commands/service-crud.md](../commands/service-crud.md) §"对比" 比 service `docker_compose_raw` 与本地 compose，按 [../commands/domain.md](../commands/domain.md) 比 sub-application.fqdn 与期望域名。

任一不一致 → diff 给用户 ack → PATCH → GET 校验。

### Step 4U: GH secrets + environment vars 核对

跑 Step 5I 的 check 段（`gh secret list` / `gh variable list --env "$DEFAULT_BRANCH"`），缺什么 set 什么。`$SERVICE_UUID` 由 Step 1 + 双 filter 查到。

### Step 5U: service env 变量核对

跑 [../commands/service-env.md §"对比仓库 .env 与 Coolify 现状"](../commands/service-env.md)，缺补、值不同改、多余只告知。

### Step 6U: git push（仅当有未推 commit）

```bash
DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD | sed 's@^origin/@@')
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$DEFAULT_BRANCH" 2>/dev/null || echo "")

if [ "$LOCAL" != "$REMOTE" ]; then
  # 把 diff stat 给用户看, ack 后 push
  git diff "origin/$DEFAULT_BRANCH..HEAD" --stat
  git push
else
  echo "✓ 无新 commit, skip push"
fi
```

> 跳到共用收尾 [Step 8](#step-8-等-gha-跑完--验-ci-无错)。

---

## 共用收尾（两条分支汇合，Step 8 → Step 10）

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

- **不要忽略 Step 1 入口分流**：project 已存在还跑 Step 2I clone 会把临时目录搞乱 + 跟用户 cwd 不一致
- **不要在用户 cwd 直接 clone**：Step 2I 必须 `mktemp -d`，用完即弃
- **不要 reconcile 自己改源码**：Step 3I 不合规必须 spawn subagent 按 file-generation-rules.md 修；agent 只组装 prompt + 转发 subagent 结果，明确告知用户改了什么
- **不要 Step 3I 改完直接 commit/push**：所有改动累积到 Step 7I 一次性 push
- **不要 Step 7I push 前不给用户看 diff**：即便 D1（agent autonomous），push 前必须摆 diff stat + 文件清单
- **不要 Step 9 看不到部署就重新 git push**：fallback 是 `POST /api/v1/deploy` 主动触发，不是再 push 一次
- **不要 Step 10 改成无限轮询**：5min 硬上限，到点就报排障入口
- **Step 5I environment 不存在不要自动建**：`gh` CLI 不支持，必须让用户去 settings 手工建
- **Step 1 不要列 project 让用户挑**：同名约束消除歧义，没找到就由 Step 4I 自动建
- **Step 1 不要只按 name filter service**（如果走更新分支）：必须 `name + project_uuid` 双重 filter
- **Token 安全**：永不 `echo $COOLIFY_API_TOKEN`、永不在命令字符串里写 token 原文、永不打印 `.env` 内容
