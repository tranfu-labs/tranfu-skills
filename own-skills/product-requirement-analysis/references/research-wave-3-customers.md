# Wave 3: Customer & Demand

开始前先读 `research-principles.md`。Wave 3 继承 Wave 2 的竞品发现。

Wave 3 的目标是回答：

- 用户是否真的在表达这个问题
- 他们是怎么描述这个问题的
- 这个需求是否有足够强度和支付意愿
- 第一批值得抓的目标用户是谁

本 wave 只负责产出 raw research，不直接写综合结论、推荐范围或最终建议。

---

## Research Block C1: Customer Voice & Pain Points

研究任务：抓取真实用户对该问题和现有方案的表达。

### 推荐搜索路径

ROUND 1：Reddit / 社区

- `site:reddit.com {problem keywords}`
- `site:reddit.com {industry} frustration`
- `site:reddit.com {existing solution} complaints`

ROUND 2：专业论坛

- `site:news.ycombinator.com {problem keywords}`
- `{problem} forum discussion`
- `{industry} community {problem}`

ROUND 3：评论区挖掘

- `{existing solution} reviews`
- 重点看 1-3 星评论和吐槽帖

ROUND 4：社媒情绪

- `site:twitter.com {problem keywords}`
- `{problem} rant`

### 输出内容

- Top verbatim quotes
- Pain categories
- Jobs-to-be-done
- Language map
- Unmet needs
- Data gaps

保存到：

- `01-discovery/raw/customer-voice.md`

---

## Research Block C2: Demand Signals & Willingness to Pay

研究任务：通过需求信号和定价信息判断这个需求的强弱与付费可能。

### 推荐搜索路径

ROUND 1：搜索需求

- Google Trends / 关键词趋势
- `{product category} search volume`
- `{problem} solution keywords`

ROUND 2：产品发布信号

- Product Hunt
- Indie Hackers
- beta / pre-launch 页面

ROUND 3：定价情报

- 访问竞品 pricing pages
- `{product category} pricing comparison {current year}`
- `{customer type} software budget survey`

ROUND 4：支付意愿

- `{product category} willingness to pay`
- `{problem} worth paying for`
- 论坛中对价格的讨论

### 输出内容

- Search demand
- Product launch signals
- Pricing landscape
- WTP assessment
- Market validation score
- Data gaps

保存到：

- `01-discovery/raw/demand-signals.md`

---

## Research Block C3: Target Audience Profiling

研究任务：把目标用户从抽象描述变成可用画像。

### 推荐搜索路径

ROUND 1：人口 / 公司特征

- `{customer type} demographics statistics`
- `how many {customer type} in {geography}`
- `{customer type} company size distribution`

ROUND 2：行为模式

- `{customer type} software adoption habits`
- `{customer type} buying process for {product category}`
- `how do {customer type} discover new tools`

ROUND 3：工作流与日常场景

- `{role} daily challenges`
- `{role} workflow {industry}`

ROUND 4：决策链条

- `{product category} buying criteria`
- `who decides on {product category} at {company type}`

### 输出内容

- Primary persona
- Secondary persona
- Anti-persona
- Buying behavior
- Where to reach them
- Data gaps

保存到：

- `01-discovery/raw/target-audience.md`
