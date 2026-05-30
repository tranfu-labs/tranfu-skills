# tranfu-publish

把本地写的 skill / 推荐的外部 skill / 已入库 skill 的新案例发到 `tranfu-labs/tranfu-skills` 走 PR.

核心变化: 本 skill 现在区分 validator hard gate 和 catalog surface. README、同类对比、使用技巧、`source_url` 验活、case output 都不再阻塞发布; 但 `build:index` 会把已有 README / cases / output 文件和 external `source_url` 写进 catalog。

![框架图](./framework.png)

## 什么时候用它

三类触发, 对应三条路径:

| 路径 | 触发语示例 | Validator hard gate | Catalog surface / 非阻塞建议 |
|---|---|---|---|
| **own** | "把本地 X 发到公司库" / "publish X" | `SKILL.md` frontmatter 6 字段 + description 长度; 如有 `cases/` 则 case 格式合法; 安全扫描过 | README / cases / output 存在就会进 catalog `files`; README 内容自由, 不硬凑固定段落 |
| **external** | "把这个 skill 推到公司库" / "推荐 https://..." | 薄 `SKILL.md` frontmatter 过 validator; 如有脚本则安全扫描过 | `source_url` 写了会进 catalog 字段; README / cases / output 存在就会进 catalog `files`; HTTP 验活是质量建议 |
| **case** | "给公司库 X 加个案例 / 补一个用法" | 新增 `cases/<n>/input/PROMPT.md`; `n` 纯数字无 leading zero; 目标 `cases/` 无 legacy/异常项 | 新 case 会进 catalog `files`; 真实用户口吻、附件、output 是质量建议 |

Validator 不要求 README.md 存在, 也不检查 README section. own 路径源缺 README 时继续发布, 但要说明 catalog 里不会出现 README 文件。

## CI Gate

当前 CI 来自 `.github/workflows/build-index.yml`:

- `npm test`
- `npm run validate` (PR changed-only; main push all)
- `npm run validate:vt` (PR changed-only; 多数失败是 warning, `malicious >= 3` 才拦)
- `npm run build:index` (递归写入 `files`, 所以已有 README / cases / output 会显示在 catalog)

对单个 skill 的内容 gate 以 validator 代码为准:

- `validate-frontmatter`: `name`, `description`, `version`, `author`, `updated_at`, `origin` 非空; `description <= 1024`.
- `validate-cases`: 只有存在 `cases/` 时检查; legacy `cases/*.md`、leading zero、缺 `input/PROMPT.md` 会挂.
- `validate-security`: `.mjs/.js/.ts/.sh/.py` 内的 `eval`, `Function`, 未豁免 `child_process`, 未豁免 `curl|sh` 会挂.

## 怎么用

跟 Claude / Codex 说:

- "把我本地这个 `xxx` skill 发到公司库"
- "我看到一个不错的 skill (https://github.com/foo/bar-skill), 推荐给公司库"
- "给公司库的 superpowers 加个我的使用案例"

## 你会看到什么

1. AI 识别 path, 定位 `$REPO` 和 `$SRC`.
2. AI 生成最小可过 validator 的 `SKILL.md` / case 变更, 并把 README/source_url/cases/output 的 catalog 暴露情况列清楚.
3. AI 写完整预览到 `/tmp/tranfu-publish-preview-*.md`, chat 给摘要.
4. 用户确认 `[发布]` 后, 才切分支、写文件、commit、push、`gh pr create`.
5. 输出 PR URL.

## 不会做

- 不直推 `main`.
- 不 force push.
- 不手动 add / commit `index.json`.
- 不因 README 缺失、README section 缺失、`source_url` 验活失败、output 缺失而阻塞发布; 但会说明它们是否进入 catalog.
- 不写旧格式 `cases/<recommender>.md`.
- 不接 search / install / list / update / uninstall / doctor 意图; 这些走 `tranfu-router`.

## 保留的轻量骨架

| 文件 | 用途 | 阻塞性 |
|---|---|---|
| `templates/pr-body.md` | PR body 参考骨架, 分开 validator / catalog / 质量说明 | 推荐使用, 不强制套格式 |
| `templates/case-prompt.md` | 新增 `cases/<n>/input/PROMPT.md` 时的路径和内容提示 | case 路径参考 |

README section 模板已移除. README 不是发布 gate, 也不需要为了 catalog 硬凑固定段落.

## 依赖

- 公司库 push 权限 + 本地 clone 在 `$REPO`.
- `gh` CLI 已 auth.
- `git`, `node`.
- `WebFetch` / `WebSearch` 只在需要补外部说明或验活时使用; 不是 validator hard gate.

## 配套 skill

- `tranfu-router` — 搜 / 装 / 列 / 升 / 卸 公司库 skill.
- `tfs` CLI — 可查公司库现有 skill, 也可辅助 README 对比; 不属于 CI gate.

## 参考

- `SKILL.md` — 完整三路径步骤.
- `references/ci-checks.md` — 当前 CI validator 细则.
- `references/hard-rules.md` — hard gate、catalog surface 与质量建议边界.
- `templates/` — PR body 参考骨架 / case prompt 提示.
