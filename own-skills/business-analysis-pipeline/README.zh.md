---
prompt_examples:
  - prompt: "评估这个 AI 产品的商业可行性: <产品描述>"
    scene: 新概念评估
  - prompt: 帮我跑一份完整的商业分析报告
    scene: 全量报告
  - prompt: 两个 AI 创业方向, 用同一套体系横向对比一下
    scene: 方向对比
  - prompt: 投资尽调一下这个项目, 决策前先摸底
    scene: 投资尽调
  - prompt: PEST + 波特五力 + SWOT + BMC 一次跑齐, 各模块之间要交叉引用
    scene: 框架组合
  - prompt: 只出机会矩阵和执行摘要, 深度分析先不用
    scene: 轻量模式
---

[English](./README.md) | [中文](./README.zh.md)

# business-analysis-pipeline

一个把 AI 产品 / 创业方向放进 **7 步 pipeline + 120 分制 + KF 编号交叉引用**, 跑出结构化商业分析报告的 skill — 适合 PM / 创业者 / 投资分析师评估新方向.

## 什么时候用它

- 想给一个 AI 产品概念做**系统化商业可行性评估**, 不只是拍脑袋打分
- 需要 **PEST + 波特五力 + SWOT + BMC + 机会矩阵** 一次跑齐, 各模块发现互相按编号引用
- 想要一份能直接拿去**汇报 / 决策 / 投递**的结构化 markdown 报告 (含 S/A/B/C/D 五级评级 + 一句决策建议)
- 想横向对比**多个产品概念**, 用同一套评分体系

## 怎么触发它

跟 Claude 说:

- "评估这个 AI 产品的商业可行性: <产品描述>"
- "帮我跑一份商业分析报告"
- "出一份 AI 创业方向评估"
- "投资尽调一下这个项目"

提交时最好附上: **产品名称 / 概念描述 / 核心功能** (必填); 目标用户 / 商业模式 / 已知竞品 / 团队优势 / 目标市场 / 分析深度 (选填, 缺省时按合理默认走).

## 你会看到什么

- **7 步分模块产出**, 每步带 🟢🟡🔴 标记 + 3 条编号关键发现 — **P-KF** 对 PEST、**F-KF** 对波特五力、**S-KF** 对 SWOT、**B-KF** 对 BMC — 后续模块直接按编号引用早期发现, 不复述
- **120 分制综合评分**, 汇总到 S/A/B/C/D 五级评级 + 一句 go / hold / kill 决策建议
- **执行摘要** 400–600 字, 可直接拿去汇报
- 默认中文输出, 全程 markdown 表格 + 标记, 不输出「后续步骤建议」等冗余小节

## 相邻 skill

| 想干的事 | 交给 |
|---|---|
| 只要市场容量 / TAM-SAM-SOM / 竞争格局 | **market-analysis** / **elite-market-researcher** |
| AI 创业方向的快速可行性判断 (不跑完整 pipeline) | **ai-startup-feasibility-check** |
| 一个赛道里挖机会点 / 排序机会 | **opportunity-hunter** / **ai-opportunity-evaluation** |
| 只给单个项目打执行成熟度分 (不是商业可行性) | **project-scoring** |

**不接的场景**: 写正式的 pitch deck / 商业计划书 (那是下游文档产出); 只跑单一框架、不需要交叉引用 (用轻量 market-analysis 就够); 跟踪已上线产品的 KPI (那是运营分析, 不是可行性评估).
