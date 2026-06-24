# 场景：onboard 新 app

把 tranfu-labs 组织下、命名合规的 GitHub 仓库通过 GitHub App 路径接入 Coolify，
**先预检 + 让用户确认参数，再写域名 / env / 触发部署**——避免直接部署后再发现参数缺失的来回反复。

整套流程「先断言、后写、后部署」，分三阶段：

- **Phase 1 · 预检与讨论**：拿前置、自动选 GH App、create app（**不部署**）、拉 compose 内容、
  列「部署预览」、收 env 值、等用户确认。
- **Phase 2 · 写配置**：写域名（PATCH API）、写 env（循环 update/create）。
- **Phase 3 · 触发部署 + 跟 logs**。

任一硬断言失败立即终止，不替用户绕过、不替用户清理。

## 触发

- 用户给一个 `https://github.com/tranfu-labs/<x>-app` 链接 + 表达「部署 / 上线 / 跑起来 / 接到 coolify / onboard」意图。
- 用户说"把这个新仓库挂到 coolify"、"上 coolify 新应用"、"在 coolify 建个新 app 用 GitHub App 部署"等。

## 不触发

- 仓库不在 tranfu-labs 组织下。
- 仓库名不匹配 `^[a-z][a-z0-9-]*-app$`。
- 用户想用 public 仓库 / deploy-key / Dockerfile / docker image 路径部署。
- 已有同名 app 需要重新部署 / 改配置（走 `references/existing-app-redeploy.md` 等）。

## 输入

- `${input-url}`：用户提供的 GitHub 仓库 URL。
- **（可选）** 用户在触发时贴的 `.env` 文本——优先用，没贴在 Step 6 循环索要。
- **（可选）** 用户在触发语里指定的非 main 分支、或非 `<prefix>-app.tranfu.com` 自定义域名。

## 输出

- `${app-uuid}`、`${deployment-uuid}`、首次部署 logs 的流式入口。

## 设计动机（为什么 create 提前到 Phase 1）

agent 默认运行在「没装 gh、没存 git credential」的环境，**无法直接读 GitHub 私有仓库源文件**。
让 Coolify 替我们 git fetch：create app（不带 `--instant-deploy`）后，Coolify 会拉一次仓库元信息
并把 compose 内容存进 `docker_compose_raw` 字段——agent 通过 API/CLI 读取这个字段就拿到了
所有 services / ports / env names，不需要在 agent 机上配任何 GitHub 凭证。

代价：用户在 Step 6 预检阶段反悔时，已创建的 app 留在 Coolify 上为未部署状态——
**绝不替用户删 app**（破坏性），给出明确的删除命令让用户确认后自己跑（见 Step 6.5 终止文案）。

## 流程

CREATE A TODO LIST FOR THE TASKS BELOW（下面 Phase 1 → Phase 2 → Phase 3 的每一步建一条 TODO），并在每步完成后更新状态。

---

### Phase 1 · 预检与讨论

#### Step 0 — 前置就绪

跳到 `commands/prerequisites.md` 跑 Step A + Step B。拿到 `${context}`、`${server-uuid}` 后回到本场景继续。

#### Step 1 — 解析并校验 GitHub URL

跳到 `commands/tranfu-naming.md` 解析 + 双重校验：

- 解析出 `${org}`、`${repo}`。
- 断言 `${org} == "tranfu-labs"`。
- 断言 `${repo}` 匹配 `^[a-z][a-z0-9-]*-app$`。
- `${project-name} = ${repo}`、`${prefix} = ${repo%-app}`（去掉 `-app` 后缀，用于域名模板）。

任一不过按 `tranfu-naming.md` 的终止文案返回。

#### Step 2 — 检查 Coolify 里是否已有同名 app

```bash
coolify app list --context="${context}" --format json \
  | jq -e --arg name "${repo}" '.[] | select(.name == $name)'
```

命中即终止，**不要替用户删除**（破坏性）。返回文案：

> Coolify 上已经有一个名为 `${repo}` 的 app（context=`${context}`），UUID=`<uuid>`。
> 用 `coolify app get --context="${context}" <uuid>` 查看现状。
> 重新部署走 `references/existing-app-redeploy.md`；
> 确实要先删再建：`coolify app delete --context="${context}" <uuid>` 然后去网页 UI 删 project，
> 再回来跑本流程（破坏性，请确认）。

