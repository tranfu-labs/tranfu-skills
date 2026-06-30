---
name: openspec-driven-development
version: 0.5.1
description: >-
  在已经采用 OpenSpec 约定的项目里做日常开发执行时使用：把一个开发任务（新功能 / bugfix / 重构 / 加模块 / 改交互 / 排查并修 bug）
  跑成「识别并按进场点路由 → 采访或诊断澄清真实目标 → 先在聊天框出方案（改页面给字符图，落到 wireframes.md；含可测逻辑或单文件 diff>200 行给单测+AI验证用例）→
  从最新 main 切 feature 分支并落盘 openspec/changes → 反思方案 → 按 spec 写码 → 反思代码符合度 →
  归档（移动 change、合并 spec-delta、若有 wireframes.md 则回流到 docs/wireframes/）→ 更新 AGENTS.md → commit 到 feature 分支 → 有 remote 则推分支并开 PR（body 粘 proposal.md）」的闭环。
  触发于「做个功能」「加个 X」「改一下 Y」「重构 / 优化 Z」「开始开发」「开始写代码」「按 openspec 走一遍」等开发执行请求；
  也触发于咨询 / 讨论口吻的开发问题：「你会如何做 / 改 X」「能不能加 X」「讨论一下 X」「是不是要做成 Y 呀」「X 做在哪里」；
  以及 bug 讨论「为什么 X 不对 / 出问题」和进场点变体「实施 openspec/changes/<X>」「方案实施完了帮我检查是否符合方案 / 有无遗漏」。
  即使用户没点名 openspec，只要仓库里已有 openspec/ 目录就应主动用它。
  不要用于：非开发任务（纯查询 / 查资料 / 跑命令、以及与具体改动无关的「是否符合规范 / 标准」泛合规审计）；
  冷启动从零搭 AGENTS.md+openspec 骨架（那是 project-init-docs）；打 tag / 写 changelog / 版本号策略（那是 release）。
author: aquarius-wing
updated_at: 2026-06-30
origin: own
userInvocable: true
---

# OpenSpec 驱动的开发执行闭环

把一个开发任务从「需求」一路带到「代码落地 + 事实源归档」，**先有经确认的方案、再写代码、写完让事实源反映现状**。

这个 skill 的价值不在某一步，而在闭环本身：跳过方案直接写码会失控，写完不归档会让事实源慢慢失真。所以它的每一步都为同一个可观察结果服务——**方案、代码、事实源三者始终一致**。

**项目有两套事实源**（视项目而定）：

- `openspec/specs/<domain>/spec.md` 是**行为事实源**，靠 change 的 `spec-delta/` 流转更新。
- `docs/wireframes/`（若项目有）是**版式事实源**，靠 change 的 `wireframes.md`（本项目扩展，按需新建）流转更新。

归档时两套事实源一起更新——`spec-delta` 合并回 `specs/`，`wireframes.md` 回流到 `docs/wireframes/`。**项目级归档约定**写在 `openspec/changes/AGENTS.md`，**这个 skill 是它的执行口径**。

## 边界（和相邻 skill 的分工）

这个 skill 只管「**已在 openspec 约定下**的日常开发执行」——也包括咨询口吻的开发问题（「你会如何做 / 改 X」「X 做在哪里」）和 bug 讨论（「为什么 X 不对」），这些都从步骤 1 进。碰到下面的活，交出去、别自己干：

- 项目还没有 `openspec/`、要从零搭 AGENTS.md + openspec 骨架 → 停下，**主动提议**用 **project-init-docs**（见步骤 0）。
- 用户要打 tag / 写 changelog / 定版本号 → 交给 **release**。
- 非开发任务（问答、查资料、跑一条命令）→ 不触发，正常回答即可。
- **「符合」消歧**：问「代码是否符合**方案 / spec / 某个 change**」→ 这是步骤 6，触发；问「项目是否符合**规范 / 标准 / 约定**」这类泛合规审计 → 与具体改动无关，不触发。

## 工作流总览

