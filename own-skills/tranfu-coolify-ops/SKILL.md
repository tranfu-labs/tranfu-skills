---
name: tranfu-coolify-ops
version: 0.3.0
author: aquarius-wing
origin: own
updated_at: 2026-06-24
description: >
  用 coolify CLI 在 tranfu 团队的 Coolify 实例上完成运维操作。当前覆盖：onboard tranfu-labs
  组织下烤肉串命名且以 -app 结尾的 GitHub 仓库（GitHub App 路径，首次部署）、已 onboard 同类
  app 的强制重新部署与 deployment 校验。
  触发短语：把 tranfu-labs/<x>-app 部署到 coolify、上 coolify 新应用、用 GitHub App 部署新 app、
  给这个 tranfu 仓库做 coolify onboard、把这个新仓库挂到 coolify 上线；
  口语：「这个仓库怎么挂到 coolify」「帮我把这个 app 跑到 coolify 上」；
  redeploy 触发：「再部署一遍」「重新部署」「redeploy」+ GitHub URL 或 app/repo 名。
  不要用于：非 tranfu-labs 仓库或命名不符的仓库；public 仓库 / deploy-key / Dockerfile /
  docker image 部署路径；写 compose.yml 或 Dockerfile 本身（走 coolify-deploy）；
  Coolify 网页 UI 操作；数据库 / 服务 / mesh / 防火墙 / env 同步等尚未实现的占位场景。
---

# tranfu Coolify 运维

使用这个技能：当 tranfu 团队需要在 Coolify 实例上做运维操作时，按「共用前置 + 场景脚本」的方式
组织执行流程。所有场景都共享同一套硬约束（命名、唯一 server、唯一 GitHub App、project 名 == 仓库名），
在场景脚本里只写跟该场景相关的判断与命令。

任务的本质不是"调一条 CLI 命令"，而是"在 tranfu 团队的约定下，把若干 CLI 命令串成可重复、
可被中途终止的工作流"。每一步先断言再动作，断言失败就停下来报清楚原因，避免在错误归属、
错误命名或错误归宿下创建资源（创建容易、回滚要 `coolify app delete` + 去 Coolify 网页 UI 删 project ——
coolify CLI 目前不暴露 `project delete`——代价不小）。

## Ownership

**execute CLI commands** —— 本 skill 会在用户授权的 context 下，对 Coolify 实例直接执行
coolify CLI 命令（含创建 / 更新 / 重启 app 等可写动作）。NEVER 编辑用户仓库源文件，
NEVER 在 Coolify 网页 UI 上点击。任一前置断言失败时降级为 review-only（只回报现状，不执行写动作）。

## 这个 skill 做什么

- 在 tranfu 团队约定下，用 coolify CLI 跑覆盖 Coolify 实例的运维场景。
- 所有场景共用前置（context 确认、唯一 server 断言）与共用命名约束（tranfu-labs 组织、烤肉串 + -app 后缀、project 名 == 仓库名）。
- 首期只支持 onboard 新 app，其它场景留好扩展位。

## 这个 skill 不做什么

- **NEVER** 处理非 tranfu-labs 组织下的仓库或不符合命名约束的仓库；命名不合规直接终止。
- **NEVER** 写 Dockerfile / compose.yml / Traefik 标签本身；仓库可部署性的前置工作交给 coolify-deploy。
- **NEVER** 在 Coolify 网页 UI 上点击；所有动作走 CLI（unless 用户在触发语里明确接管手动操作）。
- **NEVER** 替用户安装 coolify CLI 或 jq；检测到缺失就提示安装命令并停下来。
- **NEVER** 在 onboard 场景里处理"已有 app 的重新部署 / 改配置"——那属于其它场景的范围（未来扩展）。

## 通用工作流

为下面的步骤建立一个 TODO 清单，并在每步完成后更新状态。

1. 读 `commands/prerequisites.md`，跑共用前置，拿到 `${server-uuid}`。
2. **用前必校**：若用户意图属于部署 / redeploy / inspect / lifecycle 等需要目标 app 的类别，但未在触发语里给出 GitHub URL、tranfu-labs 仓库名或 app 名 → 终止：向用户索取仓库 URL / app 名后再继续，绝不猜。
3. 根据用户意图路由：命中「场景路由表」的某一行 → 走该行指向的脚本；未命中 → 必须走表下的「路由兜底」段，绝不挑一个最像的场景硬上。
4. 读对应路由文件（`scenarios/<scenario>.md` 或路由表里显式给出的 `references/<file>.md`），按其内步骤逐步执行。每一步开始前打印 `Step N: <动作>`，把要跑的 CLI 命令展示给用户，让用户能复核。
5. 任一前置断言失败按场景内的"终止文案"返回，绝不静默继续。
6. **显式终止**：场景脚本走到自己的终止步骤后 → 回传 `${scenario-result}`（含 app UUID、最新 deployment UUID、deployment 状态、容器 running/healthy 状态、本次执行涉及的命令清单）给用户后结束。

