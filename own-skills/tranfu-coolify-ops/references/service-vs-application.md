# Coolify Service 资源 vs Application 资源

Coolify 4.x 里 "Service" 和 "Application" **不是**同一类资源，**API 命名空间也不互通**。本 skill 全部走 Service 资源，但读旧文档或排障时要看懂区别。

## 谁是谁

| 资源类型 | UI 上怎么建 | API namespace | 典型用途 |
|---|---|---|---|
| **Application** | `+ New Resource` → 选 GitHub/Git/Dockerfile/Docker Image | `/api/v1/applications` | 单镜像 / git-bound 应用 |
| **Service** (含 "Docker Compose Empty") | `+ New Resource` → `Services` 那一栏 → `Docker Compose Empty` 或 one-click (PostgreSQL/Redis/...) | `/api/v1/services` | docker-compose 编排的多容器应用 |

本 skill 走的是 **Service · Docker Compose Empty**：一个 Service 资源 = 一份 compose.yml + 内嵌的多个 sub-application（每个 compose service 一个）。

## "sub-application" 这个概念

GET 一个 Service 资源回来，返回 JSON 里有 `applications` 数组：

```json
{
  "uuid": "<service-uuid>",
  "service_type": null,        // Docker Compose Empty 这里是 null
  "docker_compose_raw": "...", // base64-encoded user compose
  "docker_compose": "...",     // Coolify 解析后注入 labels/networks 的产物
  "applications": [
    {
      "uuid": "<sub-uuid>",    // ← 这就是 sub-application uuid
      "name": "markdown-kits-app",  // = compose.services.<name>
      "fqdn": null,            // 这个 sub-application 的对外域名
      "image": "ghcr.io/...:latest",
      ...
    }
  ]
}
```

compose 里有几个 service，`applications` 数组就有几条。**每条有独立 uuid 和独立 fqdn**。

## 三个一定要记的"反直觉"

1. **`PATCH /api/v1/applications/{sub-uuid}` 会返回 404**——sub-application 不在 `/applications` 命名空间。改 sub-application 任何字段都要走 Service endpoint。
2. **`sub-application.fqdn` 是只读派生字段**——不能直接 PATCH。改域名走 `PATCH /services/{uuid}` 的 `urls` 字段，Coolify 内部把它同步到对应 sub-application 的 fqdn。详见 [urls-vs-docker-compose-domains.md](urls-vs-docker-compose-domains.md)。
3. **`service_type` 字段对 Docker Compose Empty 是 `null`**——它是 one-click services（如 `postgresql` / `actualbudget`）才有的字段。**POST 创建 Empty 资源时不要传 `type`**，传了会被当成 one-click 模板查询失败。

## 心智模型一句话

> Service 是壳，applications 是壳里的瓤。所有写操作打在壳上，壳负责同步给瓤。
