---
name: review-animations
description: Strict animation and motion-code review skill based on Emil Kowalski's design engineering standards。Trigger when 用户要求 review animation / motion code、检查 easing / duration / transform-origin / GPU-only properties / reduced-motion / hover gating / interruptibility，并希望得到阻塞级发现。Do NOT trigger when 用户要实现新动画、只想命名动效、泛泛 UI 设计建议或非 motion 代码 review。
version: 1.0.0
author: Emil Kowalski
updated_at: 2026-07-06
origin: external
source_url: https://github.com/emilkowalski/skills/tree/main/skills/review-animations
---

# review-animations (external thin pointer)

这是一个 **external 薄指针** —— 公司库只存 frontmatter 和推荐者补充内容，不复制上游完整 skill body。

首次 `tfs install review-animations` 时，install 流程会从 `source_url` 拉取上游 skill 到本地。上游目录包含 `SKILL.md` 和 `STANDARDS.md`。

- 上游 skill: https://github.com/emilkowalski/skills/tree/main/skills/review-animations
- 上游仓库: https://github.com/emilkowalski/skills
- 作者: Emil Kowalski
- 相关课程: https://animations.dev/
- License: MIT

完整内容见 `source_url`。更新内容请直接看上游 README / SKILL.md / STANDARDS.md，别在本仓库改 body。

## 推荐场景

适用:
- 对 animation / motion 代码做严格 review
- 检查 `transition: all`、`scale(0)`、`ease-in`、高频动作动画、非 GPU 属性、缺 reduced-motion 等问题
- 希望输出 findings table 和明确 Block / Approve 结论

不适用:
- 实现新功能或替用户直接写完整动画
- 只是查询某个动效叫什么，优先用 `animation-vocabulary`
- 泛泛 UI polish 或设计方向讨论，优先用 `emil-design-eng`
