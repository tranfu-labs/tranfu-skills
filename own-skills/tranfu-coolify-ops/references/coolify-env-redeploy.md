# Coolify env update + redeploy workflow

Use this reference when a tranfu Coolify app is already onboarded and the user supplies a `.env` blob or asks to “实现部署” after a deployment failed because runtime secrets were missing.

## Safety rules for secrets

- MUST NEVER print secret values back to the chat or store them in memory/skill content.
- If a temporary `.env` file is needed, MUST create it outside the repo, use it only for Coolify CLI calls, then overwrite/unlink it before finishing.
- Verification MUST print only key names and value lengths, never values.
- MUST NEVER commit `.env` files. Treat user-provided API keys/tokens as ephemeral task input.

## Apply env values

`coolify app env sync` exists, but in CLI 1.6.x it may emit non-JSON even with `--format json`, and in practice it is not reliable enough to assume success. MUST use explicit update/create per key, then verify.

流程：apply-env-values

1. 用前必校：若 `$CONTEXT` / `$APP_UUID` / `$ENV_FILE` 任一为空 → 报 BLOCKER「缺必填变量」并退出。
2. 用前必校：若 `$ENV_FILE` 不存在或不可读 → 报 BLOCKER「ENV_FILE 不可读」并退出。
3. 逐行读取 `$ENV_FILE`：跳过空行 / 注释行 / 不含 `=` 的行；解析出 `key` / `val`。
4. 对每个 key 执行 update；若 update 失败 → 执行 create。
5. 若 create 也失败 → 报 BLOCKER「无法写入 key=<KEY>」并立即退出，不继续后续 key。
6. 全部 key 处理完毕 → 调用「Verify」段进行长度校验，产出「len 报告」并结束。

```bash
CONTEXT=local-coolify
APP_UUID=<app-uuid>
ENV_FILE=/path/to/temp.env

# Guard clauses: validate required inputs before consuming them.
[ -n "$CONTEXT" ]   || { echo "BLOCKER: CONTEXT empty";   exit 1; }
[ -n "$APP_UUID" ]  || { echo "BLOCKER: APP_UUID empty";  exit 1; }
[ -n "$ENV_FILE" ]  || { echo "BLOCKER: ENV_FILE empty";  exit 1; }
[ -r "$ENV_FILE" ]  || { echo "BLOCKER: ENV_FILE not readable: $ENV_FILE"; exit 1; }

# Parse only KEY=VALUE lines; skip blank/comment lines. For simple config values, strip inline comments.
while IFS='=' read -r raw_key raw_val; do
  key="$(printf '%s' "$raw_key" | xargs)"
  val="$(printf '%s' "${raw_val:-}" | sed -E 's/[[:space:]]+#.*$//' | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
  [ -n "$key" ] || continue
  case "$key" in \#*) continue;; esac

  if coolify app env update --context="$CONTEXT" "$APP_UUID" "$key" --value "$val" --is-literal >/dev/null 2>&1; then
    printf 'updated %s len=%s\n' "$key" "${#val}"
  elif coolify app env create --context="$CONTEXT" "$APP_UUID" --key "$key" --value "$val" --is-literal >/dev/null 2>&1; then
    printf 'created %s len=%s\n' "$key" "${#val}"
  else
    printf 'BLOCKER: failed to write %s\n' "$key" >&2
    exit 1
  fi
done < "$ENV_FILE"
```

Verify without leaking values:

```bash
coolify app env list --context="$CONTEXT" "$APP_UUID" --format json --show-sensitive \
  | jq 'map({key:(.key // .name // .variable), value:((.value // .real_value // .value_raw // "")|tostring)})
        | map({key, value_len:(.value|length), empty:((.value|length)==0)})'
```

## Detect and fix Coolify variable-reference cycles

A failed compose build can show:

```text
Invalid expression; variable cycle not allowed for SERVICE_PASSWORD_JWT
```

This can happen when app secrets such as `UNKEY_ROOT_KEY`, `ALPHAOS_JWT_SECRET`, or `ALPHAOS_API_KEY` are set to Coolify placeholder-style references that point back to `SERVICE_PASSWORD_JWT`. Even if `--is-literal` is set, MUST inspect actual saved values (without printing them) for `$VAR` / `${VAR}` references.

流程：detect-and-fix-cycles

