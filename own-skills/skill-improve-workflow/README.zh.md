---
prompt_examples:
  - prompt: 帮我提升下 own-skills/daily-report 这个 skill
    scene: 存量 skill 提升
  - prompt: 这个 skill 还够格当 skill 吗? own-skills/foo
    scene: 资格质疑
  - prompt: 合入前给 own-skills/bar 做次体检, 能改的顺手改
    scene: 合入前体检
  - prompt: 把 own-skills/ 整个目录过一遍审查
    scene: 批量目录审查
  - prompt: 帮我审一下这个 skill, 只出报告先别改文件
    scene: 只审不改
  - prompt: own-skills/xxx 写得怎么样? 值不值得重构
    scene: 重构评估
---

[English](./README.md) | [中文](./README.zh.md)

# skill-improve-workflow

把一个已有 skill 提升到合格标准: 用 skill-create-workflow 创建时的同一套门禁反向检验 (内容准入 skill-content-fit、任务域与命名 skill-domain-framing、prompt 工程质量 prompt-review A–G、结构完整性机械清单), 产出带三态裁决 (通过 / 需修改 / 建议重构) 的 `SKILL_REVIEW_REPORT`, 再把问题改到合格。审查是手段, 提升是结果——按结果命名, 与 `skill-create-workflow` (创建) 对仗。

两阶段: **审查阶段**只审不改; **审后修复阶段**里, 有确定改法的问题 (缺 Do NOT 段 / 软词该换 MUST / 命名非 kebab……) 逐条或批量征得同意后本 skill 直接改, 判断类问题 (该不该是 skill / 容器命名 / 边界取舍) 则采访用户拍板——采访开场先报总量、每轮带 `[k/N]` 进度, 不让人觉得没完没了; 弹给你的每个问题 / 选项都用大白话、不抛内部术语。换容器 / 从头重写这类大重构交回 skill-create-workflow。

架构: 主 agent 只做编排、合并与裁决, 不通读被审文件; 四门全部由 SubAgent 执行, 且分级短路——门 1 打回或门 2 判容器框错, 立即出局部报告退出; 门 3 先审 SKILL.md (3 个 reviewer 按维度 A,B / C,D / E,F,G 并发, 门 4 结构检查同波并发), SKILL.md 有 BLOCKER/HIGH 也直接退出, 其余 prompt-bearing 文件排在后一波。主 agent 合并 REVIEW_PACKET 时给每条 issue 的 id 冠上文件前缀 (提升为 `file#localid`) 去冲突, 文件内局部 id 不变保持重审可引用。

## 什么时候用它

- 想把库里某个存量 skill 提升到今天的创建门禁标准
- 收到别人写的 skill, 合入前想做一次整体体检再顺手改到合格
- 怀疑某个 skill 命名 / 边界框错了, 想拿评分说话再决定要不要重构
- 想批量审查一个目录下的所有 skill, 拿一张 per-skill 裁决表

## 怎么用 (触发示例)

跟 Claude 说:

- "帮我提升一下 own-skills/daily-report 这个 skill"
- "完善下 ~/.claude/skills/foo 的质量"
- "审一下这个 skill, 顺便能改的就改"
- "这个 skill 要不要重构?"
- "把 own-skills/ 整个过一遍审查"

## 你会看到什么

- 四道门逐一给结论: 内容准入反检 / 任务域反检 / prompt 质量 (嵌入 REVIEW_PACKET) / 结构完整性
- 机械裁决: 门 1 或门 2 挂 → 建议重构; 门 3 或门 4 有 BLOCKER/HIGH → 需修改; 否则通过
- 报告出完, 若你在场且愿意修: 确定类问题批量征你同意后直接改, 判断类问题带进度采访你拍板, 最后给一份修复小结 (改了啥 / 采访结论 / 延后项)
- 审查阶段绝不动文件; 改动只发生在修复阶段、且每处都对应一次你的同意; 大重构转交 skill-create-workflow

## 同类对比

- `prompt-review`: 单文件 / 内联 prompt 的工程质量清单, 是本 skill 的门 3; 目标不是完整 skill 目录时直接用它。
- `skill-create-workflow`: 创建侧的编排 (从零做一个新 skill)。本 skill 负责审查 + 把确定类 / 判断类问题改到合格; 只有换容器 / 从头重写这类大重构才交回它。
