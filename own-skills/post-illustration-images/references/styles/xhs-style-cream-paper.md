# 小红书笔记视觉风格提示词

这是一份纯视觉风格底座，用于生成小红书笔记封面、单图海报或多图轮播。它只约束底层视觉元素，不包含任何固定主题、观点、产品名、标题、正文或内容结构。

## 核心风格定位

生成一张竖版小红书信息图，整体呈现为温暖、亲切、清晰、手绘感强的知识卡片。画面像一本认真但不严肃的手账笔记页：有纸张底纹、手写马克笔标题、彩色刷痕、高亮划线、圆角信息模块、简洁手绘图标和少量贴纸式装饰。视觉要轻、亮、干净，有明确阅读层级，适合手机屏幕快速浏览。

## 通用生成提示词

```text
Create a vertical Xiaohongshu-style infographic image with a warm hand-drawn notebook aesthetic.

Visual style:
- Friendly hand-drawn educational poster.
- Cream paper background with subtle paper grain and a faint dotted or grid notebook texture.
- Bold marker-style typography, slightly imperfect and organic.
- Large readable text areas with strong hierarchy.
- Soft pastel brush-stroke highlights behind important text areas.
- Rounded hand-drawn information panels with thick imperfect outlines.
- Simple cartoon icons with thick black outlines and flat pastel fills.
- Small sticker-like decorations, hand-drawn rays, arrows, underlines, check marks, warning badges, tape pieces, and paper labels.
- Warm, clean, bright, high-contrast, phone-readable.

Composition:
- Vertical 3:4 poster ratio.
- Clear top-to-bottom reading flow.
- Generous margins and whitespace.
- Modular layout using visual blocks, ribbons, labels, cards, strips, badges, or sticky-note areas.
- Every visual section should feel aligned and intentionally spaced.
- Use visual rhythm from large headline area, highlighted separators, grouped modules, and a compact footer area.

Color:
- Warm off-white or cream paper base.
- Near-black for primary text and icon outlines.
- Mint green as the primary soft highlight color.
- Coral red for emphasis, alerts, or high-energy accents.
- Sky blue as a secondary grouping color.
- Soft yellow for caution or warm highlight areas.
- Keep colors flat, pastel, and clean.
- Avoid one-color dominance.

Typography:
- Use bold hand-drawn marker lettering.
- Make important text visually large and highly readable.
- Use thick strokes, relaxed spacing, and clear line breaks.
- Use color emphasis, brush highlights, underlines, circles, or oversized numerals only when needed.
- Avoid tiny dense paragraphs.

Icon and illustration style:
- Use simple hand-drawn icons, not realistic images.
- Icons should have thick black outlines, flat fills, rounded geometry, and friendly proportions.
- Keep icons symbolic and general-purpose.
- Match all icons to the same stroke weight and cartoon style.

Material and texture:
- Paper grain, notebook-grid texture, dry marker edges, brush stroke texture.
- Low depth, soft paper layering, tiny shadows only where needed.
- No glossy, metallic, glassmorphism, photorealistic, or heavy 3D effects.

Quality requirements:
- Clean visual hierarchy.
- Large readable Chinese text if text is included.
- No garbled characters.
- No crowded layout.
- No dark cyberpunk mood.
- No realistic screenshots.
- No stock-photo feeling.
- No excessive decoration.
```

## 中文版提示词

