# `urls` (Service) vs `docker_compose_domains` (Application) — 同一回事，两种 shape

> 术语见 SKILL.md ## 心智模型 (Coolify Service Resource / sub-application / compose service / Coolify Application Resource)

Coolify 4.x 的 API 里，给 docker-compose 多 service 分别设域名的字段，**在两个不同的命名空间里用了不同的名字和不同的 shape**。这是个隐藏 trap，旧文档和社区 issue 里两种写法混着出现。

## 对照表

| 资源类型 | endpoint | 字段名 | shape |
|---|---|---|---|
| **Service**（Docker Compose Empty）| `PATCH /api/v1/services/{uuid}` | `urls` | `[{name, url}]`<br>url 是 **comma-separated** URLs |
| **Application**（dockercompose build pack）| `PATCH /api/v1/applications/{uuid}` | `docker_compose_domains` | `[{name, domain}]`<br>domain 是 **comma-separated** URLs |

两者：
- 都用数组而非对象（**错误的 object-keyed shape `{"svc": {"url": "..."}}` 会 200 返回但静默不生效**——非常坑）
- `name` 都是 compose 里的 service 名（如 `markdown-kits-app`）
- 单域名也用 comma-separated 字段（用一个值就好，别加逗号）

## 本 skill 走哪个？

本 skill 走 **Service · Docker Compose Empty**，所以 **MUST 只使用 `urls` 字段**；**NEVER 调用 `docker_compose_domains`**，unless 目标资源类型被显式改为 Application/dockercompose build pack。下面所有示例都是 Service 的。

## 写一个域名

```bash
curl -sS -X PATCH \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"urls": [{"name": "markdown-kits-app", "url": "https://markdown-kits-app.tranfu.com:8787"}]}' \
  http://120.77.223.183:8000/api/v1/services/<service-uuid>
```

**MUST 在 `url` 字段中带容器内部端口**（如 `:8787`，即 compose service 真实监听端口），公网仍走 443/80；**NEVER 写公网端口**。Coolify 会自动给 traefik 注入 `port=8787` 的 label。

## 写多个 service 的多个域名（多 sub-application）

```bash
-d '{
  "urls": [
    {"name": "web",    "url": "https://app.tranfu.com:3000"},
    {"name": "api",    "url": "https://api.tranfu.com:4000"},
    {"name": "admin",  "url": "https://admin.tranfu.com:5000"}
  ]
}'
```

每条 `name` 对应 compose `services.<name>` 的名字。

## 同一个 service 多个域名（罕见）

`url` 字段是 comma-separated：

```bash
-d '{"urls": [{"name": "web", "url": "https://a.tranfu.com:3000,https://b.tranfu.com:3000"}]}'
```

## 验证写进去了

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  http://120.77.223.183:8000/api/v1/services/<service-uuid> \
  | jq '.applications[] | {name, fqdn}'
```

返回里每条 sub-application 的 `fqdn` 应该等于我们设的 `url`。**不一致就是没写进去**（最常见原因：传了 object-keyed shape 而不是数组）。

## 不会工作的几种写法

```jsonc
// ❌ object-keyed: 200 OK 但实际无效
{"urls": {"markdown-kits-app": {"url": "https://..."}}}

// ❌ 字段名错了
{"domains": [...]}             // services endpoint 不接受这个字段, 422
{"docker_compose_domains": [...]} // services endpoint 也不接受, 422

// ❌ url 用 array 而非 comma-separated string
{"urls": [{"name": "web", "url": ["https://a", "https://b"]}]}

// ❌ name 跟 compose service 名不一致
{"urls": [{"name": "Web", "url": "..."}]}  // 大小写敏感
```
