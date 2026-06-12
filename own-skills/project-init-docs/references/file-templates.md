# 文件契约与模板

这些是逐字契约。小节标题固定不翻译；正文用用户语言（默认中文）填真实仓库事实。探测不到的内容标注 `TODO: 需人工确认`，绝不编造。

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

## 1. 根 AGENTS.md

AI 的项目操作手册。小节契约：

- `## 项目概览`：一句话定位 + 技术栈（来自真实依赖/配置）。
- `## 项目结构`：关键目录树，每个目录一行职责说明（来自真实目录）。
- `## 常用命令`：安装 / 构建 / 测试 / 运行 / lint，来自真实 scripts（package.json / Makefile / justfile / pyproject 等）。
- `## 编码规范`：语言版本、格式化与 lint 规则、命名与提交约定，来自真实配置（.editorconfig / eslint / prettier / ruff / golangci 等）。
- `## 修改前检查`：读 `docs/architecture/module-map.md` 确认依赖边界；读相关 `openspec/specs/<domain>/spec.md`；确认禁止依赖。
- `## 修改后检查`：跑测试 / lint / 构建；更新受影响的 spec 与 ADR；必要时在 `openspec/changes/` 记录变更。
- `## 禁止事项`：禁止依赖关系、禁止改动的目录、禁止提交的内容（密钥、生成物等），来自真实约束。

## 2. CLAUDE.md（根 + 各目录）

见上"目录级说明"规则。仅一行指针，路径相对所在目录。

## 3. docs/architecture/module-map.md

系统模块地图。模块来自真实顶层源码目录/包。每个模块一节，标题用模块名：

- `### <模块名>`
  - `职责边界`：这个模块负责什么、不负责什么。
  - `入口`：对外暴露的文件/函数/接口。
  - `上游`：谁调用它。
  - `下游`：它依赖谁。
  - `禁止依赖`：明确不能依赖谁（防止隐含约束被破坏）。

## 4. openspec/specs/<domain>/spec.md

某业务域的当前事实规格。`<domain>` 来自真实业务域。小节契约：

- `## 域定位`：这个业务域负责什么。
- `## 业务规则`：MUST / MUST NOT 列表（可验证的硬约束）。
- `## 场景`：编号场景或 Given/When/Then。
- `## 可验证行为`：如何验证该域满足规格（测试、命令或人工验收）。

业务域不清晰时，建一个起步 `spec.md`，规则与场景标注 `TODO: 需人工确认`。

`## 业务规则` 是这个文件最容易写烂的小节。每条规则必须可验证：

- 不可验证（绝不这样写）：`系统应该友好地处理用户输入`、`订单处理要尽量快`。
- 可验证（应这样写）：`MUST 拒绝金额为负的订单并返回 422`、`MUST 在支付成功后 5 秒内将订单状态置为 paid`。

## 5. openspec/changes/

变更工作区——先设计再实现。

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

## 6. docs/adr/

架构决策记录。

### docs/adr/AGENTS.md

- `## ADR 规范`：命名 `NNNN-title.md`，序号递增。
- `## 每条 ADR 含`：背景（context）、决策（decision）、状态（status：proposed/accepted/superseded）、后果（consequences）。
- `## 何时写 ADR`：做出会影响隐含约束的重要技术/架构选择时。

### docs/adr/CLAUDE.md

一行指针（见通用规则）。

### docs/adr/0000-record-architecture-decisions.md

首条 ADR，记录"本项目采用 ADR 记录架构决策"这一决策本身，并作为后续 ADR 的格式样例。小节：`## 状态` / `## 背景` / `## 决策` / `## 后果`。
