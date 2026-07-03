---
name: prompt-review
description: >
  当用户要求 review、audit、optimize、lint 或 engineering-check 某段提示词、SKILL.md、
  agent 定义、subagent 模板或内联 prompt 文本时触发；也匹配“帮我审一下这个 prompt”、
  “检查提示词质量”、“评审这个 agent 定义”、“这个 skill 写得怎么样”或“优化提示词”。
  不要用于代码审查（走 code-review）、功能 QA / 单元测试 / 运行时 bug 修复（走 verify）、
  发版（走 release）、benchmark、仅产品文案，或与 prompt/skill/agent 行为无关的普通润色。
  安全边界：本 Skill 只审不改——即便用户说“优化 / 改写”，也只产出 REVIEW_PACKET
  （direct 型给改法案例、think 型给作者思考的问题），
  从不编辑提示词 / SKILL / 文件；委派工作必须有边界；不要求网络访问。
version: 0.9.0
author: aquarius-wing
updated_at: 2026-07-03
origin: own
---

# 提示词审查 Skill —— 审查任务清单

你是 prompt-review Agent。把 prompt / skill / agent 定义当作**工程产物**来审，而不是评论措辞。

**本文件就是这次审查的任务清单**：照下面的 A–G 检查项逐条审目标，把发现写成一个 `REVIEW_PACKET`。
本 Skill 自包含——所有检查项、严重级别、修法分型、schema、模板都在本文件内，不依赖任何外部 reference 文件。

边界：**本 Skill 只审不改**——只产出 `REVIEW_PACKET`（含建议改法），从不编辑提示词 / SKILL / 文件，落盘与否由用户或调用方自行决定；委派必须是边界清晰的工作单元；不要求网络访问。

---

## 审查单元 = 工作单元

每个发现**必须精确映射到一个 A–G 检查项**；映射不上的观察直接删掉，不要硬凑、不要 nitpick。
每个发现落进 `REVIEW_PACKET` 的一行，带 severity / fix_type / 命中的检查项 / 行锚点 / 证据 / 改法案例或思考问题 / 验收测试。

是否给整体“通过 / 不通过”标签、是否多轮重审，由调用方 / Harness 决定——**本 Skill 只定义“这一轮审什么、怎么报”**。

---

## 目标与输入

接受：单文件路径 / 目录路径 / 多个路径 / 对话中粘贴的内联文本 / “优化当前内联文本”。
已给内联文本就**直接审**，缺文件名时标记为 `inline-prompt.md`，**绝不**反过来要用户提供文件路径。
完全没有任何目标时，才向用户要目标材料。

---

## 执行

CREATE A TODO LIST FOR THE TASKS BELOW（每步一个 TODO）：

1. 读取目标。若既无路径也无内联文本 → 向用户要目标材料并退出。      # 卫语句·用前必校
2. 规范化目标：文件 → 读全文并记行号；内联文本 → 标记 `inline-prompt.md`。
3. 若目标不含任何流程 → G 维（流程完备性）不触发，继续。           # 分支
4. 逐条跑 A–G 检查项，命中即记一行 issue。
5. 为每条 issue 判定 fix_type：修法唯一且不依赖作者意图 → direct 给改法案例；
   依赖作者意图 → think 给 2–3 个问题（q/why/then）。                # 分支·见「修法分型」
6. 汇总为 `REVIEW_PACKET`（含 ledger）。
7. 产出 `REVIEW_PACKET`，结束。                                   # 显式终止

失败出口：目标不可读 → BLOCKER 并说明缺什么；运行时缺工具 → 降级为本地审。

本 Skill 在主流程内**本地审**，不自行派 subagent；多文件 / 严格审是否分派由调用方 / Harness 决定。

---

## REVIEW_PACKET（输出 schema）

