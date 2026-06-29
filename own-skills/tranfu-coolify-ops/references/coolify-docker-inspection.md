> ⚠️ **DEPRECATED-CLI**: 本文件原文里的 `coolify <cmd>` CLI 命令是 v0.3.x 时期遗留，未迁移到 v0.4.0 的 HTTP API 路径。读时按下表自行 translate，或先看 [coolify-api-fields.md](coolify-api-fields.md)：`coolify app list` → `GET /api/v1/services` + jq；`coolify app get $u` → `GET /api/v1/services/$u`；`coolify app logs $u` → `GET /api/v1/services/$u/logs`。心智模型不变，只是入口换。

# Coolify Docker app inspection and high-CPU evidence capture

Use this reference when一个 tranfu Coolify 应用已部署，用户要拿容器日志、top/CPU/内存占用、或要给 source-owning/local AI 的证据包。本文在完整 `scenarios/inspect-app.md` 落地前作为补位流程。

## 输入 / 输出 / 完成标准

- 输入：`${context}`（Coolify context 名）、应用名或子串、可选 `${APP_UUID}`、可选 host `${PID}`、可选 `${CID}`。
- 输出：`INSPECTION_EVIDENCE` —— 一份证据包文本，含 context/app 标识、容器日志摘录、host & container 资源快照、`docker inspect` 选字段、（可选）容器内探针结果、（可选）请求日志摘要与延迟探针结果，所有 env / token / secret 已脱敏。
- 完成标准（可观测）：`INSPECTION_EVIDENCE` 至少包含 §"必采字段"列出的字段；`grep -E '(API_KEY|SECRET|TOKEN|PASSWORD)=.+' INSPECTION_EVIDENCE` 无明文命中；happy path 末尾必须显式产出 `INSPECTION_EVIDENCE` 并结束。

## Scope

- Read-only inspection only：`context list`、`server list`、`app list/get`、`app logs`、`docker ps/stats/inspect/logs/top/exec ps`、`top/free/df/ps/ss`。
- MUST NEVER restart、stop、delete、redeploy 或修改 env，unless 用户在本轮显式确认（这些动作属于 lifecycle/config 场景，应走对应 scenario）。
- MUST 在每条 `coolify` 命令上显式带上已确认的 Coolify context，例如 `--context="local-coolify"`；未确认 context 前 MUST NEVER 执行任何 `coolify` 命令。

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW（每步一个 TODO）：

1. 加载 `tranfu-coolify-ops` 并执行 `commands/prerequisites.md` 的共享前置：
   - `coolify context list`
   - `coolify server list --context="${context}" --format json`
   若 `${context}` 缺失或 `context list` 中查不到 → 报 BLOCKER「未确认 Coolify context」并退出，不执行后续任何 `coolify` 命令。   # 卫语句·用前必校
2. 定位应用。Coolify 给 docker-compose 部署的命名可能带 branch 与 UUID 后缀；若精确名查不到 → 用子串搜索；若子串仍无命中 → 报 BLOCKER「应用未找到」并退出。
   ```bash
   coolify app list --context="${context}" --format json \
     | jq -r '.[] | select((.name // "" | test("tranfu-agents-app"; "i"))) | {name, uuid, status, fqdn}'
   ```
3. 先取常规 Coolify 容器日志（若 `${APP_UUID}` 未确定 → 用第 2 步结果填入；仍缺失 → 报 BLOCKER「APP_UUID 未确定」并退出）：
   ```bash
   coolify app logs --context="${context}" "${APP_UUID}" --lines 100
   ```
4. 按 host `top` 是否出现热点进程派发：有热点 PID → 子流程「证明热进程归属」；无热点 → 跳至步骤 5。   # 分支·穷尽
   子流程「证明热进程归属」（输入 `${PID}`）：
   ```bash
   PID=<host-pid>
   tr '\0' ' ' < /proc/$PID/cmdline; echo
   cat /proc/$PID/cgroup
   for cid in $(docker ps -q); do
     name=$(docker inspect -f '{{.Name}}' "$cid" 2>/dev/null | sed 's#^/##')
     image=$(docker inspect -f '{{.Config.Image}}' "$cid" 2>/dev/null)
     hp=$(docker inspect -f '{{.State.Pid}}' "$cid" 2>/dev/null || true)
     if [ "$hp" = "$PID" ] || docker top "$cid" -eo pid,ppid,comm,args 2>/dev/null | awk -v p="$PID" 'NR>1 && $1==p {found=1} END{exit !found}'; then
       echo "MATCH $cid $name $image init_pid=$hp"
       docker top "$cid" -eo pid,ppid,user,pcpu,pmem,comm,args | awk -v p="$PID" 'NR==1 || $1==p'
     fi
   done
   ```
   若循环结束仍无 `MATCH` 行 → 在证据包记一条「热进程未匹配任何容器」并继续步骤 5（不退出）。   # 失败有出口
