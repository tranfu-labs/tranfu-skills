---
name: true-goal-r1
type: ground truth (downstream 全部 anchor 在此)
created: 2026-05-28
---

# True Goal — r1

## Step 1.b 结果
**Skip proposal (no signal)** — 用户的字面表达 ("重点不是文章本身，而是前置准备——文章风格、形式、系列文章或者说目录") 已经把交付物锁得很死，AI 无强信号建议更深一层重读。`00-true-goal-r1.md = user_goal_surface.md verbatim`。

## 最终 goal (downstream anchor)

写一个**系列文章**，让一类**工作 5 年左右、非计算机行业**的从业者，从 **0 → 会用 skill → 能发布自己的 skill**。

当前阶段不写正文，先把**前置准备**做对：
- 文章风格 (style)
- 单篇形式 (form/template)
- 系列结构/目录 (TOC)

## 用户给的关键约束 (verbatim 标注)
- **目标读者特征** (用户原话): "流程普通人都能听得懂，而且他的流程也可以很好的AI化的，有较多繁琐的智力化的操作"
  → 不限定行业,而是限定一类**工作流特征**: 流程可被外行听懂 + 流程可 AI 化 + 工作里有较多繁琐的智力化操作
  → 典型职业候选: 律师 / 财务 / 编辑 / 译者 / 咨询顾问 / 教师 / 营销 / 投研 / 法务 / 招聘
- **单篇长度硬约束**: ≤ 4500 字, ~10 分钟阅读
- **平台**: 只考虑一篇,不需要多端

## surface vs true 差异 (用于 Step 3.5 surface-mirror check)
两者基本等同。surface-mirror failure 风险点:
- 如果产出物变成"教如何编程"或"教如何用 Claude Code 命令行底层"而非"教如何用 skill 解决你的工作流程", 即偏离 surface
- 如果系列变成面向开发者/工程师, 即偏离 surface
