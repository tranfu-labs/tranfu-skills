---
prompt_examples:
  - prompt: 提取 stripe.com 的视觉风格, 保留克制的高级感, 别抄 logo。
    scene: 分析参考网站
  - prompt: 从这张落地页截图里抽套设计系统, 不要带原品牌名。
    scene: 分析参考截图
  - prompt: 我发了三张落地页截图, 帮我合成一套主 DNA, 或者告诉我风格打架。
    scene: 融合多个参考
  - prompt: 从这个 Figma 提取 tokens, 顺手给我一段可以粘给 ui-ux-pro-max 的 prompt。
    scene: 交给后续设计使用
  - prompt: 分析这个 app UI 的编辑节奏, 图标语言不用管。
    scene: 比较不同风格
  - prompt: 把这个 dashboard 截图抽成可迁移的色板与字号阶梯, 存到 docs/visual-dna/finance.md。
    scene: 保存到指定位置
---

[English](./README.md) | [中文](./README.zh.md)

# 视觉 DNA 系统

从一份视觉样本里抽出可跨项目复用的视觉 DNA——色板、字体、版式节奏、材质、语气, 剥掉源品牌痕迹, 交下游 skill 直接接手。绝不出成品页面。

## 什么时候用它

**手里有参考**:

我看到一个网站、一张截图、一张海报、一份幻灯或一个 app UI, 喜欢它的气质, 想让 skill 把风格抽成可复用的 tokens 与原则, 不带原品牌痕迹。

**融合多个参考**:

我一次贴了几张样本, 让 skill 帮我合成一套主 DNA, 或者告诉我风格打架、拆成几套并列输出。

**给下游 skill 喂料**:

下一步我要跑 `ui-ux-pro-max` (或别的下游生成 skill) 做真页面, 需要一段可以直接粘的下游 prompt 把 DNA 带过去, 下游不用回头再读原样本。

**明说风格取舍**:

我告诉 skill "只保留克制的编辑节奏, 图标语言不用管, 配图选型也别管", 抽象层级按我说的来。

**不接**:

直接给我出真页面 / dashboard → **ui-ux-pro-max**; 画架构图 / 流程图 / 概念图 → **fireworks-tech-graph**; 审视觉设计好不好 → 不触发。

## 它会产出什么

**默认只出可复用的抽象设计系统, 不出成品页面、海报、dashboard 或原型**——想要成品得下游 skill 接手, 这是最反常识的一点。

- **五件套**: `Visual DNA Design System` (Markdown) + `visual_dna_system` (JSON tokens) + `Downstream Production Prompt` + `Transferability Notes` + `Originality Guardrails`
- **默认回聊天窗**: 五件套以命名 Markdown 与代码块直接返回, 不动文件
- **落盘要点名**: 用户明说路径 (例: `docs/visual-dna/finance.md`) 才写文件
- **原创性守卫**: 源 logo、品牌名、原版式、原文案、专有组件全部剥离, 只留可迁移的抽象原则
- **绝不会做**: 出真页面、真海报、真 dashboard、真原型; 沿用源品牌资产; 硬爬需要登录或反爬的 URL (会请求截图或 HTML 片段)

## 前置条件与边界

**前置**:

一份可读的视觉样本——URL、截图、Figma 帧、图片、HTML+CSS、海报、幻灯或 dashboard 都行, 甚至一段文字描述也可以。URL 若需要登录、有反爬或 404, skill 会请求截图或 HTML 片段, 不硬爬。

**相邻 skill 分工**:

| 任务 | 交给 |
|---|---|
| 出真页面 / dashboard / 组件设计 | **ui-ux-pro-max** |
| 出架构图 / 流程图 / 概念图 | **fireworks-tech-graph** |
| 审 prompt 写得好不好 | **prompt-review** |

**不接的场景**:

- 直接生成成品 (页面、海报、dashboard、幻灯) → 请找下游生成 skill
- 完整复刻源品牌 (logo、版式、文案) → 违反原创性守卫, 强制走抽象化
- 审 prompt 好不好 / 审代码好不好 → 走对应 skill

**微妙边界**:

- 一张自然照片 / 无设计意图的随手截图 → 抽不出 DNA, 会请求换样本
- 多张样本风格冲突 → 会问要合成一套还是分开输出
- 用户明说"照抄这个品牌" → skill 会标出这个越界请求, 继续只做抽象提取
