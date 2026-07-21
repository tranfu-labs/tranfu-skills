---
name: prd-to-parallel-loop
display_name: PRD Parallel Loop Scaffolding
display_name_zh: PRD 并行 Loop 脚手架
description: |
  在已有 openspec 惯例的项目里,把一份 PRD / 产品文档 / 里程碑文档搭成「多 git worktree + codex 并行执行 + 主 loop (Claude) 心跳调度」的完整脚手架。**一个 openspec change = 一个并行任务**,每个任务由主 loop 分三段驱动(实施 → 反思 → 归档)。产物包括:N 个 openspec/changes/<change-id>/、~/dev-loops/<project>/<slug>/ 运行时状态目录、以及一段用户复制到新对话就能触发 /loop 的启动语。

  Trigger for: 用户说"把这个 PRD 做出来 / 把 docs/product/pages/xxx.md 落地 / 把这份产品文档实现了 / 把 docs/roadmap/milestone-N-xxx.md 跑起来 / 按这个里程碑并行做 / 从这份 PRD 起搞成并行 loop / 把这批 change 丢到 worktree loop 里跑 / 给这个里程碑做 loop",或者用户丢来一份 PRD / 里程碑文件路径 + 说"实现这个 / 做出来 / 落地 / 拆一下 / 跑起来"。任何"从产品文档或里程碑到并行 loop"意图的自然表达都应该触发。

  Do NOT trigger when: 用户只想编写或评审 PRD / 里程碑文档(走 credibility-review 或 project-init-docs);项目无 openspec/ 目录且用户也没装 openspec-driven-development(应该提示先建 openspec 惯例);拆出来只有一个 change(那是单个变更,走 openspec-driven-development);runtime.json 已存在且 heartbeats.total > 0 表示 loop 已在跑(要求手动清理旧状态后重来,skill 不做 update);用户只想跑一个 codex 任务没有产品文档起点;用户要求把 PRD 直接编译成代码不经过 openspec change。
version: 0.3.0
author: aquarius-wing
updated_at: 2026-07-21
origin: own
allow_exec: true
---

# prd-to-parallel-loop

## 这个 skill 做什么

把一批要并行开发的变更搭成可跑的 loop 脚手架。**核心对应关系:一个 openspec change = 一个并行任务 = 一个 git worktree = 一个 codex 会话。**

```
PRD / 产品文档  或  里程碑文档 (docs/roadmap/milestone-N-xxx.md)
   ↓  切分与依赖协商(里程碑文档里已经写好就沿用,不重写)
openspec/changes/<change-id>/ × N            ← 变更单元 = 并行单元
   ↓  一个 change 一个 worktree
~/dev-loops/<project>/<slug>/runtime.json    ← 依赖 DAG 与调度状态的事实源
   ↓  /loop 心跳
主 loop 分三段驱动每个任务:实施 → 反思 → 归档 → 自己 squash merge 落地
```

跑完 skill,用户在新对话粘贴 loop-prompt.md 里那段 + `/loop` 就能开跑。

### 为什么是 change 粒度,不是 change 内的 task 粒度

change 是 openspec 里"一个连贯的变更提案",也是天然的可归档单元。把一个 change 切成 N 份丢给 N 个互相看不见的 codex,等于把提案的内部一致性交给并发去赌,还会让 N 个执行者共写同一份 tasks.md 与 spec-delta。按 change 并行则每个 worktree 自成闭环:codex 在里面走完 openspec-driven-development 的步骤 5→7,产出的 spec-delta 走标准路径,归档动作也在它自己手里。

### 任务的三段式生命周期

主 loop 每次心跳只推进一段,段与段之间是调度器的检查关:

