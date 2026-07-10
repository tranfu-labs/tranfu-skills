---
name: project-init-docs
display_name: Project Docs Initialization
display_name_zh: 项目文档初始化
description: >
  当用户在一个代码仓库里说"初始化"时，分析真实仓库并一次性搭建 AI 驱动开发所需的知识与规格基线：
  AGENTS.md（AI 项目操作手册）、CLAUDE.md（指向 AGENTS.md 的一行指针）、
  DEPLOY.md（部署事实源，供后续 AI 一眼看清部署到哪 / 怎么建 / 怎么发 / 怎么退 / 怎么验）、
  docs/architecture/module-map.md（模块地图）、openspec/specs/<domain>/spec.md（业务域事实规格）、
  openspec/changes/（先设计再实现的变更工作区）、docs/adr/（架构决策记录）、
  docs/wireframes/（字符图线框，默认生成）。
  触发词包括"初始化""初始化项目""init 一下文档""搭 AI 协作脚手架""建 AGENTS.md 体系""加线框图/页面版式"，
  也覆盖口语化说法，例如"帮我把项目文档初始化一下""搭一套 AI 能看懂的文档底座""把项目结构和规范记录下来"，
  即使用户只说"初始化"也在仓库语境内触发。
  内容必须来自对真实仓库的分析而非空白模板，幂等不破坏已存在文件。
  任何目录级"怎么在这工作"的说明一律用 AGENTS.md + CLAUDE.md 指针，绝不用 README。
  不要用于代码层初始化（git/npm init、create-react-app、cargo new 等脚手架命令）、
  只新建单个文档、编写业务代码，或对已存在文件做局部小修改（那只是普通编辑）。
version: 0.5.0
author: aquarius-wing
updated_at: 2026-07-10
origin: own
---

# 项目初始化文档（AI 协作基线）

使用这个技能：当用户在代码仓库里说"初始化"时，分析真实仓库，并搭建一套让 AI 能安全协作、先设计再实现的知识与规格基线。

任务不是拷贝空白模板，而是把真实仓库的事实——语言、命令、目录、模块、业务域、部署方式——写进一套固定的目录契约。基线建立后，任何 AI 拿到 `AGENTS.md` 就知道结构/命令/禁区，拿到 `DEPLOY.md` 就知道部署到哪/怎么建/怎么发/怎么退/怎么验，拿到 `module-map.md` 就知道依赖边界，拿到 `openspec/` 和 `docs/adr/` 就知道"先设计再实现"的契约与既有决策，拿到 `docs/wireframes/` 就知道每个页面当前的版式事实。

**两套事实源并列**：`openspec/specs/<domain>/spec.md` 是行为事实源，`docs/wireframes/` 是版式事实源。两者都靠 `openspec/changes/` 流转更新——改业务逻辑的 change 写 `spec-delta/`，改页面版式的 change 写 `wireframes.md`（本项目扩展，按需新建），归档时分别回流到 `specs/` 和 `docs/wireframes/`。归档动作由 `openspec/changes/AGENTS.md` 统一定义（由本 skill 生成），不在每个 change 的 `tasks.md` 重复。

## 核心原则

- **内容来自真实仓库**：命令来自真实脚本（package.json scripts / Makefile / justfile 等），模块来自真实源码目录，业务域来自真实代码。探测不到的，标注 `TODO: 需人工确认`，绝不编造命令或依赖。
- **幂等**：已存在的文件默认不做破坏性覆盖。只补全缺失小节，或报告差异交由用户决定。覆盖任何已存在文件前，必须先读它、向用户说明、得到确认。
- **目录级说明一律用 AGENTS.md + CLAUDE.md，绝不用 README**：需要解释"怎么在这个目录工作"时，写一个本地 `AGENTS.md`（真实内容）+ 一个 `CLAUDE.md`（仅一行 `See AGENTS.md ...`，路径相对该目录）。
- **命名产物保留专用名**：`module-map.md`、`spec.md`、ADR 文件是具名契约产物，不被 `AGENTS.md` 取代。
- **正文用用户语言**（默认中文）；文件路径与各文件的小节标题是固定契约，不翻译、不改写。

