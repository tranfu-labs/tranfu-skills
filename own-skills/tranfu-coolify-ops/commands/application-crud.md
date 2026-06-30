# Application CRUD 操作速查 (private-github-app + dockercompose)

reconcile Step 4I / 更新分支 D 用。字段语义详见 [../references/coolify-api-fields.md](../references/coolify-api-fields.md)。

公共环境变量假设：

```bash
BASE="http://120.77.223.183:8000"
# COOLIFY_API_TOKEN / GITHUB_APP_UUID 已在 shell env 中 (preflight 后导出)
# token 原文永不写进命令字符串, 永远只引用 $COOLIFY_API_TOKEN
```

## 列出所有 application (ad-hoc 排障用)

```bash
curl -sS \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/applications" \
  | jq '[.[] | {uuid, name, build_pack, status, project_uuid}]'
```

**reconcile Step 1 用：按 name + project_uuid 双重 filter**（防跨 project 同名误命中）：

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$BASE/api/v1/applications" \
  | jq -r --arg n "$APP_NAME" --arg p "$PROJECT_UUID" \
    '.[] | select(.name == $n and .project_uuid == $p) | .uuid'
```

`$PROJECT_UUID` 由 Step 1 通过 `GET /api/v1/projects | jq 'select(.name == $REPO_NAME)'` 取得（同名约束: `REPO_NAME = PROJECT_NAME = APP_NAME`）。

## 创建 Application (private-github-app + dockercompose)

```bash
JSON_BODY=$(jq -nc \
  --arg name "$APP_NAME" \
  --arg proj "$PROJECT_UUID" \
  --arg srv "$SERVER_UUID" \
  --arg gha "$GITHUB_APP_UUID" \
  --arg repo "$REPO_ORG/$REPO_NAME" \
  --arg br "$DEFAULT_BRANCH" \
  --arg ports "$PORTS_EXPOSES" \
  --argjson domains '[{"name":"<compose-svc-name>","domain":"https://<svc>.tranfu.com:<port>"}]' \
  '{
    name: $name,
    project_uuid: $proj,
    server_uuid: $srv,
    environment_name: "production",
    github_app_uuid: $gha,
    git_repository: $repo,
    git_branch: $br,
    build_pack: "dockercompose",
    docker_compose_location: "compose.yml",
    docker_compose_domains: $domains,
    ports_exposes: $ports,
    is_auto_deploy_enabled: false,
    instant_deploy: false
  }')

curl -sS -X POST \
  -w "\nHTTP=%{http_code}\n" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$JSON_BODY" \
  "$BASE/api/v1/applications/private-github-app"
```

返回 `{uuid}`。**立刻** GET 一次拿全量校验关键字段：

```bash
APP_UUID=$(... | jq -r .uuid)
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$BASE/api/v1/applications/$APP_UUID" \
  | jq '{uuid, name, build_pack, is_auto_deploy_enabled, github_app_uuid, git_repository, git_branch, docker_compose_location}'
```

**必须校验返回里**:
- `build_pack == "dockercompose"`
- `is_auto_deploy_enabled == false`  ← 核心: GitHub push 不会自动触发部署, 部署只能由 GHA POST /api/v1/deploy 触发
- `github_app_uuid` 等于 preflight 拿到的那个
- `git_repository == "$REPO_ORG/$REPO_NAME"` (注意是 owner/repo 形式, 不是完整 URL)

### POST 常见 4xx

- **400 missing required** → 必传字段没给。private-github-app 必填: `project_uuid`, `server_uuid`, `environment_name`/`environment_uuid`, `github_app_uuid`, `git_repository`, `git_branch`, `build_pack`
- **404 GitHub App not found** → `$GITHUB_APP_UUID` 错或被删, 重跑 preflight
- **404 repository not found** → GitHub App 没在该 repo 装 Installation (UI 上去 github.com 那边给 GitHub App 加 repo access)
- **409 domain conflict** → `docker_compose_domains` 里某条已被别的资源占用。**不要**直接 `force_domain_override=true`, 先 GET 看占用者是谁
- **422 validation** → 字段名错或 shape 错; 重点查 `docker_compose_domains` 是不是 `[{name, domain}]` 数组 (不是 `[{name, url}]`, 那是旧 Service 形态)

## 更新 Application (reconcile 更新分支)

partial update — 只发要改的字段。endpoint: `PATCH /api/v1/applications/$APP_UUID`。

### 改 git binding (换分支 / 换 GitHub App)

```bash
curl -sS -X PATCH \
  -w "\nHTTP=%{http_code}\n" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg br "develop" '{git_branch: $br}')" \
  "$BASE/api/v1/applications/$APP_UUID"
