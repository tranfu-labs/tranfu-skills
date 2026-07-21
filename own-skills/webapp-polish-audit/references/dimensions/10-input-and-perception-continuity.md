# 10. 不同操作方式下不阻断任务 / Input and Perception Continuity

这是一条**审查维度**：证据由 `../pipeline/16-page-exploration-and-capture.md` 统一采集，本文件只写判定标准——① 解决什么问题；② 向采集环节申请的额外探查；③ 形式目录 + 判定。

边界：窄屏重排、移动端键盘遮挡、横向滚动、桌面/移动语义漂移归 `11`；可交互元素有没有即时反馈（悬停/pressed/disabled/loading 有没有反应）归 `03`。同类元素/状态的视觉一致性不在主流程五维度覆盖范围内。本维度只主责**输入方式**（鼠标/键盘/触摸）和**感知条件**（缩放/对比度/暗色）下，关键任务会不会被阻断。

## 一、解决什么问题

关键任务（删除/编辑/提交/保存/关闭/筛选/分页/导出/刷新/更多菜单/详情入口等）在常见输入方式和感知条件下，能不能被**发现、理解、触发、完成**——不被悬停依赖、键盘陷阱、过小触摸目标、低对比、缩放遮挡、纯图标语义这六类挡住。

## 二、向探寻引擎申请的额外探查（→ `16` 第 2 步）

引擎在池化执行时，为本维度额外做（以下都不产生副作用，只读可做；需要副作用才能到达的状态记成「只读被阻挡」缺口）：

- **键盘走查**：用 Tab 走一遍主流程，记录焦点顺序、焦点是否可见；对弹层 / drawer / menu / dropdown / date picker / command palette / wizard，记录能否 Tab 出来、Esc / 关闭后焦点落到哪。
- **关掉悬停重走**：把只在悬停 / 行悬停 / 卡片悬停 / 工具栏浮层才出现的操作翻出来，逐个看有没有非悬停替代路径。
- **放大重盘点**：在 200%（或系统大字号）下重做元素盘点与几何计算，看关键控件 / 错误信息 / 当前焦点是否被遮挡或挤出（用矩形重叠面积判，不截图）。
- **触摸目标尺寸**：盘点关闭 / 删除 / 分页 / checkbox / 更多菜单 / 表格行操作 / 移动 toolbar 的命中区尺寸。
- **状态表达方式**：盘点错误 / 选中 / 危险 / 成功 / 禁用，记录是否只靠颜色 / 低对比，有没有形状 / 图标 / 文本 / 位置等冗余线索。
- **纯图标控件**：盘点删除 / 导出 / 筛选 / 更多 / 关闭 / 刷新等纯图标按钮，有没有文本 / `aria-label` / 提示气泡 / 上下文。

## 三、判定的两道闸（贯穿所有分类）

1. **形式目录挂嫌疑（高查全）**：宁可错抓，命中任一形式 = 嫌疑。
2. **判定定罪（高查准）**：只有"会让用户在常见输入 / 感知条件下**发现不了、理解不了、触发不了或完不成关键任务**"才定罪；否则按各分类的**释放理由**放过。

本维度不做样式聚类，没有显眼 / 细微轴；每个分类的嫌疑信号与定罪测试各自写在判定里。

## 四、形式目录 + 判定

> 本维度全部 class 为 `脚本直判`，判据是确定性数值/存在性比较——各操作卡里的「不要截图」是**正常路径**的约束。极端情况下主代理仍可走 SKILL.md §0 的「受限截图」例外，但那需要先跑完脚本并说清缺什么。

### A. 悬停依赖阻断关键任务

形式：

- A1 删除 / 编辑 / 更多 / 详情入口只在悬停出现，无非悬停替代。
- A2 行 / 卡片操作只在悬停浮现，触摸屏与键盘用户够不到。
- A3 工具栏 / 浮层动作仅悬停可见。
- A4 其它把关键任务锁死在悬停里的情况。

判定：用探查"关掉悬停重走"翻出的仅悬停动作 → 逐个看有没有至少一条非悬停路径（可见按钮 / 菜单入口 / 行内动作 / 详情页）→ 没有 = 嫌疑 → 确认这是关键任务、且触摸 / 键盘用户确实做不了 → 定罪。释放：纯装饰性悬停，或有等价的非悬停路径。

**证据与判定模式：`脚本直判`**。脚本遍历可点元素并比对 `mouseover` 前后的计算样式与子元素可见性（或解析样式表里的 `:hover` 规则），输出 `appearsOnHoverOnly` / `hasFallbackPath`。存在性判断，确定性 → 主代理直接组装 finding → 无需看图兜底。

