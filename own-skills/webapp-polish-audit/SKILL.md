---
name: webapp-polish-audit
display_name: Web UI Polish Audit
display_name_zh: Web UI 打磨审计
description: >
  对浏览器最终渲染的 Web UI 做只读打磨审计，输出截图、DOM、可访问性、计算样式和交互状态支持的可验证发现。用于用户要求 audit、review、critique、diagnose、产品感检查、完成度检查、真实产品感、good taste、not demo-like、refined，或明确要求先审查可见 UI bug 的场景。Do NOT trigger when 用户要求实现、修复、改代码、产出 diff、大范围重新设计、纯后端/API/数据/CLI/基础设施、产品策略、UX 研究、信息架构或纯文案任务；若请求同时包含审查与实现，本 Skill 只执行审查阶段并把实现留给后续工作流。
version: 0.4.0
author: aquarius-wing
updated_at: 2026-07-17
origin: own
allow_exec: true
---

# Web 产品打磨审计

只审查浏览器最终渲染出的用户可见 UI，不读取项目源码，不修改项目或外部状态。最终产物是经过验证的 `polish-audit-report.json` 和面向用户的简短摘要。

## 0. 不可违反的边界

- MUST 只使用浏览器截图、最终 DOM/a11y、可见文本、计算样式、布局盒、交互状态和网络可见资源状态作为证据。
- NEVER 读取项目源码、组件、样式源码、路由、配置、package 文件、生成源码或内部组件名。
- NEVER 修改项目文件、依赖、资源、内容、路由、配置或 git 状态。
- NEVER 提交表单、创建/更新/删除数据、变更权限、上传文件或触发外部副作用。
- MUST 只审计 `audit-state.json.originAllowlist` 内 origin 的页面；不在允许清单里的 origin 一律视作跨源，不 navigate、不 click-that-navigates、不 hover-that-preloads、不进 new-tab、不打开 `target="_blank"`。子域与主域视作不同 origin（例如 `tranfu.com` 与 `offerpilot-app.tranfu.com` 是两个 origin）。
- NEVER 顺着首页或任何被审页面的 `<a href>` 主动进入其他 origin；此类链接的存在本身可作 finding evidence，但不打开。要审跨源子站必须由用户在 S0 显式点名并使 scope = `explicit-multi-page`。
- 审计产物只能写入 `/tmp/webapp-polish-audit/<RUN_ID>/`；项目目录零写入。
- 用户只要求实现、修复或提交 diff 时，停止使用本 Skill；不要把实现请求改写成审计请求。
- 用户明确要求“先审查再修复”时，本 Skill 只完成审查并结束；实现由后续工作流接手。

## 1. 运行时能力契约

开始前检查以下能力：

| 能力 | 用途 | 缺失时处置 |
| --- | --- | --- |
| Browser | 打开最终页面、交互、截图、DOM/a11y/样式证据、最终锚定 | 报 BLOCKER 并结束 |
| 临时目录读写 | 在 `/tmp/webapp-polish-audit/` 保存 PNG/JSON/进度和报告 | 报 BLOCKER 并结束 |
| 图片查看 | 判断者读取落盘 PNG | 无 SubAgent 时才允许主会话逐图 fallback；否则报对应单元 BLOCKER |
| SubAgent/Task | 隔离探索、判断、验收和聚合 | 使用 `local sequential fallback`，仍须先采集后逐图判断 |
| Plan/TODO | 阶段和截图单元对账 | 在回复中维护同结构的可见清单 |
| Node.js | 执行 bundled `.mjs` 探针和最终报告 validator | 报 BLOCKER；不要跳过机械终验 |

工具名由当前 harness 映射；不要假设 `Browser`、`Agent`、`node` 或 `shell` 是所有运行时的固定工具名。只要运行时能力等价即可。临时文件写入不授权读取或修改项目源码。

## 2. 唯一职责表

### 主 Agent

主 Agent 只承担以下职责：