## 不触发

- 代码层初始化：`git init` / `npm init` / `create-react-app` / `cargo new` / 任何脚手架命令。
- 只新建单个文档（如"帮我写个 README / 写个贡献指南"）。
- 编写业务代码或修 bug。
- 对某个已存在文件做局部小修改——那是普通编辑，不是初始化。

## 脚本与引用文件

确定性骨架由脚本铺设，AI 只填真实仓库事实。脚本在仓库根运行：

- `scripts/probe.sh [domain...]`：只读探针，扫描全部基线目标，输出路由表 `状态<TAB>路径<TAB>类别`（状态 = MISSING/EMPTY/PRESENT，类别 = static/repo-fact）。不写盘。
- `scripts/fill.sh`：基线产物的唯一事实源。`--list` 列目标清单；`--auto [domain...]` 对所有缺失/为空目标自动填充；`<target>` 只填单个目标。已存在且非空的目标一律 SKIP，绝不覆盖。

产物分两类：
- **static（纯静态）**：所有 `CLAUDE.md` 指针、`openspec/changes/AGENTS.md` + `_template/`、`docs/adr/AGENTS.md` + `0000-record-architecture-decisions.md`；以及线框图的 `docs/wireframes/{AGENTS.md,CLAUDE.md,legend.md,_template/page.md}`。内容与仓库无关，缺失/为空时由 `fill.sh` 写死，AI 不手敲。
- **repo-fact（真实事实）**：根 `AGENTS.md`、根 `DEPLOY.md`、`docs/architecture/module-map.md`、`openspec/specs/<domain>/spec.md`；以及线框图的 `docs/wireframes/flow.md`（页面流转图，默认铺）和 `docs/wireframes/pages/<page>.md`（探测到路由时追加）。缺失/为空时 `fill.sh` 只铺骨架（repo-fact 文件铺「小节标题 + `TODO`」，页面文件铺「比例尺+断点框+注释表」模板，flow.md 铺「流程示例+TODO 步骤表」），真实命令/模块/业务规则/部署事实/页面版式/流转关系仍由 AI 填正文。

线框图**默认随基线一起铺**（不做 UI 判定，与 `adr/`、`changes/` 同级）：静态骨架（`AGENTS.md/CLAUDE.md/legend.md/_template/page.md`）与 `flow.md` 骨架无条件生成；页面文件按真实路由用 `--pages <页...>` 追加。**是否保留由仓库根 `AGENTS.md` 的「线框图」一节决定**——初始化只负责铺好并写下这条规则，等以后项目性质明确（如确认为无界面的工具/库类）再照根 `AGENTS.md` 删除 `docs/wireframes/`。静态线框图全文存放在 `assets/wireframes/`，由 `fill.sh` cat 过去。

小节契约放在 `references/file-templates.md`，是契约的逐字组成部分。填 repo-fact 正文前必须先读它。static 文件全文以 `scripts/fill.sh`（含其引用的 `assets/wireframes/`）为准，不在别处另存。

## 工作流

为下面的步骤建立一个 TODO 清单，并在每步完成后更新状态。

