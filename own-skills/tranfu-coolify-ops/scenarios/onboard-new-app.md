# 场景：onboard 新 app

把 tranfu-labs 组织下、命名合规的 GitHub 仓库通过 GitHub App 路径接入 Coolify，并触发首次部署。
整套流程是「先断言、后操作」的 7 步链路，任一硬断言失败立即终止，不替用户绕过、不替用户清理。

## 触发

- 用户给一个 `https://github.com/tranfu-labs/<x>-app` 链接 + 表达「部署 / 上线 / 跑起来 / 接到 coolify / onboard」意图。
- 用户说"把这个新仓库挂到 coolify"、"上 coolify 新应用"、"在 coolify 建个新 app 用 GitHub App 部署"等。

## 不触发

- 仓库不在 tranfu-labs 组织下。
- 仓库名不匹配 `^[a-z][a-z0-9-]*-app$`。
- 用户想用 public 仓库 / deploy-key / Dockerfile / docker image 路径部署（这些是 `coolify app create public` / `deploy-key` / `dockerfile` / `dockerimage` 的范围，不在本场景）。
- 已有同名 app 需要重新部署 / 改配置。

## 输入

- `${input-url}`：用户提供的 GitHub 仓库 URL。

## 输出

- `${app-uuid}`：新创建 app 的 UUID。
- `${deployment-uuid}`：首次部署的 UUID。
- 首次部署 logs 的流式入口（`coolify app deployments logs ... --follow`）。

## 7 步流程

为下面的步骤建立一个 TODO 清单，并在每步完成后更新状态。

### Step 0 — 前置就绪

跳到 `commands/prerequisites.md` 跑 Step A + Step B。
拿到 `${context}`、`${server-uuid}` 后回到本场景继续。任一断言失败按 `prerequisites.md` 的终止文案返回。

### Step 1 — 解析并校验 GitHub URL

跳到 `commands/tranfu-naming.md` 解析 + 双重校验：

- 解析出 `${org}`、`${repo}`。
- 断言 `${org} == "tranfu-labs"`。
- 断言 `${repo}` 匹配 `^[a-z][a-z0-9-]*-app$`。
- `${project-name} = ${repo}`。

任一不过按 `tranfu-naming.md` 的对应终止文案返回。

### Step 2 — 检查 Coolify 里是否已有同名 app

```bash
coolify app list --context="${context}" --format json \
  | jq -e --arg name "${repo}" '.[] | select(.name == $name)'
```

- `jq -e` 在命中时退出码 0，未命中时退出码 1。
- 命中即终止，**不要替用户删除**（破坏性操作要走全局守则）。返回文案：

> Coolify 上已经有一个名为 `${repo}` 的 app（context=`${context}`），UUID=`<uuid>`。
> 用 `coolify app get --context="${context}" <uuid>` 查看现状。
> 如果想重新部署，等 troubleshoot / lifecycle 场景实现后走那里；
> 如果确实要先删再建，先用 `coolify app delete --context="${context}" <uuid>` 删掉
> （然后去 Coolify 网页 UI 删 project，CLI 不暴露 `project delete`），再回来跑本流程
> （破坏性，请确认）。

### Step 3 — 找 / 建 project（name == repo）

```bash
PROJECT_UUID=$(coolify project list --context="${context}" --format json \
  | jq -r --arg name "${repo}" '.[] | select(.name == $name) | .uuid')
```

- 非空 → 复用，进入 Step 4。
- 空 → 用 create 建：

```bash
coolify project create --context="${context}" --name "${repo}"
PROJECT_UUID=$(coolify project list --context="${context}" --format json \
  | jq -r --arg name "${repo}" '.[] | select(.name == $name) | .uuid')
```

如果 create 后再 list 仍然拿不到（极小概率），终止：

> 已尝试在 context (`${context}`) 上创建 project `${repo}`，但随后查 list 仍未出现，
> 停下来人工排查 CLI 输出。

