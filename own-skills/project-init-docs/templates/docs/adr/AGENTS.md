# 架构决策记录（ADR）

## ADR 规范
- ADR 文件 MUST 命名 `NNNN-title.md`，序号从 0001 递增（0000 为本规范自身）。
- 一条决策一个文件。NEVER 追溯改写已 accepted 的记录；被取代时 MUST 新建一条、并把旧条状态标 superseded。

## 每条 ADR 含
- 背景（context）：当时面对的问题与约束。
- 决策（decision）：最终选择了什么。
- 状态（status）：proposed / accepted / superseded。
- 后果（consequences）：带来的好处与代价。

## 何时写 ADR
做出会影响隐含约束的重要技术/架构选择（依赖方向、数据边界、技术选型等）时 MUST 写一条 ADR。
