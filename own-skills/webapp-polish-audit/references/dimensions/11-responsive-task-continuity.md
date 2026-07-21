# 11. 响应式下的任务连续性 / Responsive Task Continuity

这是一条**审查维度**：证据由 `../pipeline/16-page-exploration-and-capture.md` 统一采集，本文件只写判定标准——① 解决什么问题；② 向采集环节申请的额外探查；③ 形式目录 + 判定。

边界：可交互元素有没有即时反馈 / 可操作性归 `03`；输入方式（鼠标 / 键盘 / 触摸）、感知条件（缩放 / 对比度 / 暗色）、纯图标含义归 `10`。状态导致的布局移动、同类元素的视觉一致性不在主流程五维度覆盖范围内。本维度主责**视口 / 容器尺寸变化后关键任务能否继续被找到、理解、安全操作并完成**（A–E 类），**以及内容装不下导致的截断 / 挤坏**（F 类，不限视口——桌面上主按钮孤字折行与窄屏上金额被截断是同一缺陷）。

## 一、解决什么问题

用户在桌面以外的尺寸下还能不能把核心任务做完。窄屏、小窗口、分屏、容器变窄、移动端弹出键盘时，关键操作（保存 / 提交 / 关闭 / 返回 / 搜索 / 筛选 / 分页 / 主 CTA / 行操作 / 批量操作 / 详情入口）会不会消失、被挤出屏幕、被遮挡或藏进难发现的横向区域；表单 label 与输入框、列表项与操作、表格列与行、错误与字段、价格与单位在重排后会不会断开关系；宽表格横向滚动后用户能不能看出还有列、还够得到行操作；弹层在小屏下会不会困住用户；同一控件在桌面与移动端语义会不会漂移；为塞下内容会不会把关键判断信息截断到失去含义。

## 二、向探寻引擎申请的额外探查（→ `16` 第 2 步）

引擎在池化执行时，为本维度额外做（以下都不产生副作用，只读可做；需要副作用才能到达的状态记成「声明了但只读被阻挡」缺口，挂本维度名下，输出 `blocker`）：

- **窄视口 / 小窗口重盘点**：在窄屏（`16` 通用采集已切的 `<=390x844` 档）和更小的容器宽度下重做元素盘点，供本维度逐类比对；视口 / 容器控制不可用则如实记缺口。
- **横向溢出排查**：盘点页面级与容器级的 `scrollWidth > clientWidth`，定位哪些是宽表格 / 对比视图 / toolbar / 横向列表造成的溢出，记录右边界外还藏了什么列 / 操作。
- **关键操作可达性复核**：在窄视口下逐个核对保存 / 提交 / 关闭 / 返回 / 搜索 / 筛选 / 分页 / 主 CTA / 行操作有没有被挤出屏幕、被 sticky header/footer 或 cookie bar 遮挡、或退到横向滚动才够得到。
- **宽表格 / 对比视图重排盘点**：盘点宽表格、数据矩阵、看板、时间线、图表在窄屏下的重排结果（横向滚动 / 折叠 / 换行 / 隐藏列 / 转卡片），记录关键列、行操作、危险操作是否仍可见或可达。
- **弹层小屏几何**：对弹层 / drawer / menu / dropdown / date picker / popover，在窄视口下记录其高度是否超出视口、关闭 / 确认 / 取消 / 当前选项 / 错误信息是否被挤出可视区。
- **移动键盘遮挡复核**：键盘弹出会改变可视高度——只读够得到就在窄视口下复核底部提交 / 取消 / 关闭 / 当前输入 / 字段错误是否被遮挡；够不到键盘真实弹出态的，记「声明了但只读被阻挡」缺口。
- **桌面 / 窄屏语义对照**：对同一控件（局部筛选 / 行操作 / 详情入口等）对照两档视口的措辞与作用范围，记录语义是否漂移。

## 三、判定的两道闸（贯穿所有分类）

