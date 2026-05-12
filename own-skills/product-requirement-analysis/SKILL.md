---
name: product-requirement-analysis
description: 对模糊产品想法或新功能机会做分阶段需求验证，产出调研、竞品、用户声音、综合结论、校验、压力测试和下一步建议。
version: 0.1.0
author: superiorkabu-Slerf
updated_at: 2026-05-12
origin: own
---

# Product Requirement Analysis

这是一份“需求验证”skill，不是 PRD 生成器，也不是实现方案设计器。

目标是把一个模糊的产品需求、方向设想或新功能机会，转化成一组基于证据的判断：

- 需求是否真实存在
- 谁最痛、在哪个场景最痛
- 现有替代方案是否足够差
- 市场和竞争格局是否支持切入
- 当前最大的风险和关键假设是什么
- 下一步最值得做的验证动作是什么

它默认输出多份研究文件，再基于这些文件给出最终结论，而不是一边搜索一边即时下结论。

## 何时使用

在以下场景触发：

- 用户只有一个初步产品想法，想判断值不值得做
- 用户有一个新需求 / 新功能方向，想评估用户价值、市场空间和优先级
- 用户想比较多个方向，收敛到最值得验证的一条
- 用户需要一份比普通头脑风暴更严谨的需求研究材料
- 用户明确需要“调研 + 结论 + 找茬 + 优化”的完整链路

不适用于：

- 已经明确要实现，只需要写 PRD 或验收标准
- 纯交互细节优化、文案润色或视觉设计讨论
- 主要问题是技术架构或工程方案而非需求成立性

## 同类 Skill 对比

> 由 publish-skill 起草, 推荐者签字. 帮助阅读者横向决定要装哪个 / 跳到更合适的同类.

### 公司库内
- [write-spec](../write-spec/SKILL.md) — 从模糊想法或功能需求生成结构化 PRD/feature spec; **本 skill 区别**: product-requirement-analysis 先判断需求是否真实、是否值得投入，再决定是否进入 PRD 阶段
- [openspec](../../external-skills/openspec/SKILL.md) — 用 propose→apply→archive 管理项目变更规范并沉淀长期 specs; **本 skill 区别**: product-requirement-analysis 聚焦需求验证和市场/用户证据，不管理代码变更生命周期

### 外部世界
- 暂无

### 本 skill 独特价值
- 先验证是否值得做
- 分波次沉淀原始研究
- 结论前有校验和压力测试

## 使用技巧

> 由 publish-skill 引导起草 (作者/推荐者答, AI 整合, 推荐者签字).
> 帮助阅读者纵向上手 — tacit knowledge 在此. 横向同类对比见上方 §同类 Skill 对比.

### 材料方案
- 按对话侧重点拆阶段
- 每阶段产出独立文件
- 先研究沉淀, 再综合判断

### 推荐用法
- 先按 SKILL.md 的 Intake 问题收集输入
- 优先给目标用户、场景、替代方案
- 有访谈、数据、竞品线索就一并提供

### 已知限制
- 已确定开发时改用 PRD 类 skill
- 不处理纯 UI、文案或技术方案
- 无搜索时需降置信度并标数据缺口

## 核心原则

- 先收窄分析对象，再进入调研
- 先帮助用户理解“为什么问这些问题”，再开始追问
- 先产出原始研究，再做综合结论
- 区分事实、推断、假设，不把搜索摘要写成事实
- 用多份文件沉淀研究过程，而不是把所有内容塞进一份长文
- 先验证“是否值得做”，再讨论“怎么做”
- 默认保持怀疑，不替用户自动补全关键商业结论
- 没有证据时要明确写出数据缺口
- 允许不同模型和场景自由发挥，但不允许跳过关键研究路径

## 工作模式

### 标准模式

默认模式。适用于大多数需求验证场景。

### 快速验证模式

当用户明确说“快速判断”“轻量调研”“先粗看一下”时，使用压缩版流程：

1. Intake Interview 缩短为 1-2 轮
2. 研究深度优先使用 Light 或 Standard
3. 研究阶段至少完成 Wave 1 + Wave 2
4. 仍然必须给出结论、找茬和下一步验证建议

### 深度模式

当用户明确说“深入调研”“全面分析”“高风险决策”时，使用更深研究：

- 更高 research depth
- 更多搜索轮次
- 更完整的竞争、用户声音和替代行为分析

## 输出语言

默认使用用户当前语言。如果用户明确指定其他语言，统一用指定语言输出全部文件。

> 开始前先读取 `references/output-guidelines.md`，确保所有输出文件都带统一的标题、日期、置信度、Flags 和 Sources。

