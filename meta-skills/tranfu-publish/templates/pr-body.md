<!--
tranfu-publish PR body 模板, 3 路径共用 (own / external / case).
AI 按下方 {variant: own | external | case} 标记挑相应 block 填.
{...} 是占位符, 真写 PR 时替换.

多 skill 一 PR: §元信息 / §Motivation / §自检清单 重复 N 次, 每段顶部加 `### skill: <name>`.

NEVER 把模板段换成 GitHub 通用习惯写法 (## Summary / ## Validation / ## Test plan / ## Rollback).
PR body 不是 CI gate; 这个模板用于稳定 review/Lark 展示, gate 以 scripts/validate-* 为准.

NEVER 给 PR body 加 `## Test plan` 段 — 用户不是 QA, 自检清单已含 AI 能判定的项.

NEVER 在 PR body 重复 README 的 §同类对比 / §使用技巧 内容 — reviewer 点 README 看权威源, PR body 不二次维护.

自检清单对齐 validate-frontmatter.mjs / validate-cases.mjs / validate-security.mjs:
  - frontmatter: name / description / version / author / updated_at / origin 必填非空;
    description ≤ 1024. 当前 CI 不检查 semver/date/source_url/name-dir/origin-root.
  - cases 新格式: cases/<n>/input/PROMPT.md (旧 cases/<recommender>.md 现在是 ERROR)
  - security: 无 eval / Function / child_process / curl|sh (除非 frontmatter 加 allow_*)
-->

## 元信息

- skill: {name}
- path: {own-skills/{name}/ | external-skills/{name}/ | <own|external>-skills/{name}/cases/{n}/}
{variant: own}
- version: {new} (此次: {bump_desc, e.g. "first publish" 或 "0.1.0 → 0.1.1 (patch)"})
- origin: own
- author: {handle}
- 包含: SKILL.md + README.md + cases/1/input/PROMPT.md (+ 选填 cases/1/output/)
{variant: external}
- origin: external
- source_url: {url}
- recommender (走 commit message / PR 作者归属, 不进文件): {handle}
- 包含: SKILL.md (薄指针, frontmatter 含 version) + README.md
{variant: case}
- 新增 case 编号: {n} (下一个未占的整数)
- 新增: <own|external>-skills/{name}/cases/{n}/input/PROMPT.md (+ 选填 output/)

## Motivation

{1-3 句: 为什么加这个 / 业务背景 / 触发推荐的具体场景}

## 自检清单 (AI 据实勾, 不留给用户)

<!--
规则:
  - AI 实际检查后, 达成 → `- [x]`
  - 实际没达成 → 老实留 `- [ ]`, 让 reviewer 看到. NEVER 偷偷勾上
  - 真不适用 (e.g. case-only PR 不动 SKILL.md) → `- [~] N/A — 一句原因`
  - 不允许整段删自检清单, 也不允许把项删掉装作没出现

跑完整流程到 §6 时, own/external 必备产物已在 §0 预检 + §5 起草阶段 ensure, 大多数项应是 `- [x]`.
出现 `- [ ]` 是合法信号: 告诉 reviewer "AI 跑下来发现这项卡住了, 请你来定夺".

对齐 CI 校验:
  - validate-frontmatter — 6 字段必填非空 + description ≤ 1024 字符
  - validate-cases — 新格式 cases/<n>/input/PROMPT.md, 不能有 legacy *.md, 不能有 leading zero (01/)
  - validate-security — 不引 eval / Function / child_process / curl|sh (允许时加 allow_* frontmatter)
-->

{variant: own}
- [ ] README.md 存在 (作者本人写, AI 未起草)
- [ ] README.md 有 `## 同类 Skill 对比` 段
- [ ] README.md 有 `## 使用技巧` 段
- [ ] SKILL.md frontmatter 通过 CI gate (name / description / version / author / updated_at / origin 六项非空; description ≤ 1024 字符)
- [ ] cases/1/input/PROMPT.md 存在, 真实用户口吻含触发关键词 (不是 cases/{author}.md 老格式)
- [ ] cases/ 下无 legacy *.md (cases.legacy-single-file), 数字目录无 leading zero (01/ → 1/)
- [ ] 无 eval / Function / child_process / curl|sh, 或已在 SKILL.md frontmatter 加 allow_* flag
{variant: external}
- [ ] SKILL.md frontmatter 通过 CI gate (name / description / version / author / updated_at / origin 六项非空; description ≤ 1024 字符)
- [ ] SKILL.md 薄指针 + source_url 已填并在起草阶段 WebFetch 验过 (publish 约定, 当前 CI 不检查)
- [ ] README.md 存在 (薄推荐, AI 起草)
- [ ] README.md 有 `## 同类 Skill 对比` + `## 使用技巧` 段
{variant: case}
- [ ] 不动目标 skill 的 SKILL.md / README.md (本 PR 只动 cases/)
- [ ] 新 case 编号是下一个未占整数, 无 leading zero
- [ ] cases/<n>/input/PROMPT.md 存在, 内容真实用户口吻

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
