---
name: tranfu-product-page-banner
description: >
  Use when Codex needs to create or refine image-generation prompts for TranFu
  product-page hero banners, product-module banners, or feature-page visuals in a
  futuristic red-and-white 3D glassmorphism style. Trigger on requests such as
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

# Skill: TranFu 产品页未来感 3D 红白玻璃风 Banner

## 1. Skill 目标

用于生成 TranFu 官网产品页顶部 Hero Banner、产品模块 Banner、功能介绍页视觉图。  
视觉方向为 **未来感科技风、高级 3D 渲染、红白玻璃拟态、轻盈留白、适合叠加产品文案**。

该 Skill 适合以下 TranFu 产品页主题：

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

生成一张横向官网 Hero Banner，整体风格必须体现：

- premium futuristic technology style
- polished 3D rendering
- red and white color palette
- translucent glassmorphism
- soft lighting
- soft reflections
- subtle red glow
- rounded edges
- glossy material
- high-key lighting
- clean futuristic UI illustration
- spacious negative space
- refined SaaS product website feeling

画面应保持 **干净、轻盈、精致、有呼吸感**，避免复杂、杂乱、拥挤。

---

## 3. 画布与构图

### 推荐比例

- `3:1`
- `1920 x 640`
- `2560 x 853`

### 构图要求

- 左侧 45% 到 55% 保持浅色留白，用于叠加标题、卖点、CTA。
- 右侧放置主要 3D 视觉装置。
- 主体位于右侧偏中位置，不要居中铺满。
- 底部可以有淡淡流光、轨迹线、透明圆环延伸到左侧。
- 整体保持高级感和呼吸感，不要填满画面。

---

## 4. 背景规范

背景应为：

- 白色到极浅粉色渐变
- 轻微粉红光晕
- 左侧更亮、更干净
- 右侧可略带红色氛围光
- 无深色背景
- 无强烈纹理
- 无明显噪点

推荐关键词：

```text
soft white to pale pink gradient background, clean spacious negative space, subtle red glow, faint motion streaks, glossy reflections
```

---

## 5. 主体装置规范

右侧主体为一个未来感 3D 圆形平台，包含：

- 多层透明圆盘
- 半透明玻璃材质
- 红色高光边缘
- 环形轨道
- 发光细节
- 中心浮起一个主图标
- 柔和反射
- 精致悬浮感

推荐关键词：

```text
a glossy translucent circular platform with concentric rings, red glowing accents, soft reflections, futuristic glass material
```

---

## 6. 图标系统规范

围绕中心主体放置多个半透明 3D 卡片图标。

### 图标卡片特征

- 圆角方形卡片
- 玻璃 / 亚克力质感
- 白色半透明底
- 红色图形符号
- 小型底座或透明圆台
- 轻微漂浮感
- 与中心平台形成环绕关系
- 不使用真实文字或复杂 UI 截图

### 产品页默认图标主题

当主题为「产品页」时，推荐使用以下元素：

- 中心：TranFu 产品能力核心图标，可表现为 AI 芯片、智能中枢、文件夹星标、品牌资产库或产品控制台。
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

### 避免

- 大面积黑色
- 蓝紫科技风
- 高饱和霓虹过多
- 金属灰过重
- 暗黑赛博风
- 强烈工业机械感

---

## 8. 通用正向 Prompt 模板

```text
Create a wide website hero banner in a premium futuristic 3D glassmorphism style.

Use a soft white to very pale pink gradient background with lots of clean negative space on the left side for website copy. The left 45% to 55% of the canvas should remain bright, minimal, and uncluttered.

Place the main visual composition on the right side: a glossy translucent circular platform with concentric rings, red glowing accents, soft reflections, elegant motion streaks, and futuristic glass material.

The theme is: {{主题名称}}.

At the center of the platform, create a large floating rounded square glass icon representing {{核心图标}}.

Around it, arrange several smaller translucent floating cards and icons representing {{周边元素1}}, {{周边元素2}}, {{周边元素3}}, {{周边元素4}}, {{周边元素5}}, and {{周边元素6}}.

Each card should have a semi-transparent white glass base, red icon details, rounded corners, soft glow, tiny transparent pedestal, and a polished 3D look.

Keep the overall composition clean, spacious, high-end, lightweight, and suitable for a modern SaaS product website banner. Use a red-and-white color palette, soft lighting, glossy reflections, subtle depth, and no clutter.

No people, no dark background, no heavy text, no busy details.
Aspect ratio 3:1.
```

---

## 9. TranFu 产品页默认 Prompt

```text
Create a wide website hero banner for the TranFu product page in a premium futuristic 3D glassmorphism style.

Use a soft white to very pale pink gradient background with lots of clean negative space on the left side for website copy. The left 45% to 55% of the canvas should remain bright, minimal, and uncluttered.

Place the main visual composition on the right side: a glossy translucent circular platform with multiple concentric glass rings, red glowing accents, soft reflections, elegant motion streaks, and futuristic transparent material.

The theme is: TranFu intelligent enterprise content and brand asset platform.

At the center of the platform, create a large floating rounded square glass icon representing an intelligent product hub, combining an AI spark, a folder, and a star badge, symbolizing brand assets, content management, and AI-powered creation.

Around it, arrange several smaller translucent floating cards and icons representing brand asset library, image materials, AI writing and creation, data analytics dashboard, template and component library, multi-channel distribution, and enterprise collaboration permissions.

Each card should have a semi-transparent white glass base, red icon details, rounded corners, soft glow, tiny transparent pedestal, and a polished 3D look.

Add subtle red light trails, faint circular orbit lines, and glossy reflections near the bottom, gently extending toward the left side without disturbing the empty copy area.

Keep the overall composition clean, spacious, high-end, lightweight, and suitable for a modern SaaS product website banner. Use a red-and-white color palette, high-key lighting, glossy reflections, subtle depth, rounded edges, and refined glassmorphism.

No people, no dark background, no heavy text, no readable words, no messy UI screenshots, no busy details.
Aspect ratio 3:1.
```

---

## 10. 反向 Prompt / Negative Prompt

```text
dark background, black background, cyberpunk city, blue purple neon, heavy metal, messy details, crowded composition, too many icons, low quality, noisy texture, strong grain, harsh shadows, realistic people, human face, character, hands, readable text, typography, watermark, logo text, distorted letters, cluttered dashboard, complex interface screenshot, over saturated colors, industrial machinery, sharp aggressive edges, flat 2D illustration, cartoon style
```

---

## 11. 变量填写建议

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

## 12. 产品页推荐变量

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

生成后检查以下内容：

- 是否为横向 3:1 官网 Banner。
- 左侧是否保留 45% 到 55% 干净留白。
- 主视觉是否集中在右侧。
- 是否是白色 / 浅粉背景，而不是深色背景。
- 是否具有高级 3D 渲染质感。
- 是否有半透明玻璃、柔和反射、红色发光边缘。
- 是否没有人物、没有真实文字、没有水印。
- 是否图标数量适中，不杂乱。
- 是否适合 TranFu SaaS 官网产品页使用。
- 是否方便在左侧叠加标题、副标题和 CTA。

---

## 14. 适用输出说明

该 Skill 生成的是 **Banner 视觉图**，不直接生成网页排版文字。  
最终图片应为官网产品页的视觉底图，可在左侧叠加：

- 产品标题
- 产品副标题
- 核心卖点
- CTA 按钮
- 客户或场景标签

推荐导出尺寸：

- `1920 x 640`
- `2560 x 853`
- `3840 x 1280`
