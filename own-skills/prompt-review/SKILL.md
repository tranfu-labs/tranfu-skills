---
name: prompt-review
description: >
  Multi-round prompt/skill review loop. Launches a reviewer subagent that audits prompt files
  against an embedded engineering checklist, reports findings via SendMessage, and re-reviews after
  fixes until all issues are resolved. Self-contained — no network dependency.
  Always trigger for: review prompt, review skill, review agent, audit prompt, check prompt quality,
  prompt engineering review, skill review, agent review, evaluate prompt, lint prompt.
  Also triggers for: "帮我审一下这个 prompt", "检查提示词质量", "评审这个 agent 定义",
  "这个 skill 写得怎么样", "优化提示词".
  Do NOT trigger when: user wants to review CODE (not prompts), run tests, or do functional QA.
version: 0.1.0
author: aquarius-wing
updated_at: 2026-05-13
origin: own
userInvocable: true
---

# Prompt 评审循环

你是主 Agent, 负责协调一个多轮评审循环: 启动 reviewer 子 Agent 评审提示词文件, 应用修改, 再审, 直到通过.

## 同类 Skill 对比

公司库内:
- 暂无

外部:
- [audit-prompt](https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/tools/audit-prompt.md) — 评估整个 Claude Code 配置 (memory/rules/skills/security 8 维) 给百分制评分; **本 skill 区别**: 对象是单个 prompt/skill/agent **文件**, 不是用户配置, 输出是逐行可改建议而非分数
- [anthropics/skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md) — 创建 / 改进 skill (draft → 跑 eval → 迭代); **本 skill 区别**: 不创建只评审, 不跑 eval 只查清单, 嵌入 8 维工程化规则 (硬约束措辞 / 正反示例 / 反向引导 / 量化标准 / 工具映射 / Frontmatter / 风格 / 失败路径) 离线可跑

独特价值:
- reviewer 子 Agent 跑 sonnet 异步 SendMessage 回报, 省主会话 token
- 每条建议 MUST 映射 A-H 清单某一维, 映射不上即删, 防吹毛求疵
- fix→re-review 循环 ≤5 轮, 触上限暂停问用户, 不硬过

## 使用技巧

### 材料方案
- 评审清单嵌入 8 维 (A-H), 每条建议 MUST 映射到某一维; 映射不上即删, 防吹毛求疵
- reviewer 子 Agent 通过 SendMessage 异步回报, 不直接输出文本结论 — 避免主 Agent 把中间评审当最终结果

### 推荐用法
- 首次跑建议拿单个 SKILL.md / agent.md 起步, 不要一上来扔整个目录
- reviewer 用 sonnet 跑 (`model: sonnet`), 节省成本

### 已知限制
- 循环 ≤5 轮; 超过未通过 MUST 暂停问用户, 不自行硬过
- reviewer 子 Agent 需能读到目标文件路径; 内联 prompt 文本时需先存成临时文件

## 流程

### 第一步: 确认评审目标

如果用户没有指定文件路径, MUST 询问用户要评审哪些文件. 支持的输入:
- 单个文件路径: `agents/evaluator.md`
- 目录路径: `agents/reference/` (评审目录下所有 .md 文件)
- 内联 prompt 文本 (用户直接粘贴)

### 第二步: 启动 reviewer 子 Agent

用 Agent 工具启动后台子 Agent. 启动前 MUST 把下方 prompt 中的 `{TARGET_FILES}` 替换为实际文件路径列表 (一行一个), 否则子 Agent 会报错.

**子 Agent prompt (整段传入):**

````
你是提示词评审 Agent, 按以下流程循环工作.

## 第一步: 内化评审清单

下方是本次评审的全部依据. 按这 8 个维度检查目标文件. 每条建议 MUST 能映射到清单某条规则; 映射不上就别提.

### A. 硬约束措辞 (Rule Force)

- 关键禁令是否用 `NEVER` / `MUST` / `IMPORTANT:` / `CRITICAL:` 全大写? 模型对全大写指令词遵从率显著更高.
- 软词 (应该 / 尽量 / 合理 / 适当) 等同没说, 出现在硬约束位置即不合格.
- 红线后是否留 "unless explicitly requested" 之类的逃逸条件? 避免死板, 但逃逸条件 MUST 明确指明触发方.

### B. 正反示例 (Examples)

- 关键行为是否用 `<example>` 标签演示**完整可执行**内容, 而非文字描述?
- 高频踩坑点是否有 `<bad-example>` 配对? bad-example MUST 标注 `WRONG` 和具体原因, 防止模型模仿.
- 经验比例: 反向约束:正向引导 ≈ 4:6. 全是正面描述通常不够.

### C. 反向引导 (Do NOT)

- 工具 / skill 描述是否说了"什么时候**不该**用"? 仅写正面用法易被滥用.
- 经典范例: Bash 工具描述里写 "Avoid using this tool to run grep, cat, find — use Grep, Read, Glob instead", 在工具自己的 prompt 里反向引导到专用工具.
- skill frontmatter 是否含 `Do NOT trigger when ...` / `Do NOT use when ...` 排除条件?

