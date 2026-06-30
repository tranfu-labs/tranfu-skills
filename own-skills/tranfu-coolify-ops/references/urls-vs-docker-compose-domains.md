# `docker_compose_domains` (Application) vs `urls` (Service) — 同一回事，两种 shape

Coolify 4.x 的 API 里，给 docker-compose 多 service 分别设域名的字段，**在两个不同的命名空间里用了不同的名字和不同的 shape**。这是个隐藏 trap，旧文档和社区 issue 里两种写法混着出现。

## 对照表

| 资源类型 | endpoint | 字段名 | shape |
|---|---|---|---|
| **Application**（dockercompose build pack, 0.8 走的）| `PATCH /api/v1/applications/{uuid}` | `docker_compose_domains` | `[{name, domain}]`<br>domain 是 **comma-separated** URLs |
| **Service**（Docker Compose Empty, 0.7 旧形态）| `PATCH /api/v1/services/{uuid}` | `urls` | `[{name, url}]`<br>url 是 **comma-separated** URLs |

两者：
- 都用数组而非对象（**错误的 object-keyed shape `{"svc": {"url": "..."}}` 会 200 返回但静默不生效**——非常坑）
- `name` 都是 compose 里的 service 名（如 `markdown-kits-app`）
- 单域名也用 comma-separated 字段（用一个值就好，别加逗号）

## 本 skill 走哪个？

本 skill 0.8 走 **Application · private-github-app + dockercompose**，所以**永远只用 `docker_compose_domains`**，不要碰 `urls` (那是旧 Service 形态)。下面所有示例都是 Application 的。

## 写一个域名

```bash
curl -sS -X PATCH \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"docker_compose_domains": [{"name": "markdown-kits-app", "domain": "https://markdown-kits-app.tranfu.com:8787"}]}' \
  http://120.77.223.183:8000/api/v1/applications/<application-uuid>
```

注意 URL 末尾的 `:8787`——这是**容器内部端口**，公网仍走 443。Coolify 会自动给 traefik 注入 `port=8787` 的 label。

## 写多个 service 的多个域名（多 sub-application）

```bash
-d '{
  "docker_compose_domains": [
    {"name": "web",    "domain": "https://app.tranfu.com:3000"},
    {"name": "api",    "domain": "https://api.tranfu.com:4000"},
    {"name": "admin",  "domain": "https://admin.tranfu.com:5000"}
  ]
}'
```

每条 `name` 对应 compose `services.<name>` 的名字。

## 同一个 service 多个域名（罕见）

`domain` 字段是 comma-separated：

```bash
-d '{"docker_compose_domains": [{"name": "web", "domain": "https://a.tranfu.com:3000,https://b.tranfu.com:3000"}]}'
```

## 验证写进去了

```bash
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  http://120.77.223.183:8000/api/v1/applications/<application-uuid> \
  | jq '.applications[] | {name, fqdn}'
```

返回里每条 sub-application 的 `fqdn` 应该等于我们设的 `domain`。**不一致就是没写进去**（最常见原因：传了 object-keyed shape 而不是数组, 或者用了 `url` key 而不是 `domain` key）。

## 不会工作的几种写法

```jsonc
// ❌ object-keyed: 200 OK 但实际无效
{"docker_compose_domains": {"markdown-kits-app": {"domain": "https://..."}}}

// ❌ 字段名错了
{"urls": [...]}                    // applications endpoint 不接受这个字段, 422 (旧 0.7 Service 形态)
{"domains": [...]}                 // 单容器 Application 用的字段, dockercompose build_pack 不接受, 422

// ❌ key 错了
{"docker_compose_domains": [{"name": "web", "url": "https://..."}]}  // 应该是 "domain" 不是 "url"

// ❌ domain 用 array 而非 comma-separated string
{"docker_compose_domains": [{"name": "web", "domain": ["https://a", "https://b"]}]}

// ❌ name 跟 compose service 名不一致
{"docker_compose_domains": [{"name": "Web", "domain": "..."}]}  // 大小写敏感
```

## 历史 (0.7 → 0.8)

0.7 走 Service / Docker Compose Empty, 改域名用 `urls: [{name, url}]`. 0.8 切到 Application + private-github-app + dockercompose 后, 字段名换成 `docker_compose_domains: [{name, domain}]`. 资源 namespace 也从 `/services` 换到 `/applications`. 同期 GitHub repo 形成 binding (有 git_repository / git_branch / github_app_uuid).
