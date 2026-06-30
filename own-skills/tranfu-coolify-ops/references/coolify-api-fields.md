# Coolify HTTP API 字段速查（verified on 4.1.2）

本 skill 0.8 走 **Application + private-github-app + dockercompose** 形态, 主用 `/applications` 命名空间下的少数 endpoint。下面只列实际用到的字段——完整 schema 看 [openapi.yaml](https://raw.githubusercontent.com/coollabsio/coolify/main/openapi.yaml)。

每条标注「实测于 Coolify server 4.1.2 + 一台公司实例」，server 升级时跑一次冒烟（reconcile 跑一遍）再更新本文件。

## 公共

- BASE URL: `http://120.77.223.183:8000`（公司常量，全 skill 硬编码）
- Auth: `Authorization: Bearer $COOLIFY_API_TOKEN`
- Content-Type: `application/json`（PATCH/POST 必带）
- token 安全纪律：见 SKILL.md 顶部「Token 纪律」

## `GET /api/v1/github-apps` — 列 GitHub App integration（preflight Step 0）

无查询参数。返回数组, 每条字段:

```json
{
  "id": 1,
  "uuid": "rsg40c84w4kggkw4kk0g4ks0",
  "name": "Coolify-tranfu-labs",
  "organization": "tranfu-labs",
  "api_url": "https://api.github.com",
  "html_url": "https://github.com",
  "app_id": 12345,
  "installation_id": 54321,
  "client_id": "Iv1.xxx",
  ...
}
```

preflight 按 `organization == "tranfu-labs"` filter 拿 `$GITHUB_APP_UUID`, 注入到后续 POST `/applications/private-github-app` 的 `github_app_uuid` 字段。

skill **不接管** POST / PATCH / DELETE github-apps — 这是 ops 角色一次性手工配置 (要上传 private key、Installation ID 等)。

## `POST /api/v1/applications/private-github-app` — 创建 Application（reconcile Step 4I）

必传：
- `project_uuid` —— Step 1 / 4I.1 拿到
- `server_uuid` —— 公司常量（看 prerequisites.md）
- `environment_name` 或 `environment_uuid` —— 通常 `production`
- `github_app_uuid` —— preflight 从 `GET /github-apps` 拿
- `git_repository` —— `<owner>/<repo>` 形式 (不是完整 URL, 不带 .git)
- `git_branch` —— 通常 `main`
- `build_pack` —— 枚举 `[nixpacks, railpack, static, dockerfile, dockercompose]`, 本 skill 强制 `dockercompose`

关键可选 (本 skill 必传):
- `is_auto_deploy_enabled: false` ← **核心**: GitHub push 不触发 Coolify 自动部署, 部署只能由 GHA POST /api/v1/deploy 触发
- `docker_compose_location: "compose.yml"` (默认 `docker-compose.yaml`, 我们用 `compose.yml`)
- `instant_deploy: false` —— 创建后不立即部署, 首次部署留给 push 触发的 GHA
- `docker_compose_domains: [{name, domain}]` —— sub-application 域名 (见 [../commands/domain.md](../commands/domain.md))
- `ports_exposes: "<port>"` —— 主 sub-application 暴露端口

可选 (默认即可):
- `name` —— 显示名 (不传则用 git_repository 派生; skill 强制传 `$APP_NAME == $REPO_NAME`)
- `description` —— 不传
- `is_container_label_escape_enabled: true` —— 默认即可
- `manual_webhook_secret_github` —— 不传 (我们不依赖 GitHub push webhook signature 验证, 因为 auto deploy 关了)

返回：`{uuid}`。**只有这个字段**——拿到 uuid 后立刻 GET 一次拿全, 重点校验 `is_auto_deploy_enabled / build_pack / github_app_uuid / git_repository`。

## `GET /api/v1/applications` — 列表

无查询参数。返回数组，每条是完整 Application object。

reconcile Step 1 用 `name + project_uuid` 双重 filter (防跨 project 同名)。

## `GET /api/v1/applications/{uuid}` — 单条

返回字段（本 skill 关心的）：

| 字段 | 含义 |
|---|---|
| `uuid` | application uuid |
| `name` | application 显示名 |
| `build_pack` | 本 skill 走 `dockercompose` |
| `github_app_uuid` | 绑定的 GitHub App integration |
| `git_repository` | `<owner>/<repo>` |
| `git_branch` | 部署分支 |
| `docker_compose_location` | compose 文件在 repo 内的相对路径 (默认 `docker-compose.yaml`, 我们用 `compose.yml`) |
| `is_auto_deploy_enabled` | **必为 false** (0.8 硬约束) |
| `status` | running / exited / paused / etc |
| `applications` | 数组, 每条一个 sub-application (compose service 一一对应) |
| `applications[].uuid` | sub-application uuid (**不能用** `/applications/{uuid}` 访问, 会 404 / 拿到的是父 Application) |
| `applications[].name` | = compose `services.<name>` |
| `applications[].fqdn` | 该 sub-application 当前域名 (只读派生, 改域名走父 Application 的 `docker_compose_domains`) |
| `applications[].image` | 拉的镜像 tag |

## `PATCH /api/v1/applications/{uuid}` — 更新

支持 **partial update** — 只发要改的字段。

接受字段：

| 字段 | 用途 |
|---|---|
| `name` / `description` | 显示名 |
| `project_uuid` / `environment_{name,uuid}` / `server_uuid` / `destination_uuid` | 迁移用 (慎改) |
| `git_repository` / `git_branch` / `github_app_uuid` | 改 git binding |
| `build_pack` | 通常不改, 改了相当于换部署模式 |
| `docker_compose_location` | compose 文件路径 |
| `docker_compose_domains` | `[{name, domain}]`; 改 sub-application 域名 |
| `is_auto_deploy_enabled` | **保持 false**, 本 skill 永不改回 true |
| `instant_deploy` | 立即触发部署 (用 POST /deploy 更合适) |
| `connect_to_docker_network` | 接公共网络 |
| `force_domain_override` | 域名冲突时强写 |
| `is_container_label_escape_enabled` | 转义 label 中的 `$` |
| `watch_paths` | auto_deploy=false 时无所谓; 留空 |

**不接受**：`urls` / `domains` / `docker_compose_raw` / `fqdn` (前两个分别是 Service / 单容器 Application 字段; `docker_compose_raw` 仅旧 Service 形态用; `fqdn` 是派生)。传过来 422 "field not allowed"。

返回：`{uuid}`。

## `DELETE /api/v1/applications/{uuid}` — 删除

Query 参数（全 bool，默认 true）：
- `delete_configurations`
- `delete_volumes` ← **生产慎用**，会丢数据
- `docker_cleanup`
- `delete_connected_networks`

```bash
curl -X DELETE -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "http://120.77.223.183:8000/api/v1/applications/<uuid>?delete_volumes=false"
```

## `GET / POST / PATCH / DELETE /api/v1/applications/{uuid}/envs` — Env 变量

详见 [../commands/application-env.md](../commands/application-env.md)。

POST body 关键字段：
- `key` / `value`
- `is_preview` / `is_literal` / `is_multiline` / `is_shown_once`

bulk 改用 `PATCH /api/v1/applications/{uuid}/envs/bulk`, body `{"data": [...]}`.

## `GET / POST /api/v1/deploy?uuid=...&force=...` — 触发部署

Bearer auth。`uuid` 是 application uuid (旧 Service 形态也是同 endpoint, uuid 含义不同)。`force=false` 是常态（不强制重启）。

deploy.yml.template 用 POST。返回 `{deployments: [{message, resource_uuid, deployment_uuid}]}` (4.1.2 起返回 deployment_uuid)。

## `GET /api/v1/version` — 实例版本

用于 token / base url 活性探测（[../assets/preflight.sh](../assets/preflight.sh)）。返回 `{version: "4.1.2"}`。

## `GET /api/v1/projects` — Project 列表

无查询参数。返回数组，每条至少含 `{uuid, name, description}`。

reconcile Step 1 用法（按名字精准定位同名 project）：

```bash
PROJECT_UUID=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$BASE/api/v1/projects" \
  | jq -r --arg n "$REPO_NAME" '.[] | select(.name == $n) | .uuid')
```

## `POST /api/v1/projects` — 创建 Project

Body 必传：

- `name` —— project 名。reconcile 里强制 `= $REPO_NAME`（GitHub repo name == project name 硬约束）

可选：
- `description` —— 不传

返回 `{uuid}`。

```bash
PROJECT_UUID=$(curl -sS -X POST \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg n "$REPO_NAME" '{name: $n}')" \
  "$BASE/api/v1/projects" \
  | jq -r .uuid)
```

reconcile Step 4I.1 only 在"同名 project 不存在"时调用; **不接受其他名字**。

## 还没用到、但可能要用的 endpoint

| endpoint | 用途 | 触发场景 |
|---|---|---|
| `GET /api/v1/applications/{uuid}/logs` | 看容器 logs | reconcile Step 8 跟首次部署 |
| `GET /api/v1/deployments/applications/{uuid}` | 看某 application 的 deployment 历史 | 排障 |
| `GET /api/v1/servers` | server 列表 | 仅排障，公司只有一台 |
| `GET /api/v1/teams/current` | 当前 team | 排查权限问题 |

## DEPRECATED · 旧 Service 形态 (0.7) 字段速查

0.8 切到 Application 后, 下面 endpoint 在 reconcile 主链路不再使用。仅供读旧 Coolify 资源 / 排障老项目时查阅:

- `POST /api/v1/services` — 创建 Docker Compose Empty Service (旧 0.7 流程; 字段 `docker_compose_raw` 是 base64 encoded compose, `urls: [{name, url}]`)
- `GET /api/v1/services` / `GET /api/v1/services/{uuid}` — 列表 / 单条
- `PATCH /api/v1/services/{uuid}` — 更新 (字段 `docker_compose_raw` / `urls`)
- `DELETE /api/v1/services/{uuid}` — 删除
- `GET/POST/PATCH/DELETE /api/v1/services/{uuid}/envs` — env 变量

0.8 不主动操作这套 endpoint, 但 `POST /api/v1/deploy?uuid=` 对 Service uuid 仍然兼容 (上游 Coolify endpoint 通用)。
