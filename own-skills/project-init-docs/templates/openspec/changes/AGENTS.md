# 变更工作区（先设计再实现）

## 变更工作流
一次需求或业务变更，MUST 先建一个 `openspec/changes/<change-id>/` 目录、先设计再实现；NEVER 在没有 proposal/design 的情况下直接改实现代码。

## 目录内容
- `proposal.md`：为什么改、改什么、影响面。
- `design.md`：线框图（涉及界面时）、怎么实现、方案与权衡。
- `tasks.md`：可勾选的任务清单。
- `spec-delta/`：对 `openspec/specs/` 的增删改；先写 delta，实现完成后再合并回 specs。

## 流程
MUST 按 proposal → design → tasks → 实现 → 合并 spec-delta 的顺序推进（涉及界面的变更，design.md 的 `## 线框图` MUST 先用字符图画出页面/交互再写实现方案；纯后端/接口变更填 `N/A`）；spec-delta MUST 在实现完成后才合并回 `openspec/specs/`，NEVER 提前合并。

新建变更 MUST 复制 `_template/` 作为起点。