| 段 | 谁做 | 内容 |
|---|---|---|
| `implement` | codex(spawn) | 按 change 定义写码,勾自己的 tasks.md,写 spec-delta |
| `reflect` | codex(resume) | 对照 proposal/design/tasks 核**有无遗漏**与**有无多做**,有则改 |
| `archive` | codex(resume,**已 rebase 到最新 main 之后**) | spec-delta 合进 specs/、change 移进 archive/ |
| 落地 | 主 loop(不占独立心跳) | squash merge → 核对归档结果 → **在合并后的工作区**跑验证 → 勾里程碑那一行 + 写证据锚 → commit |

rebase 卡在 archive 之前,是因为归档要写 `openspec/specs/<domain>/spec.md`——多 worktree 并行时唯一的共享写点。让它在最新 main 上做,冲突提前摆到 codex 面前解掉。

### 落盘范围(ownership: edit-file)

本 skill 会**直接写入用户文件系统**。写盘范围仅限:

- `{{PROJECT_REPO}}/openspec/changes/<change-id>/` × N(从项目 `openspec/changes/_template/` 拷贝再填)
- `~/dev-loops/bin/` 下的 3 个 `.mjs`(已存在则跳过,永不覆盖)
- `~/dev-loops/<project-name>/<slug>/` 下的 runtime.json / loop-instructions.md / loop-prompt.md /(必要时)acceptance-map.md

**绝不写用户的里程碑文档或 PRD**。里程碑文档是人类文档,skill 只读它;唯一的写入发生在 loop 跑起来之后、由主 loop 在落地时勾对应那一行 checkbox 并追加证据锚——那是运行时行为,不是本 skill 的落盘。

也绝不修改 `openspec/changes/_template/`、git 历史、产品代码,或已在跑的 runtime.json。

## 这个 skill 不做什么

- **不代替产品文档写作**。PRD / 里程碑文档怎么写、验收怎么定,由用户与 credibility-review / project-init-docs 负责。**尤其不给里程碑文档规定格式**——skill 尽力解析,解析不到就问
- **不代替 codex 里的实现判断**。怎么写代码、用什么工具验证,是 codex 的事;skill 只保证它拿到清晰的 change 定义、明确的验证命令、清楚的分段规范
- **不建 openspec 骨架**。项目缺 openspec/ 就打回,让用户先走 openspec-driven-development
- **不接单个 change**。拆出来只有一个 change 就打回:不值得起 loop,直接走 openspec-driven-development
- **不推送、不合并到远端**。主 loop 只本地 squash merge 到 main;push 是用户人工决定
- **不做 update 模式**。runtime.json 已在跑就拒绝重建;强行覆盖会丢失 phase / attempts / merged_sha / codex_session_id 等运行时数据

## 状态枚举与进场路由

整条流水线四个状态,给用户一个稳定锚点,可指定「跑到某个状态就停」或「放行某个默认停点」。

| 状态 | 含义 | 覆盖步骤 | 默认行为 |
|---|---|---|---|
| `起点确认(source-confirmed)` | 预检通过 + 输入文档定位 + 项目形态与验证命令探明 | 步骤 0 | 自动 |
| `任务清单已定(worklist-fixed)` | change 切分、依赖 DAG、验收落点三者定版 | 步骤 1 | **默认停**,等用户说"就这么拆";沿用里程碑且信息完整时自动跳过 |
| `change已落盘(changes-written)` | N 个 `openspec/changes/<id>/` 骨架就位 | 步骤 2 | 自动 |
| `运行时就绪(loop-armed)` | bin + runtime.json + loop-instructions + loop-prompt 就位 | 步骤 3-5 | **本 skill 终点**,输出启动语 |

其后的 `里程碑完成(milestone-done)` 是主 loop 的事,给名字只为让用户能精确指认。

**步骤 0 末必做**:进场点定下后,在对话里明示推进计划,把状态链亮出来、标清哪些自动跑哪些停。例:

> 推进计划(里程碑清单可直接解析,跳过协商;change 落盘后自动装运行时):
> `起点确认(source-confirmed) → 任务清单已定(worklist-fixed) → change已落盘(changes-written) → 运行时就绪(loop-armed)`

### 进场路由(穷尽,带兜底)