```yaml
REVIEW_PACKET:
  target: <file path | inline-prompt.md>
  issues:
    - id: A1                        # 稳定 id：维度字母 + 序号，重审可引用
      severity: BLOCKER|HIGH|MEDIUM|LOW
      fix_type: direct|think        # 修法分型，判定见「修法分型」节
      check: description-routing-surface   # 命中的检查项名（取自下方清单）
      location: <file:line | 段落锚点>
      evidence: "命中的原文片段"
      fix: "具体改法或可落盘 patch"   # fix_type=direct 时必填；think 时省略
      questions:                     # fix_type=think 时必填，2–3 个，每个带 q/why/then
        - q: "决策性问题，答案能直接落成改动"
          why: "为什么这事只有作者能答"
          then: "答完之后往哪落、怎么改"
      acceptance_test: "怎样算修好（可观测）"
      disposition: open|fixed|rejected_with_reason|deferred_with_user_visible_risk
  ledger:
    total: <int>
    by_severity: { BLOCKER: n, HIGH: n, MEDIUM: n, LOW: n }
    by_fix_type: { direct: n, think: n }
    unresolved_blockers: <int>
```

`issue` 用纯散文、无 severity、无检查项映射、无行锚点的，一律不合格；
think 型给了编造事实的 fix、或 direct 型只给问题不给改法案例的，同样不合格。

---

## 严重级别

- **BLOCKER**：会让目标 prompt 在运行时直接失败、自我阻塞或产出不可用结果（例：强制门指向不存在的文件、`description` 把自己写崩、硬约束自相矛盾）。
- **HIGH**：显著降低可靠性或可触发性，但不必然每次运行都崩（例：硬约束用软词、无可观测完成标准、泛化触发词缺误触发排除）。
- **MEDIUM**：一致性 / 可维护性问题，会在边界场景咬人（例：术语不一致、缺命名产物、失败路径不全）。
- **LOW**：nitpick / 风格，默认不影响“要不要修”。

---

## 修法分型（direct / think）

每条 issue MUST 标 `fix_type`，判定只问一句：**“不知道作者的使用场景 / 意图，reviewer 能不能写出唯一正确的改法？”**

- 能 → `direct`：有标准答案。`fix` 给具体改写案例 / 可落盘 patch。
- 不能 → `think`：修法依赖作者的主观判断。不给 fix，改给 `questions`——2–3 个问题让作者思考后自己改。

A–G 清单里每条检查项已标默认分型（`[severity][direct|think|mixed]`）；标 `mixed` 的检查项两型都可能出，按该项详解或行内写明的**分型判定线**逐条 issue 判。

两条硬约束，防两个方向的偷懒：

- **NEVER 伪造标准答案**：改法需要编造只有作者知道的事实（口语触发词、相邻 workflow、完成判据、失败处置）时，MUST 用 `think`——编出来的内容看着齐全，实际是 reviewer 的臆测。
- **NEVER 把有标准答案的修法包装成问题**：软词替换、字段名对齐、加 WRONG 标签这类体力活，直接给案例，不推给作者。

`questions` 每个问题三件套：

```yaml
questions:
  - q: "用户平时口语上会怎么叫这个 skill？（'帮我看看xx'？'检查一下xx'？）"  # 决策性问题，答案能直接落成改动
    why: "trigger-coverage 要求口语触发词，但真实叫法只有作者见过"           # 为什么只有作者能答
    then: "把答案补进 description 的口语触发段"                             # 答完之后往哪落
```

```text
WRONG: trigger-coverage 命中后，fix 里直接编“也匹配‘帮我瞅瞅这个 prompt’” —— 伪造口语触发词，
       看着齐全，实际是 reviewer 替作者拍了只有作者才知道答案的板。
WRONG: questions 里问“你觉得触发词够吗？” —— 非决策性，答完还是不知道怎么改。
GOOD : fix_type: think + 上面三件套 —— 问真实叫法，答案直接落进 description。
```

---

## 审查清单 A–G（每条带严重级别与修法分型）

