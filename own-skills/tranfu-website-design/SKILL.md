---
name: tranfu-website-design
display_name: TranFu Website & Product UI
display_name_zh: TranFu 官网与产品 UI
description: >
  Apply TranFu brand and UI rules when creating, modifying, refactoring, reviewing, or visually
  validating TranFu React/Vite websites and product UIs, including public pages, app shells,
  consoles, dashboards, forms, components, responsive layouts, tokens, typography, logos, icons,
  motion, media, and UI-affecting product copy. Trigger for “按 TranFu 风格做页面或组件”
  “检查这个界面是否符合 TranFu 规范”“重构但保持 TranFu 风格” and equivalent design-to-code
  or Visual QA work. Do NOT trigger when the product is not TranFu, the change is visually irrelevant,
  the task is copy-only, logo redesign, a standalone brand book, or a new art direction.
version: 0.3.0
author: chuanye312-coder
updated_at: 2026-07-10
origin: own
---

# TranFu 网站与产品 UI 设计

在 TranFu React/Vite 官网与产品 UI 的创建、修改、重构、设计评审和 Visual QA 中，执行统一的品牌、组件和响应式规范。

## 核心约束

- MUST 先确认任务模式、目标和编辑权限，再修改文件。
- MUST 只加载当前任务需要的参考资料，并记录实际加载项。
- MUST 使用本文件定义的权威边界解决跨文件规则，不按“最后读到的规则”覆盖前文。
- MUST 将未执行的校验记录为 `not_run` 并给出原因；NEVER 把静态推断写成视觉检查通过。
- MUST 输出与任务模式对应的命名报告。
- NEVER 凭记忆补齐缺失的设计规则或品牌资源。
- 本 Skill 是 UI 实现与视觉验证的所有者；页面结构由 `$tranfu-layout-systems` 决定。本 Skill MUST 消费布局产物，NEVER 在布局依赖返回后重新进入同一布局调用。

## 任务模式与完成标准

| 模式 | 典型输入 | 默认权限 | 命名产物 | 完成标准 |
| --- | --- | --- | --- | --- |
| `create` | 新页面、Section、组件或视觉状态 | 用户要求实现且运行时可写时编辑；否则仅建议补丁 | `TRANFU_UI_CHANGE_REPORT` | 结构化记录目标、范围、实际变更或建议补丁、规则、偏离和所有适用校验 |
| `modify` | 修改现有页面、组件、样式或资源 | 同上 | `TRANFU_UI_CHANGE_REPORT` | 同上，并记录未改动的边界 |
| `refactor` | 保持视觉与交互语义的实现重构 | 同上 | `TRANFU_UI_CHANGE_REPORT` | 同上，并验证共享实现没有意外影响无关页面或状态 |
| `review` | 文件、截图、设计稿或明确 UI 区域 | 仅评审，不修改 | `TRANFU_DESIGN_REVIEW` | 每条发现包含严重程度、规则、位置、证据、修复方案和验证方式 |
| `visual_qa` | 运行中的应用、截图或明确 UI 状态 | 仅评审；用户要求修复时切换到 `modify` | `TRANFU_VISUAL_QA_REPORT` | 每个适用视口有独立状态和证据，未检查视口不得标记为通过 |

若实现与评审之间存在会改变权限的实质歧义，提出一个简短问题并等待回答；其他可安全推断的细节直接继续。

## 参考资料与权威边界

### 权威职责

| 来源 | 唯一负责的决策 | 不得覆盖的内容 |
| --- | --- | --- |
| 页面级 `TRANFU_LAYOUT_DECISION` / `TRANFU_LAYOUT_REVIEW` | 页面类型、主要活动、信息组织、Section 顺序、桌面/移动结构及布局评审发现 | 品牌视觉值、组件样式和品牌资源 |
| `references/design-spec.md` | 设计定位、十大原则、三层视觉层级、Logo 与文案方向 | 模块的具体 Token、组件配方和响应式数值 |
| `references/tokens.md` | 颜色、字体、间距、圆角、阴影、图标和状态的基础值与语义 Token | 组件内容结构和页面容器行为 |
| `references/cards.md` | 组件承载、结构、交互模式、适用状态和组件专属几何配方 | 重定义 Token 值、页面宽度和断点 |
| `references/responsive-layout.md` | Browser Header、Viewport Band、Content Rail、宽度、断点、栅格、重排、溢出和视口校验 | 品牌色、字体、组件状态语义 |

