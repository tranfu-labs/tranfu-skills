---
name: prd-to-parallel-loop
description: |
  在已有 openspec 惯例的项目里,把一份 PRD / 产品文档一路搭到「多 git worktree + codex 并行执行 + 主 loop (Claude) 心跳调度」的完整脚手架。产物包括:openspec/changes/<change-id>/ 四文件、~/dev-loops/<project>/ 运行时状态目录、以及一段用户复制到新对话就能触发 /loop 的启动语。skill 会主动与用户来回协商任务拆分、依赖 DAG、验收挂钩,再落盘所有骨架。

  Trigger for: 用户说"把这个 PRD 做出来 / 把 docs/product/pages/xxx.md 落地 / 把这份产品文档实现了 / 给这个页面文档做 loop / 从这份 PRD 起,搞成可以 /loop 跑的 / 帮我把这份产品文档拆一拆做起来 / 从这份 PRD 起搞成并行 loop / 把这批任务丢到 worktree loop 里跑",或者用户丢来一份 PRD 文件路径 + 说"实现这个 / 做出来 / 落地 / 拆一下"。任何"从 PRD 到并行 loop"意图的自然表达都应该触发。

  Do NOT trigger when: 用户只想编写或评审 PRD(走 credibility-review 或 project-init-docs);项目无 openspec/ 目录且用户也没装 openspec-driven-development(应该提示先建 openspec 惯例);runtime.json 已存在且 heartbeats.total > 0 表示 loop 已在跑(要求手动清理旧状态后重来,skill 不做 update);用户只想跑一个 codex 任务没有 PRD 起点;用户要求把 PRD 直接编译成代码不经过 openspec change。
version: 0.1.0
author: aquarius-wing
updated_at: 2026-07-20
origin: own
allow_exec: true
---

# prd-to-parallel-loop

## 这个 skill 做什么

给一份 PRD(产品需求文档,通常在 `docs/product/pages/*.md` 或 `docs/product/prd.md`),经过与用户协商拆分任务,一次性搭出可跑的并行 loop 脚手架:

- `openspec/changes/<change-id>/` 下的 proposal / design / tasks / spec-delta 四文件(用项目自己的 openspec `_template/`)
- `~/dev-loops/<project-name>/` 下的 runtime.json / loop-instructions.md / loop-prompt.md
- `~/dev-loops/bin/` 下的 spawn/resume/probe-codex.mjs 三个通用工具(全局共享,已存在则跳过)

跑完 skill,用户就能在新对话粘贴 loop-prompt.md 内容 + `/loop`,Claude 主 loop 每次心跳按"reconcile / 收割 / 落地 / 血缘 / 点火 / 收尾"六步跑,codex 在各 worktree 里执行任务并写 `.task-done.json` 供主 loop 回收。

### 落盘范围(ownership: edit-file)

本 skill 会**直接写入用户文件系统**,不是 review-only 或 suggest-patch。写盘范围仅限:

- `{{PROJECT_REPO}}/openspec/changes/<change-id>/` 下的 4 个文件(从项目 `openspec/changes/_template/` 拷贝再填)
- `~/dev-loops/bin/` 下的 3 个 `.mjs`(已存在则跳过,永不覆盖)
- `~/dev-loops/<project-name>/` 下的 3 个文件(runtime.json / loop-instructions.md / loop-prompt.md)

绝不修改 `{{PROJECT_REPO}}/openspec/changes/_template/`、`{{PROJECT_REPO}}` 的 git 历史、`{{PROJECT_REPO}}` 下的任何产品代码,或已在跑的 `~/dev-loops/<project>/runtime.json`。

## 这个 skill 不做什么

- **不代替产品文档写作**。PRD 本身怎么写、结构长什么样、验收怎么定,由 credibility-review / project-init-docs / 用户自己负责
- **不代替 codex 里的实现判断**。codex 在 worktree 里怎么写代码、用什么工具验证、UI 手验怎么做,都是 codex 自己的事;本 skill 只保证它拿到清晰任务描述、明确验证命令、清楚的 done 文件规范
- **不建 openspec 骨架**。项目缺 openspec/ 目录就打回,让用户先走 openspec-driven-development
- **不推送、不合并到远端**。主 loop 只本地 squash merge 到 main;push 是用户人工决定
- **不做 update 模式**。runtime.json 已在跑就拒绝重建;强行覆盖会丢失 attempts / merged_sha / codex_session_id 等运行时数据