1. 读取本 `SKILL.md`，并在进入某阶段前完整读取该阶段直接引用的 pipeline 文档。
2. 解析用户意图、目标 URL、审计范围和运行时能力。
3. 建立 runDir、阶段 TODO 和 `audit-state.json`，调度、等待、中断或重派 SubAgent。
4. 验证各阶段输出外形和状态转换；不替判断者做首次截图判断。
5. 对 aggregator 提出的 `actionable` 发现回 Browser 最终锚定并记录结果。
6. 运行最终报告验证器；只有验证通过才能向用户声称审计完成。

主 Agent NEVER：

- 从截图开始独立提出 UI 发现；
- 把多个阶段合并给一个 SubAgent；
- 让同一 SubAgent 在同一轮审计中兼任 judge 与 verifier、verifier 与 aggregator，或 aggregator 与 final verifier；
- 静默删除 aggregator 的 finding、gap 或 blocker。

### SubAgent 角色

| 角色 | 单个工作单元 | 允许的输入 | 唯一输出 |
| --- | --- | --- | --- |
| Discovery | 一个 seed | seed URL、runDir、发现脚本 | 页面树 + raw-urls.txt |
| Reference selector | 一个页面树分支 | 分支、inventory 脚本 | 页面级参考文档计划 |
| Explorer | 一个代表页面 | URL、参考文档、runDir | PNG/JSON + manifest |
| Dispatcher | 当前审计全部已验收 manifest | manifests、页面参考计划 | judgement units + filtered md |
| Judge | 一张截图或一个规定对比组 | PNG、inventory、筛选后参考文档 | 截图级 judgement |
| Verifier | 一个上游工作单元 | 原始输入、上游输出 | `pass|fail` + gaps |
| Aggregator | 当前审计全部已验收 judgement | judgements、manifests、页面计划 | `polish-audit-report.draft.json` |
| Final verifier | 最终报告与执行台账 | report、audit-state、runDir | `pass|fail` + errors |

每个 judge 单元 MUST 使用一个新的隔离任务上下文；该单元的 verifier MUST 使用另一个隔离上下文。Aggregator 和 final verifier 必须各自使用新的独立上下文。

## 3. 有限并发调度

不要把“并发”解释为一次启动无限 SubAgent。

1. 计算 `workerCapacity`：当前可用 SubAgent 槽位数；不知道时取 `1`。
2. 将同阶段互不依赖的单元切成大小不超过 `workerCapacity` 的批次。
3. 每个 Judge 批次完成后，立即为该批启动对应的独立 verifier 批次；该批全部进入 `verified|blocked` 后再启动下一批 Judge。
4. 不得积压全部 Judge 输出后才统一验收，也不得在 verifier 完成前把 unit 标成完成。
5. 已用于 bootstrap、selector 或 explorer 的上下文不得改作 judge/verifier/aggregator。
6. 若 harness 有总 Agent 数硬上限，优先顺序执行；不得通过角色串岗规避隔离。仍无法创建独立上下文时，把未覆盖单元记为 BLOCKER。

## 4. 单一状态机

CREATE A TODO LIST FOR THE TASKS BELOW。只以本节 S0–S7 作为顶层流程；其他章节和 references 只能定义某阶段内部细节，不得重新分配 ownership。

### S0 — 输入、能力与运行目录

1. 判定意图：
   - 只审查/诊断 → 继续；
   - 只实现/修复 → 退出本 Skill；
   - 先审查再实现 → 只执行审查并在完成后交接。
2. 解析目标 scope（三选一，严格按字面判定，禁止扩大解读）：
   - `explicit-single-page`：用户点名一个页面、路由或当前页面。语义 = **只在该 URL 的 rendered DOM 上做审计**；不点 same-origin 的其他路由链接，不点跨源链接，不进任何 new-tab，不打开 `target="_blank"`。`<a>` 的存在本身可作 finding evidence，但不打开。“审首页”“审这一页”“审当前页”等表述一律命中本档，不得因为首页含 nav / 子域入口就自动升级为 multi-page。
   - `explicit-multi-page`：用户显式列出多个路由，或明确要求“全站 / 完整流程 / 顺着 X 走到 Y”。用户列出的 URL 全部进入 `originAllowlist`。
   - `inferred-child-pages`：用户只给入口 URL 且未限制范围，且未点名任何单页。此时才可派 Discovery。