**操作卡 · 怎么做（正向, 有空间不限死）**:

**按行为找，不按样式表枚举。** 扫 stylesheet 里的 `:hover` 规则是白名单思路——JS 驱动的 hover 显隐（`onMouseEnter` 改 state）根本不在样式表里，会整个漏掉。正确做法是真的 hover 一下看变化。

- 用 `evaluate_script` 一次调，遍历所有可点元素及其容器（`button` / `a` / `[role=button]` / `[onclick]` / `cursor: pointer`，以及列表项、卡片、表格行这些常见的 hover 宿主）。
- 逐个 `dispatchEvent(new MouseEvent('mouseover', {bubbles: true}))`，**前后各拍一次子树快照**（每个后代的 `display` / `opacity` / `visibility` / `pointer-events` / rect），比对出「hover 后才可见」的元素。`mouseover` 是纯浏览器事件，不发请求、不改数据，无需拦截保护。
- 完成后 `dispatchEvent(new MouseEvent('mouseout', {bubbles: true}))` 复原，确认子树回到初始状态。
- 样式表扫描只作**补充信号**，不作唯一来源。
- 输出 JSON: `[{selector, text, appearsOnHoverOnly: bool, hasFallbackPath: bool（同容器内是否有等价非 hover 入口）}]`。
- 主代理收 JSON 直接判定: `appearsOnHoverOnly && !hasFallbackPath && text 匹配 删除/编辑/更多/详情/查看` → actionable。

**操作卡 · 绝对不要（反向, 硬边界）**:

- 不要派采集者 / 判断者 / 验收者子代理。
- 不要 `take_screenshot` 判"悬停显示什么"。
- 不要真点击悬停元素（避免副作用）。
- 不要走"每张截图一个判断者"分发。

### B. 键盘被困或丢失位置

形式：

- B1 弹层 / drawer / menu / date picker 里 Tab 进得去出不来。
- B2 关闭浮层后焦点跑到页首或消失。
- B3 焦点不可见，用户看不出当前在哪。
- B4 其它让键盘用户卡住或迷失的情况。

判定（功能测试）：用探查记录的键盘走查 → 浮层能否 Tab 出、能否 Esc 关闭、关闭后焦点是否回到合理位置、焦点是否可见 → 任一不满足 = 嫌疑 → 确认会困住或迷失键盘用户 → 定罪。释放：无浮层、无键盘陷阱的简单页面。

**证据与判定模式：`脚本直判`**。脚本用 `press_key` 走 Tab 序列，逐步记录 `document.activeElement` 与 outline 宽度，输出 `tabSequence` / `trappedContainers`。序列是否离开弹层、outline 是否可见均为数值/布尔判据 → 主代理直接判 → 无需看图兜底。

**操作卡 · 怎么做（正向）**:

- 用 `press_key` 循环按 `Tab` 20-40 次；每次用 `evaluate_script` 拿 `document.activeElement` 的 stable selector + `getBoundingClientRect` + `getComputedStyle().outline` / `outlineWidth`。
- 若页面有 static-open 或 aria-hidden 但存在的弹层 (`[role=dialog]` / `<dialog>`)，检查 Tab 序列是否离开弹层（连续多次 activeElement 仍在同一 dialog 容器 = trapped）。
- 输出 JSON: `{tabSequence: [{selector, inModal, focusVisible: outline_width>=2px}], trappedContainers: [selector]}`。
- 主代理判: 序列里连续超过 `dialog.querySelectorAll('*').length` 次仍未离开 = trapped；outline 不可见的元素列出 selectors。

**操作卡 · 绝对不要（反向）**:

- 不要 `take_screenshot` 判 focus 位置。
- 不要派判断者。
- **不要因为写请求拦截钩子装不上就跳过 Tab 走查**：按 Tab 键只移动焦点，不发请求、不改数据，本就不需要拦截保护。拦截是「点击可能触发写操作的控件」时才需要的前置条件，别把它扩大成所有交互的通行证。
- 打开弹层属**低风险交互**，默认允许：装得上拦截就先装，装不上则改用静态 hidden 态取几何（见 11.D）；两条都不通才记 `blocker`。

### C. 触摸目标过小

形式：

- C1 关闭 / 删除 / 分页 / checkbox 命中区过小，易误点。
- C2 更多菜单 / 行操作 / 移动 toolbar 目标过密、相互挤压。
- C3 危险操作和相邻操作贴太近，触摸易误触。
- C4 其它在触摸下需要精细点击才能完成的关键操作。

