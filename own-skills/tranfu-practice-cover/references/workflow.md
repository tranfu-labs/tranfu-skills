---
title: TranFu 实践页封面生成工作流参考
updated: 2026-07-30
status: active
---

# TranFu 实践页封面生成工作流

用于生成 `/practice` 页面文章封面，目标是稳定产出符合 TranFu 品牌、技术名词准确、适合卡片裁切的“左标题、右主体”封面。

本参考展开 `SKILL.md` 中的主工作流。执行时 MUST 使用 `SKILL.md`
已经建立的 TODO 列表逐步推进，不另建互相冲突的第二份流程状态。

## 一、最终视觉合同

### 画布

- 比例：16:9
- 无损母版：2048 × 1152 PNG
- 页面文件：JPG，单张建议小于 500KB
- 卡片显示：522 × 294

### 构图

- 左侧至少 42%：主标题核心安全区
- 主体整体优先占画布右侧约 55%–58%，核心对象仍位于右半区
- 中间保留呼吸区，标题与主体不能相交
- 主体体量参考较大的紧凑三节点玻璃装置：核心红色框架高度约为画布的 68%–75%，统一底座宽度约为画布的 52%–58%
- 不为机械满足 46% 空白而把主体缩得过小；底座或低位辅助对象可以进入左侧 42%–46% 的过渡带，但其落在该过渡带内的轮廓不得与标题行垂直区间重叠
- 在 2048 × 1152 母版中，同一标题行垂直区间内，文字像素与主体轮廓之间至少保留 64px 可见间距
- 主体通常由 1 个核心对象和 2–3 个辅助对象组成

### 品牌风格

- 高调白色摄影棚背景
- TranFu 红：`#E63A46`
- 透明玻璃、抛光亚克力、浅粉反射
- 明亮、克制、精确、具有产品摄影质感
- 特殊主题可以使用蓝、绿、黄等辅助色，但红色玻璃框架保持一致

### 禁止项

- 不让图片模型生成标题、技术名词或产品名
- 不生成 Logo、水印、数字、伪文字和假代码
- 减少机器人排队、连续传送带和重复节点流水线
- 不使用无意义仪表盘、分析图表或密集 UI
- 不让主体侵入左侧标题安全区

## 二、准备文章信息

每篇文章先填写以下内容：

```yaml
article_title: 完整文章标题
cover_title:
  - 第一行
  - 第二行
  - 第三行
protected_terms:
  - 必须准确的技术名词
accent_term: 局部红色强调词
red_lines:
  - 整行红色标题
subject_summary: 右侧主体的语义说明
subject_objects:
  - 核心对象
  - 辅助对象一
  - 辅助对象二
```

标题应压缩为 1–3 行，每行只表达一个信息层级。完整文章标题继续显示在卡片正文中，封面标题只负责快速识别。

## 三、只生成无字底图

图片模型仅负责生成右侧主体和背景，不负责文字。

### 通用提示词模板

```text
Use case: stylized-concept
Asset type: 16:9 website article-cover background

Primary request:
Create a premium TranFu cover background for: {{subject_summary}}.

Subject:
On the right, create one restrained compact system consisting of
{{subject_objects}}.
Use about three core objects with one unified glass base or connection system.
The structure must communicate the article topic without labels.

Composition:
Keep at least the left 42% calm, bright, pale blush/white, low-detail, and
completely free for a separately typeset title.
Use a confidently sized subject across roughly the right 55–58%, centered
vertically, with the main core staying in the right half.
Match a larger restrained three-node product installation: the main red glass
frame should be about 68–75% of the canvas height and the unified base about
52–58% of the canvas width.
Do not shrink the subject merely to preserve a rigid 46% empty field. A low
base edge or low auxiliary module may enter the 42–46% transition band only
when the part inside that transition band does not intersect a title-line
vertical band.
At 2048 × 1152, preserve at least 64px of visible separation between title
pixels and the subject silhouette within every title-line vertical band.

Style:
High-key premium 3D product photography, translucent red and clear glass,
polished acrylic, white studio lighting, soft blush reflections, clean edges,
strong silhouette, readable at thumbnail size.

Palette:
White, #E63A46 red, clear glass, pale blush.

Constraints:
No text, letters, words, numbers, logos, watermarks, fake UI labels, fake code,
dense dashboards, unrelated objects, repeated robot lineup, or generic conveyor
pipeline. The subject must not cross into the left title field.
```

### 使用参考图时

应明确区分两类参考：

1. 语义参考图：只参考对象和文章含义。
2. 风格参考图：只参考主体尺度、构图密度、玻璃材质和留白。

提示词中写明：

```text
Use the FIRST image only for semantic content and object identity.
Use the SECOND image as the authoritative reference for composition, scale,
density, camera, lighting, glass style, and whitespace.
Do not copy its topic-specific icons or objects.
```

## 四、检查无字底图

底图进入标题合成前必须满足：