## 预检(在真正做任何事之前)

按顺序快速检查,任一失败就先解决:

1. **openspec-driven-development skill 已安装** —— 本 skill 会依赖它的惯例(change 结构、spec-delta 语义、tasks.md 嵌套 checkbox 风格)。检查方式:看 available-skills 里是否有 `openspec-driven-development`。缺失就告诉用户"请先装 openspec-driven-development skill,再触发我"。

2. **项目根有 `openspec/` 目录且含 `_template/`** —— 用 `test -d {{PROJECT_REPO}}/openspec/changes/_template`。缺失就告诉用户"项目没有 openspec 惯例,请先走 openspec-driven-development 建骨架"。

3. **PRD 文件可读** —— 用户给了明确路径就用;否则从 `docs/product/pages/` 或 `docs/product/prd.md` 猜,列出候选让用户确认。找不到任何 PRD 就问用户绝对路径。

4. **codex CLI 可用** —— `which codex` 有输出。缺失就提示用户安装 codex CLI。

5. **`~/dev-loops/<project-name>/runtime.json` 不存在或 `heartbeats.total == 0`** —— 存在且 total > 0 就拒绝,提示用户"loop 已在跑或有残留,请手动 rm -rf ~/dev-loops/<project> 再来"。

6. **`{{PROJECT_REPO}}` 是 git 仓库** —— 用 `git -C {{PROJECT_REPO}} rev-parse --show-toplevel` 成功。本 skill 依赖 git worktree,不在 git 仓库里跑不起来。缺失就打回让用户 `git init` 或换到正确的仓库根再触发。

## Workflow(6 步,前 2 步与用户协商,后 4 步落盘)

CREATE A TODO LIST FOR THE TASKS BELOW,一 TODO 一步:

1. 预检 6 项(openspec-driven-development 已装 / openspec/_template 存在 / PRD 可读 / codex CLI / runtime.json 未在跑 / git 仓库)
2. 探测起点
3. PRD → 任务协商
4. 落 openspec change
5. 落 dev-loops 通用工具
6. 落 dev-loops 项目状态
7. 输出结果给用户

每步完成再更新对应 TODO;任一步进入失败路径直接结束流程,不继续后续 TODO。

### Step 1. 探测起点

并行执行:
- 读 PRD 全文(如果 > 2000 行分段读)
- `ls {{PROJECT_REPO}}/openspec/changes/` 看是否已有目标 change 目录
- `ls {{PROJECT_REPO}}/openspec/specs/` 看有哪些 domain,以备协商 spec-delta 放哪
- `ls {{PROJECT_REPO}}` + 探测 UI 项目形态(存在 `packages/*ui*` / `desktop/` / `apps/*web*` 等)
- 探测项目使用的包管理器与验证命令(见 Step 4 的 verify_commands 生成规则)

推断 change_id:通常是 `<产品概念>-implementation`(如 `main-sidebar-implementation`),但用户可以指定别的。

如果 openspec/changes/<change-id>/ 已存在且 tasks.md 有勾选项,进 idempotent 分支:读现状,后续 Step 3 只补缺不覆盖已勾选 checkbox。

### Step 2. PRD → 任务协商(交互式,不是自动)

CRITICAL: 这一步必须与用户来回互动,**永远不要**跳过直接把候选拆分落盘。

- 读 PRD,提取关键信息:
  - 页面结构 / 用户场景 / 状态表 / 验收标准段落
  - 现状参考与产品缺口(如果 PRD 末尾有类似段落)
  - 非目标
