---
description: "把可复用的素材依次经过内容准入、任务域框定、创建与提示词检查，生成一个新 skill。"
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

## 工作流

1. `skill-content-fit` 判断素材是否可复用、可执行、可验证且有边界；打回即停止。
2. `skill-domain-framing` 决定名称、范围和内容放置位置；候选接近或与用户指定冲突时交给用户选择。
3. 平台的 `skill-creator` 创建 skill 文件。
4. `prompt-review` 检查生成的提示词文件是否存在不必要的硬强调词。
5. 最终汇报文件路径、验证结果和未解决风险；只有用户明确要求时才发布。

## 边界

适用于创建全新 skill，也覆盖源材料已在上文、用户接着说“把它做成 skill”的情况。

如果只需判断内容适配、框定任务域、生成显示名、发布或安装 skill，直接使用对应能力；创建 plugin、修改普通项目代码或编写非 skill 文档也不走本流程。