| 开场判据 | 进场点 |
|---|---|
| 给了里程碑文档,其中 change 清单可解析、依赖与验收编号完整 | **跳过协商,直接步骤 2**(`worklist-fixed` 自动达成) |
| 给了里程碑文档,但清单缺依赖 / 缺验收编号 / 根本没有清单 | **步骤 1,只补缺口**——把解析结果和缺什么摊给用户,补上的信息写进 runtime.json,**不回写里程碑文档** |
| 只给 PRD,没有里程碑文档 | **步骤 1 全程协商**(验收落点表 → change 切分 → 依赖) |
| 目标 change 目录在 `openspec/changes/` 下已全部存在 | **跳到步骤 3**,只补运行时;已存在的 change 一个字不改 |
| 解析 / 协商出来只有 1 个 change | **打回**:不值得起 loop,建议直接走 openspec-driven-development |
| runtime.json 存在且 `heartbeats.total > 0` | **拒绝**:loop 已在跑或有残留,要求手动清理 |
| 判不准 | 先问用户一句确认意图,再定进场点 |

## 预检(在真正做任何事之前)

按顺序快速检查,任一失败就先解决:

1. **openspec-driven-development skill 已安装** —— codex 在 worktree 里执行的三段直接引用它的步骤 5/6/7。检查 available-skills 里有没有 `openspec-driven-development`。缺失就告诉用户先装
2. **项目根有 `openspec/` 且含 `changes/_template/`** —— `test -d {{PROJECT_REPO}}/openspec/changes/_template`。缺失就打回,让用户先走 openspec-driven-development
3. **输入文档可读** —— 用户给了路径就用;否则按 `docs/roadmap/milestone-*.md` → `docs/product/pages/` → `docs/product/prd.md` 的顺序猜,列候选让用户确认。都找不到就问绝对路径,**不猜需求**
4. **codex CLI 可用** —— `which codex` 有输出
5. **`~/dev-loops/<project>/<slug>/runtime.json` 不存在或 `heartbeats.total == 0`**
6. **`{{PROJECT_REPO}}` 是 git 仓库** —— `git -C {{PROJECT_REPO}} rev-parse --show-toplevel` 成功。本 skill 依赖 git worktree

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW,一 TODO 一步:

0. 预检 6 项 + 探测起点 + 明示推进计划
1. 任务清单定版(沿用里程碑 or 从 PRD 协商)
2. 落 N 个 openspec change
3. 落 dev-loops 通用工具
4. 落运行时状态
5. 输出结果给用户

每步完成再更新对应 TODO;任一步进入失败路径直接结束流程,不继续后续 TODO。

### 步骤 0 · 起点确认

并行执行:

- 读输入文档全文(> 2000 行分段读)
- `ls {{PROJECT_REPO}}/openspec/changes/` 看已有哪些 change(含 `archive/` 下的,判断哪些已完成)
- `ls {{PROJECT_REPO}}/openspec/specs/` 看有哪些 domain,以备分配 spec-delta
- 探测包管理器与验证命令(见步骤 4 的 `verify_commands` 生成规则)
- 定 slug:有里程碑文档就取文件名主干(`milestone-5-main-conversation`);没有就与用户约定一个(通常是产品概念名)
- 定 `{{MILESTONE_SHORT}}`:里程碑文件名里有编号就取 `m<N>`(如 `m5`),否则取 slug 前两段。用作分支名前缀 `loop/<short>/<change-id>`,短一点方便看

按上面的路由表定进场点,**明示推进计划**,再开干。

### 步骤 1 · 任务清单定版

产出三样东西:**change 列表、依赖 DAG、每个 change 覆盖的验收编号**。它们最终固化进 runtime.json——**依赖 DAG 只认 runtime.json**,主 loop 不从里程碑文档同步依赖。

#### 1a. 沿用里程碑文档(用户已有里程碑时的主路径)

解析里程碑文档,尽力从任何形态里认出 change 清单:markdown checkbox 列表、表格、有序小节标题都行。对每一项抽取:

- change-id(反引号包住的 kebab-case 标识,或小节标题派生)
- 一句话标题
- 覆盖的验收编号(`#8 #9` 这类)
- 依赖(指向别的 change-id)

**解析结果 MUST 原样回显给用户确认**,包括"从哪一行读出来的"。然后只针对**缺口**提问:

- 缺依赖 → 问"这几个之间有先后吗",答案写进 runtime.json
- 缺验收编号 → 问,或从 PRD 对照;实在没有就留空并在最终输出里标出来
- 清单里的 change-id 与 `openspec/changes/` 下已有目录重名 → 摊出来问是沿用还是换名
- 已经打了 `[x]` 的项 → 视为已完成,runtime 里直接标 `done`,不调度(支持中途接手)

**NEVER 回写里程碑文档**。补上的信息只进 runtime.json。里程碑文档是用户的人类文档,skill 没有改写它的授权;唯一的例外是 loop 跑起来后主 loop 勾那一行 checkbox。

#### 1b. 从 PRD 协商(没有里程碑文档时)

CRITICAL: 这条路径必须与用户来回互动,**永远不要**跳过直接把候选拆分落盘。

**先做验收落点表**——在抛出任何候选 change 之前,MUST 先把 PRD 的验收标准横着摊开,逐条回答"这条最终由哪个持久化字段 / 哪个进程边界 / 哪个模块承载"。这一步只能一次性看全,拆成 change 之后就再也没人做了。

对 PRD「指标与验收」里的**每一条**编号,产出一行:

```
| 验收 | 落点(持久化字段 / 进程边界 / 模块) | 现状 | 归属 change |
| --- | --- | --- | --- |
| #8  | 上次使用团队记录文件 + 新建对话预选读取 | 已存在 | `xxx` |
| #10 | 会话表的团队列 + IPC 透传 + 会话视图发送闸门 | **不存在** | `yyy` |
```

判定规则:

- **落点已存在** → 正常归进某个 change
- **落点不存在** → MUST 成为一个**独立的前置 change**,并成为所有依赖它的 change 的 `depends_on`。NEVER 把"落点不存在"的验收塞进某个界面 change 的子任务里
- **写不出落点** → 这条验收要么表述不可实现,要么缺前置设计,MUST 提出来让用户裁决,NEVER 含糊带过

关键提问是:**"这条验收所说的状态,现在存在于哪里?"** 答案是"要新建一个字段/表列/接口",它就得先有自己的 change;答案含糊成"界面上那个选中的东西",执行者几乎一定会把它接到手边最像的现有状态上——这正是"打勾了但功能没实现"的产生机制。

落点表存到 `{{STATE_ROOT}}/acceptance-map.md`(不写进用户仓库),并把**每个 change 负责的那几行**抄进该 change 的 `design.md`。

**再抛候选 change 切分**:

```
提议拆成 N 个 change(欢迎逐条改):

- `<change-id-1>` — <一句话标题>
  覆盖验收: #8 #9   依赖: 无
- `<change-id-2>` — <一句话标题>
  覆盖验收: #10     依赖: <change-id-1>
```

粒度判据:**每个 change 要能在一个 worktree 里独立跑完、独立验证、独立归档**。跨 change 的共享改动(共享类型、共享工具函数)要么归进最早那个 change,要么单独成为一个前置 change,不要让两个并行 change 都去改同一个文件。

若 PRD 有明显冲突需求(现状说"按状态排序",PRD 说"按创建时间排序"),显式提出让用户裁决,不擅自选一边。

讨论完让用户明确说"这就落"或"OK"再进步骤 2。允许用户中断说"你决定"——那就把候选写成 `{{STATE_ROOT}}/pending-worklist.md`,停在这里等确认,**不擅自落 openspec**。

### 步骤 2 · 落 N 个 openspec change

对定版清单里每个还不存在的 change:

```bash
cp -R {{PROJECT_REPO}}/openspec/changes/_template \
      {{PROJECT_REPO}}/openspec/changes/<change-id>
```

然后按定版结论填四文件:

- **proposal.md**: 背景(现状差距) / 提案(打算怎么改) / **影响(哪些模块、对外行为)**。影响段在并行场景里格外重要——reflect 段的"有无多做"就是拿它当基准核 diff 的
- **design.md**: 本 change 负责的**验收落点行**(从落点表抄过来) / 方案(关键决策 3-5 条) / 权衡 / 风险
- **tasks.md**: 按 openspec 惯例的嵌套 checkbox,写这个 change 内部的实现步骤。**落盘时一律留空 `[ ]`,由 codex 在自己 worktree 里推进时自己勾**——这是它的实现步骤,不是完成判定
- **spec-delta/<domain>/spec.md**: 落盘时**只建骨架**(文件头 + 域名),Requirement 由 codex 在 implement 段写

`<domain>` 从 `openspec/specs/` 下现有的域里选。两个并行 change 尽量不落在同一个 domain——真要撞上,在 runtime 的 `depends_on` 里给它们排个先后,别让两个 worktree 同时改一份 spec.md。

**已存在的 change 目录一个字不改**。这条覆盖两种情况:用户手写过的、上一轮 loop 留下的。

### 步骤 3 · 落 dev-loops 通用工具(全局共享,已存在则跳过)

```bash
mkdir -p {{DEV_LOOPS_BIN}}
for f in spawn-codex.mjs resume-codex.mjs probe-codex.mjs; do
  target={{DEV_LOOPS_BIN}}/$f
  if [ ! -f "$target" ]; then
    cp {{SKILL_DIR}}/assets/bin/$f "$target"
    chmod +x "$target"
  fi
done
```

`{{SKILL_DIR}}` 是本 skill 目录,`{{DEV_LOOPS_BIN}}` 默认 `~/dev-loops/bin`。已存在同名文件不覆盖(用户可能改过)。

### 步骤 4 · 落运行时状态

状态根 `{{STATE_ROOT}}` = `~/dev-loops/<project-name>/<slug>/`。从 `assets/templates/dev-loops/` 生成三个文件:

- **`runtime.json`** — 从 `runtime.json.tmpl` 生成
  - 顶部字段:`milestone_slug` / `milestone_file`(没有里程碑文档就填 null)/ `milestone_short` / `repo_root` / `product_doc`(可 null)/ `branch_prefix` / `state_dir_root` / `worktree_root` / `created_at` / `updated_at`
  - `tasks` 数组按定版清单填,**每项一个 change**:`id`(= change-id)、`title`、`change_dir`、`depends_on`(change-id 数组)、`acceptance_ids`、`status="todo"`、`phase=null`、`phase_attempts` 三段归零,其余运行时字段 null / 0
  - 里程碑清单里已勾选的项 → `status="done"`
  - `max_parallel` 默认 **2**(change 比单个任务大,且各自要动 `specs/`,3 路并发的 rebase 冲突面偏大;用户明确要更快再调)
  - `heartbeats.total = 0`

- **`loop-instructions.md`** — 从 `loop-instructions.md.tmpl` 生成,替换 `{{PROJECT_REPO}}` / `{{MILESTONE_SLUG}}` / `{{MILESTONE_SHORT}}` / `{{MILESTONE_FILE}}` / `{{PRD_PATH}}` / `{{STATE_ROOT}}` / `{{DEV_LOOPS_BIN}}`,以及:
  - `{{VERIFY_COMMANDS_BLOCK}}` 替换为**探测生成的验证命令块**:
    - `pnpm-lock.yaml` + package.json 有 `typecheck` script → `pnpm typecheck` + `pnpm test`(如有)
    - `package-lock.json` → `npm run typecheck` + `npm test`
    - `yarn.lock` → `yarn typecheck` + `yarn test`
    - `bun.lockb` → `bun run typecheck` + `bun test`
    - `Cargo.toml` → `cargo check` + `cargo test`
    - `go.mod` → `go build ./... && go test ./...`
    - `pyproject.toml` + mypy 配置 → `mypy .` + `pytest`
    - 探测不到 → 留一条注释"请用户后续手工填入本项目的 typecheck / test 命令",不阻塞落地
  - 没有里程碑文档时:删掉 §事实源 里的里程碑那一行,并把落地阶段的「勾里程碑文档」一步替换成"跳过,本 loop 无里程碑文档",其余不变