组件文档中的颜色、字体、间距、圆角、阴影和图标 MUST 引用 `tokens.md`；只有明确标记为“组件专属几何配方”的高度、宽度或构图尺寸才能由 `cards.md` 单独定义。

### 加载路由

1. 在做出品牌或 UI 决策前，读取 `references/design-spec.md`。
2. 涉及颜色、字体、间距、圆角、阴影、图标、焦点、状态或主题变量时，读取 `references/tokens.md`。
3. 涉及卡片、按钮、Tabs、标签、表单、列表、表格、菜单、浮层或反馈状态时，读取 `references/cards.md`。
4. 涉及页面宽度、容器、栅格、断点、移动重排、媒体构图或溢出时，读取 `references/responsive-layout.md`。

若任一必需资料缺失、不可读或内部格式损坏到无法可靠解释，输出 `TRANFU_DESIGN_BLOCKER_REPORT` 并退出。不要加载与任务无关的模块。

### 冲突处理

按以下顺序解决冲突：

1. 遵循用户对当前任务的明确要求；偏离规范时记录规则、原因、影响和验证结果。
2. 保留布局决策的结构意图和布局评审发现，不用视觉规则擅自改变主要活动或信息组织。
3. 使用 `design-spec.md` 的十大原则处理未覆盖场景和原则冲突。
4. 按上方权威职责表选择唯一模块；不得在不同模块间使用一条总排序。
5. 对窄范围兼容任务可继承既有实现；将不合规范但未获授权迁移的部分记录为继承约束。

同一职责域出现两个不同答案时，不要任选其一；输出 `reference_conflict` 阻塞报告并指出冲突位置。

## 页面布局系统路由

页面级或屏幕级任务包括整页创建或重构、布局类型选择、Section 顺序、导航模型、主工作区，以及页面主要活动的评审或 Visual QA。

按当前模式使用唯一映射：

| 当前模式 | `$tranfu-layout-systems` 模式 | 必需产物 |
| --- | --- | --- |
| `create` | `create` | `TRANFU_LAYOUT_DECISION` |
| `modify` | `modify` | `TRANFU_LAYOUT_DECISION` |
| `refactor` | `refactor` | `TRANFU_LAYOUT_DECISION` |
| `review` | `review` | `TRANFU_LAYOUT_REVIEW` |
| `visual_qa` | `visual_qa` | `TRANFU_LAYOUT_REVIEW` |

调用守卫：

1. 若上下文已有与当前模式匹配且字段完整的布局产物 → 直接复用，NEVER 再次调用布局 Skill。
2. 否则 → MUST 使用 `$tranfu-layout-systems` 恰好一次，并等待它返回命名产物。
3. 若返回 `TRANFU_LAYOUT_BLOCKER` → 输出 `TRANFU_DESIGN_BLOCKER_REPORT` 并退出。
4. 若布局 Skill 不可用 → 本地按其权威 Schema 生成同名产物，记录 `layout_result.status: fallback`，然后继续。

`TRANFU_LAYOUT_DECISION` 的最小消费契约是 `mode`、`primary_activity`、`primary_system`、`frame_layout`、`primary_pattern`、`desktop_structure`、`mobile_structure`、`constraints` 和 `rationale`。`TRANFU_LAYOUT_REVIEW` 的最小消费契约是 `mode`、`summary`、`assessed_layout`、`findings` 和 `inspected_targets`；`visual_qa` 还必须包含 `viewport_checks`。权威完整 Schema 只存在于 `$tranfu-layout-systems/references/layout-contracts.md`，本文件 NEVER 定义第二套布局 Schema。

## 品牌资源与功能图标

按用途选择随 Skill 提供的品牌资源：

- 浅色背景横向组合：`assets/logo-lockup-h-en-primary-on-light.svg`
- 紧凑品牌符号：`assets/logo-symbol-primary.svg`
- 文字标识：`assets/logo-wordmark-primary.svg`
- 应用图标或方形预览：`assets/app-icon-primary.svg`

先复用目标项目中内容一致的现有品牌资源；不存在时再复制所需资源到项目品牌目录，默认使用 `public/brand/`。NEVER 引用用户机器绝对路径、从旧网站抓取替代资源、重绘、改色、拉伸、裁剪或添加效果。需要的资源缺失或不可读时，输出 `missing_logo_asset` 阻塞报告。

### 功能图标调用契约

仅在任务新增、替换、迁移或评审功能图标时执行本节。不要因为页面中存在既有图标就机械迁移整个图标系统。

