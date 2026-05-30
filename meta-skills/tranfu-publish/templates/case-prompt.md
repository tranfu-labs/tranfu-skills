<!--
cases/<n>/input/PROMPT.md 模板.

CI 真实要求:
- 路径是 cases/<n>/input/PROMPT.md
- <n> 是无 leading zero 的正整数
- input/ 非空
- 不使用 legacy cases/<author>.md

CI 不检查:
- prompt 是否真实用户口吻
- prompt 是否 1-3 句
- prompt 是否含触发关键词
- prompt 是否有 frontmatter

Catalog:
- build:index 会把本文件路径写进 index.json skills[].files.
- output/ 和附件存在时也会被列进 files; 缺失不阻塞, 但 catalog 看不到.

写法建议:
- 优先使用真实用户 prompt.
- 没有来源时问用户; 用户确认继续时可写 TODO placeholder, 并在 PR body 标风险.
- 支撑材料放同级 input/ 下, PROMPT.md 用相对路径引用.
-->

{一句到三句 prompt, 或 `<TODO: 补一个真实使用 prompt>`.
建议写真实用户口吻; 但这不是 validator hard gate.}

{若需要支撑材料, e.g.}
![参考截图](./reference.png)
