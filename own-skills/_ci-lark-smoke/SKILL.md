---
name: _ci-lark-smoke
version: 0.1.0
description: "占位 skill, 仅用于触发 .github/workflows/lark-pr-notify.yml 的冒烟测试. 不打算被 install/runtime 使用. 修改 description 字段并提 PR 即可验证飞书通知卡片是否正常."
author: Wing
updated_at: 2026-05-13
origin: own
---

# _ci-lark-smoke

不是真的 skill, 是 CI 的金丝雀.

## 用途

`lark-pr-notify` workflow 监听 `own|external|meta-skills/*/SKILL.md` 的增/改/删. 想验证通知卡片改动是否正常时, 改这个 skill 的 frontmatter (例如 `description` / `version`) 提个 PR 就能触发一次 modified 事件, 不会污染真实 skill.

## 注意

- `_` 前缀: 标记内部/测试用, install/search 默认应跳过
- 不要给它加 README 翻译之类的, 保持最小
- 任何人都可以借它来测 CI; 改完合并就行
