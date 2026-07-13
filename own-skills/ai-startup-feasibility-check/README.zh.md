---
prompt_examples:
  - prompt: "帮我评估一下'用 AI Agent 做中小企业客服'这个方向能不能做"
    scene: 评估创业想法
  - prompt: "AI 视频生成这个赛道值得进入吗，做一下可行性自检"
    scene: 判断 AI 赛道
  - prompt: "用 13 条 AI 创业禁止清单评估我这个项目"
    scene: 排查高风险项
  - prompt: "分析一下 Jasper 这类 AI 写作工具的结构性死亡风险"
    scene: 分析现有公司
  - prompt: "做一份 AI Coding 赛道的市场研报，附带可行性自检"
    scene: 配合市场研究
  - prompt: "帮我用替代风险/杠杆方向/单位经济给这个 AI 项目打分"
    scene: 评估关键风险
---

[English](./README.md) | [中文](./README.zh.md)

# ai-startup-feasibility-check

用 13 条 AI 创业禁止清单 + 三维评分（替代风险 / 杠杆方向 / 单位经济）+ 10 题自检表，对 AI 创业方向做结构化可行性筛查，输出红 / 黄 / 绿灯诊断报告。

## 什么时候用它

- 评估一个 AI 创业方向是否值得启动
- 判断一个 AI 项目的结构性死亡风险
- 与 elite-market-researcher / market-analysis 配合，给研报加"可行性自检"附录

## 你会看到什么

一份 4 模块结构化诊断报告：禁止清单命中检查（13 条逐条对照）→ 三维评分（替代风险 / 杠杆方向 / 单位经济，±2 打分）→ 10 题自检表 → 综合判定与建议（含事前验尸）。附带红 / 黄 / 绿灯结论和可执行的下一步动作。

## 同类 Skill 对比

> 由 tranfu-publish 起草, 作者签字. 帮助阅读者横向决定要装哪个 / 跳到更合适的同类.

### 公司库内

- [elite-market-researcher](../own-skills/elite-market-researcher/SKILL.md) — 复合研究员心智做深度赛道研究; **本 skill 区别**: ai-startup-feasibility-check 专注 AI 创业方向的结构性死亡风险筛查（禁止清单 + 三维评分），不做全景市场研究，两者设计为配合使用
- [business-analysis-pipeline](../own-skills/business-analysis-pipeline/SKILL.md) — 7 步 pipeline 出 120 分制商业可行性报告; **本 skill 区别**: 本 skill 聚焦 AI 特有的平台风险（模型替代 / 杠杆方向 / 单一 API 依赖），business-analysis-pipeline 做通用商业分析
- [market-analysis](../own-skills/market-analysis/SKILL.md) — 12 维度并行搜索做全景市场分析; **本 skill 区别**: market-analysis 负责搜索和报告结构，本 skill 负责对搜索结果做 AI 创业可行性判定

### 外部世界

- [/validate (e2larsen)](https://medium.com/@e2larsen/i-built-a-claude-skill-to-validate-startup-ideas-then-i-used-it-on-my-own-project-53d79656b738) — 搜索 Reddit / App Store / Google Trends 验证创业想法; **本 skill 区别**: 本 skill 不做数据搜索验证，而是用 AI 创业禁止清单做结构性死亡风险筛查

### 本 skill 独特价值

- 13 条 AI 创业禁止清单（Tier 1/2/3 分级）+ 三维评分体系
- 内置 6 个典型案例对照（反面: UUMit / Jasper / You.com，正面: Cursor / Mercor / LangSmith）
- 与 elite-market-researcher / market-analysis 组成 AI 赛道研究三件套

## 使用技巧

> 由 tranfu-publish 引导起草. 帮助阅读者纵向上手.

### 材料准备

- 准备好待评估的 AI 项目 / 方向描述（越具体越好：做什么、卖给谁、怎么收费）
- 如有 elite-market-researcher 和 market-analysis 先装好，可组合使用
- 先跑 market-analysis 做市场搜索，再用本 skill 做可行性判定效果最佳

### 推荐用法

- 给明确的项目描述（如"用 AI Agent 做中小企业客服"），不要只给赛道名
- 重点看"禁止清单命中"和"三维评分"两个模块
- 对照 references/ 下的案例库找最相似的反面 / 正面案例

### 已知限制

- 禁止清单聚焦 AI 创业方向，非 AI 项目不适用
- 不做实时数据搜索，依赖用户提供或其他 skill 搜索的信息
- 案例库以 2024-2026 年为主，需定期更新
