<!--
tranfu-publish PR body 模板, 3 路径共用 (own / external / case).
AI 按下方 {variant: own | external | case} 标记挑相应 block 填.
{...} 是占位符, 真写 PR 时替换.

NEVER 把模板段换成 GitHub 通用习惯写法 (## Summary / ## Validation / ## Test plan / ## Rollback) —
它们对 reviewer 看似熟悉, 但本仓库自检 + lark 通知 + lint workflow 都按下面这些 section 名读. 换名 = 静默失效.
-->

## 元信息

- skill: {name}
- path: {own-skills/{name}/ | external-skills/{name}/ | external-skills/{name}/cases/{recommender}.md}
{variant: own}
- version: {new} (此次: {bump_desc, e.g. "first publish" 或 "0.1.0 → 0.1.1 (patch)"})
- origin: own
- author: {handle}
{variant: external}
- origin: external
- source_url: {url}
- recommender: {handle}
{variant: case}
- 类型: {append-scenario | new-recommender}
- 新增 / 修改: external-skills/{name}/cases/{recommender}.md

## Motivation

{1-3 句: 为什么加这个 / 业务背景 / 触发推荐的具体场景}

{if variant in (external, case)}
## 推荐理由摘要

reason_kind: {tried-and-good | tried-and-bad | read-and-curious | solves-real-pain | time-saver | quality-jump | team-need | other}
{一句话从 case body 摘录}

{if variant == external}
## 案例文件

- external-skills/{name}/cases/{recommender}.md ({scenarios_count} 个场景)
- _assets/: {image_count} 张图

## §同类对比 摘要

{1-2 句: 内部最相近的是 X / 外部最相近的是 Y / 本 skill 独特价值是 Z. 详见 SKILL.md `## 同类 Skill 对比`}

## §使用技巧 摘要

{1-2 句: 材料方案 / 推荐用法 / 已知限制 各挑一点. 详见 SKILL.md `## 使用技巧`}
{variant: case}
{- §同类对比 / §使用技巧 段为 case-only PR, 不动 SKILL.md, 此处省略}

## 自检清单 (作者勾)

{variant: own}
- [ ] frontmatter 必填齐全: name / description / version / author / updated_at / origin: own
- [ ] description 含触发场景 + "Do NOT trigger when" 反例
- [ ] origin: own (不应出现 source_url)
- [ ] SKILL.md 含 `## 同类 Skill 对比` 章节 (内/外 ≤3+3 候选 + 独特价值 ≤3 句)
- [ ] SKILL.md 含 `## 使用技巧` 章节 (材料方案 / 推荐用法 / 已知限制 3 子段, ≤9 bullet ≤500 字)
- [ ] 触发语写法是用户视角 ("用户说 ...", 不是 "调用此 skill 当 ...")
- [ ] 本地 dogfood: 至少跑过 1 次完整流程
- [ ] 不在子目录嵌套其他 skill, 不引入需额外手动安装的二进制
- [ ] 跑过 `npm run build:index`, index.json 已 stage
{variant: external}
- [ ] SKILL.md 是薄指针, body 含 "完整内容见 source_url" / "上游仓库" 引导
- [ ] frontmatter: origin: external + source_url 有效 (HTTP 200)
- [ ] SKILL.md 含 `## 推荐场景` + `## 同类 Skill 对比` + `## 使用技巧` (推荐者补充, 不是复制上游)
- [ ] case 文件 frontmatter 三必填齐: recommender / recommended_at / reason_kind
- [ ] case body 不空话, 有具体场景描述
- [ ] 图 (如有) ≤ 1MB, 路径在 cases/_assets/
- [ ] source_url 指向真实 skill (不是 vaporware / 长期不维护)
- [ ] 跑过 `npm run build:index`, index.json 已 stage
{variant: case}
- [ ] 不改 external-skills/{name}/SKILL.md (本 PR 只动 cases/, 不触发 §同类对比 / §使用技巧)
- [ ] case 文件 frontmatter 三必填齐: recommender / recommended_at / reason_kind
- [ ] case body 不空话, 有具体场景描述
- [ ] 图 (如有) ≤ 1MB, 路径在 cases/_assets/
- [ ] 如 description 因为新 case 调整 → index.json 已 rebuild

## Test plan

{variant: own}
- [ ] 装到本地: `tfs install {name}` 跑通
- [ ] 触发语 1 跑出预期输出
- [ ] 触发语 2 跑出预期输出
{variant: external}
- [ ] 装到本地: `tfs install {name}` (会从 source_url 拉上游) 跑通
- [ ] 推荐场景里至少 1 个真实跑过
{variant: case}
- [ ] 不需要新测 — 本 PR 只增案例, 不改 skill 行为

## 不在范围 (告诉 reviewer 不用查)

- {示例: 不需测网络异常 / 不依赖外部 API key / 不验证 source_url 上游 skill 自身代码质量}

## 风险点 (所有 variant 必填, 无则 N/A; **不**允许整段删除)

- 本地校验 vs 公司库规范冲突: {N/A 或具体描述, eg "本地源码 frontmatter 保留 metadata 嵌套以通过 Codex quick_validate; 公司库副本展开为顶层 version/author/updated_at/origin 以符合 own-skill 规范"}
{variant: own}
- 该 skill 是否会 git push / 改本地状态 / 调外部 API: {N/A 或描述}
{variant: external}
- source_url 上游 skill 的稳定性 (vaporware / 长期不维护 / license 不明): {N/A 或描述}
{variant: case}
- {N/A 或描述, case-only PR 一般 N/A}
