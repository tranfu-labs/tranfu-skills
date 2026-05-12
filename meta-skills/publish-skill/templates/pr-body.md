<!--
publish-skill PR body 模板, 4 路径共用.
AI 按下方 {variant: own | external | add-case} 标记挑相应 block 填.
external 下还要选 {entry: B (in-context) | C (cold-start)}.
{...} 是占位符, 真写 PR 时替换.
-->

## 元信息

- skill: {name}
- path: {path}
{variant: own}
- version: {new} (此次: {bump_desc, e.g. "first publish" 或 "0.1.0 → 0.1.1 (patch)"})
- origin: own
- author (frontmatter): {handle}
{variant: external}
- origin: external
- source_url: {url}
- recommender: {handle}
- 推荐入口: {entry: in-context (B) | cold-start (C)}
{variant: add-case}
- 类型: {append-scenario | overwrite | new-recommender}
- 新增 / 修改: external-skills/{name}/cases/{recommender}.md

{if variant in (external, add-case)}
## 推荐理由摘要

reason_kind: {enum}
{一句话从 case body 摘录}

{if variant == external}
## 案例文件

- external-skills/{name}/cases/{recommender}.md ({scenarios_count} 个场景)
- _assets/: {image_count} 张图

## 自检清单 (作者勾)

{variant: own}
- [ ] frontmatter 5 必填齐全: name / description / version / author / updated_at
- [ ] description ≤ 100 字, 包含触发场景
- [ ] origin: own (本 PR 不应出现 source_url)
- [ ] README.md 存在且含 4 段: 介绍 / 什么时候用 / 触发示例 ≥3 / 期望输出
- [ ] SKILL.md 含 When to use / Steps / What NOT to do
- [ ] 触发语写法是用户视角 (不是 "调用此 skill 当...", 而是 "用户说 ...")
- [ ] 本地 dogfood: 至少跑过 1 次完整流程
- [ ] 不在子目录嵌套其他 skill, 不引入需要额外手动安装的二进制
{variant: external}
- [ ] SKILL.md 是薄指针, body 含 "完整内容见 source_url"
- [ ] frontmatter origin: external + source_url 有效
- [ ] case 文件 frontmatter 三必填齐: recommender / recommended_at / reason_kind
- [ ] case body 不空话, 有具体场景描述
- [ ] 图 (如有) ≤ 1MB
- [ ] source_url 可访问, 指向真实 skill (不是 vaporware)
{variant: add-case}
- [ ] 不改 external-skills/{name}/SKILL.md (本 PR 只动 cases/)
- [ ] case 文件 frontmatter 三必填齐
- [ ] 图 (如有) ≤ 1MB

## 不在范围 (告诉 reviewer 不用查)

- {示例: 不需要测网络异常 / 不依赖 API key / 不验证 source_url 上游 skill 自身代码质量}

{variant: own}
## 风险点 (有则填, 无则 N/A)

- {示例: 这个 skill 会 git push, reviewer 注意目标分支}