1. MUST 检查目标项目的 `package.json`、锁文件和相关组件导入，确认框架、包管理器、已安装的图标库及控件组现有风格。
2. React/Vite 项目新增功能图标时 MUST 使用 `reicon-react`；若同一控件组已稳定使用其他图标库，保持一致，除非用户明确要求迁移。
3. 若 `scripts/verify_reicon_icons.py` 缺失或不可执行 → 输出 `missing_reicon_verifier` 阻塞报告并退出。
4. 选择图标前 MUST 运行：
   `python3 <skill-dir>/scripts/verify_reicon_icons.py "<中文或英文功能语义>" --project <target-project> --json`
5. 候选确定后、写代码前 MUST 针对每个图标运行精确校验：
   `python3 <skill-dir>/scripts/verify_reicon_icons.py --exact <PascalCaseName> --project <target-project> --require-installed --json`
   精确校验失败时选择另一个已验证候选并重试；没有合适候选时输出 `unverified_reicon_icon`，NEVER 猜测组件名。
6. 若目标项目尚未安装 `reicon-react`，实现任务在依赖变更属于用户授权范围时使用项目现有包管理器安装，再重新执行步骤 5。未获依赖编辑权限时切换为 `patch_only`，给出安装命令与代码补丁，并将 Reicon 校验记录为 `not_run`；只有用户明确要求交付可运行实现但依赖仍无法安装时，才输出 `missing_reicon_dependency`。不得改用表情符号、文字字符、未验证的内联 SVG 或另一套图标库绕过。
7. 校验通过后 MUST 生成真实导入和 JSX 调用。优先使用直接导入，例如 `import Search from 'reicon-react/icons/Search';`；只导入实际使用的图标。目标项目已统一使用包级命名导入时，可沿用 `import { Search } from 'reicon-react';`。
8. React 属性 MUST 使用目标安装版本支持的精确大小写：`weight="Outline"` 或 `weight="Filled"`。默认使用 `Outline`；仅对 `selected`、`active`、`current` 或明确高强调状态使用 `Filled`。尺寸、颜色和可访问性使用 `references/tokens.md` 的「图标 Token」。
9. 纯装饰图标设置 `aria-hidden="true"`；纯图标控件必须在控件本身提供 `aria-label` 或可见文字。NEVER 用图标库重建 TranFu Logo。
10. MUST 运行目标项目的类型检查或构建，并搜索确认不存在未使用导入、拼错的组件名或同一控件组混用图标库。

`verify_reicon_icons.py` 优先读取目标项目已安装的 `reicon-react`，确保图标名与实际版本一致。仅做选择或评审且项目未安装依赖时，脚本可读取 Reicon 官方 `llms-icons.txt` 生成候选；该结果不得标记为目标项目验证通过，也不得直接用于实现。

## 执行流程

CREATE A TODO LIST FOR THE TASKS BELOW，并在执行过程中更新。

1. **校验目标。** 若项目、文件、截图或 UI 区域缺失到无法开始，询问一项最必要的信息并等待回答。
2. **分类模式。** 选择 `create`、`modify`、`refactor`、`review` 或 `visual_qa`；若不属于本 Skill，说明正确工作流并退出。
3. **确认权限。** 将实现任务标记为 `edited` 或 `patch_only`；将评审和 QA 标记为 `review_only`。
4. **判断页面布局。** 页面级任务按模式映射获取并校验唯一布局产物；非页面级任务记录 `not_applicable`。
5. **加载资料。** 读取设计总览和必要模块，记录文件名；资料缺失、损坏或同域冲突时输出阻塞报告并退出。
6. **检查实现。** 代码任务从实际导入关系和搜索结果定位实现；可优先查看 `package.json`、`src/styles/`、`src/app/` 和 `src/imports/`。找不到目标时输出 `target_implementation_not_found` 并退出。
7. **按模式派发。** `create|modify|refactor` → 子流程「实现 UI 变更」；`review` → 子流程「设计评审」；`visual_qa` → 子流程「Visual QA」；否则输出 `unknown_tranfu_design_mode` 并退出。
8. **执行校验。** 按视口契约、可访问性、动效和项目命令逐项记录状态、原因与证据。
9. **输出并结束。** 输出与模式对应的命名报告后结束。

## 子流程

### 实现 UI 变更

