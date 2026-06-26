---
name: make-interfaces-feel-better
description: Design engineering principles for making UI feel polished through typography, radius, shadows, motion, hit areas, image outlines, and micro-interactions. Trigger when building or reviewing frontend UI components, tightening animations, hover/press states, icon transitions, tabular numbers, text wrapping, optical alignment, or when the user says "make it feel better" / "feels off" / "UI polish". Do NOT trigger when: 用户要先做完整设计系统或风格选型 (走 ui-ux-pro-max) / 只审 a11y 合规 (走 web-design-guidelines) / 只做 TranFu 官网品牌规范 (走 tranfu-website-design) / 纯后端或业务逻辑改动.
version: 0.1.0
author: jakubkrehel
updated_at: 2026-06-26
origin: external
source_url: https://github.com/jakubkrehel/make-interfaces-feel-better/tree/main/skills/make-interfaces-feel-better
---

# make-interfaces-feel-better (external thin pointer)

这是一个 **external 薄指针** —— 仓库里只存 frontmatter 和推荐者补充内容, 不存 skill body.

首次 `tfs install make-interfaces-feel-better` 时, install 流程会从 `source_url` 拉上游 skill 目录到本地. 上游目录包含 `SKILL.md` 以及 `typography.md` / `surfaces.md` / `animations.md` / `performance.md` 四个参考文件.

- 上游 skill: https://github.com/jakubkrehel/make-interfaces-feel-better/tree/main/skills/make-interfaces-feel-better
- 原文: https://jakub.kr/writing/details-that-make-interfaces-feel-better
- 作者: Jakub Krehel
- License: MIT (见上游 README)

完整内容见 source_url. 更新内容请直接看上游 README / SKILL.md, 别在本仓库改 body.

## 推荐场景

适用:
- 已有页面或组件能跑, 但视觉细节显得粗糙, 需要补 polish
- 做 UI code review 时, 想逐项检查圆角、阴影、动效、文本换行、数字抖动和命中区
- 实现 hover / press / icon transition / enter-exit animation 这类微交互时, 需要明确参数和模式

不适用: 还没有设计方向的项目 (先走 ui-ux-pro-max); 只做 a11y / focus / form 合规审计 (走 web-design-guidelines); TranFu 官网品牌规则变更 (走 tranfu-website-design).
