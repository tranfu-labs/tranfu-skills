# Existing Coolify app redeploy workflow

Use this reference when the user asks to redeploy an already-onboarded tranfu Coolify app, e.g. “再部署一遍 <github-url>”. This is different from onboarding a new app:

- MUST NEVER 创建新的 project / application 资源。
- MUST NEVER 删除或重建已有的 service / volume / database 资源。
- MUST 沿用已有 app 的 UUID、分支与构建配置；如需变更配置，退出并提示用户走 onboarding 流程。

## 完成判据（observable done）

redeploy 完成 = 同时满足以下三条可观测条件，缺一不可：

1. `coolify app deployments list` 返回的目标 `DEPLOYMENT_UUID` 行 `.status` 命中终态集合 `{success, finished, completed}` 之一（失败终态 `{failed, error, cancelled}` 视为失败出口）。
2. `coolify app deployments logs` 末段无 `ERROR` / `preflight failed` 关键字。
3. `docker ps` 中匹配 `$APP_UUID` 的服务容器 `Status` 为 `Up`（非 `Restarting` / `Exited`）。

任一条件不满足 → 转入「失败出口」段处置，不得宣称完成。

## 执行 TODO（多步流程）

CREATE A TODO LIST FOR THE TASKS BELOW（每步一个 TODO，逐步推进）：

1. 跑「Read-only prerequisites」解析 `APP_UUID`；若解析为空 → 路由到 onboard-new-app 并退出。 # 卫语句·用前必校
2. 跑「Trigger redeploy」获取 `DEPLOYMENT_UUID`；若命令未返回 UUID → 报 BLOCKER「redeploy 未入队」并退出。 # 用前必校
3. 跑「Verify completion」轮询直到命中终态或耗尽 20 轮。
4. 按终态路由：成功终态 → 报告完成并打印 `APP_UUID` / `DEPLOYMENT_UUID` / `fqdn`，结束；失败终态或队列阻塞 → 子流程「If redeploy fails at runtime/healthcheck」；超时未终态 → 报 HIGH「verify timeout」并附最近一次 logs 输出，结束。 # 派发·穷尽带兜底·显式终止

## Read-only prerequisites

1. Confirm the context and pass it explicitly on every command:
   ```bash
   coolify context list
   CONTEXT=local-coolify
   ```
2. Resolve the app by repo/name and capture UUID/status:
   ```bash
   REPO=alphaos-app
   APP_UUID=$(coolify app list --context="$CONTEXT" --format json \
     | jq -r --arg repo "tranfu-labs/$REPO" --arg name "$REPO" \
       '.[] | select((.git_repository // "") == $repo or .name == $name or ((.name // "") | startswith($name + ":"))) | .uuid' \
     | head -n1)
   coolify app get --context="$CONTEXT" "$APP_UUID" --format json \
     | jq '{uuid,name,status,git_repository,git_branch,build_pack,docker_compose_location,fqdn}'
   ```
3. If no app is found, route to onboard-new-app instead of redeploy.

## Trigger redeploy

MUST 使用 `app start` 作为 application redeploy 的入口，因为它直接返回队列中的 deployment UUID，便于后续轮询；unless 用户明确指定换用 `coolify deploy uuid <uuid> --force`。

```bash
coolify app start --context="$CONTEXT" "$APP_UUID" --force
```

约束与可选项：
- `--force`：MUST 带上，强制按已配置分支重建/重新部署。
- `--instant-deploy`：可选，普通队列 redeploy NEVER 需要它，除非用户显式要求即时部署。
- `coolify deploy uuid <uuid> --force`：备用入口；NEVER 与 `app start` 在同一次 redeploy 中并用，避免重复入队。

## Verify completion

MUST 用「Trigger redeploy」返回的 `DEPLOYMENT_UUID` 做精确轮询，NEVER 只看 `app status` 字段——后者反映的是 application 当前态，不是本次 redeploy 的真实进度。

进入本段前 MUST 先校验 `DEPLOYMENT_UUID` 非空（用前必校）：若为空 → 退回上一步报 BLOCKER「redeploy 未入队」并退出。

