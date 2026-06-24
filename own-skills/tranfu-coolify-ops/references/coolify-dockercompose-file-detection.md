# Docker Compose file detection failures in Coolify

Use this reference when a tranfu app is configured with `build_pack=dockercompose` but deployment fails before compose build with a message like:

```text
Deployment failed: Docker Compose file not found at: /docker-compose.yml (branch: main)
Check if you used the right extension (.yaml or .yml) in the compose file name.
```

## Fast triage sequence

CREATE A TODO LIST FOR THE TASKS BELOW（每步一个 TODO）：

1. 读取当前 app 配置。若 `APP_UUID` 未知 → 报 BLOCKER「缺少 app UUID」并向调用方索取，退出本流程。   # 卫语句·用前必校

```bash
APP_UUID=<app-uuid>
CONTEXT=local-coolify
coolify app get --context="$CONTEXT" "$APP_UUID" --format json \
  | jq '{uuid,name,status,git_repository,git_branch,build_pack,docker_compose_location,base_directory,ports_exposes,fqdn}'
```

2. 按当前 `build_pack` 路由：若 `build_pack=nixpacks` 且报错为 `Nixpacks failed to detect the application type.` → 走子流程「补丁为 dockercompose」；若已是 `dockercompose` → 直接跳到第 3 步；否则 → 报 BLOCKER「未知 build_pack 配置」并退出。   # 派发·穷尽带兜底

子流程「补丁为 dockercompose」对应的 nixpacks 误配症状如下：

```text
Nixpacks failed to detect the application type.
```

Patch it to docker compose via the Coolify API (CLI `app update` may not expose `build_pack` or `docker_compose_location`):

```bash
CONTEXT=local-coolify
APP_UUID=<app-uuid>
CONFIG=/home/hermes/.config/coolify/config.json
TOKEN=$(jq -r --arg ctx "$CONTEXT" '.instances[] | select(.name==$ctx) | .token' "$CONFIG")
BASE=$(jq -r --arg ctx "$CONTEXT" '.instances[] | select(.name==$ctx) | .fqdn' "$CONFIG")

curl -sS -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  --data '{"build_pack":"dockercompose","docker_compose_location":"/docker-compose.yml","ports_exposes":"80"}' \
  "$BASE/api/v1/applications/$APP_UUID"
```

MUST NEVER 把 token 打印到日志或输出。MUST 使用真实的 CLI 配置路径 `/home/hermes/.config/coolify/config.json`；MUST NEVER 从 `$HOME` 拼出来，因为在该 ops profile 下 `$HOME` 会指向 `/home/hermes/.hermes/profiles/ops/home`，路径会错。例外：unless the user explicitly authorizes 走 `$HOME` 拼接（例如在非 ops profile 下复用脚本）。

3. 依次尝试根级 compose 文件名，每改一个 PATCH 后重新部署，按 `coolify deploy get` 的 `status` 字段判定该次部署结果：

- `/docker-compose.yml`
- `/docker-compose.yaml`
- `/compose.yml`

按结果路由：
- 任一名字让部署 `status=success` → 走第 4 步收尾。
- 三个名字全部仍然报 `Docker Compose file not found` → 走第 5 步收尾（仓库/分支没有根级 compose，或在子目录里需要显式配置 `docker_compose_location`）。
- 出现新的、非「file not found」错误 → 报 BLOCKER「compose 检测外的失败」，附上 deployment UUID 与原始错误，退出。

MUST NEVER 不改任何配置就反复重试同一次部署。

4. 部署成功的收尾：记录最终生效的 `docker_compose_location` 与 deployment UUID，产出 `compose-detection-report`（包含 `app_uuid`、`final_docker_compose_location`、`deployment_uuid`、`status=success`）并结束。   # 显式终止

5. 三个根级名字都失败的收尾：产出 `compose-detection-report`（包含 `app_uuid`、最近一次 `deployment_uuid`、当前 `docker_compose_location`、原始 missing-file 错误片段、`status=unresolved`，以及下一步可执行的修复建议：在仓库分支补 compose 文件，或把 `docker_compose_location` 改为子目录路径）并结束。   # 显式终止

失败出口：APP_UUID 缺失 → BLOCKER 并说明缺什么；`coolify` CLI 不存在或无权限 → 降级为只读取 API 并报告环境缺什么；token 读取失败 → BLOCKER「无法解析 Coolify token」。

## Use `coolify deploy get` for hidden deployment evidence

`coolify app deployments logs` hides useful clone/check commands. For compose-file-not-found failures, inspect the deployment directly:

```bash
DEPLOYMENT_UUID=<deployment-uuid>
coolify deploy get --context="$CONTEXT" "$DEPLOYMENT_UUID" --format json \
  | jq '{deployment_uuid,status,commit,commit_message,logs}'
```

The JSON `logs` field often includes hidden entries showing:

- GitHub App token clone/`ls-remote` succeeded (tokens are redacted by Coolify output).
- Which commit and branch were imported.
- The exact compose path Coolify attempted.
- The stack frame (`Application->loadComposeFile`) for file-detection failures.

This is more reliable than trying unauthenticated `git clone`/`git ls-remote` for private tranfu repos from the agent host.

## Interpreting the outcome

- `nixpacks` failure first, then compose-file-not-found after patching to `dockercompose`: Coolify is now using the right build pack, but the repository still lacks the configured compose path.
- New commit triggers an automatic deployment while you are debugging: inspect the newest deployment too before finalizing, because it may contain an attempted fix from the user or another agent.
- If the latest deployment still says compose file not found, report the app UUID, deployment UUID, current `docker_compose_location`, and exact missing-file error; the next actionable fix is to add/move the compose file on the repository branch or configure the correct subpath.
