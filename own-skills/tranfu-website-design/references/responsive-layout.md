# TranFu 响应式布局

在创建、修改、评审或视觉 QA 页面宽度、Section、导航、Hero、产品截图、栅格、断点、移动端布局或溢出问题时，使用本参考。

## 导航

- [权威边界](#权威边界)
- [容器类型](#容器类型)
- [Browser Header](#browser-header)
- [Viewport Band](#viewport-band)
- [Content Rail](#content-rail)
- [断点与视口契约](#断点与视口契约)
- [栅格](#栅格)
- [Hero 与产品视觉](#hero-与产品视觉)
- [溢出预防](#溢出预防)
- [Fixed Stage 例外](#fixed-stage-例外)
- [Section 内部布局模式](#section-内部布局模式)

## 权威边界

本文件是 Browser Header、Viewport Band、Content Rail、页面宽度、断点、栅格、响应式重排、媒体构图、溢出处理和视口校验的唯一来源。颜色、字体、间距、圆角、阴影、图标和状态基础值使用 `tokens.md`；组件结构和适用状态使用 `cards.md`。

页面和 Section 外层 MUST 跟随浏览器 viewport。NEVER 将 `375px`、`768px`、`1280px`、`1440px` 或 `1920px` 当作通用页面或 Section 固定宽度；这些数值只用于断点、内部 Rail 上限、历史兼容或校验视口。

## 容器类型

| 容器 | 用途 | 宽度行为 |
| --- | --- | --- |
| `browser header` | 顶部导航和浏览器级表面 | 跟随 viewport，使用响应式安全边距，不受 Content Rail 限制 |
| `viewport band` | Hero 背景、产品截图舞台、宽工作流视觉、CTA 和全宽 Section 表面 | 外层流式宽度；内部内容可再使用 Content Rail |
| `content rail` | 文本、说明、卡片、FAQ、表单和扫描密集内容 | 只控制内部阅读与扫描上限 |
| `fixed stage` | 已经基于固定舞台实现的旧页面 | 仅用于符合例外条件的窄范围兼容编辑 |

先判断容器类型，再选择 CSS；不要把 Header、Band 和 Rail 互相替代或错误嵌套。

## Browser Header

将顶部导航视为浏览器级表面：

- 外层使用 `width: 100%`。
- 桌面、平板、移动端内部安全边距分别使用 `64px`、`32px`、`16px`，并映射到项目现有响应式间距实现。
- 使用正常的 Flex 或 Grid 布局建立对齐。
- NEVER 用 `1440px`、`1792px`、正文容器或 Content Rail 限制导航宽度。
- 移动端收起或重排导航项，保留 Logo、主操作或菜单入口；不要压缩整行桌面导航。

```css
.browserHeader {
  width: 100%;
}

.browserHeader__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-inline: 64px;
  box-sizing: border-box;
}

@media (max-width: 1024px) {
  .browserHeader__inner {
    padding-inline: 32px;
  }
}

@media (max-width: 767px) {
  .browserHeader__inner {
    padding-inline: 16px;
  }
}
```

## Viewport Band

将 Hero 视觉、产品截图舞台、宽工作流视觉、CTA 背景和全宽 Section 表面放入 Viewport Band：

- 外层使用 `width: 100%` 并随 viewport 改变。
- 不把 Band 背景或视觉舞台限制到 `1436px`。
- 在内部容器表达安全边距；文字、卡片、表单或阅读内容可以再进入 Content Rail。
- 不允许固定宽度截图、绝对定位元素或超宽媒体制造页面级水平溢出。

```css
.viewportBand {
  width: 100%;
}

.viewportBand__inner {
  width: 100%;
  padding-inline: 64px;
  box-sizing: border-box;
}

.viewportBand__inner > .contentRail {
  width: 100%;
  max-width: 1436px;
  margin-inline: auto;
}

@media (max-width: 1024px) {
  .viewportBand__inner {
    padding-inline: 32px;
  }
}

@media (max-width: 767px) {
  .viewportBand__inner {
    padding-inline: 16px;
  }
}
```

## Content Rail

将 Section 文案、卡片栅格、FAQ、资源列表、表单说明和元信息密集模块放入 Content Rail：

- 将 `1436px` 作为内部可读内容最大宽度，不作为页面外层宽度。
- 不用 Rail 限制 Header、Viewport Band、Hero 背景、产品截图舞台或全宽表面。
- 在平板和移动端取消最大宽度，保留响应式安全边距。
- 让 Rail 内栅格先收缩、换列或重排，再考虑缩小文字。

```css
.contentRail {
  width: 100%;
  max-width: 1436px;
  margin-inline: auto;
  padding-inline: 64px;
  box-sizing: border-box;
}

@media (max-width: 1024px) {
  .contentRail {
    max-width: none;
    padding-inline: 32px;
  }
}

@media (max-width: 767px) {
  .contentRail {
    max-width: none;
    padding-inline: 16px;
  }
}
```

## 断点与视口契约

对页面级、响应式、Header、容器、栅格、断点、溢出或媒体构图任务，MUST 分别检查：

- `1920px`：宽桌面，确认页面继续使用浏览器宽度。
- `1440px`：桌面基准。
- `1280px`：紧凑桌面。
- `768px`：平板基准。
- `375px`：移动端基准。

对不改变响应式行为的窄范围组件实现，至少检查 `1440px` 和 `375px`，或用户明确指定的更相关视口。对截图或设计稿评审，只记录实际提供的尺寸；未渲染的视口标记为 `not_run`，不得推断通过。

每个宽度 MUST 单独记录 `status`、`reason` 和 `evidence`。不要用一个 `desktop: passed` 代表多个桌面宽度。

所有视口共同遵守：

- 桌面端不能是被挤进 viewport 的固定设计稿。
- 移动端重排、堆叠或折叠信息，不直接缩小桌面布局。
- 有意控制大标题换行，避免不可预测地改变相邻模块高度。
- 防止按钮、标签、元信息、长标题、URL 和代码片段撑破容器。
- 在平板和移动端折叠、换行或重排导航。
- 按断点减少栅格列数或改为堆叠。
- 不裁掉理解产品状态所需的关键信息。

## 栅格

让卡片、资源、功能入口和扫描密集模块响应容器宽度：

- 使用 `repeat(auto-fit, minmax(...))` 或明确断点切换。
- 避免固定最小宽度超过 Content Rail 或 viewport。
- 为可收缩子项设置 `min-width: 0`。
- 先收敛 gap、减少列数或换行，再考虑调整文字。
- 保持重复卡片尺寸稳定，防止 hover、loading、图片或状态切换造成跳动。

```css
.responsiveGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: var(--space-content-group);
}

.responsiveGrid > * {
  min-width: 0;
}
```

## Hero 与产品视觉

- 在首个 viewport 内保持核心标题、主说明、主操作和关键产品视觉可读。
- 不要求把所有内容塞进首屏，但要让用户快速理解主题、能力和下一步动作。
- 适度露出下一屏线索，避免首屏成为封闭海报。
- 使用 Viewport Band 承载视觉，使用内部 Content Rail 承载文字和操作。
- 为产品截图设置稳定宽高比和响应式尺寸。
- 优先展示真实产品状态、界面捕获或 UI-like product visuals。
- 移动端通过重排、替代裁切、局部放大、简化截图或堆叠构图保持可读。
- 保持媒体加载前后容器尺寸稳定。

## 溢出预防

完成前检查所有适用视口的非预期水平溢出。表格、代码块或横向 Tabs 只有在明确设计下才能局部横向滚动；页面整体不得出现非预期水平滚动。

- 为长单词、URL、代码、标签和标题设置合理换行。
- 为媒体设置 `max-width: 100%`、`height: auto` 和稳定宽高比。
- 为 Grid 和 Flex 的可收缩子项设置 `min-width: 0`。
- 需要换行的 Flex 行使用 `flex-wrap: wrap`。
- 检查绝对定位、fixed 元素、浮层、装饰元素和产品截图是否超出 viewport。
- 检查 Header、Band 和 Rail 是否因重复 padding、固定宽度或错误 max-width 造成溢出。
- 防止 hover、loading、selected、展开或折叠改变组件外部尺寸。

```css
.longContent {
  overflow-wrap: anywhere;
  word-break: normal;
}

.responsiveMedia {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
}

.wrappingRow {
  display: flex;
  flex-wrap: wrap;
}

.wrappingRow > * {
  min-width: 0;
}
```

## Fixed Stage 例外

只有以下条件同时成立时，才能保留 fixed-stage 实现：

- 目标页面已经使用 fixed stage。
- 用户要求窄范围编辑、局部修复或视觉对齐。
- 改为正常响应式模型超出当前任务范围。

NEVER 在新页面、重构页面或响应式修复中引入 fixed stage。若保留旧实现，在最终报告中标记为“继承约束”或“有意偏离”，并说明原因和风险。

## Section 内部布局模式

| 模式 | 适用场景 | 桌面端 | 平板与移动端 |
| --- | --- | --- | --- |
| `stacked` | 标题、说明、CTA、单一叙事 | 上下排列 | 保持上下排列并收敛间距 |
| `split` | 文案与产品截图、说明与配置面板 | 主次清晰的两栏 | 改为上下堆叠 |
| `media-first` | 产品证据和截图为核心 | 媒体权重更高 | 媒体与文案上下排列 |
| `content-first` | 说明、转化、表单或关键操作优先 | 内容优先、媒体辅助 | 内容先出现，媒体后置 |
| `grid` | 卡片、资源、功能入口 | 响应式多列 | 减少列数或单列 |
| `alternating` | 多个功能段落 | 可克制交错 | 取消交错，统一上下排列 |
| `workflow` | 步骤、路径、Agent 工作流、时间线 | 横向或分段 | 改为纵向并保留因果顺序 |

根据内容关系选择模式，不为复刻固定设计稿强行使用左右排版。移动端优先保留主要内容、步骤编号、状态和因果顺序；NEVER 保留巨大横向间距、固定双栏或超宽截图。
