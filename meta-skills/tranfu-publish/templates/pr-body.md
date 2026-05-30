<!--
tranfu-publish PR body 参考骨架, 3 路径共用 (own / external / case).

原则:
- 自检清单只列 validator hard gate.
- README / cases / output / source_url 的 catalog 暴露情况单独说明.
- prompt 文案质量、HTTP 验活、上游维护状态放到"风险点", 不放进阻塞清单.
- `{...}` 是占位符, 真写 PR 时替换.

多 skill 一 PR: 可以对每个 skill 重复 "### skill: <name>" + 下方元信息 / 自检 / catalog surface / 质量说明.

不用硬套本文件的全部 section; 只要 reviewer 能看清 validator hard gate、catalog surface 和风险点即可.
-->

## 元信息

- skill: {name}
- path: {own-skills/{name}/ | external-skills/{name}/ | <own|external>-skills/{name}/cases/{n}/}
{variant: own}
- origin: own
- version: {new}
- 本 PR 写入: SKILL.md{optional_files, e.g. " + README.md + cases/1/input/PROMPT.md"}
{variant: external}
- origin: external
- version: {new}
- source_url: {url or "N/A — validator 不要求; 缺失则 catalog 无 source_url 字段"}
- 本 PR 写入: SKILL.md{optional_files, e.g. " + README.md"}
{variant: case}
- 新增 case 编号: {n}
- 本 PR 写入: <own|external>-skills/{name}/cases/{n}/input/PROMPT.md{optional_files}

## Motivation

{1-3 句: 为什么加这个 / 背景 / 用户触发场景}

## CI 自检清单 (AI 据实勾)

<!--
勾选规则:
- 达成: [x]
- 没达成: [ ]
- 不适用: [~] N/A — 一句原因

只列 CI hard gate:
- validate-frontmatter: 6 字段非空 + description ≤ 1024
- validate-cases: 如果存在 cases/, 只能有数字目录/README.md/legacy *.md; legacy 是 ERROR; 数字目录无 leading zero; input/PROMPT.md 存在
- validate-security: eval / Function / child_process / curl|sh
- validate:vt: malicious >= 3 才阻塞; 本地无 key通常只能标 N/A
-->

{variant: own}
- [ ] SKILL.md frontmatter 6 字段非空 (name / description / version / author / updated_at / origin)
- [ ] description ≤ 1024 字符
- [ ] 如有 cases/: 无 legacy `cases/*.md`, 无 leading zero, 每个数字 case 有 `input/PROMPT.md`
- [ ] 安全扫描范围内无 `eval` / `Function` / 未豁免 `child_process` / 未豁免 `curl|sh`
- [ ] 本地已跑 `npm run validate -- --target own-skills/{name} --json`
{variant: external}
- [ ] SKILL.md frontmatter 6 字段非空 (name / description / version / author / updated_at / origin)
- [ ] description ≤ 1024 字符
- [ ] 如有 cases/: 无 legacy `cases/*.md`, 无 leading zero, 每个数字 case 有 `input/PROMPT.md`
- [ ] 安全扫描范围内无 `eval` / `Function` / 未豁免 `child_process` / 未豁免 `curl|sh`
- [ ] 本地已跑 `npm run validate -- --target external-skills/{name} --json`
{variant: case}
- [ ] 新 case 路径是 `cases/{n}/input/PROMPT.md`
- [ ] case 编号 `{n}` 是正整数且无 leading zero
- [ ] 目标 skill 的 `cases/` 下无 legacy `*.md` 或异常条目
- [ ] 本地已跑 `npm run validate -- --target <own|external>-skills/{name} --json`
- [~] N/A — 本 PR 不改 SKILL.md frontmatter / 代码脚本

## Catalog surface

<!--
build:index 会把已有文件写进 index.json skills[].files; external source_url 写了才进 catalog 字段.
这些不是 validator blocker, 但影响 catalog 展示/分发.
-->

- README.md: {会进入 catalog files / 缺失, catalog 不展示 / 未改}
- cases/: {会进入 catalog files, 列关键路径 / 缺失, catalog 不展示 case / N/A}
- output/: {会进入 catalog files / 缺失, catalog 不展示 output / N/A}
- source_url: {会进入 catalog 字段 / 缺失, catalog 无 source_url / N/A}

## 质量说明

- HTTP 验活: {通过 / 失败 / 未跑 / N/A}
- README 质量说明: {已有自然说明 / 缺失 / 未改 / N/A}
- PROMPT.md 文案质量: {真实来源 / 用户提供 / TODO placeholder / N/A}
- VirusTotal: {本地未跑 / CI 有 secret 后跑 / N/A}

## 风险点

{没有则写 N/A. 有缺 README、source_url 未验活、placeholder prompt、上游维护不明、allow_* 豁免等, 都写在这里.}
