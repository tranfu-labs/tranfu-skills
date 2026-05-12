# Output Guidelines

## 标准文件头

每个输出文件建议都带统一头部：

```markdown
# [文档标题]

**Phase:** [阶段名称]
**Project:** [project-name]
**Date:** [生成日期]
**Confidence:** [High / Medium / Low]

---
```

## 标准文件尾

每个输出文件建议都以以下结构收尾：

```markdown
---

## Flags

**Red Flags:**
- [列出关键红旗，或写 None identified]

**Yellow Flags:**
- [列出关键黄旗，或写 None identified]

## Sources
- [本文件引用的关键来源，并标注来源层级]
```

## 跨文件引用

当某个结论依赖其他研究文件时，要显式引用文件路径和具体发现。

好的写法：

> “目标用户对价格高度敏感（见 `01-discovery/target-audience.md`，Buying Behavior 节），这与竞品定价区间 `$X-Y`（见 `01-discovery/competitor-landscape.md`）一致。”

不要写成：

> “如前文所述，用户对价格比较敏感。”

## 最终输出建议

最终结论前，先在对话中给用户一个简短的 Final Assessment Summary：

- 当前判断
- 结论置信度
- 市场 / 用户 / 竞争的主要结论
- 最大风险
- 下一步建议

然后再生成最终文件。

## 过程中的阶段性汇报

在研究阶段，不要一直沉默到最终结论。以下节点必须发送阶段性汇报：

- Intake 完成后
- Wave 1 完成后
- Wave 2 完成后
- Wave 3 完成后
- Wave 4 完成后
- Research Gate 前

每次汇报建议包含：

- 本阶段研究了什么
- 当前最强发现
- 当前最大疑点
- 最适合用户补充的内容

汇报要短，但必须让用户感到自己仍在共同参与研究，而不是被系统抛下。

默认在以下节点暂停，等待用户补充、修正或明确说“继续”：

- `expanded-brief.md` 发送后
- 每次 `Wave Summary` 发送后
- `research-briefing.md` 发送后
- 决策对齐摘要发送后
- `research-gate.md` 发送后

如果运行环境不支持等待交互，也必须在汇报里明确说明将按当前信息继续，而不是假装用户已确认。

## Raw 与 Deliverable 分层

研究阶段的 raw 文件和综合阶段的 deliverable 文件必须严格分开。

- research block 只能写 `01-discovery/raw/` 下的文件
- research block 不得直接写 `market-analysis.md`、`recommended-scope.md` 或最终结论
- synthesis 才能把 raw findings 转成分析型报告与决策型报告
- final recommendation 只能建立在 deliverable 文件之上，不能绕过 synthesis