- **`loop-prompt.md`** — 从 `loop-prompt.md.tmpl` 生成,同样替换占位符

若走的是 1b 路径,再写一份 `acceptance-map.md`(验收落点全景表)进同一目录。

### 步骤 5 · 输出结果给用户

```
[已落地]
- openspec changes: {{PROJECT_REPO}}/openspec/changes/{<id-1>,<id-2>,...}/  (新建 N 个 / 沿用 M 个)
- 通用工具: {{DEV_LOOPS_BIN}}/{spawn,resume,probe}-codex.mjs  (新装 / 已存在)
- 运行时: {{STATE_ROOT}}/{runtime.json,loop-instructions.md,loop-prompt.md}

[调度概览]
<一张表:change-id / 标题 / 依赖 / 覆盖验收 / 初始状态>
<并行度 max_parallel=2,预计单个 change 3 跳落地>

[下一步]
1. 打开 {{STATE_ROOT}}/loop-prompt.md,复制里面那段 /loop 启动语
2. 在新对话里 cd 到项目根后粘贴,主 loop 会读 loop-instructions.md 开始第一次心跳
3. 依赖 DAG 只认 runtime.json —— 要调整就改它,别改里程碑文档

[技能不代替判断的点]
- <协商时用户说"你决定"的字段,提示后续人工补>
- <验证命令探测不到的情况,提示手工填 loop-instructions.md 的 §项目验证命令>
- <验收编号留空的 change,提示后续补>
```

## Bad examples(必须避免)

WRONG: 给里程碑文档规定格式,或生成一份里程碑模板让用户照着填
Reason: 里程碑文档是用户的人类文档,skill 只有读取权。规定格式等于把 skill 的解析便利转嫁成用户的写作负担,而且下次用户换个写法 skill 就崩。正确做法是尽力解析任何形态,解析结果回显确认,缺口提问补进 runtime.json。

WRONG: 把 change 之间的依赖只写在里程碑文档里,指望主 loop 每跳去同步
Reason: 那要求里程碑文档有稳定可解析的格式,回到上一条的坑。依赖 DAG 的事实源是 runtime.json,里程碑文档只在落地时被勾一行。

WRONG: 一个 change 内再切 N 个并行任务丢给 N 个 worktree
Reason: change 是"一个连贯的变更提案",切开并发等于把内部一致性交给赌;N 个执行者还会共写同一份 tasks.md 与 spec-delta。并行粒度就是 change。

WRONG: 让 codex 在 implement 段顺手把归档也做了
Reason: 归档要写 `openspec/specs/`,是多 worktree 唯一共享写点。必须等 reflect 通过、且工作区 rebase 到最新 main 之后单独一段做,否则并发写 spec.md 必炸。主 loop 靠 `.task-done.json` 的 `phase` 字段核对这件事。

WRONG: resume 下一段之前不把上一段的 `.task-done.json` 改名
Reason: probe-codex 是"看见 `.task-done.json` 就报 done"。不改名,下一跳立刻读到旧 done 文件,任务会瞬间穿过三段落地,而 reflect 与 archive 根本没跑——最隐蔽的失败模式,表面上一切正常。

WRONG: 把一条"落点不存在"的验收直接写成某个界面 change 的子任务
Reason: 例如验收写"已有会话选了需要修复的团队时阻止发送",而会话记录里根本没有团队字段。执行者在自己的 worktree 里只看得到手边的现有状态,就会把它接到界面上那个同名的选择态上——checkbox 能打勾、测试能写绿,功能是错的。落点不存在时 MUST 先拆出独立的前置 change。