### Step 4 — 找唯一的 GitHub App

```bash
GH_COUNT=$(coolify github list --context="${context}" --format json | jq 'length')
```

- `GH_COUNT == 1`：
  - `GITHUB_APP_UUID=$(coolify github list --context="${context}" --format json | jq -r '.[0].uuid')`
- `GH_COUNT == 0`：终止。返回文案：
  > 当前 context (`${context}`) 上没有 GitHub App 集成。
  > 先用 `coolify github create --context="${context}" ...` 配一个
  > （要 GitHub App ID / client id / client secret / installation id / private-key-uuid），
  > 再跑本流程。
- `GH_COUNT > 1`：终止。返回文案：
  > 当前 context (`${context}`) 上有 `${GH_COUNT}` 个 GitHub App 集成，本场景默认 tranfu 团队只有一个。
  > 列出来让我决定：
  > （列出 `coolify github list --context="${context}"` 的 name + uuid）
  > 如果确实有多个，把目标 `github-app-uuid` 告诉我，再跑本流程；
  > 同时考虑扩展本场景让它支持多 GitHub App。

### Step 5 — 校验该 GitHub App 能看到这个仓库

```bash
coolify github repos --context="${context}" "${GITHUB_APP_UUID}" --format json \
  | jq -e --arg fullname "tranfu-labs/${repo}" \
      '.[] | select(.full_name == $fullname)' > /dev/null
```

- 退出码 0 → 通过。
- 退出码 1 → 终止。返回文案：

> Coolify 的 GitHub App `${GITHUB_APP_UUID}`（context=`${context}`）看不到 `tranfu-labs/${repo}`。
> 去 https://github.com/organizations/tranfu-labs/settings/installations 把这个仓库
> 加进 GitHub App 的可访问列表，再跑本流程。

### Step 6 — 创建应用并立即部署

```bash
coolify app create github \
  --context="${context}" \
  --name "${repo}" \
  --project-uuid "${PROJECT_UUID}" \
  --server-uuid "${SERVER_UUID}" \
  --github-app-uuid "${GITHUB_APP_UUID}" \
  --git-repository "tranfu-labs/${repo}" \
  --git-branch main \
  --build-pack dockercompose \
  --ports-exposes 80 \
  --instant-deploy
```

这一步是 onboard 全流程里**唯一的写操作**，因此 `--context="${context}"` 放在最前面、显眼，
绝不能省（省了会落到 default context，可能跟 Step 0 用户确认的实例不一致）。

这一步有三个固定坑，是 CLI 的语义跟网页 UI 不一致的地方，每次都要按下面办：

**坑 1：`--ports-exposes 80` 是占位，不可省略。**
CLI 的 schema 把 `--ports-exposes` 标为 required，但在 `--build-pack dockercompose` 模式下，
真实端口由仓库根的 `compose.yml` 管，CLI 的这个值不会真正生效。永远填 `80` 占位，
不要把它当成"实际端口"去配。如果不填，CLI 会直接拒绝。

**坑 2：不传 `--docker-compose-location`。**
网页 UI 里有一个 "Docker Compose Location" 输入框，默认是 `/compose.yml`。
**但 CLI 没有暴露这个参数**。本场景靠约定解决：tranfu 团队仓库统一把 compose 文件放仓库根，
命名 `compose.yml`，Coolify 默认就能识别。如果某个仓库 compose 文件不在根 / 不叫这个名，
本场景目前不支持，需要走网页 UI 创建或等后续扩展。

**坑 3：`--git-branch` 默认填 `main`。**
CLI 的 schema 把 `--git-branch` 标为 required。如果用户想部署非 main 分支（比如 `develop`），
要让用户显式说明，不要默默假定 main 就是对的。

create 命令成功返回后，因为带了 `--instant-deploy`，Coolify 会立即排队一次部署。

### Step 7 — 跟踪首次部署