```
步骤0 识别开发任务 + openspec 检测 + 进场路由
   ├─非开发───────────────────────────> 终止
   ├─无 openspec──────────────────────> 停下，主动提议初始化（project-init-docs）
   └─有 openspec，按开场分流：
       "实施 openspec/changes/X" ───────> 直接进 步骤5
       "实施完了，检查是否符合方案/遗漏" ─> 直接进 步骤6
       微改动 ─────────────────────────> 步骤1 快车道
       其余开发任务 / 开发问题 / bug 讨论 ─> 步骤1
   │
步骤1 采访 / 诊断澄清目标
   ├─结论：不需要改代码──> 给出诊断/解释/结论，结束
   └─结论：需要改代码────> 步骤2
   │
步骤2 聊天框出方案（字符图 / 测试用例）→ agent 自审 → 自动到步骤3
   │
步骤3 检测/切到 feature 分支（NEVER 在 main/master 写入）→ 落盘 openspec/changes/<change>/
   │
步骤4 反思方案 → ✓ plan-written（出方案 + 落盘 + 反思整体视为 plan-written 完成）
   │
步骤5 按 spec 写代码（在 feature 分支上） → ✓ code-written
   │
步骤6 反思代码符合度 ──偏差──> 回步骤5 改 ──通过──> ✓ code-verified
   │
步骤7 归档（按 openspec/changes/AGENTS.md 的「归档」节）：
       ① changes/<id>/ → changes/archive/<YYYY-MM-DD>-<id>/
       ② spec-delta 合进 openspec/specs/<domain>/
       ③ 若有 wireframes.md → 回流到 docs/wireframes/pages/<page>.md 与 flow.md
   │
步骤8 更新 AGENTS.md → git commit（feature 分支）→ 有 remote 则 push + 开 PR（body 粘 proposal.md）→ ✓ pr-opened
```

CREATE A TODO LIST 覆盖步骤 0-8，每步做完更新状态。**MUST 在步骤 0 末把推进计划（见下节）亮给用户、把"在哪状态停"接住，再开干**；除非推进计划里写了停在某个状态，否则全程自动衔接。

---

## 状态枚举与外部锚点（v0.5 起精简）

整条流水线只有 **6 个状态枚举**，给外部（用户在 prompt 里、上游 skill、流程编排）一个稳定锚点，可指定「跑到某个状态就停」或「在某个状态额外做点什么」。中间的机械动作（切分支、落盘、归档、commit、push）合并到上下游枚举里，用自然语言报告进度即可，不再单独命名。

**步骤 1 采访是 HARD STOP**——`interviewing` 必须等用户回答，agent 不能自审通过、不能替答、不能跳过。其余状态默认 agent 自审通过后自动衔接，是否要变成"等用户拍板"由步骤 0 的推进计划决定。

**最后的 `pr-opened` 是个特殊节点**：有 remote 时始终去做（push feature 分支 + `gh pr create`），不再"问用户要不要推"——PR 是 reviewer 的介入点，不该被绕开。但 **NEVER 自己合并 PR**，合并由 reviewer 拍板。

### 状态枚举表

| 状态 | 含义 | 覆盖步骤 | 默认行为 |
|---|---|---|---|
| `interviewing` | LLM 正在采访 / 诊断，等用户回答 | 步骤 1 进行中 | **天然等用户**（HARD STOP） |
| `interview-confirmed` | 采访结束，目标明确，进入分叉（不改代码 → end；要改代码 → 继续）| 步骤 1 末 | 自动 |
| `plan-written` | 方案出完 + 切 feature 分支 + 落盘 `openspec/changes/<change>/` + 反思通过 | 步骤 2 + 3 + 4 整体 | 自动（可被指定为停） |
| `code-written` | 按 spec 的代码（含落地测试）写完 | 步骤 5 末 | 自动（可被指定为停） |
| `code-verified` | 代码符合度反思通过、单测绿 / AI 验证流程跑通 | 步骤 6 末 | 自动（可被指定为停） |
| `pr-opened` | 归档（移目录 + 合 spec-delta + 必要时回流 wireframes）+ 更新 AGENTS.md + commit + 有 remote 则 push + 开 PR | 步骤 7 + 8 整体 | **有 remote 时始终走 PR**；无 remote 则在 commit 后结束 |

> 为什么不区分"进行中"和"完成"两套：除了 `interviewing` 是 HARD STOP 必须明示外，其他过程态（出方案中、写码中、验证中）agent 持续输出工具调用和文本本身就在告诉用户它在干活，不需要枚举名再标一遍。
> 为什么把切分支 / 落盘 / 反思 / 归档 / commit / push 都合并：这些是机械动作，不会有人想"停在切分支之后"。合并掉省了一半枚举，状态机简洁很多。失败时自然会报错，用户不需要枚举名也知道哪炸了。

