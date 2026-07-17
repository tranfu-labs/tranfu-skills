# 17. 截图判断派发 / Screenshot Judgement Dispatch

这是 S4 的任务文档，供 Dispatcher、Judge 和 judgement Verifier 使用。Aggregator 与最终报告只遵循 `18-final-report-contract.md`。主 Agent 读取本文件是为了正确派发和验收，不在主会话首次判断截图。

S4 是唯一的首次判断阶段。主 Agent 在本阶段只做调度和状态验收；Judge 不开浏览器，只看落盘的截图文件与盘点 JSON。

## 派发规则（Dispatcher）

输入：阶段 2 的页面级 `md` 数组、阶段 3 的 manifest。

派发单位：

- **单图判断者**：默认 manifest 中每张截图一个 SubAgent。
- **对比组判断者**：需要多图比对的维度按组派发，一组一个 SubAgent，输入是该组全部截图路径加该维度文档：
  - `02-theme-experience-equivalence`：同页同视口的明/暗整页对。
  - `11-responsive-task-continuity`：同页同状态的 desktop/mobile 整页对。
  - `04-spatial-stability-and-control`：同页同视口的状态前/后整页对（来自 `states_opened`）。

单图判断者的 `md` 筛选：从页面级 `md` 数组出发，按截图上下文（`state` / `device` / `kind` / `surfaces`）剔除明显无关项。**拿不准就保留**——判断者可以输出 `not_applicable`，被漏发的维度却无人兜底。

| 维度 | 派发处理 |
| --- | --- |
| `02` `04` | 不进单图判断者，改派对比组。manifest 缺对应截图对时记页面级缺口（`02` 在页面无主题开关时记 `not_applicable`）。 |
| `11` | `desktop` 单图剔除；`mobile` 单图保留（窄屏形式目录大半单图可判）；另派 desktop/mobile 对比组管跨视口连续性。 |
| `05` | 只进 `state` 为 `loading` / `empty` / `error` / `no-results` / `permission` / `partial` 的截图；`default` 截图剔除。manifest 无任何状态类截图时不派发，沿用探索阶段的 `gaps`。 |
| `12` | 只进动作结果可见（toast / 成功 / 失败 / 进度）的截图；通常被只读约束挡在 `gaps`，不要凭 `default` 截图硬判。 |
| `01` | 只进 `default` + `desktop` 的整页截图。 |
| `07` | 截图 `surfaces` 不含 `form` 时剔除。 |
| `06` | 截图 `surfaces` 不含 `table` / `list` / `card-list` 时剔除。 |
| `kind: closeup` 的截图 | 只保留 `09`、`13`。 |
| 其余（`03` `08` `09` `10` `13`） | 所有 `full` 截图默认保留。 |

判断者需要样式向量证据时（如 `09` 的 A / B 类），把 manifest `inventory` 中对应视口/状态的 JSON 路径一并传入。

**筛空仍派发**：筛选后 `md` 为空的截图仍然必须派发单图判断者，判断任务只做新鲜眼第一遍（`results` 输出空数组）。新鲜眼兜底对每张截图无条件成立——维度筛选只收窄文档，绝不取消截图的判断。

**派发 TODO**：Dispatcher 输出通过验收后，由主 Agent把 manifest 每张截图/规定对比组写入 TODO 与 `audit-state.json`。一条 unit 对应一个隔离 Judge 任务，绝不把多张截图合给同一个单图 Judge（对比组除外）。

## Dispatcher dispatch template

```text
角色：你是 S4 Dispatcher，只生成 judgement units 和 filtered md，不看图、不做 UI 判断、不聚合报告。

先完整读取 {ABSOLUTE_SKILL_DIR}/references/pipeline/17-screenshot-judgement-dispatch.md 的「派发规则」。

输入：
- manifests: {MANIFESTS}
- pagePlans: {PAGE_PLANS}
- runDir: {RUN_DIR}

要求：
- 每张 manifest screenshot 必须被一个单图 unit 覆盖；规定对比组额外生成 group unit。
- 不得把普通截图任意合并；filtered md 拿不准就保留。
- 只输出 YAML：units: [{id, files, page, state, device, viewport, kind, filtered_md, inventory}]
- 不读取项目源码，不修改文件，不打开 Browser。
```

## 判断任务（SubAgent）

输入：`screenshots`（一张截图或一组对比截图的文件路径与元数据）、`md`（筛选后的维度文档数组）、`inventory`（盘点 JSON 路径，可为空）。

### 第 1 步：新鲜眼第一遍

用运行时的图片查看工具打开每个截图文件。**在读取任何 md 之前**，只凭这张图本身，把你直接看到的问题逐条记下：可见目标 + 一句话现象。挑剔但诚实——没有就给空数组，绝不为了有产出而硬找。这一遍不读任何参考文档，不引用任何规则编号。

### 第 2 步：规则遍