1. **形式目录挂嫌疑（高查全）**：宁可错抓，命中任一形式 = 嫌疑。
2. **判定定罪（高查准）**：只有"会让用户在窄视口 / 小窗口 / 容器变窄 / 移动键盘下**找不到关键操作、误解信息关系或操作范围、看不出数据还有更多、被弹层困住，或失去判断依据而做不完核心任务**"才定罪；否则按各分类的**释放理由**放过。够不到的状态（如键盘真实弹出）一律 `blocker` 缺口，不猜测、不放过。

本维度不做样式聚类，没有显眼 / 细微轴；每个分类的嫌疑信号与定罪测试各自写在判定里。

## 四、形式目录 + 判定

> 本维度全部 class 为 `脚本直判`，判据是确定性数值/存在性比较——各操作卡里的「不要截图」是**正常路径**的约束。极端情况下主代理仍可走 SKILL.md §0 的「受限截图」例外，但那需要先跑完脚本并说清缺什么。

### A. 窄视口下关键操作消失或不可达

形式：

- A1 保存 / 提交 / 关闭 / 返回 / 主 CTA 在窄屏或小窗口下被挤出屏幕，需横向滚动才能找到。
- A2 搜索 / 筛选 / 分页在移动端跑到不可达位置，或被 sticky header/footer、cookie bar 遮挡。
- A3 行操作 / 批量操作 / 详情入口在窄屏下整列消失，没有替代入口。
- A4 其它让关键操作在窄视口下需要横向猜测才能找到的情况。

判定：嫌疑信号——窄视口盘点中，关键操作落在视口右边界外（命中横向溢出 `scrollWidth > clientWidth`）、被遮挡、或整个消失 = 嫌疑 → 定罪测试：确认这是关键任务路径、且用户在窄屏下确实找不到或够不到该操作（无可见替代入口）→ 定罪。释放：窄屏下移入收纳菜单 / 更多入口 / 底部 bar 等仍可见可达的合理收纳。

**证据与判定模式：`脚本直判`**。脚本在窄视口下取所有可点元素矩形，判断是否越界或被遮挡，并检测同容器内的收纳入口。纯几何 + 存在性 → 主代理直接判 → 无需看图兜底。

**操作卡 · 怎么做（正向）**:

- 用 `resize_page` 到 `375×812` (iPhone SE)，或 `evaluate_script` 断言 `window.innerWidth === 375`。
- `evaluate_script` 一次调，遍历 `button, a[href], [role=button]`：
  - 拿 `getBoundingClientRect` + `textContent` + `aria-label`。
  - 溢出标记: `rect.right > innerWidth` 或 `rect.left < 0` 或 `rect.bottom > innerHeight` 且非 sticky footer。
  - 关键动作标记: text/aria-label 匹配 `保存 / 提交 / 关闭 / 返回 / 搜索 / 筛选 / 分页 / 主要 CTA` 等。
  - 替代入口检测: 同容器内是否有 `[aria-haspopup]` / `[aria-controls]` / 汉堡按钮作为收纳入口。
- 输出 JSON: `[{selector, text, rect, outOfViewport, reason, isCriticalAction, hasFallbackEntry}]`。

**操作卡 · 绝对不要（反向）**:

- **不要按屏幕分段截图** — 长页判溢出/裁切靠几何，不需要 13 段。
- 不要派判断者。
- 不要在 `window.innerWidth !== 375` 时跑 mobile 检测。

### B. 重排后信息关系断开

形式：

- B1 表单 label 与输入框在窄屏重排后上下错位、对不上是哪个字段。
- B2 列表项与其操作、表格列与行在重排后断开，分不清操作作用于哪条。
- B3 错误信息与字段、价格与单位在重排后被拆到看不出归属。
- B4 其它让用户在窄屏下搞不清"信息属于哪里"的重排断裂。

判定：嫌疑信号——窄视口盘点中 label / 操作 / 单位 / 错误与其对应对象的邻近关系被重排破坏 = 嫌疑 → 定罪测试：确认用户无法靠位置 / 标题 / 边框等线索判断信息归属，会搞错字段 / 对象 / 单位 → 定罪。释放：重排后另有清晰线索（就近标题 / 边框 / 显式标签 / 行内绑定）使关系仍可读。