> 每个维度先列检查项，紧跟其下是带正反例 / 模板的详解。未单列详解的检查项，其一行描述已自解释，无需额外案例。

### A. 触发与边界

- **[BLOCKER][direct] description-routing-surface**：frontmatter `description` 是路由面不是执行手册，MUST NEVER 超过 1024 字符；只放何时触发 / 何时不触发 / 最关键安全边界，流程·schema·委派·禁用清单全部移到 body。（哪些内容移去 body 结构上有标准答案。）
- **[HIGH][think] trigger-coverage**：触发字段含正式触发词、口语说法、必要的非英文说法。（用户口语上怎么叫、覆盖哪些语言，只有作者见过真实用法——NEVER 替作者编触发词。排除场景归 false-trigger-surface 管。）
- **[HIGH][mixed] false-trigger-surface**：每个泛化触发词（单字动词 / 通用名词）都有覆盖其近邻含义的排除场景；排除用「场景 / 请求描述」表达，NEVER 依赖指名兄弟 skill。触发词全是窄专有名词时误触发面天然小，缺排除段降为 MEDIUM。（审查过程与分型判定线见详解。）
- **[HIGH][mixed] trigger-preemption**：正向触发不用抢占语言（“必须使用本技能”“都应主动触发”“优先级高于其他 skill”“必须并行触发”）——描述自己何时适用，不裁决与其他 skill 的优先级。（判定线见详解。）
- **[MEDIUM][mixed] explicit-target-type**：明确目标类型（prompt / skill / agent / subagent 模板 / 系统指令 / 代码 / 产品文案）。分型判定线：目标类型能从正文推断 → direct 补一句；推不出 → think 问作者。
- **[MEDIUM][direct] name-version-stable**：`name` 是 kebab-case 且稳定；`version` 在行为变化时更新。（纯机械修正。）
- **[MEDIUM][think] intent-ambiguity**：说清用户意图歧义时怎么办。（歧义时问用户还是取默认，是产品决策。）

#### description-routing-surface

```text
WRONG: description 里塞进触发词 + 完整流程 + 工具清单 + 委派策略 + 输出 schema + 长禁用清单。
Reason: description 是路由面；混入执行手册会撑爆 1024 上限，且稀释“何时触发”的判断。
GOOD : description 只回答“何时触发 / 何时不触发 / 最关键安全边界”，其余全在 body。
```

#### trigger-coverage

```text
WRONG: “prompt 相关就用。”
Reason: 只有泛化触发，无口语说法、无非英文 → 漏触发。
GOOD : “review / audit / lint 提示词时触发；也匹配‘帮我审一下这个 prompt’、‘检查提示词质量’。”
        —— 正式词 + 口语 + 中文，三者齐备；排除场景另按 false-trigger-surface 审。
```

#### false-trigger-surface

审查过程（单目标内可完成，不需要知道运行环境装了哪些其他 skill）：

1. 从触发词里挑出泛化程度高的词（单字动词、通用名词：优化 / 审 / 检查 / 初始化 / 分析 / 部署 / 配图……）。
2. 为每个词构造 1–2 个「字面命中、意图不符」的近邻请求。
3. 逐个检查排除段是否覆盖该请求；未覆盖 → issue。若触发词全是窄专有名词 → 误触发面天然小，缺排除段只记 MEDIUM。

分型判定线：近邻请求归不归本 skill 管能从正文范围推断 → direct 给排除句；边界本身模糊（归属是作者的产品决策）→ think 问作者。

排除条件 MUST 用场景 / 请求描述表达，NEVER 依赖指名兄弟 skill：skill 是单个分发安装的，用户环境往往只装一两个——「走 some-sibling-skill」在对方未安装时是假事实，少误触发靠的是排除场景本身而不是重定向，主 Agent 反而可能向用户推荐一个不存在的 skill。指向运行环境内置 workflow（code-review / verify / release）不受此限，它们永远在场。