### 推进计划的显示模板

**步骤 0 一定下进场点，MUST 先在对话里明示推进计划，再开干**——这是给用户最后一次「指定停在哪儿 / 加事」机会。三种形态：

**A. 默认（全自动衔接）**：

> 推进计划（步骤 1 采访会自然停下等你回答；其余自动衔接；最后有 remote 会推 feature 分支并开 PR）：
> `interviewing → interview-confirmed → plan-written → code-written → code-verified → pr-opened`

**B. 用户指定停在某状态**（例：prompt 里写「方案给我看一眼再写码」）：

> 推进计划（按你要求在 `plan-written` 后停下，由你拍板再写码）：
> `interviewing → interview-confirmed → plan-written ⏹停⏹ code-written → code-verified → pr-opened`

**C. 用户指定在某状态额外做事**（例：「在 `plan-written` 时同步把方案贴到 Slack」）：

> 推进计划（在 `plan-written` 触发额外动作：把方案贴 Slack）：
> `interviewing → interview-confirmed → plan-written ⨁[贴 Slack] → code-written → code-verified → pr-opened`

形态可组合（既指定停、又指定额外动作）。符号 `⏹` / `⨁` 不是硬约定——核心是**把状态枚举名写清楚**，让用户能精确指认是哪一步。

> 为什么默认自动而不是逐步问：原来每一步都问"要不要继续"，对一条已经达成共识的链路是冗余，最终演成"用户疯狂回车"。采访（`interviewing`）是 agent 没法替代的对话往返，必然停；其他节点 agent 能自审，默认就别打扰用户。需要在 `plan-written` / `code-written` / `code-verified` 等用户拍板的，由用户在 prompt 里显式指定即可。
> 为什么要枚举名：让外部能精确指认"在哪儿停 / 在哪儿加事"。"在第 3 步停"是脆弱的（步骤编号会随版本漂移），"在 `plan-written` 停"是稳定的。

---

## 步骤 0 · 识别 + openspec 检测 + 进场路由

先判断这是不是一个**开发相关任务**（要写 / 改代码，或讨论怎么开发、排查 bug）。不是（纯查询、研究、装 skill、审稿、与具体改动无关的合规审计、单独的 git 操作）→ 终止本流程，正常回应。

是开发相关，再查仓库根有没有 `openspec/` 目录：

- **没有** → **停下，不要自己搭骨架**，但要**主动提议**：当前项目还没初始化 openspec，建议先用 `project-init-docs`（或 `openspec init`）搭好 `openspec/specs` + `openspec/changes` + AGENTS.md。征得同意可引导 / 协助初始化，完成后再回来走这条流水线。
- **有** → 按开场**路由进场点**（穷尽，带兜底）：

| 开场判据 | 进场点 |
|---|---|
| `实施 openspec/changes/<X>`（spec 已写好，只差实现）| 直接进 **步骤 5** |
| `实施完了 / 已完成，检查是否符合方案、有无遗漏` | 直接进 **步骤 6** |
| 一两个文件、几行的微改动 | **步骤 1 快车道** |
| 其余开发任务 / 开发问题 / bug 讨论（含「为什么 X 不对」「你会如何做 X」）| **步骤 1** |
| 否则（判不准）| 先问用户一句确认意图，再决定进场点或终止 |

> 为什么停下而不自动搭骨架：搭骨架会写入大量约定文件、改变仓库结构，属于一次性脚手架决策，应由用户显式发起、且有专门的 skill 负责。这里只「提议 + 引导」，不擅自改仓库结构。
> 为什么要进场路由：真实开场常常不是从需求起步，而是「实施已写好的 change」「检查刚实施的符合度」「先讨论 / 诊断一个 bug」。硬把它们拽回步骤 1 会重复劳动或答非所问。

**步骤 0 末必做**：进场点定下后，**在对话里明示推进计划**（按上节「推进计划的显示模板」给出 A / B / C 形态之一）——把整条状态链亮出来，告诉用户哪些自动跑、哪些会停、是否带额外动作。这是给用户的最后一次「指定停在哪儿 / 加事」机会，**NEVER 跳过这一步直接进入步骤 1**。

---

## 步骤 1 · 采访澄清真实目标

> **⏸ HARD STOP：本步骤必须与用户对话。「自动推进」不覆盖这一步，agent 不能自审通过、不能替用户回答、不能一上来就出方案。**

