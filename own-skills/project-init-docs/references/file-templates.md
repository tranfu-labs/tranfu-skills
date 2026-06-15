# 文件契约与模板

这些是逐字契约。小节标题固定不翻译；正文用用户语言（默认中文）填真实仓库事实。探测不到的内容标注 `TODO: 需人工确认`，绝不编造。

产物分两类，决定谁来填：

- **static（纯静态）**：内容与仓库无关，全文以 `scripts/fill.sh` 为唯一事实源；缺失/为空时脚本写死，AI 不手敲、不在此另存第二份。下文标 **【static · fill.sh】**。
- **repo-fact（真实事实）**：缺失/为空时脚本只铺「小节标题 + `TODO: 需人工确认`」骨架，正文由 AI 按本文件的小节契约填真实仓库事实。下文标 **【repo-fact · AI 填正文】**。

填法路由由 `scripts/probe.sh` 的 `状态 × 类别` 决定（见 SKILL.md 工作流）。

## 通用规则

### 目录级说明：AGENTS.md + CLAUDE.md（绝不用 README）

任何需要解释"怎么在这个目录工作"的地方，都生成两份文件，绝不用 README：

- `AGENTS.md`：真实操作内容。
- `CLAUDE.md`：仅一行，路径相对该目录：
  ```
  See [AGENTS.md](AGENTS.md) for guidelines in this directory.
  ```

根目录的 `CLAUDE.md` 用项目级措辞：

```
See [AGENTS.md](AGENTS.md) for project overview and contribution guidelines.
```

`module-map.md`、`spec.md`、ADR 文件是具名契约产物，保留专用名，不被 `AGENTS.md` 取代。

### 幂等与不覆盖

- 目标文件已存在：默认不覆盖。先读现有内容；缺小节就补缺失小节，否则报告差异。
- 任何破坏性覆盖前，必须向用户说明并取得确认。
- 无法从仓库确定的字段，写 `TODO: 需人工确认`，绝不用占位符冒充真实值（如 `npm run <command>`）。

---

## 1. 根 AGENTS.md 【repo-fact · AI 填正文】

AI 的项目操作手册。脚本铺好下列小节骨架（`修改前检查` / `修改后检查` 两节脚本已写死真实步骤，保留），其余小节正文按契约填真实事实。小节契约：

- `## 项目概览`：一句话定位 + 技术栈（来自真实依赖/配置）。
- `## 项目结构`：关键目录树，每个目录一行职责说明（来自真实目录）。
- `## 常用命令`：安装 / 构建 / 测试 / 运行 / lint，来自真实 scripts（package.json / Makefile / justfile / pyproject 等）。
- `## 编码规范`：语言版本、格式化与 lint 规则、命名与提交约定，来自真实配置（.editorconfig / eslint / prettier / ruff / golangci 等）。
- `## 修改前检查`：读 `docs/architecture/module-map.md` 确认依赖边界；读相关 `openspec/specs/<domain>/spec.md`；确认禁止依赖。
- `## 修改后检查`：跑测试 / lint / 构建；更新受影响的 spec 与 ADR；必要时在 `openspec/changes/` 记录变更。
- `## 禁止事项`：禁止依赖关系、禁止改动的目录、禁止提交的内容（密钥、生成物等），来自真实约束。

## 2. CLAUDE.md（根 + 各目录）【static · fill.sh】

见上"目录级说明"规则。仅一行指针，路径相对所在目录。全文以 `scripts/fill.sh` 为准。

## 3. docs/architecture/module-map.md 【repo-fact · AI 填正文】

系统模块地图。脚本铺好单节骨架，按真实模块复制扩展。模块来自真实顶层源码目录/包。每个模块一节，标题用模块名：

- `### <模块名>`
  - `职责边界`：这个模块负责什么、不负责什么。
  - `入口`：对外暴露的文件/函数/接口。
  - `上游`：谁调用它。
  - `下游`：它依赖谁。
  - `禁止依赖`：明确不能依赖谁（防止隐含约束被破坏）。

## 4. openspec/specs/<domain>/spec.md 【repo-fact · AI 填正文】

某业务域的当前事实规格。脚本按传入的业务域铺骨架（标题替换为域名），正文由 AI 填。`<domain>` 来自真实业务域。小节契约：

- `## 域定位`：这个业务域负责什么。
- `## 业务规则`：MUST / MUST NOT 列表（可验证的硬约束）。
- `## 场景`：编号场景或 Given/When/Then。
- `## 可验证行为`：如何验证该域满足规格（测试、命令或人工验收）。

业务域不清晰时，建一个起步 `spec.md`，规则与场景标注 `TODO: 需人工确认`。

`## 业务规则` 是这个文件最容易写烂的小节。每条规则必须可验证：

- 不可验证（绝不这样写）：`系统应该友好地处理用户输入`、`订单处理要尽量快`。
- 可验证（应这样写）：`MUST 拒绝金额为负的订单并返回 422`、`MUST 在支付成功后 5 秒内将订单状态置为 paid`。

## 5. openspec/changes/ 【static · fill.sh】

变更工作区——先设计再实现。本节全部文件全文以 `scripts/fill.sh` 为准；下方小节说明仅供理解结构。

### openspec/changes/AGENTS.md

