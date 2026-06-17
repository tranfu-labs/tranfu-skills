---
name: xiaohongshu-card-publish
version: 0.1.1
origin: own
author: aquarius-wing
updated_at: 2026-06-17
description: >-
  把一篇小红书文案变成可发布的 1080×1440 成品配图——用本 skill 自带的卡片模板填充、
  组织系列预览、再用 playwright 导出无损 WebP。当用户给一段小红书文案说
  「根据这份文档生成预览」「生成卡片」「做成小红书配图」「排成一组卡片」，或对某系列说
  「导出」「截图」「按尺寸出图」「批量出图」时，使用这个 skill。
  不要用于：改卡片模板本身的版式/CSS 或新增模板主题、定义文案输入格式或分页规则等数据建模、
  选型构建工具链、与本仓库无关的通用 HTML 或截图任务。
---

# 小红书文案 → 成品配图流水线

> 本 skill 是这条流水线的**唯一事实源**：版式模板、变量契约、结构约定、导出规范都在这里（模板文件在 `assets/`，导出脚本在 `scripts/`）。仓库根没有独立的 `template/` 目录，`dist/` 下全是一次性产物，可随时删掉重生成、不手工长期维护。

## 这个 skill 在做什么

把小红书文案渲染成 HTML 卡片，再截图导出为成品图片。成品尺寸**固定 1080×1440 px（3:4 竖版）**，是小红书配图的硬性规格。

整条结果链：

```
文案  ──填充──▶  dist/<系列>/<卡片>/index.html   （由 assets/default.html 复制 + 填充而来）
                        │
              pages.json 声明顺序
                        │
            dist/<系列>/index.html （由 assets/app.html 复制而来，iframe 预览整组）
                        │
              playwright 截 .card
                        ▼
            dist/<系列>/snapshot/NN.webp  （2x 超采样 + 无损 WebP 成品）
```

两条主流程：**A 生成预览**（文案 → 卡片产物 + 系列预览）和 **B 导出成品图**（系列 → WebP）。用户说「生成预览/做卡片」走 A，说「导出/截图」走 B；两者常先后发生。

## skill 自带的事实源文件

复制与填充时只用这两个模板，它们随 skill 走、就是唯一权威：

- `assets/default.html` — **纯卡片模板**（1080×1440 版式）。其顶部注释块是**变量映射的权威说明**：每个 `{{变量}}` 叫什么、是单值/内联 HTML/块结构、有什么字数与格式约束，都以它为准；本文档下面的清单只是摘要，冲突时听模板注释的。
- `assets/app.html` — **系列预览应用壳**：读 `pages.json`，用 `<iframe>` 逐张浏览，PPT 式翻页 + iPhone 设备框开关 + 浏览器内 JS 导出（降级备用）。

> **各「不触发」项的去向**：改卡片版式/CSS、新增模板主题 = 改 `assets/` 里的模板（这就是改事实源本身，单独发起）；定义文案输入格式/分页规则等数据建模、选型构建工具链 = 本流水线之外的设计决策，单独发起、不在本 skill 内处理；与本仓库无关的通用 HTML/截图任务 = 不适用本 skill。日常生成只复制、不改模板。

## 不可逾越的护栏

这些约束破一条就会让下游全部失效，写代码前先内化：

- **NEVER 改卡片真实尺寸 1080×1440（3:4）。** 由 CSS 变量 `--card-w` / `--card-h` 固定，是小红书成品规格，改它会破坏所有导出。预览缩放由 app 壳承担，不动真实尺寸。
- **NEVER 把预览专用东西混进卡片产物或成品图。** 卡片模板与每张卡片产物里 **不得出现 `.ruler`（标尺）、`.stage`（占位容器）、`--scale`（预览缩放）**；iPhone 设备框只是 app 壳里的纯预览开关。成品图只应是 `.card` 本身——无背景、无标尺、无设备框。
- **NEVER 让导出反向依赖文案结构。** 域依赖方向是 content → render → export，单向。导出只接收渲染好的 HTML/DOM，逐张加载卡片 `index.html` 截 `.card`，不感知文案有几节、什么字段。
- **画质规范（任何导出方式都必须满足）：2x 超采样 + WebP 无损。** 直接 1x 渲染或有损 WebP 会让文字/终端边缘发糊。
- **NEVER 把截图产物（.png/.jpg/.webp）或密钥提交进仓库。**