先用 `coolify app list` 拿到新 app 的 UUID：

```bash
APP_UUID=$(coolify app list --context="${context}" --format json \
  | jq -r --arg name "${repo}" '.[] | select(.name == $name) | .uuid')
```

再用 `coolify app deployments list` + jq 显式挑出最新一条部署的 UUID。
**不要依赖列表默认顺序**——用 `sort_by(.created_at // .id) | last` 显式按时间或 id 排，
拿最新一条；`// .id` 是兜底（如果 CLI 不返回 `created_at` 字段，回退用 `id` 排）：

```bash
DEPLOYMENT_UUID=$(coolify app deployments list --context="${context}" "${APP_UUID}" --format json \
  | jq -r 'sort_by(.created_at // .id) | last | .uuid')
```

如果结果为空或 `null`，说明 `--instant-deploy` 没真的触发部署，按下面文案终止：

> 已在 context (`${context}`) 上创建 app 但 deployments list 为空，
> 应该有一条 queued 状态的部署却找不到。跑
> `coolify app deployments list --context="${context}" "${APP_UUID}" --format pretty`
> 看原始输出再排查。

拿到 `${DEPLOYMENT_UUID}` 后流式跟日志：

```bash
coolify app deployments logs --context="${context}" "${APP_UUID}" "${DEPLOYMENT_UUID}" --follow
```

如果首次部署中途想看 Coolify 内部操作（build 卡住、网络问题等），加 `--debuglogs`：

```bash
coolify app deployments logs --context="${context}" "${APP_UUID}" "${DEPLOYMENT_UUID}" --follow --debuglogs
```

**Step 7 完成标准（即整个 onboard 完成标准）**：拿到 `${APP_UUID}` + `${DEPLOYMENT_UUID}` +
logs 流式入口能跟到 build 阶段的输出，**即视为 onboard 完成**。部署是否最终 running 由用户在
logs 流里观察 —— 部署最终状态不是本场景的成功判据。

如果用户在 logs 流里发现部署失败：本场景的范围已经结束，后续排障应该走
`scenarios/troubleshoot-deploy.md`（待实现），不在本场景内修。

产出 `${app-uuid}`、`${deployment-uuid}`、logs 流式入口，onboard 完成，结束。

<example>
用户：把 https://github.com/tranfu-labs/order-mgmt-app 部署到 coolify

执行：

Step 0：跑 `coolify context list` → 当前 default 是 `prod`，向用户确认；
用户回："就用 prod"，于是 `${context}=prod`。
跑 `coolify server list --context=prod --format json` → 长度 1，`SERVER_UUID=11111111-1111-1111-1111-111111111111`。

Step 1：解析 URL → org=`tranfu-labs`、repo=`order-mgmt-app`。
组织匹配，正则匹配，`PROJECT_NAME=order-mgmt-app`。

Step 2：`coolify app list --context=prod --format json | jq -e '.[] | select(.name == "order-mgmt-app")'` → 退出码 1，无命中，通过。

Step 3：project 不存在 → `coolify project create --context=prod --name order-mgmt-app` →
`PROJECT_UUID=22222222-2222-2222-2222-222222222222`。

Step 4：`coolify github list --context=prod --format json | jq 'length'` → 1，
`GITHUB_APP_UUID=33333333-3333-3333-3333-333333333333`。

Step 5：`coolify github repos --context=prod 33333333-... --format json | jq -e '.[] | select(.full_name == "tranfu-labs/order-mgmt-app")'` → 退出码 0，通过。

Step 6：

```bash
coolify app create github \
  --context=prod \
  --name order-mgmt-app \
  --project-uuid 22222222-2222-2222-2222-222222222222 \
  --server-uuid 11111111-1111-1111-1111-111111111111 \
  --github-app-uuid 33333333-3333-3333-3333-333333333333 \
  --git-repository tranfu-labs/order-mgmt-app \
  --git-branch main \
  --build-pack dockercompose \
  --ports-exposes 80 \
  --instant-deploy
```

