---
name: black-line-icon-style
description: >
  Use when the user wants a minimalist black-and-white line icon, symbol, UI entry icon, logo-like auxiliary mark, empty-state symbol, or abstract technology/workflow icon.
  Also trigger for Chinese phrasing such as 做个黑白图标, 线性 icon, AI 工作流 icon, 极简符号, UI 入口图标, 空状态图标.
  Do NOT trigger when the user wants a colorful illustration, realistic image, 3D render, complex poster, article cover, infographic with text, or formal brand logo; route article covers to article-cover-image, infographics to a dedicated infographic workflow, and formal logos to a logo design workflow or human design.
version: 0.2.1
author: aquarius-wing
updated_at: 2026-06-22
origin: own
---

# Skill：black-line-icon-style
# 极简黑白线性图标风｜透明底｜粗黑圆角线条｜无文字｜非 3D

## 0. 默认行为

你的任务是：根据用户输入的主题或概念，直接生成一张极简黑白线性图标。

默认行为：

```text
直接调用图像生成能力出图
默认透明背景；运行时不支持透明时使用纯白背景
默认不出现文字、字母或数字
默认使用粗黑色圆角线条
默认单主体居中
默认不使用彩色、阴影、渐变、3D、纹理或复杂背景
不要先输出大段分析
不要只输出 Prompt
```

只有用户明确要求：

```text
只要方案
只要 Prompt
先分析
不生成图
```

才输出文字方案。

### 0.1 适用边界与重定向

触发范围：

```text
icon / 图标 / 符号 / 线性图标 / UI 功能入口图标 / 空状态图标 / 抽象科技符号 / logo-like 辅助图形
```

不触发范围：

```text
彩色插画 / 写实图 / 摄影风图像 → 转到对应插画或写实图工作流
3D 质感 / C4D / 立体渲染 → 转到 3D 或立体图像工作流
复杂海报 / 文章封面 / 带标题横版图 → 转到 article-cover-image
带文字的信息图 / 知识卡片 / 流程说明图 → 转到专门的信息图或图表工作流
品牌正式 Logo 定稿 → 转到 logo 设计工作流或人工设计
```

意图歧义处理：

```text
用户说“logo-like”但只是要辅助符号或概念标记 → 使用本 Skill。
用户说“Logo 定稿 / 品牌 Logo / 商标 / VI 主标识” → 不触发本 Skill，转到 logo 设计工作流或人工设计。
用户说“只要 Prompt”且目标是黑白线性图标 → 使用文字模式，输出图像生成 Prompt，不调用图像生成。
用户说“只要 Prompt”但目标不是图标视觉 → 不触发本 Skill。
```

ownership：

```text
默认 ownership = edit/generate image：直接调用图像生成能力产出图标。
仅当用户显式说“只要 Prompt / 不生成图 / 先给方案”时，ownership = rewrite inline：只输出完整图标生成 Prompt，不生成图片。
```

完成标准：

```text
done = 产出一张图标图像，且 §5.1 生成前 Prompt 自检与 §5.2 生成后成品验证全部通过。
若用户只要 Prompt，done = 输出 §6 中文 Prompt 或 §7 英文 Prompt + §8 负面 Prompt，且不调用图像生成。
```

### 0.2 主流程

CREATE A TODO LIST FOR THE TASKS BELOW（内部执行，不向用户展示）：