- 抛出候选任务拆分,**直接用 openspec 惯例的嵌套 checkbox 格式**(这样协商定版后 Step 3 可以逐字落 tasks.md,不用二次转换):

  ```
  提议按以下方式拆成 N 个任务(欢迎逐条改):

  - [ ] T1: <一句话标题>
    - [ ] 覆盖验收 #X #Y
    - 依赖: 无
  - [ ] T2: <一句话标题>
    - [ ] 覆盖验收 #Z
    - 依赖: T1
  ...
  ```

- 让用户逐一确认或修改;讨论完再让用户明确说"这就落"或"OK"再进 Step 3
- 若 PRD 有明显冲突需求(比如现状说"按状态排序",PRD 说"按创建时间排序"),显式提出让用户裁决,不擅自选一边

允许用户在这一步中断说"你决定"—— 那就把候选拆分写成一份 `~/dev-loops/<project>/pending-tasks-proposal.md` 文件,停在这里等用户后续确认,**不擅自落 openspec**。

### Step 3. 落 openspec change

从项目自己的 `openspec/changes/_template/` 拷贝一份:

```bash
cp -R {{PROJECT_REPO}}/openspec/changes/_template \
      {{PROJECT_REPO}}/openspec/changes/<change-id>
```

然后按协商结论填写四文件:

- **proposal.md**: 背景(为什么要做,现状差距是什么) / 提案(打算怎么改) / 影响(哪些模块、对外行为)
- **design.md**: 方案(执行编排 + 关键决策 3-5 条) / 权衡(选这个方案放弃了什么) / 风险(已知风险与回滚思路)
- **tasks.md**: 按 openspec 惯例的嵌套 checkbox,顶层 T1..TN,子勾选项写子步骤和"覆盖验收 #X #Y"
- **spec-delta/<domain>/spec.md**: 至少 1-2 个 Requirement,用 MUST/MUST NOT/SHOULD 描述,每个 Requirement 下面配 GIVEN/WHEN/THEN Scenario

`<domain>` 由协商步骤确定(通常是 openspec/specs/ 下现有的域,如 `console-ui` / `local-console`)。

Idempotent 分支:目标 change 目录已存在且 tasks.md 有 [x] 项时,只补缺(比如把新协商出来的任务追加到 tasks.md 末尾),已勾选项一个字都不动。

### Step 4. 落 dev-loops 通用工具(全局共享,已存在则跳过)

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

其中 `{{SKILL_DIR}}` 是本 skill 目录(`~/.claude/skills/prd-to-parallel-loop/`),`{{DEV_LOOPS_BIN}}` 默认是 `~/dev-loops/bin`。若已存在同名文件不覆盖(用户可能自己改过)。

### Step 5. 落 dev-loops 项目状态

从 `assets/templates/dev-loops/` 生成三个文件,占位符替换成协商定版的实值:

- **`~/dev-loops/<project-name>/runtime.json`** — 从 `runtime.json.tmpl` 生成
  - `change_id`、`repo_root`、`openspec_tasks_file`、`product_doc`、`state_dir_root`、`worktree_root`、`created_at`(now)、`updated_at`(same as created_at)
  - `tasks` 数组按协商结论填充,每个任务:`id/title/depends_on/acceptance_ids/status="todo"/其余字段 null 或 0`
  - `heartbeats.total = 0`

- **`~/dev-loops/<project-name>/loop-instructions.md`** — 从 `loop-instructions.md.tmpl` 生成
  - 替换所有 `{{PROJECT_NAME}}` / `{{PROJECT_REPO}}` / `{{CHANGE_ID}}` / `{{CHANGE_SHORT}}` / `{{PRD_PATH}}` / `{{STATE_ROOT}}` / `{{DEV_LOOPS_BIN}}`
  - 替换 `{{VERIFY_COMMANDS_BLOCK}}` 为**探测生成的验证命令块**,规则:
    - 项目有 `pnpm-lock.yaml` + package.json 有 `typecheck` script → `pnpm typecheck` + `pnpm test`(如有)
    - `package-lock.json` → `npm run typecheck` + `npm test`
    - `yarn.lock` → `yarn typecheck` + `yarn test`
    - `bun.lockb` → `bun run typecheck` + `bun test`
    - `Cargo.toml` → `cargo check` + `cargo test`
    - `go.mod` → `go build ./... && go test ./...`
    - `pyproject.toml` + 有 mypy 配置 → `mypy .` + `pytest`
    - 探测不到时,把 `{{VERIFY_COMMANDS_BLOCK}}` 留一条注释"请用户后续手工填入本项目的 typecheck / test 命令",不阻塞落地
  - `{{CHANGE_SHORT}}` 从 `CHANGE_ID` 派生(去掉常见后缀 `-implementation` / `-loop` / `-workflow`),用作分支名前缀 `loop/<short>/T<n>`

