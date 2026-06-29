# Coolify HTTP API 字段速查（verified on 4.1.2）

本 skill 只用到 `/services` 命名空间下的少数 endpoint。下面只列实际用到的字段——完整 schema 看 [openapi.yaml](https://raw.githubusercontent.com/coollabsio/coolify/main/openapi.yaml)。

每条标注「实测于 Coolify server 4.1.2 + 一台公司实例」，server 升级时跑一次冒烟（reconcile 跑一遍）再更新本文件。

## 公共

- BASE URL: `http://120.77.223.183:8000`（公司常量，全 skill 硬编码）
- Auth: `Authorization: Bearer $COOLIFY_API_TOKEN`
- Content-Type: `application/json`（PATCH/POST 必带）
- token 安全纪律：见 [service-fqdn-trap.md](service-fqdn-trap.md) 邻居规矩 + SKILL.md 顶部「Token Guardrail」

## `POST /api/v1/services` — 创建 Service

必传：
- `server_uuid` —— 公司常量（看 prerequisites.md）
- `project_uuid` —— 用户选或先建
- `environment_name` 或 `environment_uuid` —— 通常 `production`

关键可选：
- `name` — 服务名（agent 用 tranfu 命名约束推导）
- `docker_compose_raw` — **base64-encoded** compose YAML（**必须 `| tr -d '\n'` 去掉折行换行符**，否则 JSON parse 失败）
- `urls` — `[{name, url}]` 数组，name=compose service 名，url=comma-separated（见 [urls-vs-docker-compose-domains.md](urls-vs-docker-compose-domains.md)）
- `instant_deploy` — bool，建议 `false`，首次部署留给 push 触发的 GHA
- `is_container_label_escape_enabled` — bool，默认 true，保持

**不传**：
- `type` —— Docker Compose Empty 不需要这个字段（它是 one-click services 的模板键）。传了会失败。
- `force_domain_override` —— 默认 false，409 时再考虑

返回：`{uuid, domains}`。**只有这俩字段，没有完整资源回吐**——拿到 uuid 后立刻 GET 一次拿全。

## `GET /api/v1/services` — 列表

无查询参数。返回数组，每条是完整 Service object。

## `GET /api/v1/services/{uuid}` — 单条

返回字段（本 skill 关心的）：

| 字段 | 含义 |
|---|---|
| `uuid` | service uuid |
| `name` | service 显示名 |
| `service_type` | Docker Compose Empty = `null`（重要） |
| `docker_compose_raw` | **未解码** 的 user compose（不是 base64） |
| `docker_compose` | Coolify 解析后产物（注入 labels / networks / container_name），只读派生 |
| `status` | running / exited / paused / etc |
| `applications` | 数组，每条一个 sub-application（compose service 一一对应） |
| `applications[].uuid` | sub-application uuid（**不能用** `/applications/{uuid}` 访问，会 404） |
| `applications[].name` | = compose `services.<name>` |
| `applications[].fqdn` | 该 sub-application 当前域名（只读派生） |
| `applications[].image` | 拉的镜像 tag |

## `PATCH /api/v1/services/{uuid}` — 更新

支持 **partial update**（实测 4.1.2 已合 [PR #6315](https://github.com/coollabsio/coolify/pull/6315)）——只发要改的字段即可。

接受字段：

| 字段 | 用途 |
|---|---|
| `name` / `description` | 显示名 |
| `project_uuid` / `environment_{name,uuid}` / `server_uuid` / `destination_uuid` | 迁移用 |
| `docker_compose_raw` | base64 compose；改 compose 内容 |
| `urls` | `[{name, url}]`；改 sub-application 域名 |
| `instant_deploy` | 立即触发部署 |
| `connect_to_docker_network` | 接公共网络 |
| `force_domain_override` | 域名冲突时强写 |
| `is_container_label_escape_enabled` | 转义 label 中的 `$` |

**不接受**：`domains` / `docker_compose_domains` / `fqdn`（这些是 Application namespace 的字段，传过来 422 "field not allowed"）。

返回：`{uuid, domains}`（同 POST，只两字段）。

## `DELETE /api/v1/services/{uuid}` — 删除

Query 参数（全 bool，默认 true）：
- `delete_configurations`
- `delete_volumes` ← **生产慎用**，会丢数据
- `docker_cleanup`
- `delete_connected_networks`

```bash
curl -X DELETE -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "http://120.77.223.183:8000/api/v1/services/<uuid>?delete_volumes=false"
```

## `GET / POST / PATCH / DELETE /api/v1/services/{uuid}/envs` — Env 变量

详见 [../commands/service-env.md](../commands/service-env.md)。

POST body 关键字段：
- `key` / `value`
- `is_preview` / `is_literal` / `is_multiline` / `is_shown_once`

## `GET /api/v1/deploy?uuid=...&force=...` — 触发部署

Bearer auth。`uuid` 是 service uuid。`force=false` 是常态（不强制重启）。

也支持 POST（[PR #2539](https://github.com/coollabsio/coolify/pull/2539)），但 GET 仍向后兼容，deploy.yml.template 用的就是 GET。

## `GET /api/v1/version` — 实例版本

用于 token / base url 活性探测（[../assets/preflight.sh](../assets/preflight.sh)）。返回 `{version: "4.1.2"}`。

## 还没用到、但可能要用的 endpoint

| endpoint | 用途 | 触发场景 |
|---|---|---|
| `GET /api/v1/services/{uuid}/logs` | 看容器 logs | reconcile Step 8 跟首次部署 |
| `GET /api/v1/projects` | project 列表 | reconcile Step 3 选 project |
| `GET /api/v1/servers` | server 列表 | 仅排障，公司只有一台 |
| `GET /api/v1/teams/current` | 当前 team | 排查权限问题 |
