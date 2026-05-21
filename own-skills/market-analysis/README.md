# market-analysis
通过 12 维度并行搜索（赛道规模/拐点/TAM/机会信号/竞争格局/用户痛点/投融资/政策），输出含非对称机会矩阵和脆弱性审计的全景市场分析报告。

## 什么时候用它
- 要对一个市场/行业/赛道做系统性分析
- 需要多维度搜索覆盖（规模、竞争、用户、资本、政策）
- 做竞争格局分析、机会点挖掘、TAM/SAM/SOM 测算

## 怎么用 (触发示例)
跟 Claude 说:
- "分析 AI 客服市场"
- "帮我做 XX 行业市场调研"
- "竞争格局分析：在线教育赛道"
- "market analysis for XX"

## 你会看到什么
一份 8 章结构化报告：执行摘要 → 赛道全景（含拐点信号+TAM/SAM/SOM+非对称机会矩阵）→ 竞争格局（含量化五力+竞品价值链拆解）→ 用户需求洞察（含 Top 5 痛点+蓝海需求）→ 投融资与政策 → 机会洞察（3-5 个具体机会含 MVP 路径）→ 脆弱性审计 → 战略建议。每个关键数据标注来源和时间。

## 同类 Skill 对比

> 由 tranfu-publish 起草, 作者签字. 帮助阅读者横向决定要装哪个 / 跳到更合适的同类.

### 公司库内
- [elite-market-researcher](../own-skills/elite-market-researcher/SKILL.md) — 复合研究员心智做深度赛道研究，输出含反共识洞察的研究报告; **本 skill 区别**: market-analysis 专注搜索流程和报告结构（12 维度并行搜索+AI 原生分析框架），elite-market-researcher 专注研究心智（角色加载+反共识思维+质量闸门），两者设计为配合使用
- [business-analysis-pipeline](../own-skills/business-analysis-pipeline/SKILL.md) — AI 产品商业可行性评估，走 PEST→五力→SWOT→BMC 7 步 pipeline 出 120 分制报告; **本 skill 区别**: market-analysis 覆盖全景市场分析（12 维度搜索+用户舆情+投融资），不做财务建模和可行性打分

### 外部世界
- [competitive-analyst (VoltAgent)](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/10-research-analysis/competitive-analyst.md) — 竞品情报收集与 SWOT 分析; **本 skill 区别**: 本 skill 覆盖完整市场分析（赛道+竞争+用户+资本+政策 5 大模块），不仅限竞品对比

### 本 skill 独特价值
- 12 维度并行搜索覆盖赛道/竞争/用户/资本/政策
- AI 原生分析框架（非对称机会矩阵+量化五力+痛点转化链）
- 与 elite-market-researcher 互补：搜索流程 vs 研究心智

## 使用技巧

> 由 tranfu-publish 引导起草. 帮助阅读者纵向上手.

### 材料方案
- 准备好目标市场/行业关键词和地域范围
- 如有 elite-market-researcher skill 先装好，可获得反共识洞察和质量闸门加持
- 给具体市场名称（如"AI 客服 SaaS"）比泛词（如"AI 市场"）效果好

### 推荐用法
- 第一次跑给明确市场名 + 默认标准深度即可
- 说"快速看看"切 6-8 次搜索精简版，说"深入研究"切 20+ 次搜索完整版
- 重点看"非对称机会矩阵"和"脆弱性审计"两章

### 已知限制
- 依赖 web search 获取实时数据，离线环境效果打折
- 完整报告输出较长（2000+ 字），短对话场景不适合
- 搜索词模板以中文市场为主，纯英文市场需微调关键词
