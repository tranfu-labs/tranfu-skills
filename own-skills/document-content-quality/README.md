---
description: Turn formal content into a clear, executable, verifiable document without inventing missing facts.
prompt_examples:
  - scene: Organize meeting notes
    prompt: Turn these meeting notes into a project brief the team can execute directly.
  - scene: Improve a formal document
    prompt: Rewrite this proposal so the client can understand scope, cost, responsibilities, and acceptance.
  - scene: Improve Lark readability
    prompt: Restructure this text-heavy Lark policy so employees can read and follow it easily.
---

# Document Content Quality

Create, rewrite, organize, review, and finalize formal content so a reader without prior context can understand what matters, what to do, and how completion will be judged.

## When to use it

- Create or improve proposals, policies, notices, reports, quotations, runbooks, handover documents, JDs, and client materials.
- Turn notes, meetings, chats, links, or an existing document into a formal deliverable.
- Improve a text-heavy document with appropriate paragraphs, tables, steps, checklists, timelines, screenshots, or diagrams.
- Check whether responsibilities, deadlines, prerequisites, deliverables, acceptance criteria, links, and open questions are clear.

## 同类 Skill 对比

> 由 tranfu-publish 起草，帮助阅读者横向决定要安装哪个或跳到更合适的同类。

### 公司库内

- [structured-thinking-advisor](../structured-thinking-advisor/SKILL.md) — 负责逻辑拆解和多轮共创；**本 Skill 区别**：形成可执行、可验收的正式交付。
- [lark-safe-write](../lark-safe-write/SKILL.md) — 负责飞书写入安全和回读；**本 Skill 区别**：跨平台处理内容结构与表达质量。
- [proofread-content](../proofread-content/SKILL.md) — 负责自媒体成稿审校；**本 Skill 区别**：处理制度、方案、报告、JD 和客户材料。

### 外部世界

- [Anthropic doc-coauthoring](https://github.com/anthropics/skills/blob/main/skills/doc-coauthoring/SKILL.md) — 通过多轮访谈和读者测试共同写文档；**本 Skill 区别**：可直接处理已有材料，并覆盖正式交付与平台回读。
- [technical-writer](https://github.com/xcrrr/claude-skills/blob/main/skills/writing/technical-writer/SKILL.md) — 面向技术文档、API 和安装指南；**本 Skill 区别**：覆盖业务、管理、客户和团队执行文档。

### 本 skill 独特价值

- 跨格式统一正式文档质量门禁
- 以陌生读者独立执行为验收
- 同时约束结构、术语、链接与回读

## 使用技巧

> 由 tranfu-publish 引导起草，帮助阅读者纵向上手；横向选择见上方“同类 Skill 对比”。

### 材料方案

- 提供原始资料、目标读者和用途
- 标明不可修改的事实与范围
- 有现成模板时一并提供

### 推荐用法

- 先整理内容，再调用平台写入能力
- Lark 写入同时搭配 `lark-doc`
- 最终交付前运行陌生读者检查

### 已知限制

- 不替代法律、财务等专业审核
- 缺失事实只标待确认，不代填
- 不负责单纯格式转换或线上发布

## What it produces

- A conclusion-first document calibrated to its audience and purpose.
- Appropriate use of prose, tables, steps, checklists, timelines, screenshots, and diagrams without decorative over-formatting.
- Clear separation of confirmed facts, recommendations, and open questions.
- An execution and acceptance check covering owner, timing, inputs, outputs, dependencies, risks, and completion criteria.
- Verified third-party links and a readback or visual check when a platform or file-format skill performs the actual write.

## Prerequisites and boundaries

Provide the source material, intended audience, purpose, and any facts or wording that must not change. Missing information remains explicitly open; the Skill never invents owners, dates, amounts, responsibilities, or acceptance steps. It controls content quality, not platform permissions or file mechanics, so pair it with `lark-doc`, Word, PDF, spreadsheet, or presentation skills when those formats must be edited.
