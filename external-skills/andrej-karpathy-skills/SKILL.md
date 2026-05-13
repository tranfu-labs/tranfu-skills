---
name: andrej-karpathy-skills
description: 基于 Andrej Karpathy 对 LLM 编码陷阱的观察，改善 Claude Code 行为的单文件行为准则。减少过度工程、无关改动和意图偏差。触发：任何 Claude Code 编码对话自动生效。
version: 0.1.0
author: multica-ai
updated_at: 2026-05-13
origin: external
source_url: https://github.com/multica-ai/andrej-karpathy-skills
---

# andrej-karpathy-skills (external thin pointer)

这是一个 **external 薄指针** —— 仓库里只存 frontmatter 和推荐者补充内容，不存 skill body.

首次 `install-skill` 时, install 流程会从 `source_url` 拉最新内容到本地 `~/.claude/skills/andrej-karpathy-skills/`, 并把这里的元数据回写为 stub.

- 上游: https://github.com/multica-ai/andrej-karpathy-skills
- License: MIT

更新内容请直接看上游 README / SKILL.md, 别在本仓库改 body.

## 推荐场景

适用:
- 设计自己的 CLAUDE.md 或项目级指令时，参考 Karpathy 的观察避免常见陷阱
- 作为 Claude Code 的基础行为层，让 AI 更少过度工程、乱改无关代码
- 给新接触 Claude Code 的同事一份行为准则，减少磨合期

不适用: hackathon 快速原型 / throwaway 探索性代码，准则偏保守可能拖慢速度.

## 同类 Skill 对比

> 由 publish-skill 起草, 推荐者签字. 帮助阅读者横向决定要装哪个 / 跳到更合适的同类.

### 公司库内
- [openspec](../external-skills/openspec/SKILL.md) — 多轮迭代项目规范管理，用 /opsx 命令拆 change；**本 skill 区别**: 不管理项目结构，直接约束 AI 行为本身，任何规模的项目都适用
- [skill-reverse-engineer](../own-skills/skill-reverse-engineer/SKILL.md) — 审计和改进 skill 文件；**本 skill 区别**: 不是工具，是行为准则，目标受众是终端用户而非 skill 作者

### 外部世界
- [cursorules](https://github.com/pontusab/cursorules) — 汇集 Cursor IDE 规则；**本 skill 区别**: 更聚焦 Andrej Karpathy 的编码哲学，不是工具罗列而是原则性约束
- [awesome-claude-prompts](https://github.com/langgptai/awesome-claude-prompts) — Claude 提示词合集；**本 skill 区别**: 不是提示词模板，而是融入工作流的底层行为准则

### 本 skill 独特价值
- Andrej Karpathy 亲自观察总结的 LLM 编码陷阱，有权威性背书
- 单文件零依赖，安装即生效，无需学习额外命令
- 直接减少 AI 过度工程、乱改无关代码等高频痛点

## 使用技巧

> 由 publish-skill 引导起草 (作者/推荐者答, AI 整合, 推荐者签字).
> 帮助阅读者纵向上手 — tacit knowledge 在此. 横向同类对比见上方 §同类 Skill 对比.

### 材料方案
- 考虑过直接复制准则到项目 CLAUDE.md vs 用独立 skill → 选独立 skill 可跨项目复用，避免重复粘贴
- 考虑过配合其他代码规范 skill 使用 → 本 skill 作为底层行为层，其他 skill 作为工具层，互补不冲突

### 推荐用法
- 安装后自动生效，无需特殊触发语，每次对话自动约束 AI 行为
- 可叠加项目级 CLAUDE.md 使用，在项目级补充领域知识，不重复写行为准则
- 推荐给新接触 Claude Code 的同事，减少"AI 乱改代码"的磨合期

### 已知限制
- 偏保守风格，hackathon 快速原型或探索性场景可能不适用
- 仅影响 Claude Code，Cursor / Copilot 等其他 AI 工具需单独适配
- 准则本身不解决具体技术问题，需配合领域 skill 使用
