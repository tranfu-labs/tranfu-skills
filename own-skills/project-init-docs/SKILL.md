---
name: project-init-docs
description: >
  当用户在一个代码仓库里说"初始化"时，分析真实仓库并一次性搭建 AI 驱动开发所需的知识与规格基线：
  AGENTS.md（AI 项目操作手册）、CLAUDE.md（指向 AGENTS.md 的一行指针）、
  docs/architecture/module-map.md（模块地图）、openspec/specs/<domain>/spec.md（业务域事实规格）、
  openspec/changes/（先设计再实现的变更工作区）、docs/adr/（架构决策记录）。
  触发词包括"初始化""初始化项目""init 一下文档""搭 AI 协作脚手架""建 AGENTS.md 体系"，
  也覆盖口语化说法，例如"帮我把项目文档初始化一下""搭一套 AI 能看懂的文档底座""把项目结构和规范记录下来"，
  即使用户只说"初始化"也在仓库语境内触发。
  内容必须来自对真实仓库的分析而非空白模板，幂等不破坏已存在文件。
  任何目录级"怎么在这工作"的说明一律用 AGENTS.md + CLAUDE.md 指针，绝不用 README。
  不要用于代码层初始化（git/npm init、create-react-app、cargo new 等脚手架命令）、
  只新建单个文档、编写业务代码，或对已存在文件做局部小修改（那只是普通编辑）。
version: 0.3.0
author: aquarius-wing
updated_at: 2026-06-16
origin: own
---

# 项目初始化文档（AI 协作基线）

使用这个技能：当用户在代码仓库里说"初始化"时，分析真实仓库，并搭建一套让 AI 能安全协作、先设计再实现的知识与规格基线。

任务不是拷贝空白模板，而是把真实仓库的事实——语言、命令、目录、模块、业务域——写进一套固定的目录契约。基线建立后，任何 AI 拿到 `AGENTS.md` 就知道结构/命令/禁区，拿到 `module-map.md` 就知道依赖边界，拿到 `openspec/` 和 `docs/adr/` 就知道"先设计再实现"的契约与既有决策。

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
- `scripts/fill.sh`：目标清单的事实源 + 确定性填充器。内容本身放在 `templates/`（模板树与产物输出路径一一对应），脚本只负责把缺失/为空目标对应的模板拷到位。`--list` 列目标清单；`--auto [domain...]` 对所有缺失/为空目标自动填充；`<target>` 只填单个目标。已存在且非空的目标一律 SKIP，绝不覆盖。
- `templates/`：全部基线产物的内容事实源。static 文件逐字拷贝；repo-fact 文件是「小节标题 + TODO」骨架；`openspec/specs/_domain_/spec.md` 是按业务域名替换 `__DOMAIN__` 的占位模板。

产物分两类：
- **static（纯静态）**：所有 `CLAUDE.md` 指针、`openspec/changes/AGENTS.md` + `_template/`、`docs/adr/AGENTS.md` + `0000-record-architecture-decisions.md`。内容与仓库无关，缺失/为空时由 `fill.sh` 写死，AI 不手敲。其中 `_template/design.md` 默认带 `## 线框图` 节：每次复制 `_template/` 起新变更，方案自带线框图引导——涉及界面的变更先用字符图画页面/交互，纯后端/接口变更填 `N/A`，从源头保证方案不漏线框图。
- **repo-fact（真实事实）**：根 `AGENTS.md`、`docs/architecture/module-map.md`、`openspec/specs/<domain>/spec.md`。缺失/为空时 `fill.sh` 只铺「小节标题 + `TODO: 需人工确认`」骨架，真实命令/模块/业务规则仍由 AI 填正文。

小节契约放在 `references/file-templates.md`，是契约的逐字组成部分。填 repo-fact 正文前必须先读它。static 文件全文以 `templates/` 对应文件为准（`fill.sh` 负责拷贝），不在别处另存。

## 工作流

为下面的步骤建立一个 TODO 清单，并在每步完成后更新状态。

1. **探测仓库**
   - 语言/框架：`package.json`、`pyproject.toml`/`requirements.txt`、`go.mod`、`Cargo.toml`、`pom.xml`、`build.gradle` 等。
   - 目录结构：顶层与关键源码目录。
   - 真实命令：安装/构建/测试/运行/lint，来自真实脚本与配置，而非猜测。
   - 模块：顶层源码目录或包边界。
   - 业务域：从代码组织（领域目录、服务、模型）归纳出真实业务域，作为 `openspec/specs/<domain>` 的 `<domain>`。

2. **确认范围与边界**
   - MUST 在执行任何文件写入前，向用户输出执行前小结：探测到的技术栈、模块、业务域和计划生成的文件清单。
   - 边界异常时降级处理：空仓库/非代码仓库 → 生成最小 `AGENTS.md` 并把无法填充处标注 `TODO`，必要时向用户要上下文；探测不到命令或模块 → 标注 `TODO: 需人工确认`，绝不编造。
   - 业务域过多：当探测到的业务域超过 8 个时，MUST 先向用户列出业务域清单并请其确认范围，再生成 `spec.md`，绝不静默批量写入。
   - 若任何已存在文件会被触及，先读它并向用户说明，确认后再处理。

