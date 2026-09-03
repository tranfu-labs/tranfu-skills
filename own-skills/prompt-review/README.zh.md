---
description: "当用户要求审查、优化或检查 prompt、skill、agent 定义时，检查其中 MUST 一类硬强调词并给出普通替换措辞。"
prompt_examples:
  - prompt: 帮我审一下这段 prompt，把滥用的硬强调词换掉。
    scene: 检查提示词
  - prompt: 检查 own-skills/example/SKILL.md 里的 MUST 一类用词。
    scene: 检查 Skill
---

# prompt-review 提示词审查

找出 prompt、skill 和 agent 定义里的 `MUST`、`NEVER`、`ALWAYS`、`CRITICAL`、
`REQUIRED`、“必须”、“绝不”、“始终”、“务必”等硬强调词，并在不改变原意的前提下
给出普通、直接的替换措辞。

结果列出每处的位置、原文和建议替换。