1. 复用现有 Token、组件、布局模式、媒体和动效实现。
2. 将修改限制在用户要求与必要依赖范围，不重做无关 Section。
3. 从权威模块获取值、组件配方和响应式行为；不散落未文档化的一次性值。
4. 涉及功能图标时，完整执行「功能图标调用契约」，记录验证来源、图标名、导入、尺寸和 weight。
5. 只实现组件功能需要的状态，不为静态组件机械添加异步状态。
6. 运行适用校验，记录变更文件、继承约束、偏离和结果。
7. 返回结构化变更记录给主流程步骤 8。

### 设计评审

1. 检查实际目标，不根据文件名或描述推断视觉事实。
2. 按 `HIGH`、`MEDIUM`、`LOW` 排序发现。
3. 为每条发现记录规则、位置、证据、修复方案和验证方式。
4. 没有发现时返回 `findings: []`；NEVER 修改文件。
5. 返回结构化发现给主流程步骤 8。

### Visual QA

1. 运行目标可用时，使用浏览器或等效视觉工具检查实际渲染；不可用时记录原因并继续静态评审。
2. 按视口契约检查重叠、非预期溢出、重排、媒体取景、资源、交互状态、动效、Logo 和品牌偏移。
3. 只把实际观察过的视口标记为 `passed` 或 `failed`。
4. 若没有任何视口被实际观察 → 设置 `overall_status: not_verified`；环境不可用只记录在验证状态中，NEVER 伪造设计 finding。
5. 用户未要求修复时，NEVER 修改文件。
6. 返回结构化视口结果和发现给主流程步骤 8。

## 跨模块执行规则

- 保持底层、 中层、前层的视觉层级，让内容有明确承载并避免无意义卡片嵌套。
- 保持品牌红稀缺，只用于品牌、主操作、选中、焦点或关键强调；错误、警告和成功使用独立状态 Token。
- 不依赖描边或阴影建立整套层级；仅在分隔、可用性、状态、无障碍或明确前层关系需要时使用文档化值。
- 使用语义字体 Token 表达视觉层级，不把视觉 Token 直接等同于 HTML 标题标签。
- 交互控件按需检查 `default`、`hover`、`active/pressed`、`focus-visible`、`disabled`，以及适用的 `selected/current`、`expanded/open`、`checked`、`read-only`。
- 异步和数据组件按需检查 `loading`、`empty`、`error`、`warning`、`success`、`info`。
- 保留键盘焦点、可读对比、图标按钮名称和移动端触控热区。
- 保持动效克制并支持 `prefers-reduced-motion`。
- 使用具体、工程导向并与真实工作相连的产品文案。
- 将任何有意偏离规范的实现写入最终报告。

## 视口与校验契约

按任务类型选择唯一校验集合：

- 页面级、响应式、Header、容器、栅格、断点、溢出或媒体构图任务：检查 `1920`、`1440`、`1280`、`768`、`375`。
- 不改变响应式行为的窄范围组件实现：至少检查 `1440` 和 `375`，或用户明确指定的更相关视口。
- 截图或设计稿评审：只记录实际提供的尺寸；未提供或未渲染的宽度记录为 `not_run`，不得推断通过。

每项校验使用以下结构，不把原因编码进状态字符串：

```yaml
- width: 1440
  status: passed|failed|not_run|not_applicable
  reason: <未运行或失败原因；否则 null>
  evidence: <截图、观察或静态证据>
```

代码任务还要运行目标项目已有且相关的 lint、typecheck、build 或针对性测试。不存在命令或无法执行时记录 `not_run` 和原因。共享 UI 或实现逻辑变更必须检查无关页面与状态是否受到影响。

## 失败路径

- `missing_design_spec`：设计总览缺失或不可读。
- `missing_modular_design_reference`：必需模块缺失或不可读。
- `reference_integrity_failed`：必需资料格式损坏到无法可靠解释。
- `reference_conflict`：同一职责域仍存在互斥规则。
- `missing_logo_asset`：需要的品牌资源缺失或不可读。
- `missing_reicon_dependency`：实现需要 Reicon，但目标项目未安装且未获依赖编辑权限。
- `unverified_reicon_icon`：目标项目已安装版本中无法验证所选 Reicon 组件名。
- `missing_reicon_verifier`：任务需要功能图标，但 `scripts/verify_reicon_icons.py` 缺失或不可执行。
- `target_implementation_not_found`：代码任务找不到实现目标。
- `unknown_tranfu_design_mode`：无法分类任务模式。
- `$tranfu-layout-systems` 返回阻塞产物：转换为 `TRANFU_DESIGN_BLOCKER_REPORT`，使用 `code: layout_blocked`，并在 `upstream` 中保留原始代码和证据后退出。
- `$tranfu-layout-systems` 不可用：本地生成同名布局产物并记录 `layout_result.status: fallback`；若本地也无法判断则输出阻塞报告。
- 未获编辑权限或运行时不可写：切换为 `patch_only`，不视为阻塞。
- 补丁冲突或并发修改：重新读取后只重试一次最小补丁；仍失败则停止编辑并报告冲突文件。
- 浏览器、开发服务器、截图或命令不可用：记录 `not_run`，继续其余可执行检查。
- 截图与代码证据不一致：记录 `deferred_with_user_visible_risk`。
- 视觉问题无法复现：记录 `not_reproduced` 和已检查目标，NEVER 声称已修复。

