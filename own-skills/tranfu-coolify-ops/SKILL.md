---
name: tranfu-coolify-ops
version: 0.8.0
author: aquarius-wing
origin: own
updated_at: 2026-06-30
description: >
  把 tranfu-labs 下的 -app 仓库部署到公司 Coolify 实例。资源走 Application (private-github-app) +
  build_pack=dockercompose + is_auto_deploy_enabled=false; GitHub App integration 由 ops 一次性手工装,
  skill 不接管。部署链路: GHA build → push GHCR → POST /api/v1/deploy?uuid=$APP_UUID → Coolify pull GHCR;
  compose 主 service 只写 image: ${IMAGE_REF:-ghcr.io/...:latest} + pull_policy: always, 禁 build:；GHA 写 IMAGE_REF=sha-tag 再 deploy。Step 1 入口分流: 同名 Application 不存在 → 初始化
  (mktemp clone + 四件套合规 subagent 修 + 建 project/Application + GH secrets/environment/vars + autonomous push);
  存在 → 更新分支 (A redeploy / B 改域名 / C 改 env / D 改源码或 compose / E 改 GH 配置)。
  agent 全程 autonomous 不依赖 user cwd, 收尾验 CI + 30s deploy-start + 5min 公网轮询。
  同名硬约束 REPO_NAME == PROJECT_NAME == APP_NAME; 旧 Service 残留 (0.7 历史) skill 不接管。
  触发短语: 帮忙部署 / 确认并部署 https://github.com/tranfu-labs/<x>-app、coolify 一下、
  改域名/env/compose、redeploy / 重新部署 / 重启、部署挂了、coolify 访问不了。
  不要用于: 非 tranfu-labs 仓库; 非公司 Coolify; UI 操作 (挂 GHCR credential / 装 GitHub App); 与部署无关的改动。
installed_by: tranfu-skills
installed_version: 714089689e076b099b91dbd44a8997c55e23429b
installed_at: 20260630T132409Z
installed_source: own

---

# tranfu Coolify 部署运维

把 tranfu-labs/<x>-app 端到端部署到公司 Coolify 实例。新项目 / 故障修复 / 临时改动**全部走同一份 reconcile 流程**——流程自己识别要做什么，整套幂等可重跑。

## Token 纪律（硬约束，写在最前面）

`$COOLIFY_API_TOKEN` 是高敏感凭据。**全 skill 范围**遵守：

1. **校验脚本只输出 ✓ / ✗**——长度、前缀都不打（见 [assets/preflight.sh](assets/preflight.sh)）
2. **agent 给 Bash tool 的命令字符串里永远只引用 `$COOLIFY_API_TOKEN` 变量名**——token 原文只在 shell 内展开，不进对话转录
3. **禁止 `echo $COOLIFY_API_TOKEN`** 来"看一眼对不对"——校验只能通过 preflight.sh
4. **gh secret 用 `--body "$COOLIFY_API_TOKEN"`**，不写明文
5. **curl 用 `-H "Authorization: Bearer $COOLIFY_API_TOKEN"`**，不写明文
6. **Coolify 返回的 env value 是明文**——agent 拿来做 diff，**不展示**，hash 比较代替明文显示
7. **用户给的 `.env` 文件**——读完直接打 API，不在对话里 echo 内容

这套纪律比"四件套合规"还硬——违反一次 token 就外泄。

## 心智模型（读一遍再开干）