5. 采资源快照。若 `${PID}` 未确定 → 跳过 `ps -p` 与 `ps -L` 两行；若 `${CID}` 未确定 → 跳过 `docker stats`。   # 分支·穷尽
   ```bash
   uptime
   top -b -n 1 | head -25
   free -h
   df -h --total | head -30
   docker stats --no-stream "$CID"
   ps -p "$PID" -o pid,ppid,user,stat,ni,pri,pcpu,pmem,vsz,rss,etime,time,comm,args
   ps -L -p "$PID" -o pid,tid,psr,stat,pcpu,pmem,time,comm,args --sort=-pcpu | head -40
   ```
6. 采 `docker inspect` 中的非敏感字段。MUST 用 `jq` 选字段，MUST NEVER 直接 dump 原始 inspect 输出（env 可能含 secret）。必采字段：healthcheck 状态与最近健康日志、labels、image、command、network、resource limits、ports。
7. 按是否可安全只读地进入容器派发：可 `docker exec` 且容器内只读探针不会改状态 → 执行下方探针；否则 → 在证据包记一条「容器内探针跳过：原因 X」并继续步骤 8。   # 分支·穷尽带兜底
   ```bash
   docker exec "$CID" sh -lc 'ps -eo pid,ppid,user,stat,pcpu,pmem,etime,time,comm,args --sort=-pcpu | head -80'
   docker exec "$CID" sh -lc 'python --version; python - <<"PY"
import importlib
for m in ["fastapi", "starlette", "uvicorn", "pydantic", "uvloop"]:
    try:
        mod = importlib.import_module(m)
        print(f"{m}={getattr(mod, "__version__", "unknown")}")
    except Exception as e:
        print(f"{m}=ERR {e}")
PY'
   ```
8. 按是否为 FastAPI/ASGI 且导入应用安全派发：是 → 列路由（下方脚本）；否 → 在证据包记一条「路由列举跳过」并继续步骤 9。   # 分支·穷尽带兜底
   ```bash
   docker exec "$CID" sh -lc 'python - <<"PY"
try:
    from server.app import app
    for r in getattr(app, "routes", []):
        print(getattr(r, "path", None), sorted(getattr(r, "methods", []) or []), getattr(r, "name", None))
except Exception:
    import traceback; traceback.print_exc()
PY'
   ```
9. 解析请求日志：按 endpoint、status、client 与最忙 endpoint-minute 聚合。重点找高频轮询 endpoint 与事件摄入突发。若拿不到请求日志 → 在证据包记一条「请求日志缺失」并继续。   # 失败有出口
10. 从容器内对疑似 health/state endpoint 做直连延迟探针，记录 elapsed time、status 与短 body 前缀。热点 endpoint 超时 = handler 慢或 event-loop 饥饿的强证据。若全部探针失败 → 在证据包记一条「延迟探针全失败」并继续。   # 失败有出口
11. 汇总产出 `INSPECTION_EVIDENCE`（含 §"输入 / 输出 / 完成标准" 列出的全部字段，env / token / secret 已脱敏），结束。   # 显式终止

## Interpreting common evidence

- A host `python -m uvicorn ...` process under `/system.slice/docker-<container-id>.scope` is still a container process; host `top` shows container PIDs. Do not describe it as a host service.
- `docker stats` CPU above 100% means the container is using more than one CPU core.
- If `docker inspect` health logs show `TimeoutError` for `/healthz`, and direct probes to other lightweight endpoints are fast, inspect the slow endpoint and shared event loop/resource contention.
- If request logs are mostly `GET /api/state` and `POST /v1/events`, prioritize source review of those handlers, their shared state, serialization, locks, subprocesses, file scans, and synchronous CPU-heavy work.
- If `ps -L` shows only one hot Python thread, suspect one Python process/event loop doing CPU-heavy synchronous work rather than many workers.

## Redaction and safety

- MUST NEVER 打印原始 env values、tokens、Coolify API tokens、build secrets 或完整 `docker inspect` env 数组。
- MUST 只输出 env keys：`docker inspect "$CID" | jq -r '.[0].Config.Env[]?' | sed 's/=.*$/=<redacted>/'`。
- MUST NEVER 使用 `--show-sensitive`，unless 用户在本轮显式请求并确认知道暴露范围。

## 失败路径

- `${context}` 缺失或未在 `context list` 中 → BLOCKER「未确认 Coolify context」并退出。
- 应用未找到（精确名 + 子串均失败）→ BLOCKER「应用未找到」并退出。
- `${APP_UUID}` 无法确定 → BLOCKER「APP_UUID 未确定」并退出。
- host PID 不属于任何容器 → 证据包记「热进程未匹配任何容器」，继续。
- 容器内探针不安全或失败 → 证据包记「容器内探针跳过」，继续。
- 请求日志缺失 / 延迟探针全失败 → 证据包记原因，继续。
- 用户在本轮要求执行 restart / stop / delete / redeploy / 改 env → 退回 lifecycle/config scenario，不在本流程内执行。