## 输出 Schema

### 阻塞报告

```yaml
TRANFU_DESIGN_BLOCKER_REPORT:
  status: blocked
  mode: create|modify|refactor|review|visual_qa|unknown
  code: missing_design_spec|missing_modular_design_reference|reference_integrity_failed|reference_conflict|missing_logo_asset|missing_reicon_dependency|unverified_reicon_icon|missing_reicon_verifier|target_implementation_not_found|unknown_tranfu_design_mode|layout_blocked
  message: <阻塞原因>
  target: <项目、文件、截图、UI 区域或 null>
  missing_resource: <缺失资源或 null>
  checks_completed:
    - <已完成检查>
  upstream:
    skill: tranfu-layout-systems|null
    code: <TRANFU_LAYOUT_BLOCKER code 或 null>
    evidence:
      - <上游证据；没有则为空>
  next_action: <解除阻塞的具体动作>
```

### UI 变更报告

```yaml
TRANFU_UI_CHANGE_REPORT:
  mode: create|modify|refactor
  target: <目标项目、页面、文件或组件>
  scope: <本次改动边界>
  permission: edited|patch_only
  changed_files:
    - <实际修改文件；patch_only 时为空>
  suggested_patches:
    - file: <文件路径>
      change: <具体修改或 unified diff；edited 时为空>
  references_loaded:
    - <参考文件>
  layout_result:
    status: passed|fallback|not_applicable
    artifact: TRANFU_LAYOUT_DECISION|null
    primary_system: <主布局系统或 null>
    frame_layout: <页面框架或 null>
    primary_pattern: <页面模式或 null>
    reason: <原因或 null>
  design_rules_used:
    - <参考文件标题或规则>
  inheritance_constraints:
    - <未获授权迁移的既有约束>
  deviations:
    - rule: <规则>
      reason: <偏离原因>
      impact: <影响>
  validation:
    viewport_checks:
      - width: <像素宽度或截图宽度>
        status: passed|failed|not_run|not_applicable
        reason: <原因或 null>
        evidence: <证据>
    accessibility:
      status: passed|failed|not_run|not_applicable
      reason: <原因或 null>
    reduced_motion:
      status: passed|failed|not_run|not_applicable
      reason: <原因或 null>
    reicon:
      status: passed|failed|not_run|not_applicable
      source: installed_package|official_llms_icons|null
      package_version: <目标项目版本或 null>
      icons:
        - concept: <功能语义>
          name: <已验证 PascalCase 组件名>
          import: <实际导入>
          size: 16|20|24|32
          weight: Outline|Filled
      reason: <原因或 null>
    commands:
      - command: <命令>
        status: passed|failed|not_run
        reason: <原因或 null>
```

### 设计评审报告

```yaml
TRANFU_DESIGN_REVIEW:
  mode: review
  target: <文件、截图、设计稿或 UI 区域>
  scope: <评审边界>
  summary:
    overall_status: passed|needs_changes
    high: 0
    medium: 0
    low: 0
  references_loaded:
    - <参考文件>
  layout_result:
    status: passed|fallback|not_applicable
    artifact: TRANFU_LAYOUT_REVIEW|null
    primary_system: <主布局系统或 null>
    frame_layout: <页面框架或 null>
    primary_pattern: <页面模式或 null>
    reason: <原因或 null>
  findings:
    - id: TWD-1
      severity: HIGH|MEDIUM|LOW
      rule: <参考文件标题或规则>
      location: <文件:行号、截图、视口或 UI 区域>
      evidence: <实际证据>
      fix: <具体修复方案>
      verification: <验证方式>
  validation:
    inspected_targets:
      - <实际检查目标>
    viewport_checks:
      - width: <像素宽度或截图宽度>
        status: passed|failed|not_run|not_applicable
        reason: <原因或 null>
        evidence: <证据>
```

