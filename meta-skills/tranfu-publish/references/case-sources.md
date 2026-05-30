# Case PROMPT.md 来源 + output 收集

`cases/<n>/input/PROMPT.md` 用来给 router 和 reviewer 看使用场景. 当前 CI 只检查路径和文件存在, 不检查 prompt 文案质量.

## CI 真实要求

当创建或保留 `cases/<n>/` 时:

- `n` 必须是无 leading zero 的正整数.
- `cases/<n>/input/` 必须存在且非空.
- `cases/<n>/input/PROMPT.md` 必须存在.
- 不能写 legacy `cases/<author>.md`.

## 来源优先级 (质量建议)

按顺序找, 第一条命中即用:

1. 当前对话历史有触发该 skill 的用户真实 prompt.
2. `$SRC` / 公司库 skill 自带 `examples/`、`references/`、README 中有真实场景.
3. `$SRC` 有 legacy `cases/<author>.md` (own 路径独有): 提取可用 prompt 信号, 并迁移掉 legacy 文件.
4. 全 miss: 问用户一次; 如果用户要求继续, 写透明 TODO placeholder, 不伪装成真实用户.

推荐 prompt 是 1-3 句、真实用户口吻、含触发关键词. 这不是 CI blocker.

## 问用户时的文案

如果没找到来源, 用 form 或普通提问均可:

```text
给 <skill-name> 加 case 需要一个 prompt. 我没在对话历史 / 源目录里找到真实来源。
你可以给一句真实 prompt、给一个本地 md 路径, 或确认用 TODO placeholder 先过 CI。
```

处理:

- 用户给一句话: 直接写入 `PROMPT.md`.
- 用户给 md 路径: 读完整 md 当 `PROMPT.md`; 同目录附件 (`.png`, `.jpg`, `.json`, `.txt`, `.csv`) 可复制到 `input/`.
- 用户确认 placeholder: 写 `<TODO: 补一个真实使用 prompt>`; PR body 标风险.
- 用户不确认且没有来源: case 路径中止, 因为用户目标本身无法完成.

## output/ 收集

`cases/<n>/output/` 当前不是 CI gate.

有产物时建议收:

1. 对话历史里有该 skill 的产物: 复制文件或写 `output/result.md`.
2. `$SRC` 有 examples 产物: 复用.
3. 全 miss: 不建 `output/`, 在 PR body 标注缺失.

约束建议:

- 多文件输出全收, 保留原名.
- 不建空 `output/`.
- 大二进制 (>1MB png/pdf) 提醒 reviewer 注意仓库体积; git lfs 不在本 skill 范围.

## n 取值

- 新 skill 首个 case: 通常 `1`.
- 加 case: 已有最大数字 + 1, 或使用空缺号.
- 不要 leading zero (`01/` / `02/` 会挂 CI).