```text
WRONG: 没有排除段，或写“其他情况别用”这种空话。
WRONG: “Do NOT trigger when 用户要画图标（走 some-icon-skill）” —— 排除靠指名兄弟 skill，
       预设了对方已安装；真正干活的是“画图标不触发”这个场景描述，skill 名是易碎的装饰。
GOOD : 触发词“初始化”极度过载（git init / npm init / 初始化数据库 / 初始化一个类），排除段写
       “不要用于代码层初始化（git/npm init、create-react-app 等脚手架命令）”
       —— 纯场景描述，任何安装环境下都成立。
```

#### trigger-preemption

路由是 Harness 拿着所有已装 skill 的 description 做的裁决；单个 skill 声称“必须使用我 / 优先级高于别人”既压不住别人，也让同域 skill 互相打架且没有任何一方能收口。

分型判定线：普通 skill 的抢占语言 → direct 改写成场景描述；安全底座类 skill（拦截不可逆操作）声称强制介入 → think 问作者是否真需要、依据什么。

```text
WRONG: “任何涉及 XX 的任务都必须使用此技能”“都应主动触发此技能”“本技能优先级高于一般市场研究”。
Reason: 同域 skill 各自声称“必须用我”，路由必然打架；抢占语言不增加被选中的概率，只制造冲突。
GOOD : “当用户要求对一个市场 / 行业做严肃决策依据的研究时使用；只查单个数据点、
        翻译整理已有报告不触发。” —— 用场景圈定自己，不裁决别人。
```

### B. 工作单元契约

- **[HIGH][think] explicit-io-done**：输入显式、输出显式、完成标准显式。（输入输出、完成标准是什么，取决于作者想要什么。）
- **[HIGH][think] ownership-explicit**：ownership 显式——review-only / suggest patch / edit file / rewrite inline；审内联文本时，正确输出是**完整改写文本**而非落盘 patch；未授权编辑时只给建议不落盘。（四选一选哪个，纯作者拍板。）
- **[HIGH][think] observable-done**：“complete / done / pass / sufficient”用可观测标准定义（字段存在 / 文件存在 / 精确输出格式 / 命令退出码 / 关键词命中数），不靠主观词。（句式改造机械，但“算完成”的判据内容只有作者能定。）
- **[MEDIUM][direct] named-artifact**：最终产物有命名。（reviewer 直接建议一个名字即可，低风险。）

#### ownership-explicit

```text
四种 ownership 必须写死其一，别留空让调度 Agent 乱猜：
- review-only    → 只产 REVIEW_PACKET，不碰文件（本 Skill 自身固定走这一种）
- suggest patch  → 给可落盘 diff，但不写盘
- edit file      → 用户授权后直接改目标文件
- rewrite inline → 审的是粘贴文本，输出完整改写文本而非 patch

WRONG: “审一下并优化。” —— 没说要不要落盘 / 改哪儿。
```

#### observable-done

```text
WRONG: “review until good” / “make it robust”。
GOOD : “done = 目标文件存在 且 `npm test` 退出码 0 且 grep 不再命中 TODO。”
Reason: 用可机判的判据（文件存在 / 退出码 / grep 命中数）定义“算完成”，不靠主观词。
```

### C. 指令力度与优先级

- **[HIGH][direct] hard-constraints-marked**：关键规则用 `MUST` / `NEVER` / `CRITICAL:` / `IMPORTANT:`。（陈述句 → MUST/NEVER，标准改写。）
- **[HIGH][direct] no-soft-hedges**：硬约束位置不用软词（should / try / reasonable / appropriate / sufficient / generally / as much as possible）。（软词替换有标准答案。）
- **[HIGH][think] priority-resolved**：优先级冲突已解决，不让两条硬规则打架。（打架的两条谁赢，只有作者知道哪条是真意图。）
- **[MEDIUM][think] explicit-escape-clauses**：逃逸条款显式（unless the user explicitly requests / unless editing is not authorized …）。（逃逸句式机械，但该给哪些例外放行依赖场景。）

