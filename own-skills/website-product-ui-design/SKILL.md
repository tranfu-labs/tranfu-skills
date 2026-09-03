---
name: website-product-ui-design
display_name: Website & Product UI Design
display_name_zh: 网站与产品 UI 设计
description: >
  为任意品牌和前端技术栈创建、修改、重构、评审或视觉验证网站与产品界面，同时继承目标项目已有的
  设计系统、品牌资源、组件约定和响应式行为。Use when 用户要求设计或实现通用网站、应用外壳、
  控制台、数据看板、表单、组件、交互状态、响应式界面或进行 Visual QA。
  Do NOT trigger when 用户只要求纯文案、纯后端、完整配色或字体方案、独立品牌识别、Logo 设计，
  或要求执行某个组织专属的品牌规范。
version: 0.1.0
author: Ocean-312
updated_at: 2026-09-03
origin: own
---

# 网站与产品 UI 设计

创建与评审 Web 界面，不强制植入特定品牌、框架、字体、图标库或组件库。

## 核心契约

- 用户的明确要求和目标项目既有设计系统是最高事实来源。
- 做视觉判断前，必须检查真实代码、Token、组件、资源和渲染状态。
- 除非用户明确要求迁移，否则保留项目现有技术栈和组件约定。
- 修改范围限制在用户要求及其正常实现依赖内。
- 不虚构缺失的品牌规则、Logo、字体或产品专属约定。
- 未实际观察的视口或交互状态不得标记为通过。
- 无法执行的检查记录为 `not_run`，并说明原因。

## 任务模式

| 模式 | 适用情况 | 默认动作 | 输出 |
| --- | --- | --- | --- |
| `create` | 新建页面、Section、组件或状态 | 获得实现授权时编辑，否则给出补丁 | `UI_CHANGE_REPORT` |
| `modify` | 修改已有 UI、样式、资源或行为 | 获得实现授权时编辑，否则给出补丁 | `UI_CHANGE_REPORT` |
| `refactor` | 保持预期行为的实现重构 | 编辑并检查受影响的使用方 | `UI_CHANGE_REPORT` |
| `review` | 评审代码、截图、设计稿或指定 UI 区域 | 只读 | `UI_DESIGN_REVIEW` |
| `visual_qa` | 检查运行界面或渲染截图 | 默认只读；用户要求修复时可编辑 | `UI_VISUAL_QA_REPORT` |

若请求同时包含评审和实现，完成实现，并把相关发现与验证写入 `UI_CHANGE_REPORT`。

## 参考资料与权威边界

只加载当前任务需要的资料：

| 参考文件 | 读取时机 | 唯一职责 |
| --- | --- | --- |
| `references/design-spec.md` | 任何视觉设计或设计评审任务 | 页面任务分类、视觉决策原则与品牌资源边界 |
| `references/tokens.md` | 字体、间距、圆角、深度、控件尺寸、焦点或状态任务 | 项目 Token 的发现、复用与扩展；无项目规范时提供默认基线 |
| `references/icons.md` | 选择、增加、替换、导入或评审功能图标 | 唯一主库、Reicon 默认条件、语义注册表、尺寸、回退和验证规则 |
| `references/cards.md` | 卡片、按钮、Tabs、标签、表单、列表、表格、浮层或反馈状态 | 不同组件的结构、交互行为和状态覆盖 |
| `references/responsive-layout.md` | 页面结构、容器、栅格、断点、导航、媒体或溢出任务 | 响应式布局、默认容器与视口验证 |

以下权威顺序是本 Skill 唯一的冲突裁决来源：

1. 用户对当前任务的明确要求。
2. 项目正式设计系统文档。
3. 受影响产品区域实际使用的共享 Token 与组件。
4. 最接近的同类实现。
5. 本 Skill 的通用默认基线。

两个同等权威的项目来源发生实质冲突时，报告 `reference_conflict`，并请求最小必要决策。

## 执行流程

1. 确认目标、模式、预期结果和编辑权限。
2. 检查项目结构、前端技术栈、依赖清单、样式、Token、共享组件和相邻实现。
3. 读取 `design-spec.md` 及任务所需的其他参考文件。
4. 确定字体、间距、图标、组件和断点的项目事实来源；已有规范时不得用本 Skill 的默认值覆盖。
5. 确定可完整交付的最小范围。
6. 按模式执行：
   - `create|modify|refactor`：实现变更、保留无关行为、复用已有基础设施。
   - `review`：只输出有证据的发现，不修改文件。
   - `visual_qa`：检查真实渲染；除非用户要求修复，否则不修改。