```text
1. 读取用户输入。若没有主题、概念或使用场景 → 向用户索要图标主题并退出。
2. 判断任务边界。若用户要彩色插画、写实图、3D、复杂海报、文章封面、信息图或正式 Logo → 按 §0.1 重定向并结束。
3. 识别输出模式。若用户显式要求“只要 Prompt / 不生成图 / 先分析” → 输出文字方案并结束；否则继续出图。
4. 提取核心概念。若主题包含多个对象 → 选择一个最能覆盖整体语义的单一符号；否则使用主题关键词。
5. 选择图形隐喻：目标 / 节点 / 连接线 / 循环箭头 / 文档卡片 / 勾选 / 星标 / 抽象 AI 核心 / 系统结构线。
6. 拼接 Prompt：使用 §6 或 §7，并附加 §8 负面 Prompt。
7. 跑 §5.1 生成前 Prompt 自检。若任一项不通过 → 补全或收紧 Prompt 后回到第 6 步；若仍无法得到合格 Prompt → 简短说明失败原因并结束，不宣称 done。
8. 调用图像生成能力产出图标。
8.1 跑 §5.2 生成后成品验证。若任一项不通过 → 按 §10 纠偏后回到第 6 步；若同一失败连续 2 次出现 → 改为更简单的单主体几何符号后再试一次；仍失败 → 简短说明失败原因并结束，不宣称 done。
9. 成品验证通过后，简短回复结果并结束。
```

---

## 1. 适用场景

尤其适合：

```text
Prompt 多轮评审
目标驱动拆解
AI 工作流
多步骤流程
任务分解
审核 / 反馈 / 评分
数据分析 / 结果确认
系统结构 / 流程编排
UI 功能入口
空状态图标
```

---

## 2. 风格目标

生成一种极简、现代、抽象、黑白线性图标风格的视觉图形。

整体像手绘科技符号，但保持干净、克制、几何化，适合用于 UI、产品、品牌辅助图形或视觉系统。

---

## 3. 视觉特征

```text
白色、透明或极浅灰背景
纯黑色粗线条
线条圆角、流畅、连续
主体居中，构图简洁
强识别度，强轮廓感
抽象科技感或系统符号感
少量几何曲线或基础图形表达概念
现代 UI icon，而不是复杂插画
```

---

## 4. 生成规则

生成图像时，MUST 遵循以下规则：

```text
1. 使用黑白配色，NEVER 使用彩色。
2. 使用粗黑色圆角线条。
3. 背景优先使用透明底；如不支持透明底，则使用纯白背景。
4. 主体居中，留出充足留白。
5. 线条流畅、有轻微手绘感，但不能杂乱。
6. 图形简洁、抽象、现代。
7. 使用图形符号表达概念，不依赖文字。
8. 不加入复杂装饰。
9. 不使用阴影、渐变、3D、纹理。
10. 不写实化。
11. 不出现文字、字母、数字，unless the user explicitly requests。
12. 图标缩小到 24-48px 时仍可识别。
```

---

## 5. 自检与完成标准

### 5.1 生成前 Prompt 自检

生成图片前 MUST 只检查 Prompt 文本，不判定尚未生成的成品图：

```text
1. Prompt 是否明确要求黑白配色，并禁止彩色？
2. Prompt 是否明确要求透明背景，或在不支持透明时使用纯白背景？
3. Prompt 是否明确要求粗黑色圆角线条？
4. Prompt 是否明确要求单主体、主体居中、留白充足？
5. Prompt 是否明确禁止文字、字母、数字，除非用户显式授权？
6. Prompt 是否明确要求简洁高识别度，并在 24-48px 缩小时仍可识别？
7. Prompt 是否已附加 §8 负面 Prompt，覆盖阴影、渐变、3D、纹理、写实、复杂背景和多主体等禁项？
```

```text
§5.1 done = 上述 7 项全部能从 Prompt 文本中直接读到。
如果任一项为“否”，不能调用图像生成；必须补全或收紧 Prompt。
```

### 5.2 生成后成品验证

生成图片后 MUST 检查成品图：

```text
1. 是否完全无彩色？
2. 背景是否透明或纯白？
3. 是否使用粗黑色圆角线条？
4. 是否单主体居中且留白充足？
5. 是否无文字、字母、数字，除非用户显式授权？
6. 是否缩小到 24-48px 仍可识别？
7. 是否无阴影、渐变、3D、纹理和写实痕迹？
```

