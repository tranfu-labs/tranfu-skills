---
name: animation-vocabulary
description: Web animation and motion-effect vocabulary lookup skill。Trigger when 用户描述一个动画效果但不知道专业名称，想知道 “what's it called when...” 或需要用准确术语提示 AI / 设计师，例如 popover 弹出、rubber-banding、shared element transition、stagger、morph。Do NOT trigger when 用户要实际实现动画、审查动画代码、完整 UI 设计系统或性能调优。
version: 1.0.0
author: Emil Kowalski
updated_at: 2026-07-06
origin: external
source_url: https://github.com/emilkowalski/skills/tree/main/skills/animation-vocabulary
---

# animation-vocabulary (external thin pointer)

这是一个 **external 薄指针** —— 公司库只存 frontmatter 和推荐者补充内容，不复制上游完整 skill body。

首次 `tfs install animation-vocabulary` 时，install 流程会从 `source_url` 拉取上游 skill 到本地。

- 上游 skill: https://github.com/emilkowalski/skills/tree/main/skills/animation-vocabulary
- 上游仓库: https://github.com/emilkowalski/skills
- 作者: Emil Kowalski
- License: MIT

完整内容见 `source_url`。更新内容请直接看上游 README / SKILL.md，别在本仓库改 body。

## 推荐场景

适用:
- 用户看见某种交互动效，但不知道它叫 `stagger`、`morph`、`rubber-banding` 还是 `shared element transition`
- 需要把模糊描述转成准确动画术语，方便写 prompt、提需求或和设计师沟通
- 想快速区分相近术语，例如 clip-path / mask、pop in / bounce、layout animation / shared element transition

不适用:
- 实现动画代码
- 严格审查 motion 代码质量
- 做完整 UI polish 或设计系统