```

### 改 compose location (rare — 通常 compose.yml 改完 git push 即可, Coolify 下一次 deploy 自动读最新 commit)

```bash
curl -sS -X PATCH \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc '{docker_compose_location: "compose.yml"}')" \
  "$BASE/api/v1/applications/$APP_UUID"
```

> Application + GitHub App + dockercompose 形态下, **compose.yml 是从 git repo 读的**, 不像旧 Service 形态把 base64 compose 存在 `docker_compose_raw` 字段里。所以改 compose **不需要 PATCH 任何字段**, 改完 push, GHA build 完镜像 → POST /deploy → Coolify pull 最新 commit 的 compose 读 image 即可。

### 改 auto-deploy 开关 (不应该改, 0.8 永远 false)

```bash
# 仅文档目的, reconcile 永远不调这条 (保持 false 是 skill 0.8 的硬约束)
curl -sS -X PATCH \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_auto_deploy_enabled": false}' \
  "$BASE/api/v1/applications/$APP_UUID"
```

### 对比 Coolify 上 git binding 与本地仓库（reconcile 更新分支 D check 用）

```bash
REMOTE=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$BASE/api/v1/applications/$APP_UUID" \
  | jq '{git_repository, git_branch, build_pack, docker_compose_location, is_auto_deploy_enabled}')
echo "$REMOTE"
# 期望:
#   git_repository = "$REPO_ORG/$REPO_NAME"
#   git_branch = "$DEFAULT_BRANCH"
#   build_pack = "dockercompose"
#   docker_compose_location = "compose.yml"
#   is_auto_deploy_enabled = false
```

不一致 → PATCH 对齐; 一致 → skip act, 等用户 push 后走 GHA → deploy 链路。

## 删除 Application（谨慎）

**默认会删 volume，丢数据**。生产用一定显式 `delete_volumes=false`：

```bash
curl -sS -X DELETE \
  -w "\nHTTP=%{http_code}\n" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/applications/$APP_UUID?delete_volumes=false&delete_configurations=true&docker_cleanup=true&delete_connected_networks=true"
```

reconcile flow **不调** DELETE。删 application 是人工动作 (走 reversible-ops 黑名单确认流)。

## 跟旧 Service 形态的关键差异 (0.7 → 0.8 备忘)

| 维度 | 旧 0.7 Service | 新 0.8 Application |
|---|---|---|
| endpoint | `/api/v1/services` | `/api/v1/applications/private-github-app` (POST) / `/api/v1/applications/{uuid}` (GET/PATCH/DELETE) |
| git 绑定 | ✗ (compose 自由) | ✓ (`github_app_uuid` + `git_repository` + `git_branch`) |
| compose 来源 | base64 编码塞 `docker_compose_raw` 字段 | 从 git repo 读 `docker_compose_location` 指向的文件 (默认 `compose.yml`) |
| auto deploy | 不存在 (无 git binding) | `is_auto_deploy_enabled: false` 显式关 |
| 改 compose 怎么办 | PATCH `docker_compose_raw` (base64) | git push 即可, Coolify 下次 deploy 自动读最新 commit |
| 域名字段 | `urls: [{name, url}]` | `docker_compose_domains: [{name, domain}]` |
| sub-application | 同形态 (compose 多 service → applications 数组) | 同形态 (相同 trap 在 [../references/service-vs-application.md](../references/service-vs-application.md)) |
| webhook 触发 URL | `POST /api/v1/deploy?uuid=<service-uuid>` | `POST /api/v1/deploy?uuid=<app-uuid>` (同 endpoint, uuid 含义不同) |