```text
§5.2 done = 上述 7 项全部通过，并且最终产物是一张黑白线性图标。
如果任一项为“否”，不能宣称完成；必须按 §10 纠偏并重新生成。
```

---

## 6. 默认中文提示词模板

```text
生成一个「{主题}」的极简黑白线性图标。透明背景；如果不支持透明背景，则使用纯白背景。使用粗黑色圆角线条，线条流畅、几何化、带一点手绘感。主体居中，构图简洁，有强识别度。整体风格类似抽象科技符号、系统流程图标或现代 UI icon。只使用一个核心视觉主体。不要使用颜色、阴影、渐变、3D、纹理、复杂背景、文字、字母、数字或过多细节。
```

---

## 7. 默认英文提示词模板

```text
Create a minimalist black-and-white line icon for "{topic}" with a transparent background. If transparency is not supported, use a pure white background. Use thick black rounded strokes with smooth geometric curves and a subtle hand-drawn feeling. Keep the subject centered, simple, abstract, and highly recognizable. Make it feel like a modern technology symbol, system workflow icon, or clean UI icon. Use only one main visual subject. No colors, no shadows, no gradients, no 3D effects, no textures, no complex background, no text, no letters, no numbers, and no excessive details.
```

---

## 8. 负面提示词

```text
colorful, realistic, photorealistic, 3D, c4d, shadow, gradient, texture, complex background, thin lines, detailed illustration, decorative pattern, text, letters, numbers, messy strokes, low contrast, filled background, multiple subjects, poster layout, infographic, chart, label, watermark, logo mockup, brand identity presentation
```

---

## 9. 主题生成模板

### 9.1 目标驱动拆解 图标

```text
生成一个「目标驱动拆解」的极简黑白线性图标。透明背景，粗黑色圆角线条。上方是一个靶心或目标符号，中心有箭头命中目标；下方用三到四个无文字节点表示目标被拆解成任务、数据和结果。节点之间用简洁连线连接，整体像清晰的目标分解结构图。主体居中，现代 UI icon 风格，无文字、无阴影、无渐变、无复杂细节。
```

### 9.2 Prompt 多轮评审 图标

```text
生成一个「Prompt 多轮评审」的极简黑白线性图标。透明背景，粗黑色圆角线条。中心可以是一个文档或提示词卡片，周围用循环箭头或多个无文字阶段节点表示多轮迭代评审。节点可用对话气泡、勾选、星标或反馈符号表达反馈、修改、确认和评分。主体居中，构图简洁，现代 UI icon 风格，无文字、无阴影、无渐变、无复杂细节。
```

### 9.3 AI 工作流 图标

```text
生成一个「AI 工作流」的极简黑白线性图标。透明背景，粗黑色圆角线条。使用节点、连接线、箭头和一个抽象 AI 核心符号表现输入、处理、输出。主体居中，构图简洁，现代 UI icon 风格，无文字、无阴影、无渐变、无复杂细节。
```

---

## 10. 失败路径与纠偏

如果生成结果出现以下情况，视为失败：

```text
出现彩色
背景不是透明或纯白
线条太细或不是黑色圆角线条
出现文字、字母或数字，且用户没有显式授权
出现阴影、渐变、3D、纹理或写实质感
主体过多或构图像信息图 / 海报
缩小到 24-48px 无法识别
```

纠偏方式：

```text
删除所有文字和标签。
删除阴影、渐变、3D 与纹理。
减少主体数量，只保留一个核心符号。
加粗黑色圆角线条。
改为透明或纯白背景。
进一步抽象成几何符号。
```

---

## 11. 快捷版 Skill

```text
极简黑白线性图标风：透明或白色背景，粗黑色圆角线条，流畅几何曲线，主体居中，构图简洁，抽象科技符号感，适合 UI icon。禁止彩色、阴影、渐变、3D、纹理、复杂背景、文字、字母、数字和过多细节。done = §5.1 生成前 Prompt 自检与 §5.2 生成后成品验证全部通过。
```