#### Step 3 — 找 / 建 project（name == repo）

```bash
PROJECT_UUID=$(coolify project list --context="${context}" --format json \
  | jq -r --arg name "${repo}" '.[] | select(.name == $name) | .uuid')
```

非空 → 复用；空 → 用 create 建：

```bash
coolify project create --context="${context}" --name "${repo}"
PROJECT_UUID=$(coolify project list --context="${context}" --format json \
  | jq -r --arg name "${repo}" '.[] | select(.name == $name) | .uuid')
```

如果 create 后再 list 仍然拿不到，终止人工排查。

#### Step 4 — 自动选 GitHub App（按 organization=tranfu-labs）

```bash
GH_LIST=$(coolify github list --context="${context}" --format json)
GH_COUNT=$(echo "$GH_LIST" | jq 'length')
```

- `GH_COUNT == 0`：终止。返回文案：
  > 当前 context (`${context}`) 上没有 GitHub App 集成。
  > 先用 `coolify github create --context="${context}" ...` 配一个，再跑本流程。
- `GH_COUNT >= 1`：**按 organization 自动挑**，不让用户选：
  ```bash
  GITHUB_APP_UUID=$(echo "$GH_LIST" \
    | jq -r '[.[] | select(.organization=="tranfu-labs")] | .[0].uuid')
  ```
  - 唯一匹配 → 直接用，告知用户「已自动选 organization=tranfu-labs 的 GitHub App `${GITHUB_APP_UUID}`」。
  - **零匹配**（`null` 或空）→ 终止。返回文案：
    > 当前 context (`${context}`) 上有 ${GH_COUNT} 个 GitHub App，但**没有任何一个** organization 是 `tranfu-labs`。
    > 列出来人工核对：
    > （列出 `coolify github list --context="${context}"` 的 name + uuid + organization）
    > tranfu 团队约定 GitHub App 的 organization 必须是 tranfu-labs，请先在 Coolify 里把对应的 GitHub App
    > 配齐 organization 字段，或显式告诉我目标 `github-app-uuid` 再跑本流程。
  - **多匹配**（有 ≥2 个 organization 都是 tranfu-labs，极小概率）→ 终止，列出让用户决定。

> 为什么不让用户选：tranfu 团队约定 organization 字段就是单一信号，**有一个匹配就直接用**——
> 让 agent 静默挑掉「user 选 organization」这步，避免每次部署都让用户在两个无差别的选项里点一下。

#### Step 5 — 校验该 GitHub App 能看到这个仓库

```bash
coolify github repos --context="${context}" "${GITHUB_APP_UUID}" --format json \
  | jq -e --arg fullname "tranfu-labs/${repo}" \
      '.[] | select(.full_name == $fullname)' > /dev/null
```

退出码 1 → 终止：

> Coolify 的 GitHub App `${GITHUB_APP_UUID}`（context=`${context}`）看不到 `tranfu-labs/${repo}`。
> 去 https://github.com/organizations/tranfu-labs/settings/installations 把这个仓库
> 加进 GitHub App 的可访问列表，再跑本流程。

#### Step 6 — create app（**不部署**）+ 拉 compose + 出预览 + 收 env

这是 Phase 1 的核心步骤。**与原 Step 6 的关键差异：去掉 `--instant-deploy`**。Coolify 创建后会
自动 git fetch 仓库元信息，我们再轮询读 compose 内容、出预览、收 env，最后才让用户拍板部署。

##### Step 6.1 — create（不带 --instant-deploy）

```bash
coolify app create github \
  --context="${context}" \
  --name "${repo}" \
  --project-uuid "${PROJECT_UUID}" \
  --server-uuid "${SERVER_UUID}" \
  --github-app-uuid "${GITHUB_APP_UUID}" \
  --git-repository "tranfu-labs/${repo}" \
  --git-branch "${BRANCH:-main}" \
  --build-pack dockercompose \
  --ports-exposes 80
```

固定坑（同原流程）：