**证据与判定模式：`脚本直判`**。脚本配对 `<label>` 与其输入框，算垂直间距与轴线对齐，并检查错误信息与字段的矩形邻接。纯几何 → 主代理直接判 → 无需看图兜底。

**操作卡 · 怎么做（正向）**:

- `resize_page` 到 375。
- `evaluate_script`:
  - 遍历所有 `<label>`, 找对应 input (`label[for=id]` → `#id`，或 `label` 包裹 `<input>`)。
  - 计算 `label.rect` 与 `input.rect`：垂直距离 (`|label.bottom - input.top|`) 是否 < 一行高 (约 24px)；水平是否同轴。
  - 找 `[role=alert]` / `.error-message` / `[aria-describedby]` 关联的错误，检查是否在对应字段附近（rect 相邻）。
- 输出 JSON: `[{labelSelector, inputSelector, verticalGap, aligned, splitByReflow}]`。
- 主代理判: `splitByReflow=true` 且无就近标题 / 边框兜底 → actionable。

**操作卡 · 绝对不要（反向）**:

- 不要 `take_screenshot` 判"看得出归属"。
- 不要派判断者。
- 关系判断靠 DOM 结构 + 几何位置，不猜视觉。

### C. 横向滚动让用户误判范围或够不到操作

形式：

- C1 宽表格只加了横向溢出，无任何"右边还有列"的提示，用户误以为数据缺失。
- C2 关键列 / 当前行 / 行操作藏在横向滚动右侧，难发现。
- C3 危险操作（删除等）被推到横向滚动深处或难发现位置。
- C4 其它让用户看不出滚动范围、或在横向滚动中够不到 / 误触关键操作的情况。

判定：嫌疑信号——盘点命中容器横向溢出 `scrollWidth > clientWidth`，且无滚动提示 / 列边界 / 关键列保留，或行操作 / 危险操作落在溢出区 = 嫌疑 → 定罪测试：确认用户看不出还有更多列、或够不到行操作 / 误判数据缺失 / 难安全触发危险操作 → 定罪。释放：横向滚动本身允许，只要有可感知的滚动线索、关键列 / 行操作仍可理解并安全触发。

**证据与判定模式：`脚本直判`**。脚本对溢出容器算 `scrollWidth > clientWidth`，并检测滚动线索（渐隐遮罩 / 指示图标 / `scroll-snap-type`）与溢出区内的危险操作。数值 + 存在性 → 主代理直接判 → 无需看图兜底。

**操作卡 · 怎么做（正向）**:

- `resize_page` 到 375。
- `evaluate_script`:
  - 遍历 `table, [role=table], [style*="overflow-x"]` + 计算样式含 `overflow-x: auto|scroll` 的容器。
  - 每个容器算 `scrollWidth > clientWidth`（溢出）。
  - 检测滚动指示: fade 遮罩 (`::before` / `::after` 有 `linear-gradient`)，scroll hint 图标 (chevron / arrow), CSS `scroll-snap-type`。
  - 检查溢出区里是否有 `[data-critical]` / danger class 按钮或行操作。
- 输出 JSON: `[{containerSelector, scrollWidth, clientWidth, hasScrollHint, dangerActionsInOverflow: [selector]}]`。

**操作卡 · 绝对不要（反向）**:

- 不要 `take_screenshot` 判"用户看不看得出还有列"。
- 不要派判断者。
- 有 scroll hint 就放过；本 class 不硬要求"绝不允许横向滚动"。

### D. 弹层在小屏下困住用户或被键盘遮挡

形式：

- D1 弹层 / drawer / menu / date picker 在小屏下高度超出视口，关闭 / 取消 / 确认按钮被挤出可视区。
- D2 弹层里的当前选项 / 错误信息在窄屏下不可见或不可达。
- D3 移动键盘弹出后提交 / 取消 / 当前输入 / 字段错误被键盘或底部 UI 遮挡。
- D4 其它让用户在小屏弹层 / 键盘弹出态下出不来或做不完的情况。

