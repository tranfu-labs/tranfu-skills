---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance (100+ rules: a11y / focus / forms / performance / UX). Trigger when user says "review my UI", "check accessibility", "audit design", "review UX", "check my site against best practices", "审一下前端", "查 a11y". Do NOT trigger when: 用户想生成设计系统 (走 ui-ux-pro-max) / 审 prompt 而非代码 (走 prompt-review) / 只画架构图 (走 fireworks-tech-graph).
version: 1.0.0
author: vercel
updated_at: 2026-05-20
origin: external
source_url: https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines
---

# web-design-guidelines (external thin pointer)

这是一个 **external 薄指针** —— 仓库里只存 frontmatter 和推荐者补充内容, 不存 skill body.

首次 `tfs install web-design-guidelines` 时, install 流程会从 `source_url` 拉上游 SKILL.md (Vercel 官方 1.2KB 极简实现, 每次审代码时实时 fetch `vercel-labs/web-interface-guidelines/main/command.md` 拿最新 100+ 规则).

- 上游 skill: https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines
- 规则源: https://github.com/vercel-labs/web-interface-guidelines
- License: 见上游

更新内容请直接看上游 README / SKILL.md, 别在本仓库改 body.

## 推荐场景

适用:
- 写完前端代码后做 PR review 前自审 (a11y / focus / forms / 语义 HTML / 键盘交互)
- 接手老前端项目, 跑一遍找累积的合规债
- 跟刚发的 `ui-ux-pro-max` 配套用 — 一个给设计输入, 一个审代码输出

不适用: 服务端 / API / 后端代码 (规则只针对 UI 层); 离线环境 (依赖网络实时拉规则).

## 同类 Skill 对比

> 由 tranfu-publish 起草, 推荐者签字.

### 公司库内
- [ui-ux-pro-max](../ui-ux-pro-max/SKILL.md) — 设计参考库 (风格 / 配色 / 字体 / 图表), 给"该选什么"输入; **本 skill 区别**: 互补关系 — ui-ux-pro-max 在前 (设计输入), 本 skill 在后 (代码审计), 闭环用

### 外部世界
- [AccessLint](https://snyk.io/articles/top-claude-skills-ui-ux-engineers/) — 专注 a11y 的 4-skill 套装 + MCP server 跑色彩对比; **本 skill 区别**: 不只 a11y, 也覆盖 focus / forms / performance / UX 共 100+ 规则
- [Anthropic frontend-design](https://claude.com/blog/improving-frontend-design-through-skills) — 反 "AI slop" 原则性 skill, 教 AI 像前端工程师那样思考; **本 skill 区别**: 不是原则, 是 100+ 条具体规则跑出 `file:line` findings, 可量化

### 本 skill 独特价值
- 每次实时拉规则不内嵌, 规则更新无需升级 skill
- Vercel 官方背书, 规则源于其生产实践
- 输出 `file:line` 格式, 适合 CI / review 工具集成

## 使用技巧

> 由 tranfu-publish 引导起草.

### 材料方案
- 接 Anthropic Agent Skills 标准, 装上后 Claude Code 自动识别触发语
- 跟 ui-ux-pro-max 串用: 先设计基线, 写完再跑本 skill 审合规
- CI 集成可用 `argument-hint: <file-or-pattern>` 锁定 diff 文件

### 推荐用法
- 第一次跑: "review my UI" + 指定文件 / glob (e.g. `src/components/**/*.tsx`)
- PR 审场景: 对着 diff 文件跑, 直接出 `file:line` 清单
- 触发语含: "review my UI" / "check accessibility" / "audit design" / "review UX"

### 已知限制
- 依赖网络: 每次实时 fetch 规则, 离线环境用不了
- 规则源若上游改 path 或下线, 本 skill 直接失效
- 只审 UI 层, 服务端 / API 不在范围
