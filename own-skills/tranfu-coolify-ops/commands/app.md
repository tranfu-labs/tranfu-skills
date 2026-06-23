# app 命令参考

本文件覆盖 onboard 场景实际用到的 `coolify app` 子命令完整参数。其它 app 子命令
（`env` / `storage` / `previews` / `start` / `stop` / `restart` / `logs` /
`app create public|dockerfile|dockerimage|deploy-key`）未来扩展到对应场景时再追加。

参数表统一按原文 1:1 抄录：`参数`、`类型`、`必填`、`默认值`、`说明`。
每条命令都会带 `--context` / `--token` / `--format` / `--show-sensitive` / `--debug`
这些全局 flag（见 [conventions.md](conventions.md)），下表不再重复。所有命令在 onboard 场景里
都必须显式带 `--context="${context}"`（见 SKILL.md「全局守则」），下面的示例都已带上。

本文件覆盖的命令：

- [`coolify app create github`](#coolify-app-create-github)：onboard Step 6 主命令。
- [`coolify app list`](#coolify-app-list)：onboard Step 2 / Step 7 拿 UUID。
- [`coolify app get`](#coolify-app-get-uuid)：终止文案里让用户看现状。
- [`coolify app delete`](#coolify-app-delete-uuid)：终止文案里提到（破坏性，须用户确认）。
- [`coolify app deployments list`](#coolify-app-deployments-list-app-uuid)：onboard Step 7 拿 deployment UUID。
- [`coolify app deployments logs`](#coolify-app-deployments-logs-app-uuid-deployment-uuid)：onboard Step 7 流式跟首次部署。

---

## `coolify app create github`

从私有仓库（通过 GitHub App）创建一个应用。onboard 场景 Step 6 的主命令。

参数表：

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `--base-directory` | string | 否 | — | 应用的基础目录（仓库内子目录） |
| `--build-command` | string | 否 | — | 自定义 build 命令 |
| `--build-pack` | string | **是** | — | 构建器：`nixpacks` / `static` / `dockerfile` / `dockercompose` |
| `--description` | string | 否 | — | 应用描述 |
| `--destination-uuid` | string | 否 | — | 如果 server 有多个 destination，指定哪个 |
| `--dockerfile-target-build` | string | 否 | — | Dockerfile 目标 build stage |
| `--domains` | string | 否 | — | 应用域名 |
| `--environment-name` | string | 否 | — | environment 名 |
| `--environment-uuid` | string | 否 | — | environment UUID |
| `--git-branch` | string | **是** | — | Git 分支 |
| `--git-commit-sha` | string | 否 | — | 指定要部署的 commit SHA |
| `--git-repository` | string | **是** | — | Git 仓库，格式 `owner/repo` |
| `--github-app-uuid` | string | **是** | — | GitHub App UUID |
| `--health-check-enabled` | boolean | 否 | `false` | 启用健康检查 |
| `--health-check-path` | string | 否 | — | 健康检查路径 |
| `--install-command` | string | 否 | — | 自定义 install 命令 |
| `--instant-deploy` | boolean | 否 | `false` | 创建后立即部署 |
| `--limits-cpus` | string | 否 | — | CPU 配额 |
| `--limits-memory` | string | 否 | — | 内存配额 |
| `--name` | string | 否 | — | 应用名 |
| `--ports-exposes` | string | **是** | — | 暴露端口，例：`3000` 或 `3000,8080` |
| `--ports-mappings` | string | 否 | — | 端口映射，格式 `host:container` |
| `--project-uuid` | string | **是** | — | project UUID |
| `--publish-directory` | string | 否 | — | static 构建产物目录 |
| `--server-uuid` | string | **是** | — | server UUID |
| `--start-command` | string | 否 | — | 自定义 start 命令 |

**onboard 场景用法**（所有 required 字段都要填）：

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

已知坑（见 scenarios/onboard-new-app.md Step 6 详细解释）：

- `--ports-exposes` 标为 required，但 `--build-pack dockercompose` 模式下真实端口由仓库根
  `compose.yml` 管，CLI 这里只是过 schema 校验。固定填 `80` 占位。
- CLI **没有** `--docker-compose-location` 参数。网页 UI 上的 "Docker Compose Location"
  字段在 CLI 里靠"compose 文件放仓库根、命名 `compose.yml`"的约定解决，不传参。
- `--git-branch` 必填。tranfu 团队约定默认 `main`，非 main 分支让用户显式说明。
- onboard 默认带 `--instant-deploy`：创建后立即排队一次部署，省一步 `coolify app start`。

---

## `coolify app list`

列出 Coolify 上所有应用。无参数。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| （无） | — | — | — | — |

onboard 场景用法（在 Step 2 检查同名 + Step 7 拿新 app UUID）：

```bash
# Step 2 检查同名
coolify app list --context="${context}" --format json \
  | jq -e --arg name "${repo}" '.[] | select(.name == $name)'

# Step 7 拿 UUID
APP_UUID=$(coolify app list --context="${context}" --format json \
  | jq -r --arg name "${repo}" '.[] | select(.name == $name) | .uuid')
```

---

## `coolify app get <uuid>`

获取一个应用的详细信息。无 flag 参数，位置参数 `<uuid>` 必填。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<uuid>` | string | **是** | — | 应用 UUID（位置参数） |

onboard 场景用法（在 Step 2 终止文案里指引用户查看现状）：

```bash
coolify app get --context="${context}" <uuid>
```

---

## `coolify app delete <uuid>`

删除一个应用，**不可恢复**。属于全局守则里的"破坏性命令"，执行前必须列出受影响资源 +
当前 context，向用户确认后再跑。本 skill 不替用户直接调，只在终止文案里提示。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<uuid>` | string | **是** | — | 应用 UUID（位置参数） |
| `--force` (`-f`) | boolean | 否 | `false` | 跳过确认提示 |

**注意**：本 skill 永远不带 `--force` 调 delete；让用户自己跑、让 CLI 自己问确认。

---

## `coolify app deployments list <app-uuid>`

列出某个应用的所有部署记录。无 flag 参数，位置参数 `<app-uuid>` 必填。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<app-uuid>` | string | **是** | — | 应用 UUID（位置参数） |

onboard 场景用法（在 Step 7 拿首次部署的 UUID）：

```bash
DEPLOYMENT_UUID=$(coolify app deployments list --context="${context}" "${APP_UUID}" --format json \
  | jq -r 'sort_by(.created_at // .id) | last | .uuid')
```

**不要用 `.[0]` 取首条**：CLI 返回顺序未在所有版本上验证，依赖默认顺序在某些 Coolify 版本里
会拿到最旧的部署（onboard 后正好是 queued 中的首部署，看起来"对"，但本质是依赖未验证假设）。
统一用 `sort_by(.created_at // .id) | last` 显式按时间或 id 排，拿最新一条；`// .id` 是兜底
（如果 CLI 这个版本不返回 `created_at` 字段，回退用 `id` 排）。

---

## `coolify app deployments logs <app-uuid> [deployment-uuid]`

拿某次部署的日志。位置参数 `<app-uuid>` 必填，`[deployment-uuid]` 可选（不带则拿最新一条）。

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `<app-uuid>` | string | **是** | — | 应用 UUID（位置参数） |
| `[deployment-uuid]` | string | 否 | — | 部署 UUID（位置参数；不带则最新一条） |
| `--debuglogs` | boolean | 否 | `false` | 显示调试日志（含隐藏命令和内部操作） |
| `--follow` (`-f`) | boolean | 否 | `false` | 流式跟踪（像 `tail -f`） |
| `--lines` (`-n`) | integer | 否 | `0` | 显示日志行数（`0` = 全量，与 `app logs` 默认 100 不同） |

onboard 场景用法（在 Step 7 流式跟首次部署）：

```bash
coolify app deployments logs --context="${context}" "${APP_UUID}" "${DEPLOYMENT_UUID}" --follow
```

排查 build 卡住、网络异常时加 `--debuglogs`：

```bash
coolify app deployments logs --context="${context}" "${APP_UUID}" "${DEPLOYMENT_UUID}" --follow --debuglogs
```