3. **跑探针，拿路由表**
   - `scripts/probe.sh <探测到的业务域...>`，得到每个目标的 `状态 × 类别`。后续按表分流，不再凭记忆判断哪些文件该建。

4. **按路由表分流填充**
   - `static + MISSING/EMPTY` → `scripts/fill.sh <path>` 直接写死，AI 不碰。
   - `repo-fact + MISSING/EMPTY` → `scripts/fill.sh <path>` 铺骨架（小节标题 + TODO），正文留到第 5 步。
   - `* + PRESENT` → 不动文件，登记进第 6 步的「需人工/AI 核对」清单（读现有 → 只补缺失小节 / 报差异 → 覆盖前确认）。
   - 便捷：缺失/为空的目标可一次 `scripts/fill.sh --auto <业务域...>` 全部铺好（PRESENT 自动 SKIP，幂等安全）。

5. **填 repo-fact 骨架的正文**
   - 先读 `references/file-templates.md` 的小节契约。
   - 根 `AGENTS.md`：把「项目概览/项目结构/常用命令/编码规范/禁止事项」的 `TODO` 替换成真实事实（修改前后检查两节脚本已写死，保留）。
   - `docs/architecture/module-map.md`：按真实模块复制扩展骨架那一节，逐个填职责边界/入口/上游/下游/禁止依赖。
   - `openspec/specs/<domain>/spec.md`：填域定位、可验证的业务规则、场景、可验证行为；探测不到的保留 `TODO: 需人工确认`，不硬造。

6. **核对 PRESENT 文件 + 幂等校验 + 产出清单**
   - 对第 4 步登记的 PRESENT 文件：读现有内容，只补缺失小节或报差异，覆盖前经用户确认。
   - 核对验收标准，输出 WROTE / SKIP / 待 AI 填正文 / 标注 TODO 的文件清单。

## 验收标准

- `AGENTS.md`、`CLAUDE.md`、`docs/architecture/module-map.md`、`openspec/specs/<domain>/spec.md`、`openspec/changes/`、`docs/adr/` 全部就位。
- 各文件的小节标题与 `references/file-templates.md` 的约定标题逐字一致；repo-fact 文件填完正文后，除标注 `TODO: 需人工确认` 处外不含占位符（如 `<xxx>`、`npm run <command>`）。static 模板（`_template/`、骨架里的 `<change-id>` / `<项目名>` 等）的占位符是设计如此，不在此限。
- 每个 `CLAUDE.md` 只含指向同目录 `AGENTS.md` 的一行。
- `openspec/changes/_template/design.md` 含 `## 线框图` 节，`changes/AGENTS.md` 流程把"涉及界面的变更先画线框图"写进 design 阶段。
- 目录级说明文件都是 `AGENTS.md` + `CLAUDE.md`，无 README 充当目录指南。
- 已存在文件未被破坏性覆盖；无法填充处显式标注 `TODO`，无编造命令/依赖。

## 失败路径

- **非代码仓库 / 空仓库**：不要假装有结构。生成最小 `AGENTS.md`，把结构/命令/模块小节标注 `TODO: 需人工确认`，并提示用户补充。
- **命令或模块探测不到**：标注 `TODO: 需人工确认`，绝不编造。
- **目标文件已存在**：默认跳过覆盖。读出现有内容，只补缺失小节或报告差异，覆盖前必须经用户确认。
- **业务域不清晰**：建一个起步 `spec.md` 并标注 `TODO`，不硬造业务规则。

<example>
用户在一个 Node + TypeScript 仓库里说"初始化"。

流程：
1. 探测到 `package.json`（scripts: build/test/lint）、`src/` 下有 `auth/`、`orders/`、`payments/` 三个领域目录。
2. 执行前小结："栈=Node+TS；模块=auth/orders/payments；将生成 AGENTS.md、CLAUDE.md、module-map.md、specs/{auth,orders,payments}/spec.md、changes/、adr/"。
3. `scripts/probe.sh auth orders payments` → 全部 MISSING。
4. `scripts/fill.sh --auto auth orders payments`：static 全部写死（各 CLAUDE.md、changes/adr 的 AGENTS.md、_template/、0000 ADR）；repo-fact 铺骨架（根 AGENTS.md、module-map.md、三个 spec.md）。
5. 填 repo-fact 骨架正文：根 `AGENTS.md` 常用命令抄真实 scripts、禁止事项写入"payments 不得依赖 orders 的内部模块"；`module-map.md` 三个模块各填一节；三个 `spec.md` 据真实代码写业务规则与场景。
6. 输出清单，标注 payments 的计费规则为 `TODO: 需人工确认`（代码未明确）。
</example>

<bad-example>
错误：用户说"初始化"后，直接拷一套带占位符（`<项目名>`、`npm run <command>`）的空白模板写盘，并新建 `openspec/changes/README.md` 解释工作流。

为什么错：内容没有来自真实仓库（命令是占位符而非真实 scripts），违反"内容来自真实仓库"；用 README 当目录指南，违反"目录级说明一律用 AGENTS.md + CLAUDE.md"。
</bad-example>
