---
name: project-scoring
display_name: AI Project Scoring
display_name_zh: AI 项目评分
description: 面向 AI 工作流点子的克制式立项审核 — 先追问 3-5 个澄清问题, 再产出一份带加权 10 维评分、硬门槛、证据台账、风险、7 天验证实验和唯一下一步的决策备忘. 用在验证、内部投资、可复用 skill 开发、公开案例开发或共创之前. 不是通用的产品待办列表排序器 (RICE / ICE / WSJF 更适合那件事).
prompt_examples:
  - prompt: "用 project-scoring 帮我审这个内部 AI 项目: <一句话点子、目标用户、当前替代方案>"
    scene: 内部 AI 项目立项审核
  - prompt: "帮我判断这个 Tranfu skill idea 是否值得小步立项: <用途、用户、证据等级>"
    scene: Tranfu 可复用 skill 立项判断
  - prompt: "对这个 demo 概念做立项审核, 信息不足先问我问题"
    scene: 公开 demo 概念立项审核
  - prompt: "用 project-scoring 评估这个商业化 AI 工作流产品: <产品名、用户、付费证据>"
    scene: 商业化 AI 产品评分
  - prompt: "比较这三个 AI 工作流候选项目并排序: <A、B、C>"
    scene: 多候选项目优先级排序
  - prompt: "点子信息很稀薄 — 先问 3-5 个澄清问题再评分, 输出低置信度评审"
    scene: 强制走澄清门的稀薄输入
---

[English](./README.md) | [中文](./README.zh.md)

# Tranfu 项目评分

Tranfu 项目评分在验证、内部投资、可复用 skill 开发、公开案例开发或共创之前, 对 AI 工作流项目做立项审核. 它像一个克制的立项面试官: 先收集核心事实, 再产出一份带加权评分、硬门槛检查、风险和唯一下一步动作的决策备忘.

## 什么时候用

当队友或 agent 需要判断一个 AI 工作流点子应该批准、验证、暂缓、否决还是重塑时使用. 适用于公司内部 AI 项目、Tranfu skill 资产、公开 demo、研究探针以及外部产品 / MVP 点子.

不要拿它当通用的产品待办列表排序器. RICE、ICE、WSJF 更适合给已经批准的功能排优先级. 本 skill 是用来判断一个 AI 工作流项目是否值得投入的.

## 期望输出

输入稀薄时, skill 返回澄清问题, 而不是假装打分. 事实足够时, 它产出一份 Markdown 决策备忘, 包含项目类型和权重档、总分、置信度、信息完整度、硬门槛检查、10 维评分表、缺失信息与证据等级、最风险假设、7 天验证实验、失败预演, 以及唯一的下一步动作. 面向 agent-to-agent 交接时, skill 返回 `references/output-schema.md` 描述的 JSON 结构.

## 本地预打分脚本

`scripts/score_project.py` 是一个只依赖 Python 标准库的确定性、保守型辅助脚本, 供本地检查和回归测试用. 它从文件或 stdin 读 JSON, 默认对稀薄输入返回 `type: clarification`, 支持 `--force-score` 做临时打分和 `--format markdown` 出可读报告, 会建立证据台账、子维度拆解, 并按上下文切换权重档. 测试用 `pytest` 跑 `tests/test_score_project.py`.

## 事实源

`SKILL.md` 覆盖调用规则、澄清门、工作流和输出策略. 框架参考文档在 `references/` 目录下 — `scoring-framework.md` 讲维度和门, `scoring-contexts.md` 讲权重档, `scoring-anchors.md` 讲分数锚点, `output-schema.md` 讲输出契约, `prompt.md` 是可复用的评估 prompt, `examples.md` 是校准过的示例.