- **`~/dev-loops/<project-name>/loop-prompt.md`** — 从 `loop-prompt.md.tmpl` 生成,同样替换占位符

### Step 6. 输出结果给用户

打印:

```
[已落地] 
- openspec change: {{PROJECT_REPO}}/openspec/changes/{{CHANGE_ID}}/{proposal,design,tasks,spec-delta}.md
- 通用工具: {{DEV_LOOPS_BIN}}/{spawn,resume,probe}-codex.mjs (新装 / 已存在)
- 项目状态: {{STATE_ROOT}}/{runtime.json,loop-instructions.md,loop-prompt.md}

[下一步]
1. 打开 {{STATE_ROOT}}/loop-prompt.md,复制里面那段 /loop 启动语
2. 在新对话里粘贴,主 loop 会读 loop-instructions.md 开始第一次心跳
3. 若某个任务的 depends_on / acceptance_ids 是协商时没定死的,自己在 runtime.json 里补一下再启动

[技能不代替判断的点]
- <把协商步骤中"用户说你决定"的任何字段列出来,提示后续人工补>
- <把探测不到验证命令的情况列出来,提示手工填 loop-instructions.md 的 §项目验证命令 段>
```

## Bad examples(必须避免)

WRONG: 跳过 Step 2 协商,直接把 PRD 里的"验收标准"段落逐条塞进 tasks.md
Reason: 产出的任务缺依赖 DAG,主 loop 无法调度,而且任务粒度大概率不符合"每个可拆到独立 worktree 一次跑完"的要求。永远走协商。

WRONG: 覆盖已在跑的 runtime.json
Reason: 会丢失 attempts / merged_sha / codex_session_id / last_probe_at 等运行时数据,主 loop 后续心跳会误判所有任务状态。预检 Step 5 已经过滤这种情况,永远不要绕过。

WRONG: PRD 找不到就凭 change-id 猜任务
Reason: 编造需求。找不到 PRD 就问用户绝对路径,不猜。

WRONG: 项目没有 openspec/ 时自动 mkdir 建
Reason: 越权。openspec 骨架的初始化不是本 skill 职责,应该打回让用户走 openspec-driven-development。

WRONG: 把 web-shell / storybook / puppeteer 等具体验证工具写进 loop-instructions.md
Reason: 不同项目验证工具不同,codex 自己会选合适工具。skill 的验证段只保证"跑 typecheck + test 通过再提 done",UI 手验的具体方式由 codex 在 worktree 里自定。

WRONG: 给 codex 提示词模板里塞死本项目专属的 pnpm 子包过滤器(如 `pnpm --filter @foo/bar test`)
Reason: 别的项目子包名不同。verify_commands 只探测顶层命令(pnpm typecheck / npm test 这种),子包级由用户后续在 loop-instructions.md 手工细化。

## Failure paths