```text
生成一张竖版小红书风格信息图，整体是温暖、干净、明亮、手绘感强的知识卡片。

视觉风格：
- 手账笔记页气质，亲切、轻量、清晰。
- 米白色或奶油色纸张背景，带细微纸纹和淡淡网格/点阵底纹。
- 粗黑马克笔手写字体，笔触略微不规则。
- 使用大字号和强层级，适合手机端一眼阅读。
- 重点区域使用柔和的彩色刷痕、高亮条、手绘下划线或圈注。
- 信息模块使用圆角手绘卡片，边框是略不完美的粗线条。
- 图标为简洁卡通手绘图标，粗黑描边，扁平柔和彩色填充。
- 可加入少量贴纸、箭头、放射线、勾选章、警告章、胶带、纸条标签等装饰。

构图：
- 竖版 3:4 比例。
- 阅读路径从上到下清楚流动。
- 保留充足留白和边距。
- 使用模块化区域组织画面，例如标题区、高亮条、信息卡、横向提示条、底部标签区。
- 所有视觉区域要对齐清楚，间距稳定。
- 画面节奏由大标题、分隔高亮、模块组、底部小标签共同形成。

色彩：
- 背景使用温暖米白、奶油白或浅纸色。
- 主文字和图标描边使用接近黑色。
- 薄荷绿作为主要柔和高亮色。
- 珊瑚红作为强调色、提醒色或高能量点缀。
- 天蓝色作为辅助分组色。
- 柔黄色作为提示或注意区域。
- 色彩保持扁平、柔和、明快。
- 避免单一色系统治全图。

字体：
- 使用粗黑手写马克笔风格。
- 重要文字必须大、清楚、强对比。
- 行距舒展，分行明确。
- 可用刷痕、高亮、下划线、圈注、放大数字形成重点。
- 避免小字密集堆叠。

图标与插画：
- 只使用手绘卡通图标，不使用真实照片。
- 图标统一为粗黑描边、扁平填充、圆润造型。
- 图标保持象征性和通用性，不绑定具体品牌。
- 所有图标的线条粗细和风格必须一致。

材质：
- 纸张颗粒、淡网格、马克笔边缘、刷痕纹理。
- 低景深层次，仅使用轻微纸片阴影。
- 不使用玻璃拟态、金属质感、强 3D、真实软件截图或写实摄影。

质量要求：
- 层级清楚。
- 文字大且可读。
- 中文不能乱码或错字。
- 画面不能拥挤。
- 不要暗黑科技风。
- 不要真实截图感。
- 不要图库照片感。
- 装饰克制，不喧宾夺主。
```

## 可复用视觉组件

```text
Background:
- warm cream paper
- subtle grain
- faint grid or dotted notebook texture

Text treatment:
- bold black marker lettering
- pastel brush highlight behind text
- hand-drawn underline
- circled emphasis
- oversized accent numerals or symbols

Containers:
- rounded hand-drawn cards
- brush-stroke ribbons
- pill labels
- sticky-note blocks
- warning strips
- small footer badges

Decorations:
- hand-drawn arrows
- small motion rays
- check badges
- warning badges
- tape stickers
- heart or star doodles
- simple divider lines

Icon style:
- thick outline
- flat pastel fill
- rounded geometry
- minimal internal detail
- consistent stroke width
```

## 色彩 Tokens

```text
paper_base: warm cream / off-white
primary_ink: near-black
primary_highlight: soft mint green
accent_emphasis: coral red
accent_grouping: soft sky blue
accent_warning: warm pastel yellow
secondary_surface: very light pastel tint
shadow: soft warm gray, low opacity
```

## 版式 Tokens

```text
canvas_ratio: vertical 3:4
canvas_feel: mobile-first poster
margin: generous
spacing: stable and airy
layout_logic: top-to-bottom reading path
section_style: modular visual blocks
card_radius: soft rounded corners
border_style: imperfect hand-drawn marker line
depth_style: low paper layering
footer_style: compact pill or badge area
```

## 禁用项

```text
Do not include fixed topics, fixed claims, fixed titles, fixed body copy, product names, brand names, or specific content logic in the visual style prompt.
Do not use photorealistic imagery.
Do not use real app screenshots.
Do not use glossy 3D or metallic rendering.
Do not use dark cyberpunk aesthetics.
Do not use heavy gradients.
Do not use dense tiny text.
Do not use overly decorative backgrounds.
Do not make the image dominated by one color family.
Do not mix multiple unrelated illustration styles.
Do not use brand-specific icons unless supplied separately as content input.
```

## 生成前检查

```text
Is the prompt only describing visual style, not content?
Is the image suitable for Xiaohongshu mobile viewing?
Are text areas large and readable?
Is the background light, warm, and paper-like?
Are colors pastel but still high contrast?
Are icons hand-drawn and visually consistent?
Is the layout modular and spacious?
Are decorations restrained?
Does the image avoid realistic screenshots and stock-photo feeling?
```

## 一句话压缩版

```text
Warm cream-paper Xiaohongshu infographic, hand-drawn marker typography, pastel brush highlights, rounded doodle cards, thick-outline cartoon icons, subtle notebook grid texture, clean mobile-first hierarchy, spacious modular layout, friendly educational tone, no photorealism, no screenshots, no dark tech style.
```