### D. 量化通过标准 (Verifiability)

- 任何"成功 / 完成 / 通过 / 充分"是否有**可机检**的具体定义? (字数阈值 / 文件存在 / 命令退出码 / 字段必填)
- 模糊词黑名单: 应该 / 合理 / 适当 / 良好 / 充分 / 大致 / 尽可能 — 出现在通过标准位置即扣.
- 例: "测试通过" → "`pnpm test` 退出码 0 且 stdout 含 `passed`"; "文档完整" → "frontmatter 含 name/description/version 三字段".

### E. 工具映射精确 (Tool Routing)

- 是否明确 "用 X 不要用 Y" 的精确映射? (例: Glob NOT find, Grep NOT grep, Read NOT cat/head/tail, Edit NOT sed/awk, Write NOT `echo > file`)
- 引用的工具名 / 参数名 / 字段名 MUST 与实际 schema 对得上, 无拼写错, 无臆造字段.

### F. Frontmatter 设计 (skill / agent 文件适用)

- `name`: kebab-case 唯一标识, 与目录名一致.
- `description` / `whenToUse`: 是否含 ① 触发关键词列表 ② 口语化表达 ③ 明确排除条件三要素? 通常 100-300 字; <50 字几乎一定不够.
  - 写法范本: "Always trigger for: A, B, C. Also triggers for casual phrasing: '...'. Do NOT trigger when ..."
  - 用 "even if they don't use the word X" 防止模型在用户没说术语时跳过.
- `allowedTools`: 是否最小权限白名单? 避免给完整 Bash; 应写到子命令粒度如 `Bash(git add:*)`.
- 大型 / 长任务 skill 是否设 `context: fork`? 否则会消耗主会话上下文窗口.
- `userInvocable`: 与 skill 用法匹配? (用户会用 `/name` 直调的设 true)

### G. 措辞风格一致性 (Cross-File Consistency)

- 同 skill / 同 repo 内多文件: 硬约束词 (统一 NEVER 还是 MUST?) / 示例标签 (`<example>` 还是 `<good>`?) / 术语命名是否一致?
- 不一致削弱权威性, 模型对混用风格的遵从率下降.

### H. 失败路径 (Resilience)

- 关键步骤是否预设 fallback? (重试 / 降级 / 报错给用户 / 调用其他工具)
- 含循环的流程 MUST 设上限 (例如 "最多 5 轮"), 且写明上限触发后怎么办 (暂停问用户 / 直接结束 / 转人工).
- "永远假设每一步都可能失败, 预设恢复路径." — 模型不会主动设计失败分支, 必须显式写出.

---

## 第二步: 读取并评审目标文件

读取以下文件并逐一对照清单 8 维度:

{TARGET_FILES}

对每个文件按 A → H 顺序扫一遍, 记录命中条目. 不要为了凑数提建议; 没问题就明说没问题.

## 第三步: 报告评审结果

CRITICAL: NEVER 直接输出文本结论. MUST 通过 SendMessage 将评审结果发送给 team-lead.

**评审结果格式:**
- 有问题: 每条 `[文件名:行号或锚点] 命中维度X → 问题描述 → 具体改法`
  - 例: `[evaluator.md:42] 命中 D → "评估通过"无量化标准 → 改为 "evaluator 输出 JSON 含 passed: true"`
- 无问题: 发送 `评审通过, 无进一步建议`
- NEVER 吹毛求疵; 若一条建议无法映射到 A-H 任一维度, 删掉.

## 第四步: 等待反馈并决定下一步

发送评审结果后, 等待 team-lead 回复:
- 收到 `已修复, 请再审` → 重新读取所有目标文件, 回到第二步
- 收到 `评审结束` → 输出最终总结文本并结束

IMPORTANT: 在收到明确的结束指令前, NEVER 输出最终文本结论. 保持循环等待状态.
````

**启动参数:**
- `run_in_background: true`
- `name: "reviewer"`
- `model: sonnet` (评审用 sonnet 即可, 节省成本)

### 第三步: 接收评审结果并应用修改

收到 reviewer 的 SendMessage 后:

1. 如果是 `评审通过, 无进一步建议` → 用 SendMessage 回复 `评审结束`, 循环结束.
2. 如果有具体建议 → 逐条应用修改到文件中, 修改完成后用 SendMessage 回复 `已修复, 请再审`.

### 第四步: 循环

重复第三步, 直到 reviewer 报告"评审通过".

## 约束

- NEVER 跳过 reviewer 的建议不处理. 如果某条建议不合理, MUST 在 SendMessage 中说明理由 (例: "此建议未映射到清单 A-H 任一维度, 视为吹毛求疵, 不采纳").
- NEVER 在 reviewer 未确认通过前就告诉用户"已完成".
- 如果循环超过 5 轮仍未通过, MUST 暂停并询问用户是否继续, 不得自行决定中止或硬过.
