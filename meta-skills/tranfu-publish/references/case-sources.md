# Case PROMPT.md 来源 + output 收集

`cases/<n>/input/PROMPT.md` 是真实用户口吻的 prompt 示例, router 用类似 prompt 做检索测试. AI 不准凭空编 — 必须有来源.

## 来源优先级 (HARD)

按顺序找, 第一条命中即用:

1. **当前对话历史**有触发该 skill 的用户真实 prompt → 直接落 PROMPT.md, 1-3 句即可
2. **$SRC / 公司库 skill 自带 `examples/` `references/`** → 提里面真实场景, 改回真实用户口吻 (不要照搬 doc 体)
3. **$SRC 有 legacy `cases/<author>.md`** (own 路径独有) → 提"怎么发现的 / 它做了什么"段落里的 prompt 信号 → 落 `cases/1/input/PROMPT.md`, 旧 file 删掉. commit message 注明 `migrate legacy case <author>.md → cases/1/input/PROMPT.md`
4. **全 miss → AskUserQuestion form 问用户** (见下方"form 文案")

没来源 AI 自己编 prompt 装作用户口吻 = 违规, 会污染 router 检索测试集.

## form 文案 (走 AskUserQuestion, 不要 [1][2][3] 文字)

```
question: 给 <skill-name> 加 case 需要一个真实用户 prompt — 我在对话历史 / $SRC 里没找到, 请提供:
header: case PROMPT.md 来源
options:
  - [一句话]              我直接在 Other 里写 1-3 句真实 prompt
  - [贴一个 md 路径]      我给本地 md 文件路径, 你读内容 + 同目录附件全收
  - [跳过, 用 placeholder] 仅 own 首发兜底, 留 TODO 给我后补  (case 路径不出现这项)
```

各选项处理:

- `[一句话]` → 用户在 Other 自由文字写 prompt → 直接落 PROMPT.md
- `[贴一个 md 路径]` → AI 读 md 完整内容当 PROMPT.md, **同目录附件** (`.png` `.jpg` `.json` `.txt` `.csv`) 自动 `cp` 到 `cases/<n>/input/`. PROMPT.md 里改用 `![](./xxx.png)` 引用
- `[跳过, 用 placeholder]` → 仅 own 首发兜底, 写 `<TODO: 作者补一个真实使用 prompt>` 进 PROMPT.md + PR body 风险点段标红. **case 路径不出现这项** — case 本身就是来加 case 的, 没 prompt 就不该开 PR

## PROMPT.md 写法约束

- 纯文本, 不带 frontmatter
- 1-3 句, 真实用户口吻
- 不写 AI 体: "请基于 X 帮我生成 Y, 满足条件 1/2/3" = 错; "帮我设计一下订单详情页, 要高保真的那种" = 对
- 必须含触发该 skill 的关键词
- 支撑材料放同级, `![](./xxx.png)` 引用

## output/ 收集 (推荐有, 验证暂停)

`cases/<n>/output/` 放该 skill 跑出来的产物. 来源优先级同 input:

1. 对话历史里有该 skill 的产物 (文本 / 文件路径) → `cp` 进 `output/`, 或 dump 文本到 `output/result.md`
2. $SRC 有 `examples/` 跑过的产物 → 复用
3. 全 miss → output/ 不建, PR body 风险点段标"output 缺, 未来补"

约束:

- 多文件输出全收, 保留原名 (e.g. `result.png` + `meta.json` + `summary.md`)
- 不建空 `output/` 目录 (validator 暂时跳过, 未来 cases.missing-output 一旦开启会挡)
- 大二进制 (>1MB png/pdf) 提醒用户检查仓库大小阈值, git lfs 不在本 skill 范围

## n 取值

- own 首发: `1`
- case 路径: 已有最大数字 +1 (e.g. 现有 `1/`, n=2). 也接受填空缺号 (e.g. 现有 `1/` `3/`, n=2 合法)
- 不要 leading zero (`01/` `02/` 会挂 cases.leading-zero)