1. **探测仓库**
   - 语言/框架：`package.json`、`pyproject.toml`/`requirements.txt`、`go.mod`、`Cargo.toml`、`pom.xml`、`build.gradle` 等。
   - 目录结构：顶层与关键源码目录。
   - 真实命令：安装/构建/测试/运行/lint，来自真实脚本与配置，而非猜测。
   - 模块：顶层源码目录或包边界。
   - 业务域：从代码组织（领域目录、服务、模型）归纳出真实业务域，作为 `openspec/specs/<domain>` 的 `<domain>`。
   - 部署方式：探测 `Dockerfile` / `docker-compose*.yml` / `.github/workflows/*.yml`（尤其含 `deploy` / `release` / `publish` 的）/ `.gitlab-ci.yml` / `Jenkinsfile` / `.circleci/config.yml` / `vercel.json` / `netlify.toml` / `fly.toml` / `render.yaml` / `railway.toml` / `app.yaml` / `serverless.yml` / `Procfile` / `k8s/` / `kubernetes/` / `helm/`；以及 `.env.example` / `.env.sample` / config 样例；确定部署形态（VPS / 容器编排 / 平台即服务 / Serverless / 纯发布库），供 `DEPLOY.md` 填正文。探测不到就整节留 `TODO`，绝不编造平台或命令。
   - 页面：检测前端框架/路由（Next.js `app/`·`pages/`、React Router、Vue Router、SvelteKit `src/routes`、多个顶层 `.html` 等）。检测到则从真实路由归纳页面名，作为 `--pages` 的入参。线框图静态骨架默认都会铺，**不在此判定 UI 与否、不跳过**；是否最终保留留给根 `AGENTS.md` 的规则在后续决定。

2. **确认范围与边界**
   - MUST 在执行任何文件写入前，向用户输出执行前小结：探测到的技术栈、模块、业务域、部署形态（若探测到）、页面清单（若探测到路由），和计划生成的文件清单（含默认生成的 `DEPLOY.md` 与 `docs/wireframes/`）。
   - 边界异常时降级处理：空仓库/非代码仓库 → 生成最小 `AGENTS.md` 并把无法填充处标注 `TODO`，必要时向用户要上下文；探测不到命令或模块 → 标注 `TODO: 需人工确认`，绝不编造。
   - 业务域过多：当探测到的业务域超过 8 个时，MUST 先向用户列出业务域清单并请其确认范围，再生成 `spec.md`，绝不静默批量写入。
   - 页面过多：当探测到的路由/页面超过 12 个时，MUST 先列页面清单请用户确认范围，再生成页面文件，绝不静默批量写入（静态骨架照常默认铺）。
   - 若任何已存在文件会被触及，先读它并向用户说明，确认后再处理。

3. **跑探针，拿路由表**
   - `scripts/probe.sh <探测到的业务域...> [--pages <页面...>]`，得到每个目标的 `状态 × 类别`。`docs/wireframes/` 静态骨架默认就在路由表里；探测到路由就带 `--pages` 追加各页面文件，没探测到就只铺静态骨架。后续按表分流，不再凭记忆判断哪些文件该建。

4. **按路由表分流填充**
   - `static + MISSING/EMPTY` → `scripts/fill.sh <path>` 直接写死，AI 不碰。
   - `repo-fact + MISSING/EMPTY` → `scripts/fill.sh <path>` 铺骨架（小节标题 + TODO），正文留到第 5 步。
   - `* + PRESENT` → 不动文件，登记进第 6 步的「需人工/AI 核对」清单（读现有 → 只补缺失小节 / 报差异 → 覆盖前确认）。
   - 便捷：缺失/为空的目标可一次 `scripts/fill.sh --auto <业务域...> [--pages <页面...>]` 全部铺好（PRESENT 自动 SKIP，幂等安全）。