3. 若没有 URL：优先使用当前已打开的 HTTP(S) 页面；仍没有则向用户索取 URL 并退出。
4. 检查 §1 能力；失败按表中出口结束。
5. 创建唯一 `/tmp/webapp-polish-audit/<YYYYMMDD-HHMMSS>-<run-name>/`。
6. 建立 `audit-state.json`：记录 `run_id`、`scope`、`originAllowlist`、S0–S7 状态及后续 judgement units。
   - `originAllowlist` 计算规则：
     - `explicit-single-page` → `[origin(target_url)]`，长度必须为 1；
     - `explicit-multi-page` → 用户显式列出的每个 URL 的 origin 去重后的集合；
     - `inferred-child-pages` → `[origin(seed_url)]`，Discovery 只沿 same-origin 走。
   - 子域视作独立 origin。任何后续阶段观察到需要访问不在 `originAllowlist` 内的 origin 时，MUST 停止访问，记 `blocker` 且 gap 类型 = `cross-origin-not-inspected`，绝不静默扩大 allowlist。
7. 创建 S0–S7 TODO；完成 S0，进入 S1。

### S1 — 可选页面发现

- `explicit-single-page`：记录 `skipped_explicit_single_page`，直接进入 S2。
- 其他范围：完整读取 `references/pipeline/14-child-page-tree-discovery.md`，按其中任务模板派一个 Discovery SubAgent；验收失败走「重派阶梯」。通过后进入 S2。

### S2 — 参考文档选择

完整读取 `references/pipeline/15-page-audit-dispatch-and-reference-selection.md`。按页面树分支分批派 Reference selector，再为每个分支派独立 verifier。所有分支都有 `pass` 或明确 BLOCKER 后进入 S3。

### S3 — 页面探索与证据落盘

完整读取 `references/pipeline/16-page-exploration-and-capture.md`。按代表页面分批派 Explorer，再为每页派独立 verifier。只有 verifier 通过的 manifest 可以进入 S4；失败页面保留为 BLOCKER，其他页面继续。

Explorer 与该阶段的 verifier MUST 遵守 §0 的 origin 门禁：任何 navigate / click-that-navigates / hover-that-preloads / new-tab / `target="_blank"` 打开动作，MUST 先校验目标 origin 属于 `audit-state.json.originAllowlist`；不属于则展开态截图后即停，落 gap 类型 `cross-origin-not-inspected`。违反此约束的 Explorer 输出一律视作验收失败，走「重派阶梯」。

### S4 — 截图判断与逐单元验收

完整读取 `references/pipeline/17-screenshot-judgement-dispatch.md`。

1. 用 manifest 生成 judgement units：默认每张截图一个单图单元；只有 reference 规定的主题、视口、状态对可以组成对比单元。
2. 派一个新的 Dispatcher SubAgent，使用 reference 中固定模板为每个单元分配 filtered md；输出漏掉任一 screenshot 或对比组即验收失败。
3. 把每个单元写入 TODO 和 `audit-state.json`，初始状态 `planned`。
4. 按 §3 分批派 Judge；每个单元一个隔离上下文。
5. Judge 返回后按 §3 分批派独立 Verifier；通过记 `verified`，重派仍失败记 `blocked`。
6. 所有单元均为 `verified|blocked` 后进入 S5；存在 `planned|running` 时禁止进入下一阶段。

### S5 — 独立聚合

派一个新的 Aggregator SubAgent。它只接收：经过验收的 judgement、manifest、页面参考计划、`audit-state.json` 和 `{ABSOLUTE_SKILL_DIR}/references/pipeline/18-final-report-contract.md`。输出必须是 `/tmp/.../polish-audit-report.draft.json`，不得使用自定义字段或枚举。

Aggregator 不是 verifier；任何前序 verifier 不得兼任。输出缺失或 JSON/schema 不合法时走「重派阶梯」，不得由主 Agent凭记忆重写报告。

### S6 — 主 Agent 最终 Browser 锚定