- [ ] 左侧至少 42% 没有主体
- [ ] 主体集中在右侧，没有被边缘裁断
- [ ] 主体采用较大的产品装置尺度，没有为了扩大留白而缩得过小
- [ ] 核心红色框架高度约占画布 68%–75%，统一底座宽度约占 52%–58%
- [ ] 若底座或辅助对象进入 42%–46% 过渡带，其落在该过渡带内的轮廓没有与标题行垂直区间重叠
- [ ] 2048 × 1152 母版中，同一标题行垂直区间内，标题与主体至少保留 64px 可见间距
- [ ] 主体在缩略图尺寸下仍然可识别
- [ ] 没有伪文字、Logo、水印或错误符号
- [ ] 没有成排机器人或重复流水线模板
- [ ] 与相邻文章封面的主体结构有明显区别
- [ ] 红、白、透明玻璃风格与实践页一致

不合格时重新生成底图，不使用裁切或遮挡掩盖问题。

## 五、使用 MiSans 合成标题

使用当前运行时安装的 `render-cover-title` Skill。必须先定位该 Skill 的
实际目录，再调用其中的 `scripts/render_title.py`；不要写死某位用户的
主目录。

示例：

```bash
python3 "<render-cover-title-skill>/scripts/render_title.py" \
  --template "/absolute/path/background.png" \
  --title 'Cursor + Git Worktree\n多 Agent 自动化\n串行流水线' \
  --accent "Agent" \
  --red-line "串行流水线" \
  --protect "Cursor" \
  --protect "Git Worktree" \
  --protect "Agent" \
  --safe-x 130 \
  --safe-y 160 \
  --safe-width 740 \
  --safe-height 832 \
  --line-gap 42 \
  --out "/absolute/path/article-v5.png"
```

标题规范：

- 只能使用 MiSans
- 常规文字使用 `#171717`
- 强调文字使用 `#E63A46`
- 技术名词全部加入 `--protect`
- 中文主标题通常使用 Bold、Semibold 或 Heavy
- 长英文行降低字号，不压缩字形、不强制塞满
- 标题左边界统一为画布 `x=130`
- 标题安全区宽度建议不超过 740px

## 六、验证标题安全区

使用：

```bash
python3 "<render-cover-title-skill>/scripts/validate_layout.py" \
  --image "/absolute/path/article-v5.png" \
  --manifest "/absolute/path/article-v5-layout.json" \
  --title 'Cursor + Git Worktree\n多 Agent 自动化\n串行流水线' \
  --protect "Cursor" \
  --protect "Git Worktree" \
  --protect "Agent"
```

验证结果必须满足：

- `status: ready`
- `single_font_family: true`
- `font_family: MiSans`
- `safe_area_passed: true`
- `protected_token_coverage: 100%`

## 七、视觉复核

先检查 2048 × 1152 母版，再检查 522 × 294 卡片尺寸：

- [ ] 标题拼写和大小写完全准确
- [ ] 标题层级在缩略图下仍然清楚
- [ ] 标题和主体之间有明显呼吸区
- [ ] 分类角标不遮挡重要文字
- [ ] 主体没有被卡片 `object-cover` 异常裁切
- [ ] 五张封面的标题基线和视觉重量基本统一
- [ ] 相邻封面没有连续使用相同主体结构

## 八、导出与版本管理

1. 保留无损 PNG 和对应的 `*-layout.json`。
2. 导出 JPG，质量建议为 84–88。
3. 新文件递增版本号，不覆盖旧版本。
4. 页面只引用压缩后的 JPG。

示例：

```text
article-3-v5.png
article-3-v5-layout.json
article-3-v5.jpg
```

macOS JPG 导出示例：

```bash
sips -s format jpeg -s formatOptions 86 \
  "article-3-v5.png" \
  --out "article-3-v5.jpg"
```

## 九、接入与验收

1. 更新 `TranfuPracticePage.tsx` 中的图片 import。
2. 运行：

```bash
npm run build
```

3. 在浏览器打开 `/practice`。
4. 检查五张图片是否全部加载。
5. 检查桌面端实际卡片裁切。
6. 检查窄屏下图片是否仍可加载并保持比例。

## 十、当前实践页标题方案

| 文章 | 封面标题 | 强调 |
| --- | --- | --- |
| Skill 入门 | `TranFu-Skills` / `安装到发布` / `首个 Skill` | 首行、末行 |
| 多 Agent 流水线 | `Cursor + Git Worktree` / `多 Agent 自动化` / `串行流水线` | `Agent`、末行 |
| 默认工作流 | `默认工作流` / `AGENTS.md 优先` | `AGENTS.md` |
| OpenClaw 指南 | `OpenClaw 联合 Claude Code` / `飞书 Bot` / `操作指南` | `OpenClaw`、末行 |
| 儿童创意平台 | `AI Native 儿童` / `Sketch-to-Game` / `创意平台` | 后两行 |