- **GitHub repo name == Coolify project name == intended Application name**——从 GitHub URL 初始化/同名探测时三者同名是硬约束。给一个 `https://github.com/tranfu-labs/markdown-kits-app`，立刻派生 `REPO_NAME = PROJECT_NAME = APP_NAME = markdown-kits-app`，全 skill 围绕这一个锚点定位资源，**不扫描其他 project / 不让用户从列表里挑**。但若入口是 Coolify UI URL / 已知 Application UUID，Coolify 返回的 `name` 可能是派生显示名（如 `<repo>:<branch>-<uuid>`），此时不要用 `name == repo` 判失败；以 `git_repository` / `git_branch` / `build_pack` / `github_app_uuid` / `project_uuid` / `docker_compose_location` / `docker_compose_domains` 等绑定字段判定 0.8 形态。
- **Application 创建/GHA 成功后仍 unhealthy 要继续排障到可观测结论**——先读 deployment 记录和容器日志；常见根因是运行时 env 缺失（例如应用启动直接抛 missing env）。如果 `coolify app logs <uuid> --lines N` 因 `Application is not running` 拿不到运行日志，可用只读 `docker ps -a --filter name=<app_uuid>` + `docker logs --tail N <container>` 取退出容器日志；注意 Coolify CLI 的 app logs 参数是 `--lines`/`-n`，不是 `--tail`。补 env 时不展示值，补完立即 POST `/deploy?force=false` 并验证 `running:healthy` + 公网 2xx/3xx。细节见 [references/application-onboard-runtime-env-pitfalls.md](references/application-onboard-runtime-env-pitfalls.md)；数据引导类失败案例见 [references/session-2026-07-02-college-fit-app-data-bootstrap-notes.md](references/session-2026-07-02-college-fit-app-data-bootstrap-notes.md)。
- **用户在聊天里贴出的 secret 不要硬编码进脚本/JSON 字面量**——Hermes/Feishu/日志脱敏层可能把值改写成占位符，导致 Coolify env 写入假的 masked value；也会扩大泄露面。优先让用户/运维在 UI 或终端手动录入，或使用不会把明文写入生成代码/日志的安全通道；若无法保证，就输出可复制模板而不是代执行。写完只验证 key/HTTP 状态，不打印 value；若怀疑写入被脱敏，明确要求人工覆盖并轮换。案例见 [references/session-2026-07-03-offerpilot-env-redaction-pitfall.md](references/session-2026-07-03-offerpilot-env-redaction-pitfall.md)。
- **Coolify 全量只读盘点是部署 reconcile 的例外入口**——当用户明确要求遍历 project/resources/deployments、输出域名/首次成功部署日期/状态清单时，可以跨 project 做只读 inventory；不得执行 PATCH/POST deploy/env/delete/start/stop/restart。使用 `projects/{uuid}` 建 environment→project 映射、`/api/v1/resources` 取资源归属和域名、deployment 历史取最早 `finished/success`。详见 [references/coolify-read-only-inventory.md](references/coolify-read-only-inventory.md)。
- **GHA success + Coolify deployment `finished` 不等于应用可用**——deployment `finished` 只说明部署流程结束，Application 可能随后从 `restarting:unknown` 落到 `exited:unhealthy`，公网返回 `503 no available server`。收尾必须继续查 `coolify app get` 运行状态 + 公网/health route；若运行日志因 `Application is not running` 取不到，先读 deployment logs，再按 `reversible-ops` 只读规则取一次性容器日志。案例和命令见 [references/session-2026-07-02-college-fit-app-finished-but-unhealthy.md](references/session-2026-07-02-college-fit-app-finished-but-unhealthy.md)。
- **`503 no available server` 的多服务 Application 排障顺序**——先确认目标 Application `status`；若为 `exited:unhealthy` / `restarting:unknown`，不要只重启或只看 GHA success。读取最近 deployment logs，定位具体 unhealthy service（例如 `dependency failed to start: container asr-... is unhealthy`）；若 `coolify app logs` 返回 `Application is not running`，这是预期限制，不代表无日志，改查 `coolify app deployments list/logs`。多服务 compose 中 `depends_on: condition: service_healthy` 会让一个子服务 unhealthy 拖垮整组，即使其他服务 healthy。恢复后必须同时验证 `coolify app get == running:healthy` 和公网 `/`、关键 health route 返回 2xx。
- **env 重复 key 是风险信号但不自动清理**——Coolify env API 可能已有重复 `IMAGE_REF` / 业务配置 key，排障时只输出 key/count/hash/长度，不展示值；若当前恢复不依赖删除重复项，不要自动 DELETE。删除重复 env 属于有风险清理，应单独列出受影响 key、保留候选和值哈希差异后再请求确认。
- **GHA success 也可能只是 build-only success**——如果仓库 workflow 使用旧变量名/条件（如 `COOLIFY_APPLICATION_UUID`、`COOLIFY_API_URL`、webhook token），`Update Coolify IMAGE_REF` / `Deploy to Coolify` 可能被 skip 但整条 run 仍 success。用户说 workflow 成功后，仍要打开实际 workflow 或 run job summary 确认 deploy step 没被跳过；social-media-analytics-app 细节见 [references/session-2026-07-03-social-media-analytics-app-onboard-notes.md](references/session-2026-07-03-social-media-analytics-app-onboard-notes.md)。
- **资源类型: Application (private-github-app) + build_pack=dockercompose**——POST `/api/v1/applications/private-github-app` 创建, GET/PATCH/DELETE 走 `/api/v1/applications/{uuid}`。**不用 Service / Compose Empty namespace** (那是 0.7 旧形态)。详见 [references/service-vs-application.md](references/service-vs-application.md)
- **Application 身份确认要多锚点**——不要只靠 `git_repository` 或 `name` 选目标；重复 Application、`project_uuid=null`、旧 unhealthy 实例都可能存在。写 env / deploy 前用生产域名、已验证 UUID、status、deployment URL/path 等交叉确认；重复 env key 只列 key/hash，不自动删或覆盖。详见 [references/application-identity-and-env-duplicates.md](references/application-identity-and-env-duplicates.md)
- **GHA deploy template must contain executable auth headers, not log-masked placeholders**——`assets/deploy.yml.template` and generated workflows must use `-H "Authorization: Bearer $TOKEN"` inside run steps. Never commit copied log-redaction text like `Bearer ***`; it produces invalid shell/YAML and deploy calls fail silently or at curl parse time. After generating or editing workflow files, run a static check for: no `***`, `Update Coolify IMAGE_REF`, `Trigger Coolify deploy`, `Bearer $TOKEN`, no old variable names, and YAML parse success. When patching repeated YAML header lines, do not use broad fuzzy replace; patch with surrounding step context or rewrite the full file then read back the relevant section.
- **GitHub App integration 是 Coolify 实例级一次性配置**——`GET /api/v1/github-apps` 找 `organization=tranfu-labs` 的那一条, preflight 校验存在并 export `$GITHUB_APP_UUID`。skill **永不接管创建** (要上传 private key / installation id, 一次性手工配置, 所有 tranfu-labs 项目复用同一个)。不存在 → preflight 终止 + 给 UI 入口
- **Auto Deploy on Push 永远关闭**——`is_auto_deploy_enabled: false`. Coolify 收到 GitHub push 不部署, 部署只能由 GHA build 完后 POST `/api/v1/deploy` 触发。4I.4 GET 必须校验这个字段；**接管/更新已有 Application 时也必须确认 UI 的 Deployment → Auto Deploy 已关闭**，不要只看 GHA 链路或默认假设。若 API 返回 `null`/缺字段/不确定，按未确认处理，明确提醒用户到 UI 关掉或给出可恢复的 PATCH/设置命令模板，不能在报告里声称已关闭。
- **镜像链路: GHA → GHCR → IMAGE_REF → Coolify pull**——compose 里主 service 只写 `image: ${IMAGE_REF:-ghcr.io/${REPO}:latest}` + `pull_policy: always`，**不写 `build:`**。GHA build/push 成功后先 PATCH/POST Coolify app env `IMAGE_REF=ghcr.io/${REPO}:sha-<commit>`，再 POST `/api/v1/deploy`；Coolify 读取不可变 sha tag 拉镜像。`latest` 只是 fallback/滚动标签，不是生产版本真相。回滚 = 改 `IMAGE_REF` 回上一个 sha tag + redeploy，不需要改 git 或重 build。若更新旧仓库从 `IMAGE_TAG`/`latest` 迁到 `IMAGE_REF`，注意验证 workflow 先写 `IMAGE_REF` 再 deploy，并检查是否已有重复 `IMAGE_REF` env（只报告，不自动删除）。详见 [references/file-generation-rules.md](references/file-generation-rules.md)、[references/application-ghcr-node-deploy-quirks.md](references/application-ghcr-node-deploy-quirks.md) 和 [references/session-2026-07-01-agentreach-image-ref-notes.md](references/session-2026-07-01-agentreach-image-ref-notes.md)
- **生成 workflow 时避免 Bearer header 被脱敏破坏**——在 Hermes/ops 会话里写 `.github/workflows/deploy.yml` 时，形如 `Authorization: Bearer $TOKEN` 的文本可能被安全脱敏层改写成 `***`，导致文件或 patch 变成无效 shell/YAML。模板和手写修复优先用 `curl --oauth2-bearer "$TOKEN"` 携带 Coolify token，或在最终文件中显式静态校验“不含 `***` 且含 `--oauth2-bearer "$TOKEN"`”。详见 [references/hermes-bearer-header-redaction.md](references/hermes-bearer-header-redaction.md)
- **一个 Application + dockercompose = 一份 compose + 内嵌 sub-applications 数组**——compose 里有 N 个 service, sub-applications 数组就有 N 条, 每条有独立 uuid + fqdn
- **改域名走 `docker_compose_domains` 字段**（不是 `domains`、不是 `urls`、不是 compose 里 `SERVICE_FQDN_*`）——详见 [references/urls-vs-docker-compose-domains.md](references/urls-vs-docker-compose-domains.md)
- **`SERVICE_FQDN_*` 是 Coolify → 容器的 output**, 不是 user → Coolify 的 input——compose 里写 `''` 即可, 写真值无效。详见 [references/service-fqdn-trap.md](references/service-fqdn-trap.md)
- **改 compose 走 git push, 不走 PATCH `docker_compose_raw`**——0.7 Service 形态 compose 存在 Coolify 里 (base64), 改了要 PATCH; 0.8 Application 形态 compose 存在 git repo 里, **改完 push 即可**, Coolify 下次 deploy 自动读最新 commit
- **部署链路**: GHA push GHCR → curl `$BASE/api/v1/deploy?uuid=$APP_UUID` → Coolify pull 重启。详见 [commands/deploy-trigger.md](commands/deploy-trigger.md)
- **同名 Service 残留 (0.7 历史) skill 不接管**——Step 1 探测到同名 Service 而无 Application 时, 终止并告知用户手动 DELETE 旧 service 后重跑；legacy Service 可能 `project_uuid=null`，不能只按 `name + project_uuid` 查，需额外 name-only/null-project fallback（见 [references/session-2026-07-02-offerpilot-legacy-service-null-project.md](references/session-2026-07-02-offerpilot-legacy-service-null-project.md)）
- **Application identity 不只看 `git_repository`**——Coolify 里可能存在同 repo/同名的重复 Application，或 API 返回 `project_uuid=null` 导致 Step 1 的 `name + project_uuid` filter 漏掉真实线上实例；写 env / deploy 前必须用 domain、已验证 UUID、status、deployment URL 等多锚点确认目标。详见 [references/application-identity-and-env-duplicates.md](references/application-identity-and-env-duplicates.md)