- **PRD 路径找不到,用户也无法提供** → 停在 Step 1,输出"请提供 PRD 绝对路径"并结束
- **项目无 openspec/** → 停在预检 Step 2,提示"先走 openspec-driven-development"并结束
- **`{{PROJECT_REPO}}` 不是 git 仓库** → 停在预检 Step 6,提示"本 skill 依赖 git worktree,请先 git init 或切换到仓库根"并结束
- **openspec/changes/<change-id>/ 已存在且 tasks.md 有勾选项** → 走 idempotent 分支(Step 3 只补缺不覆盖);若冲突严重让用户裁决
- **runtime.json 存在且 heartbeats.total > 0** → 停在预检 Step 5,提示"手动清理 ~/dev-loops/<project> 再来"并结束
- **协商步骤用户长时间不响应或明确说"你决定"** → 把候选拆分写成 pending-tasks-proposal.md,停在 Step 2,不落 openspec
- **验证命令探测不到** → 不阻塞,留占位提示用户后续手工填,继续 Step 5 落地
- **`~/dev-loops/` 无写权限** → 停在 Step 4 首次写盘,提示"无法写入 ~/dev-loops/,请检查 HOME 或权限"并结束

## Acceptance criteria

skill 执行完成后,以下全部满足才算成功:

1. `{{PROJECT_REPO}}/openspec/changes/{{CHANGE_ID}}/` 下 `proposal.md`、`design.md`、`tasks.md`、`spec-delta/<domain>/spec.md` 四文件存在
2. tasks.md 顶层 checkbox 数 ≥ 3(小于 3 提示用户"任务太少,不需要 loop,建议直接干")
3. `{{DEV_LOOPS_BIN}}/{spawn,resume,probe}-codex.mjs` 存在且 executable
4. `{{STATE_ROOT}}/{runtime.json,loop-instructions.md,loop-prompt.md}` 全部存在
5. runtime.json 可解析,`tasks` 数量与 openspec tasks.md 顶层 checkbox 数一致
6. runtime.tasks 每项都有 `id`、`title`、`status`(初值 `todo`)、`depends_on`(数组)、`acceptance_ids`(数组);其余运行时字段可以 null / 0
7. loop-instructions.md 里所有 `{{XXX}}` 占位符已替换成实值,除了 `{{VERIFY_COMMANDS_BLOCK}}` 允许为空/占位
8. loop-prompt.md 里 `cd <项目仓库>` + `/loop 5m 读 ...` 那两行都指向正确的 change-id 与状态目录(`5m` 是心跳间隔的默认值,可换 `10m` / `2m`)

## 目录结构参考

```
~/.claude/skills/prd-to-parallel-loop/
├── SKILL.md                                # 本文件
└── assets/
    ├── bin/
    │   ├── spawn-codex.mjs                 # 后台起 codex exec (launcher + supervisor)
    │   ├── resume-codex.mjs                # 用 session id 追加消息续跑
    │   └── probe-codex.mjs                 # 探测状态,返回 done/running/stalled/exited/missing
    └── templates/
        └── dev-loops/
            ├── runtime.json.tmpl           # 项目状态骨架
            ├── loop-instructions.md.tmpl   # 主 loop 心跳指令(占位符版)
            └── loop-prompt.md.tmpl         # /loop 启动语(占位符版)
```

产物落地位置:

```
{{PROJECT_REPO}}/                           # 用户项目仓库
└── openspec/
    └── changes/
        └── {{CHANGE_ID}}/                  # 从 _template/ 拷贝再填
            ├── proposal.md
            ├── design.md
            ├── tasks.md
            └── spec-delta/
                └── <domain>/
                    └── spec.md

~/dev-loops/                                # 全局共享
├── bin/                                    # 通用工具,已存在则跳过
│   ├── spawn-codex.mjs
│   ├── resume-codex.mjs
│   └── probe-codex.mjs
└── <project-name>/                         # 本项目状态
    ├── runtime.json                        # 由主 loop 独占写盘
    ├── loop-instructions.md                # 心跳指令(实值版)
    ├── loop-prompt.md                      # /loop 启动语(实值版)
    ├── state/                              # 每任务一个子目录
    │   └── T<n>/
    │       ├── prompt.txt                  # 由主 loop 生成
    │       ├── .codex-pid
    │       ├── .codex-session
    │       ├── .codex-attempt
    │       ├── .task-done.json             # 由 codex 完成时写
    │       └── codex-tail.log
    ├── worktrees/                          # git worktree 派生地
    │   └── T<n>/                           # 分支 loop/<change-short>/T<n>
    └── logs/
        └── heartbeat-YYYYMMDD.jsonl        # 可选
```