主 Agent只验证 draft 中的 `actionable` 发现：

- 确认 → 保留，追加 `browser:` 证据引用；
- 推翻 → 将 finding 移入 `disposition_history`，写明 Browser 证据和 `rejected_after_anchor`；
- 无法验证 → 转为对应 class 的 blocker + gap，绝不能改成 `already_satisfied`；
- Browser 发现 draft 没有的新问题 → 不在主会话直接定罪，补派一个 Judge + Verifier 单元后再聚合该增量。

锚定至少覆盖一个桌面视口（宽 ≥1280、高 ≥720）和一个窄视口（宽 ≤390、高 ≤844），并记录精确尺寸。项目另有明确 breakpoint 协议时，额外覆盖该协议要求的宽度或把未覆盖项写入 gaps。

保存为 `polish-audit-report.json`，进入 S7。

### S7 — 机械校验、独立终验与输出

完整读取 `references/pipeline/18-final-report-contract.md`。

1. 运行：

   ```text
   node {ABSOLUTE_SKILL_DIR}/scripts/validate-polish-audit-report.mjs <report.json> <audit-state.json> <runDir>
   ```

2. validator 失败 → 只根据已有证据修正一次并重跑；仍失败则报告 BLOCKER，禁止声称完成。
3. validator 通过 → 派新的 Final verifier，使用 reference 里的固定模板检查执行台账与报告语义一致性。
4. Final verifier 失败 → 走「重派阶梯」；仍失败则报告 BLOCKER。
5. 两道校验都通过 → 勾完 TODO，向用户输出按严重度排序的简短摘要、明确 gaps/blockers，并给出 `polish-audit-report.json` 路径；不要在回复中重复整份 JSON。
6. 产出报告并结束。

## 5. SubAgent 重派阶梯

任一工作单元失败：

1. 给原 SubAgent 一次纠正性 follow-up，点名验收失败项。
2. 仍失败 → 中断原任务并确认停止；用新的隔离上下文重派更小单元。
3. 仍失败 → 将该单元记为 BLOCKER，保留其他单元继续。

只有运行时完全没有 SubAgent/Task 能力时才使用 `local sequential fallback`。Fallback 仍必须严格按 S0–S7 顺序，并且一次只判断一张截图/一个对比组；不得把采集和判断合并。

## 6. 参考文档路由

只在对应阶段读取直接相关文件：

- 页面发现：`references/pipeline/14-child-page-tree-discovery.md`
- 页面参考选择：`references/pipeline/15-page-audit-dispatch-and-reference-selection.md`
- 页面探索：`references/pipeline/16-page-exploration-and-capture.md`
- 截图判断：`references/pipeline/17-screenshot-judgement-dispatch.md`
- 最终 schema 与终验：`references/pipeline/18-final-report-contract.md`
- Explorer 需要完整采集规则时：`references/page-flow/00-inspection-procedure.md`
- 具体审查维度由 S2 基于浏览器 inventory 选择；不要默认读取全部 `references/dimensions/*.md`。

重叠归属：即时交互反馈归 03，动作结果归 12；布局移动归 04；数据状态归 05、状态文案归 13；表单归 07；键盘/触摸/缩放/对比度归 10，响应式重排归 11；多记录扫描归 06，导航与返回归 08。

## 7. 完成定义

只有同时满足以下条件才能称为完成：

- S0–S7 均处于 `completed|completed_with_blockers|skipped_explicit_single_page` 的合法终态；
- manifest 中每张截图/规定对比组都对应一个 `verified|blocked` judgement unit；
- 每个选中维度的每个 class 都有 `actionable|already_satisfied|blocker|not_applicable`；
- 每个 actionable/already_satisfied 都引用当前浏览器证据；
- 每个 blocker 都有 gap，并被顶层 blockers 引用；
- 不存在与 gap 同维度同 class 的 `already_satisfied`；
- 所有 evidence refs 指向 runDir 文件或以 `browser:`/`interaction:` 开头；
- 最终 validator 与 Final verifier 都返回 pass。

任何一项不满足都必须作为 blocker 对用户可见，不能静默降级为“已完成”。