判定：用探查盘点的命中区尺寸 → 明显偏小（约 `<40–44px` 量级，仅作嫌疑信号，不当硬性数值）= 嫌疑 → 确认触摸下确实容易误点关键 / 危险操作 → 定罪。释放：低频、低风险且有撤销路径的小目标。

**证据与判定模式：`脚本直判`**。脚本取每个可点元素的 `getBoundingClientRect`，与 44px 门槛比较。纯数值比较 → 主代理直接判 → 无需看图兜底。

**操作卡 · 怎么做（正向）**:

- 用 `evaluate_script` 一次调，遍历 `button, a[href], [role=button], input[type=submit], input[type=checkbox], input[type=radio], [role=tab]`。
- 每个元素拿 `getBoundingClientRect()` 的 `width` / `height`；阈值 44×44 (WCAG 2.5.5) 或 48×48 (Material)，本 skill 用 44 作嫌疑门槛。
- 输出 JSON: `[{selector, text, width, height, actionable: width<44 || height<44}]`。
- 主代理组装 finding: 只报 `actionable=true` 且 text 或上下文含关闭 / 删除 / 分页 / checkbox / 更多 / 移动 toolbar 关键词的元素。

**操作卡 · 绝对不要（反向）**:

- 不要 `take_screenshot` 判"看着大不大"。
- 不要派判断者。
- 不要报"疑似偏小"却不给具体 px 数字。

### D. 状态只靠低对比或颜色

形式：

- D1 错误 / 成功只用红 / 绿，色弱场景不可辨。
- D2 选中 / 禁用只靠淡边框或微弱底色。
- D3 关键文本对比过低，暗色 / 投影 / 疲劳下读不出。
- D4 其它让关键状态在常见感知条件下不可辨的情况。

判定：用探查盘点的状态表达 → 只有颜色 / 低对比、无形状 / 图标 / 文本 / 位置冗余 = 嫌疑 → 确认状态确实分不出 → 定罪。释放：颜色之外另有清晰冗余线索。

**证据与判定模式：`脚本直判`**。脚本算文字色与背景色的对比度并检测图标 / 文本前缀等冗余线索，与 4.5 / 3.0 阈值比较。纯数值比较 → 主代理直接判 → 无需看图兜底（模拟色弱不在本 skill 范围）。

**操作卡 · 怎么做（正向）**:

- 用 `evaluate_script` 找 `[role=alert]` / `[aria-invalid=true]` / 含 `error` / `success` / `warning` / `danger` / `[class*=err]` / `[class*=succ]` class 的元素。
- 每个元素拿 `getComputedStyle().color` 与 `backgroundColor`，转 RGB→relative luminance→WCAG contrast: `(L1+0.05)/(L2+0.05)`。阈值: 4.5 (normal text) / 3.0 (large text ≥18pt 或 14pt bold)。
- 检查元素内是否有 svg 图标 / img / text prefix (如 "错误:" / "✓" / "⚠") 作为冗余线索。
- 输出 JSON: `[{selector, ratio, threshold, hasIcon, hasTextPrefix, actionable: ratio<threshold && !hasIcon && !hasTextPrefix}]`。

**操作卡 · 绝对不要（反向）**:

- 不要 `take_screenshot` 模拟色弱。
- 不要派判断者。
- contrast 未达阈值但有图标 / text prefix / 形状冗余 → 释放，不报。

### E. 缩放或大字号下遮挡 / 不可达

形式：

- E1 fixed toolbar / drawer / toast / cookie bar 放大后挡住提交 / 错误 / 当前焦点。
- E2 关键控件放大后跑出可操作范围。
- E3 错误信息放大后被遮挡。
- E4 其它在缩放 / 大字号下让关键控件不可达的情况。

判定：用探查在 200% / 大字号下的重排数据 → 关键控件 / 错误 / 当前焦点是否被遮挡或挤出可操作范围 → 是 = 嫌疑 → 确认会阻断任务 → 定罪。释放：放大后仍可滚动到达、无遮挡。

**证据与判定模式：`脚本直判`**。脚本在 200% 缩放下取固定 / 粘性元素与关键控件的矩形，算重叠面积。纯几何计算 → 主代理直接判 → 无需看图兜底。

**操作卡 · 怎么做（正向）**:

按下面顺序取第一个可用的，**不要停在第一个失败上就记 `blocker`**：