## 卡片与系列的结构约定

填充和组织系列时遵守，省得撑破版面或破坏预览/导出：

- **一张卡片三段结构**：顶栏（品牌 + 页码）→ 标题区（大序号 + 标题，可带终端块）→ 正文小节 → 页脚（账号 + 引导）。缺字段时按可缺省规则省略对应元素（`KICKER`、副标等可缺省；标题、正文、页码不可缺）。
- **颜色与字号集中在模板 `:root` 的 CSS 变量里**（如 `--accent`、`--ink`、`--card-w`），不要在元素上散落硬编码色值/尺寸。
- **页码连续性**：`PAGE_NO` 从 `01` 递增，`PAGE_TOTAL` = 系列卡片总数；`当前页 ≤ 总页数`，总页数 = 卡片序列长度。
- **`pages.json` 结构**：`{ "series": "<系列展示名>", "pages": [ { "src": "<slug>/index.html", "title": "NN · <标题或命令>" }, … ] }`。`pages` 数组顺序**就是**浏览顺序和导出顺序。
- **改系列内容 = 只改 `pages.json`**：增删卡片、调顺序，MUST 只编辑 `pages.json`，MUST NOT 去改 app 壳或卡片 HTML。app 壳只通过 iframe 引用卡片，不内联卡片 HTML。

---

## 工作流 A：根据文档生成预览

触发：用户给一段小红书文案 + 「根据这份文档生成一个预览」「生成卡片」「做成小红书配图」之类。

约定：下文 `assets/` = skill 目录下的 `assets/`（即 `.claude/skills/xiaohongshu-card-publish/assets/`）。

CREATE A TODO LIST FOR THE TASKS BELOW（逐步跟踪，第 5 步的 stop-and-ask 尤其不能漏）。按顺序执行：

1. **取 slug。** 从文案主题起一个简短的英文/拼音短横线**卡片名**（如 `clear-reset-new`）；同时确认或推导**系列 slug**（如 `claude-code-quick-reference`）。系列 slug 拿不准就问用户。

2. **建系列目录。** 在 `dist/<series>/` 下：
   - 新系列：把 `assets/app.html` 复制为 `dist/<series>/index.html`，并新建 `dist/<series>/pages.json`，内容形如
     ```json
     { "series": "系列展示名", "pages": [] }
     ```
   - 已有系列：直接复用，不要重复复制 app 壳。

3. **建卡片目录** `dist/<series>/<slug>/`。

4. **复制卡片模板**：`assets/default.html` → `dist/<series>/<slug>/index.html`。原样复制，再去填充，别手敲版式。

5. **填充文案**——把文案语义映射到模板里的 `{{变量}}`，逐个替换。**映射规则与每个变量的格式约定以 `assets/default.html` 顶部注释为准。** 摘要：

   | 类型 | 变量 | 约定 |
   |---|---|---|
   | 单值（纯文本） | `TITLE_PLAIN` | 浏览器标签标题，一般同主标题文字 |
   | 单值 | `BRAND` `KICKER` | 顶栏品牌名（大写英文）+ 后缀（如「速查手记」）|
   | 单值 | `PAGE_NO` `PAGE_TOTAL` `INDEX` | 两位数字字符串（`01`/`09`）；INDEX 一般同 PAGE_NO |
   | 单值 | `ACCOUNT` `ACCOUNT_TAGLINE` `NEXT` | 页脚账号、副标、右下引导（如「下一篇 · /compact →」）|
   | 内联 HTML | `TITLE` | 主标题，可用 `<em>…</em>` 高亮成强调色、`<br>` 手动换行；控制 2 行内、单行 ≤ 6~7 个汉字，否则顶出右边界 |
   | 块（重复结构） | `TERMINAL_LINES` | 终端块，每行一个 `.line`，建议 3~4 行（格式见模板注释）|
   | 块（重复结构） | `SECTIONS` | 正文小节，每节一个 `.sec`，建议 2 节、每节正文 2~3 行（格式见模板注释）|

   **关键防错：遇到任何一个变量在文案里找不到合适来源（缺品牌、缺页码上下文、缺账号、不确定该高亮哪个词等），MUST 停下来，带上你推测的答案去问用户确认，MUST NEVER 自己静默填一个值糊弄过去。** 静默猜测会让整组卡片出现错误信息却看起来「完成了」，是这个流程最容易翻车的地方。

