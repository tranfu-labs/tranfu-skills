# 变更工作区（先设计再实现）

## 变更工作流
一次需求或业务变更，建一个 `openspec/changes/<change-id>/` 目录，先设计再写实现。

## 目录内容
- `proposal.md`：为什么改、改什么、影响面。
- `design.md`：线框图（涉及界面时）、怎么实现、方案与权衡。
- `tasks.md`：可勾选的任务清单。
- `spec-delta/`：对 `openspec/specs/` 的增删改；先写 delta，实现完成后再合并回 specs。

## 流程
proposal → design（涉及界面的变更，先在 design.md 的 `## 线框图` 用字符图画出页面/交互，再写实现方案；纯后端/接口变更填 `N/A`）→ tasks → 实现 → 把 spec-delta 合并回 `openspec/specs/`。

复制 `_template/` 作为新变更目录的起点。