**完成判据（可观测）**：

- 场景脚本走到其自身的"显式终止"步骤，未停在任何前置断言失败位置。
- `coolify app deployments list --context="${context}" <app-uuid>` 的最新一条状态 ∈ `{finished, success}`（onboard / redeploy 场景）；只读场景直接以"采集结果回传"为完成态。
- `coolify app get --context="${context}" <app-uuid>` 显示对应容器为 `running:healthy`（涉及部署的场景）。
- 本次执行的所有 CLI 命令退出码均为 0；非 0 必须落入失败出口或场景终止文案。

## 场景路由表

| 用户意图（关键词） | 场景脚本 |
|---|---|
| 把 tranfu-labs/`<x>`-app 部署到 coolify / 新仓库上线 / 用 GitHub App 部署新 app / onboard | `scenarios/onboard-new-app.md` |
| 再部署一遍 / 重新部署 / redeploy 已有 tranfu-labs/`<x>`-app | `references/existing-app-redeploy.md` |

### 路由兜底（未命中场景路由表时必走，绝不省略）

- **命中下方「未实现场景」占位**（troubleshoot / inspect / change-config / lifecycle / 数据库 / 防火墙 / mesh / env 同步 等） →
  终止：明确告诉用户「该场景尚未沉淀为可执行 scenarios/ 脚本」，指出对应的 `references/<file>.md`
  让用户手动参考，或建议先把它落地为 `scenarios/<name>.md` 再回流到本表，然后退出本流程；
  绝不挑路由表里最像的一行硬跑（onboard ≠ redeploy ≠ troubleshoot，混淆会把破坏性动作落到错的 app）。
- **意图既不在路由表也不在占位列表**（例如纯 Coolify 网页 UI 截图、跨 skill 范围请求） →
  终止：明确告诉用户「不在本 skill 覆盖范围，请检查触发词或换 skill」，并退出本流程。

未实现场景（占位，未来扩展时往 `scenarios/` 加一个文件并在本表添加一行）：

- 排查部署失败 / 应用跑不起来：`scenarios/troubleshoot-deploy.md`（待实现）
- 查看运行状态 / 看日志：`scenarios/inspect-app.md`（待实现）。在正式场景脚本落地前，先参考 `references/coolify-docker-inspection.md` 做只读的 Docker/Coolify 日志、top、CPU/内存、healthcheck 和高负载证据采集；不要把宿主机 `top` 里出现的容器 PID 误判成宿主机直接运行的服务。
- 改配置 / 改 env / 改端口：`scenarios/change-config.md`（待实现）。在正式场景脚本落地前，如果用户提供 `.env` 并要求继续部署，参考 `references/coolify-env-redeploy.md`：显式 update/create env、验证值长度、排查变量引用循环、清理阻塞的旧部署。
- 清理/删除 deployment 记录后重新部署：`references/coolify-clear-deployments-and-redeploy.md`。这是破坏性维护动作，只在用户明确要求清理历史记录时使用；先取消或确认没有 active deployment，再删除该 app 的 `ApplicationDeploymentQueue` 历史并重新部署。
- 停启 / 重启 / 删除应用：`scenarios/lifecycle.md`（待实现）
- 其它（数据库备份、服务管理、mesh 初装、防火墙、私钥）按相同模式追加。

## 全局守则

**MUST：破坏性命令必须先确认**。涉及 `delete` / `remove` / `stop` / `firewall revoke` /
`private-key remove` / `database backup delete-execution` / `app previews delete` 等命令时，
MUST 在执行前列出受影响资源（资源类型 / 名称 / UUID）+ 当前 context，并向用户确认后再跑；
NEVER 在用户未确认时执行任一破坏性命令。在 onboard 场景中本规则等价于
"同名 app 已存在时 NEVER 替用户删除"。

**MUST：context 必须显式传递到每一条 CLI 命令**。多实例环境里默认 context 容易选错。
每次进入场景脚本前 MUST 跑 `coolify context list --format json`，直接读 default / active
的那项记为 `${context}`；后续场景脚本里的**每一条 CLI 命令** MUST 显式带
`--context="${context}"`，NEVER 省略此 flag。

**reduce friction 例外**：默认 context 已经存在时 NEVER 反复问用户——直接读 default 用即可。
仅在「context list 为空 / 没有任何 default」时才停下来让用户决定；用户想换实例由用户主动声明
（在触发语里说「用 `<other-context>` 部署 xxx」），agent 解析后覆盖即可，不主动反问。
详见 `commands/prerequisites.md` Step A。

