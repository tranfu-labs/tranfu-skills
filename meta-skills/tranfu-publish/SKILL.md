---
name: tranfu-publish
description: 当用户说"发布本地 skill X 到公司库 / 推荐这个外部 skill (URL) 到公司库 / 把当前 skill 提到 tranfu-skills / 给公司库 X 加使用案例"时, 起草 PR 内容 (frontmatter / README §同类对比 / README §使用技巧 / cases/<n>/input/PROMPT.md / PR title+body) 全部按 templates/ 渲染, 用户拍 [发布] 才走 gh pr create. 不接 search / 装 / 列 / 更新 / 卸载意图 (那走 tranfu-router skill).
version: 0.2.0
author: aquarius-wing
updated_at: 2026-05-28
origin: meta
type: meta
---

# tranfu-publish

把本地写的 / 推荐的 skill / 案例发到公司库 `tranfu-labs/tranfu-skills` 走 PR. AI 起草所有内容, 用户审完拍 form `[发布]` 才提交.

## 路径 + 必备产物

| path | 触发 | 必备产物 |
|---|---|---|
| **own** | "发布本地 X" / "publish X" | `own-skills/<name>/{SKILL.md, README.md, cases/1/input/PROMPT.md}` |
| **external** | "推荐 URL" / "把这个推到公司库" | `external-skills/<name>/{SKILL.md (薄指针, frontmatter 含 version), README.md}` |
| **case** | "加案例 / 补用法" | `<own\|external>-skills/<name>/cases/<next-n>/input/PROMPT.md` |

多 skill (URL/本地路径含 ≥2 `SKILL.md`): 自动全收, 一个 PR 多 commit. 不让用户选.

## 模板 (`templates/` — 渲染必用, 不自创结构)

- `pr-body.md` — PR body 骨架 (variant: own / external / case) + 对齐 CI 自检清单
- `case-prompt.md` — `cases/<n>/input/PROMPT.md` 写法提示
- `section-同类对比.md` — README.md `## 同类 Skill 对比` 骨架 (own / external 用; 不落 SKILL.md)
- `section-使用技巧.md` — README.md `## 使用技巧` 骨架 (own / external 用)

旧 `case-file.md` (含 recommender / reason_kind frontmatter) 已 EOL.

## 详细参考 (按需查, 不必预读)

- `references/ci-checks.md` — frontmatter / cases / security 3 个 validator 的细则 + 本地复跑
- `references/case-sources.md` — PROMPT.md 来源优先级 (对话历史 → examples → legacy → AskUserQuestion) + form 文案 + output/ 收集
- `references/hard-rules.md` — 完整 hard rules 清单 + 背后原因. 改流程前回头查

## 标准流程

### 0. 版本预检 (HARD — 早于一切)

进 skill 第一件事:

1. exec `tfs update --check-only --json`, parse `{self, skills}`
2. 任一落后 (`self.status === "outdated"` 或 `skills[]` 含 `tranfu-publish` `status === "outdated"`) → exec `tfs update --json` 升级 → 输出 1 行 `已升级: tfs CLI X→Y / skill (sha A→B)` → **中止本轮**, 让用户重发意图加载新版
3. 全 noop → 进 §0.5

不许边升级边继续 — 旧版逻辑会在跑.

### 0.5. 建 TaskCreate 任务列

固定 7 项 (按 path 微调措辞):

1. 预检 + 定位 — 找 `$REPO` + `$SRC`. own 路径检查 `$SRC/README.md` 存在 (缺则报错中止, 不起草 README)
2. 识别 path + 检测多 skill
3. 起草 SKILL.md frontmatter — 6 字段必填, 见 `references/ci-checks.md`
4. 起草 README.md §同类对比 + §使用技巧 — own / external 必跑, case 跳过
5. 起草 `cases/<n>/input/PROMPT.md` (+ 选填 output/) — own 必须 `cases/1/`, case 必须新 `cases/<next-n>/`, external 跳过. 来源见 `references/case-sources.md`
6. 起草 PR title + body — 按 `templates/pr-body.md`, 自检清单 AI 据实勾
7. 拍 [发布] 后: 切分支 / 写文件 / commit / push / 开 PR