### Visual QA 报告

```yaml
TRANFU_VISUAL_QA_REPORT:
  mode: visual_qa
  target: <运行地址、页面或 UI 状态>
  scope: <QA 边界>
  summary:
    overall_status: passed|needs_changes|not_verified
    high: 0
    medium: 0
    low: 0
  references_loaded:
    - <参考文件>
  layout_result:
    status: passed|fallback|not_applicable
    artifact: TRANFU_LAYOUT_REVIEW|null
    primary_system: <主布局系统或 null>
    frame_layout: <页面框架或 null>
    primary_pattern: <页面模式或 null>
    reason: <原因或 null>
  viewport_checks:
    - width: <像素宽度>
      status: passed|failed|not_run
      reason: <原因或 null>
      evidence: <截图或观察>
  findings:
    - id: TWD-QA-1
      severity: HIGH|MEDIUM|LOW
      rule: <参考文件标题或规则>
      location: <视口、截图或 UI 区域>
      evidence: <可见证据>
      fix: <具体修复方案>
      verification: <验证方式>
```

## 输出示例

### `patch_only` 变更

```yaml
TRANFU_UI_CHANGE_REPORT:
  mode: modify
  target: src/app/components/Hero.tsx
  scope: "只调整 Hero 表面色和主 CTA；不改变内容结构"
  permission: patch_only
  changed_files: []
  suggested_patches:
    - file: src/app/components/Hero.tsx
      change: "将大面积 Brand Red 背景替换为 Section Surface，并保留主 CTA 的 Brand Red。"
  references_loaded: [references/design-spec.md, references/tokens.md]
  layout_result: {status: not_applicable, artifact: null, primary_system: null, frame_layout: null, primary_pattern: null, reason: null}
  design_rules_used: ["Brand Red 是信号色"]
  inheritance_constraints: []
  deviations: []
  validation:
    viewport_checks:
      - {width: 1440, status: not_run, reason: "no runnable target", evidence: "static code review only"}
      - {width: 375, status: not_run, reason: "no runnable target", evidence: "static code review only"}
    accessibility: {status: not_applicable, reason: "no interaction change"}
    reduced_motion: {status: not_applicable, reason: "no motion change"}
    reicon: {status: not_applicable, source: null, package_version: null, icons: [], reason: "no icon change"}
    commands: []
```

### 设计评审

```yaml
TRANFU_DESIGN_REVIEW:
  mode: review
  target: src/app/components/Hero.tsx
  scope: "Hero 颜色与主操作"
  summary: {overall_status: needs_changes, high: 1, medium: 0, low: 0}
  references_loaded: [references/design-spec.md, references/tokens.md]
  layout_result: {status: not_applicable, artifact: null, primary_system: null, frame_layout: null, primary_pattern: null, reason: null}
  findings:
    - id: TWD-1
      severity: HIGH
      rule: "references/design-spec.md「十大原则性设计」— 品牌红是信号色"
      location: src/app/components/Hero.tsx:42
      evidence: "整个 Hero 背景使用 Brand Red。"
      fix: "改用中性表面，仅在主 CTA 和焦点状态使用 Brand Red。"
      verification: "Hero 背景为中性表面，品牌红只出现在关键操作。"
  validation:
    inspected_targets: [src/app/components/Hero.tsx]
    viewport_checks: []
```

### 无法运行的 Visual QA

```yaml
TRANFU_VISUAL_QA_REPORT:
  mode: visual_qa
  target: http://localhost:5173
  scope: "首页 Header 与 Hero"
  summary: {overall_status: not_verified, high: 0, medium: 0, low: 0}
  references_loaded: [references/design-spec.md, references/responsive-layout.md]
  layout_result: {status: fallback, artifact: TRANFU_LAYOUT_REVIEW, primary_system: website, frame_layout: stacked-layout, primary_pattern: none, reason: "layout skill unavailable; canonical local fallback used"}
  viewport_checks:
    - {width: 1440, status: not_run, reason: "development server unavailable", evidence: "connection refused"}
    - {width: 375, status: not_run, reason: "development server unavailable", evidence: "connection refused"}
  findings: []
```

阻塞时只输出 `TRANFU_DESIGN_BLOCKER_REPORT`；不要同时输出带 `blocked` 状态的评审或 QA 报告。
