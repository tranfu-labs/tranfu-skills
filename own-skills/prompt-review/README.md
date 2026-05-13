# prompt-review

多轮提示词 / skill / agent 评审循环. 启动一个 reviewer 子 Agent 按嵌入的 8 维度清单审目标文件 (硬约束措辞 / 正反示例 / 反向引导 / 量化标准 / 工具映射 / Frontmatter / 风格一致性 / 失败路径), 通过 SendMessage 回报问题, 主 Agent 应用修改后再审, 直到通过.

## 什么时候用它

- 写完一个 skill / agent / prompt 文件, 想拿到工程化的逐条改进建议
- 评审现有 prompt 库, 检查"应该 / 尽量"等软词、缺量化通过标准、缺反向引导等常见硬伤
- 不靠网络 — 评审清单已嵌入 prompt, 离线可跑

## 怎么用 (触发示例)

跟 Claude 说:
- "帮我审一下这个 prompt: agents/evaluator.md"
- "review skill ~/.claude/skills/foo/SKILL.md"
- "评审这个 agent 定义, 检查提示词质量"

或直接粘贴一段 prompt 文本让它审.

## 你会看到什么

- 后台启动名为 `reviewer` 的子 Agent (sonnet, 节省成本)
- 评审结果以 `[文件名:行号] 命中维度X → 问题 → 改法` 格式逐条回报
- 主 Agent 应用修改后回 `已修复, 请再审`, 循环直到 reviewer 报 `评审通过`
- 循环上限 5 轮, 超过会暂停问用户是否继续, 不硬过
