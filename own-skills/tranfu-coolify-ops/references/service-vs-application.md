# Coolify Application 资源 vs Service 资源

Coolify 4.x 里 "Application" 和 "Service" **不是**同一类资源，**API 命名空间也不互通**。本 skill 0.8 全部走 Application 资源 (private-github-app + build_pack=dockercompose), Service 是 0.7 旧形态保留为历史包袱说明 — 排障时要看懂区别。

## 谁是谁

| 资源类型 | UI 上怎么建 | API namespace | 典型用途 |
|---|---|---|---|
| **Application** (本 skill 0.8 走) | `+ New Resource` → 选 GitHub (private via GitHub App) → build pack=Docker Compose | `/api/v1/applications` | git-bound 应用 (包括 dockercompose 编排) |
| **Service** (含 "Docker Compose Empty", 0.7 形态) | `+ New Resource` → `Services` 那一栏 → `Docker Compose Empty` 或 one-click (PostgreSQL/Redis/...) | `/api/v1/services` | docker-compose 编排但**不绑 git** |

本 skill 0.8 走 **Application · private-github-app + dockercompose**：一个 Application 资源 = git binding (github_app_uuid + repo + branch) + 从 git 读 compose.yml + 内嵌的多个 sub-application（每个 compose service 一个）。

## "sub-application" 这个概念 (Application + dockercompose 形态下)

GET 一个 Application 资源回来，返回 JSON 里有 `applications` 数组（旧 Service 形态也是这个字段名，shape 一样）：

```json
{
  "uuid": "<application-uuid>",
  "build_pack": "dockercompose",
  "github_app_uuid": "<github-app-uuid>",
  "git_repository": "tranfu-labs/markdown-kits-app",
  "git_branch": "main",
  "docker_compose_location": "compose.yml",
  "is_auto_deploy_enabled": false,
  "applications": [
    {
      "uuid": "<sub-uuid>",
      "name": "markdown-kits-app",
      "fqdn": "https://markdown-kits-app.tranfu.com:8787",
      "image": "ghcr.io/...:latest",
      ...
    }
  ]
}
```

compose 里有几个 service，`applications` 数组就有几条。**每条有独立 uuid 和独立 fqdn**。

## 三个一定要记的"反直觉"

1. **`PATCH /api/v1/applications/{sub-uuid}` 不能用于改 sub-application 字段**——sub-application 的 uuid **在父 Application 同一个 namespace**, 但 PATCH 这个 uuid 改的是父 Application 自己。改 sub-application 的域名要走父 Application 的 `docker_compose_domains` 字段。
2. **`sub-application.fqdn` 是只读派生字段**——不能直接 PATCH。改域名走 `PATCH /applications/{uuid}` 的 `docker_compose_domains` 字段，Coolify 内部把它同步到对应 sub-application 的 fqdn。详见 [urls-vs-docker-compose-domains.md](urls-vs-docker-compose-domains.md)。
3. **创建 Application + dockercompose 必须 POST `/api/v1/applications/private-github-app`** 而不是 `/api/v1/applications` ——前者需要 `github_app_uuid` + `git_repository` + `git_branch` + `build_pack=dockercompose`。Coolify 创建后从 git repo 读 `docker_compose_location` (默认 `docker-compose.yaml`, 我们 override 成 `compose.yml`) 来识别 compose 编排。

## 心智模型一句话

> Application 是壳，applications 是壳里的瓤。所有写操作打在壳上，壳负责同步给瓤。compose 不存 Coolify, 存 git repo, 通过 GitHub App + git_repository + git_branch 绑定; Coolify 触发 deploy 时按需 pull 最新 commit 读 compose。

## 0.7 Service 形态 (DEPRECATED, 仅供排障)

0.7 走 Service / Docker Compose Empty: 资源**不绑 git**, compose 以 base64 encoded 形式直接塞在 `docker_compose_raw` 字段里, 改 compose 要 PATCH 这个字段; 改域名走 `urls: [{name, url}]` (而非 `docker_compose_domains: [{name, domain}]`); namespace `/api/v1/services` 完全独立。0.8 不主动操作这套, 仅当 Step 1 检测到同名 Service 残留时告知用户手动处理。
