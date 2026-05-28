# tranfu-publish

把本地写的 skill / 推荐的外部 skill / 案例发到公司库 `tranfu-labs/tranfu-skills` 走 PR. AI 起草, 用户审完拍 `y` 才提交.

![框架图](./framework.png)

## 什么时候用它

三类触发, 对应三条内部路径 (AI 自动判, 信号不清才问 `AskUserQuestion` form):

| 路径 | 触发语示例 | 适用 | 必备产物 |
|---|---|---|---|
| **own** | "把本地 X 发到公司库" / "publish X" | 自己写的 skill | SKILL.md + README.md + cases/1/input/PROMPT.md |
| **external** | "把这个 skill 推到公司库" / "推荐 https://..." | 外部 skill | SKILL.md (薄指针, frontmatter 含 version) + README.md |
| **case** | "给公司库 X 加个案例 / 补一个用法" | 已在公司库的 skill, 想补 case | cases/<next-n>/input/PROMPT.md |

own 路径若本地源缺 `README.md` → AI 报错中止, **不自动起草** (README 是给人看的入口, 作者亲自定调).

新 `cases/` 格式 (2026-05 后, `validate-cases.mjs` 强制): 数字目录 `cases/<n>/input/PROMPT.md` (纯文本, 无 frontmatter, 真实用户口吻). 旧 `cases/<recommender>.md` 单文件格式已 EOL, CI 会挂.

## 怎么用 (触发示例)

跟 Claude 说:

- "把我本地这个 `xxx` skill 发到公司库"
- "我看到一个不错的 skill (https://github.com/foo/bar-skill), 推荐给公司库"
- "给公司库的 superpowers 加个我的使用案例"

## 你会看到什么

1. AI `TaskCreate` 7 项任务列, 让你从头看到进度
2. AI 识别路径 → 定位 $REPO (公司库本地 clone) + $SRC (own/case 时本地源 path); own 路径预检 README.md 存在
3. AI 起草: SKILL.md frontmatter (6 字段) / README.md §同类对比 + §使用技巧 / cases/<n>/input/PROMPT.md / PR title + body (按 `templates/` 渲染, 不自创结构)
4. AI 写完整预览到 `/tmp/tranfu-publish-preview-*.md`, chat 给简要摘要, 通过 `AskUserQuestion` form 问 `[发布] / [改] / [取消]`
5. 拿到 `[发布]` 才执行: 切 `skill/<name>` 分支 → cp/写文件 → commit → push → `gh pr create`. `index.json` 由 CI 自动 rebuild, 作者不管
6. 输出 PR URL

**不会**:

- ❌ 不直推 main (始终走 `skill/<name>` 或 `skill/batch-<ts>` 分支)
- ❌ 不静默 `gh pr create` (必须用户从 form 拍 `[发布]`)
- ❌ 不动公司库任何文件 until 用户拍 `[发布]` (前面全是起草, 不写盘)
- ❌ own 路径源缺 README.md 不自动起草 (报错让作者先写)
- ❌ 不 force push
- ❌ 不删现有 skill
- ❌ 不跨仓 PR (只发 `tranfu-labs/tranfu-skills`)
- ❌ 不接 search / install / list / update / uninstall 意图 — 那些走 `tranfu-router`

## 共享模板 (`templates/`)

| 文件 | 用途 | 路径覆盖 |
|---|---|---|
| `templates/pr-body.md` | PR body 骨架 (variant: own / external / case) + 对齐 CI 3 个 validator 的自检清单 | 三路径全用 |
| `templates/case-prompt.md` | `cases/<n>/input/PROMPT.md` 写法提示 (纯文本, 无 frontmatter) | own · case · (external 选填) |
| `templates/section-同类对比.md` | **README.md** `## 同类 Skill 对比` section 骨架 | own · external |
| `templates/section-使用技巧.md` | **README.md** `## 使用技巧` section 骨架 | own · external |

旧 `templates/case-file.md` (含 recommender / reason_kind / scenario_tag frontmatter) 已 EOL — `validate-cases.mjs` 不再认这种格式.

AI 渲染 PR / SKILL.md / case 文件**必须**用这些模板. 不允许换成 GitHub 通用习惯写法 (`## Summary` / `## Validation` / `## Test plan` / `## Rollback`) — 本仓库 lark 通知 + lint workflow 都按模板段名读, 换名 = 静默失效.

## 关键概念

- **path (own / external / case)**: AI 在 §0 自动判. 用户原话给, 或按触发语关键词推 (`URL` → external, `加案例` → case, 其他 → own).
- **$REPO**: 公司库本地 clone path. 优先用户原话给, 次用 cwd 检测, 再 `~/work/tranfu-skills`.
- **$SRC**: 本地 skill 源 path (own / case 用). external 不需要 (skill body 不进公司库, 仅薄指针).
- **case 目录**: 加新 case = 新建 `cases/<next-n>/input/PROMPT.md` (n = 已有最大数字 +1, 或填空缺号). 不再有 recommender 字段, 推荐者归属走 commit message / PR 作者.

## 依赖

- 公司库 push 权限 + 本地 clone 在 `$REPO` (或 `gh repo clone tranfu-labs/tranfu-skills`)
- `gh` CLI 已 auth (`gh auth status` 跑通)
- `git`, `node` (跑 `npm run build:index`)
- `WebFetch` / `WebSearch` (external 路径需要)

## 配套 skill (互相不调用)

- `tranfu-router` — 搜 / 装 / 列 / 升 / 卸 公司库 skill (本 skill 不接这些意图)
- `tfs` CLI — `tfs list --json` 查公司库现有 skill (起草 §同类对比 用)

## 参考

- `SKILL.md` — 完整三路径步骤 + Hard rules
- `framework.svg` — 同 `framework.png` 矢量版
- `templates/` — PR body / case 文件 / SKILL section 骨架
