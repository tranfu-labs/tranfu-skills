---
name: tranfu-publish
description: 当用户说"发布本地 skill X 到公司库 / 推荐这个外部 skill (URL) 到公司库 / 把当前 skill 提到 tranfu-skills / 给公司库 X 加使用案例"时, 按 templates/ 起草全部内容 (frontmatter / README §同类对比 / README §使用技巧 / case-file / PR title+body) 后自动切分支 / commit / push / gh pr create —— 触发即视为发布意图, 不再等用户二次确认。不接 search / 装 / 列 / 更新 / 卸载意图 (那走 tranfu-router skill)。
version: 0.3.0
author: aquarius-wing
updated_at: 2026-06-15
origin: meta
type: meta
---

# tranfu-publish

把本地写的 / 推荐的 skill / 案例发到公司库 (tranfu-labs/tranfu-skills) 走 PR。**触发即发布**: 识别意图 → 起草所有内容 → 自动 push + 开 PR, 中途不打印预览、不等用户拍板。

参考 `README.md` 看框架图 / 路径概览。本 SKILL.md 是完整步骤 + Hard rules。

## 触发判断

| 用户说 | path | 产物 |
|---|---|---|
| "发布本地 skill X 到公司库" | **own** | `own-skills/<name>/{SKILL.md, README.md, ...}` |
| "推荐这个外部 skill (https://...) 到公司库" / "把这个 skill 推到公司库" | **external** | `external-skills/<name>/{SKILL.md(薄指针), README.md}`, skill body 不进库 |
| "给公司库 X 加使用案例 / 补一个用法" | **case** | 在 `<own\|external>-skills/<name>/cases/<recommender>.md` 追加 / 新建 |

**files 必备清单** (缺 = 中止, 不蒙混):

| variant | SKILL.md | README.md | cases/ |
|---|---|---|---|
| own | 必须 | **必须** (缺 = 报错中止, 不自动起草) | 可选 (源里有就一起带, 没有不强求) |
| external | 必须 (薄指针) | 必须 (AI 起草) | 不需要 |
| case | 不动 | 不动 | 必须 (新建或 append) |

**多 skill 一次发**: 上游仓库 / 本地路径含 ≥2 个 skill (≥2 个 `SKILL.md`, 或 `.md` frontmatter 含 `name:`) → 自动**全收**, 一个 PR 多目录 / 多 commit, **不让用户选**。

**不接** (留给 `tranfu-router`): search / install / list / installed / update / uninstall / doctor。

## 模板 (`templates/` — 渲染必用, 不自创结构)

| 文件 | 用途 | 用于 |
|---|---|---|
| `templates/pr-body.md` | PR body 骨架, 含 own/external/case 三段 | 三路径 |
| `templates/case-file.md` | case 文件骨架, frontmatter + 4 段 body | case |
| `templates/section-同类对比.md` | **README.md** `## 同类 Skill 对比` 段 | own · external |
| `templates/section-使用技巧.md` | **README.md** `## 使用技巧` 段 | own · external |

README 的 `## 同类 Skill 对比` / `## 使用技巧` 段名照 templates/ 保持一致 (catalog + 人读的约定, 别换成 `## Summary` 之类)。PR body 怎么写无所谓 —— CI / 飞书通知都只把 body 原样转发, 不解析段名。

## 标准流程

进 skill 第一件事, CREATE A TODO LIST FOR THE TASKS BELOW (每步一个 TODO, 起步即建, 非可选):
§0 版本预检 / §1 定位 $REPO+$SRC / §2 识别 path / §3 起草内容 / §4 起草 PR title+body / §5 提交+开 PR。

### 0. 版本预检 (HARD — 早于一切)

进 skill **第一件事**:

1. exec `tfs update --check-only --json`, parse `{self, skills, ...}`
2. 判定**落后** (任一为真): `self.status === "outdated"`; 或 `skills[]` 中 `name === "tranfu-publish"` 且 `status === "outdated"`
3. **任一落后** → exec `tfs update --json` (同升 CLI + skill), 给用户 1 行 (`已升级: tfs X→Y / skill tranfu-publish sha A→B`), 然后**中止本轮**:
   ```
   本 skill 文件刚被覆盖, 当前对话加载的仍是旧版。
   请重新发一遍刚才的发布意图, 让 agent 重新 trigger 加载新版。
   ```
   NEVER 边升级边跑后续步骤。