6. **更新页面清单。** 在 `dist/<series>/pages.json` 的 `pages` 数组追加/调整一项：
   ```json
   { "src": "<slug>/index.html", "title": "NN · <标题或命令>" }
   ```
   **数组顺序就是预览顺序，也是导出顺序。** 调顺序就改数组顺序。

7. **自检**（逐项过，详见下方「验收清单」）：
   - 卡片产物里 grep **不应再有 `{{`**；
   - 文案不溢出卡片：标题单行 ≤ 6~7 汉字、终端行不过长、每节正文 2~3 行；拿不准就靠模板既有约束缩字号，**别改 1080×1440 真实尺寸**；
   - **终端模块溢出处理**：当某条命令带行尾 `#` 注释、连起来太长会超出卡片宽度（尤其参数含 CJK、靠空格手动对齐很脆时），把**整个终端模块**改成「一行注释、一行命令」——注释单独成行放命令上方（沿用注释的 `c` 类着色、不带 `>` 提示符），命令行只留 `>` + 命令。**整组统一改**，不要只改溢出那一行，避免风格不一致；
   - 卡片产物**不得含** `.ruler` / `.stage` / `--scale`。

8. **交付。** 给用户 `dist/<series>/index.html` 路径在预览面板查看。需要在浏览器里看或批量导出时，从仓库根起本地静态服务器：
   ```bash
   python3 -m http.server 8000
   # 打开 http://localhost:8000/dist/<series>/index.html
   ```

---

## 工作流 B：导出成品图

触发：用户对某个系列说「导出」「截图」「按尺寸导出 webp」。

CREATE A TODO LIST FOR THE TASKS BELOW（导出 + 自检逐项过）。正式产线用 **playwright（headless chromium）**，逐张直接加载卡片 HTML（`file://` 即可，无需经过 app 壳 iframe）。本 skill 自带导出脚本 `scripts/export.py`，封装了全部画质规范，**优先用它**：

```bash
pip install playwright pillow && playwright install chromium   # 仅首次
python3 .claude/skills/xiaohongshu-card-publish/scripts/export.py dist/<series>
```

脚本做的事（也是任何替代实现都必须满足的规范）：

1. 读 `dist/<series>/pages.json`，按 `pages` 顺序逐张加载 `dist/<series>/<slug>/index.html`。
2. 视口 **1080×1440**，`device_scale_factor=2`（2x 超采样）。
3. 加载后等 `document.fonts.ready`，避免掉字。
4. **只截 `.card` 元素**，得到 2160×2880 原图。
5. 用 Pillow **LANCZOS** 缩回 **1080×1440**（真实成品尺寸，1:1）。
6. 存 **WebP 无损（`lossless`）**，按 `pages.json` 顺序命名 `01.webp … NN.webp`，写入 `dist/<series>/snapshot/`。

> app 壳里那个「导出全部」按钮（浏览器内 JS 导出）是**降级备用路径**，不是正式产线——它走 `foreignObject`+canvas、质量与一致性不如 playwright。除非用户明确要在浏览器里临时导，否则用 `scripts/export.py`。

导出后**自检**：每张实测像素 = 1080×1440；张数 = `pages.json` 条目数；成品不含背景/标尺/占位容器/设备框。

自检通过后**交付**：把 `dist/<series>/snapshot/` 路径（成品 WebP 序列 `01.webp…NN.webp`）给用户，结束。

---

## 验收清单

做完务必逐项核对——这些都是可机器验证的硬指标：

**生成预览（A）**
- [ ] `grep -R "{{" dist/<series>/<slug>/index.html` 无命中（变量全部替换）
- [ ] `grep -RE "\.ruler|\.stage|--scale" dist/<series>/<slug>/index.html` 无命中
- [ ] `pages.json` 的 `pages` 顺序 = 期望的预览/导出顺序
- [ ] 打开预览，渲染的 iframe 数 = `pages` 数组长度