WRONG: 在 change 创建时把 spec-delta 一次性写完(尤其是"写个 1-2 条 Requirement 意思一下")
Reason: 面对全景写规格,只会挑最像规格的少数几条落笔,其余验收永久没有回归护栏。spec-delta 由 codex 在 implement 段按自己负责的验收编号逐条写。

WRONG: 覆盖已在跑的 runtime.json
Reason: 会丢失 phase / phase_attempts / merged_sha / codex_session_id 等运行时数据,主 loop 后续心跳会误判所有任务状态与所处段位。预检第 5 条已经过滤,永远不要绕过。

WRONG: 输入文档找不到就凭 change-id 猜任务
Reason: 编造需求。找不到就问用户绝对路径,不猜。

WRONG: 项目没有 openspec/ 时自动 mkdir 建
Reason: 越权。openspec 骨架的初始化应该打回让用户走 openspec-driven-development。

WRONG: 只拆出一个 change 也照样搭 loop
Reason: loop 的全部成本(worktree、心跳、分段 resume)是为并行付的。单个 change 直接走 openspec-driven-development 更快更稳。

WRONG: 把具体验证工具(web-shell / storybook / puppeteer)写进 loop-instructions.md
Reason: 不同项目验证工具不同,codex 自己会选。验证段只保证"跑 typecheck + test 通过再报 done"。

WRONG: 给 codex 提示词塞死本项目专属的 pnpm 子包过滤器(如 `pnpm --filter @foo/bar test`)
Reason: 别的项目子包名不同。`verify_commands` 只探测顶层命令,子包级由用户后续在 loop-instructions.md 手工细化。

## Failure paths