### 1. 定位 $REPO + $SRC

**$REPO** = 公司库本地 clone. 检测优先级:
1. 用户原话给的 path
2. cwd 含 `.git` 且 `git remote -v` origin 指向 `tranfu-skills`
3. `~/work/tranfu-skills`
4. 都没 → 提示 `gh repo clone tranfu-labs/tranfu-skills ~/work/tranfu-skills`, 中止

**$SRC** = 本地 skill 源:
- own: 用户原话 / `find ~/.claude/skills -name <name>`
- external: 不要本地拷贝, `WebFetch` 验 source_url HTTP 200, `gh api repos/<owner>/<repo>/contents` 检测 multi-skill
- case: `$REPO/<own|external>-skills/<name>/`. 查 `cases/` 已有最大数字, n = max+1 (或填空缺号)

### 2. 识别 path

AI 自判按顺序匹配, 第一条命中即定:

| 信号 | path |
|---|---|
| HTTP URL (github / gitlab / npm) | external |
| 本地 fs path 且含 SKILL.md | own |
| `$REPO/<own\|external>-skills/<name>/` 已存在 | case |
| 关键词 "加案例 / 补用法 / 加 prompt 示例" | case |
| 关键词 "推荐这个 / 推到公司库" | external |
| 关键词 "发布我写的 / 提我的 skill" | own |

全 miss → `AskUserQuestion` form 3 选项 (own / external / case + 各自一句描述).

### 3. 起草 SKILL.md frontmatter

CI 强制 6 字段, 详见 `references/ci-checks.md` §validate-frontmatter. 要点:

