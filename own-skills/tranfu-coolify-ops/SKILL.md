---
name: tranfu-coolify-ops
version: 0.1.1
author: aquarius-wing
origin: own
updated_at: 2026-06-23
description: >
  用 coolify CLI 在 tranfu 团队的 Coolify 实例上完成运维操作。
  首期只支持 onboard 新 app 这一个场景，把 tranfu-labs 组织下、烤肉串命名且以 -app 结尾的
  GitHub 仓库通过 GitHub App 路径接入 Coolify 并触发首次部署。其它场景
  （部署故障排查、查看运行状态、改配置、停启删除、数据库 / 服务 / 网格 / 防火墙等）会陆续扩展。
  触发短语：把 tranfu-labs/<x>-app 部署到 coolify、上 coolify 新应用、
  在 coolify 建个新 app 用 GitHub App 部署、给这个 tranfu 仓库做 coolify onboard、
  把这个新仓库挂到 coolify 上线；也覆盖口语说法，例如
  「这个仓库怎么挂到 coolify」「帮我把这个 app 跑到 coolify 上」，
  即使用户没有直接说 onboard。
  不要用于：非 tranfu-labs 仓库；命名不匹配 ^[a-z][a-z0-9-]*-app$；
  用 public 仓库 / deploy-key / Dockerfile / docker image 方式部署；
  改已有 app 的配置或重新部署已有 app；写 compose.yml 或 Dockerfile 本身
  （那是 coolify-deploy skill 的职责）；Coolify 网页 UI 操作；数据库备份、env 同步、
  服务管理、mesh 初装、防火墙等场景（占位中，未实现）。
---

# tranfu Coolify 运维

使用这个技能：当 tranfu 团队需要在 Coolify 实例上做运维操作时，按「共用前置 + 场景脚本」的方式
组织执行流程。所有场景都共享同一套硬约束（命名、唯一 server、唯一 GitHub App、project 名 == 仓库名），
在场景脚本里只写跟该场景相关的判断与命令。

任务的本质不是"调一条 CLI 命令"，而是"在 tranfu 团队的约定下，把若干 CLI 命令串成可重复、
可被中途终止的工作流"。每一步先断言再动作，断言失败就停下来报清楚原因，避免在错误归属、
错误命名或错误归宿下创建资源（创建容易、回滚要 `coolify app delete` + 去 Coolify 网页 UI 删 project ——
coolify CLI 目前不暴露 `project delete`——代价不小）。

## 这个 skill 做什么

- 在 tranfu 团队约定下，用 coolify CLI 跑覆盖 Coolify 实例的运维场景。
- 所有场景共用前置（context 确认、唯一 server 断言）与共用命名约束（tranfu-labs 组织、烤肉串 + -app 后缀、project 名 == 仓库名）。
- 首期只支持 onboard 新 app，其它场景留好扩展位。

## 这个 skill 不做什么

- 不处理非 tranfu-labs 组织下的仓库或不符合命名约束的仓库。命名不合规直接终止。
- 不写 Dockerfile / compose.yml / Traefik 标签本身。仓库可部署性的前置工作交给 coolify-deploy。
- 不在网页 UI 里点。所有动作走 CLI。
- 不替用户安装 coolify CLI 或 jq。检测到缺失就提示安装命令并停下来。
- 不在 onboard 场景里处理"已有 app 的重新部署 / 改配置"。那属于其它场景的范围（未来扩展）。

## 通用工作流

为下面的步骤建立一个 TODO 清单，并在每步完成后更新状态。

1. 读 `commands/prerequisites.md`，跑共用前置，拿到 `${server-uuid}`。
2. 根据用户意图，对照「场景路由表」选定场景。
3. 读对应 `scenarios/<scenario>.md`，按场景内的步骤逐步执行。每一步开始前打印 `Step N: <动作>`，把要跑的 CLI 命令展示给用户，让用户能复核。
4. 任一前置断言失败按场景内的"终止文案"返回，绝不静默继续。

## 场景路由表

| 用户意图（关键词） | 场景脚本 |
|---|---|
| 把 tranfu-labs/`<x>`-app 部署到 coolify / 新仓库上线 / 用 GitHub App 部署新 app / onboard | `scenarios/onboard-new-app.md` |

未实现场景（占位，未来扩展时往 `scenarios/` 加一个文件并在本表添加一行）：

- 排查部署失败 / 应用跑不起来：`scenarios/troubleshoot-deploy.md`（待实现）
- 查看运行状态 / 看日志：`scenarios/inspect-app.md`（待实现）
- 改配置 / 改 env / 改端口：`scenarios/change-config.md`（待实现）
- 停启 / 重启 / 删除应用：`scenarios/lifecycle.md`（待实现）
- 其它（数据库备份、服务管理、mesh 初装、防火墙、私钥）按相同模式追加。

## 全局守则

**破坏性命令必须确认**。涉及 `delete` / `remove` / `stop` / `firewall revoke` / `private-key remove` /
`database backup delete-execution` / `app previews delete` 等命令时，执行前先列出受影响资源
（资源类型 / 名称 / UUID）+ 当前 context，向用户确认后再跑。在 onboard 场景中本规则用于
"同名 app 已存在时绝不替用户删除"。

**操作前先确认 context，并显式传递到每一条命令**。多实例环境里默认 context 容易选错；
每次进入场景脚本前先跑 `coolify context list`，让用户确认在哪个实例（生产 / 测试 / 其它），
把这个名字记为 `${context}`。**后续场景脚本里的每一条 CLI 命令都显式带 `--context="${context}"`**，
把 Step 0 的确认结果传递到每个写操作上，避免 default context 与用户表达不一致时写到错误实例
（写错后回滚成本高，见前面"任务的本质"段）。临时切到另一个实例时也用 `--context=<name>` 覆盖单条命令，
不动 default context。

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