- **`--ports-exposes 80` 必填占位**：CLI schema required，dockercompose 模式下不真正生效。
- **`--docker-compose-location` 不传**（CLI 不暴露，约定 `compose.yml` 在仓库根）。**NEVER 传空字符串**。
- **`--git-branch` 默认 `main`**：用户在触发语里明说 `develop` 之类才覆盖。

`--instant-deploy` 已**故意去掉**——本步只创建 app 记录，不触发部署。

##### Step 6.2 — 拿 APP_UUID

```bash
APP_UUID=$(coolify app list --context="${context}" --format json \
  | jq -r --arg name "${repo}" '.[] | select(.name == $name) | .uuid')
```

##### Step 6.3 — 验证 create 没意外触发部署

```bash
sleep 3
DEP_COUNT=$(coolify app deployments list --context="${context}" "${APP_UUID}" --format json | jq 'length')
```

- `DEP_COUNT == 0` → 通过，进入 Step 6.4。
- `DEP_COUNT > 0` → Coolify 在 create 时意外排了部署（理论上不该发生）。**立即取消**最新一条
  以避免在没写域名 / env 的情况下跑空部署：
  ```bash
  EXTRA_DEP=$(coolify app deployments list --context="${context}" "${APP_UUID}" --format json \
    | jq -r 'sort_by(.created_at // .id) | last | (.uuid // .deployment_uuid // .id)')
  coolify deploy cancel --context="${context}" "${EXTRA_DEP}" --force
  ```
  取消后报给用户 `已自动取消 create 触发的部署 ${EXTRA_DEP}`，继续 Step 6.4。

##### Step 6.4 — 轮询 docker_compose_raw（让 Coolify 替我们 git fetch）

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  RAW=$(coolify app get --context="${context}" "${APP_UUID}" --format json \
        | jq -r '.docker_compose_raw // .docker_compose // empty')
  [ -n "$RAW" ] && break
  sleep 3
done
```

10 次（~30s）仍为空 → 终止：

> create 后 30s 内 Coolify 还没拉到 `tranfu-labs/${repo}` 的 compose.yml。可能 GitHub App 凭证
> 失效或仓库根没有 `compose.yml`。先在网页 UI 里看 app 的 logs / source 标签确认，再决定下一步。
> 已创建的 app UUID=`${APP_UUID}`，回滚跑 `coolify app delete --context="${context}" ${APP_UUID}`
> （破坏性，请确认）。

##### Step 6.5 — 解析 compose + 推默认域名 + 出「部署预览」

按 tranfu 约定，compose.yml 的前端 service 名为 `web`、后端为 `api`。从 `$RAW` 解析：

- services 列表（顶层 `services:` 的 keys）。
- `web` service 的 expose 端口 → `${WEB_PORT}`。
- `api` service 的 expose 端口 → `${API_PORT}`。
- 所有 `${VAR_NAME}` 引用 → 去重得 `${ENV_NAME_LIST}`。

（解析用 yq 或 grep + sed 都行；agent 选自己环境里有的工具，**不要写 python 脚本**。）

把下面这份「部署预览」展示给用户：

```
准备在 context=${context} 上 onboard tranfu-labs/${repo}：

【自动准备的参数】（不需要你提供）
- context           : ${context}              ← default context
- server-uuid       : ${SERVER_UUID}          ← 唯一一台 server
- project           : ${repo}                 ← 复用现有 / 新建
- github-app-uuid   : ${GITHUB_APP_UUID}      ← organization=tranfu-labs
- name              : ${repo}
- git branch        : ${BRANCH:-main}         ← 想用别的分支告诉我
- build-pack        : dockercompose
- ports-exposes     : 80 (CLI required 占位)
- docker-compose-location : (不传，约定根目录 compose.yml)
- app 已创建        : APP_UUID=${APP_UUID}    ← 已存在 Coolify 上，未部署

【从 compose.yml 解析】（已由 Coolify git fetch）
- services : <列出所有 service 名>
- web 端口 : ${WEB_PORT}
- api 端口 : ${API_PORT}
- env 名   : <列出 ENV_NAME_LIST>

【默认域名（可改）】
- web → https://${prefix}-app.tranfu.com:${WEB_PORT}
- api → https://${prefix}-api-app.tranfu.com:${API_PORT}
（compose 里有 web / api 以外的 service → 列出来让用户决定是否要域名）

