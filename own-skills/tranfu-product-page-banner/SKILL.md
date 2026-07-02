---
name: tranfu-product-page-banner
description: >
  Use when Codex needs to create or refine image-generation prompts for TranFu
  product-page hero banners, product-module banners, or feature-page visuals in a
  red-white 3D glassmorphism style with a right-side platform and left copy area. Trigger on requests such as
  "生成 TranFu 产品页 banner", "产品页首屏视觉图", "红白玻璃风 hero 图", or "TranFu 官网功能页视觉".
  Do NOT trigger when the user asks to implement webpage layout/code, redesign the
  TranFu logo, create non-TranFu visuals, audit an existing UI, or generate realistic
  product screenshots. Boundary: output banner image prompts or, when explicitly
  requested, generated banner visuals; do not produce page copy or full web layout.
version: 0.1.0
author: chuanye312-coder
updated_at: 2026-06-29
origin: own
---

# Skill: TranFu 产品页 3D 红白玻璃风 Banner

## 1. Skill 目标

用于生成 TranFu 官网产品页顶部 Hero Banner、产品模块 Banner、功能介绍页视觉图。  
视觉约束为 **3:1 横向画布、左侧 45% 到 55% 无主体留白、右侧 3D 透明玻璃平台、红白配色、红色强调面积不超过 15%、无可读文字 / 人物 / 水印**。

该 Skill 覆盖以下 TranFu 产品页主题：

- AI 产品能力页
- 品牌资源库
- 内容中台
- 数据分析
- 素材管理
- 智能创作
- 企业工具
- 模板 / 组件 / 资产管理
- 营销内容生产与分发

---

## 2. 核心视觉风格

生成一张横向官网 Hero Banner，画面必须包含以下可见元素：

- 3D circular platform with visible depth, bevels, shadows, and highlights
- red and white color palette
- translucent glassmorphism material with visible background blur or refraction
- diffused lighting with no harsh black shadows
- visible reflections on rings, cards, or platform surfaces
- thin red rim light on rings, icon cards, or platform edges
- rounded corners on icon cards and circular rings on the platform
- white to pale pink background covering at least 70% of the canvas
- left 45% to 55% copy area with no subject, text, logo, or watermark
- simple UI-like glyph icons, not real UI screenshots

画面必须满足：主体与图标群只占右侧区域，周围浮动图标数量为 `4` 到 `8` 个，任意两个图标之间不得重叠，左侧留白区不得被装饰元素遮挡。

---

## 3. 画布与构图

### 画布比例

- `3:1`
- `1920 x 640`
- `2560 x 853`

### 构图要求

- 左侧 45% 到 55% 保持浅色留白，用于叠加标题、卖点、CTA。
- 右侧放置主要 3D 视觉装置。
- 主体位于右侧偏中位置，不要居中铺满。
- 底部装饰仅限细流光、细轨迹线或透明圆环；若延伸到左侧，透明度必须低到不影响叠加文字。
- 主体、图标和装饰元素的总覆盖面积不得超过整张图的 55%。

---

## 4. 背景规范

背景必须满足：

- 白色到极浅粉色渐变
- 粉红光晕覆盖面积不超过画面 20%
- 左侧 45% 到 55% 区域无主体、无图标、无文字、无水印
- 右侧红色光晕覆盖面积不超过画面 20%
- 无深色背景
- 无强烈纹理
- 无明显噪点

背景 Prompt 片段：

```text
white to pale pink gradient background, empty left 45 to 55 percent copy area, thin red rim light on the right side, thin low-opacity motion streaks, visible reflected highlight lines
```

---

## 5. 主体装置规范

右侧主体为一个 3D 圆形平台，包含：

- 多层透明圆盘
- 半透明玻璃材质
- 红色边缘光
- 环形轨道
- 发光细节
- 中心浮起一个主图标
- 低对比反射高光
- 主图标与平台之间有可见间距和投影

主体 Prompt 片段：

```text
a translucent circular platform with concentric rings, thin red rim lights, visible low-contrast reflections, glass material
```

---

## 6. 图标系统规范

围绕中心主体放置多个半透明 3D 卡片图标。

### 图标卡片特征

