# tranfu-publish

把本地写的 skill、推荐的外部 skill、或已入库 skill 的新案例发到 `tranfu-labs/tranfu-skills`，全程走 PR。

![框架图](./framework.png)

## 什么时候用它

| 路径 | 触发语示例 | 做什么 |
|---|---|---|
| **own** | "把本地 X 发到公司库" / "publish X" | 把本地 skill 放到 `own-skills/<name>/` |
| **external** | "把这个 skill 推到公司库" / "推荐 https://..." | 给外部 skill 建一个薄入口 |
| **case** | "给公司库 X 加个案例 / 补一个用法" | 给已有 skill 新增 `cases/<n>/input/PROMPT.md` |

## 你会看到什么

1. AI 识别路径，定位公司库和来源。
2. AI 准备最小可发布内容，并在预览里标清本次会写哪些文件。
3. AI 写完整预览到 `/tmp/tranfu-publish-preview-*.md`，chat 给摘要。
4. 你确认 `[发布]` 后，才切分支、写文件、commit、push、开 PR。
5. 输出 PR URL。

## 不会做

- 不直推 `main`。
- 不 force push。
- 不手动提交 `index.json`。
- 不为了旧模板硬补 README 段落。
- 不写旧格式 `cases/<recommender>.md`。
- 不接 search / install / list / update / uninstall / doctor；这些走 `tranfu-router`。

## 保留的轻量骨架

| 文件 | 用途 |
|---|---|
| `templates/pr-body.md` | PR body 参考骨架，分开校验、自检和风险说明 |
| `templates/case-prompt.md` | 新增 case 时的路径和内容提示 |

## 依赖

- 公司库 push 权限 + 本地 clone 在 `$REPO`。
- `gh` CLI 已 auth。
- `git`, `node`。
- `WebFetch` / `WebSearch` 只在需要补外部说明或验活时使用。

## 参考

- `SKILL.md` — 完整发布流程。
- `references/ci-checks.md` — 当前仓库校验细则。
- `references/hard-rules.md` — 发布安全门禁与质量边界。
