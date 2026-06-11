# prompt-review

提示词 / skill / agent 工程化评审清单. 按 SKILL.md 内的 A-F 检查项（每条带严重级别）本地审目标文件. 输出 `REVIEW_PACKET`：每个 issue 带 severity、命中的检查项、行锚点、evidence、具体改法、acceptance test，外加一个 ledger. 是否落盘修改、是否多轮重审由调用方 / Harness 决定.

## 什么时候用它

- 写完一个 skill / agent / prompt 文件, 想拿到工程化的逐条改进建议
- 评审现有 prompt 库, 检查"应该 / 尽量"等软词、缺量化通过标准、缺反向引导等常见硬伤
- 评审较长或多文件的 skill / agent, 按 A-F 逐维度过一遍
- 不靠网络 — 详细清单就在 SKILL.md 内, 自包含, 离线可跑

## 怎么用 (触发示例)

跟 Claude 说:
- "帮我审一下这个 prompt: agents/evaluator.md"
- "review skill ~/.claude/skills/foo/SKILL.md"
- "评审这个 agent 定义, 检查提示词质量"

或直接粘贴一段 prompt 文本让它审.

## 你会看到什么

- 本地按 A-F 逐条审，命中即记一条 issue
- 评审结果以 `REVIEW_PACKET` 结构化回报，每个问题映射到一个 A-F 检查项并带严重级别
- 本 skill 只审不改：给出建议改法但从不落盘，改不改 / 几轮由用户或 Harness 决定