5. **填 repo-fact 骨架的正文**
   - 先读 `references/file-templates.md` 的小节契约。
   - 根 `AGENTS.md`：把「项目概览/项目结构/常用命令/编码规范/禁止事项」的 `TODO` 替换成真实事实（修改前后检查两节脚本已写死，保留）。
   - 根 `DEPLOY.md`：按 7 节契约（部署目标 / 环境要求 / 环境变量 / 构建与部署命令 / 部署流程 / 回滚 / 健康检查）填真实事实；命令抄真实 `Dockerfile` / CI workflow / scripts，环境变量只列名字与用途（**NEVER 写真实值/密钥**）。探测不到的字段留 `TODO: 需人工确认`，绝不用 `<平台>`、`docker push <image>` 这类占位符。纯库/SDK 项目 `## 部署目标` 写成「发布到 npm/PyPI/…（发布不是部署）」并指向真实发布配置。
   - `docs/architecture/module-map.md`：按真实模块复制扩展骨架那一节，逐个填职责边界/入口/上游/下游/禁止依赖。
   - `openspec/specs/<domain>/spec.md`：填域定位、可验证的业务规则、场景、可验证行为；探测不到的保留 `TODO: 需人工确认`，不硬造。
   - `docs/wireframes/pages/<page>.md`（探测到路由时）：按真实路由填字符图——页首写比例尺+断点清单，每个断点框写真实 px 与显示列尺寸（**显示列数 = 真实px ÷ 比例尺，全角字符按 2 列、歧义/半角按 1 列；用 Python `east_asian_width` 校验，禁用 `awk length`、codepoint、`wc -L`**），区块/容器照 `legend.md` 与消歧义规则画并打编号，注释表逐条对应；版式推不出的标 `TODO`，不硬造。
   - `docs/wireframes/flow.md`：按用户流程分节（登录流程、忘记密码流程…）填页面流转图，节点=真实页面（指向其 `page.md`）、同页态用虚线框、边打编号对应步骤表；流程推不出的标 `TODO`，不硬造。
   - 根 `AGENTS.md` 的「线框图」一节是脚本写死的双重契约（版式事实源定位 + 无界面项目的删除规则），保留不删——它既告诉后续 AI「`docs/wireframes/` 与 `specs/` 并列、靠 change 流转更新」，又指导项目性质明确后决定是否删除 `docs/wireframes/`。

6. **核对 PRESENT 文件 + 幂等校验 + 产出清单**
   - 对第 4 步登记的 PRESENT 文件：读现有内容，只补缺失小节或报差异，覆盖前经用户确认。
   - 核对验收标准，输出 WROTE / SKIP / 待 AI 填正文 / 标注 TODO 的文件清单。

## 验收标准

- `AGENTS.md`、`CLAUDE.md`、`DEPLOY.md`、`docs/architecture/module-map.md`、`openspec/specs/<domain>/spec.md`、`openspec/changes/`、`docs/adr/` 全部就位。
- 各文件的小节标题与 `references/file-templates.md` 的约定标题逐字一致；repo-fact 文件填完正文后，除标注 `TODO: 需人工确认` 处外不含占位符（如 `<xxx>`、`npm run <command>`）。static 模板（`_template/`、骨架里的 `<change-id>` / `<项目名>` 等）的占位符是设计如此，不在此限。
- `DEPLOY.md` 含 7 节固定契约（部署目标 / 环境要求 / 环境变量 / 构建与部署命令 / 部署流程 / 回滚 / 健康检查），命令来自真实 Dockerfile / CI workflow / scripts；`## 环境变量` 只出现变量名与一句话用途，**NEVER 出现真实值或密钥**；探测不到的整节留 `TODO: 需人工确认`，绝不编造平台或命令。
- 每个 `CLAUDE.md` 只含指向同目录 `AGENTS.md` 的一行。
- 目录级说明文件都是 `AGENTS.md` + `CLAUDE.md`，无 README 充当目录指南。
- 已存在文件未被破坏性覆盖；无法填充处显式标注 `TODO`，无编造命令/依赖。
- `docs/wireframes/{AGENTS.md,CLAUDE.md,legend.md,_template/page.md,flow.md}` 默认就位（不分 UI 与否）；探测到路由时每个 `pages/<page>.md` 有页首比例尺+断点声明、每框尺寸条，且**每框实际显示列宽 = 真实px ÷ 比例尺**（桌面 120 / 平板 64 / 手机 31，全角按 2 列、歧义/半角按 1 列，用 Python `east_asian_width` 量，对不上即不合格）；容器均按消歧义规则标明身份；编号与注释表一一对应、无孤儿编号。
- `flow.md` 按用户流程分节，节点为真实页面并指向其 `page.md`，每节图中编号与步骤表一一对应、无孤儿编号。
- 根 `AGENTS.md` 含脚本写死的「线框图」一节（版式事实源定位 + 默认生成说明 + 无界面项目的删除规则），保留未删。
- `openspec/changes/AGENTS.md` 含脚本写死的四个小节——`## 变更工作流`、`## 目录内容`（含 `wireframes.md` 可选项）、`## 推进顺序`、`## 归档`；「归档」节三步并列：移动 change 目录、合并 spec-delta、若有 `wireframes.md` 则回流到 `docs/wireframes/`——其中第 3 步只针对有 `wireframes.md` 的 change，归档动作 NEVER 写进单个 change 的 `tasks.md`。