目的是找到**项目 / 这次改动的真实目标**，而不是照着字面需求闷头做。采访时：

- 偏向**小而隔离的 spec**——把大需求切成边界清晰、能独立验证的小块，别一上来就铺一张大网。
- 关键决策**逼用户显式确认**，不要替他默认，避免漏掉他在意的取舍。
- **最后一个问题固定是**：「还有要补充的吗？」——直到用户明确说没有了，才进入步骤 2。

**问题型开场**（bug 讨论 / 开发问题，如「为什么 X 不对」「你会如何做 X」）进来时，步骤 1 是**诊断 + 澄清你到底想要什么结果**，不必非走完整的项目目标采访——先把问题定位清楚、把期望结果问明白。

**采访 / 诊断完，分叉**（这是给「问题型开场」留的出口，因为它不一定要改代码）：

- 结论 **需要改代码** → 进入步骤 2 出方案。
- 结论 **不需要改代码**（就是想搞懂 / 是预期行为 / 调个配置或用法就能解决）→ 给出诊断、解释或结论，**干净结束**——不强行造 openspec 变更、不写代码。

**快车道（小任务旁路）**：如果一眼看出这是一两个文件、几行就能完成的微改动，不要走完整采访。直接问用户「这个我可以直接改，要不要我直接动手？」——确认后跳过步骤 2-3 的重型方案，直接做改动。改完的去向写死，别留白：

- **动手前同样要做步骤 3a 的分支检测**：在 main 上 → 切 feature 分支再改；已在合适 feature 分支 → 复用；unrelated 分支 → 停下问。微改动也 **NEVER 直接 commit 到 main**。
- 仍走**步骤 6**（代码反思，对照用户口头需求核一遍）。
- **跳过步骤 7**：微改动没有 `openspec/changes` 文档可归档，不强行造一个。
- **步骤 8 照走**：有受影响的文档就更新 → `git commit`（feature 分支） → 有 remote 则推分支并开 PR；快车道**没有 proposal.md**，PR body 用 commit message + 一两句口头描述补充。
- **逃逸口**：动手中发现改动其实不小（碰了可测逻辑、远超几行、牵动多个文件）→ **立即停下回步骤 1** 走完整流程，别在快车道里硬塞。

---

## 步骤 2 · 在聊天框先出方案

**先把方案写在对话里**给用户看，不要直接落盘。方案要让一个高级程序员看明白整体逻辑即可——写哪几个文件、各自职责、业务线怎么串、有哪些测试案例——不必细到函数签名、数据结构。

两类必须附带的产物：

1. **改页面 / 有视觉版式变化 → 必须出字符图**（ASCII 线框），让用户在写码前就能确认版式。落盘时进 `changes/<id>/wireframes.md`（不进 `design.md`）；基线 MUST 引用 `docs/wireframes/pages/<page>.md`，NEVER 引用其他 change 的 `wireframes.md`。
2. **测试门槛（见下表）触发 → 必须出单元测试用例 + AI 验证流程用例**（AI 验证 = 用 playwright 截图 / 手动跑一遍 / 跑命令看输出这类可由 agent 执行的验证步骤）。

方案出完后, agent 以审稿人视角自审一遍, 没问题就直接进入步骤 3 落盘; 有不确定项才问用户。聊天框方案 + 落盘 + 反思整体合成一个 `plan-written` 状态——除非推进计划指定停在 `plan-written`, 否则不需要用户单独拍板。

### 测试门槛

| 改动情形 | 要求 |
|---|---|
| 含**可测逻辑**（纯函数 / 数据转换 / 解析 / 状态机 / 跨文件契约）| **必须有单元测试，与行数无关**——30 行的金额计算也要测 |
| 单文件改动 **diff > 200 行**（任意类型）| **强制停下，逐文件做可测性评估**，在方案里回答每块"要不要测"；若"该测却不方便测"→ 方案**必须**包含拆分 / 重构使其可测的设计 |
| 纯展示 / HTML / CSS / 文案（哪怕 > 200 行且无逻辑）| 记录豁免理由，走 AI 验证流程即可，不强制单测 |

> 为什么"不方便测就改架构"：一段逻辑测不了，几乎总是因为它把业务逻辑和 IO / DOM / 视图耦合在了一起。正确解法是拆开让它可测，而不是给测试开后门。行数（200）只是触发这场评估的警戒线，不是"要不要测"的唯一裁判——别让 250 行的纯 CSS 被逼着写单测。

