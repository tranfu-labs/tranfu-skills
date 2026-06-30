# `SERVICE_FQDN_*` 是 Coolify → 容器的 output，不是 user → Coolify 的 input

这是 Coolify 4.x 的一个**反直觉行为**，踩过会浪费很多时间。

## 坑长什么样

写 compose 时直觉做法：

```yaml
services:
  myapp:
    environment:
      SERVICE_FQDN_MYAPP_8787: 'https://myapp.tranfu.com:8787'   # ← 自以为这样能设域名
```

PATCH compose 后 GET service，**域名根本不是 `https://myapp.tranfu.com:8787`**——而是 Coolify 自动给的 `http://myapp-<uuid>.<server-ip>.sslip.io:8787` 临时域名。我们设的真值被忽略了。

## 真相

`SERVICE_FQDN_<SVC>_<PORT>` 是 **Coolify 注入到容器环境里的变量**——让运行中的容器知道"自己对外的域名是什么"（应用代码可能要回链、跳转、生成绝对 URL 时用）。它是 **output 方向**：Coolify → 容器。

- 你在 compose 里写 `SERVICE_FQDN_XXX: ''`（空值）→ Coolify 检测到这个键存在 → 自动分配 sslip.io fallback → 写回这个键 → 注入到容器 env。
- 你在 compose 里写 `SERVICE_FQDN_XXX: 'https://your.com'` → Coolify 仍然把它当成"占位声明"，**忽略你给的值**，自己重新分配 sslip.io fallback。

也就是说，**这个键写啥都一样**——它只起到"声明这个 service 要对外、端口是 XXX"的作用。

## 真正改域名的入口

走 [urls-vs-docker-compose-domains.md](urls-vs-docker-compose-domains.md)：`PATCH /api/v1/applications/{uuid}` 带 `docker_compose_domains: [{name, domain}]` (0.8 Application 形态; 旧 0.7 Service 形态走 `urls: [{name, url}]`)。

## 已知 bug：portless 写法会卡在原域名

Issue [#6124](https://github.com/coollabsio/coolify/issues/6124) / [#8912](https://github.com/coollabsio/coolify/issues/8912) 记录：

- `SERVICE_FQDN_MYAPP`（无 port 后缀） → 永远绑死在首次部署时分配的 sslip.io 域名，UI 改域名也不重新解析。
- `SERVICE_FQDN_MYAPP_8787`（带 port 后缀） → 会跟随 UI / `urls` 字段更新。

**本 skill 一律用 port-suffixed 写法**，不踩这个雷。

## compose 里到底要不要写 `SERVICE_FQDN_*`？

要写——但只是用来声明"这个 service 要对外 + 用哪个内部端口"。值写 `''` 即可。

```yaml
services:
  myapp:
    expose:
      - "8787"
    environment:
      SERVICE_FQDN_MYAPP_8787: ''     # 声明对外，端口 8787。Coolify 自动填值。
```

域名的真值通过 `urls` 字段单独设。两边职责分开。

## 校验是否中招

部署后跑：

```bash
# 看 sub-application.fqdn 是不是真域名（不是 sslip.io 或 <wildcard>.tranfu.com）
curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  http://120.77.223.183:8000/api/v1/applications/<uuid> \
  | jq '.applications[].fqdn'
```

如果出现 `sslip.io` 子串 → 域名没设；走 `docker_compose_domains` PATCH 修 (Application 形态; 旧 Service 形态用 `urls`)。
