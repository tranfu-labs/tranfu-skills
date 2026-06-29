> ⚠️ **DEPRECATED-CLI**: 本文件原文里的 `coolify <cmd>` CLI 命令是 v0.3.x 时期遗留，未迁移到 v0.4.0 的 HTTP API 路径。读时按下表自行 translate，或先看 [coolify-api-fields.md](coolify-api-fields.md)：`coolify app list` → `GET /api/v1/services` + jq；`coolify app get $u` → `GET /api/v1/services/$u`；`coolify app logs $u` → `GET /api/v1/services/$u/logs`。心智模型不变，只是入口换。

# Clear Coolify deployment history and redeploy an existing app

Use this reference when the user explicitly asks to "清理记录 / 删除相关记录 / clean deployment records" before redeploying an already-onboarded tranfu Coolify app.

This is **not** normal redeploy. Normal redeploy MUST 保留 deployment history。Do NOT use this path 除非用户显式要求删除 deployment records，或显式确认清空该 app 的 deployment queue/log 历史。

## Scope and safety

- Context: existing Coolify application, not new onboarding.
- MUST 仅删除 `ApplicationDeploymentQueue` 中目标 app 的记录行。
- MUST NEVER 删除 application、project、containers、images 或 GitHub integration。
- MUST 先取消所有 `queued` / `in_progress` deployments（走 public API/CLI），完成后才允许删除 queue/log 记录。顺序颠倒视为 BLOCKER。
- Coolify CLI/API 暴露 `deploy cancel` 用于活跃 deployment，但没有 public command 删除 finished/failed 历史。自托管 tranfu Coolify MUST 在 `coolify` 容器内用 Laravel tinker 执行删除。

CREATE A TODO LIST FOR THE TASKS BELOW（每步一个 TODO）：

1. 准备变量并校验 `APP_UUID`。若为空 → 报 BLOCKER「target app not found」并退出。     # 卫语句·用前必校
2. 校验目标 app 元信息与最近 deployment 列表。若 `coolify app get` 返回错误 → 报 BLOCKER 并退出。
3. 执行 Step 1 取消活跃 deployment。若 60s 内仍有 `queued` / `in_progress` → 报 BLOCKER「cancel timeout」并退出，不进入 Step 2。   # 失败有出口
4. 执行 Step 2 通过 tinker 删除 queue/log 行。若删除后再次列出仍非空 → 报 BLOCKER「deletion not effective」并退出。
5. 执行 Step 3 触发 redeploy 并轮询。
6. 产出最终交付物 `CLEAR_AND_REDEPLOY_RESULT`（见文末 schema）并结束。                # 显式终止

## Variables

```bash
CONTEXT=local-coolify
REPO=news-app
APP_UUID=$(coolify app list --context="$CONTEXT" --format json \
  | jq -r --arg repo "tranfu-labs/$REPO" --arg name "$REPO" \
    '.[] | select((.git_repository // "") == $repo or .name == $name or ((.name // "") | startswith($name + ":"))) | .uuid' \
  | head -n1)
```

MUST 在使用 `$APP_UUID` 前先校验非空，否则后续命令会作用到错误目标：

```bash
if [ -z "$APP_UUID" ]; then
  echo "BLOCKER: target app not found for REPO=$REPO in CONTEXT=$CONTEXT" >&2
  exit 1
fi
```

Verify target before any destructive cleanup:

```bash
coolify app get --context="$CONTEXT" "$APP_UUID" --format json \
  | jq '{uuid,name,status,build_pack,docker_compose_location,git_repository,git_branch,fqdn}'

coolify app deployments list --context="$CONTEXT" "$APP_UUID" --format json \
  | jq '.[0:20] | map({deployment_uuid:(.deployment_uuid // .uuid), status, created_at, finished_at, commit, commit_message})'
```

## Step 1 — cancel active deployments

```bash
ACTIVE=$(coolify app deployments list --context="$CONTEXT" "$APP_UUID" --format json \
  | jq -r '.[] | select(.status == "queued" or .status == "in_progress") | (.deployment_uuid // .uuid)' || true)

if [ -n "$ACTIVE" ]; then
  for d in $ACTIVE; do
    coolify deploy cancel --context="$CONTEXT" "$d" --force || true
  done
fi

# 轮询直到无活跃 deployment，或达到上限退出
for i in $(seq 1 4); do
  REMAIN=$(coolify app deployments list --context="$CONTEXT" "$APP_UUID" --format json \
    | jq -r '.[] | select(.status == "queued" or .status == "in_progress") | (.deployment_uuid // .uuid)')
  if [ -z "$REMAIN" ]; then
    break
  fi
  sleep 15
done

if [ -n "$REMAIN" ]; then
  echo "BLOCKER: cancel timeout, still active=$REMAIN" >&2
  exit 1
fi
```

