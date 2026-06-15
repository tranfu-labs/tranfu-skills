<!--
tranfu-publish PR body 模板 —— 就把发布的 skill 信息 1:1 贴出来, 没人逐字读, 够查即可。
多 skill 一 PR: 整段重复 N 次。{...} 占位符替换。按 variant 取舍表格行 (无值的行删掉)。
飞书卡片支持表格 / 代码块, 放心用。
-->

## {name}

| 字段 | 值 |
|---|---|
| path | {own-skills/{name}/ \| external-skills/{name}/ \| <own\|external>-skills/{name}/cases/{recommender}.md} |
| origin | {own \| external \| case} |
| version | {version, external 上游有则填} |
| author / recommender | {handle} |
| source_url | {url, 仅 external} |
| 包含 | {SKILL.md, README.md[, cases/] \| 仅 cases/{recommender}.md} |

> {SKILL.md frontmatter 的 description 原文}
