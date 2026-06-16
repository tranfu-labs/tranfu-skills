# repo-fact 正文填写契约

本文件是 **repo-fact 类产物填正文时的契约手册**。`templates/` 只铺「小节标题 + `TODO: 需人工确认`」骨架，本文件规定每个小节该填什么真实仓库事实。填 repo-fact 正文前必须先读它。

小节标题固定不翻译；正文用用户语言（默认中文）填真实仓库事实。探测不到的内容标注 `TODO: 需人工确认`，绝不编造。

产物分两类，决定谁来填：

- **static（纯静态）**：内容与仓库无关，全文以 `templates/<对应路径>` 为唯一事实源（模板树与产物输出路径一一对应）；缺失/为空时 `scripts/fill.sh` 把模板拷到位，AI 不手敲、不在此另存第二份。**本文件不重述其内容**，清单见末尾。
- **repo-fact（真实事实）**：缺失/为空时 `scripts/fill.sh` 从 `templates/` 拷一份骨架，正文由 AI 按本文件下面的小节契约填真实仓库事实。

填法路由由 `scripts/probe.sh` 的 `状态 × 类别` 决定（见 SKILL.md 工作流）。

## 通用规则

### 目录级说明：AGENTS.md + CLAUDE.md（绝不用 README）

任何需要解释"怎么在这个目录工作"的地方，都生成两份文件，绝不用 README：

- `AGENTS.md`：真实操作内容。
- `CLAUDE.md`：仅一行指针，路径相对该目录（全文见 `templates/`）。

`module-map.md`、`spec.md`、ADR 文件是具名契约产物，保留专用名，不被 `AGENTS.md` 取代。

### 幂等与不覆盖

- 目标文件已存在：默认不覆盖。先读现有内容；缺小节就补缺失小节，否则报告差异。
- 任何破坏性覆盖前，必须向用户说明并取得确认。
- 无法从仓库确定的字段，写 `TODO: 需人工确认`，绝不用占位符冒充真实值（如 `npm run <command>`）。

---

## 1. 根 AGENTS.md

AI 的项目操作手册。脚本铺好下列小节骨架（`修改前检查` / `修改后检查` 两节模板已写死真实步骤，保留），其余小节正文按契约填真实事实。小节契约：

- `## 项目概览`：一句话定位 + 技术栈（来自真实依赖/配置）。
- `## 项目结构`：关键目录树，每个目录一行职责说明（来自真实目录）。
- `## 常用命令`：安装 / 构建 / 测试 / 运行 / lint，来自真实 scripts（package.json / Makefile / justfile / pyproject 等）。
- `## 编码规范`：语言版本、格式化与 lint 规则、命名与提交约定，来自真实配置（.editorconfig / eslint / prettier / ruff / golangci 等）。
- `## 修改前检查`：读 `docs/architecture/module-map.md` 确认依赖边界；读相关 `openspec/specs/<domain>/spec.md`；确认禁止依赖。
- `## 修改后检查`：跑测试 / lint / 构建；更新受影响的 spec 与 ADR；必要时在 `openspec/changes/` 记录变更。
- `## 禁止事项`：禁止依赖关系、禁止改动的目录、禁止提交的内容（密钥、生成物等），来自真实约束。

## 2. docs/architecture/module-map.md

系统模块地图。脚本铺好单节骨架，按真实模块复制扩展。模块来自真实顶层源码目录/包。每个模块一节，标题用模块名：

- `### <模块名>`
  - `职责边界`：这个模块负责什么、不负责什么。
  - `入口`：对外暴露的文件/函数/接口。
  - `上游`：谁调用它。
  - `下游`：它依赖谁。
  - `禁止依赖`：明确不能依赖谁（防止隐含约束被破坏）。

## 3. openspec/specs/<domain>/spec.md

某业务域的当前事实规格。脚本按传入的业务域铺骨架（标题替换为域名），正文由 AI 填。`<domain>` 来自真实业务域。小节契约：

- `## 域定位`：这个业务域负责什么。
- `## 业务规则`：MUST / MUST NOT 列表（可验证的硬约束）。
- `## 场景`：编号场景或 Given/When/Then。
- `## 可验证行为`：如何验证该域满足规格（测试、命令或人工验收）。

业务域不清晰时，建一个起步 `spec.md`，规则与场景标注 `TODO: 需人工确认`。

`## 业务规则` 是这个文件最容易写烂的小节。每条规则必须可验证：

- 不可验证（绝不这样写）：`系统应该友好地处理用户输入`、`订单处理要尽量快`。
- 可验证（应这样写）：`MUST 拒绝金额为负的订单并返回 422`、`MUST 在支付成功后 5 秒内将订单状态置为 paid`。

---

## static 文件清单（内容见 templates/，本文件不重述）

下列产物全文以 `templates/` 对应路径为唯一事实源，`scripts/fill.sh` 负责拷贝，AI 不手敲、不在此另存第二份：

- 各 `CLAUDE.md`（根 + `docs/adr/` + `openspec/changes/`）：一行指针，路径相对所在目录。
- `openspec/changes/AGENTS.md` + `_template/`（`proposal.md` / `design.md` / `tasks.md` / `spec-delta/.gitkeep`）：变更工作区——先设计再实现。
- `docs/adr/AGENTS.md` + `0000-record-architecture-decisions.md`：架构决策记录规范与首条 ADR 样例。

要改这些 static 文件的内容，直接改 `templates/` 下对应文件，不要在本文件里复述结构（避免两处漂移）。