## 阶段总览

```text
RESUME CHECK
→ EXISTING ARTIFACT CHECK
→ INTAKE
→ REQUIREMENT EXPANSION CHECKPOINT
→ RESEARCH DEPTH
→ DISCOVERY RESEARCH
→ POST-RESEARCH CHECKPOINT
→ SYNTHESIS
→ DECISION ALIGNMENT CHECKPOINT
→ VERIFICATION
→ RESEARCH GATE
→ PRESSURE TEST
→ FINAL RECOMMENDATION
```

## Phase 0: Resume Check

如果当前工作目录或项目子目录中存在 `PROGRESS.md`，先读取并恢复进度。

如果发现已有进度，告诉用户：

- 已完成哪些阶段
- 当前将从哪个阶段继续
- 当前使用的研究模式和语言

如果没有 `PROGRESS.md`，从 Phase 1 开始。

## Phase 0.5: Existing Artifact Check

如果没有可恢复的 `PROGRESS.md`，也不要立刻假设这是一次完全从零开始的分析。

先检查当前工作目录或项目子目录里，是否已经存在可复用的研究资产，例如：

- `00-intake/brief.md`
- `00-intake/expanded-brief.md`
- `01-discovery/raw/*.md`
- `01-discovery/market-analysis.md`
- `01-discovery/competitor-landscape.md`
- `01-discovery/target-audience.md`
- `01-discovery/demand-validation.md`
- `01-discovery/distribution-activation.md`
- `01-discovery/research-gate.md`
- `02-assessment/requirement-conclusion.md`
- 用户提供的访谈纪要、调研报告、数据表或已有分析材料

### 这一步的目标

- 识别是否已有可复用的研究起点
- 减少重复 intake 和重复搜索
- 把已有材料当作“可验证输入”，而不是直接当作最终结论

### 处理规则

- 如果已有材料足以覆盖大部分背景信息，Intake 只补问真正缺失的部分
- 如果已有材料之间彼此矛盾，应在 intake 中优先确认冲突点
- 如果已有的是旧研究，不能直接沿用结论，必须在后续研究中重新校验关键判断

### 输出

如果发现可复用材料，在对话里明确告诉用户：

- 找到了哪些材料
- 这些材料会如何影响后续流程
- 哪些问题可以跳过，哪些问题仍然必须确认

## Phase 1: Intake Interview

这一步决定后续调研质量，不要匆忙进入搜索。

### 目标

- 把大词需求收窄成可研究对象
- 识别当前需求是在分析什么
- 明确最关键的信息缺口
- 收集已有资料、限制条件和用户目标

### 如何访谈

- 每轮问 3-5 个问题，不要一次性倾倒全部问题
- 问题应围绕当前最大缺口，而不是机械套题
- 每个问题默认给出至少 3 个强相关选项和 1 个“其他 / 自行补充”
- 如果用户在回答中实质性改变分析对象，停止当前链路，回到 Intake 重新识别
- 在每一轮正式提问前，先用 2-4 句解释本轮在确认什么、为什么这些问题重要、不同答案会影响后续什么判断
- 解释应帮助用户进入思考状态，而不是把问题包装得更复杂

### 必问维度

- 这到底是新项目、新方向、新需求还是需求优化
- 谁是最核心的第一批用户
- 痛点发生在什么具体场景
- 当前替代方案是什么
- 用户为什么会对现有方案不满
- 谁会为这个结果买单，或谁承担损失
- 用户当前最担心什么
- 成功或失败用什么信号判断

### 大词收窄

如果用户说的是“社区”“平台”“生态”“一站式”“面向所有人”这类大词，先用 `references/dynamic-questioning.md` 中的“大词收窄规则”收窄后，再允许进入研究阶段。

### 输出

保存到：

- `{project-name}/00-intake/brief.md`

在项目根目录创建：

- `{project-name}/PROGRESS.md`

`PROGRESS.md` 至少记录：

- 项目名
- 开始日期
- 语言
- 当前模式
- 各阶段 checklist
- Notes

## Phase 1.2: Requirement Expansion Checkpoint

在 Intake Interview 结束后，不要立刻进入搜索。

先基于当前已知信息，生成一份“需求展开摘要”，目标是把用户原始描述扩成一个更完整、可研究的需求说明，再交给用户确认。

### 这一步必须覆盖

- 当前理解的需求对象是什么
- 核心用户是谁
- 关键场景是什么
- 用户当前怎么解决
- 当前最关键的假设是什么
- 哪些地方还不明确
- 如果后续结论成立，最可能影响的是哪些判断