```bash
# 用前必校：DEPLOYMENT_UUID 必须由 app start 输出捕获，不得为空
DEPLOYMENT_UUID=<from app start output>
if [ -z "$DEPLOYMENT_UUID" ]; then
  echo "BLOCKER: DEPLOYMENT_UUID is empty; redeploy was not queued" >&2
  exit 1
fi

for i in $(seq 1 20); do
  JSON=$(coolify app deployments list --context="$CONTEXT" "$APP_UUID" --format json)
  STATUS=$(printf '%s' "$JSON" | jq -r --arg d "$DEPLOYMENT_UUID" \
    '.[] | select((.deployment_uuid // .uuid) == $d) | .status')
  printf '%s status=%s\n' "$(date -Is)" "$STATUS"
  case "$STATUS" in
    queued|in_progress|"") sleep 30 ;;          # 中间态：继续轮询
    success|finished|completed) break ;;         # 成功终态：跳出循环，进入完成判据校验
    failed|error|cancelled) break ;;             # 失败终态：跳出循环，进入失败出口
    *) echo "WARN: unknown status=$STATUS" >&2; break ;;  # 未知态：跳出，按 HIGH 处置
  esac
done

coolify app deployments logs --context="$CONTEXT" "$APP_UUID" "$DEPLOYMENT_UUID" --lines 120
```

MUST 用 `deployment_uuid // .uuid` 做字段兜底，因为 Coolify CLI 不同版本字段名不同。

按 `STATUS` 路由（穷尽带兜底）：
- `success` / `finished` / `completed` → 跑「完成判据」三条；全过 → 报告完成并结束；任一不过 → 转「失败出口」子流程。
- `failed` / `error` / `cancelled` → 直接转「失败出口」子流程。
- 20 轮后仍为 `queued` / `in_progress` / 空 → 转下一小节「队列阻塞排查」。
- 未知 status → 报 HIGH「unknown deployment status」并附最近一次 logs 输出，结束。

### 队列阻塞排查

若新 deployment 长时间停在 `queued`，可能被更早的 `in_progress` 阻塞。MUST NEVER 仅凭 `queued` 状态就宣称完成；MUST 同时检查 deployment 列表和当前服务容器：

```bash
coolify app deployments list --context="$CONTEXT" "$APP_UUID" --format json \
  | jq '.[0:5] | map({deployment_uuid:(.deployment_uuid // .uuid // .id), status, created_at, finished_at, commit, commit_message})'

docker ps -a --format '{{.ID}} {{.Names}} {{.Status}} {{.Image}}' \
  | grep "$APP_UUID\|$REPO" || true
```

若发现更早的 deployment 处于 `in_progress` 且服务容器在 restart，MUST 立刻抓取该容器日志——队列堵塞只是表象，正在 restart 的容器里通常藏着决定性的 preflight / runtime 错误。抓完日志后转「失败出口」子流程。

## 失败出口：If redeploy fails at runtime/healthcheck

若日志显示 services 已创建但容器进入 unhealthy 状态，MUST 立即抓取容器日志，否则 Coolify cleanup 会把关键证据清掉：

```bash
docker ps -a --format '{{.ID}} {{.Names}} {{.Status}} {{.Image}}' \
  | grep "$APP_UUID\|$REPO" || true

API_CONTAINER=$(docker ps -a --format '{{.Names}}' | grep "^api-$APP_UUID" | head -n1 || true)
if [ -n "$API_CONTAINER" ]; then
  docker logs --tail 120 "$API_CONTAINER" 2>&1 || true
fi
```

解读规则：
- 构建成功 + Postgres/容器依赖已起 + API 容器 unhealthy = API service 内部的 runtime / preflight / 配置问题。
- 反复出现 `AlphaOS deployment preflight failed: <ENV_VAR> is required.` 这类行 → MUST 先在 Coolify 中补齐对应环境变量，再走一次完整 redeploy；NEVER 在未修改任何配置的情况下重复重试同一个 deployment。

## 终止判据（显式终止）

happy path 终点：完成判据三条全过 → 产出 `redeploy-report`（含 `APP_UUID` / `DEPLOYMENT_UUID` / 终态 / `fqdn` / 最近 logs 末尾片段），结束。

失败出口终点：在「失败出口」段抓到容器日志并定位到具体 preflight / runtime / 配置错误 → 产出 `redeploy-failure-report`（含 `APP_UUID` / `DEPLOYMENT_UUID` / 失败终态 / 关键错误行 / 建议的下一动作如「补环境变量」），结束。NEVER 在未产出上述任一 report 的情况下宣称本次 redeploy 流程结束。
