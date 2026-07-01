# Style Index

This file routes platform requests to suite-level Style Specs.

Important:

- Style files are the source of truth for default image count, visual system, content expression rules, and negative constraints.
- Machine-readable spec files are the source of truth for deterministic scripts and QA when a style has fixed geometry, color tokens, safe areas, or component slots.
- Style reference images are long-lived QA baselines. They are not generation inputs and must not contribute their semantic content to a new image.
- This index only summarizes routing metadata. If this file conflicts with a selected style file or machine-readable spec, the selected style/spec wins.
- Brand Plugin support is style-scoped. Do not infer a global brand slot from this index.
- When adding a new style, add a row here and place the full prompt in `references/styles/`. Add a machine-readable spec only when deterministic scripts or fixed geometry are needed.

| Style ID | Platform | Style File | Machine Spec | Style Reference | Brand Plugin | Page Badges | Default Use |
|---|---|---|---|---|---|---|---|
| `wechat-doodle` | WeChat official account | `references/styles/wechat-style-doodle.md` | `references/styles/wechat-style-doodle.spec.json` | `assets/style-references/wechat-doodle.png` | enabled via spec `brandSlot` | disabled | Long article body illustrations, warm hand-drawn explainer set. |
| `xhs-explainer-notebook` | Xiaohongshu | `references/styles/xhs-style-explainer-notebook.md` | `references/styles/xhs-style-explainer-notebook.spec.json` | `assets/style-references/xhs-explainer-notebook.png` | enabled via spec `brandSlot` | disabled | Vertical notebook-style science/explainer carousel images. |
| `xhs-cream-paper` | Xiaohongshu | `references/styles/xhs-style-cream-paper.md` | `references/styles/xhs-style-cream-paper.spec.json` | `assets/style-references/xhs-cream-paper.png` | disabled | disabled | Warm cream-paper hand-drawn Xiaohongshu infographic base. |
| `xhs-orange-card` | Xiaohongshu | `references/styles/xhs-style-orange-card.md` | `references/styles/xhs-style-orange-card.spec.json` | `assets/style-references/xhs-orange-card.png` | disabled | disabled | Warm orange torn-paper knowledge-card carousel style. |
| `zhihu-tech` | Zhihu | `references/styles/zhihu-style-title.md` | `references/styles/zhihu-style-title.spec.json` | `assets/style-references/zhihu-tech.png` | enabled via spec `brandSlot` | disabled | Fixed 16:9 modern AI/SaaS/developer-tool infographic. |

## Platform Routing

Use WeChat when the user says:

- 公众号
- 微信公众号
- 文章正文配图
- 长文穿插配图

Use Xiaohongshu when the user says:

- 小红书
- 笔记配图
- 封面图
- 卡片 / 轮播 / 图文笔记

Use Zhihu when the user says:

- 知乎
- 回答配图
- 专栏配图

If the platform is not stated and cannot be inferred from the source content, ask which platform to use.

## Style Selection

1. If the user names a style ID, use it if present.
2. If the user names a style in natural language, map it to the closest style file.
3. If no style is specified, select the default style for the platform.
4. If future platform styles include multiple choices, choose based on content expression need:
   - Method/process: workflow-friendly style.
   - Concept explanation: metaphor-friendly style.
   - Comparison: split-screen/card-friendly style.
   - Boundary or caution: warning/checklist-friendly style.

## Natural Language Style Aliases

Map these user phrases to explicit style IDs when selecting a Xiaohongshu style:

| User phrase | Style ID |
|---|---|
| 暖橙色 / 暖橙 / 橙色 / 橙色撕纸 / 暖橙撕纸 / orange card / torn paper / Quick Guide / Key Point | `xhs-orange-card` |
| 奶油色 / 奶油纸 / 米白色 / 米白纸 / cream paper / cream / off-white paper / 手绘马克笔 / 轻量手账 | `xhs-cream-paper` |

Do not preselect image count, aspect ratio, palette, safe area, brand slot, page-badge behavior, or other fixed component slots before selecting the style.

When a style has a machine-readable spec, use it as the source of truth for scripts and QA. When it does not, do not run deterministic overlay scripts unless the selected style is first extended with the required spec.

Use the Style Reference only for QA and failure review. Compare visual system, palette, spacing, texture, typography feel, icon/illustration style, composition language, and fixed-component treatment. Ignore all semantic content in the reference image, and do not pass it into native image generation.