1. **半视口宽（首选，最可靠）**：`resize_page` 到 `640×720`。CSS 像素减半 ≈ 200% 缩放的布局效果，且不改页面任何样式。
2. **放大根字号**：`evaluate_script` 设 `document.documentElement.style.fontSize = '32px'`（默认 16px 的两倍）。`rem` 布局下这就是大字号场景的主要效果。**这属于允许的只读探查**——只改渲染样式，不导航、不提交、不写数据，与「翻开静态可达隐藏面」同级。
3. **`zoom`（末选）**：`document.documentElement.style.zoom = 2`。部分运行时会拦截对 `documentElement.style` 的写入，被拦就换上面两条，不要在此打转。

三条都不可用才记 `blocker`，并写明各自失败原因。

采数：遍历 `position: fixed` / `sticky` 元素拿 rect；同时拿主内容区（`main` / `[role=main]` / form / `[type=submit]`）与当前焦点元素的 rect。
- 用矩形重叠公式（`Math.max(0, min(right)-max(left)) * Math.max(0, min(bottom)-max(top))`）算 fixed/sticky 与关键控件的重叠面积。
- 输出 JSON: `[{fixed_selector, overlapping: [{target_selector, area}]}]`。
- 完成后 `evaluate_script` 恢复 `document.documentElement.style.zoom = ''`。

**操作卡 · 绝对不要（反向）**:

- 不要 `take_screenshot` 判"是否被遮挡"——重叠面积就是结论。
- 不要派判断者。
- **改完必须恢复**：`fontSize` / `zoom` 置空、视口切回原尺寸，否则污染后续 class 的几何数据。
- 不要因为 `zoom` 被拦就直接记 `blocker`——那是三条路里最不可靠的一条，先试半视口宽和根字号。

### F. 纯图标语义不明

形式：

- F1 删除 / 导出 / 筛选 / 更多 / 关闭 / 刷新等纯图标按钮无文本 / 标签 / 提示气泡。
- F2 图标语义不通用，用户需要猜含义。
- F3 其它让用户靠猜才能用关键操作的纯图标控件。

判定：用探查盘点的纯图标控件 → 有没有文本 / `aria-label` / 提示气泡 / 上下文 / 通用图标语义 → 全无 = 嫌疑 → 确认用户必须猜才能用关键操作 → 定罪。释放：空间紧张但语义通用且风险低（如熟悉的搜索放大镜）。

**证据与判定模式：`脚本直判`**。脚本筛出无文字且含图标子元素的控件，检查可访问名来源（`aria-label` / `aria-labelledby` / `title` / 视觉隐藏文本）。存在性判断 → 主代理直接判 → 本类只判「完全无名」，不判「名字好不好」，故无需看图兜底。

**操作卡 · 怎么做（正向）**:

- 用 `evaluate_script` 遍历 `button, a, [role=button]`。
- 过滤纯图标条件: `textContent.trim() === ''` 且 (含 `svg` 子元素或 `[class*=icon]` 子元素或 `<i>` 子元素或 `:before`/`:after` 是图标 font)。
- 检查 accessible name 来源: `aria-label` / `aria-labelledby` 指向元素的 text / `title` / visually-hidden span (class 匹配 `sr-only` / `visually-hidden` / `screen-reader-text`)。
- 输出 JSON: `[{selector, iconType, hasAccessibleName, source, actionable: !hasAccessibleName}]`。

**操作卡 · 绝对不要（反向）**:

- 不要派判断者子代理判"图标看不看得懂"。
- 不要 `take_screenshot`。
- 有 accessible name（即使不通用）也放过；本 class 只判"完全无 name"，不判"name 好不好"。

## 五、边界 / 非目标

- 不把具体 ARIA 属性、`role`、`tabindex`、focus trap 库或屏幕阅读器 API 写成必须；这些是可能的实现手段。
- 不要求做完整 WCAG 审计，也不把本维度扩展成合规报告。
- 不要求每个图标按钮都强制显示文字；空间、熟悉度、上下文、风险会影响方案。
- 不禁止所有悬停 reveal；只有当关键任务没有非悬停替代路径时才违反。
- 不要求对所有辅助技术达到完美支持；但关键任务不能在常见输入 / 感知条件下明显阻断。
- 不主责窄屏 / 移动端键盘 / 横向滚动 / 响应式重排（→ `11`）、即时交互反馈（→ `03`）。视觉一致性不在主流程五维度覆盖范围内。
- 不把组件抽象、设计系统 token、lint 规则或测试框架写成本维度目标。