## 唯一流程入口

[`scenarios/reconcile-deployment.md`](scenarios/reconcile-deployment.md)。所有触发都走它。

**GitHub URL 是标准入口**。如果用户只给 Coolify UI URL（`/project/<project_uuid>/environment/<env_uuid>/application/<app_uuid>`），先按 [references/coolify-url-entrypoint-and-legacy-application.md](references/coolify-url-entrypoint-and-legacy-application.md) 做只读归一化和形态判定：从 Application 反推 `git_repository`，重新套 `tranfu-labs/<x>-app` 硬范围，并确认它是否已经是 0.8 Application 形态。**注意：Coolify Application 的 `name` 可为实例显示名/派生名（例如 `<repo>:<branch>-<uuid>`），不要求等于 GitHub repo 名；不能仅因 name 不同判定为旧/非 0.8。** 若关键字段显示为旧/非 0.8 形态（例如 `github_app_uuid=null`、`is_auto_deploy_enabled=null`、`project_uuid=null`、`docker_compose_location=/compose.yml`），只报告差异并建议并行新建 0.8 Application；不要原地 PATCH 接管。

**Step 0 + Step 1 必跑**, 由 Step 1 入口分流到「初始化部署分支」(固定流程) 或「更新部署分支」(按意图条件触发), 最后两条分支汇合到共用收尾。

### 初始化分支 (Application 不存在, 固定流程)

| # | Step | 主要参考 |
|---|---|---|
| 0 | preflight (工具 / 凭据 / Coolify 活性 / **GitHub App integration 校验** / 命名 / GHCR ack) | [assets/preflight.sh](assets/preflight.sh) |
| 1 | 同名 project + Application 探测 (入口分流) | [commands/application-crud.md](commands/application-crud.md) |
| 2I | `mktemp -d` 临时目录 + git clone (永远不污染 user cwd) | — |
| 3I | compose 合规 check → 不合规 **spawn subagent** 按规则修源码 (主 service 必须 `image: ${IMAGE_REF:-ghcr.io/...:latest}` + `pull_policy: always`, 无 `build:`；deploy.yml 必须写 `IMAGE_REF` 后再 POST deploy) | [references/file-generation-rules.md](references/file-generation-rules.md) |
| 4I | 创建 project + Application (POST `/applications/private-github-app` 带 `github_app_uuid` + `build_pack=dockercompose` + `is_auto_deploy_enabled=false` + `docker_compose_domains`), 拿 `$APP_UUID` **并明确告知用户** | [commands/application-crud.md](commands/application-crud.md) + [references/coolify-api-fields.md](references/coolify-api-fields.md) |
| 5I | GH secrets + **自动建 environment** (`gh api PUT`) + env vars (`COOLIFY_APP_UUID = $APP_UUID`) | [commands/deploy-trigger.md](commands/deploy-trigger.md) §"GitHub 端配置" |
| 6I | application env (POST `/applications/$APP_UUID/envs`) | [commands/application-env.md](commands/application-env.md) |
| 7I | agent autonomous `git add + commit + git push`, 推完告知 commit sha + diff stat + GitHub link (不等 ack) | — |

