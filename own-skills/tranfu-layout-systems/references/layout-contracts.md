# TranFu 布局契约与选择规则

## 目录

- 跨页面同类内容一致性规则
- 可用性检查
- 选择规则
- 输出格式
- 示例

仅按 `SKILL.md` 的路由读取当前任务需要的章节。输出 Schema 以本文件为唯一权威来源。

# 跨页面同类内容一致性规则

- 创建、修改或评审页面前，先识别是否存在可复用的同类页面、对象或模块基准。
- 相同对象类型应使用一致的列表、详情、状态和操作结构。
- 相同层级的页面应使用一致的 Page Header、主要操作位置和返回路径。
- 相同筛选模型应保持一致的入口、已选状态和清除方式。
- 相同详情对象应保持一致的身份区、状态区、操作区和分组方式。
- 相同流程应保持一致的步骤导航、继续、返回、退出和恢复方式。
- 同类模块应尽量保持页面顺序、标题位置、说明位置、行动入口、内容密度和移动端顺序稳定。
- 只有用户主要活动、页面目标、信息优先级或证据链发生明确变化时，才允许合理偏移。
- 需要偏移时，必须在输出中记录模块、原因和影响；不能因为局部构图新鲜或内容长短而随机改变结构锚点。
- 如果没有可复用基准，记录 `none`，并将当前结构建立为新基准。

# 可用性检查

以下规则用于评审信息架构和交互结构，不作为独立视觉风格规范：

- **系统状态可见**：用户应知道当前状态、进度、结果和可执行的下一步。
- **贴近用户心智**：导航、模块命名、字段顺序和流程应使用真实工作语言。
- **用户控制与自由**：在适用场景提供返回、取消、撤销、重试、保存草稿或退出路径。
- **一致性与标准**：同类功能、文案和交互模式跨页面保持一致。
- **错误预防**：高风险、不可逆和批量操作应提前说明影响，并提供确认机制。
- **识别优于记忆**：关键操作、筛选条件、当前上下文和已选对象应保持可见。
- **灵活高效**：高频操作靠近任务现场，支持批量操作、默认值或复用配置。
- **极简但不隐藏关键内容**：移除与当前任务无关的信息，但不牺牲必要状态和恢复路径。
- **错误恢复**：错误信息应说明原因、影响和可执行修复动作。
- **就近帮助**：复杂流程、字段和边界条件应提供就近说明或文档入口。

# 选择规则

先选择主布局系统：

- 浏览、理解品牌或被产品说服 → `website`
- 围绕单一目标完成转化 → `landing-page`
- 长期管理数据、任务和业务流程 → `app-shell`
- 搜索、阅读和理解说明 → `docs-knowledge-base`

再选择页面框架模式：

- 连续向下浏览 → `stacked-layout`
- 顶部导航 + 稳定 Sidebar → `t-layout`
- 页面身份与操作头部 + Main Content → `page-header-layout`
- Main Content + 上下文辅助面板 → `multi-pane-layout`

最后选择页面模式：

- 浏览和管理多条记录 → `management-list`
- 执行任务、监控状态、调试或编排工具 → `console-workbench`
- 查看指标、趋势、对比和下钻分析 → `dashboard-analytics`
- 填写参数或修改配置 → `form-configuration`
- 按顺序完成多步骤任务 → `wizard-flow`
- 理解单个对象并围绕它操作 → `detail-page`

一个页面可以包含多个页面模式，但必须指定一个主要模式。

```yaml
primary_system: app-shell
frame_layout: multi-pane-layout
primary_pattern: detail-page
supporting_patterns:
  - dashboard-analytics
```

上例表示：页面首先是应用型产品中的对象详情页，其中包含少量分析模块，而不是以指标分析为主要任务的 Dashboard。

# 输出格式

## 布局阻塞

```yaml
TRANFU_LAYOUT_BLOCKER:
  status: blocked
  mode: create|modify|refactor|review|classify|visual_qa|unknown
  code: unclassifiable_activity|missing_layout_reference|evidence_conflict|unknown_mode
  message: <阻塞原因>
  target: <页面、文件、截图、运行目标、UI 区域或 null>
  evidence:
    - <已检查证据>
  next_action: <解除阻塞的具体动作>
```

阻塞时只输出 `TRANFU_LAYOUT_BLOCKER`，不要同时输出决策或评审产物。


## 布局决策

创建、修改、重构或分类任务使用：

