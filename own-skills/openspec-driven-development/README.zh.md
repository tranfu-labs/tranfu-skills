---
prompt_examples:
  - prompt: 帮我加一个「一键导出全系列」的功能，卡片导出那边。
    scene: 开发新功能
  - prompt: 现在删一个操作员，删除预览里为什么会列出一大串关联的操作员？先讨论清楚再决定动手。
    scene: 排查程序问题
  - prompt: 你会如何把「用户偏好」从 localStorage 迁到后端？先讨论一下，别急着写码。
    scene: 先讨论方案
  - prompt: 实施 openspec/changes/add-export-all，方案已经确认过了。
    scene: 实施已定方案
  - prompt: 方案实施完了，帮我检查代码是否符合 openspec/changes/add-export-all，有没有遗漏。
    scene: 检查方案落实
  - prompt: 给 settings 加一个「导出偏好」按钮，按 openspec 走一遍，停在 plan-written 让我看一眼。
    scene: 写完方案暂停
---

[English](./README.md) | [中文](./README.zh.md)

# openspec-driven-development

把日常开发跑成「方案 → feature 分支 → spec → 码 → 归档 → PR」的闭环, 让方案、代码、事实源始终对得上。

## 什么时候用它

**开发新功能**:

我在 openspec 约定的仓库里加个功能 / 修个 bug / 重构一段代码, 想让它先出方案我点头再动手, 落盘、切分支、开 PR 一条龙。

**咨询开场**:

我在问「你会怎么改这段」「这个功能做在哪里合适」「为什么这里不对」, 想让它顺势把讨论收敛成方案, 而不是陪我漫无目的地聊。结论若「其实不用改代码」, 它给解释就收工, 绝不硬造 change。

**实施已定方案**:

我已经在别的对话里写好了 `openspec/changes/<X>` 的方案, 直接说「实施这个 change」, 让它跳到写码环节, 别再从采访重头走。

**符合度复核**:

「实施完了帮我检查代码是否符合方案 / 有无遗漏」——让它以 change 为基准逐条核对, 有偏差就回到写码环节补齐。

**快车道**:

一两行的微改动、改个文案、调个默认值, 我不想被完整闭环压得喘不过气——跳过 change 落盘, 但反思、commit、PR 照走。

**写完方案暂停**:

「按 openspec 走一遍, 停在 `plan-written` 让我看一眼」——推进计划里指定停点, 方案落盘后老实等我发话再写码。

**不接**:

冷启动搭 `openspec/` 骨架 → **project-init-docs**; 打 tag / 写 changelog / 定版本号 → **release**; 「项目整体是否符合规范 / 标准」这类脱离具体改动的合规审计 → 不触发; 纯查询 / 查资料 / 跑一条不改代码的命令 → 不触发。

## 它会产出什么 / 你会看到什么

**默认先出方案, 除非推进计划本身没要求在 `plan-written` 停下, 否则得你明确说「开始写代码」它才动代码**——最反常识的一点, 别指望它一上来就闷头写。

- **推进计划**: 一进来就把 `interviewing → interview-confirmed → plan-written → code-written → code-verified → pr-opened` 亮出来, 让你指定停点或加事; 这是你最初一次「在哪儿停 / 在哪儿加事」的机会
- **采访诊断**: 采访阶段天然停下等你回答, 最后一问固定「还有要补充的吗？」——它不会替你答、不会跳过
- **聊天框方案**: 先在对话里出方案 (改页面附字符图; 含可测逻辑或单文件 diff > 200 行附单测和 AI 验证用例), 自己复查通过才落盘
- **切分支**: `git fetch` 后从最新 `origin/main` 切 feature 分支, 绝不动 `main` / `master`; 已有本 change 的 feature 分支则复用
- **落盘 change**: `openspec/changes/<change-id>/` 下写 proposal / design / tasks / spec-delta; 改页面时另加 `wireframes.md` (绝不塞进 `design.md`)
- **按 spec 写码**: 落地方案里定义的测试用例, 跑单测或 AI 验证流程 (playwright 截图 / 跑命令看输出 / 手动一遍)
- **归档三步**: change 目录移到 `openspec/changes/archive/<日期>-<id>/`; spec-delta 合进 `openspec/specs/<domain>/`; 字符图回流到 `docs/wireframes/pages/<page>.md` 与 `flow.md`
- **收尾 PR**: 更新 `AGENTS.md` + commit 到 feature 分支; 有 remote 就 `git push -u` + `gh pr create` (body 直接粘 `proposal.md`; 上下文出现过 issue 编号首行加 `Closes #<编号>`), 把 PR URL 报给你
- **绝不会做**: 自己合并 PR; 在 `main` / `master` 上直接落盘或 commit; 替你答采访问题; 在没有 `openspec/` 的仓库里擅自搭骨架; 从归档里翻出旧 proposal 冒充新方案

## 前置条件 / 边界

**前置**:

仓库根有 `openspec/` 目录 (`openspec/specs/` + `openspec/changes/`); 能跑 `git`, 有 remote 且想开 PR 时需要 `gh` (或 `glab mr create` 之类的等价物)。

**相邻 skill 分工**:

| 动作 | 交给 |
|---|---|
| 冷启动搭 `AGENTS.md` + `openspec/` 骨架 | **project-init-docs** |
| 打 tag / 写 changelog / 定版本号策略 | **release** |
| 判断素材值不值得沉淀成 skill / spec | 内容判定链, 与本 skill 无关 |

**不接的场景**:

- 纯查询 / 查资料 / 跑一条不改代码的命令
- 与具体改动无关的合规审计
- 往已归档 `archive/<日期>-<id>/` 里追加改动——要重新起一个新 change

**微妙边界**:

- 问「代码是否符合方案 / 某个 change」→ 触发符合度复核; 问「项目整体是否符合规范 / 标准」→ 不触发 (脱离改动的合规审计)
- 「实施 openspec/changes/<X>」显式句式 → 直接进写码, 前提是方案完整; 残缺 → 退回采访, 绝不硬撑着实现
- 微改动快车道 → 跳过 change 落盘, 但仍走反思 + PR; 动手中发现改动其实不小 (碰可测逻辑 / 多文件 / 远超几行) → 立即退回采访阶段走完整流程