### 更新分支 (Application 已存在, agent autonomous, 不依赖 user cwd, 按意图条件触发)

**乐观假设**: Application 已部署好。**不主动核对源码 / 不主动改文件 / 不主动 push**, 只按用户意图执行最小 act。

| act | 用户意图关键词 | 做什么 | 主要参考 |
|---|---|---|---|
| **A** | redeploy / 重新部署 / 重启 | POST `/api/v1/deploy?uuid=$APP_UUID` | [commands/deploy-trigger.md](commands/deploy-trigger.md) |
| **B** | 改 / 加 / 删域名 | PATCH `docker_compose_domains` | [commands/domain.md](commands/domain.md) |
| **C** | 改 / 加 / 删 env | POST/PATCH `/applications/$APP_UUID/envs` + 隐式 A | [commands/application-env.md](commands/application-env.md) |
| **D** | 改 compose / Dockerfile / 改源码 | `mktemp -d` clone + subagent 改 + push (**不 PATCH `docker_compose_raw`**, compose 走 git binding) | [references/file-generation-rules.md](references/file-generation-rules.md) + [commands/application-crud.md](commands/application-crud.md) |
| **E** | 改 GH secrets/vars | `gh secret set` / `gh variable set` | [commands/deploy-trigger.md](commands/deploy-trigger.md) §"GitHub 端配置" |

意图模糊 → **询问用户**, 不要乱猜或默认 redeploy。

### 共用收尾 (按条件 skip / act)

| # | Step | 必跑 | 跳过 |
|---|---|---|---|
| 8 | 等 GHA + 验 CI 无错 + 无 "缺变量" 类 silent fail | 初始化 / 更新 D 路径 | 更新分支 A/B/C/E 单跑 |
| 9 | 30s 验 Coolify 启动部署, 未启动 → POST `/deploy` fallback | 初始化 / 更新 A/C/D | 更新分支单跑 B (域名 traefik 即时生效) / E |
| 10 | 5min 轮询公网域名 2xx/3xx, 超时报排障入口 | **总跑** | — |

**关键变化（vs 0.7.x）**：

- **资源形态从 Service / Compose Empty 切到 Application + private-github-app + dockercompose**——namespace 从 `/services` 换到 `/applications`, compose 从 base64 塞 `docker_compose_raw` 改成 git binding (从 repo 读 `compose.yml`)
- **Auto Deploy 显式关闭** (`is_auto_deploy_enabled: false`)——Coolify 收到 GitHub push 不触发自动部署, 部署链路由 GHA 完全掌控
- **改 compose 不再 PATCH 任何字段**——更新分支 D 路径 push 即可, Coolify 下次 deploy 读最新 commit (0.7 形态需要 PATCH `docker_compose_raw`)
- **GitHub App integration 是 preflight 硬约束**——`GET /api/v1/github-apps` 找 organization=tranfu-labs, 不存在终止; skill 不接管创建
- **Application/GHCR/Node 部署坑先看参考**——遇到 `docker_compose_location` 422、`github_app_uuid`/`is_auto_deploy_enabled` echo 为 null、GitHub empty var 422、pnpm native module binding 缺失、GHCR private pull unauthorized，先查 [references/application-ghcr-node-deploy-quirks.md](references/application-ghcr-node-deploy-quirks.md)。`docker_compose_location` 创建 payload 在 Coolify 4.1.2 上应优先用 `/compose.yml`；pnpm native dependency policy 用 `onlyBuiltDependencies` 而不是旧 `allowBuilds`，案例见 [references/session-2026-07-03-social-media-analytics-app-onboard-notes.md](references/session-2026-07-03-social-media-analytics-app-onboard-notes.md)
- **多服务 Application / Exited+restart 诊断先看参考**——多服务 compose（api+web+worker）要明确 `docker_compose_domains` 绑定哪个 service；GHA 写 `IMAGE_REF` 的 env payload 只传 `{key,value,is_literal}`；deployment `finished` 后仍 `exited:unhealthy` 时区分部署记录、当前 restart counters、域名绑定 service、容器是否仍可 logs。详见 [references/session-2026-07-01-alphaos-app-0-8-notes.md](references/session-2026-07-01-alphaos-app-0-8-notes.md)
- **tranfu-agents telemetry DB / `/skills` 页面少量数据诊断**——`tf.db` 文件大不等于 `/skills` usage 表应有很多行；先看 `/api/skills?days=30` 的聚合窗口与 `funnel` 字段，再用 `docker inspect <container> .Mounts` 确认当前容器实际挂载的 `/data` volume，避免误看旧的相似 `*-tf-data` volume。详见 [references/tranfu-agents-volume-and-skills-dashboard-notes.md](references/tranfu-agents-volume-and-skills-dashboard-notes.md)
- **dev/staging 分支环境必须用 GitHub Environment vars，不要硬编码 UUID**——为 dev/staging 新建独立 Coolify Application，identity 用 `git_repository + git_branch + expected domain`，GitHub Environment 与分支同名并设置 `COOLIFY_APP_UUID` / `IMAGE_TAG_ROLLING` / `IMAGE_TAG_SHA_PREFIX`；workflow 保留 `jobs.<job>.environment: ${{ github.ref_name }}` 并读取 `${{ vars.COOLIFY_APP_UUID }}`。若旧 workflow 硬编码 UUID 或只用 mutable `:dev` tag，改为先写 Coolify app env `IMAGE_REF=...:dev-<sha>` 再 deploy。详见 [references/session-2026-07-05-tranfu-agents-dev-branch-notes.md](references/session-2026-07-05-tranfu-agents-dev-branch-notes.md)
- **college-fit-app 数据初始化模式**——若容器健康但没有下载/导入全国数据，先查 Coolify env 是否残留 `APP_MODE=static`；当前自动后台初始化应使用 `APP_MODE=auto`、`DB_PATH=/data/collegefit.sqlite`、`DB_READONLY=1`、`DB_BOOTSTRAP_MODE=preseed`、`PORT=3000`，不要用 `APP_MODE=full` 作为首次 bootstrap。详见 [references/session-2026-07-02-college-fit-app-auto-bootstrap-notes.md](references/session-2026-07-02-college-fit-app-auto-bootstrap-notes.md)
- **OfferPilot 多服务 ASR unhealthy 诊断**——若部署日志显示 `asr` 容器 `Started → Waiting → Error` 且 `agent` healthy，先不要假设是 Qwen key/网络；读 compose 健康检查和 ASR imports/requirements。`/health` 不连外部 ASR 时，常见是启动/import 依赖缺失，例如 `websocket` import 需要 `websocket-client`（不是 `websockets`）。详见 [references/session-2026-07-05-offerpilot-asr-websocket-client.md](references/session-2026-07-05-offerpilot-asr-websocket-client.md)
- **同名 project 已存在但无 Application / Service = 空壳 project**——初始化分支继续走，但 Step 4I 复用已发现的 `PROJECT_UUID`，不要新建第二个 project、不要列 project 让用户挑。offerpilot-app 的一次会话细节见 [references/session-2026-07-02-offerpilot-app-empty-project-onboard-notes.md](references/session-2026-07-02-offerpilot-app-empty-project-onboard-notes.md)
- **Step 10 公网 URL 推导优先读 `docker_compose_domains`**——当前 Coolify GET 可能返回顶层 `fqdn` 为自动 `*.sslip.io` 且 `.applications=null`；dockercompose 真实产品域名常在 `docker_compose_domains`，并可能是 JSON 字符串。该字段可能是数组，也可能是对象字符串（例如 `{"web":{"domain":"https://offerpilot-app.tranfu.com:8080"}}`）；轮询前先兼容解析两种形态、strip 容器端口，再 fallback 到 fqdn。另见 [references/session-2026-07-01-alphaos-app-url-verification-notes.md](references/session-2026-07-01-alphaos-app-url-verification-notes.md) 和 [references/session-2026-07-02-offerpilot-app-onboard-notes.md](references/session-2026-07-02-offerpilot-app-onboard-notes.md)
- **域名字段从 `urls: [{name, url}]` 换成 `docker_compose_domains: [{name, domain}]`**——key 也从 `url` 变成 `domain`


