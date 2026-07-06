# Coolify 只读全量盘点

适用场景：用户明确要求“遍历 Coolify 上的 project / resources / deployments”、生成资产清单、域名表、首次部署成功日期、状态报告等。此场景是只读 inventory/reporting，不是部署 reconcile；可以跨 project 扫描，但不得执行 PATCH/POST deploy/env/delete/start/stop/restart 等写操作。

## 推荐数据源

- `GET /api/v1/projects`：拿 project 列表；list 摘要可能不含 environments。
- `GET /api/v1/projects/{uuid}`：拿 project 的 environments，用 `environment.id -> project/environment` 建映射。
- `GET /api/v1/resources`：拿 application/service/database 等资源的完整摘要；比 `coolify app list` 更适合归属 project，因为包含 `environment_id`、`fqdn`、`docker_compose_domains`、`created_at`、`status`。
- `coolify app deployments list <app_uuid> --format json` 或 `GET /api/v1/deployments/applications/{uuid}`：拿 deployment 历史。

## 首次部署成功日期判定

1. 对每个 application resource 读取 deployment 历史。
2. 过滤 `status` 为 `finished` / `success` / `succeeded` 的记录。
3. 按 `finished_at` 优先、fallback `created_at` 升序排序。
4. 最早一条即“首次部署成功”；没有匹配记录则标 `—`。
5. 面向中文用户输出日期时可转北京时间日期，并在结果说明中写清楚。

## 域名解析

- 优先收集顶层 `fqdn`。
- 同时解析 `docker_compose_domains`；该字段可能是 JSON 字符串，常见形态：`{"web":{"domain":"https://example.com:3000"}}`。
- 多服务应用可能有多个域名；保留并用逗号连接。
- 不要把 env value、tokens、manual webhook secrets 打印到最终报告。

## 输出建议

表格列建议：`Project`、`环境`、`应用/资源`、`首次部署成功日期`、`域名`、`当前状态`。空 project 也保留一行，标注 `无 application`。如果同一 project 下存在旧/新重复 application，按资源单独列行，不要合并，以免隐藏 unhealthy/legacy 实例。