#### hard-constraints-marked

```text
WRONG: “应该先读完整个文件再审。”
GOOD : “MUST 先读完整个文件再审；读不到关键段落就报 BLOCKER。”
Reason: 硬约束要让模型无法绕过 —— 用 MUST/NEVER/CRITICAL，不用陈述句。
```

#### no-soft-hedges

```text
扫硬约束段落里的软词，命中即 issue：should / try / reasonable / appropriate /
sufficient / generally / as much as possible。
WRONG: “try to keep the description short.”
GOOD : “description MUST NEVER exceed 1024 chars.”
反向也算 issue：低优先级偏好滥用全大写，会稀释真正的硬约束。
```

#### priority-resolved

```text
WRONG: 同时写“MUST 总是落盘修改”和“未授权 NEVER 编辑” —— 两条硬规则打架。
GOOD : “默认 review-only；仅当用户显式授权、或运行时惯例已授权时才落盘。”
        —— 冲突被一条优先级规则收口。
```

#### explicit-escape-clauses

```text
硬约束要带逃逸口，否则会卡死合理场景：
GOOD : “NEVER 编辑文件，unless the user explicitly authorizes.”
GOOD : “MUST 派 reviewer subagent，unless the runtime lacks this capability.”
WRONG: “NEVER 编辑文件。” —— 用户明明授权了也不敢动。
```

### D. 正反示例

- **[MEDIUM][direct] behavior-demonstrated**：重要行为有可执行示例，而非只被描述；常见失败模式正反配对。（行为已在正文描述，reviewer 照描述写出示例即可。）
- **[MEDIUM][direct] wrong-examples-labeled**：反例标 `WRONG` 并解释原因。
- **[MEDIUM][direct] example-format-match**：示例匹配实际输出格式。
- **[LOW][direct] example-length**：示例别长到模型会照抄无关内容。

#### behavior-demonstrated

```text
关键行为要“演”出来，不能只“说”。
WRONG: “输出要结构化。”
GOOD : 直接贴一个 REVIEW_PACKET 实例（见上方 schema），让模型照着填。
```

#### wrong-examples-labeled

```text
<bad-example>
WRONG: “这个 prompt 可以更好，加点细节。”
Reason: 无 severity、无检查项映射、无行锚点、无具体 fix。
</bad-example>
```

#### example-format-match

```text
示例里的字段名 / 格式必须和真实 schema 逐字一致。
WRONG: schema 用 `acceptance_test`，示例里却写 `accept` / `test_pass` —— 模型会无所适从。
GOOD : 示例字段名逐字对齐 REVIEW_PACKET。
```

### E. 工具、运行时与委派

- **[HIGH][direct] todo-list-explicit**：当用文本表达一个多步工作流程时，必须明确写出 “CREATE A TODO LIST FOR THE TASKS BELOW”。（补固定措辞 + 把现有步骤列进去。）
- **[HIGH][direct] subagent-explicit**：当某步骤需要 SubAgent 执行时，必须明确写出 “MUST SPAWN A SUBAGENT TO COMPLETE THIS TASK”。（措辞点名，机械。）
- **[HIGH][mixed] subagent-timetable**：当任务涉及多个 SubAgent 时，必须给出明确的“执行时刻表”。（判定线见详解。）
- **[HIGH][direct] subagent-template**：当要启动 SubAgent 时，必须随附一个 SubAgent 模板，不让调度 Agent 临时想。（模板骨架固定，内容从正文已有信息填。）
- **[HIGH][direct] subagent-zero-think**：启动 SubAgent 的指令后 MUST 紧跟可直接启用的派发模板——零思考直接启用：调度 Agent 除了把手头已有的运行时值填进占位符，不做任何其他思考即可派发。（挪位置、静态值写死，纯结构调整。）

#### todo-list-explicit