**继承 0.7 的设计** (不变):

- agent 主动 git clone + 主动 git push, 永远不依赖 user cwd
- Step 3I / 更新 D 路径不合规调 subagent 修源码
- 入口先判"初始化 vs 更新", 不再无脑跑全 9 步
- 更新分支按意图条件触发, 项目已存在 = 乐观假设已部署好
- Step 5I 自动建 environment (`gh api PUT`), 不让用户去 settings 手工建
- COOLIFY_BASE_URL 三层 strip 尾斜杠 (preflight / gh secret set / deploy.yml.template 防 `//api` 404)
- Step 9/10 有窗口与超时 (30s deploy-start + 5min 域名轮询), 不再单次 curl
- Step 4I 创建 Application 后必须明确把 `$APP_UUID` 告知用户 — 这是 GH workflow 配置的关键值

**全程 autonomous, 中途零停顿**: user 给出初始指令 = 全链路隐式 ack, agent 一路跑到 Step 10 收尾, **不在中途等用户回应**。act 前 GET 用于事后告知 diff, 不是用于等 ack。**例外**: (1) Step 1 后用户意图模糊 → 询问意图; 询问完毕后继续 autonomous。(2) 用户任何时候明确说“停止部署 / stop / cancel / 暂停 / 别继续” → 立即硬取消：不再创建/修改 Coolify 资源、不写 GH secrets/vars、不 commit/push、不触发 deploy、不继续轮询；报告已经发生和明确未发生的边界。若此前已派后台 subagent 在 mktemp clone 中改文件，不再使用其结果推进部署，只说明其改动限于临时目录。

**安全叠加层（ops profile / reversible-ops）**: 若当前会话的 `AGENTS.md` 或已加载的 `reversible-ops` 要求 review-only / 不替执行写操作，则本 skill 的 “autonomous push / PATCH / POST deploy” 不覆盖该安全门。此时仍按本 skill 完成只读归一化、mktemp clone、源码/compose/workflow 修改和本地校验；到 `git commit && git push`、Coolify app env PATCH、POST deploy 等写操作时，输出可恢复的用户执行命令（含 `git revert HEAD && git push` 或 `IMAGE_REF` 回滚模板），等待用户执行；用户回报 commit/run/deployment 后再继续 Step 8/9/10 观察。不要声称已部署，也不要停在计划不产出可执行命令。

## 不做什么

- ✗ 非 tranfu-labs 仓库 / 非公司 Coolify 实例（硬编码假设，扩展前不要套用）
- ✗ 替用户安装 gh / jq / curl
- ✗ **建任意名字的 Coolify project**——只在"同名 project 不存在"时自动建 `$REPO_NAME` 那一个；不让用户挑、不接受其他名字
- ✗ **接管创建 Coolify GitHub App integration**——这是 ops 角色一次性手工配置 (要上传 GitHub App private key + installation id), preflight 不存在则终止 + 给 UI 入口
- ✗ 挂 GHCR registry credential——这是 UI 一次性配置，agent 不替做（per-Coolify 实例只配一次）
- ✗ **要求 user "先 cd 到 repo"**——任何需要源码的 act 都 agent 自己 `mktemp -d` clone
- ✗ 在用户 cwd 直接 clone——必须 `mktemp -d` 临时目录，用完即弃
- ✗ agent 自己改源码——必须 spawn subagent 按 file-generation-rules.md 修, agent 只组装 prompt + 转发结果
- ✗ 更新分支主动核对源码 / 主动 push——Application 已存在 = 乐观假设已部署好, 只做用户指派的事
- ✗ 更新分支意图模糊就乱猜或默认 redeploy——询问用户
- ✗ push 前 (或任何 act 前) 停下等 user ack——autonomous 意味着推完告知, 不是推前问。user 给完初始指令就离线了, 中途问只会卡死流程
- ✗ Coolify UI 上的点击（agent 全走 API）
- ✗ DELETE Application / 清空 volume / 删 project（破坏性操作，专门 reference 处理）
- ✗ **碰旧 Service namespace**——同名 Service 残留触发 Step 1 不接管路径; 0.8 主流程不读不写 `/api/v1/services/*`
- ✗ **PATCH `is_auto_deploy_enabled: true`**——0.8 永远 false, 任何 PATCH 不带这个字段
- ✗ **PATCH `docker_compose_raw`**——那是旧 Service 形态字段, 0.8 compose 走 git, 不需要 PATCH
- ✗ **POST/PATCH `urls` 字段**——那是旧 Service 形态, Application endpoint 不接受会 422
- ✗ 多 Coolify 实例 / 多 server 调度（公司目前单实例单 server，硬编码进 [commands/prerequisites.md](commands/prerequisites.md)）
- ✗ **扫描 / 列举 / 操作除当前 repo 对应的那一个 project / Application 之外的任何资源**——全程围绕单一锚点
- ✗ Step 10 无限轮询——5min 硬上限，到点就给排障入口
- ✗ `COOLIFY_BASE_URL` 末尾带 `/`——会拼出 `//api/v1/deploy` → Coolify 404; preflight / gh secret set / deploy.yml.template 三层都 strip