---

## 步骤 3 · 切到 feature 分支 + 落盘方案

这里是**对仓库的第一次写入**，所以要先把分支隔离做对，再落盘。

### 3a. 检测当前分支状态

聊天框方案 agent 自审通过后，落盘前第一件事是 `git status` / `git branch --show-current`，按下表分流：

| 当前分支 | 处理 |
|---|---|
| **主分支**（`main` / `master` / 项目约定的主干）| `git fetch origin && git checkout -b <branch> origin/main` 从最新 `origin/main` 切出 feature 分支。**NEVER 在主分支上直接写入 `openspec/changes/`**。|
| **已为本 change 准备的 feature 分支**（分支名含 change-id，或本分支已有 `openspec/changes/<change-id>/` 的痕迹）| **复用**，跳过建分支动作，直接进入 3b。也别为同一 change 再切一个新分支。|
| **unrelated feature 分支**（在做别的 change，与本 change 无关）| **停下问用户**：是要在当前分支上接着做（合并到那个 PR）、还是 stash 后切回 main 重开新分支？得到答复再继续，**NEVER 擅自落盘**。|
| **detached HEAD / 工作区有未提交的不相关改动** | 停下问用户怎么处理，别擅自切。|

**分支命名建议**：用 change-id 当后缀，例如 `change/<change-id>` 或 `feat/<change-id>`——按项目既有约定优先。

> 为什么不在主分支写：openspec/changes 写入 + 后续代码改动 + spec/wireframes 归档都是 PR 的一部分；让它们全部落在 feature 分支，PR diff 就是「方案 + 实现 + 事实源更新」的完整故事，reviewer 一眼能看完。
> 为什么要检测复用：步骤 0 进场点是「实施 openspec/changes/X」时，用户大概率已经在那个 change 的分支上了——再切一次只会建出空分支或脏分支。

### 3b. 落盘 `openspec/changes/<change-name>/`

确认分支无误后，按 openspec 规范写：

- 变更提案（proposal）+ 设计权衡（design）+ 任务拆解（tasks）+ spec-delta。
- **方案里有字符图 → 写进 `wireframes.md`**（本项目扩展，按需新建；多页用 `## pages/<page>.md` 小节区分）。**NEVER 塞进 `design.md`**——design 管"怎么实现/权衡/风险"，字符图是版式制品，类型不同。
- **NEVER 在 `tasks.md` 里写「归档时回流 wireframes」这种项目级动作**——归档约定写在 `openspec/changes/AGENTS.md`，每个 change 不重复。

保持和项目已有 openspec 约定一致的文件命名与结构。

---

## 步骤 4 · 反思方案 → 标记 `plan-written` → 进入写码阶段

落盘后，**以审稿人视角重读方案**找遗漏：

- 有遗漏 → 直接改方案。
- 有不确定项 → 问用户，别自己拍板。
- 没问题 / 问完了 → 整个步骤 2-4 合成的 `plan-written` 状态视为完成。

`plan-written` 后默认自动进入步骤 5，不再单独问用户「是否开始写代码？」。推进计划指定停在 `plan-written` 时才停下等用户口令——用户说**「开始写代码」**（或等价明确指令）进入步骤 5；提了别的事按新指令做，该排期的新需求记一条**临时插入的 TODO**别丢。

> 为什么默认不硬等：之前每次都强行问"是否开始写代码"，对一条已经走过采访 + 方案确认的链路是冗余。把"什么时候让用户介入"交给步骤 0 的推进计划——用户想看就指定停在 `plan-written`，不想看就不指定。

---

## 步骤 5 · 按 spec 写代码

> **若从步骤 0 直接进来（「实施 openspec/changes/X」）**：先确认 `openspec/changes/<X>/` 确实存在且方案完整——它存在意味着方案此前已被确认过，可直接实现；**不存在或残缺 → 回退步骤 1/2** 先把方案补全、确认，再实现。

严格按 `openspec/changes/<change>/` 里的方案写。方案里定义了的测试用例，这一步要真正落地成可运行的测试。

---

## 步骤 6 · 反思代码符合度

> **若从步骤 0 直接进来（「实施完了，检查是否符合方案」）**：先定位对应的 change 方案文档（在 `openspec/changes/` 或已归档的 `archive/`）作为对照基准；**找不到基准 → 问用户指明是哪个 change**，别凭空判符合度。