【需要你提供】
- <列出 ENV_NAME_LIST 每个变量，等号留空>
（敏感值不会回显，只验证 key 名和 value 长度）

确认按这份预览部署，回复「确认」；要改域名 / 分支 / 跳过某个 env，告诉我。
```

##### Step 6.6 — 收 env 值

- 用户在触发语里**已贴了 `.env` 文本** → 解析，对 `${ENV_NAME_LIST}` 里每个 NAME 查值，缺失值的 NAME 单独列出来再问。
- **没贴** → 循环索要：
  > 请提供下面 N 个 env 的值（敏感值不会回显，写完即用即丢，不会落盘）：
  > - ALPHAOS_JWT_SECRET = ?
  > - UNKEY_ROOT_KEY = ?
  > - ...

把收齐的值写入临时变量 `ENV_VALS`（不要落盘到任何文件，不要 echo 出来）。

##### Step 6.7 — 等用户确认

用户回复「确认」或等价表达才进 Phase 2。

用户反悔 / 改主意（不部署、要换 repo、要改方案等）→ 终止：

> 已在 Coolify 上创建 app `${repo}`（UUID=`${APP_UUID}`），状态为未部署。
> 要回滚跑 `coolify app delete --context="${context}" ${APP_UUID}`
> （以及去网页 UI 删 project `${repo}`，CLI 不暴露 `project delete`）。
> **破坏性，请你自己确认后跑**，我不替你删。

---

### Phase 2 · 写配置

#### Step 7 — 写 docker_compose_domains（curl + jq，不用 python）

context 的 base url + token 取法：优先试 `coolify context list --format json` 看 url/token 是否暴露；
没有则查本机 coolify 配置目录（路径以本机为准）。

**用前必校**：在跑下面任何 curl 之前 MUST 先断言 `BASE` 与 `TOKEN` 都非空且 `BASE` 形如 `https://...`；
任一为空或不合法 → 立即终止，提示用户去 `coolify context list` 或本机 coolify 配置目录里取，**不要**用空值跑 curl。

**安全硬约束**：MUST NEVER 把 `TOKEN` 原文写进日志、stdout、final reply、错误提示或任何用户可见输出；
MUST NEVER 把 `TOKEN` 拼进 URL 查询串；curl 的 `-H "Authorization: Bearer ${TOKEN}"` 之外不要再以任何形式回显。

```bash
BASE="<context fqdn>"   # 例如 https://coolify.tranfu.com
TOKEN="<context token>"
# 用前必校：BASE/TOKEN 任一为空或 BASE 非 https:// 开头 → 终止
[ -n "$BASE" ] && [ -n "$TOKEN" ] && [[ "$BASE" == https://* ]] || {
  echo "BASE/TOKEN 取不到，去 coolify context list 或本机 coolify 配置目录取后再跑本步" >&2
  exit 1
}

curl -sS -X PATCH "${BASE%/}/api/v1/applications/${APP_UUID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc \
        --arg web "https://${prefix}-app.tranfu.com:${WEB_PORT}" \
        --arg api "https://${prefix}-api-app.tranfu.com:${API_PORT}" \
        '{docker_compose_domains:[{name:"web",domain:$web},{name:"api",domain:$api}]}')"
```

验证（CLI 1.6.2 可能仍显示 `null`，必须用 API GET 核对）：

```bash
curl -sS "${BASE%/}/api/v1/applications/${APP_UUID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/json" \
  | jq '.docker_compose_domains'
```

更多细节见 `references/coolify-dockercompose-domains.md`。

#### Step 8 — 写 env（循环 update/create）

对 Step 6.6 收齐的每个 `KEY=VAL`：

```bash
for KEY in "${!ENV_VALS[@]}"; do
  VAL="${ENV_VALS[$KEY]}"
  coolify app env update --context="${context}" "${APP_UUID}" "$KEY" --value "$VAL" --is-literal >/dev/null 2>&1 \
    || coolify app env create --context="${context}" "${APP_UUID}" --key "$KEY" --value "$VAL" --is-literal >/dev/null
  printf 'wrote %s len=%s\n' "$KEY" "${#VAL}"
done
```

