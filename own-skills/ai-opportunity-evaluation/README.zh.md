---
name: ai-opportunity-evaluation
display_name: AI Opportunity Evaluation
display_name_zh: AI 机会立项判断
description: 在 TranFu 团队进入 PRD 或开发前，对一句话产品想法做立项会诊，短问 2-3 轮后输出一屏以内的立项判断卡（建议做 / 优化后再做 / 暂不建议做）。
prompt_examples:
  - prompt: "判断这个项目怎么样：微信公众号排版工具"
    scene: 评估产品想法
  - prompt: "帮我做个立项判断：个人注意力看板"
    scene: 审核内部工具
  - prompt: "这个方向能不能做：AI 情报订阅平台"
    scene: 判断新方向
---

# AI 机会立项判断

在 PRD 或开发前给一句话想法做立项会诊，短问 2-3 轮后输出一屏以内的判断卡，避免一句话想法直接变成低质 Demo。

## 什么时候用它

- 团队成员只有一个产品名或一句话想法，需要判断值不值得做。
- 内部工具准备进入 PRD 或开发前，需要确认真实问题和验证目标。
- 想判断一个项目能否沉淀成 TranFu 的 Skill、Agent、SOP、官网产品或对外案例。

## 同类 Skill 对比

> 由 tranfu-publish 起草, 作者 / 推荐者签字. 帮助阅读者横向决定要装哪个 / 跳到更合适的同类.

### 公司库内

- [project-scoring](../project-scoring/SKILL.md) — 对 AI 工作流项目做量化评分和决策 memo；**本 skill 区别**: 先做一屏以内的立项门禁，不输出复杂分数。
- [ai-startup-feasibility-check](../ai-startup-feasibility-check/SKILL.md) — 对 AI 创业方向做可行性自检；**本 skill 区别**: 聚焦 TranFu 内部产品立项、能力验证和品牌风险。
- [strategy-first-development](../strategy-first-development/SKILL.md) — 开发前确定战略、产品形态和技术方案；**本 skill 区别**: 在技术规划之前先判断项目是否值得进入 PRD。

### 外部世界

- 暂无

### 本 skill 独特价值

- 第二阶段立项门禁。
- 一屏以内判断卡。
- 能否沉淀 TranFu 能力。

## 使用技巧

> 由 tranfu-publish 引导起草 (作者 / 推荐者答, AI 整合, 推荐者签字).
> 帮助阅读者纵向上手 — tacit knowledge 在此. 横向同类对比见上方 §同类 Skill 对比.

### 材料方案

- 先给项目名和一句话想法。
- 补充谁会用、现在怎么解决。
- 说明验证流程、Skill 或 SOP。

### 推荐用法

- 一次只判断一个项目想法。
- 接受 2-3 个短追问。
- 通过立项后再进 PRD。

### 已知限制

- 不替代商业尽调或投资评估。
- 不直接生成 PRD 或开发方案。
- 信息太少时置信度较低。

## 你会看到什么

- 明确结论：建议做、优化后再做、暂不建议做。
- 一张短卡片：核心理由、真实问题、验证目标、首版范围、风险提醒和下一步。
