# skill-review-workflow

skill-create-workflow 的审查视角: 对一个已有 skill 用创建时的同一套门禁反向检验——内容准入 (skill-content-fit)、任务域与命名 (skill-domain-framing)、prompt 工程质量 (prompt-review A–G)、结构完整性 (本地机械清单), 产出带三态裁决 (通过 / 需修改 / 建议重构) 的 `SKILL_REVIEW_REPORT`。只审不改。

## 什么时候用它

- 想知道库里某个存量 skill 今天还过不过得了创建门禁
- 收到别人写的 skill, 合入前想做一次整体体检
- 怀疑某个 skill 命名 / 边界框错了, 想拿评分说话再决定要不要重构
- 想批量审查一个目录下的所有 skill, 拿一张 per-skill 裁决表

## 怎么用 (触发示例)

跟 Claude 说:

- "帮我审一下 own-skills/daily-report 这个 skill"
- "review skill ~/.claude/skills/foo"
- "这个 skill 要不要重构?"
- "把 own-skills/ 整个过一遍审查"

## 你会看到什么

- 四道门逐一给结论: 内容准入反检 / 任务域反检 / prompt 质量 (嵌入 REVIEW_PACKET) / 结构完整性
- 机械裁决: 门 1 或门 2 挂 → 建议重构; 门 3 或门 4 有 BLOCKER/HIGH → 需修改; 否则通过
- 全程不修改被审 skill 的任何文件; 要修改时它会把报告转交 skill-create-workflow 的 update 模式

## 同类对比

- `prompt-review`: 单文件 / 内联 prompt 的工程质量清单, 是本 skill 的门 3; 目标不是完整 skill 目录时直接用它。
- `skill-create-workflow`: 创建 / 更新侧的编排; 审查后要动手改就交回给它。
