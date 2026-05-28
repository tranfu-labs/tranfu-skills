<!--
cases/<n>/input/PROMPT.md 模板. 落点:
  - own:      own-skills/{name}/cases/{n}/input/PROMPT.md
  - external: external-skills/{name}/cases/{n}/input/PROMPT.md
  - case 路径: 给已在公司库的 skill 加一个新的 prompt 示例, n = 下一个未占的整数

新 cases 格式 (2026-05 后, validate-cases.mjs 强制):
  cases/
    1/                 ← 必须纯数字, 不允许 leading zero (01/, 02/...) — cases.leading-zero
    1/input/           ← 必须存在, 非空 — cases.missing-input
    1/input/PROMPT.md  ← 必须存在 — cases.missing-prompt-md
    1/input/<aux>      ← 选填, 配合 PROMPT.md 的截图 / 上下文文件
    1/output/          ← 推荐有 (放 skill 跑出来的产物), 验证暂停 (TODO)
    2/, 3/, ...        ← 多 case 顺序无要求, gap 允许 (cases.gaps 测试已确认 1/3/7 合法)
    README.md          ← 选填, ignore by validator
  cases/<author>.md    ← 旧格式, 现在是 ERROR (cases.legacy-single-file). 不要再写

PROMPT.md 写法:
  - 纯文本, 不带 frontmatter. 内容是"一个真实用户怎么 prompt 这个 skill"
  - 推荐 1-3 句, 贴近真实用户口吻 (不写 AI 体: 别"请基于 X 帮我生成 Y, 满足条件 1/2/3")
  - 触发该 skill 的关键词要在里面 (router 用类似 prompt 做检索测试)
  - 支撑材料 (e.g. 设计参考截图 / 输入数据) 放 cases/<n>/input/ 同级, PROMPT.md 里 ![](path) 引用即可

来源优先级 (AI 按顺序找, 第一条命中即用, 全 miss 才 AskUserQuestion 问用户):
  1. 当前对话历史里有用户真实 prompt
  2. $SRC / 公司库 skill 自带 examples/ references/
  3. $SRC 有 legacy cases/<author>.md (own 独有, 提里面信号 + 删 legacy)
  4. 全 miss → form 问用户:
     - [一句话]       Other 自由文字直接写 1-3 句
     - [贴一个 md 路径] AI 读 md 内容 + 同目录附件 (.png/.jpg/.json/.txt/.csv) 全 cp 到 input/
     - [跳过, 用 placeholder] 仅 own 首发兜底, 写 `<TODO: ...>` + PR body 风险点标红
                       case 路径不出现这项

NEVER 在没来源情况下 AI 自己编 prompt 装作用户口吻 — 污染 router 检索测试集.

output/ 落点说明 (cases/<n>/output/):
  - 来源优先级同上 (对话历史里该 skill 的产物 → cp / dump 到 output/)
  - 多文件全收, 保留原名 (e.g. result.png + meta.json + summary.md)
  - 没法收齐就不建 output/ (validator 暂不强制, 但建空目录会被未来开启的 cases.missing-output 挡)
  - 大二进制 (>1MB png/pdf) 走 git lfs 提醒, 不在本 skill 范围

旧 recommender / reason_kind / scenario_tag / source_session_summary 概念已 EOL.
推荐者归属信息走 commit message + PR body, 不再写进 case 文件.
-->

{一句到三句, 真实用户口吻, 含触发该 skill 的关键词}

{若需要支撑材料, e.g.}
![参考截图](./reference.png)
