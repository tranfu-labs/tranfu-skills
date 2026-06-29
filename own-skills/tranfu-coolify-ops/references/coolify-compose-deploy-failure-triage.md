> ⚠️ **DEPRECATED-CLI**: 本文件原文里的 `coolify <cmd>` CLI 命令是 v0.3.x 时期遗留，未迁移到 v0.4.0 的 HTTP API 路径。读时按下表自行 translate，或先看 [coolify-api-fields.md](coolify-api-fields.md)：`coolify app list` → `GET /api/v1/services` + jq；`coolify app get $u` → `GET /api/v1/services/$u`；`coolify app logs $u` → `GET /api/v1/services/$u/logs`。心智模型不变，只是入口换。

# Coolify docker-compose deployment failure triage

Use this reference when a tranfu Coolify app deploys via `build_pack=dockercompose` and the user asks why deployment failed. It complements `coolify-docker-inspection.md`: that file is best when containers are still running; this one is for failed deployments where app logs may be unavailable and Coolify may have already cleaned up the attempted containers.

## Read-only workflow

CREATE A TODO LIST FOR THE TASKS BELOW（每步一个 TODO）：

1. 确认上下文/服务器；MUST 在每条 coolify 命令上显式传 `--context`，NEVER 依赖默认 context：
   ```bash
   coolify context list
   coolify server list --context="${context}" --format json
   ```
   若 `coolify context list` 为空 → BLOCKER 并退出，提示用户先配置 Coolify context。   # 卫语句·用前必校
2. 按 name/repository 子串查找应用，捕获 UUID/status：
   ```bash
   coolify app list --context="${context}" --format json \
     | jq -r '.[] | select((.name // "" | test("alphaos-app"; "i")) or (.git_repository // "" | test("alphaos-app"; "i"))) | {name,uuid,status,fqdn,git_repository,git_branch}'
   ```
   若 jq 结果为空 → 报 BLOCKER「未找到匹配应用」并退出，请用户确认 name/repo 子串。   # 失败有出口
3. 读取应用配置以理解 build 模式与路径；MUST NEVER 打印任何 secret/env 字段：
   ```bash
   coolify app get --context="${context}" "${APP_UUID}" --format json \
     | jq '{uuid,name,status,fqdn,git_repository,git_branch,build_pack,ports_exposes,ports_mappings,base_directory,publish_directory,dockerfile_location,docker_compose_location,health_check_enabled,health_check_path}'
   ```
4. 列最近部署，显式挑出最新的失败/可疑部署。MUST NEVER 依赖数组顺序，MUST 同时检查 `created_at`/`finished_at` 时间戳来决定。
   ```bash
   coolify app deployments list --context="${context}" "${APP_UUID}" --format json \
     | jq '.[0:5] | map({deployment_uuid:(.deployment_uuid // .uuid // .id), status, created_at, finished_at, commit, commit_message})'
   ```
   若结果为空或无 failed/error 状态记录 → 报 BLOCKER「无可分析的失败部署」并退出。   # 失败有出口
5. MUST 使用 deployment logs 而非 app logs 来诊断失败部署；`coolify app logs` 在 compose 部署失败后会以 `Application is not running` 报错，MUST NEVER 用它作为失败诊断主源。
   ```bash
   coolify app deployments logs --context="${context}" "${APP_UUID}" "${DEPLOYMENT_UUID}" --lines 0 --debuglogs
   ```
   若该命令本身报错或返回空日志 → 报 BLOCKER「无法获取部署日志」并退出，给出确切错误信息。   # 失败有出口
6. 若日志冗长/噪声大，MUST 先 grep 下列关键词再读 tail/上下文：`Deployment failed`, `Error`, `failed`, `unhealthy`, `exit status`, `Traceback`, `Exception`, `Killed`, `No space`, `timeout`, `npm ERR`, `Module not found`, `health`。
7. 若部署日志提到某个容器名，MUST 先确认其仍然存在再尝试 `docker logs`：
   ```bash
   docker ps -a --format '{{.ID}} {{.Names}} {{.Status}} {{.Image}}' \
     | grep "${APP_UUID}\|${APP_NAME}" || true
   ```
   若已无容器残留 → 在最终报告中显式声明「Coolify 已清理失败容器」，结论 MUST 仅基于部署日志，MUST NEVER 推断容器内部状态。   # 失败有出口
8. 按下方「Reporting style」汇编最终三元产物 `compose-deploy-failure-report`（含失败阶段判定、UUID/commit、决定性日志行），输出后结束。   # 显式终止

失败出口汇总：context 缺失 / 未找到应用 / 无失败部署 / 拿不到部署日志 → 均报 BLOCKER 并给出缺什么；docker CLI 不可用 → 降级为「仅部署日志」结论。

## Interpretation patterns

- **Build failure**: `docker compose ... build` exits non-zero and the log includes a compiler/package-manager/Dockerfile error before any `Creating/Starting` service lines.
- **Runtime/health failure**: build steps complete, services are created/started, then a dependency fails with lines like:
  ```text
  Container postgres-... Healthy
  Container api-... Started
  Container api-... Waiting
  Container api-... Error
  dependency failed to start: container api-... is unhealthy
  exit status 1
  ```
  In this case the root cause is inside that service's startup path or healthcheck, not Git checkout or image build. Prioritize the compose healthcheck, service stdout/stderr, env requirements, migrations, DB connectivity, listen host/port, and startup timeout/retries.
- **Postgres/DB healthy but API unhealthy**: dependency DB came up; focus on API process/config/health endpoint rather than database container startup.

## Reporting style

最终产物命名为 `compose-deploy-failure-report`，MUST 按下列顺序输出：

1. 失败阶段判定：MUST 写明 `checkout` / `build` / `runtime` / `health` 之一。
2. 标识信息：MUST 包含 app UUID、deployment UUID、commit 哈希。
3. 决定性日志行：MUST 原样贴出（不要改写/翻译），并标明行所在的日志段。
4. 因果判断：MUST NEVER 断言具体代码级 bug，unless 部署日志或容器日志已直接显示该 bug；否则只描述可观测症状。
5. 容器已被清理时：MUST 在报告里显式声明这一事实，并给出下一次 read-only 探针建议（如：rerun 时实时抓取 service stdout/stderr，或让应用把启动错误输出到 stdout/stderr）。
