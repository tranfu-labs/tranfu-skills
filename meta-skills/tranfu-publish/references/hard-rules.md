# Hard Rules

本 skill 的 hard rule 只分两类: 发布安全门禁、当前 CI hard gate. CI 不检查的内容只能作为建议或风险说明, 不能阻塞发布.

## 发布安全门禁

- 不直推 `main`; 一定走新分支.
- 不 force push.
- 不删现有 skill. 删除 skill 需要单独 PR + 人工 review.
- 不跨仓 PR; 只发到 `tranfu-labs/tranfu-skills`.
- 不手动 add / commit `index.json`; CI 处理.
- 用户确认前不写公司库文件、不 push、不开 PR.
- `gh` 失败就报错; 不做 retry loop.

## CI hard gate

只按 validator 真实规则判断:

- `SKILL.md` frontmatter 有 `name`, `description`, `version`, `author`, `updated_at`, `origin` 六项且非空.
- `description <= 1024`.
- 如果存在 `cases/`: 不写 legacy `cases/<author>.md`; 数字目录不能 leading zero; 每个数字目录必须有非空 `input/` 和 `input/PROMPT.md`; `cases/` 下不能有异常条目.
- `.mjs/.js/.ts/.sh/.py` 里不能出现 `eval` / `Function`.
- 引入 `child_process` 必须加 `allow_exec: true`.
- `curl|sh` / `wget|sh` 必须加 `allow_curl_pipe_sh: true`.
- VirusTotal 只有 `malicious >= 3` 是 blocker; 无 key / 限流 / 网络错误是 warning.

## 非 CI 项不能阻塞

下面这些可以补, 但不能作为"不满足就中止"的条件:

- README.md 缺失.
- README 缺 `## 同类 Skill 对比`.
- README 缺 `## 使用技巧`.
- `source_url` 缺失.
- `source_url` HTTP 验活失败.
- external 上游 license / 维护状态未查清.
- `PROMPT.md` 不是 1-3 句、不是用户口吻、没有触发关键词.
- `cases/<n>/output/` 缺失.
- PR body section 名不完全匹配模板.
- 没跑 `tfs update --check-only`.

处理方式: 在预览和 PR body 的"非 CI 说明 / 风险点"写清楚, 由 reviewer 决定.

## 内容建议

这些建议有助于检索和 review, 但不是 CI gate:

- README 给人看, SKILL.md 给 LLM 看; 不要把 README 辅助段落塞进 SKILL.md.
- 有真实 case prompt 就优先用真实来源; 没有来源时不要伪装成真实用户, 可以写透明 TODO 并标风险.
- `source_url` 能写就写; HTTP 验活能跑就跑.
- `output/` 有代表性产物就收, 没有就不建空目录.
- PR body 优先使用 `templates/pr-body.md`, 但自检清单只列 CI hard gate.

## 边界

- 多 skill URL / 路径默认全收; 用户明确缩小范围时再收窄.
- 不接 router 范围意图: search / install / list / installed / update / uninstall / doctor 留给 `tranfu-router`.
