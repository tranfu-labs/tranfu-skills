---
name: skill-create-workflow
display_name: Skill Creation
display_name_zh: Skill 创建
description: >-
  把用户提供的想法、文档、经验或上文内容创建为新的 Codex / Claude Code skill。
  当用户要求创建、编写、封装或“把它做成 skill”时使用。
version: 0.5.0
author: aquarius-wing
updated_at: 2026-09-03
origin: own
userInvocable: true
---

# Skill 创建

根据用户提供的目标或材料创建新的 Skill。

先参考 `skill-content-fit` 判断材料是否适合做成 Skill。名称或任务域不清楚时，再使用 `skill-domain-framing`。

使用平台原生 `skill-creator` 创建简洁的 `SKILL.md`。只写 Claude 不知道且会影响任务表现的内容；流程、示例、验证步骤、引用、脚本和资产均按任务实际需要添加。

创建后运行仓库或平台已有的基础结构校验。仅在用户明确要求时运行 `prompt-review` 或 `tranfu-publish`。
