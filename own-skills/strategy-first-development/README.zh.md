---
description: "在重大产品或工程项目开始前，先对齐战略、参考方案、技术选择、路线图和项目文档。"
prompt_examples:
  - prompt: "我要做一个新的 AI Web 产品，先讨论战略、盘点所有技术积木、广泛比较候选，不要直接写代码。"
    scene: "规划全新产品"
  - prompt: "第一次选技术栈，每个 Tier A/B/C 积木都要基于当前一手证据建立候选池再收敛。"
    scene: "运行首次技术选型"
  - prompt: "现有技术栈和 ADR 已接受，只评估新增搜索模块，不要重新选择全栈。"
    scene: "局部技术变更"
---

# 战略先行开发流程

在实施前，把高影响力产品或工程请求变成项目公共控制面：战略共识、成熟参考项目调研、逐能力技术选型、路线图关卡和标准项目文档。

## 什么时候用它

- 新产品或 MVP 尚无已接受的战略与技术栈。
- 主运行时、数据库、鉴权、编排、部署或状态所有者需要首次选择或替换。
- provider、模型、UI、数据、搜索、任务或可观测性需要基于证据选型。
- 团队希望先把战略和技术决策沉淀，再进入代码实施。

不要用于 skill/prompt 元任务、小文案、翻译、已明确范围的 bug 修复、纯代码 review，或无需重新选架构的既有项目部署。

## 它会产出什么

- `STRATEGY_PACKET` 和 `CONSENSUS_GATE`。
- 成熟产品与架构参考调研，使用 `adopt / absorb / spike / defer / reject` 决策。
- `CAPABILITY_BLOCK_INVENTORY`、冻结的 decision brief、候选记录、短名单、spike 和 `STACK_SELECTION_GATE`。
- 覆盖运行时、职责所有权、安全、部署、运维和退出路径的整栈一致性复核。
- `Now / Next / Later / Not Doing` 路线图。
- 在允许写文档的模式下，创建或更新 `AGENTS.md`、strategy、north-star、technical-stack 和 roadmap。

战略落地阶段只写文档，不安装依赖、不搭运行时模块、不改部署文件，也不把文档完成冒充实现完成。

## 首次选型默认门槛

| Tier | 典型影响 | 最少发现 | 最少可信 | 最少解法原型 | E2 深读 |
|---|---|---:|---:|---:|---:|
| A | 状态/安全/拓扑所有者，迁移昂贵 | 7 | 5 | 3 | 3 |
| B | 重要生产子系统 | 5 | 3 | 3 | 2 |
| C | 局部、低风险、容易替换 | 3 | 2 | 2 | 1 |

数量只是最低覆盖，不是凑数目标。同引擎 wrapper、玩具项目、不兼容方案和只有搜索摘要的候选不能计数。Tier A 要标记 accepted，默认还需同约束 spike；只有同主版本、同部署形态、同负载和同关键约束的近期等价证据才能豁免。

## 选型收敛漏斗

1. 检查现有代码、文档、manifest、ADR 和职责所有权。
2. 盘点所有适用的决策级能力积木。
3. 在评分前冻结 must-have、硬门槛、权重和候选下限。
4. 跨不同解法原型和来源类别发现候选。
5. 核验当前版本、许可、生命周期、兼容性、安全和维护状态。
6. 先硬淘汰，再评分。
7. 深读短名单，做敏感性分析，并定义或执行必要 spike。
8. 逐积木选择后，再做整栈一致性复核。
9. 未解决的决定保持 provisional；只有 gate 通过才能 accepted。

完整协议见 [`references/technology-selection-protocol.md`](./references/technology-selection-protocol.md)。

## 边界

- `discuss-only` 和 `strategy-packet` 不写文件。
- `targeted_change` 默认冻结已接受 ADR，除非新证据证明其失效。
- 网络缺失、证据过期、候选覆盖不足或 Tier A spike 未解决时，技术栈只能 provisional。
- 面向用户的产品必须定义 agent 角色、权限、隐藏内部细节和角色质量标准。
- `AGENTS.md` 是事实源；`CLAUDE.md`、`CODEX.md` 只做指针或差异覆盖，不复制整份战略。

## 同类 Skill 对比

> 由 tranfu-publish 起草，作者 `griffithkk3-del` 签字。

### 公司库内

- [项目文档初始化](../project-init-docs/SKILL.md) — 为现有仓库搭文档底座；**本 skill 区别**：先完成战略和选型共识。
- [Agent 架构决策](../agent-architecture-decision/SKILL.md) — 决定 agent workflow；**本 skill 区别**：治理整个产品与技术栈。
- [AI 项目评分](../project-scoring/SKILL.md) — 判断是否值得投入；**本 skill 区别**：规划已接受项目如何交付。

### 外部世界

- 暂无

### 本 skill 独特价值

- 逐能力积木建立候选池
- 用证据和 gate 逐步收敛
- 先形成战略文档再写代码

## 使用技巧

> 由 tranfu-publish 引导起草，作者 `griffithkk3-del` 签字。

### 材料方案

- 从 canonical docs 和 ADR 开始。
- 动态事实回到一手来源核验。
- 每个候选池保留原生基线。

### 推荐用法

- 方向不清时先跑 `discuss-only`。
- 绿地项目走 `wide_first_selection`。
- 已接受技术栈走 `targeted_change`。

### 已知限制

- 首次广泛选型需要较长时间。
- 离线证据只能保持 provisional。
- Tier A 通常需要授权 spike。