4. 全 noop → 进 §1。

### 1. 定位 $REPO + $SRC

**$REPO** = 公司库本地 clone path。优先级: ① 用户原话 → ② cwd 含 `.git` 且 origin 指向 `tranfu-skills` → ③ `~/work/tranfu-skills` → ④ 找不到则提示 `gh repo clone tranfu-labs/tranfu-skills ~/work/tranfu-skills` 再回来。

**$SRC** = 本地 skill 源:
- **own**: 用户本地目录 (原话 / `find ~/.claude/skills -name <name>`)
- **external**: 不需本地拷贝, `WebFetch` 验 source_url HTTP 200 (**非 200 / WebFetch 失败 → 报错中止, 不写 external 目录、不开 PR**), `gh api repos/<owner>/<repo>/contents` 检 multi-skill
- **case**: 即公司库内已有 skill path, e.g. `$REPO/external-skills/<name>/`

**case 预检 (HARD)**: 写 cases 文件前先验 `$REPO/<own|external>-skills/<name>/` 真实存在; 不存在 → 报错中止:
```
公司库里没有 skill <name>, 无法加案例。
请先用 own / external 路径把它发布进库, 再回来补案例。
```

**own 预检 (HARD)**: $SRC 没 `README.md` → 立即报错中止:
```
own 路径要求 $SRC/README.md 存在 (含 §同类 Skill 对比 + §使用技巧)。
当前 $SRC=<path> 没有 README.md, 请先在本地写一份再回来。
AI 不自动起草 README —— 它是给人看的入口, 必须作者亲自定调。
```
有 README 但缺这两段 → 不中止, AI 在 §3 起草 append。external / case 不卡此检。

### 2. 识别 path (AI 自判, 兜不住才问 form)

按顺序匹配, 第一条命中即定:

| 信号 | path |
|---|---|
| 给 HTTP URL (github / gitlab / npm / ...) | **external** |
| 给本地 fs path 且下有 `SKILL.md` | **own** |
| 给的 path 是已存在的 `$REPO/<own\|external>-skills/<name>/` | **case** |
| "加案例 / 补用法 / 加用例" | **case** |
| "推荐这个 / 推到公司库" | **external** |
| "发布我写的 / 提我的 skill / 上传我的" | **own** |

全 miss → `AskUserQuestion` 问 (own / external / case 三选)。

**多 skill 检测**: own = $SRC 子目录各含 `SKILL.md`; external = source_url root 或 `skills/` 下 ≥2 个 `SKILL.md`; case 不检测。检到 ≥2 → §3 对每个分别起草, PR title 按 §4 多 skill 规则。

### 3. 起草内容 (按 path)

**SKILL.md frontmatter**:
- own (`own-skills/<name>/SKILL.md`): `name`(=目录名, kebab) / `description`(含触发词 + "Do NOT trigger when", ≥2 句) / `version`(默认 `0.1.0`) / `author`(`gh api user -q .login`) / `updated_at`(`date -u +%Y-%m-%d`) / `origin: own` (无 source_url)
- external (`external-skills/<name>/SKILL.md`): `name` / `description` 同上 / `origin: external` / `source_url` **必填** (HTTP 200) / `author`(上游) / `version`·`updated_at`(上游有则填); body = 薄指针, 含 "完整内容见 source_url"
- case: 不动 SKILL.md

**README.md §同类对比 + §使用技巧** (own · external 必跑, case 跳过, 按模板渲染落 **README.md** 不落 SKILL.md):
- own: 已有这两段 → AI 评是否合模板, 不合 → 在本轮对话向用户提示改进点 (不改作者 README、不塞进 PR body, body 固定 1:1 无此位); 缺段 → AI 起草 append 到 README 末尾
- external: 整份 README 由 AI 起草 (§推荐场景 + §同类对比 + §使用技巧)
- §同类对比: 内部候选 ≤3 (`tfs list --json` 选最近) + 外部候选 ≤3 (web search + `WebFetch` 验活) + 独特价值 ≤3 句每句 ≤30 字, NEVER "更快/更好/更优雅"
- §使用技巧 3 子段: 材料方案 / 推荐用法(场景+prompt) / 已知限制; 每子段 ≤3 bullet, 全段 ≤9 bullet ≤500 字