验证（只显示 key 名和长度，不显示值）：

```bash
coolify app env list --context="${context}" "${APP_UUID}" --format json --show-sensitive \
  | jq 'map({key:(.key // .name // .variable),
             is_literal,
             value_len:((.value // .real_value // "")|tostring|length)})'
```

更多细节（变量引用循环检测等）见 `references/coolify-env-redeploy.md`。

---

### Phase 3 · 触发部署 + 跟 logs

#### Step 9 — 触发部署

```bash
coolify app start --context="${context}" "${APP_UUID}" --force
```

#### Step 10 — 跟踪部署 logs

```bash
sleep 3
DEPLOYMENT_UUID=$(coolify app deployments list --context="${context}" "${APP_UUID}" --format json \
  | jq -r 'sort_by(.created_at // .id) | last | .uuid')
```

为空 / `null` → 部署没排上：

> `coolify app start --force` 后 deployments list 末尾仍为空，部署未排上。
> 跑 `coolify app deployments list --context="${context}" "${APP_UUID}" --format pretty`
> 看原始输出，并检查 `references/coolify-clear-deployments-and-redeploy.md` 是否有阻塞中的旧 deployment。

拿到 `${DEPLOYMENT_UUID}` 后流式跟日志：

```bash
coolify app deployments logs --context="${context}" "${APP_UUID}" "${DEPLOYMENT_UUID}" --follow
```

需要 Coolify 内部操作可视化时加 `--debuglogs`。

**完成标准**：拿到 `${APP_UUID}` + `${DEPLOYMENT_UUID}` + logs 流式入口能跟到 build 阶段输出，
**即视为 onboard 完成**。最终是否 `running:healthy` 由用户在 logs 流里观察。

部署失败的排障走 `scenarios/troubleshoot-deploy.md`（待实现）。

---

## 验收用例

跑完 skill 后，应该满足以下用例的预期行为：

| 编号 | 输入 / 状态 | 期望 |
|---|---|---|
| 1 | `tranfu-labs/foo-app` + 所有前置 OK + Coolify 上没同名 app + compose 有 web/api 两个 service + env 列表非空 | 走完 Phase 1（出预览 + 收 env）→ Phase 2（写域名 + 写 env）→ Phase 3（DEPLOY + 跟 logs） |
| 2 | `other-org/foo-app` | Step 1 终止，提示组织不对 |
| 3 | `tranfu-labs/Foo_App`（含大写、含下划线） | Step 1 终止，提示命名不合规 |
| 4 | `tranfu-labs/foo-app` 但 Coolify 已有同名 app | Step 2 终止，给出现有 UUID，不替用户删 |
| 5 | Coolify 上没 server | Step 0 终止（在 prerequisites Step B） |
| 6 | Coolify 上有 2 台 server | Step 0 终止，列出 server 让用户决定 |
| 7 | 没 GitHub App | Step 4 终止，提示先 `coolify github create` |
| 8 | 有 2 个 GitHub App，其一 organization=tranfu-labs，其一为空 | Step 4 **自动选** tranfu-labs 那个，不问用户 |
| 9 | 有 2 个 GitHub App，都没有 organization=tranfu-labs | Step 4 终止，列出让用户决定 |
| 10 | GitHub App 没把 `tranfu-labs/foo-app` 加进可访问列表 | Step 5 终止，给出 installations 设置链接 |
| 11 | `tranfu-labs/foo-app` + Coolify 上 project `foo-app` 已存在 | Step 3 复用现有 project，不调 `project create` |
| 12 | create app 后 30s 仍拿不到 `docker_compose_raw` | Step 6.4 终止，提示去网页 UI 看 source 标签 + 给出回滚命令 |
| 13 | create app 时意外排了部署（DEP_COUNT > 0） | Step 6.3 自动 cancel 该 deployment，继续 Step 6.4 |
| 14 | compose 里只有 web 没有 api（或反之） | Step 6.5 默认只推已存在的那一项域名；缺失的 service 不强制推 |
| 15 | compose 里有 web/api 之外的 service（如 `worker`） | Step 6.5 在预览里列出来，问用户是否要域名 |
| 16 | 用户在触发语里贴了 `.env` 文本 | Step 6.6 直接解析；只对 compose 引用了但 `.env` 缺失的 NAME 循环索要 |
| 17 | 用户在 Step 6.5 把默认域名改了一个 | Step 7 按用户给的域名 PATCH |
| 18 | 用户在 Step 6.7 不确认（反悔） | 终止，给出 `coolify app delete` 命令但**不替用户删** |
| 19 | Step 9 触发后 deployment 长时间 queued | 提示走 `references/coolify-clear-deployments-and-redeploy.md` 流程 |