- **own**: `origin: own`, `version: 0.1.0` (首发), 不应有 `source_url`
- **external**: `origin: external`, `source_url` 必填 (HTTP 200), `version` 上游有则填否则 fallback `1.0.0` (历史 claude-design-system 漏过被 #89 修)
- **case**: 不动 frontmatter
- description ≤ 1024 字符, 含触发关键词 + "Do NOT trigger when"

### 4. 起草 README.md §同类对比 + §使用技巧

own / external 必跑, case 跳过. 落 README.md 不落 SKILL.md (README 给人看, SKILL 给 LLM 看, 读者不同).

按 `templates/section-同类对比.md` + `templates/section-使用技巧.md` 渲染:

- own: $SRC README 已有这两段 → AI 评估是否符合模板 (≤3 候选 / 独特价值 ≤3 句 / 3 子段), 不符在 §7 给 diff 建议. 缺段 → AI append 到末尾
- external: 整份 README 由 AI 起草 (含 §推荐场景 + §同类对比 + §使用技巧), 推荐者通常不写

§同类对比要点: 内部候选跑 `tfs list --json` 选最近; 外部候选 `WebSearch` 找对标 + `WebFetch` 验活; 独特价值 ≤3 句每句 ≤30 字, 不要"更快/更好/更优雅".

§使用技巧 3 子段: 材料方案 / 推荐用法 / 已知限制. 每子段 ≤3 bullet, 全段 ≤9 bullet ≤500 字.

### 5. 起草 cases/<n>/input/PROMPT.md (+ output/)

按 `templates/case-prompt.md` 渲染. 来源优先级 + form 文案 + output 收集**完整规则在 `references/case-sources.md`**.

短版来源链:

1. 对话历史里有用户真实 prompt
2. $SRC `examples/` `references/`
3. legacy `cases/<author>.md` (own 独有, 提信号 + 删旧)
4. 全 miss → AskUserQuestion form: `[一句话] / [贴 md 路径] / [跳过用 placeholder]` (case 不出现第 3 项)

没来源 AI 自己编 prompt 装用户口吻 = 污染 router 检索测试集, 一定要走 form.

PROMPT.md: 纯文本无 frontmatter, 1-3 句真实用户口吻, 含触发关键词. output/ 推荐有 (放 skill 跑出来的产物), validator 暂不强制.

### 6. 起草 PR title + body

**title**:
- 单 skill: `skill: 加 <name> (own | external | case)` ≤ 70 字符
- 多 skill: `skill: 加 <name1>, <name2>, ... (<path_type> ×N)` ≤ 70 字符

**body**: 按 `templates/pr-body.md` 选 variant 渲染. 自检清单对齐 CI 3 validator, AI 据实勾 (`[x]` 达成 / `[ ]` 没达成留给 reviewer 看 / `[~] N/A — 一句原因` 真不适用). 不留"需用户跑测试"项, 也不允许整段删自检清单.

### 7. 预览门禁 (HARD — AskUserQuestion form, 不用 [1][2][3] 文字)

**完整渲染**写 `/tmp/tranfu-publish-preview-<timestamp>.md` (含所有 skill 的 frontmatter + README 新增段 + PROMPT.md + PR title + body). chat 只发简要摘要 + 文件路径.

简要摘要含: 路径 / 分支 / 落点列表 / PR title / §同类对比 1 句摘要 / §使用技巧 1 句摘要 / PROMPT.md 1 句摘要 / CI 校验自检 (frontmatter / cases / security 各 pass-fail) / 风险点.

然后 `AskUserQuestion`:
- question: `发布这 N 个 skill 到 tranfu-skills 公司库?`
- header: `发布预览`
- 选项: `[发布]` (Recommended) / `[改]` / `[取消]`

阻塞: `[发布]` → §8; `[改]` 改后**重跑整个 §7**; `[取消]` 中止; Other 自由文字当 `[改]` 处理.

NEVER 在拿 `[发布]` 之前动公司库文件.

### 8. 提交 (仅 §7 拿到 [发布] 后)

按 path 改动:

| path | 改动 | git add |
|---|---|---|
| own | `cp -r $SRC $REPO/own-skills/<name>/` | `own-skills/<name>/` |
| external | 写 `$REPO/external-skills/<name>/{SKILL.md, README.md}` | `external-skills/<name>/` |
| case | 新建 `$REPO/<own\|external>-skills/<name>/cases/<n>/input/PROMPT.md` (+ 选填 output/) | 该 case 目录 |

`index.json` **不要手动 add / commit** — CI 处理.

步骤:

1. `cd $REPO && git checkout main && git pull --ff-only && git checkout -b skill/<name>` (多 skill: `skill/batch-<timestamp>`)
2. 写文件
3. (推荐) 本地预跑 `npm run validate -- --target <skill-dir> --json`, 有 error 回 §7 修
4. `git add <path>` + `git commit -m "skill: 加 <name> (<path_type>)"`. 多 skill 多 commit
5. `git push -u origin <branch>`
6. 开 PR (§9)

### 9. 提 PR

```bash
gh pr create --base main --head $BRANCH \
  --title "<§6 title>" \
  --body "$(cat <<'EOF'
<§6 body>
EOF
)"
```

成功 → 输出 PR URL. 失败 → 报错, 不重试.

PR 开完 CI 自动跑 (`.github/workflows/build-index.yml`): `npm test` / `npm run validate` / `npm run validate:vt` / `npm run build:index`. 挂了 Lark + PR comment 按 validator 分组给错误明细 + 复跑命令. 本地复现一行: `npm run validate -- --target <skill-path> --json`.

## 顶层 Hard rules (完整清单见 `references/hard-rules.md`)

- ❌ **跳 §0 版本预检 / 跳 TaskCreate** — 旧版逻辑会在跑
- ❌ **不直推 main / 永远不 force push** — 走 `skill/<name>` 分支
- ❌ **不动公司库文件 until §7 拍 [发布]** — §1-7 全部是起草
- ❌ **不静默 `gh pr create`** — 必须从 §7 form 拍 `[发布]`
- ❌ **没来源 AI 自己编 prompt** — 走 `references/case-sources.md` §4 form 问用户
- ❌ **不接 router 意图** — search / install / list / update / uninstall / doctor 留给 `tranfu-router`

## 常用工具

`TaskCreate` / `TaskUpdate` / `AskUserQuestion` / `gh repo clone` / `gh api repos/<o>/<r>/contents` / `git checkout -b skill/<name>` / `gh pr create` / `tfs list --json` / `npm run validate -- --target` / `WebSearch` / `WebFetch`.