MUST 仅在上面最终校验为空时才进入 Step 2；非空 → BLOCKER 退出，NEVER 跳过删除前的取消。

## Step 2 — delete deployment queue/log records for the app

Use Laravel tinker inside the Coolify container so the deletion is scoped through the app UUID:

```bash
docker exec coolify php artisan tinker --execute='use App\Models\Application; use App\Models\ApplicationDeploymentQueue; $app=Application::where("uuid","'"$APP_UUID"'")->firstOrFail(); $count=ApplicationDeploymentQueue::where("application_id",$app->id)->count(); ApplicationDeploymentQueue::where("application_id",$app->id)->delete(); echo "deleted=".$count.PHP_EOL;'
```

MUST 在删除后再次列出 deployment 列表，结果 MUST 为 `[]`，否则报 BLOCKER「deletion not effective」并退出：

```bash
AFTER=$(coolify app deployments list --context="$CONTEXT" "$APP_UUID" --format json)
echo "$AFTER" | jq '.'
if [ "$(echo "$AFTER" | jq 'length')" != "0" ]; then
  echo "BLOCKER: deletion not effective, list is not empty" >&2
  exit 1
fi
```

## Step 3 — redeploy and verify the new deployment

```bash
coolify app start --context="$CONTEXT" "$APP_UUID" --force
```

Capture the returned `Deployment UUID`, then poll that specific deployment:

```bash
DEPLOYMENT_UUID=<returned uuid>
for i in $(seq 1 60); do
  JSON=$(coolify app deployments list --context="$CONTEXT" "$APP_UUID" --format json)
  STATUS=$(printf '%s' "$JSON" | jq -r --arg d "$DEPLOYMENT_UUID" \
    '.[] | select((.deployment_uuid // .uuid) == $d) | .status' | head -n1)
  printf '%s status=%s\n' "$(date -Is)" "${STATUS:-missing}"
  case "${STATUS:-}" in
    queued|in_progress|"") sleep 15 ;;
    *) break ;;
  esac
done

coolify app deployments list --context="$CONTEXT" "$APP_UUID" --format json \
  | jq --arg d "$DEPLOYMENT_UUID" '.[] | select((.deployment_uuid // .uuid) == $d) | {deployment_uuid:(.deployment_uuid // .uuid), status, created_at, finished_at, commit, commit_message}'

coolify app deployments logs --context="$CONTEXT" "$APP_UUID" "$DEPLOYMENT_UUID" --lines 260
coolify app get --context="$CONTEXT" "$APP_UUID" --format json \
  | jq '{uuid,name,status,build_pack,docker_compose_location,fqdn}'
```

If the app has an FQDN, MUST verify HTTP reachability too：

```bash
FQDN=$(coolify app get --context="$CONTEXT" "$APP_UUID" --format json | jq -r '.fqdn')
curl -I --max-time 20 "$FQDN"
```

完成判据（可观测、MUST 全部命中才算 done）：

- `coolify app get` 返回的 `status` MUST 命中 `running:healthy`。
- `coolify app deployments list` 中目标 `DEPLOYMENT_UUID` 的 `status` MUST 命中 `finished` / `success` 任一终态值（非 `queued` / `in_progress` / `failed`）。
- `curl -I` MUST 返回 2xx / 3xx，且响应来自该 app/proxy（3xx 重定向到该站点路径如 `/en` 视为通过）。
- 任一条不满足 → 报 BLOCKER「redeploy not healthy」并退出，NEVER 标记为成功。

## 最终交付物 `CLEAR_AND_REDEPLOY_RESULT`

happy path 结束时 MUST 产出如下结构化结果并停止：

```yaml
CLEAR_AND_REDEPLOY_RESULT:
  app_uuid: <APP_UUID>
  cleared_count: <Step 2 tinker 输出的 deleted=N 中的 N>
  redeploy_deployment_uuid: <DEPLOYMENT_UUID>
  final_app_status: <coolify app get 的 status>
  final_deployment_status: <轮询结束时该 deployment 的 status>
  fqdn_check: <curl -I 的首行 HTTP 状态>
  done: true
```

产出 `CLEAR_AND_REDEPLOY_RESULT` 后流程结束。
