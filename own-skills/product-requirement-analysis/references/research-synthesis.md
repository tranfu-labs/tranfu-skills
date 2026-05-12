# Research Synthesis Protocol

在所有 waves 完成后，再开始综合。综合的价值不在于复制信息，而在于把研究转成可讨论、可裁决的判断材料。

## 一、综合总原则

1. 先读完 `01-discovery/raw/` 下所有 raw 文件，再开始写任何综合文件
2. 如果存在 `01-discovery/research-briefing.md`，先读它，再开始综合
3. 先形成分析型报告，再形成决策型报告，不要一边总结一边偷跑到最终建议
4. 每个主要判断都要区分 `事实 / 推断 / 假设`
5. 每个关键结论都要给 High / Medium / Low confidence
6. 发现矛盾时不要强行抹平，应显式写出冲突来源和当前取舍
7. 保留 Data Gaps，不要因为进入综合阶段就把缺口写丢
8. 推荐范围必须由研究推导出来，不能只是把 intake 里的选项重新包装

## 二、综合分两层

### 第一层：分析型报告

这一层回答“研究分别看到了什么”。

必须输出：

- `01-discovery/market-analysis.md`
- `01-discovery/competitor-landscape.md`
- `01-discovery/target-audience.md`
- `01-discovery/demand-validation.md`
- `01-discovery/distribution-activation.md`

### 第二层：决策型报告

这一层回答“为什么最后应该这样判断”。

必须输出：

- `01-discovery/problem-definition.md`
- `01-discovery/decision-drivers.md`
- `01-discovery/scope-options.md`
- `01-discovery/recommended-scope.md`
- `01-discovery/confidence-dashboard.md`

## 三、分析型报告要求

### `01-discovery/market-analysis.md`

来源：

- `raw/market-size.md`
- `raw/trends.md`
- `raw/regulatory.md`

建议结构：

- Executive summary
- Market / problem size
- Growth trajectory
- Market maturity
- Timing assessment
- Constraint summary
- Strategic connections
- Data gaps

### `01-discovery/competitor-landscape.md`

来源：

- `raw/direct-competitors.md`
- `raw/indirect-competitors.md`
- `raw/competitor-gtm.md`

建议结构：

- Competitive overview
- Competitor comparison matrix
- Positioning map
- GTM summary
- Platform risk
- Switching cost analysis
- Strategic recommendations
- Vulnerability analysis
- Data gaps

### `01-discovery/target-audience.md`

来源：

- `raw/customer-voice.md`
- `raw/target-audience.md`

建议结构：

- Primary persona
- Secondary persona
- Anti-persona
- Customer pain hierarchy
- Jobs-to-be-done
- Language map
- Buying behavior
- Reach channels
- Data gaps

### `01-discovery/demand-validation.md`

来源：

- `raw/demand-signals.md`
- `raw/customer-voice.md`
- `raw/target-audience.md`

建议结构：

- Search demand
- WTP evidence
- Pricing landscape summary
- Demand validation score
- Requirement strength assessment
- Critical unknowns
- Data gaps

### `01-discovery/distribution-activation.md`

来源：

- `raw/distribution-channels.md`
- `raw/activation-risks.md`

建议结构：

- Primary channels
- Channel opportunity ranking
- Activation requirements
- Cold-start risks
- Key activation metrics
- Distribution feasibility assessment
- Data gaps

## 四、决策型报告要求

### `01-discovery/problem-definition.md`

目的：把这次研究真正要回答的问题重新定义清楚，而不是重复用户原始描述。

必须包含：

- 原始需求是怎么说的
- 研究后确认的真实问题是什么
- 当前不应误解成什么
- 需求成立依赖哪些前提
- 如果这个问题成立，将影响哪些后续决策
- 当前最关键的 unknowns

### `01-discovery/decision-drivers.md`

目的：沉淀这次判断最关键的决策因子，明确后面到底按什么裁决。

必须包含：

- 3-6 个最关键的 decision drivers
- 每个 driver 为什么重要
- 每个 driver 当前证据强度如何
- 每个 driver 对推荐范围的影响方向

常见 drivers 例如：

- 痛点强度与频率
- 替代方案不足程度
- 迁移意愿 / 付费意愿
- 竞争拥挤度与切口空间
- 分发与冷启动可行性
- 合规 / 平台 / 供给限制

### `01-discovery/scope-options.md`

目的：先列出几个可行范围，再比较，而不是直接给唯一答案。

硬约束：

- 至少给出 3 个 scope options
- 其中至少 1 个必须比用户原始想法更收窄
- 如果研究指向不成立，允许 1 个 option 是“暂停 / 不做 / 只做验证不做产品”

每个 option 必须包含：

- Option name
- Scope description
- Target user
- Core scenario
- Why this option is attractive
- Why this option is risky
- Supporting evidence
- Confidence

### `01-discovery/recommended-scope.md`

目的：从多个 options 里选出当前最值得继续的一个，并解释原因。

这是最关键的决策文件，不能写成 intake 复述。

必须包含：

- Recommended scope
- Why this scope wins now
- Which decision drivers support it
- 它依赖了哪些研究文件的哪些关键发现
- 至少 2 个被放弃或暂缓的 alternatives
- 每个 alternative 为什么被放弃、缺的是什么、未来什么条件下可能重启
- 如果当前 recommendation 错了，最可能错在哪个判断

### `01-discovery/confidence-dashboard.md`

来源：

- 所有 raw 文件
- 所有分析型报告
- 所有决策型报告

建议结构：

- Overview
- Claim-level confidence table
- Highest confidence findings
- Lowest confidence findings
- Critical unknowns
- Verification priorities

## 五、跨文件连接要求

每份综合文件最后都建议加入 `Strategic Connections`，至少连接 2 个其他文件的关键发现。

尤其要关注：

- 市场趋势如何影响竞争格局
- 用户语言如何影响问题定义
- 需求强度如何影响 scope options 的排序
- 分发渠道与冷启动风险如何影响最终推荐范围

## 六、推荐范围的硬规则

`recommended-scope.md` 不得直接从以下信息原样长出来：

- intake 选项
- 用户一句口头偏好
- 单一文件里的单点判断

它必须满足：

1. 至少引用 3 份 discovery deliverables
2. 至少经过 3 个 scope options 的比较
3. 至少解释 2 个 alternatives 为什么当前不推荐
4. 明确写出 recommendation 依赖的关键假设

如果以上条件不满足，不应输出“明确推荐范围”，而应输出“待补证据后的暂定范围”。

## 七、综合后的下一步

综合完成后，必须进入 verification，而不是直接下最终结论。

## 八、最终结论的引用要求

在 `requirement-conclusion.md` 中，至少要显式引用以下文件各 1 个关键发现：

- `market-analysis.md`
- `competitor-landscape.md`
- `target-audience.md`
- `demand-validation.md`
- `distribution-activation.md`
- `problem-definition.md`
- `decision-drivers.md`
- `scope-options.md`
- `recommended-scope.md`