## 参数来源分类（reduce friction）

部署 onboard 涉及的参数分四类。**目标：默认值能自动推就别问用户；不传比传空更安全。**

| 参数 | 来源 | 默认行为 |
|---|---|---|
| `--context` | `coolify context list` 的 default / active | 自动用 default，不问用户；用户想换由用户主动声明 |
| `--server-uuid` | `coolify server list` 唯一一台 | 自动取；数量 ≠ 1 时按 `prerequisites.md` 终止 |
| `--github-app-uuid` | `coolify github list` 按 `organization=="tranfu-labs"` 自动挑 | 唯一匹配 → 自动用；零匹配或多匹配再让用户决定 |
| `--project-uuid` | repo 名查 / 不存在则建（project 名 == repo 名） | 自动 |
| `--name` | 等于 repo 名 | 自动 |
| `--git-branch` | 默认 `main` | 用户在触发语里明说别的分支才覆盖，不主动问 |
| `--build-pack` | 固定 `dockercompose`（tranfu 约定） | 不问 |
| `--ports-exposes` | 固定 `80` 占位（CLI required，dockercompose 模式下不生效） | 不问，**唯一允许的占位** |
| `--docker-compose-location` | **不传**（CLI 1.6.2 不暴露此 flag，靠约定 `compose.yml` 在仓库根） | **NEVER 传空字符串**，传空 = 显式覆盖默认 |
| compose.yml 内容（services / ports / env names） | **让 Coolify 替我们 git fetch**：create app 后轮询 `coolify app get` 的 `docker_compose_raw` 字段；agent **不接触 GitHub 凭证** | 自动 |
| `docker_compose_domains`（每个 service 的域名） | 从 compose 端口推默认：`web → https://${prefix}-app.tranfu.com:${WEB_PORT}`、`api → https://${prefix}-api-app.tranfu.com:${API_PORT}`（prefix = repo 去掉 `-app` 后缀） | 自动出预览；用户可在预检阶段改 |
| env 值 | **必须由用户在触发时一并提供**（贴 `.env` 文本）；agent 不存、不回显 | 用户没提供 → 列出 NAME 循环索要 |
| 其它 CLI optional flag | 没明确值就**不传** | 写空 = 反模式 |

「非必要不写空参数」守则：CLI 的 optional 参数若没有明确值，**直接不传**——传空字符串
（如 `--foo ""`）会被 Coolify 写为显式 `""`，等于覆盖默认值。仅 `--ports-exposes 80` 是 CLI
schema required 的已知占位例外，约定写死。

「Agent 接触 GitHub 凭证」守则：本 skill 默认运行在**没装 gh、没存 git credential** 的 agent 环境；
读仓库源文件统一走「create app → 让 Coolify git fetch → 轮询 `docker_compose_raw`」这条路，
**不要尝试 `git clone` / `gh api` 或临时 docker 容器复用 docker registry token**——后者用的不是
能读 git 内容的 scope。

## 引用文件

横切约定与共用前置：

- `commands/conventions.md`：全局 flag、输出格式、jq 解析模式、UUID 与 ID 的区别、别名表、状态枚举、
  几个常踩坑的命令默认行为。所有场景都假设读者了解这一份。
- `commands/prerequisites.md`：共用前置 —— context 确认 + 单 server 断言，拿 `${server-uuid}`。
  任一场景的 Step 0 都跳到这里。
- `commands/tranfu-naming.md`：tranfu 团队的硬命名约束 —— GitHub URL 解析、组织校验、
  仓库正则、project 命名规则、报错文案。涉及仓库的场景都跳到这里。

命令参数手册（按 topic 切，原文 1:1 抄录参数表，便于查参）：

- `commands/app.md`：`app create github` / `app list` / `app get` / `app delete` /
  `app deployments list` / `app deployments logs`。
- `commands/project.md`：`project list` / `project create` / `project get`。
- `commands/github.md`：`github list` / `github repos` / `github create` / `github get`。
- `commands/server.md`：`server list` / `server add` / `server validate` / `server get`。
- `commands/context.md`：`context list` / `context add` / `context use` / `context verify`。

未来扩展场景（troubleshoot / inspect / config-change / lifecycle / database / firewall / mesh）
所需的 topic（`app env` / `app storage` / `database` / `service` / `firewall` / `init` /
`teams` / `private-key` / `deploy` 等）按相同模式追加。

场景脚本：

