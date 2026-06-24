# Coolify dockercompose service domains via API

Use this reference when a tranfu Coolify application uses `build_pack: dockercompose` and the user asks to set domains for individual services such as `https://host:{SERVICE_PORT}`.

## Key behavior

- `coolify app update --domains ...` is for non-compose applications. For `build_pack=dockercompose`, Coolify returns HTTP 422:
  - `The domains field cannot be used for dockercompose applications. Use docker_compose_domains instead to set domains for individual services.`
- Coolify CLI 1.6.2 does not expose a `--docker-compose-domains` flag on `coolify app update`; use the Coolify API directly.
- The API field shape is an array of objects:

```json
{
  "docker_compose_domains": [
    {"name": "web", "domain": "https://example.com:3000"},
    {"name": "api", "domain": "https://api.example.com:8000"}
  ]
}
```

- `name` must match a service key in the app's `docker_compose_raw` / repository `compose.yml`. Coolify silently ignores entries whose service name is not present.
- `domain` can contain a comma-separated list of URLs if one service needs multiple domains.
- Verify using a direct API GET, not only `coolify app get`: CLI 1.6.2 may print `docker_compose_domains: null` even after the API value is stored.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW（每步一个 TODO）：

1. 确认 context 与 app UUID（按 tranfu Coolify 常规前置）。若任一缺失 → 报 BLOCKER「缺 context 或 UUID」并退出。  # 卫语句·用前必校
2. 读取该 app 的 compose 源并提取目标 service 端口：

```bash
coolify app get --context="${context}" "${APP_UUID}" --format json \
  | jq -r '.docker_compose_raw // .docker_compose // empty'
```

   若输出为空 → 报 BLOCKER「无法读取 compose 源」并退出。  # 失败有出口

   对 compose 服务，MUST 使用 service-level `expose` / 容器内 `PORT` 作为 `{WEB-PORT}` 与 `{API-PORT}`，NEVER 使用 host port 映射，unless 用户明确要求使用 host 映射。

3. 用 `curl` PATCH 应用 API。MUST 保持 token 私密；NEVER 在日志或 final reply 中打印 token。**不要写 python / 临时脚本——bash + curl + jq 即可。**

```bash
# context 的 url + token 取法见 commands/context.md；优先试 `coolify context list --format json`，
# 没暴露则从本机 coolify 配置目录读，整段操作不要落盘 token 到日志或 final reply。
BASE="<context fqdn, e.g. https://coolify.tranfu.com>"
TOKEN="<context token>"
UUID="<app-uuid>"

curl -sS -X PATCH "${BASE%/}/api/v1/applications/${UUID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc \
        --arg web "https://alphaos-app.tranfu.com:3300" \
        --arg api "https://alphaos-api-app.tranfu.com:8000" \
        '{docker_compose_domains:[{name:"web",domain:$web},{name:"api",domain:$api}]}')"
```

   若 PATCH 返回非 2xx（典型如 422 domain conflict）→ 停下并报告冲突资源，NEVER 自动重试；仅当用户明确确认风险时才使用 `force_domain_override` 重试。  # 失败有出口

4. 用直接 API GET 校验（CLI 1.6.2 即使 API 值已存也可能仍打印 `null`——MUST 走 API，NEVER 用 `coolify app get` 作为唯一校验）：

```bash
curl -sS "${BASE%/}/api/v1/applications/${UUID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/json" \
  | jq '.docker_compose_domains'
```

Expected stored shape is a JSON string mapping service names to domains, for example:

```json
{"web":{"domain":"https://alphaos-app.tranfu.com:3300"},"api":{"domain":"https://alphaos-api-app.tranfu.com:8000"}}
```

完成判据（done = 可观测）：API GET 返回的 `docker_compose_domains` 中每个目标 service 名都存在，且对应 `domain` 字段字符串与本次 PATCH 提交的目标 URL 逐字一致。若任一 service 名缺失 → 报 BLOCKER「service 名与 compose 不匹配，Coolify 已静默丢弃」并退出。

5. 产出「docker_compose_domains 校验结果」（包含校验后的 service→domain 映射 JSON 与是否全部命中的布尔结论）并结束。  # 显式终止

失败出口汇总：
- context / UUID 缺失 → BLOCKER。
- compose 源读取为空 → BLOCKER。
- PATCH 非 2xx → 停并报告冲突资源；仅在用户明确确认后才走 `force_domain_override` 子流程。
- GET 校验中 service 名缺失 → BLOCKER「service 名与 compose 不匹配」。

## Pitfalls

- MUST NEVER 在 dockercompose 应用上设置顶层 `domains` 字段。
- MUST NEVER 将 Coolify API token 暴露或保存到 memory、skill 文件、final reply 或命令输出中。
- 若返回 domain 冲突 → MUST 停并报告冲突资源；NEVER 自动使用 `force_domain_override`，unless 用户明确确认风险。