1. 用前必校：若 `$CONTEXT` / `$APP_UUID` 任一为空 → 报 BLOCKER「缺必填变量」并退出。
2. 用下方 jq 扫描脚本拉取所有 env 项，输出引用其它变量的项列表（refs 非空）。
3. 若 refs 列表为空 → 产出「无循环」并结束。
4. 对每个引用了已生成 secret 的 key，按判据路由：
   - 应用只需要不透明 token → 子流程「生成并写入新 literal」。
   - 该 key 必须保留对其他变量的引用 → 报 deferred_with_user_visible_risk「需人工解环」并退出。
   - 否则 → 报 BLOCKER「未知 ref 处置策略」并退出。
5. 重新跑第 2 步扫描；若 refs 仍非空 → 报 HIGH「修复未生效」并退出；否则 → 产出「循环已清除」并结束。

子流程「生成并写入新 literal」：
1. 用 `openssl rand -hex 32` 生成新值。
2. 调用 `coolify app env update ... --is-literal` 写入；若失败 → 返回 BLOCKER「写入失败」。
3. 返回成功。

**不要写 python——bash + jq 即可。** jq 1.6+ 自带 `scan` 函数能跑正则。

```bash
coolify app env list --context="$CONTEXT" "$APP_UUID" --format json --show-sensitive \
  | jq -r '
      map({
        key:        (.key // .name // .variable),
        value:      ((.value // .real_value // .value_raw // "") | tostring),
        is_literal: .is_literal
      })
      | map(. + {
          refs: ([(.value | scan("\\$\\{?([A-Za-z_][A-Za-z0-9_]*)\\}?"))[0]] | unique)
        })
      | map(select(.refs | length > 0))
      | map({key, value_len: (.value | length), refs, is_literal})
    '
```

If a secret references another generated secret and the app only requires an opaque token, replace it with a newly generated literal secret and verify refs are gone:

```bash
for key in UNKEY_ROOT_KEY ALPHAOS_JWT_SECRET ALPHAOS_API_KEY; do
  val="$(openssl rand -hex 32)"
  coolify app env update --context="$CONTEXT" "$APP_UUID" "$key" --value "$val" --is-literal >/dev/null
  printf 'updated %s len=%s\n' "$key" "${#val}"
done
```

## Deployment queue cleanup

After env updates, trigger a fresh redeploy:

```bash
coolify app start --context="$CONTEXT" "$APP_UUID" --force
```

流程：deployment-queue-cleanup

1. 用前必校：若 `$CONTEXT` / `$APP_UUID` 任一为空 → 报 BLOCKER「缺必填变量」并退出。
2. 触发 redeploy 后，列出最近的 deployments；若目标 deployment 已直接进入 `in_progress` 且无更早阻塞项 → 跳到第 7 步。
3. 识别排在目标前面的所有 `in_progress` / `queued` 旧 deployment；若无 → 跳到第 7 步。
4. 抓取活动 deployment 与 service 容器日志，作为取消前的证据。
5. MUST 向用户明确请求确认后再取消任何 deployment；用户拒绝 → 报 deferred_with_user_visible_risk「队列阻塞未清理」并退出。
6. 仅取消阻塞的旧 deployments，保留最新的目标 deployment 处于 queued/in_progress；取消命令返回 API 400 且文案为 `cancelled-by-user` → 视为成功并重新列表，回到第 3 步。
7. 等待目标 deployment 进入 `in_progress` / `finished`；按下方「Success verification」校验后产出「队列清理完成」并结束。

```bash
coolify deploy cancel --context="$CONTEXT" "$OLD_DEPLOYMENT_UUID" --force
```

## Success verification

完成判据（observable，全部命中才算 done）：

- `coolify app deployments list` 的最新一条 `status == "finished"`。
- `coolify app get` 的 `status == "running:healthy"`。
- `docker ps -a` 中匹配 `$APP_UUID` 或 `$REPO` 的容器 `Status` 列均为 `Up` 或 `healthy`，无 `Restarting` / `Exited`。
- 服务日志命中至少一条决定性启动行（见本节末示例）。

任一项不满足 → 报 HIGH「部署未达稳态」并指出缺失项，不要声称成功。

校验命令：

```bash
coolify app deployments list --context="$CONTEXT" "$APP_UUID" --format json \
  | jq '.[0:5] | map({deployment_uuid:(.deployment_uuid // .uuid // .id), status, created_at, finished_at, commit})'

coolify app get --context="$CONTEXT" "$APP_UUID" --format json \
  | jq '{uuid,name,status,fqdn,git_repository,git_branch}'

docker ps -a --format '{{.ID}} {{.Names}} {{.Status}} {{.Image}}' \
  | grep "$APP_UUID\|$REPO" || true
```

Useful decisive runtime log lines include `preflight passed`, migration output, `Application startup complete`, and healthcheck `200 OK` responses.
