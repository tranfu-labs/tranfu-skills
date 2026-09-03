---
description: "判断可复用材料是否适合做成 Claude 或 Codex skill。"
prompt_examples:
  - prompt: 这段事故复盘适合沉淀成 skill 吗？
    scene: 从事故中提炼
  - prompt: 这条项目约定值得做成 skill 吗？
    scene: 复用项目知识
  - prompt: 这份风格规范能做成 skill 吗？
    scene: 封装参考材料
---

# Skill 内容准入评估

判断一段材料是否适合做成可复用的 skill。

## 适合的内容

- 项目约定、领域知识、设计模式、风格规范、术语和规则。
- 部署、提交、代码生成或其他可识别的任务指导。
- 能在未来相似请求中继续使用的材料。

## 判断要点

- 材料可复用，不是一次性上下文。
- 它提供 Claude 无法稳定自行推断的增量知识。
- 可以识别应该在什么任务或场景下使用。

Skill 不需要必然包含流程、示例、验证步骤、边界或验收标准。仅在任务确实受益时添加；保持 `SKILL.md` 简洁，详细材料可按需拆到引用文件。

## 相关 skill

| 任务 | Skill |
|---|---|
| 创建新 skill | `skill-create-workflow` |
| 任务域或名称不清晰 | `skill-domain-framing` |
| 评审已有 skill | 平台 skill 编辑能力 |