- **输入文档路径找不到,用户也无法提供** → 停在预检 3,输出"请提供 PRD 或里程碑文档的绝对路径"并结束
- **项目无 openspec/** → 停在预检 2,提示"先走 openspec-driven-development"并结束
- **`{{PROJECT_REPO}}` 不是 git 仓库** → 停在预检 6,提示"本 skill 依赖 git worktree,请先 git init 或切换到仓库根"并结束
- **runtime.json 存在且 `heartbeats.total > 0`** → 停在预检 5,提示"手动清理 `~/dev-loops/<project>/<slug>` 再来"并结束
- **里程碑文档解析不出任何 change 清单** → 不报错,转 1b 路径(拿它当 PRD 用,全程协商),并在开头说明"没能从这份文档里认出 change 清单,改走协商"
- **解析 / 协商出的 change 只有 1 个** → 停在步骤 1,建议走 openspec-driven-development 并结束
- **change-id 与已有目录重名** → 停下问用户:沿用已有的,还是换个 id
- **协商步骤用户说"你决定"** → 把候选写成 `{{STATE_ROOT}}/pending-worklist.md`,停在步骤 1,不落 openspec
- **验证命令探测不到** → 不阻塞,留占位提示,继续步骤 4
- **`~/dev-loops/` 无写权限** → 停在步骤 3 首次写盘,提示"无法写入 ~/dev-loops/,请检查 HOME 或权限"并结束

## Acceptance criteria

skill 执行完成后,以下全部满足才算成功:

1. 定版清单里每个 change 在 `{{PROJECT_REPO}}/openspec/changes/<change-id>/` 下都有 `proposal.md`、`design.md`、`tasks.md`、`spec-delta/<domain>/spec.md`
2. change 数 ≥ 2(= 1 时应已在步骤 1 打回)
3. **每个 change 的 `proposal.md` 有非空的「影响」段**——reflect 段核"有无多做"要拿它当基准
4. **每个验收编号至少被一个 change 的 `acceptance_ids` 覆盖**:全部任务的 `acceptance_ids` 取并集,与输入文档的验收编号全集比对,缺一个都不算成功(输入文档没有编号化验收时本条豁免,但要在输出里明说)
5. **落点标「不存在」的验收,每个都对应一个独立的前置 change**,且依赖它的 change 已把它写进 `depends_on`
6. `depends_on` 构成的图**无环**,且每个 id 都能在 tasks 数组里找到
7. `{{DEV_LOOPS_BIN}}/{spawn,resume,probe}-codex.mjs` 存在且 executable
8. `{{STATE_ROOT}}/{runtime.json,loop-instructions.md,loop-prompt.md}` 全部存在
9. runtime.json 可解析;`tasks` 每项有 `id`(与 `openspec/changes/` 下目录名逐字一致)、`title`、`change_dir`、`status`、`phase`(初值 null)、`phase_attempts`(三段全 0)、`depends_on`、`acceptance_ids`
10. loop-instructions.md 里所有 `{{XXX}}` 占位符已替换成实值,`{{VERIFY_COMMANDS_BLOCK}}` 允许为占位注释
11. loop-prompt.md 里 `cd <项目仓库>` 与 `/loop 5m 读 ...` 两行都指向正确的状态目录
12. **里程碑文档与 PRD 未被本 skill 修改**(`git status` 里不出现它们)

## 目录结构参考

```
~/.claude/skills/prd-to-parallel-loop/
├── SKILL.md
└── assets/
    ├── bin/
    │   ├── spawn-codex.mjs                 # 后台起 codex exec (launcher + supervisor)
    │   ├── resume-codex.mjs                # 用 session id 追加消息续跑(三段推进靠它)
    │   └── probe-codex.mjs                 # 探测状态,返回 done/running/stalled/exited/missing
    └── templates/
        └── dev-loops/
            ├── runtime.json.tmpl           # 运行时骨架(含 phase / phase_attempts)
            ├── loop-instructions.md.tmpl   # 主 loop 心跳指令(含三段生命周期与五个附录提示词)
            └── loop-prompt.md.tmpl         # /loop 启动语
```

产物落地位置:

```
{{PROJECT_REPO}}/
├── docs/roadmap/milestone-N-xxx.md         # 用户的里程碑文档 —— skill 只读,主 loop 落地时勾一行
└── openspec/
    ├── changes/
    │   ├── <change-id-1>/                  # 从 _template/ 拷贝再填,一个 change 一个并行任务
    │   │   ├── proposal.md
    │   │   ├── design.md
    │   │   ├── tasks.md                    # 内部实现步骤,由 codex 自己勾
    │   │   └── spec-delta/<domain>/spec.md # 骨架,Requirement 由 codex 在 implement 段写
    │   ├── <change-id-2>/
    │   └── archive/                        # codex 在 archive 段把完成的 change 移进来
    └── specs/<domain>/spec.md              # codex 在 archive 段把 spec-delta 合并进来

~/dev-loops/
├── bin/                                    # 全局共享,已存在则跳过
│   ├── spawn-codex.mjs
│   ├── resume-codex.mjs
│   └── probe-codex.mjs
└── <project-name>/
    └── <slug>/                             # 一个里程碑 / 一批 change 一个目录
        ├── runtime.json                    # 主 loop 独占写盘;依赖 DAG 的事实源
        ├── loop-instructions.md
        ├── loop-prompt.md
        ├── acceptance-map.md               # 仅 1b 路径生成
        ├── state/
        │   └── <change-id>/
        │       ├── prompt-implement.txt    # 附录 A
        │       ├── prompt-reflect.txt      # 附录 B
        │       ├── prompt-archive.txt      # 附录 C
        │       ├── .codex-pid / .codex-session / .codex-attempt
        │       ├── .task-done.json         # 当前段的;推进下一段前改名保存
        │       ├── .task-done.implement.json
        │       ├── .task-done.reflect.json
        │       └── codex-tail.log
        ├── worktrees/
        │   └── <change-id>/                # 分支 loop/<milestone-short>/<change-id>
        └── logs/
            └── heartbeat-YYYYMMDD.jsonl
```