## 文件树

```
own-skills/tranfu-coolify-ops/
├── SKILL.md                              ← 本文件
├── assets/
│   ├── preflight.sh                      ← Step 0 一次性全部前置 (含 GitHub App integration 校验)
│   └── deploy.yml.template               ← GHA workflow 模板 (0.7 → 0.8 一字不改)
├── scenarios/
│   └── reconcile-deployment.md           ← 唯一流程文档, Step 0/1 入口分流 + 初始化/更新双分支 + 共用收尾
├── commands/                             ← 实际操作速查（curl 命令片段 + CLI ad-hoc）
│   ├── prerequisites.md                  ← Step 0 索引 (preflight.sh 的人话说明)
│   ├── application-crud.md               ← Step 4I / 更新 D (HTTP API, Application namespace)
│   ├── application-env.md                ← Step 6I / 更新 C (HTTP API, /applications/{uuid}/envs)
│   ├── domain.md                         ← 更新 B (HTTP API, docker_compose_domains)
│   ├── deploy-trigger.md                 ← Step 7-9 (HTTP API + GHA)
│   ├── tranfu-naming.md                  ← Step 0 命名约束
│   ├── app.md                            ← CLI ad-hoc 速查 (排障 / 临时操作)
│   ├── context.md                        ← CLI ad-hoc 速查
│   ├── conventions.md                    ← CLI ad-hoc 全局 flag 约定
│   ├── project.md                        ← CLI ad-hoc 速查
│   └── server.md                         ← CLI ad-hoc 速查
└── references/                           ← 心智模型 / 字段语义 / 排障
    ├── service-vs-application.md         ← Service 不是 Application (0.8 走 Application)
    ├── service-fqdn-trap.md              ← SERVICE_FQDN_* 是 output 不是 input
    ├── urls-vs-docker-compose-domains.md ← 改域名走 docker_compose_domains (Application 形态)
    ├── coolify-api-fields.md             ← openapi 字段速查 (主 namespace /applications, 旧 /services 归档段)
    ├── coolify-api-fields.md             ← openapi 字段速查 (主 namespace /applications, 旧 /services 归档段)
    ├── file-generation-rules.md          ← 四件套生成 / 校验规范 (主 service 必须 image: 无 build:)
    ├── application-ghcr-node-deploy-quirks.md ← 本轮沉淀: Application API / GHCR private / pnpm native module 坑
    ├── archived-coolify-deploy.md        ← 旧 coolify-deploy skill 归档说明
    ├── archived-coolify-deploy.md        ← 旧 coolify-deploy skill 归档说明
    ├── coolify-compose-deploy-failure-triage.md  ← Step 8 排障 (DEPRECATED-CLI)
    ├── coolify-docker-inspection.md      ← Step 9 容器证据采集 (DEPRECATED-CLI)
    ├── coolify-clear-deployments-and-redeploy.md ← 清部署历史 + 重 deploy (DEPRECATED-CLI)
    ├── coolify-disk-capacity-and-prune.md← 服务器磁盘运维 (DEPRECATED-CLI)
    ├── coolify-cli-1.6.2-onboard-quirks.md ← CLI 1.6.2 onboard 怪癖 (ad-hoc)
    └── coolify-env-redeploy.md           ← CLI 改 env + redeploy (ad-hoc)
```

## 完成判据（可观测）

跑完后：

- [ ] 所走分支 (初始化 / 更新) 内的 Step 全 ✓ + 共用收尾 Step 8/9/10 全 ✓
- [ ] 5min 内 `curl -I <public-fqdn>` 返 2xx / 3xx
- [ ] Coolify Application status = running
- [ ] Coolify Application GET 返回 `is_auto_deploy_enabled == false` + `build_pack == "dockercompose"` + `github_app_uuid == $GITHUB_APP_UUID`
- [ ] GHA 最近一次 deploy.yml run = success + log 无 "missing variable" 类报错
- [ ] 仓库根四件套（Dockerfile / .dockerignore / compose.yml / deploy.yml）全在且合规 (compose 主 service `image: ${IMAGE_REF:-ghcr.io/...:latest}` + `pull_policy: always`、无 `build:`；deploy.yml 在 POST deploy 前写入 Coolify app env `IMAGE_REF=...:sha-<commit>`)

任一未达 → 流程中止在对应 Step，按该 Step 的失败文案给用户。

<example>
用户："服务器运维机器人，请帮忙确认并部署项目：https://github.com/tranfu-labs/markdown-kits-app"