判定：嫌疑信号——窄视口弹层几何中关闭 / 确认 / 取消 / 当前选项 / 错误信息超出视口或被遮挡 = 嫌疑 → 定罪测试：确认用户无法关闭 / 确认 / 取消或看不到关键信息而被困住；键盘遮挡态只读够不到则记 `blocker` 缺口、不猜测 → 定罪。释放：弹层在小屏下可滚动到达且关键控件 / 信息始终可见可触发。

**证据与判定模式：`脚本直判`**。脚本取弹层及其关闭 / 确认 / 取消按钮在窄视口下的矩形，判断是否超出视口。纯几何 → 主代理直接判 → 键盘真实弹出态属副作用，记 `blocker` 不猜测。

**操作卡 · 怎么做（正向）**:

- `resize_page` 到 `375×812`。
- `evaluate_script`:
  - 找所有 `[role=dialog]` / `[aria-modal=true]` / `<dialog>` 元素（含 hidden 或 open state）。
  - 每个 dialog 拿 rect（若 hidden 就临时 unhide 观察: `el.hidden = false; requestAnimationFrame(...)` 后拿 rect，再复原）。
  - 检查: `rect.bottom > innerHeight` (超出)，找 dialog 内 close / confirm / cancel 按钮 rect 是否在 viewport 外。
- 输出 JSON: `[{dialogSelector, rect, closeButtonInViewport, confirmButtonInViewport, currentSelectionInViewport}]`。
- 键盘弹出遮挡是副作用态，只读到不了 → 记 `blocker`。

**操作卡 · 绝对不要（反向）**:

- 不要 `take_screenshot` 判"是否被遮挡"。
- 不要真点击弹出 dialog（走 hidden state 静态判）。
- 不要派判断者。
- 键盘弹出遮挡属副作用态，只读判不了记 blocker，不猜。

### E. 响应式变化改变任务语义

形式：

- E1 桌面上的"筛选当前列表"在移动端措辞 / 行为变得像全局搜索。
- E2 桌面上作用于单行的行操作，在移动端读起来像批量操作。
- E3 桌面上的本地详情入口，在移动端变得像跳到外部导航。
- E4 其它让同一控件在桌面与窄屏间作用范围 / 含义漂移的情况。

判定：嫌疑信号——桌面 / 窄屏语义对照中同一控件的措辞或作用范围发生漂移 = 嫌疑 → 定罪测试：对照两档视口确认用户会在移动端误判操作范围（局部当全局、单行当批量、本地当外部）→ 定罪。释放：两档视口下作用范围与语义一致，仅布局形态不同。

**证据与判定模式：`脚本直判`**。脚本在两档视口下分别取同一稳定选择器的文案与可访问名，做比对。字符串比对 → 主代理直接判 → 无需看图兜底。

**操作卡 · 怎么做（正向）**:

- `resize_page` 到 desktop (`1280×720`)，`evaluate_script` 拿所有 `button` / `a` / `[role=button]` 的 `{stableSelector, textContent, ariaLabel}`（stableSelector 用 `[data-testid]` / `[id]` / 或 tag+className+index 组合）。
- `resize_page` 到 mobile (`375×812`)，重跑同样的 script。
- 比对: 同一 stableSelector 在两视口下 text 或 aria-label 是否变化。
- 输出 JSON: `[{selector, desktopLabel, mobileLabel, semanticDrift: label 变化且非纯 icon fallback}]`。
- 主代理判: 变化且指向不同作用范围 (局部 vs 全局、单行 vs 批量、本地 vs 外部) → actionable。

**操作卡 · 绝对不要（反向）**:

- 不要跨视口比对截图，用 DOM label 比对。
- 不要派判断者。
- 纯图标兜底 (desktop text, mobile 只保留图标) 不算漂移，只算格式变化。

### F. 内容装不下：截断或挤坏（不限视口）

**本类不限视口**：桌面、窄屏、任意容器宽度下的装不下都归本类。桌面上主按钮文案折成两行、末行只剩一个字，和窄屏上金额被截断，是同一个缺陷的两种表现——不因为出现在哪块屏幕上而改变归属。