### 这一步的作用

- 避免用户觉得前面的提问像考试
- 让用户看到系统已经如何理解这个需求
- 给用户机会补充自己已知但还没说出来的背景信息
- 防止直接进入自动研究时，需求描述仍然过短或过空

### 用户确认规则

在进入正式研究前，必须把这份“需求展开摘要”发送给用户，并明确邀请用户：

- 修正理解偏差
- 补充遗漏背景
- 增加已掌握的数据、访谈、案例或判断
- 微调需求方向

如果用户补充后导致需求实质变化，应回到 Phase 1 重新识别或重写这份摘要。

发送完这份摘要后，默认在此暂停，等待用户确认、补充或明确说“继续”。

只有在以下情况下，才允许进入正式研究：

- 用户已明确确认理解无误
- 用户已补充完本轮想补的信息
- 用户明确表示先按当前理解继续

### 输出

保存到：

- `{project-name}/00-intake/expanded-brief.md`

## Phase 1.5: Research Depth Assessment

在正式调研前，先根据需求复杂度决定研究深度。

使用：

- `references/research-scaling.md`

计算复杂度后，向用户展示推荐的研究深度：

- Light
- Standard
- Deep

允许用户覆盖默认推荐。

记录到 `PROGRESS.md`。

## Phase 2: Discovery Research

这一阶段是核心研究阶段。不要边搜边写最终结论，先产出 raw research。

### 工具要求

优先使用 Web Search / 网络搜索。

如果搜索不可用或被拒绝，退回知识型研究模式，但必须：

- 明确标记为 `Knowledge-Based`
- 所有置信度降一级
- 明确建议用户后续自行验证关键结论

### 研究组织方式

按波次执行，每一波完成后再进入下一波。可以并行，也可以顺序执行，但不能跳过波次依赖关系。

### 波次汇报硬约束

每完成一波研究，在进入下一波之前，必须先向用户发送一次简短汇报，而不是一路自动跑到底。

每次汇报至少包含：

- 本波研究看了什么
- 当前发现了什么
- 哪些信息支撑更强了
- 哪些地方仍然存疑
- 用户此时最适合补充什么信息

然后明确允许用户：

- 补充自己已知的信息
- 纠正研究中的误解
- 添加新线索或补充材料
- 对需求方向做小幅微调

如果用户只是补充细节，可直接带入下一波。

如果用户补充使需求方向明显变化，应暂停并回到 Intake / Expanded Brief 阶段重新对齐。

每次发送 `Wave Summary` 后，默认短暂停在该节点，优先吸收用户补充。

只有在以下情况下，才允许继续下一波：

- 用户已明确说“继续”
- 用户表示暂无补充
- 当前运行环境不支持等待交互，此时必须在汇报中明确说明“以下将按当前信息继续”

### Raw 文件硬约束

每个 research block 都必须产出一个独立 raw 文件，哪怕搜索结果很弱，也不能跳过文件输出。

如果某个研究块数据不足，文件里至少也要包含：

- 已确认的事实
- 当前只能成立的推断
- 仍未证实的假设
- 明确写出的 Data Gaps

不要把“没有搜到很多东西”变成“不输出这份报告”。

所有 waves 只能写入 `01-discovery/raw/` 下的 raw 文件，不要让 research block 直接写综合文件、推荐范围或最终结论。

开始前先读取：

- `references/research-principles.md`

然后按当前波次分别读取：

- `references/research-wave-1-market.md`
- `references/research-wave-2-competitors.md`
- `references/research-wave-3-customers.md`
- `references/research-wave-4-distribution.md`

### Wave 1: Market Landscape

目标：判断这是不是真问题、市场有没有足够支撑、当前时点是否合适。

包含：

- 市场规模 / 问题经济性
- 行业趋势 / 时间窗口
- 监管、平台规则或关键约束

raw 输出保存到：

- `{project-name}/01-discovery/raw/market-size.md`
- `{project-name}/01-discovery/raw/trends.md`
- `{project-name}/01-discovery/raw/regulatory.md`

波次结束后，向用户发送 `Wave 1 Summary`，并邀请其补充：

- 已知市场数据
- 行业上下文
- 平台 / 政策限制
- 你认为特别关键但还没提到的背景

### Wave 2: Competitive Analysis

目标：确认直接竞品、间接替代方案、平台风险和现有格局。

包含：

- 直接竞品深挖
- 间接替代与替代行为
- 竞品 GTM 和渠道打法

raw 输出保存到：