Step 7：拿到新 `APP_UUID=44444444-...`，
跑 `coolify app deployments list --context=prod 44444444-...` 看到一条 `queued` 的 deployment，
用 `jq -r 'sort_by(.created_at // .id) | last | .uuid'` 拿到 `${DEPLOYMENT_UUID}`，
跑 `coolify app deployments logs --context=prod 44444444-... <dep-uuid> --follow` 跟踪。
看到 build → run → service started，结束。
</example>

<bad-example>
错误做法 1：用户给了 URL，agent 直接跑：

```bash
coolify app create github \
  --git-repository tranfu-labs/foo-app \
  --build-pack dockercompose \
  --git-branch main \
  --project-uuid <随便选一个>
```

问题：
- 没跑 Step 0（context / server）→ 可能创建到生产实例，或者多 server 时报错。
- **没带 `--context="${context}"`** → 命令落到 default context，可能跟用户想要的实例完全不一致。
- 漏了 `--ports-exposes`、`--server-uuid`、`--github-app-uuid`、`--name` 等 schema required 字段 → CLI 直接拒绝。
- 没跑 Step 2 同名检查 → 万一已经有 `foo-app`，又会失败一次。
- project-uuid 是猜的 → 容易把 app 创建到错误归属，事后清理要
  `coolify app delete` + 去网页 UI 删 project（CLI 不暴露 `project delete`）。

错误做法 2：把 `--ports-exposes` 当真实端口配，例如把仓库 compose 暴露的端口（5432）填进去：

```bash
coolify app create github ... --ports-exposes 5432 --build-pack dockercompose ...
```

问题：dockercompose 模式下 `--ports-exposes` 并不会真正映射端口（端口由 compose 管），
填什么都不影响实际行为。但写成 5432 会让人误以为 CLI 这里在配端口，造成后续误读。
固定填 80 占位、心里清楚它只是过 schema 校验。

错误做法 3：试图传 `--docker-compose-location /compose.yml`：

```bash
coolify app create github ... --docker-compose-location /compose.yml ...
```

问题：CLI 没有这个参数，会直接报 unknown flag 错。正确做法是把 compose 文件放仓库根并命名 `compose.yml`，
让 Coolify 默认识别。
</bad-example>

## 验收用例

跑完 skill 后，应该满足以下用例的预期行为：

| 编号 | 输入 / 状态 | 期望 |
|---|---|---|
| 1 | `tranfu-labs/foo-app` + 所有前置 OK + Coolify 上没同名 app | 跑完 Step 7，出现新 deployment 且 logs 流式入口能跟到 build 阶段输出（部署最终是否 running 由用户在 logs 流里观察，不在本场景判据内） |
| 2 | `other-org/foo-app` | Step 1 终止，提示组织不对 |
| 3 | `tranfu-labs/Foo_App`（含大写、含下划线） | Step 1 终止，提示命名不合规 |
| 4 | `tranfu-labs/foo-app` 但 Coolify 已有同名 app | Step 2 终止，给出现有 UUID，不替用户删 |
| 5 | Coolify 上没 server | Step 0 终止（在 prerequisites Step B） |
| 6 | Coolify 上有 2 台 server | Step 0 终止，列出 server 让用户决定 |
| 7 | 没 GitHub App | Step 4 终止，提示先用 `coolify github create` 配 |
| 8 | 有 2 个 GitHub App | Step 4 终止，列出让用户决定 |
| 9 | GitHub App 没把 `tranfu-labs/foo-app` 加进可访问列表 | Step 5 终止，给出 GitHub App installation 设置链接 |
| 10 | `tranfu-labs/foo-app` + Coolify 上 project `foo-app` 已存在 | Step 3 复用现有 project，不调 `project create`，继续到 Step 7 完成 |
