---
name: ui-ux-pro-max
description: AI-powered design intelligence with 67 UI styles, 161 color palettes, 57 font pairings, 99 UX guidelines, and 25 chart types across 15+ tech stacks. Trigger when user asks for design system / 配色 / 字体搭配 / UI 风格选型 / 落地页结构 / 图表选型 / UX 守则 / "帮我做一套设计系统". Do NOT trigger when: 用户只要写功能代码 / 修 bug / 项目结构包装 (走 github-repo-completeness).
version: 2.5.0
author: NextLevelBuilder
updated_at: 2026-05-20
origin: external
source_url: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
---

# ui-ux-pro-max (external thin pointer)

这是一个 **external 薄指针** —— 仓库里只存 frontmatter 和推荐者补充内容, 不存 skill body.

首次 `tfs install ui-ux-pro-max` 时, install 流程会从 `source_url` 拉最新内容到本地 `~/.claude/skills/ui-ux-pro-max/`, 上游附带 `npx uipro-cli init --ai claude` CLI 安装器 + Python 检索脚本.

- 上游: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- 官网: https://uupm.cc
- License: MIT

更新内容请直接看上游 README / CLAUDE.md, 别在本仓库改 body.

## 推荐场景

适用:
- 起新项目 / 做落地页前, 一次性出设计系统基线 (风格 + 配色 + 字体 + 排版)
- 卡在"该选什么色板 / 字体配对 / 图表类型"时, 当作可检索的设计参考库
- 团队需要统一 UI/UX 守则 (99 条), 用作 reviewer / 设计师参考

不适用: 已有成熟设计系统的项目 / 纯功能代码改动 / 只想要单张 SVG 图 (走 fireworks-tech-graph).

## 同类 Skill 对比

> 由 tranfu-publish 起草, 推荐者签字.

### 公司库内
- 暂无 (设计系统数据库类 skill 公司库里是第一个)

### 外部世界
- [Anthropic frontend-design](https://claude.com/blog/improving-frontend-design-through-skills) — 反 "AI slop" 的原则性 skill, 教 AI 像前端工程师那样思考; **本 skill 区别**: 给"可检索数据集 + prompt", 不是只给原则, 适合卡选型时直接查
- [shadcn/ui 官方 skill](https://ui.shadcn.com/docs/skills) — 让 AI 了解项目 components.json + 框架 + 已装组件; **本 skill 区别**: 不绑 shadcn 生态, 覆盖 React/Vue/Svelte/SwiftUI/Flutter 等 15+ 栈, 视野更宽
- [Vercel Web Design Guidelines](https://snyk.io/articles/top-claude-skills-ui-ux-engineers/) — 审 UI 代码合规 (100+ a11y/性能规则); **本 skill 区别**: 不审代码, 而是给"选什么"的输入, 与 Vercel skill 互补

### 本 skill 独特价值
- 数据集量级是同类 skill 里最大的 (67/161/57/99/25)
- 一句 `--design-system` 五域并行检索, 直接出完整基线
- 上游同时支持 18 种 AI 平台 (Claude/Cursor/Windsurf/Copilot/Codex 等), 团队混用工具时行为统一

## 使用技巧

> 由 tranfu-publish 引导起草.

### 材料方案
- 装上游前先想清是要"基线一次出" (用 `--design-system`) 还是"局部查" (用 `--domain`)
- 跟 Anthropic frontend-design 叠用: 本 skill 给输入, frontend-design 校审美原则
- 跟 fireworks-tech-graph 互补: 设计系统出来后, 架构图走画图 skill

### 推荐用法
- 第一次跑: `python3 src/ui-ux-pro-max/scripts/search.py "saas dashboard" --design-system`
- 局部检索: `--domain style|color|typography|chart|ux|landing|product`
- 指定栈: `--stack react|nextjs|vue|svelte|swiftui|...` (默认 html-tailwind)

### 已知限制
- 数据集是静态 CSV, 设计趋势更新依赖上游版本 (当前 v2.5.0)
- BM25 + regex 检索, 语义模糊查询 (e.g. "复古但不土") 命中率一般
- Python 3 依赖, 没装 python 的环境跑不了检索脚本