- 圆角方形卡片
- 半透明玻璃 / 亚克力材质，有可见边缘高光
- 白色半透明底
- 红色图形符号
- 小型底座或透明圆台
- 卡片与平台之间有可见间距和投影
- 与中心平台形成环绕关系
- 不使用可读文字、真实 UI 截图或由多列数据表组成的界面截图

### 产品页默认图标主题

当主题为「产品页」时，使用以下元素：

- 中心：TranFu 产品能力核心图标，从 AI 芯片、智能中枢、文件夹星标、品牌资产库或产品控制台中选一个语义。
- 周围：品牌资源库图标
- 周围：内容素材图标
- 周围：AI 智能创作图标
- 周围：数据分析图标
- 周围：模板 / 组件库图标
- 周围：多渠道分发图标
- 周围：权限 / 企业协作图标

---

## 7. 色彩规范

### 主色

- Red: `#E63A46`
- Red Bright: `#FF3B42`
- Red Deep: `#F52D38`
- White: `#FFFFFF`
- Pale Pink: `#FFF1F3`
- Light Pink: `#FFE8EB`
- Glass: `white translucent glass`

### 色彩比例

- 白色与浅粉：70%
- 透明玻璃：20%
- 红色强调：10%

### 禁止

- 大面积黑色
- 蓝紫科技风
- 高饱和霓虹过多
- 金属灰过重
- 暗黑赛博风
- 强烈工业机械感

---

## 8. 通用正向 Prompt 模板

```text
Create a wide 3:1 website hero banner with a right-side translucent 3D glass platform and a red-white color system.

Use a white to very pale pink gradient background. Keep the left 45% to 55% of the canvas empty for website copy, with no subject, icon card, readable text, logo text, or watermark in that area.

Place the main visual composition on the right side: a translucent circular platform with concentric rings, visible highlights, low-opacity shadows, thin red rim lights, thin low-opacity motion streaks, and glass material with visible reflection or refraction.

The theme is: {{主题名称}}.

At the center of the platform, create a large floating rounded square glass icon representing {{核心图标}}.

Around it, arrange several smaller translucent floating cards and icons representing {{周边元素1}}, {{周边元素2}}, {{周边元素3}}, {{周边元素4}}, {{周边元素5}}, and {{周边元素6}}.

Each card should have a semi-transparent white glass base, red icon details, rounded corners, thin red rim light, a small transparent pedestal, visible bevels, and a low-opacity shadow.

Keep red accents below 15% of the canvas. Use 4 to 8 floating icon cards, keep every card inside the right-side visual group, and preserve the empty left copy area.

No people, no dark background, no readable text, no watermark, no overlapping icon cards, no more than 8 icon cards.
Aspect ratio 3:1.
```

---

## 9. TranFu 产品页默认 Prompt

```text
Create a wide 3:1 website hero banner for the TranFu product page with a right-side translucent 3D glass platform and a red-white color system.

Use a white to very pale pink gradient background. Keep the left 45% to 55% of the canvas empty for website copy, with no subject, icon card, readable text, logo text, or watermark in that area.

Place the main visual composition on the right side: a translucent circular platform with multiple concentric glass rings, visible highlights, low-opacity shadows, thin red rim lights, thin low-opacity motion streaks, and glass material with visible reflection or refraction.

The theme is: TranFu intelligent enterprise content and brand asset platform.

At the center of the platform, create a large floating rounded square glass icon representing an intelligent product hub, combining an AI spark, a folder, and a star badge, symbolizing brand assets, content management, and AI-powered creation.

Around it, arrange several smaller translucent floating cards and icons representing brand asset library, image materials, AI writing and creation, data analytics dashboard, template and component library, multi-channel distribution, and enterprise collaboration permissions.

Each card should have a semi-transparent white glass base, red icon details, rounded corners, thin red rim light, a small transparent pedestal, visible bevels, and a low-opacity shadow.

Add thin red light trails, thin low-opacity circular orbit lines, and visible reflected highlight lines near the bottom. If these lines extend toward the left side, keep them behind the copy area and low-contrast enough that two lines of title text and one CTA would remain readable.

Keep red accents below 15% of the canvas. Use 4 to 8 floating icon cards, keep every card inside the right-side visual group, and preserve the empty left copy area.

No people, no dark background, no readable words, no watermark, no overlapping icon cards, no real UI screenshots, no more than 8 icon cards.
Aspect ratio 3:1.
```

