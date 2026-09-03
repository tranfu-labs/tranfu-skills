---
name: skill-content-fit
display_name: Skill Content Fit Check
display_name_zh: Skill 内容准入评估
description: >
  Always trigger for: 创建新 Codex skill 前的准入判断、把尚未成型的项目知识/经验教训/执行规则/误差反馈/事故复盘/文档片段转成 skill 前的内容适配评估、判断内容是否值得沉淀成可复用能力。
  Also trigger for casual phrasing: "这个适合写成 skill 吗", "能不能固化成 skill", "要不要沉淀成能力", "这段经验值得做成规则吗", even if the user does not use the word skill.
  Do NOT trigger when: 输入已经是 skill、SKILL.md、已安装 skill，或用户是在审查、优化、更新、修复现有 skill。
version: 0.2.0
author: aquarius-wing
updated_at: 2026-09-03
origin: own
---

# 什么内容适合写成 Skill

## 适合写成 Skill 的案例

参考型内容：项目约定、领域知识、设计模式、风格规范、术语和规则。
任务型内容：部署、提交、代码生成等特定操作；只有这类内容在确有必要时才需要步骤。

## 场景边界

可复用：会在多个相似任务中再次用到，而非纯粹的一次性上下文。
有增量价值：提供 Claude 本身不知道或不容易稳定推断的项目、团队、工具或领域知识。
可识别触发：可以清楚说明它做什么，以及用户在什么任务下需要它。

内容边界

- Skill 应假设 Claude 已经很聪明，只写它真正不知道的内容。
- SKILL.md 应简洁，每段文字都要值得占用上下文。
- 固定流程只适合复杂、脆弱或必须按顺序执行的任务。
- 示例只在输出质量依赖示范时提供。
- 验证步骤主要用于关键操作，并非所有 Skill 的必备内容。
- 详细材料可以拆到引用文件中，按需读取。