```yaml
TRANFU_LAYOUT_DECISION:
  mode: create|modify|refactor|classify
  primary_activity: <用户主要活动>
  page_goal: <页面目标>

  primary_system: website|app-shell|docs-knowledge-base|landing-page
  frame_layout: stacked-layout|t-layout|page-header-layout|multi-pane-layout
  primary_pattern: management-list|console-workbench|dashboard-analytics|form-configuration|wizard-flow|detail-page|none

  supporting_patterns:
    - <辅助页面模式>

  navigation_model: <导航模型>
  information_density: low|medium|high

  desktop_structure:
    - <区域和顺序>

  mobile_structure:
    - <重排、折叠和优先级>

  required_states:
    - <只列与当前页面相关的结构状态>

  consistency_baseline:
    - <沿用的同类页面、对象或模块基准；没有则写 none>

  reused_module_anchors:
    - <沿用的顺序、位置、密度或移动端结构；没有则写 none>

  allowed_offsets:
    - module: <模块；没有则写 none>
      reason: <偏移原因>
      impact: <结构影响>

  constraints:
    - <布局约束>

  avoid:
    - <需要避免的布局错误>

  rationale: <选择依据>

  handoff:
    skill: tranfu-website-design|null
    status: not_requested|ready|not_run
    reason: <原因或 null>
```

## 布局评审

评审或 Visual QA 任务使用：

```yaml
TRANFU_LAYOUT_REVIEW:
  mode: review|visual_qa
  summary:
    overall_status: passed|needs_changes|not_verified
    high: 0
    medium: 0
    low: 0

  assessed_layout:
    primary_system: <当前主布局系统或 unknown>
    frame_layout: <当前页面框架或 unknown>
    primary_pattern: <当前页面模式或 unknown>

  findings:
    - id: TLF-1
      severity: HIGH|MEDIUM|LOW
      rule: <本 Skill 中的具体规则>
      location: <文件:行号 | 截图 | 视口 | UI 区域>
      evidence: <可见或实际存在的证据>
      fix: <具体结构修正方案>
      verification: <修复后的验证方式>

  inspected_targets:
    - <文件 | 截图 | UI 区域>

  viewport_checks:
    - width: <像素宽度或截图宽度>
      status: passed|failed|not_run|not_applicable
      reason: <原因或 null>
      evidence: <截图、观察或静态证据>

  handoff:
    skill: tranfu-website-design|null
    status: not_requested|ready|not_run
    reason: <原因或 null>
```

# 示例

用户：

> 按 TranFu 风格做一个招聘操作台。

输出：

```yaml
TRANFU_LAYOUT_DECISION:
  mode: create
  primary_activity: 持续处理候选人任务并监控执行状态
  page_goal: 在保留候选人上下文的同时完成任务操作、结果检查和异常恢复

  primary_system: app-shell
  frame_layout: multi-pane-layout
  primary_pattern: console-workbench

  supporting_patterns:
    - management-list
    - dashboard-analytics

  navigation_model: 顶部全局导航 + 可折叠对象列表 + 按需打开的日志面板
  information_density: high

  desktop_structure:
    - 当前任务与状态
    - 候选人或职位队列
    - 主操作工作区
    - 结果预览
    - 按需打开的日志与历史

  mobile_structure:
    - 当前任务、状态与主操作优先
    - 队列转为独立列表入口
    - 结果预览置于主操作之后
    - 日志与历史转为 Drawer 或独立页面

  required_states:
    - loading
    - empty
    - error
    - running
    - paused
    - success

  consistency_baseline:
    - none

  reused_module_anchors:
    - 状态与当前任务固定在工作区顶部
    - 日志和历史位于结果反馈之后

  allowed_offsets:
    - module: none
      reason: none
      impact: none

  constraints:
    - Main Content 保持最高优先级
    - 紧凑视口优先折叠日志面板
    - 长任务必须保留取消、重试和恢复路径

  avoid:
    - 不使用官网 Hero 或宣传文案开场
    - 不同时展开所有辅助面板
    - 不用 Dashboard 指标取代主任务工作区

  rationale: 用户主要活动是连续处理任务、监控状态和检查结果，因此采用应用外壳、多面板框架和操作台页面模式。

  handoff:
    skill: tranfu-website-design
    status: ready
    reason: 用户同时要求实现 UI
```

WRONG：

> 这是 B 端页面，所以用卡片和数据看板。

原因：没有识别用户主要活动，没有区分主布局系统、页面框架和页面模式，也没有给出桌面、移动端结构与反模式。

## 布局评审示例

```yaml
TRANFU_LAYOUT_REVIEW:
  mode: visual_qa
  summary: {overall_status: not_verified, high: 0, medium: 0, low: 0}
  assessed_layout:
    primary_system: unknown
    frame_layout: unknown
    primary_pattern: unknown
  findings: []
  inspected_targets:
    - http://localhost:5173
  viewport_checks:
    - width: 1440
      status: not_run
      reason: development server unavailable
      evidence: connection refused
  handoff:
    skill: tranfu-website-design
    status: ready
    reason: 布局评审已返回，但视觉视口尚未验证
```