- `scenarios/onboard-new-app.md`：首期唯一场景的 7 步流程，覆盖从 URL 到首次部署 logs 的全过程。
- `references/coolify-docker-inspection.md`：已有应用的只读 Docker/Coolify 检查：容器 logs/top/stats/inspect、healthcheck、高 CPU 证据采集，以及避免把容器 PID 误判为宿主机服务。
- `references/coolify-compose-deploy-failure-triage.md`：docker-compose 应用部署失败排查流程：优先读 deployment logs（不是 app logs）、区分 build 失败 vs 运行期 healthcheck 失败、处理 Coolify 清理失败容器后无法 docker logs 的情况。
- `references/existing-app-redeploy.md`：已有 Coolify app 的重新部署流程：按 repo/name 找 app UUID，`coolify app start --force` 触发，轮询特定 deployment UUID；如果新 deployment 长时间 queued，要检查前一个 in_progress deployment 和仍在重启的容器日志，避免只报告排队而漏掉当前阻塞原因。
- `references/coolify-clear-deployments-and-redeploy.md`：用户明确要求「清理记录 / 删除相关记录」再部署时使用；先取消 queued/in_progress deployment，再用 Coolify 容器内 Laravel tinker 按 app UUID 删除 `ApplicationDeploymentQueue` 记录，验证列表清空后重新部署并检查 HTTP。
- `references/coolify-env-redeploy.md`：用户提供 `.env` 后的 env 更新 + redeploy 流程：敏感值不回显，显式 update/create，验证值长度，处理 `SERVICE_PASSWORD_JWT` 变量循环，取消阻塞队列的旧 deployment，并最终验证 `running:healthy`。
- `references/coolify-dockercompose-domains.md`：dockercompose 应用按 compose service 设置域名的 API 流程；当 `coolify app update --domains` 返回 422 且提示使用 `docker_compose_domains` 时，直接 PATCH `/api/v1/applications/{uuid}`，用 `{name, domain}` 数组设置每个服务的域名，并用直接 API GET 验证（CLI 1.6.2 可能仍显示 null）。
- `references/coolify-disk-capacity-and-prune.md`：Coolify 部署机磁盘容量评估与安全 Docker 清理流程；区分本机 build 与 GitHub-built 只 pull/run 的增长模型，推荐先 `docker builder prune -af`、再 `docker image prune -af`，默认不清 volume，避免误删数据库/上传文件。
- `references/coolify-dockercompose-file-detection.md`：dockercompose 部署在 clone 成功后报 `Docker Compose file not found at ...` 的排查流程：先确认 `build_pack` / `docker_compose_location`，必要时用 API PATCH 修正，尝试常见根路径，使用 `coolify deploy get` 读取隐藏 clone/commit/路径证据；若所有根路径都失败，停止重复部署并要求仓库分支添加或移动 compose 文件。
- `references/coolify-cli-1.6.2-onboard-quirks.md`：本 profile 实测的 Coolify CLI 1.6.2 onboard 坑位：GitHub repos 命令用 numeric id、create 需 environment、deployment 字段名、decorated app name 匹配、compose location API fallback，以及用户偏好直接 shell 命令而非临时 Python 包装。

<example>
用户：把 https://github.com/tranfu-labs/foo-app 部署到 coolify

正向走法：按场景路由表跳到 `scenarios/onboard-new-app.md` 的 7 步流程跑。
该文件里的 `<example>` 块（搜「用户：把 https://github.com/tranfu-labs/order-mgmt-app」）
给出一份完整的逐步对话示例，含每条带 `--context=<name>` 的 CLI 命令，
是本 skill 真正可复制粘贴的示范。SKILL.md 自己不再重述命令细节，
避免两份示例不同步——所有命令示范以 scenarios/onboard-new-app.md 为单一事实源。
</example>

<bad-example>
错误做法：用户给了一个 GitHub URL，跳过 Step 0 和 Step 1 直接跑
`coolify app create github --git-repository tranfu-labs/foo-app ...`。

后果：
- 没确认 context，可能创建到错的实例（生产 vs 测试）。
- 没带 `--context="${context}"`，命令落到 default context，可能跟用户想要的实例完全不一致。
- 没断言 server 唯一，多 server 环境下 Coolify 会在不指定 server-uuid 时报错或落到错误归属。
- 没校验命名，给 `Foo_App` 这种不合规仓库照样建出来，事后清理要
  `coolify app delete` + 去 Coolify 网页 UI 删 project（CLI 不暴露 `project delete`）。

正确做法：每个场景都先跑 `commands/prerequisites.md` 的前置，再走 `commands/tranfu-naming.md` 的命名校验，
再进入场景脚本主体；场景脚本里每条 CLI 命令都显式带 `--context="${context}"`。
一旦任何断言失败，按场景的终止文案返回，绝不静默修复或绕过。
</bad-example>
