# Hard rules (完整版)

SKILL.md 顶层只列最关键的 5 条 (git 安全 / 用户确认 / CI 必过). 这里是完整清单 + 背后原因. 写新 case 路径分支 / 改流程 时回头查这份.

## git / 发布安全

- ❌ **不直推 main** — 一定走 `skill/<name>` 或 `skill/batch-<timestamp>` 分支. `main` 受 branch protection
- ❌ **永远不 force push** — 即使本地分支搞乱了, 也 `reset` 出新分支重 push
- ❌ **不删现有 skill** — publish 只加不删. 删除 skill 走另外的 PR + 人工 review
- ❌ **不跨仓 PR** — 只发到 `tranfu-labs/tranfu-skills`
- ❌ **不要手动 add / commit `index.json`** — CI (build-index.yml) 处理, 手动加进来会冲突
- ❌ **`gh` 失败 → 报错, 不重试** — auth / network 问题应该让用户介入, 不是 retry loop

## 用户确认门禁

- ❌ **跳 §0 版本预检 = 违规** — 必须 `tfs update --check-only --json` 检测 + 升级后中止本轮让用户重 trigger. AI 边升级边继续 = 旧版逻辑在跑
- ❌ **§0 没建 TaskCreate 任务列就开始干活 = 违规** — 用户从头看不到进度
- ❌ **不静默走 `gh pr create`** — 用户必须从 §7 form 拍 `[发布]`
- ❌ **不动公司库任何文件 until §8 [发布]** — §1-7 全部是起草, 不写盘
- ❌ **§7 用 [1][2][3] 文字而非 AskUserQuestion form = 违规** — 用户拍按钮才是显式确认
- ❌ **PR body 留"用户要勾"的项 = 违规** — 自检清单全 AI 判, 用户不是 QA

## 内容质量 / 触发集污染

- ❌ **没来源 AI 自己编 prompt 装用户口吻 = 违规** — `references/case-sources.md` §4 来源全 miss 时必须 AskUserQuestion. 编出来的 prompt 会污染 router 检索测试
- ❌ **case PROMPT.md 写 AI 体 / 加 frontmatter = 违规** — 必须纯文本真实用户口吻, 不带 frontmatter
- ❌ **case 路径用 placeholder 兜底 = 违规** — placeholder 仅 own 首发可用 (作者后补), case 本身就是来加 case 的
- ❌ **多 skill URL 让用户选哪个发 = 违规** — 自动全收, 一个 PR 多 commit

## 落点 / 模板纪律

- ❌ **§同类对比 / §使用技巧 落 SKILL.md = 违规** — 必须落 README.md. README 给人看, SKILL.md 给 LLM 看, 不同读者
- ❌ **own 路径 $SRC 没 README.md 不自动起草** — 报错让作者先写. README 是给人看的入口, 必须作者亲自定调
- ❌ **own 路径不带 cases/1/input/PROMPT.md = 违规** — own 必须至少一个 case
- ❌ **external 路径强制 case = 违规** — external 不需要 case
- ❌ **必须按 `templates/` 渲染** — 不允许换成 `## Summary / ## Validation / ## Rollback` 这种 GitHub 通用习惯写法. 本仓库 lark 通知 + lint workflow 按模板段名读, 换名 = 静默失效

## CI 校验对齐

- ❌ **写 legacy `cases/<recommender>.md` 单文件 = 违规** — CI `validate-cases.mjs` `cases.legacy-single-file` ERROR
- ❌ **数字目录用 leading zero (`cases/01/`) = 违规** — CI `cases.leading-zero` ERROR
- ❌ **SKILL.md frontmatter 缺 6 字段中任一 = 违规** — CI `validate-frontmatter` ERROR
- ❌ **`description > 1024 字符 = 违规** — CI `frontmatter.description-too-long` ERROR
- ❌ **external 没 version = 违规** — CI 强制必填, 没上游版本就 fallback `1.0.0`
- ❌ **skill 代码引 `eval / Function / child_process / curl|sh` 不加豁免 = 违规** — `validate-security.mjs` ERROR. 需要 exec 加 `allow_exec: true`; curl|sh 加 `allow_curl_pipe_sh: true`. 加豁免前先想想能不能换 explicit download + checksum

## 边界

- ❌ **不接 router 范围意图** — search / install / list / installed / update / uninstall / doctor 全留给 `tranfu-router`
