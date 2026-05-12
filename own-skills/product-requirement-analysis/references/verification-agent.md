# Verification Protocol

综合完成后，先做 verification，再进入最终结论。

## 一、什么时候运行

- 所有 deliverables 写完之后
- 最终结论之前

## 二、检查目标

### 1. 无来源或无标记断言

所有关键数字、比例、事实性判断都应该被标记为：

- `[Data]`
- `[Estimate]`
- `[Assumption]`
- `[Opinion]`

### 2. 内部矛盾

检查是否存在：

- 同一指标在不同文件里数值不一致
- 一个文件说高置信度，另一个文件的证据却不足
- 结论与前文研究明显脱节

### 3. 置信度一致性

检查：

- 单一弱来源不应标高置信度
- 多个强来源一致时不应标低置信度
- 每个主要结论都应有 confidence

### 4. 数据缺口是否被保留

检查：

- deliverable 是否带 Data Gaps
- raw file 中提到的 gap 有没有在综合后消失
- 是否把“没搜到”假装写成“没有”

### 5. Flags 是否存在

每份 deliverable 建议带：

- Red Flags
- Yellow Flags

### 6. 数据时效

所有超过 18 个月的数据都应标出可能过时。

### 7. 需求结论是否真的被研究支撑

重点检查：

- 市场判断是否由 market-analysis 支撑
- 竞争判断是否由 competitor-landscape 支撑
- 用户结论是否由 target-audience / customer-voice 支撑
- 分发与冷启动判断是否由 distribution-activation 支撑
- 最终建议是否覆盖了主要风险和关键 unknowns
- 推荐范围是否由 `problem-definition.md`、`decision-drivers.md`、`scope-options.md`、`recommended-scope.md` 共同支撑

### 8. 推荐范围是否只是 intake 改写

重点检查：

- `recommended-scope.md` 是否只是把用户前期选择过的方向重新整理了一遍
- 是否真的比较过至少 3 个备选范围
- 是否明确写出至少 2 个 alternatives 被放弃或暂缓的原因
- 是否说明了 recommendation 依赖的关键假设
- 是否存在“因为用户最初偏好某方向，所以最终也推荐同方向”的偷跑逻辑

如果推荐范围缺少比较过程，只能标记为 `Warning` 或 `Critical Issue`，不能视为已完成裁决。

### 9. 关键 checkpoint 是否被跳过

重点检查：

- 是否存在 `research-briefing.md`，或至少有等价的研究阶段汇总
- synthesis 是否显式吸收了研究阶段的矛盾、缺口和用户补充
- recommendation 形成前，是否做过一次决策对齐
- 如果用户在对齐阶段提出异议，相关文件是否被回写更新

如果这些 checkpoint 缺失，应在 `Warnings` 或 `Critical Issues` 中明确指出。

## 三、输出

生成：

- `01-discovery/verification-report.md`

建议结构：

- Summary
- Critical Issues
- Warnings
- Info
- Verification Checklist
- Scope Recommendation Audit
- Checkpoint Integrity Audit

## 四、流程控制

- 如果 Critical issues > 0，暂停并让用户决定是否修复
- 如果只有 Warnings / Info，可继续进入 Research Gate