写完后对照方案逐条核：**代码是否完整实现了方案、有没有偷工或跑偏**。

- 有偏差 / 遗漏 → 回步骤 5 补齐。
- 完全符合、测试通过（单测绿 / AI 验证流程跑通）→ 进入步骤 7。

---

## 步骤 7 · 归档（事实源回流）

闭环的收尾，**不能省**。本步是 `openspec/changes/AGENTS.md` 的「归档」节的执行口径——**MUST 完成下面三步，缺一不算归档**（具体顺序以项目内该文件为准）：

1. **移动 change 目录**：`openspec/changes/<change-id>/` → `openspec/changes/archive/<YYYY-MM-DD>-<change-id>/`（按项目既有归档约定）。
2. **合并 spec-delta → specs**：把 `spec-delta/` 下对应业务域的增删改合并进 `openspec/specs/<domain>/spec.md`——让**行为事实源**反映改完之后的现状。
3. **回流 `wireframes.md` → `docs/wireframes/`**（仅当本 change 有 `wireframes.md` 时）：把字符图回填到 `docs/wireframes/pages/<page>.md`；流转变化同步进 `docs/wireframes/flow.md`——让**版式事实源**反映改完之后的现状。**与第 2 步同等地位，NEVER 省略**。

> 为什么必须做：`openspec/specs` 和 `docs/wireframes/` 分别是项目的**行为事实源**与**版式事实源**。只改代码不更新它们，下一次开发就会基于过时的事实源做决策（画字符图找不到当前基线、读 spec 看到失真规则）。归档是让闭环真正闭上的那一步。
> 项目没有 `docs/wireframes/` 或本 change 没有 `wireframes.md` → 第 3 步天然跳过；不要为不需要回流的 change 强造一个 `wireframes.md`。

---

## 步骤 8 · 更新文档 + commit + 提 PR

- 更新 **AGENTS.md** 里受这次改动影响的部分（模块职责、约定、入口等）。
- `git add` + `git commit` 到 **feature 分支**（commit message 讲清这次变更做了什么、对应哪个 change）。**NEVER 切回 main 提交、NEVER 直接 commit 到 main**。
- 检查 remote：
  - **有 remote**：始终走 PR，**不再 "问是否 push"**——
    1. `git push -u origin <branch>` 推 feature 分支。
    2. 在写 body 之前，**扫一遍当前对话上下文里有没有 issue 编号**（用户消息出现 `#123`、"issue 123"、"修复/关闭/解决 issue 123"、或粘过 GitHub issue 链接）：
       - **有** → PR body **第一行**写 `Closes #<编号>`（多个用逗号分隔或多行），空一行后再接 proposal.md 正文。命令示例：
         ```
         gh pr create --title "<commit message 第一行>" \
           --body "$(printf 'Closes #<编号>\n\n'; cat openspec/changes/archive/<YYYY-MM-DD>-<change-id>/proposal.md)"
         ```
       - **没有** → 退化回原命令：`gh pr create --title "<commit message 第一行>" --body "$(cat openspec/changes/archive/<YYYY-MM-DD>-<change-id>/proposal.md)"`。
       **PR body 主体直接粘 proposal.md**，因为 proposal 本来就是 why / what / impact，正好是 PR 描述，无需二次编辑。
    3. 把 PR URL 回报给用户。
    4. **NEVER 自己合并 PR / 自己 merge 到 main**——合并由 reviewer 拍板。
  - **没有 remote**：本地 commit 到 feature 分支即结束；告诉用户没法提 PR（兑现 `pr-opened` 闸门的「无 remote 跳过」分支）。

> 为什么 PR 取代直接 push：直接 push 到主干等于让 reviewer 在事后看到既成事实——PR 是 reviewer 唯一的介入点，把它省掉等于把 code review 这层防御也省掉。把这一步设成始终走 PR（而不是 "问是否 push"），就是因为「问 push」太容易顺嘴答 "好"，而 PR 的存在本身才是约束。
> 为什么 body 直接粘 proposal.md：proposal 已经讲清了 why（动机）、what changes（改了什么）、impact（影响范围），这就是 PR description 该写的内容。再让 agent 二次概括只会失真，不如直接粘。

---

## 失败路径