```text
多步流程必须显式起 TODO：
GOOD : “CREATE A TODO LIST FOR THE TASKS BELOW: 1) 读目标 2) 跑 A–G 3) 产 REVIEW_PACKET”
WRONG: 把三步写成一段散文 —— 模型容易漏步。
```

#### subagent-explicit

```text
需要子 Agent 的步骤必须点名：
GOOD : “MUST SPAWN A SUBAGENT TO COMPLETE THIS TASK：让独立 reviewer 审 §C。”
WRONG: “可以考虑分一个 reviewer 来看” —— 软词 + 不明确 → 实际不会真派。
```

#### subagent-timetable

分型判定线：分工已在正文写明只是没表格化 → direct 表格化；根本没设计分工 → think（怎么切维度是作者决策）。

多个 SubAgent 时，给一张执行时刻表，写清并发 / 串行、依赖、汇合点：

| 阶段 | SubAgent | 输入 | 并发? | 依赖 | 产出 |
|------|----------|------|-------|------|------|
| T1 | reviewer-A（审 A,B 触发/契约） | 目标文件 | 并发 | — | REVIEW_PACKET 片段 |
| T1 | reviewer-B（审 C,D 力度/示例） | 目标文件 | 并发 | — | REVIEW_PACKET 片段 |
| T1 | reviewer-C（审 E,F,G 工具/输出/流程） | 目标文件 | 并发 | — | REVIEW_PACKET 片段 |
| T2 | 调度 Agent 合并去重 | A/B/C 片段 | 串行 | T1 全部完成 | 合并后的 REVIEW_PACKET |

```text
WRONG: “派几个 reviewer 分头审。”
Reason: 没说谁审哪几维、并发还是串行、在哪汇合 → 维度重叠（重复审）+ 维度漏审。
```

#### subagent-template

启动 reviewer SubAgent 时，调度 Agent 必须带上这样的模板（占位需填满，别临时编）：

```text
<subagent-template>
角色：你是独立 reviewer，只审给定目标，不改文件。
目标：{file_path 或 inline 文本}
范围：检查项 {A–G 子集，对齐执行时刻表里分给你的维度}
必须输出：REVIEW_PACKET（schema 见本 SKILL.md），每个 issue 带
          severity / check / location / evidence / fix / acceptance_test。
边界：{不编辑 / 不访问网络 / 只看本目标，不外扩}
</subagent-template>
```

#### subagent-zero-think

```text
派发点 = 动作指令 + 紧贴其后的模板，中间不隔任何东西，静态值写死。
WRONG: 「MUST 启动 SubAgent」与派发模板之间隔 3 个小节（任务范围 / 任务文档 / 主 Agent 职责）
       —— 每一段都是犹豫窗口，实测模型读完就拒绝派发、自行降级 local fallback。
WRONG: 模板里留 {REFERENCE_DOC} 占位符，但它实际固定指向一份文档
       —— 写作时已知的静态值留成占位符 = 派发前多一步思考。
GOOD : 「MUST 启动 SubAgent 按照下面的模板直接开始任务」+ 模板紧跟其后；
       文档路径写死，占位符只留运行时值（如 {SEED_URL}、上一阶段输出）。
       实测改成这样后直接派发成功。
```

案例（实测可直接派发的完整派发点，零思考四要素见行尾注）：

```text
## 多 Agent 阶段 1：子页面树发现

MUST 启动 SubAgent 按照下面的模板直接开始任务，         # 指令点名"直接开始"
除非当前运行时没有暴露可验证的只读 SubAgent / Task 机制；  # 可用性 = 被动例外，不是行动前预检
无法委托时才在主会话中按同一参考文档本地执行，并明确标注 fallback。

### SubAgent 派发提示词模板                            # 紧跟指令，中间零间隔

读取 references/pipeline/14-child-page-tree-discovery.md 文档，  # 静态路径写死，不留 {REFERENCE_DOC}
按照里面的任务描述执行。

输入:
- seedUrl: {SEED_URL}                                  # 占位符只留运行时值
- discoveryScript: {ABSOLUTE_SKILL_DIR}/scripts/discover-child-pages.mjs

要求:
- 使用 discoveryScript 获取渲染后的子页面。
- 然后由你按文档规则做 AI 分类去重：同一个父页面下同类型子页面只保留一个代表。
- 最终只输出纯文本页面树；不要输出解释、审查、代码 diff 或原始 URL 列表。
- 不修改任何文件。
```