7. 运行相关项目命令并检查受影响的响应式与交互状态。
8. 输出对应报告。

只有当目标缺失、必需资料不可读、权威冲突无法解决或实现依赖缺失导致无法继续时，才输出 `UI_DESIGN_BLOCKER_REPORT`。浏览器或可选命令不可用通常记为 `not_run`，不构成阻塞。

## 实现规则

- 复用既有布局基础、Token、组件、表单控件、导航模式、媒体处理和动效约定。
- 优先使用语义 Token。仅当项目没有合适值且新值具有可复用职责时新增 Token。
- 本 Skill 不生成、选择或修改配色；必须沿用项目现有主题与颜色系统。
- 项目没有可继承的颜色系统时，只完成不依赖具体色值的结构、排版、间距、组件与状态语义；颜色决策标记为 `out_of_scope`，不得自行补色。
- 未经要求，不在局部任务中引入新字体、图标库、CSS 方法或 UI Kit。
- 图标任务必须按 `references/icons.md` 确定唯一主库和语义映射；写入导入前验证真实导出名，不按名称猜测或跨库回退。
- 不重绘或近似替代产品 Logo；只使用用户或项目提供的品牌资源，并保持比例。
- 组件状态按 `references/tokens.md` 的状态职责和 `references/cards.md` 的组件规则实现，不机械补齐无关状态。
- 保留键盘焦点、可访问名称、可读对比、触控热区、错误恢复和 reduced-motion 支持。
- 状态变化不得只依赖颜色，也不得造成意外布局跳动。
- 动效只用于解释状态或空间关系，不作为装饰。

## 响应式与视觉验证

优先使用项目正式断点。项目没有断点时，使用 `responsive-layout.md` 的默认基线。

视口记录格式、默认检查宽度和检查项只以 `references/responsive-layout.md` 为准。只记录实际观察的视口。

运行项目适用的 lint、typecheck、build 或针对性测试。缺少命令或环境不可用时记录为 `not_run`。

## 发现严重程度

- `HIGH`：阻断主要任务、造成不可访问交互、破坏内容或导航，或产生严重响应式故障。
- `MEDIUM`：产生明显不一致、歧义、可避免摩擦或重要设计系统偏离。
- `LOW`：局部打磨问题，对理解或任务完成影响有限。

每条发现必须包含规则、位置、证据、修复方案和验证方式。

## 阻塞代码

- `target_not_found`
- `missing_required_reference`
- `reference_integrity_failed`
- `reference_conflict`
- `missing_required_asset`
- `missing_required_dependency`
- `unverified_icon_export`
- `unknown_mode`

## 输出结构

### UI 变更

```yaml
UI_CHANGE_REPORT:
  mode: create|modify|refactor
  target: <项目、页面、文件或组件>
  scope: <实现范围>
  permission: edited|patch_only
  changed_files: []
  suggested_patches: []
  references_loaded: []
  sources_of_truth: []
  inheritance_constraints: []
  deviations: []
  validation:
    viewport_checks: []
    accessibility: {status: passed|failed|not_run|not_applicable, reason: null}
    reduced_motion: {status: passed|failed|not_run|not_applicable, reason: null}
    commands: []
```

### 设计评审

```yaml
UI_DESIGN_REVIEW:
  mode: review
  target: <评审目标>
  scope: <评审范围>
  summary: {overall_status: passed|needs_changes|not_verified, high: 0, medium: 0, low: 0}
  references_loaded: []
  inspected_targets: []
  findings:
    - id: UI-1
      severity: HIGH|MEDIUM|LOW
      rule: <规则或项目来源>
      location: <文件、视口或 UI 区域>
      evidence: <可观察证据>
      fix: <具体修复>
      verification: <验证方式>
```

### 视觉质量检查

```yaml
UI_VISUAL_QA_REPORT:
  mode: visual_qa
  target: <运行界面或截图>
  scope: <QA 范围>
  summary: {overall_status: passed|needs_changes|not_verified, high: 0, medium: 0, low: 0}
  references_loaded: []
  viewport_checks: []
  findings: []
```

### 阻塞报告

```yaml
UI_DESIGN_BLOCKER_REPORT:
  status: blocked
  mode: create|modify|refactor|review|visual_qa|unknown
  code: <阻塞代码>
  message: <无法继续的原因>
  target: <目标或 null>
  checks_completed: []
  next_action: <解除阻塞的最小动作>
```

只输出与完成模式匹配的报告。不要同时输出阻塞报告和部分成功报告。
