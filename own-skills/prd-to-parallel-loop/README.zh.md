---
description: "把一份 PRD 或里程碑文档拆成多个 openspec 变更, 一个变更配一个 git worktree 交给 codex 并行做, 最后给你一段粘贴就能开跑的启动语。"
prompt_examples:
  - prompt: 把 docs/roadmap/milestone-5-main-conversation.md 拆一下，并行跑起来。
    scene: 里程碑并行开工
  - prompt: 这份 PRD 帮我落地，先讨论清楚拆成几个变更再动手。
    scene: 从 PRD 拆变更
  - prompt: openspec/changes 下那几个变更我已经写好了，帮我把并行运行时装上。
    scene: 只补运行时
---

# PRD 并行 Loop 脚手架

把一份产品文档拆成 N 个 openspec 变更, 每个变更独占一个 git worktree 与一个 codex 会话, 搭出一套心跳调度就能开跑的并行开发脚手架。

## 什么时候用它

**里程碑并行开工**:

我手上有一份 `docs/roadmap/milestone-N-xxx.md`, 里面变更清单、依赖、验收编号都写好了。我想让它直接照着落成一批 openspec 变更, 把并行运行时装起来, 别再拉着我重新讨论一遍拆分。

**从 PRD 拆变更**:

我只有一份 PRD, 还没想清楚该拆成几块。我想让它先把验收标准横着摊开、逐条问清楚"这条最后落在哪个字段、哪个模块", 再和我商量一版拆分方案, 我点头了才落盘。

**只补运行时**:

变更目录我自己写过了, 缺的只是并行跑起来的那套东西——状态文件、调度指令、启动语。已经写好的变更一个字都别动。

**中途接手**:

里程碑文档里有几项已经打了勾。我希望它认出这些是做完的, 排进状态但不再调度, 只并行推进剩下的。

**不接**:

变更文档本身怎么写 → 交给 **project-init-docs** 和 **credibility-review**; 仓库还没有 `openspec/` 目录 → 先走 **openspec-driven-development** 建骨架; 最后只拆出一个变更 → 不值得起 loop, 也走 **openspec-driven-development**。

## 它会产出什么 / 你会看到什么

**它只搭台子, 不写业务代码**——真正的实现发生在之后你另开对话跑 `/loop` 的时候, 由各个 worktree 里的 codex 完成。

- **落变更骨架**: 在 `{项目仓库}/openspec/changes/<变更 id>/` 下, 从项目自带的 `_template/` 拷一份再填 proposal / design / tasks / spec-delta; 目录已存在的一个字不改
- **装通用工具**: 往 `~/dev-loops/bin/` 放三个调度用的 `.mjs` 脚本, 同名文件已存在就跳过, 绝不覆盖
- **落运行时状态**: `~/dev-loops/<项目>/<批次>/` 下写 `runtime.json`(依赖关系的唯一事实源)、调度指令和启动语; 从 PRD 协商来的还会多一份验收落点表
- **默认停一次**: 从 PRD 起步时, 拆分方案会先摊给你确认, 你说"就这么拆"才落盘; 里程碑清单能直接解析时才自动跳过这一停
- **绝不会做**: 改你的 PRD 或里程碑文档; 改已存在的变更目录; 动 git 历史或产品代码; 覆盖已经在跑的 `runtime.json`; 推送或合并到远端

## 前置条件 / 边界

**前置**:

项目根是 git 仓库且有 `openspec/changes/_template/`; 本机装了 codex 命令行; 装了 `openspec-driven-development`(worktree 里的 codex 直接引用它的步骤); `~/dev-loops/` 可写。

**相邻 skill 分工**:

| 动作 | 交给 |
|---|---|
| 冷启动搭 `openspec/` 骨架 | **openspec-driven-development** |
| 只有一个变更要做 | **openspec-driven-development** |
| 写或评审 PRD、里程碑文档 | **project-init-docs** / **credibility-review** |

**不接的场景**:

- 没有产品文档起点, 只想随手跑一个 codex 任务
- 要求把 PRD 直接编译成代码, 不经过 openspec 变更
- 给已经在跑的批次做增量更新——它只负责从零搭, 要重来得先手工清掉旧状态目录

**微妙边界**:

- 里程碑文档解析不出变更清单 → 不报错, 自动改走"当 PRD 用、全程协商"这条路, 并在开头说明
- 变更 id 与 `openspec/changes/` 下已有目录重名 → 停下问你是沿用还是换名, 不擅自选
- 拆分讨论时你说"你决定" → 它把候选写成待确认清单存着, 停在原地, 不擅自落盘
- 验证命令探测不到 → 不阻塞, 留一条占位提示让你事后手工填