**导出成品图（B）**
- [ ] `dist/<series>/snapshot/` 下文件数 = `pages.json` 条目数，命名 `01.webp…NN.webp` 按页序
- [ ] 每张实测像素 = 1080×1440（`python3 -c "from PIL import Image; print(Image.open('…').size)"`）
- [ ] 格式为无损 WebP
- [ ] 成品里无背景/标尺/占位容器/设备框（只有 `.card`）

---

## 故障排查

按「现象 → 处置」对照，别用「报错就停」一句兜底：

- **导出报缺依赖** → `pip install playwright pillow && playwright install chromium`（仅首次）。
- **成品掉字/字体没生效** → 确认导出走的是 `scripts/export.py`（它已等 `document.fonts.ready` + 120ms 缓冲）；仍掉字则适当加大缓冲再导。
- **某张实测不是 1080×1440** → 检查没人手动改过 `--card-w/--card-h`，以及导出未漏掉 `device_scale_factor=2` + LANCZOS 降采样这一步；尺寸约定不可改。
- **`pages.json` 报错 / 张数对不上** → 确认它是合法 JSON、`pages` 每项都有 `src`，且条目数 = 卡片数；顺序即导出顺序。
- **文案撑破版面** → 靠模板既有约束缩字号 / 换行 / 终端模块整组改「一行注释一行命令」，**绝不**改真实尺寸或塞预览样式。
- **变量在文案里找不到来源** → 停下带推测询问用户（见工作流 A 第 5 步），不静默填值。

## 完整示例

<example>
用户：「根据下面这段文案给 claude-code-quick-reference 系列生成第 3 张预览：主题 /clear 清空上下文，命令 /clear，要点是会丢历史、适合换任务时用。」

正确做法：
1. 卡片 slug 取 `clear-reset-new`，系列 slug 已给 `claude-code-quick-reference`。
2. 系列目录已存在 → 复用 `dist/claude-code-quick-reference/`，不重复复制 app 壳。
3. 建 `dist/claude-code-quick-reference/clear-reset-new/`。
4. 复制 `assets/default.html` 进去当 `index.html`。
5. 填充 `{{变量}}`：`TITLE` 填「<em>/clear</em> 清空上下文」、`INDEX`/`PAGE_NO` 填 `03`、`TERMINAL_LINES` 放 `> /clear` 等。
   —— 发现文案没说 `PAGE_TOTAL`（系列共几张）、也没给 `ACCOUNT` 账号名。**停下来问用户**：「PAGE_TOTAL 我先按现有 pages.json 推断为 09、账号沿用上一张的 TranFu，对吗？」拿到确认再填，不静默瞎填。
6. 在 `pages.json` 的 `pages` 第 3 位放 `{ "src": "clear-reset-new/index.html", "title": "03 · /clear" }`。
7. 自检：grep 无 `{{`、无 `.ruler/.stage/--scale`；标题单行没超 7 字。
8. 交付 `dist/claude-code-quick-reference/index.html` 路径。

随后用户说「导出」：跑 `python3 .claude/skills/xiaohongshu-card-publish/scripts/export.py dist/claude-code-quick-reference`，核对 snapshot 下每张 = 1080×1440、张数对齐。
</example>

<bad-example>
用户同上，但文案没给账号名和总页数。

错误做法 1（静默猜测）：直接把 `ACCOUNT` 填成「小红书用户」、`PAGE_TOTAL` 填成 `01`，不问用户就当完成。
→ 错。卡片会带着错误品牌/页码发出去，看起来「填完了」其实是错的。变量缺来源时 **MUST 停下带推测询问**。

错误做法 2（破坏成品规格）：嫌标题太长，把 `.card` 的 `--card-w` 改成 1200px 让标题放得下；或为了预览方便在卡片产物里留了 `.stage` 容器和 `--scale: .45`。
→ 错。改 1080×1440 会破坏所有下游导出；`.stage`/`--scale` 是预览专用、绝不能进卡片产物。标题太长应靠模板既有约束缩字号或换行，尺寸与禁用类名都不能碰。

错误做法 3（导出走捷径）：用 1x 截图直接存有损 WebP，或截了整个页面（含背景）而不是只截 `.card`。
→ 错。违反「2x 超采样 + 无损 WebP」画质规范、且混入了非 `.card` 内容。用 `scripts/export.py`。
</bad-example>