- `{project-name}/01-discovery/raw/direct-competitors.md`
- `{project-name}/01-discovery/raw/indirect-competitors.md`
- `{project-name}/01-discovery/raw/competitor-gtm.md`

波次结束后，向用户发送 `Wave 2 Summary`，并邀请其补充：

- 已知竞品
- 内部曾关注过的替代方案
- 对竞品优劣势的已有认知
- 你认为自己真正的差异点

### Wave 3: Customer & Demand

目标：听见真实用户声音，验证需求强度、付费可能性和目标人群。

包含：

- 用户声音与痛点
- 需求信号与支付意愿
- 目标用户画像与购买行为

raw 输出保存到：

- `{project-name}/01-discovery/raw/customer-voice.md`
- `{project-name}/01-discovery/raw/demand-signals.md`
- `{project-name}/01-discovery/raw/target-audience.md`

波次结束后，向用户发送 `Wave 3 Summary`，并邀请其补充：

- 已做过的用户访谈
- 已知用户原话
- 历史问卷 / 反馈
- 用户购买或拒绝的真实原因

### Wave 4: Distribution & Activation

目标：判断这个需求即使成立，是否有现实的冷启动、分发和激活路径。

包含：

- 分发渠道与首批用户触达
- 激活、冷启动与供给组织风险

raw 输出保存到：

- `{project-name}/01-discovery/raw/distribution-channels.md`
- `{project-name}/01-discovery/raw/activation-risks.md`

波次结束后，向用户发送 `Wave 4 Summary`，并邀请其补充：

- 已知渠道资源
- 已验证或尝试过的触达方式
- 冷启动经验
- 早期增长 / 激活上的现实限制

### 补充材料

进入调研阶段时，可先询问用户是否有补充材料可以纳入分析：

- 用户调研报告
- 流量 / 转化 / 搜索数据
- 历史业务数据
- 问卷、访谈、客服、销售、运营反馈
- 社区讨论整理

补充材料不是强制项。如果没有，也不能阻塞流程。

## Phase 2.4: Post-Research Checkpoint

所有 research waves 完成后，不要立刻进入 synthesis。

先基于 raw 文件生成一份研究阶段简报，用来向用户说明：

- 目前最强的发现是什么
- 哪些地方出现了矛盾
- 哪些方向的证据在变强
- 哪些切入点开始变得可疑
- synthesis 接下来会重点裁决什么

### 输出

保存到：

- `{project-name}/01-discovery/research-briefing.md`

### 用户对齐规则

把这份 `research-briefing.md` 发给用户后，默认在此暂停，等待用户：

- 补充遗漏的研究线索
- 纠正对行业、竞品、用户的误读
- 删除明显不相关的方向
- 对需求切口做小幅收窄或微调

如果用户补充使研究对象明显变化，应回到 Intake / Expanded Brief 阶段重新对齐。

## Phase 3: Synthesis

所有 research waves 完成后，先读完 `01-discovery/raw/` 下的全部 raw 文件，以及 `research-briefing.md`，再开始综合。

使用：

- `references/research-synthesis.md`

综合阶段的目标不是复制 raw findings，而是：

- 找共性模式
- 发现矛盾信息
- 连接“市场 → 竞争 → 用户 → 需求强度”
- 连接“需求成立性 → 分发可行性 → 激活难度”
- 形成多个可比较的切入范围，而不是直接给唯一答案
- 解释为什么某个推荐范围更值得继续，为什么其他范围被放弃
- 给出战略含义
- 汇总数据缺口

### 输出文件

综合后输出：

- `{project-name}/01-discovery/market-analysis.md`
- `{project-name}/01-discovery/competitor-landscape.md`
- `{project-name}/01-discovery/target-audience.md`
- `{project-name}/01-discovery/demand-validation.md`
- `{project-name}/01-discovery/distribution-activation.md`
- `{project-name}/01-discovery/problem-definition.md`
- `{project-name}/01-discovery/decision-drivers.md`
- `{project-name}/01-discovery/scope-options.md`
- `{project-name}/01-discovery/recommended-scope.md`
- `{project-name}/01-discovery/confidence-dashboard.md`

更新 `PROGRESS.md`。

## Phase 3.2: Decision Alignment Checkpoint

在进入 verification 前，不要默认当前 recommendation 已经可以直接进入最终结论。

先基于以下文件做一次用户对齐：

- `problem-definition.md`
- `decision-drivers.md`
- `scope-options.md`
- `recommended-scope.md`

### 这一步必须说明

