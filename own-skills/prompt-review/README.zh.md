---
description: "检查提示词、skill 或 agent 定义里的问题，逐条说明影响和改法，但不会直接修改原文件。"
prompt_examples:
  - prompt: 检查这段提示词有哪些工程问题。
    scene: 检查提示词
  - prompt: 检查 own-skills/example/SKILL.md，给我一份可执行的问题清单。
    scene: 检查 Skill
  - prompt: 检查这个 Agent 定义里有没有互相冲突的指令。
    scene: 检查 Agent
---

# prompt-review

提示词 / skill / agent 工程化评审清单. 按 SKILL.md 内的 A-G 检查项（每条带严重级别与修法分型）本地审目标文件. 输出 `REVIEW_PACKET`：每个 issue 带 severity、修法分型（fix_type）、命中的检查项、行锚点、evidence、验收标准，外加一个 ledger. 有标准答案的问题（direct）直接给改法案例；修法依赖作者主观判断的问题（think）给 2-3 个思考问题而不替作者编答案. 是否落盘修改、是否多轮重审由调用方 / Harness 决定.

## 什么时候用它

- 写完一个 skill / agent / prompt 文件, 想拿到工程化的逐条改进建议
- 评审现有 prompt 库, 检查"应该 / 尽量"等软词、缺量化通过标准、缺反向引导等常见硬伤
- 评审较长或多文件的 skill / agent, 按 A-G 逐维度过一遍
- 不靠网络 — 详细清单就在 SKILL.md 内, 自包含, 离线可跑

## 怎么用 (触发示例)

跟 Claude 说:
- "帮我审一下这个 prompt: agents/evaluator.md"
- "review skill ~/.claude/skills/foo/SKILL.md"
- "评审这个 agent 定义, 检查提示词质量"

或直接粘贴一段 prompt 文本让它审.

## 你会看到什么

- 本地按 A-G 逐条审，命中即记一条 issue
- 评审结果以 `REVIEW_PACKET` 结构化回报，每个问题映射到一个 A-G 检查项并带严重级别
- 每条 issue 按修法分型二分:
  - **direct**（有标准答案）: 直接给具体改法案例 / 可落盘 patch — 例如软词替换、字段名对齐、加 WRONG 标签
  - **think**（依赖作者主观判断）: 不编造答案, 给 2-3 个问题（问题 / 为什么只有你能答 / 答完怎么改）让作者思考后自己改 — 例如口语触发词、完成判据、两条硬规则打架谁赢
- ledger 里 `by_fix_type` 一眼看到几条能直接改、几条要自己想
- 本 skill 只审不改：从不落盘，改不改 / 几轮由用户或 Harness 决定
