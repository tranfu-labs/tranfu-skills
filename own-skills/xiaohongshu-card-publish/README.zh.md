---
prompt_examples:
  - prompt: 帮我按这份文案给 claude-code-quick-reference 系列出一张预览卡片。
    scene: 根据文案预览
  - prompt: 这几段文案排成一组小红书卡片, 系列英文名叫 claude-code-quick-reference。
    scene: 新建卡片系列
  - prompt: 在 claude-code-quick-reference 系列后面再加一张 /compact 的卡片。
    scene: 补充一张卡片
  - prompt: 把 claude-code-quick-reference 系列导出成小红书成品配图。
    scene: 导出完整系列
  - prompt: 这两个系列都按尺寸导成 webp。
    scene: 批量导出系列
  - prompt: 把 /clear 那张挪到第 3 位。
    scene: 调整卡片顺序
---

[English](./README.md) | 中文

# 小红书卡片出图

把小红书文案变成 1080×1440 成品配图, 一条流水线走完填模板、排系列、playwright 无损导出。

## 什么时候用它

**根据文案预览**:

我有一段小红书文案, 粘给 skill 说「按这份文档生成预览」, 想让它填模板、建卡片目录、更新 `pages.json`。

**新建卡片系列**:

我有几段文案, 想排成一组小红书卡片, 系列英文名定好, skill 逐张出预览, 顺序落到 `pages.json`。

**补充一张卡片**:

已有系列后面加一张, skill 只加卡片目录和 `pages.json` 一条, 不动系列外壳和其他卡片。

**导出完整系列**:

我说「导出」「截图」「按尺寸出图」, skill 跑 playwright 出 1080×1440 无损 WebP 到 `dist/<系列>/snapshot/`。

**批量导出系列**:

好几个系列一次导出, 每个系列各自按 `pages.json` 顺序。

**不接**:

改卡片模板版式 / CSS / 新增主题 → 那是改 `assets/` 本身, 单独发起; 定义文案输入格式 / 分页规则 → 数据建模决策, 不走本 skill; 与本仓库无关的通用 HTML 或截图任务 → 不适用。

## 它会产出什么 / 你会看到什么

**默认绝不静默填变量**, 品牌名 / 页码 / 账号 / 高亮词等文案里找不到来源时, skill 一定先停下带推测问, 绝不填假值糊弄过去。最反常识的一点。

- **卡片产物**: `dist/<系列>/<卡片名>/index.html`, 从 `assets/default.html` 复制后填掉每个 `{{变量}}` 得到
- **系列外壳**: `dist/<系列>/index.html` (从 `assets/app.html` 复制) + `dist/<系列>/pages.json` (数组顺序即预览顺序、也是导出顺序)
- **成品图**: `dist/<系列>/snapshot/01.webp…NN.webp`, 每张实测 1080×1440 无损 WebP
- **画质规范**: 2x 超采样 + LANCZOS 降回真实尺寸 + WebP 无损, 任何导出路径都必须满足
- **首次导出**: 提示先跑 `pip install playwright pillow && playwright install chromium`
- **绝不会做**: 改 1080×1440 真实尺寸; 把 `.ruler` / `.stage` / `--scale` 混进卡片产物; 把生成的 `.png` / `.jpg` / `.webp` 提交进仓库

## 前置条件 / 边界

**前置**:

仓库根下有可写的 `dist/`; 导出前装好 playwright + chromium + pillow; skill 目录里的 `assets/default.html` + `assets/app.html` 是唯一权威模板, 日常生成只复制、不改。

**不接的场景**:

- 改 `assets/` 里的模板本身 (改事实源, 单独发起)
- 定义文案输入格式 / 分页规则等数据建模
- 与本仓库无关的通用 HTML 或截图任务

**微妙边界**:

- 「改系列内容」= 只改 `pages.json` (增删卡片、调顺序), 绝不动系列外壳或卡片 HTML
- 变量在文案里找不到来源 → 停下带推测问用户, 绝不静默填假值
- 浏览器里的「导出全部」按钮 = 降级备用路径, 正式产线一律用 `scripts/export.py`
- 卡片产物里绝不出现 `.ruler` / `.stage` / `--scale` (那些是外壳的预览专用)