- `## 变更工作流`：一次需求/业务变更建一个 `openspec/changes/<change-id>/` 目录。
- `## 目录内容`：
  - `proposal.md`：为什么改、改什么、影响面。
  - `design.md`：怎么实现、方案与权衡。
  - `tasks.md`：可勾选的任务清单。
  - `spec-delta/`：对 `openspec/specs/` 的增删改（先写 delta，实现后再合并回 specs）。
- `## 流程`：proposal → design → tasks → 实现 → 把 spec-delta 合并回 `openspec/specs/`。

### openspec/changes/CLAUDE.md

一行指针（见通用规则）。

### openspec/changes/_template/

供后续变更复制的空模板：

- `proposal.md`：含 `## 背景` / `## 提案` / `## 影响` 小节。
- `design.md`：含 `## 方案` / `## 权衡` / `## 风险` 小节。
- `tasks.md`：含一个 `- [ ]` 任务示例。
- `spec-delta/.gitkeep`：占位，说明此处放对 specs 的增删改。

## 6. docs/adr/ 【static · fill.sh】

架构决策记录。本节全部文件全文以 `scripts/fill.sh` 为准；下方小节说明仅供理解结构。

### docs/adr/AGENTS.md

- `## ADR 规范`：命名 `NNNN-title.md`，序号递增。
- `## 每条 ADR 含`：背景（context）、决策（decision）、状态（status：proposed/accepted/superseded）、后果（consequences）。
- `## 何时写 ADR`：做出会影响隐含约束的重要技术/架构选择时。

### docs/adr/CLAUDE.md

一行指针（见通用规则）。

### docs/adr/0000-record-architecture-decisions.md

首条 ADR，记录"本项目采用 ADR 记录架构决策"这一决策本身，并作为后续 ADR 的格式样例。小节：`## 状态` / `## 背景` / `## 决策` / `## 后果`。

## 7. docs/wireframes/ —— 字符图线框（默认生成）

随基线**默认生成**，不做 UI 判定。用等宽字符快速对齐每个页面"有哪些信息块、整体框架、谁在什么位置"，**只表达信息架构与版式，不表达视觉样式/控件状态变体**。

是否保留由仓库根 `AGENTS.md` 的「线框图」一节决定：无界面的工具/库类项目后续按该规则删除整个目录。init 阶段只负责铺好、不替用户判断。

归类：
- `docs/wireframes/{AGENTS.md, CLAUDE.md, legend.md, _template/page.md}` 是 **static**，全文以 `scripts/fill.sh` 引用的 `assets/wireframes/` 为唯一事实源，AI 不手敲、不另存。默认无条件生成。
- `docs/wireframes/flow.md`（页面流转图）和 `docs/wireframes/pages/<page>.md` 是 **repo-fact**：脚本铺骨架（flow.md 写死说明+流程示例+TODO 步骤表；page.md 复制 `_template/page.md` 并替换页面名），正文由 AI 填。flow.md 默认铺；页面文件探测到路由时才生成。

### 比例尺（逐字契约，写死在 docs/wireframes/AGENTS.md）

- 单位是**显示列**（等宽字体实际占的列数），不是字符个数（codepoint）。横向 1 显示列 = 12px：**全角字符（中日韩，东亚宽度 W/F）占 2 列，其余（半角、框线、歧义宽 A 类如 `①◯·—`）一律占 1 列**；纵向 1 行 = 24px。
- 断点换算：桌面 1440×900 → 120 列 × 38 行；平板 768×1024 → 64 列 × 43 行；手机 375×812 → 31 列 × 34 行。行数为版面上限、不强制填满。
- 每行补齐到右边框正好落在目标列，框线才真对齐（一行纯中文 = 60 字 × 2 列 = 120 列）。
- 校验唯一推荐 Python `east_asian_width`（W/F 记 2、其余记 1，脚本见 `assets/wireframes/AGENTS.md`）；**禁用 `awk '{print length}'`、codepoint 计数、以及 `wc -L`（macOS/BSD 不可靠）**。

### page.md 结构契约

- **页首声明块**：比例尺 + 本页覆盖的断点清单（含真实 px）。
- **字符图**：每个断点一个框组，框上一条尺寸条 `真实px（显示列 × 行）`，显示列数 MUST = 真实px ÷ 比例尺。
- **注释表**：紧跟字符图，列固定 `编号 | 元素 | 状态/交互 | 数据来源 | 引用控件`；框内元素打编号圆点 `①②③`，与表逐条对应、无孤儿编号。

### flow.md 结构契约

- **按用户流程分节**：`## 登录流程`、`## 忘记密码流程`…，每节一张字符流程图 + 一张步骤表（列固定 `步 | 从 | 到 | 触发`），编号与图一一对应、无孤儿编号。
- **节点 = 真实页面**：实线框 `┌─ 页面名 路由 ─┐` + 框内一行指向 `pages/<page>.md`，可跨流程复现；**同页态变化用虚线框 `┄┊` 节点**，不伪造成新页面。
- 流程图不套比例尺、不分断点。流程来自真实路由+产品意图，推不出标 `TODO`。

### 消歧义（逐字契约）

字符形状会撞车，容器必须标明身份：
- 盒子类容器（卡片/表格/弹窗/区块）→ 顶边左角嵌中文类型标签，如 `┌─ 卡片 ──┐`、`╔═ 弹窗 ═╗`。
- 线性控件（标签页/面包屑/工具栏）→ 行首加中文类型前缀，如 `标签页 ‹标签A› 标签B`。
- 简单控件（按钮/输入/下拉）字符已不歧义，不强制加标签。控件统一画法见 `legend.md`。