## 失败路径

- **非代码仓库 / 空仓库**：不要假装有结构。生成最小 `AGENTS.md`，把结构/命令/模块小节标注 `TODO: 需人工确认`，并提示用户补充。
- **命令或模块探测不到**：标注 `TODO: 需人工确认`，绝不编造。
- **部署配置探测不到 / 非可部署项目**：`DEPLOY.md` 仍生成 7 节骨架，探测不到的整节留 `TODO: 需人工确认`；纯库/SDK/工具包/CLI 类项目 `## 部署目标` 填成「发布到 npm/PyPI/crates.io/…（发布不是部署）」并指向真实发布配置（如 `.github/workflows/publish.yml`、`.npmrc`）；NEVER 因为"不是 web 应用"跳过 `DEPLOY.md`——发布流程本身也值得写清楚。
- **目标文件已存在**：默认跳过覆盖。读出现有内容，只补缺失小节或报告差异，覆盖前必须经用户确认。
- **业务域不清晰**：建一个起步 `spec.md` 并标注 `TODO`，不硬造业务规则。
- **路由探测不到 / 项目性质未明**：不传 `--pages`，只铺 `docs/wireframes/` 静态骨架（含 `_template/page.md`），`pages/` 留空，并依赖根 `AGENTS.md` 的「线框图」规则供后续决定保留还是删除——init 阶段不替用户判断、不删除。
- **后续确认为无界面的工具/库类**：照根 `AGENTS.md` 的「线框图」规则删除整个 `docs/wireframes/` 并删除该节（这是后续编辑，不在 init 范围内）。

<example>
用户在一个 Node + TypeScript 仓库里说"初始化"。

流程：
1. 探测到 `package.json`（scripts: build/test/lint）、`src/` 下有 `auth/`、`orders/`、`payments/` 三个领域目录；同时探测到 `app/` 下有 `login/`、`dashboard/` 路由 → 页面 = login/dashboard（没探测到路由就只铺线框图静态骨架、不带 `--pages`）。
2. 执行前小结："栈=Node+TS；模块=auth/orders/payments；页面=login/dashboard；将生成 AGENTS.md、CLAUDE.md、module-map.md、specs/{auth,orders,payments}/spec.md、changes/、adr/、docs/wireframes/（默认）"。
3. `scripts/probe.sh auth orders payments --pages login dashboard` → 全部 MISSING。
4. `scripts/fill.sh --auto auth orders payments --pages login dashboard`：static 全部写死（各 CLAUDE.md、changes/adr 的 AGENTS.md、_template/、0000 ADR、`docs/wireframes/` 静态骨架）；repo-fact 铺骨架（根 AGENTS.md、module-map.md、三个 spec.md、flow.md、两个 page.md）。
5. 填 repo-fact 骨架正文：根 `AGENTS.md` 常用命令抄真实 scripts、禁止事项写入"payments 不得依赖 orders 的内部模块"、保留脚本写死的「线框图」删除规则；`module-map.md` 三个模块各填一节；三个 `spec.md` 据真实代码写业务规则与场景；两个 `page.md` 按真实路由填字符图；`flow.md` 按登录流程等用户流程画页面流转。
6. 输出清单，标注 payments 的计费规则为 `TODO: 需人工确认`（代码未明确）。
</example>

<bad-example>
错误：用户说"初始化"后，直接拷一套带占位符（`<项目名>`、`npm run <command>`）的空白模板写盘，并新建 `openspec/changes/README.md` 解释工作流。

为什么错：内容没有来自真实仓库（命令是占位符而非真实 scripts），违反"内容来自真实仓库"；用 README 当目录指南，违反"目录级说明一律用 AGENTS.md + CLAUDE.md"。
</bad-example>