`md` 为空时跳过本步，`results` 输出空数组——你的任务只有新鲜眼第一遍。否则读取 `md` 数组里的维度文档，对每份文档按其形式目录逐类比对截图（需要样式向量的类读 `inventory` JSON）。每个类字母给出 `actionable` / `already_satisfied` / `blocker` / `not_applicable` 之一，附一句证据锚点。

截图级判定与页面级判定的区别：

- **本截图天然不含某类证据**（如桌面整页判不了窄屏重排）→ `not_applicable — 证据不在本截图`。
- **证据本应在本截图却缺失或不可读**（特写模糊、样式向量缺字段）→ `blocker`。
- 页面级证据缺口由 Aggregator 结合 manifest `gaps` 判定，不在截图级凭空升级。

### 第 3 步：合并两遍

新鲜眼发现若被某个形式目录类覆盖，归入该类的 findings；**没有任何类覆盖的，保留在 `uncatalogued` 原样上报，绝不因为目录里没有这一条而丢弃**。

### 第 4 步：只输出 YAML

输出一份 YAML，之前之后都不带散文。

```yaml
screenshot:
  files:
    - "resources__default__desktop__1280x720__closeup--copy-command-btn.png"
  page: "http://localhost:3000/resources/"
  state: "default"
  device: "desktop"
  kind: "closeup"
fresh_findings:
  - target: "button '复制命令'"
    observed: "按钮文字折成两行，第二行只有一个字，按钮被撑高"
results:
  - md: "references/dimensions/09-visual-trust-and-consistency.md"
    class_coverage:
      A: "not_applicable — 证据不在本截图（特写仅单控件）"
      B: "not_applicable — 证据不在本截图"
      C: "not_applicable — 证据不在本截图"
      D: "not_applicable — 证据不在本截图"
      E: "not_applicable — 证据不在本截图"
      F: "not_applicable — 证据不在本截图"
      G: "actionable — 见 findings[0]"
    findings:
      - class: "G"
        severity: "MEDIUM"
        observed: "..."
        impact: "..."
        recommendation: "..."
uncatalogued: []
```

## 页面级归并语义（Aggregator 使用）

- **页面级 `class_coverage`**：同页同 `md` 同类，把所有判断者的截图级结论合并——任一 `actionable` → `actionable`；否则任一 `blocker` → `blocker`；否则任一 `already_satisfied` → `already_satisfied`；全部 `not_applicable` 时查 manifest `gaps`：该类证据本应采到而没采到 → `blocker`，确实不适用 → `not_applicable`。
- **去重**：同一可见问题出现在多张截图或多个判断者 → 合并为一条，列出全部证据文件名。
- **目录外发现**：各判断者的 `fresh_findings` 与 `uncatalogued` 合并去重后，作为「目录外发现」一并上报，不得丢弃。
- **最终锚定**：Aggregator 只产 draft；对要上报的 `actionable` 发现，主 Agent 按 SKILL.md S6 回 Browser 验证。

## 验收标准（判断者输出）

- 合法 YAML；`screenshot`、`fresh_findings`、`results`、`uncatalogued` 键全部存在（可为空数组）。
- `md` 为空时 `results` 为空数组也合法；`fresh_findings` 键仍必须存在。
- `fresh_findings` 在读取任何 md 之前产出，输出顺序位于 `results` 之前。
- 每份带形式目录的 md，其 `class_coverage` 覆盖全部类字母，每个值以四态之一开头。
- findings 以截图文件名为证据，不引用源码、内部组件名、文件修改或浏览器操作。
- `actionable` 的 finding 带非空 `recommendation`。

## Judge dispatch template

```text
角色：你是独立 Judge，只判断一个 judgement unit，不打开 Browser，不读取项目源码，不修改文件。

先完整读取 {ABSOLUTE_SKILL_DIR}/references/pipeline/17-screenshot-judgement-dispatch.md 的「判断任务」。

输入：
- unit: {JUDGEMENT_UNIT}
- runDir: {RUN_DIR}

要求：
- 先打开 unit.files 做 fresh_findings，再读取 unit.filtered_md。
- 使用 severity: BLOCKER|HIGH|MEDIUM|LOW；禁止 P0/P1/P2/P3。
- 只输出本文定义的截图级 YAML，前后不带散文。
```

## Judgement verifier dispatch template

```text
角色：你是独立 judgement Verifier。你没有参与当前 unit 的判断，不打开 Browser，不读取项目源码。

先完整读取 {ABSOLUTE_SKILL_DIR}/references/pipeline/17-screenshot-judgement-dispatch.md 的「验收标准」。

输入：
- unit: {JUDGEMENT_UNIT}
- judgement: {JUDGEMENT_OUTPUT}
- manifests: {MANIFESTS}
- runDir: {RUN_DIR}

验证输出结构、每类四态覆盖、证据只引用 unit/manifest 文件、severity 枚举和 recommendation 完整性。
只输出 JSON：{"verdict":"pass|fail","errors":["..."]}
```