正确做法 (初始化部署分支)：
1. create 11 项 TODO (Step 0/1 + Step 2I-7I + Step 8/9/10)
2. Step 0: preflight.sh "https://github.com/tranfu-labs/markdown-kits-app" → 全部 ✓ (含 GitHub App integration 校验, export $GITHUB_APP_UUID)
3. Step 1: GET /api/v1/projects 找 name=`markdown-kits-app` → 没找到 → 走初始化部署分支
4. Step 2I: mktemp -d 临时目录 → git clone → cd
5. Step 3I: bash 跑 compose check → compose.yml 不存在 + Dockerfile 不存在 → spawn subagent 按 file-generation-rules.md 生成四件套 (compose 主 service `image: ${IMAGE_REF:-ghcr.io/tranfu-labs/markdown-kits-app:latest}` + `pull_policy: always`，无 `build:`；deploy.yml 在 POST deploy 前写 `IMAGE_REF=ghcr.io/tranfu-labs/markdown-kits-app:sha-<commit>`) → subagent 回报 "新建: Dockerfile, .dockerignore, compose.yml, .github/workflows/deploy.yml" → 明确告知用户"已按 coolify-deploy 修改源码"
6. Step 4I.1: POST /api/v1/projects (name=markdown-kits-app) → $PROJECT_UUID
7. Step 4I.3: POST /api/v1/applications/private-github-app 带 github_app_uuid + git_repository=tranfu-labs/markdown-kits-app + git_branch=main + build_pack=dockercompose + is_auto_deploy_enabled=false + docker_compose_domains + ports_exposes + instant_deploy=false → $APP_UUID
8. Step 4I.4: GET /api/v1/applications/$APP_UUID 校验 build_pack=dockercompose / is_auto_deploy_enabled=false → ✓ 明确告知 "Application: markdown-kits-app ($APP_UUID), auto_deploy=false, Coolify URL: ..."
9. Step 5I: gh secret set COOLIFY_API_TOKEN / COOLIFY_BASE_URL; gh api PUT environments/main; gh variable set --env main 三条 (COOLIFY_APP_UUID=$APP_UUID 等)
10. Step 6I: 用户给 .env → POST /applications/$APP_UUID/envs 逐条加 (值不打印)
11. Step 7I: git add . / git commit / git push -u origin main → 告知 user "commit <sha>, 改了 N 个文件, GitHub link"
12. Step 8: gh run watch → success, log 无 missing/undefined
13. Step 9: 轮询 30s 看到 status=deploying → ✓ (GHA 末尾 POST /deploy 主动触发, Coolify 收到)
14. Step 10: 轮询 curl -I 公网 → 1min 后返 200 → ✓ 收尾报告
</example>

<example>
用户："markdown-kits-app 改下域名到 board.tranfu.com"

正确做法 (更新分支, B 路径)：
1. Step 0: preflight ✓ (无需 user cwd)
2. Step 1: GET /api/v1/projects 找 name=markdown-kits-app 存在; GET /api/v1/applications 同 name + project_uuid filter → 同名 Application 存在 → 走更新分支
3. Step 2U: 意图 = 改域名 → 选 act B
   - GET /api/v1/applications/$APP_UUID 拿当前 docker_compose_domains (记录 diff)
   - PATCH /api/v1/applications/$APP_UUID 改 docker_compose_domains → GET 校验
   - 告知 user "已改: https://markdown-kits-app.tranfu.com:8787 → https://board.tranfu.com:8787"
4. Step 8: 无 push, skip
5. Step 9: 改域名是 traefik 即时生效, 不需要重启容器, skip
6. Step 10: curl -I https://board.tranfu.com → 200 → ✓ 收尾
</example>

<example>
用户："markdown-kits-app 重新部署一下"

正确做法 (更新分支, A 路径)：
1. Step 0/1 → 走更新分支
2. Step 2U: 意图 = redeploy → 选 act A
   - POST /api/v1/deploy?uuid=$APP_UUID&force=false → 拿 deployment id
   - 告知 user "已触发 redeploy, deployment id = ..."
3. Step 8: 无 push, skip
4. Step 9: 5s 后看到 status=deploying → ✓ (不需要 fallback POST, 因为 A 就是手工 POST)
5. Step 10: 轮询公网 → 1min 后 200 → ✓
</example>

<example>
用户："markdown-kits-app 加个 env DATABASE_URL=postgres://..."

正确做法 (更新分支, C 路径 = 改 env + 隐式 A redeploy)：
1. Step 0/1 → 走更新分支
2. Step 2U: 意图 = 改 env → 选 act C
   - GET /applications/$APP_UUID/envs 拿当前列表 (不打印 value, 只 key, 记录 diff)
   - POST /applications/$APP_UUID/envs → GET 校验 key 在
   - 隐式 A: POST /api/v1/deploy (env 改了必须 redeploy)
   - 告知 user "已新增 key=DATABASE_URL (value 隐藏), 已触发 redeploy"
3. Step 8 skip; Step 9 ✓ (看到 deploying); Step 10 ✓
</example>

<example>
用户："markdown-kits-app 部署挂了，帮我看下"

正确做法 (意图模糊 → 询问用户, 不要乱猜)：
1. Step 0/1 → 走更新分支
2. Step 2U: 意图模糊 — "挂了" 可能是任何原因
   - 不要默认 redeploy, 也不要主动核对源码
   - 询问用户: "你要 (a) 看最近一次 GHA / Coolify status 诊断 (b) 直接 redeploy 一下试试 (c) 改某个具体配置 (env / 域名 / compose)?"
3. 若用户选 (a): 跑诊断 (GET application.status / gh run view --log-failed / Coolify application logs), 给报告, 终止
4. 若用户选 (b): 走 A 路径
5. 若用户选 (c): 按具体走 B/C/D
</example>

<example>
用户："markdown-kits-app 的 compose 加个 redis service"

正确做法 (更新分支, D 路径)：
1. Step 0/1 → 走更新分支
2. Step 2U: 意图 = 改 compose → 选 act D
   - mktemp 临时目录 + git clone markdown-kits-app
   - spawn subagent 按 file-generation-rules.md 加 redis service (含 SERVICE_PASSWORD_REDIS 魔法变量, 不写 ports; redis 用官方镜像直接 `image: redis:7-alpine`, 主应用 service 仍是 `image: ${IMAGE_REF:-ghcr.io/...:latest}` + `pull_policy: always` 无 build)
   - subagent 返回改了 compose.yml, agent 明确告知改了什么
   - autonomous git add + commit + push, 推完告知 user "commit <sha>, 改了 compose.yml, GitHub link"
   - **不调任何 PATCH** — compose 走 git binding, Coolify 触发 deploy 时自己读最新 commit 的 compose