形式：

- F1 关键数值 / 金额 / 对象名称被过度截断到读不全。
- F2 状态 / 错误原因 / 确认后果被压成只剩图标或省略号，失去判断依据。
- F3 操作对象被截断，用户分不清这次操作作用于谁。
- F4 控件标签被迫折行，末行只剩孤字 / 极短残句，读起来像没做完。
- F5 标签文字溢出容器、撑破对齐或盖到相邻元素。
- F6 其它因塞不下而让用户读不全关键信息、或让控件显得未完成的压缩。

判定：嫌疑信号——任一视口下命中以下之一 = 嫌疑：① `white-space: nowrap` 且 `scrollWidth > clientWidth`（确定性裁切）；② 用 Range 测得真实渲染行数 ≥ 2 且**末行宽度 < 首行 × 0.6**（孤字折行）；③ 关键数值 / 状态 / 错误 / 对象名被省略号截断。→ 定罪测试：该处无 `title` / 提示气泡 / 展开机制等可达补全，且信息本身是判断依据（金额 / 状态 / 对象 / 后果）或该控件是关键操作 → 定罪。释放：文本本就长到需要多行（正文、说明段落）；容器显式为多行设计（`white-space: pre-line`、`min-height` 已容纳多行、`line-clamp` 且有展开）；截断处有可达的完整补全（补全本身的可达性归 `10`）。

> 为什么用「末行 < 首行 × 0.6」而不是「折行即嫌疑」：有意的多行排版不会把末行留成孤字。这个比值把「挤坏」和「设计如此」分开，让本类无需看图即可定罪——它替代了旧的放大视觉协议。

**证据与判定模式：`脚本直判`**。脚本用 Range 测真实渲染行数与末行宽度，并检测 `nowrap` 裁切与补全机制。行数、宽度比、存在性均为确定性判据 → 主代理直接判 → 无需看图兜底（这正是替代旧「放大视觉协议」的判据）。

**操作卡 · 怎么做（正向）**:

**两档视口都要跑**：先 `1280×720`，再 `375×812`，同一段脚本各跑一次，结果按视口标记。桌面那次不能省——本类主要的桌面表现（主按钮孤字折行）只在宽视口下出现。

> 本节判据已由 `scripts/fit-check.mjs` 在对照页 `scripts/fixtures/fit.html` 上实测校准（7 个用例）。改判据后跑 `node scripts/fit-check.mjs` 复验；带 URL 参数可扫真实页面。

**四道过滤缺一不可**，每一道都是实测踩出来的：

1. **只测叶子文本元素**。对含子元素的元素调 `selectNodeContents`，`getClientRects()` 返回的是各子元素盒子的矩形数（`button > span + svg` 得到 3），**那不是行数**。真正被折行的永远是承载文本的那一层。

   ```js
   const kids = [...el.childNodes];
   if (!(kids.length && kids.every((n) => n.nodeType === 3))) continue;   // 非叶子文本，跳过
   const range = document.createRange();
   range.selectNodeContents(el);
   const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
   const lineCount = rects.length;                                        // 这才是真行数
   const lastRatio = lineCount >= 2 ? rects.at(-1).width / rects[0].width : 1;
   ```

2. **排除视觉隐藏元素**。`sr-only` / `visually-hidden` 的典型实现就是 `width:1px + overflow:hidden + nowrap`，必然假命中裁切。按 `rect.width <= 1 || rect.height <= 1 || clip 为 rect(0,0,0,0) || clipPath === 'inset(50%)' || 类名含 sr-only|visually-hidden|screen-reader-text` 剔除。

3. **行内元素没有滚动盒**。`display: inline` 的元素 `scrollWidth === clientWidth` 恒成立，裁切判据对它无效——只在 `display !== 'inline'` 时算裁切。

4. **溢出噪声门槛 4px**。亚像素舍入与字体度量误差通常 1–3px（实测页脚版权行 202 vs 205 就是噪声）；`scrollWidth - clientWidth >= 4` 才算真裁切。