**case-file** (仅 **case** path 跑, 按 `templates/case-file.md`):
- own / external: 不起草 case (own 源里若自带 `cases/` 则在 §5 原样 `cp` 带上, 但不强要、不补写)
- case: **必须**, recommender = 用户当前身份, 落 `<own\|external>-skills/<name>/cases/<recommender>.md`
- frontmatter 三必填: `recommender` / `recommended_at` / `reason_kind` (8 枚举之一)。同名 recommender 已存在 → append 二级标题 `## <new scenario>` 起新段, **不开第二份文件**。

### 4. 起草 PR title + body

**title**: 单 = `skill: 加 <name> (own|external|case)`; 多 = `skill: 加 <name1>, <name2>, ... (<path> ×N)`。≤70 字符 —— 列举超 70 → 降级为 `skill: 批量加 N 个 skill (<path>)`, 各 name 详情进 body。

**body**: 按 `templates/pr-body.md` 渲染 —— 就是把发布 skill 的信息 (path / origin / version / author / 包含文件 / description) 1:1 贴成表格, 多 skill 重复。没人逐字读 PR body, 够查即可, 不堆自检清单 / 风险点。

### 5. 提交 + 开 PR (起草完直接执行, 不等确认)

按 path 决定改动 (多 skill: 每个 skill 重复, 一 commit per skill):

| path | 改动 | git add |
|---|---|---|
| own | `cp -r $SRC $REPO/own-skills/<name>/` (含 SKILL/README/cases/其他文件) | `own-skills/<name>/` |
| external | 写 `$REPO/external-skills/<name>/{SKILL.md, README.md}` | `external-skills/<name>/` |
| case | append/新建 `$REPO/<own\|external>-skills/<name>/cases/<recommender>.md` | 该 case 文件 |

`index.json` **不手动 add/commit** —— CI 处理。

步骤:
1. 切分支: `cd $REPO && git checkout main && git pull --ff-only && git checkout -b skill/<name>` (多 skill: `skill/batch-<timestamp>`)
2. 写文件 (上表)
3. `git add <path> && git commit -m "skill: 加 <name> (<path>)"` (多 skill 多 commit)
4. `git push -u origin <branch>`
5. 开 PR:
   ```bash
   gh pr create --base main --head $BRANCH \
     --title "<§4 title>" \
     --body "$(cat <<'EOF'
   <§4 body>
   EOF
   )"
   ```
6. 输出 PR URL。`gh` 失败 (auth / network) → 报错 + **不重试**。

## Hard rules

- ❌ 跳 §0 版本预检 = 违规 —— 必须强检 + 强升 + 升后中止让用户重 trigger, NEVER 边升边跑
- ❌ 不直推 main —— 一定走 `skill/<name>` 或 `skill/batch-<timestamp>` 分支
- ❌ own 路径 $SRC 没 README.md 不自动起草 —— 报错让用户先写
- ❌ §同类对比 / §使用技巧 落 SKILL.md = 违规 —— 必须落 README.md
- ❌ own / external 路径补写 case = 违规 —— 只有 case path 才起草 case (own 源自带的 cases/ 原样 cp, 不强要不补写)
- ❌ README §同类对比 / §使用技巧 段名换成 `## Summary` 之类 = 违规 (catalog + 人读约定)
- ❌ 不手动 add/commit `index.json` —— CI 处理
- ❌ 多 skill URL 让用户选哪个发 = 违规 —— 自动全收
- ❌ `gh` 失败 → 报错, 不重试
- ❌ 不接 router 范围意图 (search / install / list / update / uninstall / doctor)
- ❌ 不跨仓 PR —— 只发到 `tranfu-labs/tranfu-skills`
- ❌ 永不 force push, 不删现有 skill, 不开同名 recommender 的第二份 case (append)

## 常用工具

- `AskUserQuestion` —— 仅 §2 path 兜底
- `gh repo clone / view`, `gh api repos/<owner>/<repo>/contents` (external 检 multi-skill)
- `git checkout -b skill/<name>`, `gh pr create --base main --head <branch>`
- `tfs list --json` (同类对比), `WebSearch` / `WebFetch` (external 找对标 + 验活)
