<!--
tranfu-publish PR body 模板, 3 路径共用 (own / external / case).
AI 按下方 {variant: own | external | case} 标记挑相应 block 填.
{...} 是占位符, 真写 PR 时替换.

多 skill 一 PR: §元信息 / §Motivation / §自检清单 重复 N 次, 每段顶部加 `### skill: <name>`.

NEVER 把模板段换成 GitHub 通用习惯写法 (## Summary / ## Validation / ## Test plan / ## Rollback) —
本仓库自检 + lark 通知 + lint workflow 按下面这些 section 名读. 换名 = 静默失效.

NEVER 给 PR body 加 `## Test plan` 段 — 用户不是 QA, 自检清单已含 AI 能判定的项.

NEVER 在 PR body 重复 README 的 §同类对比 / §使用技巧 内容 — reviewer 点 README 看权威源, PR body 不二次维护.
-->

## 元信息

- skill: {name}
- path: {own-skills/{name}/ | external-skills/{name}/ | <own|external>-skills/{name}/cases/{recommender}.md}
{variant: own}
- version: {new} (此次: {bump_desc, e.g. "first publish" 或 "0.1.0 → 0.1.1 (patch)"})
- origin: own
- author: {handle}
- 包含: SKILL.md + README.md + cases/{author}.md
{variant: external}
- origin: external
- source_url: {url}
- recommender: {handle}
- 包含: SKILL.md (薄指针) + README.md
{variant: case}
- 类型: {append-scenario | new-recommender}
- 新增 / 修改: <own|external>-skills/{name}/cases/{recommender}.md

## Motivation

{1-3 句: 为什么加这个 / 业务背景 / 触发推荐的具体场景}

{if variant in (own, case)}
## 推荐理由摘要

reason_kind: {tried-and-good | tried-and-bad | read-and-curious | solves-real-pain | time-saver | quality-jump | team-need | other}
{一句话从 case body 摘录}

## 自检清单 (AI 据实勾, 不留给用户)

<!--
规则:
  - AI 实际检查后, 达成 → `- [x]`
  - 实际没达成 → 老实留 `- [ ]`, 让 reviewer 看到. NEVER 偷偷勾上
  - 真不适用 (e.g. case-only PR 不动 SKILL.md) → `- [~] N/A — 一句原因`
  - 不允许整段删自检清单, 也不允许把项删掉装作没出现

跑完整流程到 §6 时, 理论上 own/external 必备产物已在 §0 预检 + §5 起草阶段 ensure, 大多数项应是 `- [x]`.
出现 `- [ ]` 是合法信号: 告诉 reviewer "AI 跑下来发现这项卡住了, 请你来定夺".
-->

{variant: own}
- [ ] README.md 存在 (作者本人写, AI 未起草)
- [ ] README.md 有 `## 同类 Skill 对比` 段
- [ ] README.md 有 `## 使用技巧` 段
- [ ] SKILL.md frontmatter 齐 (name / description / version / author / updated_at / origin: own)
- [ ] cases/{author}.md 存在 + frontmatter 齐 (recommender / recommended_at / reason_kind)
{variant: external}
- [ ] SKILL.md 薄指针 + source_url 有效 (HTTP 200, 已 WebFetch 验过)
- [ ] README.md 有 `## 同类 Skill 对比` + `## 使用技巧` 段
{variant: case}
- [ ] 不动 SKILL.md / README.md (本 PR 只动 cases/)
- [ ] case 文件 frontmatter 齐 (recommender / recommended_at / reason_kind)

## 不在范围 (告诉 reviewer 不用查)

- {示例: 不依赖外部 API key / 不验证 source_url 上游 skill 自身代码质量 / 不验 README 文笔}

## 风险点 (所有 variant 必填, 无则 N/A; **不**允许整段删除)

{variant: own}
- 该 skill 是否会 git push / 改本地状态 / 调外部 API: {N/A 或描述}
- frontmatter 在本地源 vs 公司库副本是否需要展开: {N/A 或描述}
{variant: external}
- source_url 上游 skill 的稳定性 (vaporware / 长期不维护 / license 不明): {N/A 或描述}
{variant: case}
- {N/A 或描述, case-only PR 一般 N/A}