- 当前研究认为真正的问题定义是什么
- 当前最重要的 decision drivers 是什么
- 比较过哪些范围
- 为什么当前推荐这个范围，而不是其他范围
- 如果用户不同意，最可能不同意的是哪一层：问题定义、scope options，还是 recommendation

### 对齐规则

把这份决策对齐摘要发给用户后，默认在此暂停，等待用户：

- 确认 recommendation 方向
- 对备选范围提出补充
- 反对当前 scope recommendation
- 基于研究结果微调切入点

如果用户对 recommendation 提出实质性异议，应先回写并修正决策型报告，再进入 verification。

## Phase 3.5: Verification

综合完成后，不要直接进入结论，先做一次验证。

使用：

- `references/verification-agent.md`

验证目标：

- 检查没有标注的数据性断言
- 检查 deliverables 之间是否矛盾
- 检查 confidence 是否和证据强度一致
- 检查是否遗漏数据缺口或风险
- 检查最终结论是否真的由研究支撑

输出：

- `{project-name}/01-discovery/verification-report.md`

如果发现 critical issues，暂停并向用户展示，再决定是否修复后继续。

## Phase 4: Research Gate

在做最终推荐前，先把研究结果转成一个 go / no-go checkpoint。

保存到：

- `{project-name}/01-discovery/research-gate.md`

需要给用户一个明确判断：

- Green light：有足够证据支持继续
- Yellow light：证据混合，需要带条件推进
- Red light：当前数据不支持继续，建议收窄、转向或停止

然后问用户：

- 继续进入压力测试和最终建议
- 基于当前研究 pivot
- 暂停在此

如果用户在这个关口补充了重要信息，应允许回写到 discovery deliverables，而不是简单口头吸收后直接往下走。

## Phase 5: Pressure Test

在用户继续的前提下，切换到“找茬模式”。

使用：

- `references/pressure-test.md`

必须挑战：

- 用户是否真的会付费，还是只会表达兴趣
- 需求是否高频 / 高损失，还是低频抱怨
- 获客成本会不会吃掉价值
- 团队是否缺少关键资源、分发能力或进入门槛
- 大厂、平台或现有竞品是否能快速复制
- 是否存在合规、平台、供应链、数据约束

完成反方压力测试后，允许补一次正向压力测试，确认是否存在被低估的上行空间。

## Phase 6: Final Recommendation

最后基于前面所有文件输出最终建议，不要绕开前文研究直接发挥。

最终输出可以是报告式、纪要式或表格式，但建议参考：

- `templates/final-analysis-template.md`

同时产出两份最终文件：

- `{project-name}/02-assessment/requirement-conclusion.md`
- `{project-name}/02-assessment/team-brief.md`

最终建议必须显式引用 discovery deliverables 中的关键发现，不能只给脱离研究过程的口头判断。

尤其要显式引用：

- `problem-definition.md`
- `decision-drivers.md`
- `scope-options.md`
- `recommended-scope.md`

### 最终必须回答

- 这个需求 / 方向是否值得继续
- 为什么值得或不值得
- 为什么推荐的是当前范围，而不是其他备选范围
- 当前结论建立在哪些证据上
- 当前最重要的 3 个风险是什么
- 最大的数据缺口是什么
- 下一步最值得执行的验证动作是什么

### 输出要求

最终输出必须：

- 标注分析日期、版本、信息截止日期
- 区分 `事实 / 推断 / 假设`
- 明确 `值得继续 / 谨慎推进 / 暂不建议`
- 给出置信度
- 汇总 Red Flags / Yellow Flags
- 展示本次生成的核心研究文件及其一句话要点
- 告诉用户下一步做什么，而不是只给判断

### 禁止事项

- 把 AI 搜索摘要直接当作事实
- 只写市场大、竞品多、机会大这种空话
- 只列框架，不给结论
- 没做压力测试就建议继续
- 跳过 raw research 和 synthesis 直接产出最终推荐

## References

按阶段读取，不要一次性把所有 reference 都塞进上下文。

- `references/output-guidelines.md`：开始时读一次
- `references/dynamic-questioning.md`：Phase 1
- `references/evidence-rubric.md`：Phase 2-6 全程参考
- `references/research-scaling.md`：Phase 1.5
- `references/research-principles.md`：Phase 2 开始前
- `references/research-wave-1-market.md`：Wave 1
- `references/research-wave-2-competitors.md`：Wave 2
- `references/research-wave-3-customers.md`：Wave 3
- `references/research-wave-4-distribution.md`：Wave 4
- `references/research-synthesis.md`：Phase 3
- `references/verification-agent.md`：Phase 3.5
- `references/pressure-test.md`：Phase 5