<example>
用户：把 https://github.com/tranfu-labs/order-mgmt-app 部署到 coolify。下面是 .env：
ALPHAOS_JWT_SECRET=...（用户在触发时一并贴了）
UNKEY_ROOT_KEY=...

执行：

**Phase 1**
- Step 0: `coolify context list --format json` 读到 default=`local-coolify`，直接用，不问用户。
  Server count=1，`SERVER_UUID=11111111-...`。
- Step 1: org=tranfu-labs，repo=order-mgmt-app，prefix=order-mgmt。
- Step 2: 同名 app 不存在，通过。
- Step 3: project 不存在 → create → `PROJECT_UUID=22222222-...`。
- Step 4: GH 列表 2 个，其一 organization=tranfu-labs，自动挑出 `GITHUB_APP_UUID=33333333-...`，告知用户。
- Step 5: GH App 能看到仓库，通过。
- Step 6.1: `coolify app create github ...`（无 `--instant-deploy`）成功。
- Step 6.2: `APP_UUID=44444444-...`。
- Step 6.3: DEP_COUNT=0，通过。
- Step 6.4: 第 2 次轮询（~6s）拿到 `docker_compose_raw`。
- Step 6.5: 解析 → services=[web, api]，web 端口 3300，api 端口 8000，
  env names=[ALPHAOS_JWT_SECRET, UNKEY_ROOT_KEY]。默认域名
  `https://order-mgmt-app.tranfu.com:3300`、`https://order-mgmt-api-app.tranfu.com:8000`。
  出预览给用户。
- Step 6.6: 用户已贴 `.env`，两个 env 都齐，跳过循环。
- Step 6.7: 用户回「确认」。

**Phase 2**
- Step 7: `BASE=https://coolify.tranfu.com`、`TOKEN=<read>`，
  PATCH `docker_compose_domains`，GET 验证返回写入的两个域名。
- Step 8: 循环 `coolify app env update/create` 写两个 env，list 验证 `value_len > 0`。

**Phase 3**
- Step 9: `coolify app start --force`。
- Step 10: `DEPLOYMENT_UUID=55555555-...`，`deployments logs --follow` 看到 build → run → service started。

完成。
</example>

<bad-example>
错误做法 1：用户给了 URL，agent 直接跑 `coolify app create github ... --instant-deploy`，没拉 compose、
没问 env、没写域名，直接部署。

后果：部署起来后报缺 env / 没域名访问不到，又得手动 `coolify app env create` + 写域名 + redeploy，
最少多花 2 轮往返。本场景的整个分阶段设计就是为了避免这种来回。

错误做法 2：在 Phase 1 拉 compose 时，agent 自作主张 `git clone tranfu-labs/<repo>` 或
跑 `gh api repos/...` —— 默认 agent 环境没装 gh、没存 git credential，会直接失败；
更糟糕的是 agent 自己装 gh / 配 token 把凭证留在了服务器上。

正确做法：始终走「create app → 让 Coolify git fetch → 轮询 `docker_compose_raw`」这条路，
agent 不接触 GitHub 凭证。

错误做法 3：Step 6.7 用户反悔后，agent 自动 `coolify app delete` 把刚才创建的 app 清掉。

后果：违反「破坏性命令必须用户确认」的全局守则。即使 agent 是它自己刚创建的也不行——
统一规则：删除走用户显式确认。给出删除命令、不替用户跑。

错误做法 4：把 `--docker-compose-location ""` 显式传给 `coolify app create github`。

后果：CLI 即使没报错，也会被 Coolify 写为显式空字符串覆盖默认值。**optional 参数没明确值就不传。**
</bad-example>
