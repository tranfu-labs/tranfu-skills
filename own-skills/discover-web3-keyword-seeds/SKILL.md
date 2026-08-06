---
name: discover-web3-keyword-seeds
display_name: Web3 Keyword Seed Discovery
display_name_zh: Web3 种子词发现
description: 当用户提供 Web3 机会锚点、用户任务、产品类别、竞品网址或 Search Console 查询，并要求生成或扩展英文种子词、任务词、产品词、问题词、价格词、比较词、替代词、角色词或场景词时使用。该 Skill 将机会锚点拆成用户、任务、结果与付费角色，输出结构化种子词簇、假设和后续调研交接材料；种子词不是有效关键词。Do NOT trigger when 用户已经要求查询 Semrush 或 Search Console 数据、验证搜索量和收入证据、填写关键词调研表（改用 research-web3-keywords），也不要用于普通 SEO 页面审计或最终立项审批。
version: 0.1.0
author: "06666666"
updated_at: 2026-08-06
origin: own
---

# Web3 种子词发现

把一条模糊机会线索转成可供 Semrush、Search Console 和搜索引擎验证的英文种子词簇。保持“生成假设”和“验证证据”分离。

## When to use

处理机会锚点拆解和英文种子词扩展。输入可以是一句话、用户问题、产品名称、竞品网址、真实查询或已验证产品类别。只产出搜索探针，不判断搜索需求是否成立。

## 同类 Skill 对比

> 由 tranfu-publish 起草，作者签字。帮助阅读者横向决定要装哪个或跳到更合适的同类。

### 公司库内
- [market-analysis](../../own-skills/market-analysis/SKILL.md) — 做全景市场、行业和竞争格局研究；**本 skill 区别**：只把机会锚点转成待验证种子词。
- [elite-market-researcher](../../own-skills/elite-market-researcher/SKILL.md) — 提供深度市场研究心智与决策报告；**本 skill 区别**：输出轻量、结构化的搜索探针。

### 外部世界
- [ecommerce-keyword-research](https://github.com/nexscope-ai/eCommerce-Skills/blob/56f3288dd1ba3ae7cae43d369115a915229e510b/ecommerce-keyword-research/SKILL.md) — 面向电商平台生成高转化关键词；**本 skill 区别**：覆盖全球 Web3 多种产品和服务形态。
- [etsy-keyword-research](https://github.com/nexscope-ai/eCommerce-Skills/blob/56f3288dd1ba3ae7cae43d369115a915229e510b/etsy-keyword-research/SKILL.md) — 面向 Etsy 标签、长尾词和季节趋势；**本 skill 区别**：从用户任务与付费结果开始，不绑定平台。

### 本 skill 独特价值
- 机会锚点先拆用户任务结果
- 八类英文种子词固定输出
- 明确禁止把种子词当证据

## 使用技巧

> 由 tranfu-publish 引导起草。帮助阅读者纵向上手；横向比较见上方同类 Skill 对比。

### 材料方案
- 至少提供一句机会锚点
- 竞品网址和真实查询均可选
- 默认研究全球英文市场

### 推荐用法
- 先跑本 skill，再跑调研 skill
- 输入越具体，词簇越少重复
- 多个锚点应分别生成再合并

### 已知限制
- 不提供搜索量和难度数据
- 不证明用户已经愿意付费
- 不代替关键词调研和立项

## 输入

尽量收集以下信息；缺失但不影响方向时，写明假设后继续，不要为了补齐字段而停住。

- **机会锚点**：必填。用户任务、产品类别、竞品、查询或一句机会描述。
- **目标市场**：默认全球英文。
- **已知用户、场景或结果**：可选。
- **已知竞品、网址或真实查询**：可选。
- **排除范围**：可选。

只有当机会锚点无法判断基本用户或任务，且不同解释会产生完全不同词簇时，才询问一个简短问题。

## 工作流程

### 1. 拆解机会锚点

先写出以下六项，不确定的内容标记为“假设”，不要伪装成事实：

| 项目 | 要回答的问题 |
|---|---|
| 用户 | 谁在执行或购买？ |
| 触发场景 | 什么时点或事件让需求出现？ |
| 任务 | 用户要完成什么动作？ |
| 结果 | 用户最终想获得什么结果？ |
| 成本或风险 | 当前方式为什么麻烦、慢、贵或危险？ |
| 付费角色 | 谁可能付钱，为什么付钱？ |

### 2. 生成八类英文种子词

围绕同一个用户任务生成下列词簇。优先使用用户会实际输入搜索框的自然表达，不堆砌同义词。

| 词簇 | 生成方向 |
|---|---|
| 任务词 | 完成动作，如 create、check、track、recover、convert |
| 产品词 | 用户寻找的工具、API、平台、服务或报告 |
| 问题词 | how、why、what、can I、error、failed 等问题表达 |
| 价格词 | price、cost、fee、cheap、free、quote、pricing |
| 比较词 | best、vs、compare、review、top、fastest、safest |
| 替代词 | alternative、replacement、without、manual service |
| 角色词 | developer、trader、project owner、compliance team 等 |
| 场景词 | 公链、钱包、交易所、API、企业采购或具体事件场景 |

根据机会锚点调整用词，不要求每类机械地产出相同数量。没有真实含义的组合不要生成。

### 3. 清洗和聚类

- 删除语义完全重复、只有单复数或词序差异的表达。
- 将指向同一用户问题的词放入同一主题。
- 标记可能是品牌导航词、新闻词、行情词或短期事件词的结果。
- 保留主探针词和能代表不同搜索目的的长尾词。
- 当继续扩展不再产生新用户、新任务、新结果、新场景、新产品形态或新付费角色时停止；不设置数量目标。

### 4. 检查边界

- 不填写搜索量、KD、趋势、CPC 或竞品收入，除非用户提供了可验证来源。
- 不因词听起来合理就称其为“有效关键词”。
- 不把代币名称、行情热度或融资新闻自动视为商业需求。
- 不生成与机会锚点用户任务无关的泛 Web3 热词。

## 输出格式

按以下顺序输出：

1. **机会锚点复述**：一句话。
2. **用户—任务—结果拆解**：使用六项表格，并标记假设。
3. **主题建议**：列出可能对应的关键词主题及主题边界。
4. **八类种子词簇**：每个词包含英文种子词、词簇类型、对应用户任务、搜索目的假设和生成依据。
5. **排除项**：记录被删除的泛词、新闻词、品牌导航词或不匹配词。
6. **待验证问题**：列出后续调研必须确认的搜索与商业假设。
7. **交接包**：输出给 `research-web3-keywords` 的机会锚点、主题、代表词、长尾词、假设和排除范围。

不要输出“优先、进入验证、继续观察、淘汰”等最终关键词结论。

## 交接示例

输入：`项目方需要快速检查 Solana 代币权限，避免上线后仍可增发或冻结。`

交接包应包含：

- 用户：Solana 项目方、代币发行负责人。
- 任务：检查 mint authority、freeze authority 和 metadata update authority。
- 结果：上线前确认权限状态并降低风险。
- 代表词：`solana token authority checker`、`check solana mint authority`。
- 后续验证：搜索量、Search Console 真实查询、直接竞品、收费页面和收入来源。