三类嫌疑：

| 嫌疑 | 判据 |
| --- | --- |
| `nowrap` 裁切 | `whiteSpace === 'nowrap' && 非 inline && 溢出 >= 4px` |
| 孤字折行 | `是控件 && 非正文 && lineCount >= 2 && lastRatio < 0.6` |
| 省略号截断 | `textOverflow === 'ellipsis' && 非 inline && 溢出 >= 4px` |

**孤字折行只对控件成立**：`BUTTON` / `A` / `LABEL` / `SUMMARY` / `TH`、`role` 为 `button|tab|menuitem|link|option`、或位于 `button, [role=button], [role=tab], a` 之内。`P` / `LI` / `BLOCKQUOTE` / `DD` / `TD` / `ARTICLE` 一律排除——段落折行是正常排版，不是挤坏。

- 补全检测：`title` 属性、`aria-describedby` 指向的完整文本、展开按钮、`line-clamp` 且同容器有展开控件。
- 输出 JSON: `[{selector, viewport, text, textLength, lineCount, lastLineRatio, whiteSpace, overflowX, suspicion, hasCompletion, isCriticalInfo, actionable}]`。
- 主代理判：命中任一嫌疑 && `!hasCompletion` &&（`isCriticalInfo` || 该控件是关键操作）→ actionable。**释放**：`whiteSpace === 'pre-line'`、`minHeight` 已容纳多行、有可达补全。

**操作卡 · 绝对不要（反向）**:

- 不要 `take_screenshot` 判"读不读得出"或"挤没挤坏"——行数、宽度比、溢出像素就是结论。
- 不要派判断者。
- 不要对元素本身调 `getClientRects()` 数行数（块级控件恒为 1）；也不要对**含子元素**的元素建 Range 数行数（拿到的是子元素盒子数）。必须先过滤成叶子文本元素。
- 不要把 `scrollWidth > clientWidth` 直接当裁切——行内元素恒等、3px 以内是舍入噪声。
- 不要对段落 / 列表项判孤字折行；正文折行是正常排版。
- 不要报视觉隐藏元素（`sr-only` 等）的裁切——它们本来就不可见。
- 有 title / 提示气泡 / 展开机制就算有补全，释放。
- 不要只跑窄视口——桌面孤字折行会整个漏掉。
- 折行本身不是罪；只有末行 < 首行 × 0.6 且发生在控件上才算挤坏。

## 五、边界 / 非目标

- 不规定具体断点、viewport 阈值或容器宽度；文中数值（如 `<=390x844`）只是**嫌疑信号**，不当硬性必须 / token。
- 不规定必须 mobile-first，不规定用 grid / flex / container query / 媒体查询 / CSS overflow / sticky column 或特定组件库实现。
- 不要求所有桌面功能在手机上等价高效；本维度的必须是关键任务不能断。
- 不要求复杂数据表在手机上一定变成卡片；横向滚动也可以，只要用户理解范围且能安全操作。
- 不把"所有页面都要完美适配所有设备"写成无限范围；检查重点是常见尺寸变化下的核心任务连续性。
- **换行 / 挤坏不分视口，一律归本维度 F 类**：桌面与窄屏下的标签装不下是同一缺陷，判据见 F 类（`nowrap` 裁切、孤字折行、省略号截断）。但**折行本身不是缺陷**——只有末行 < 首行 × 0.6 的孤字折行才定罪，正常多行排版一律释放。
- 不主责仅悬停、键盘焦点、触摸目标、低对比、页面放大或纯图标控件含义——输入 / 感知（键盘 / 触摸 / 缩放 / 对比度）归 `10`。
- 即时可操作性 / 操作反馈归 `03`；数据状态的文案清晰度归 `13`。动作完成后的结果反馈、状态导致的布局移动、数据 loading / 空 / 无结果 / 错误 / 权限态本身，均不在主流程五维度覆盖范围内。
- 不把内部代码结构、响应式 token、breakpoint 命名、组件抽象或测试工具选择当作本维度目标。
