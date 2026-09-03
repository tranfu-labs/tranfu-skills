---
description: "把想法、文档、经验或上文内容创建为简洁的 Codex / Claude Code skill。"
prompt_examples:
  - prompt: 把 docs/postmortem.md 沉淀成一个项目内 skill
    scene: 从文件创建 Skill
  - prompt: 好，那就做成 skill 吧
    scene: 接着上文创建
  - prompt: 把刚才聊的发布检查清单封装成 skill
    scene: 把想法做成 Skill
---

# skill-create-workflow

把想法、文档、检查清单、事故复盘或上文讨论首次封装成 Codex / Claude Code skill。

## 如何工作

- 用 `skill-content-fit` 判断材料是否适合做成 skill。
- 只在名称或任务域不清楚时使用 `skill-domain-framing`。
- 用平台原生 `skill-creator` 创建简洁的 skill，并运行现有的基础结构校验。
- 流程、示例、脚本、引用和资产均按任务需要添加。
- 只在用户明确要求时评审或发布。

## 边界

适用于创建全新 skill，也覆盖源材料已在上文、用户接着说“把它做成 skill”的情况。

如果只需判断内容适配、框定任务域、生成显示名、发布或安装 skill，直接使用对应能力；创建 plugin、修改普通项目代码或编写非 skill 文档也不走本流程。