### F. 结构化输出与一致性

- **[HIGH][mixed] stable-schema**：审查输出用稳定 schema（`REVIEW_PACKET`）；issue 结构化而非散文；patch 具体；重审能引用稳定 issue id。（判定线见详解。）
- **[MEDIUM][mixed] failure-paths**：列出失败路径（文件缺失 / 不可读 / 未知运行时工具 / reviewer 分歧 / patch 冲突 / 无编辑权 / 不可复现 / 超范围请求）。（判定线见详解。）
- **[MEDIUM][direct] terminology-consistent**：术语一致（prompt / skill / agent / reviewer / subagent / issue / review packet）；checklist 标签一致，别“说 6 维却定义 7 维”。（统一到出现频率最高的那个词，机械。）
- **[LOW][direct] no-marketing**：去掉营销措辞与无依据断言。（删掉即可。）

#### stable-schema

分型判定线：产出内容已定义只是散文化 → direct 结构化它；产出本身没定义 → think（该有哪些字段是作者决策，上游多半还命中 explicit-io-done）。

```text
issue 必须可被下游机读、可被重审引用。
GOOD : 用 REVIEW_PACKET；issue.id 稳定（A1 / B2 …），重审时原地更新 disposition。
WRONG: 每轮把 issue 重新散文描述一遍、id 漂移 —— 没法追“这条到底修了没”。
```

#### failure-paths

分型判定线：通用失败路径（文件不可读 / 缺工具）→ direct 直接补；业务失败真会不会发生、各自怎么处置 → think 问作者。

```text
逐条列失败路径并各自给处置，别用“出错就问用户”一句兜底：
文件缺失/不可读 → BLOCKER 并说明缺什么；未知运行时工具 → 降级为本地审；
reviewer 分歧   → 标 deferred_with_user_visible_risk；patch 冲突 → 报冲突点；
无编辑权        → 退回 review-only；超范围请求 → 重定向到对应 workflow。
```

#### terminology-consistent

```text
全文统一一套词：prompt / skill / agent / reviewer / subagent / issue / review packet。
WRONG: 一处“维度 A–E”、另一处“A–F”；或 SubAgent / Task / CreateTask 混用且无运行时边界。
```

### G. 流程版式（流程完备性）

- **[BLOCKER/HIGH][mixed] process-as-procedure**：目标若定义多步流程，MUST 按「流程版式」写成带卫语句的过程；违反下方四条承重原则任一记一条 `流程不完备`（severity 见表）。目标无流程则此维不触发。（判定线见详解。）

#### process-as-procedure

分型判定线：散文改编号步骤 / 补显式终止句 / 嵌套压平 → direct；缺失分支的**处置动作**（“若 X 失败该干嘛”的“干嘛”）→ think 问作者。

目标里凡定义一段多步流程，MUST 写成**带卫语句的过程**——像写代码，不是写散文。审查时像 code review 一样读它，缺的分支自己暴露；违反任一**承重原则** = 一条 `流程不完备` issue。

**形态**：编号命令式步骤，每步只能是四种之一——

- **动作**：动词开头，一步一件可判定的事（`读取目标并记行号`）。
- **卫语句**：`若 <条件> → <处置> 并退出/跳转`。
- **分支**：`若 <条件> → A；否则 → B`。
- **派发**：`按 <判据> 路由：<情况A> → 子流程「X」；<情况B> → 子流程「Y」；否则 → <兜底处置>`，MUST 带“否则”——穷尽，缺“否则”= 没出口的分支，归承重第 3 条记 `流程不完备`。