- **不确定是不是开发任务 / 进场点判不准** → 先问用户一句确认意图，别默认进流程或猜进场点。
- **openspec/ 缺失** → 停在步骤 0，主动提议并（经同意后）引导初始化，NEVER 擅自搭骨架改仓库结构。
- **没出方案就被要求写码** → 没有 `plan-written` 就不可能写码。提醒用户先出方案、回步骤 2；除非用户明确说"跳过方案直接写"。（注：`plan-written` 默认 agent 自审通过，不需要用户每次拍板——这是"自动推进"的设计，不是"绕过方案"）
- **测试该写却"不方便测"** → 不是跳过测试的理由，而是回到方案改架构使其可测（步骤 2 测试门槛）。
- **写到一半发现方案有硬伤** → 停下回步骤 2 修方案、重新确认，别将错就错继续写。
- **当前在 main 上，已经误改了文件** → 别直接 commit。`git stash` → 切 feature 分支 → `git stash pop` → 再继续；改动彻底没必要时 `git checkout -- <file>` 丢弃。
- **当前在 unrelated feature 分支上，但用户没明确同意"在此继续做"** → 停下问，**NEVER 擅自落盘** openspec/changes 或写代码——会污染另一个 PR。
- **没有 GitHub remote、`gh` 用不了**（用 GitLab / Gitea / 自建）→ 用对应平台的 PR / MR 命令（如 `glab mr create`），或本地完成、把分支推上去后让用户去网页开 PR；NEVER 因此降级回 "直接 commit 到 main"。

## 防错红线

- NEVER 跳过方案直接写代码——`plan-written` 必经，方案必须落盘到 `openspec/changes/`。
- NEVER 在推进计划里指定停在 `plan-written` 的情况下，用户没说"开始写代码"就动代码。
- NEVER 在没有 openspec 的项目里自己搭骨架——停下引导 project-init-docs。
- NEVER 因"不方便单测"就跳过测试——改架构使其可测。
- NEVER 漏掉闭环收尾：写完代码必须按步骤 7 完成归档——移动 change、合并 spec-delta、**有 `wireframes.md` 时必须回流到 `docs/wireframes/`**——再走步骤 8 更新 AGENTS.md。漏回流 wireframes 等于让版式事实源失真，与漏合并 spec-delta 同等严重。
- **NEVER 在 main / master / 项目主干分支上做任何写入**——包括 openspec/changes 落盘、代码改动、归档动作；步骤 3a 的分支检测必须做。
- **NEVER 直接 push 到主干**；NEVER 自己合并 PR——开 PR 是 reviewer 的介入点，合并由 reviewer 拍板。
- NEVER 在 unrelated feature 分支上擅自落盘——会污染别人的 PR；停下问用户。
- NEVER 在步骤 0 不明示推进计划就闷头进入步骤 1——用户没机会指定"在哪儿停 / 在哪儿加事"，自动推进就退化成失控。
- NEVER 把"自动推进"理解成"连步骤 1 采访也跳过"——`interviewing` 是 HARD STOP，对话往返本身是 `interview-confirmed` 状态的兑现过程，没法替用户答。

---

## 示例

<example>
用户：「给卡片导出加一个『一键导出全系列』的功能。」

流程：
1. 步骤0：是开发任务；仓库有 `openspec/` → 继续。**明示推进计划（默认形态）**：
   > 推进计划（步骤 1 采访会自然停下等你回答；其余自动衔接；最后有 remote 会推 feature 分支并开 PR）：
   > `interviewing → interview-confirmed → plan-written → code-written → code-verified → pr-opened`