---

## 10. 反向 Prompt / Negative Prompt

```text
dark background, black background, cyberpunk city, blue purple neon, heavy metal, more than 8 icons, overlapping icons, full-canvas object coverage, pixelated artifacts, noisy texture, strong grain, harsh shadows, realistic people, human face, character, hands, readable text, typography, watermark, logo text, distorted letters, data-table dashboard, multi-panel interface screenshot, over saturated colors, industrial machinery, sharp aggressive edges, flat 2D illustration, cartoon style
```

---

## 11. 变量填写表

| 变量 | 说明 | 示例 |
|---|---|---|
| `{{主题名称}}` | 当前页面或模块主题 | TranFu 产品页 / 品牌资源库 / AI 内容中台 |
| `{{核心图标}}` | 中央主图标 | AI 产品中枢、文件夹星标、智能控制台 |
| `{{周边元素1}}` | 周边能力图标 1 | 品牌资产库 |
| `{{周边元素2}}` | 周边能力图标 2 | 图片素材 |
| `{{周边元素3}}` | 周边能力图标 3 | AI 智能创作 |
| `{{周边元素4}}` | 周边能力图标 4 | 数据分析 |
| `{{周边元素5}}` | 周边能力图标 5 | 模板组件库 |
| `{{周边元素6}}` | 周边能力图标 6 | 多渠道分发 |

---

## 12. 产品页默认变量

```yaml
主题名称: TranFu 产品页
核心图标: intelligent product hub with AI spark, folder, and star badge
周边元素1: brand asset library
周边元素2: image and media materials
周边元素3: AI-powered content creation
周边元素4: data analytics dashboard
周边元素5: template and component library
周边元素6: multi-channel distribution
周边元素7: enterprise collaboration permissions
```

---

## 13. 输出质量检查清单

生成后按下面清单逐项判定。若运行时有像素取样、OCR 或人脸检测能力，优先使用工具结果；若没有检测工具，降级为人工目测，但每一项仍必须记录 `yes` 或 `no`。

### 13.1 硬性通过条件

- 画布比例：宽高比必须为 `3:1`，允许误差为 `3 ± 0.05`；尺寸命中 `1920 x 640`、`2560 x 853` 或 `3840 x 1280`。
- 左侧留白：画面左侧 `45%` 到 `55%` 宽度范围内不得出现主体装置、图标卡片、可读文字或水印；该区域必须能放下两行标题和一个 CTA。
- 主视觉位置：主 3D 平台和图标群的视觉重心必须位于画面右半区，水平位置必须落在 `55%` 到 `85%` 之间，不得居中铺满。
- 背景明度：背景必须是白色到极浅粉色；黑色、深灰、蓝紫霓虹或暗黑赛博区域不得覆盖超过画面 `10%`。
- 色彩比例：画面必须包含白色 / 极浅粉背景和 TranFu 红色强调；红色强调面积不得超过画面 `15%`。
- 文字检测：OCR 可识别文字数量必须为 `0`；若无 OCR 工具，人工确认画面中无可读文字、logo 文字、乱码字母或水印。
- 人物检测：人脸、人物身体、手部或角色数量必须为 `0`；若无检测工具，人工确认无人像元素。
- 图标数量：周围浮动图标卡片数量必须在 `4` 到 `8` 之间，且不得遮挡左侧留白区。
- 3D 玻璃材料：至少命中以下 `3` 项视觉证据：半透明玻璃材质、环形平台或同心圆、低对比反射线 / 高光点、红色发光边缘、可见投影或景深。

### 13.2 合格判定

- 上述硬性通过条件全部为 `yes` → 判定为合格。
- 任一硬性通过条件为 `no` → 判定为不合格，必须根据失败项修改 Prompt 后重新生成。
- 连续生成多张仍不合格时，向用户报告失败项清单，不要宣称完成。

---

## 14. 适用输出说明

该 Skill 生成的是 **Banner 视觉图**，不直接生成网页排版文字。  
最终图片用作官网产品页的视觉底图，左侧留白区必须能叠加：

- 产品标题
- 产品副标题
- 核心卖点
- CTA 按钮
- 客户或场景标签

导出尺寸：

- `1920 x 640`
- `2560 x 853`
- `3840 x 1280`