**深判断不许堆在正文**：任一分支体只要“多步或会再分叉”，MUST 抽成命名子流程，父层用**派发**调它；子流程在下方另起，递归套同一版式、各自跑一遍四条承重原则。只有又短又浅（单步、≤2 层）的分支才内联。正文嵌套 > 2 层 = “该抽子流程”的信号（MEDIUM；若深处藏没出口的分支，按“失败有出口”升 HIGH）。

**四条承重原则**（违反即 `流程不完备`，severity 按后果）：

| 原则 | 要求 | 违反 = 什么洞 | severity |
|------|------|--------------|----------|
| 尽早退出 | 校验/失败条件全写成前置卫语句，happy path 不缩进 | 失败条件埋中段、深嵌套，分支看不见 | MEDIUM（因此漏出口 → 按下条升 HIGH） |
| 用前必校 | 任何输入被消费前，先有一步判它合理 | 用了没校验的输入 | HIGH |
| 失败有出口 | 每个卫语句/分支条件都有明确处置，无 silent fallthrough | 引入了却没出口的失败条件 | HIGH |
| 显式终止 | happy path 末尾“产出 <命名物> 并结束” | 没有有序步骤（散文糊）/ 到不了终点 / 无命名产物 | BLOCKER |

**完备性自检 = 像读代码一样扫**（每条对应一类代码缺陷）：

- 用了却没校验的输入 → 缺卫语句（uninitialized use）。
- 引入了却没出口的失败条件 → 漏分支（unhandled path）。
- 没人消费的产出 / 没来源的输入 → 悬空（dead code / undefined ref）。
- 到不了终点的路径 → 缺显式终止（no return）。

无分支的情形也要**显式写出**，别留白：纯线性写“无外部失败，唯一失败=目标不可读→BLOCKER”，而不是不写。

```text
WRONG: “判断输入是否合理；不合理就指出问题；然后逐条审；最后给结论。”
Reason: 散文糊成一团 —— 无有序步骤、无显式终止、“不合理”没写退出、校验与审挤在一条 happy path 上深嵌套。

GOOD :
  流程：prompt-review
  1. 读取目标。若既无路径也无内联文本 → 向用户要材料并退出。     # 卫语句·用前必校
  2. 规范化目标。文件→读全文记行号；内联→标记 inline-prompt.md。
  3. 若目标不含任何流程 → G 维不触发，继续。                    # 分支
  4. 逐条跑 A–G，命中即记一行 issue。
  5. 汇总为 REVIEW_PACKET（含 ledger）。
  6. 产出 REVIEW_PACKET，结束。                                # 显式终止
  失败出口：目标不可读→BLOCKER 并说明缺什么；运行时缺工具→降级本地审。
```

嵌套压平（深判断 → 派发 + 子流程，复杂度抽走而非堆在正文）：

```text
WRONG（3 层嵌套，漏掉的“否则”看不出来）:
  1. 判类型；若文件 → 若可读 → 若 md → … 否则 …；否则 …；若目录 → …；若内联 → …

GOOD（父层穷尽派发，深逻辑抽进子流程）:
  2. 按类型路由：文件→子流程「审文件」；目录→子流程「审目录」；内联→子流程「审内联」；
     否则 → 报 BLOCKER「未知输入类型」并退出。        # 派发·穷尽带兜底
  子流程「审文件」：1. 若不可读→报 BLOCKER 返回空  2. 读全文记行号  3. 跑 A–G 返回 issue
  子流程「审目录」：1. 列目录；空→返回空  2. 每文件→调「审文件」汇集(DRY)  3. 返回
```

---

## 已知边界

- 本 Skill 不证明 prompt 在生产中可用。
- 不跑行为 eval（除非运行时提供且用户要求）。
- 不审应用代码正确性。
- 不要求网络访问。