2. 步骤1（`interviewing`）：采访——「全系列指当前预览里的所有卡片还是某个目录下的？导出命名规则？失败的卡片是跳过还是中断？」最后问「还有补充吗？」用户确认无补充 → ✓ `interview-confirmed`。
3. 步骤2：聊天框出方案——新增 `scripts/export-all.mjs`（遍历系列、复用单卡导出逻辑），改 `app.html` 加一个按钮（**有视觉变化 → 附字符图，基线引用 `docs/wireframes/pages/app.md`**）。导出逻辑含可测的文件名生成 / 系列遍历（**可测逻辑 → 附单测用例**：文件名生成、空系列、部分失败），再附 AI 验证流程（playwright 跑一遍导出、截图核对产物数量）。
4. 步骤3：先做分支检测——`git branch --show-current` 显示在 `main` → `git fetch origin && git checkout -b change/add-export-all origin/main`。再写入 `openspec/changes/add-export-all/`（proposal + design + tasks + spec-delta + **wireframes.md 含字符图**）。
5. 步骤4：反思方案，发现没定义"部分失败时是否继续"——这是不确定项，**回去问用户**、得到回答后补进方案 → ✓ `plan-written`。推进计划默认没指定停在 `plan-written` → 自动放行进入步骤 5。
6. 步骤5-6：按 spec 实现 → ✓ `code-written`；单测绿、playwright 验证导出数量正确 → ✓ `code-verified`。
7. 步骤7：按 `openspec/changes/AGENTS.md` 的「归档」节三步并列——① `add-export-all/` 移到 `archive/2026-06-29-add-export-all/`；② 导出能力的 delta spec 合进 `openspec/specs/export/`；③ `wireframes.md` 的字符图回流到 `docs/wireframes/pages/app.md`（按钮变更同步进 `flow.md` 相关流程节）。
8. 步骤8：更新 AGENTS.md 的脚本清单 → `git commit` 到 `change/add-export-all` 分支 → `git push -u origin change/add-export-all` → `gh pr create --title "<commit message 第一行>" --body "$(cat openspec/changes/archive/2026-06-29-add-export-all/proposal.md)"` → ✓ `pr-opened`，把 PR URL 回报给用户。**不自己合并**。
</example>

<example>
用户：「为什么我删一个操作员，下面删除预览里却列出了一大串操作员？我们先讨论清楚再决定动不动手——别急着写码。」

流程（问题型开场 + 用户指定停顿，可能不改代码）：
1. 步骤0：是 bug 讨论、仓库有 `openspec/` → 路由进 **步骤 1**（不是从需求起步）。用户 prompt 里说「先讨论清楚」≈ 跑到 `interview-confirmed` 就停，**明示推进计划（B 形态）**：
   > 推进计划（按你要求在 `interview-confirmed` 后停下，先把诊断结果摆给你再决定要不要改）：
   > `interviewing → interview-confirmed ⏹停⏹ plan-written → code-written → code-verified → pr-opened`
2. 步骤1（`interviewing`）：诊断——读删除预览的查询逻辑，定位到"预览把同组关联操作员一并列出"。澄清期望结果：「你是觉得根本不该显示这些，还是显示但要标清它们是关联项？」
3. 分叉（→ ✓ `interview-confirmed`）：
   - 用户说「哦原来是关联项，预期的，不用改」→ **给出解释、干净结束**，不写 openspec、不改代码。
   - 用户说「应该只显示目标本人」→ 结论=需要改 → 进 **步骤 2** 出方案，走正常闭环。
</example>

<bad-example>
用户：「给卡片导出加一个『一键导出全系列』的功能。」

WRONG 的做法：
- 直接开始写 `export-all.mjs` 和改 `app.html`，跳过采访和方案。
- 写完就说"做好了"，没写任何测试。
- 没把变更落到 `openspec/changes`，也没归档 delta spec 到 `openspec/specs`。
- 在 `main` 分支上直接 `git commit` + `git push origin main`，没开 PR。

为什么错：跳过方案 = 用户没机会在写码前纠偏（比如他其实只想导出当前预览那几张）；不写测试 = 文件名生成 / 部分失败这些可测逻辑无保障；不归档 = `openspec/specs` 与代码现状脱节，下次开发踩坑；直接推 main = 越过了 PR review 这层防御，reviewer 在事后看到既成事实。这个 skill 存在的全部意义就是堵住这四个口子。
</bad-example>

<bad-example>
用户：「给卡片导出加一个『一键导出全系列』的功能。」（**没在 prompt 里指定停在哪儿**）

WRONG 的做法：
- 出完方案在聊天框问「方案 OK 吗？要我落盘吗？」等用户回。
- 落盘后又问「要我开始写代码吗？」等用户回。
- 每个反思 / 归档环节都停下来问「要我继续吗？」

为什么错：用户没指定停在 `plan-written` / `code-written` / `code-verified`，按推进计划默认形态就该 agent 自审通过后自动推进，硬等用户拍板是把"自动推进"重新降级回 v0.3 的"逐步问"。**真要让用户审，让他在 prompt 里写「停在 plan-written」**——把控制权交给推进计划，而不是 agent 替用户做"安全起见还是问一下"的选择。**唯一该天然停的是**：`interviewing`（对话往返必然停）。最后开 PR 这一步则始终走（不是"停"，是"始终去做"）——直接推 main 反而是错的。
</bad-example>