3. Step 8: 等 GHA build → success (其实 ghcr.io 上主应用 image 不变, redis 用官方镜像不需要构建, 但 deploy.yml 仍跑完整链路)
4. Step 9: GHA 末尾 POST /deploy → Coolify 30s 内看到 deploying → ✓
5. Step 10: 轮询公网 → 200 → ✓
</example>

<example>
用户："markdown-kits-app 上 coolify" — 但 Coolify 上同名 project 下已有旧 Service 资源 (0.7 历史)

正确做法 (Step 1 检测到旧 Service 残留 → 不接管路径)：
1. Step 0: preflight ✓
2. Step 1: GET /api/v1/projects 找到 markdown-kits-app project; GET /api/v1/applications 同 name + project_uuid filter → 同名 Application 不存在; 顺手 GET /api/v1/services 检查 → 找到同名 Service 残留 ($LEGACY_SVC)
3. 终止 + 告知:
   "✗ Project 'markdown-kits-app' 下已存在旧 Service 形态资源 ($LEGACY_SVC), 但没有 Application 形态资源.
    skill 0.8 仅管 Application 形态, 不接管旧 Service. 如要切换:
      1. 备份 envs: curl ... /api/v1/services/$LEGACY_SVC/envs > /tmp/envs-backup.json
      2. 走 reversible-ops 黑名单确认流 DELETE 旧 service (delete_volumes=false 保留数据)
      3. 重跑本 skill, 走初始化分支建 Application"
4. 不主动 DELETE, 不主动迁移; 等用户人工处理后重跑
</example>

<bad-example>
错误：
(a) 用户给 GitHub URL, agent 没跑 Step 1 入口分流就开始 git clone — 已有 Application 时 clone 是浪费, 应该走更新分支
(b) Step 2I / 更新 D 路径在用户 cwd 直接 `git clone` — 污染工作区, 必须 `mktemp -d` 临时目录
(c) 要求 user "先 cd 到 markdown-kits-app repo 再来" — agent autonomous, 永远不依赖 user cwd
(d) Step 3I / 更新 D 路径 agent 自己 Write 四件套文件 — 必须 spawn subagent, agent 不直接改源码
(e) subagent 改完没明确告知用户改了哪些文件 — 必须输出清单 "新建/修改 + 主要改了什么"
(f) Step 4I 创建 Application 后只把 $APP_UUID 存到变量, 没告诉用户 — 必须明确报 "Application: $REPO_NAME ($APP_UUID), auto_deploy=false, Coolify URL: ..."
(g) `git push` 前停下问"确认推送?" — autonomous 意味着推完告知 commit sha + diff stat + GitHub link, 不是推前等 ack
(h) `gh secret set COOLIFY_API_TOKEN --body "<原文>"` — 必须保持 `$VAR`, 让 shell 展开
(i) Step 9 30s 内没看到部署启动, agent 重新 `git push` 想再触发一次 — fallback 是 `POST /api/v1/deploy`, 不是再 push
(j) Step 10 改成无限轮询 — 5min 硬上限, 到点就报排障入口
(k) Coolify Application 已存在但 compose 不对, agent 直接 DELETE 重建 — 应该走更新分支 D 路径 push 即可 (不需要任何 PATCH)
(l) 用户的 .env 内容 echo 到对话里 — 永不
(m) Step 1 同名 Application 没找到, agent 把所有 application 列出来让用户挑 — 同名约束消除歧义, 没找到走初始化分支自动建
(n) Step 1 找 Application 只按 name filter 不带 project_uuid — 跨 project 同名会误命中
(o) 更新分支 agent 主动跑四件套合规核对, 发现 compose 不"完美" 就 spawn subagent 改, push 一堆用户没要求的改动 — Application 已存在 = 乐观假设已部署好, **只做用户指派的事**
(p) 更新分支用户说"看下 markdown-kits-app", agent 默认跑 redeploy — 意图模糊必须询问, 不要乱猜
(q) Step 5I 报 "environment '$DEFAULT_BRANCH' 不存在, 请去 settings 手工建" — 用 `gh api -X PUT repos/.../environments/<name>` 自动建, REST API 支持
(r) `gh secret set COOLIFY_BASE_URL --body "http://120.77.223.183:8000/"` — 末尾斜杠会拼出 `//api` Coolify 404, 必须 `${BASE%/}` strip
(s) Step 6I / 更新 C 路径往 application envs POST 一份 `SERVICE_PASSWORD_*` / `SERVICE_HEX_*` / `SERVICE_FQDN_*` — 这些是 compose 里声明的魔法变量, Coolify 自己注入 + 自己塞 envs 表; reconcile 必须按 [commands/application-env.md](commands/application-env.md) 的 grep filter 跳过
(t) **Step 4I 创建 Application 时漏 `is_auto_deploy_enabled: false`** — Coolify 默认订阅 GitHub push webhook 自己 build, 跟 GHA 链路撞 (镜像版本可能不一致); 4I.4 GET 必须校验这个字段 = false
(u) **Step 4I 漏 `build_pack: "dockercompose"`** — 默认 build_pack 是 nixpacks, 会让 Coolify 走完全错的部署模式
(v) **更新 D 路径改完 compose 还 PATCH `docker_compose_raw`** — 那是旧 0.7 Service 形态; 0.8 Application 形态 compose 走 git binding, 改完 push 即可
(w) **更新 B 路径用 `urls` 字段改域名** — 那是旧 Service 形态; Application endpoint 不接受会 422, 用 `docker_compose_domains`
(x) **Step 1 检测到同名 Service 残留, agent 旁路创建 Application** — 应该终止并告知用户手动 DELETE 旧 service; 旁路创建会撞 409 或留下数据混乱
(y) **preflight GitHub App integration 不存在, agent 自己跑 `coolify github create` 试图装一个** — GitHub App 需要 private key + installation id 等敏感数据, 必须 ops 角色一次性手工配置; skill 终止并给 UI 入口
</bad-example>
