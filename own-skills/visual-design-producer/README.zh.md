---
prompt_examples:
  - prompt: 用这份 Visual DNA 帮我做一个 AI 笔记的落地页，出 HTML 就行。
    scene: DNA 直出
  - prompt: 出一张小红书卡，主题「秋日 citywalk 攻略」，封面加内页，HTML 版。
    scene: 小红书卡
  - prompt: 这份 Producer Handoff 是给 dashboard 的，按它直接出 HTML。
    scene: Handoff 直出
  - prompt: 用这份 Visual DNA 但把我们的品牌色和 logo 也融进去，品牌手册在下面。
    scene: 品牌融合
  - prompt: 给我出一份 HTML deck，顺便附一份幻灯片大纲和 CSS 变量。
    scene: HTML deck
  - prompt: 没 DNA 也没 handoff，一句话：出一张秋招海报，风格清冷极简。
    scene: 独立命题
---

[English](./README.md) | [中文](./README.zh.md)

# visual-design-producer

用 Producer Handoff / Visual DNA / 独立命题出一份原创 HTML 视觉稿——落地页、海报、小红书卡、数据面板 (dashboard)、幻灯片 (deck) 一次成稿。

## 什么时候用它

**DNA 直出**:

我手上有一份 Visual DNA (或 JSON tokens), 想让 skill 按它的风格直接出一张 HTML 落地页 / 数据面板 / 幻灯片, 不用再采访我的风格偏好。

**场景直命题**:

我明确说「出一张小红书卡」「做一版秋招海报」「给我一份微信文章封面」, 想让 skill 自动挑对应的输出结构 (卡片 / 海报 / 页面 / 幻灯片)。

**Handoff 直出**:

上游 (设计策略层) 已经写好了 Producer Handoff, 我把它丢进来, 让 skill 按 handoff 直接出 HTML, 不再重新采访目标。

**带品牌融合**:

我要出的稿子必须挂公司品牌色 / logo / 字体, 品牌手册我附在提示里, 想让 skill 从默认的 brandless 切到 brand-on。

**独立命题**:

我没有 Visual DNA、也没有 Handoff, 就一句话「做一张什么风格的什么」, 想让 skill 接住这句话直接出稿。

**不接**:

从参考图 / 源样本抽 Visual DNA → **visual-dna-system**; 审提示词质量 → **prompt-review**; 审代码 → **code-review**;「照抄这张源样本的 logo 和版式」→ 拒接该部分, 只按抽象设计原则出原创稿。

## 它会产出什么

**默认只出原创 HTML——参考图是抽象方向而不是模板, 照抄源样本 logo 或版式的请求会被拒接**——最反常识的一点。

- **主产物**: 一份 HTML 视觉稿, 符合 `references/html-engineering-spec.md` 的工程规范
- **路由说明**: 一句话交代选了哪条产出路线 (落地页 / 卡片 / 海报 / 数据面板 / 幻灯片 ...)
- **品牌模式标注**: 一句话说明本次是 `brandless` 还是 `brand-on`
- **输入类型标注**: 说明本次用的是 `Producer Handoff` / `Visual DNA` / 独立命题
- **质量闸门**: 交付前跑一遍 `references/anti-slop-quality-gate.md`, 附一段闸门通过摘要
- **可选副产物** (仅在你明说要时给): 幻灯片大纲、CSS 变量 / tokens、可粘贴的复现提示词、导出说明
- **绝不会做**: 照抄源样本的 logo / 版面 / 专属组件 / 原文案; 在默认 brandless 模式下要求你先配好内部品牌手册路径; 编造假数据或用填充器堆凑

## 前置条件与边界

**前置**:

至少给一样输入——Producer Handoff / Visual DNA (或 JSON tokens) / 独立命题任一即可; 三样都缺会先问一句要个 brief 再出稿。

**相邻 skill 分工**:

| 动作 | 交给 |
|---|---|
| 从参考图 / 源样本抽 Visual DNA | **visual-dna-system** |
| 审提示词 / SKILL 质量 | **prompt-review** |
| 审代码 | **code-review** |

**不接的场景**:

- 直接照抄源样本的品牌识别 (logo / 版面 / 专属组件 / 原文案) — 会明确拒接这一部分, 改成按抽象 DNA 出原创
- Producer Handoff / Visual DNA / brief 三样都没给 — 会停下, 先问一句要 brief
- brand-on 模式没给品牌上下文 — 会先问要品牌材料, 或退回 brandless 模式继续

**微妙边界**:

- 有 Producer Handoff 时它就是主输入, 不再问「要不要也读 Visual DNA」; 无 Handoff 时才回退到 Visual DNA / 独立命题
- 你提供的真实目标上下文 (产品代码 / 截图 / URL / 文案 / 数据) 会被优先读入, Visual DNA 只作方向指引, 不替代真实上下文
- 缺内容时用带标注的占位符, 不伪造数据
