---
name: tranfu-publish
description: 当用户说"发布本地 skill X 到公司库 / 推荐这个外部 skill (URL) 到公司库 / 把当前 skill 提到 tranfu-skills / 给公司库 X 加使用案例"时, 起草 PR 内容 (frontmatter / README §同类对比 / README §使用技巧 / case-file / PR title+body) 全部按 templates/ 渲染, 用户拍 [发布] 才走 gh pr create. 不接 search / 装 / 列 / 更新 / 卸载意图 (那走 tranfu-router skill).
type: meta
---

# tranfu-publish

把本地写的 / 推荐的 skill / 案例发到公司库 (tranfu-labs/tranfu-skills) 走 PR. 起草所有内容 → 用户审 → 用户拍 form `[发布]` 才提交.

参考 `README.md` 看框架图 / 路径概览. 本 SKILL.md 是完整步骤 + Hard rules.

## 触发判断

| 用户说 | path | 产物 |
|---|---|---|
| "发布本地 skill X 到公司库" | **own** | `own-skills/<name>/{SKILL.md, README.md, cases/<author>.md, ...}` |
| "推荐这个外部 skill (https://...) 到公司库" / "把这个 skill 推到公司库" | **external** | `external-skills/<name>/{SKILL.md(薄指针), README.md}`. skill 实际 body 不进公司库 |
| "给公司库 X 加使用案例 / 补一个用法" | **case** | 在 `external-skills/<name>/cases/<recommender>.md` 或 `own-skills/<name>/cases/<recommender>.md` 追加 / 新建 |

**files 必备清单** (用于 §0 预检):

| variant | SKILL.md | README.md | cases/<author>.md |
|---|---|---|---|
| own | 必须 | **必须** (缺 = 卡在 §0, 不自动起草) | **必须** (作者自己的使用案例) |
| external | 必须 (薄指针) | 必须 | 不需要 (后续可走 case path 补) |
| case | 不动 | 不动 | 必须 (新建或 append) |

**多 skill 一次发**: 如果 URL 上游仓库 / 用户给的本地路径含 ≥2 个 skill (检测: 目录树里 ≥2 个 `SKILL.md` 或 `.md` frontmatter 含 `name:`), 自动**全收**, 一个 PR 多目录 / 多 commit. **不让用户选哪个**.

**不接** (留给 `tranfu-router`):

- search / install / list / installed / update / uninstall / doctor 意图

## 模板 (`templates/` — 渲染时必须用, 不自创结构)

| 文件 | 用途 | 路径 |
|---|---|---|
| `templates/pr-body.md` | PR body 骨架, 含 variant=own / external / case 三段 | 三路径全用 |
| `templates/case-file.md` | case 文件骨架, frontmatter + 4 段 body | own · external · case |
| `templates/section-同类对比.md` | **README.md** `## 同类 Skill 对比` section | own · external (落 README, 不落 SKILL.md) |
| `templates/section-使用技巧.md` | **README.md** `## 使用技巧` section | own · external (落 README, 不落 SKILL.md) |

NEVER 把模板段换成 GitHub 通用习惯写法 (`## Summary` / `## Validation` / `## Rollback`) — 它们对 reviewer 看似熟悉, 但本仓库 lark 通知 + lint workflow 都按模板段名读, 换名 = 静默失效.

## 标准流程

### 0. 版本预检 (HARD — 早于 TaskCreate, 早于一切)

进 skill **第一件事**, 不许跳:

1. exec `tfs update --check-only --json`, parse `{self, skills, ...}`
2. 判定**落后** (任一为真):
   - `self` 非 null 且 `self.status === "outdated"` → CLI 自身落后
   - `skills[]` 里有项目 `name === "tranfu-publish"` 且 `status === "outdated"` → 本 skill 落后
3. **任一落后**:
   - exec `tfs update --json` (无 flag, 同时升 CLI + skill), parse 结果
   - 给用户 1 行人话: `已升级: tfs CLI X→Y / skill tranfu-publish (sha A→B)` (按实际填)
   - **中止本次流程**, 提示:
     ```
     本 skill 文件刚被覆盖, 当前对话加载的仍是旧版.
     请重新发一遍刚才的发布意图, 让 agent 重新 trigger 加载新版.
     ```
   - **NEVER 边升级边跑后续 §1+** — 即便已识别意图也不准继续
4. 全 noop → 进 §0.5

### 0.5. 启动 — 建 TaskCreate 任务列 + 预检 (HARD)

进 skill (版本预检通过后) `TaskCreate` 把流程列出来, 让用户从头看到进度.

固定 7 项任务 (按 path 微调措辞):

1. **预检 + 定位** — 找 $REPO + $SRC, own 路径 check $SRC 有 README.md (缺则报错中止, 不起草)
2. **识别 path + 检测多 skill** — own / external / case + 上游是否含 ≥2 个 skill
3. **起草 SKILL.md frontmatter + (external 路径) 薄指针 body** — 按 path 补全 name / description / version / origin / author
4. **起草 README.md §同类对比 + §使用技巧** — own · external 必跑; case 跳过. own 路径若 $SRC README 缺这两段, append 到 README 末尾
5. **起草 case-file** — own (必须, recommender=author) · case (必须); external 跳过
6. **起草 PR title + body + 预览门禁** — 完整渲染 + form 等用户拍 [发布]
7. **拍 [发布] 后: 切分支 / 写文件 / commit / push / 开 PR**

**预检 hard rule**:

- own 路径 $SRC 没 `README.md` → **立即报错中止**, 提示用户:
  ```
  own 路径要求 $SRC/README.md 存在 (含 §同类 Skill 对比 + §使用技巧 两段).
  当前 $SRC=<path> 没有 README.md. 请先在本地写一份再回来.
  AI 不会自动起草 README — 因为它是给人看的入口, 必须作者亲自定调.
  ```
- own 路径 $SRC 有 README.md 但缺 §同类对比 或 §使用技巧 → 不中止, AI 在 §4 起草 append 进去 (内容由 AI 起草, 用户在 §7 预览审)
- external / case 路径不卡 README 预检

### 1. 定位 $REPO + $SRC

**$REPO** = 公司库 `tranfu-labs/tranfu-skills` 本地 clone path. 检测优先级:

1. 用户原话给的 path
2. 当前 cwd 含 `.git` 且 `git remote -v` origin 指向 `tranfu-skills`
3. 常见路径 `~/work/tranfu-skills`
4. 找不到 → 提示 `gh repo clone tranfu-labs/tranfu-skills ~/work/tranfu-skills` 再回来

**$SRC** = 本地 skill 源 path:

- **own**: 用户本地 skill 目录, e.g. `~/.claude/skills/<name>`. 用户原话 / `find ~/.claude/skills -name <name>` 定位
- **external**: 不需要本地拷贝. 用 `WebFetch` 验 source_url HTTP 200, `gh api repos/<owner>/<repo>/contents` 检测是否 multi-skill
- **case**: $SRC 即公司库内已有 skill 的 path, e.g. `$REPO/external-skills/<name>/`

### 2. 识别 path (尽量 AI 自判, 兜不住才问 form)

**AI 自判规则** (按顺序匹配, 第一条命中即定):

| 信号 | path |
|---|---|
| 用户原话给 HTTP URL (github.com / gitlab / npm / ...) | **external** |
| 用户原话给本地 fs path 且该 path 下有 `SKILL.md` | **own** |
| 用户原话给的 path 是 `$REPO/external-skills/<name>/` 已存在 | **case** |
| 用户说 "加案例 / 补用法 / 加用例" 关键词 | **case** |
| 用户说 "推荐这个 / 推这个 / 推到公司库" 关键词 | **external** |
| 用户说 "发布我写的 / 提我的 skill / 上传我的" 关键词 | **own** |

全部 miss 才用 `AskUserQuestion` form 问 (3 选项: own / external / case + 各自一句描述).

**多 skill 检测**:

- **own**: $SRC 目录下是否有子目录各自含 `SKILL.md`
- **external**: source_url 上游 root 或 `skills/` 下是否 ≥2 个 `SKILL.md`
- **case**: 不检测

检测到 ≥2 → 后续 §3-§5 对**每个 skill 分别起草**, §6 PR title 改为 `skill: 加 <name1>, <name2>, ... (<path_type> ×N)`, §7 预览**所有 skill 一起展示**.

### 3. 起草 SKILL.md frontmatter / body

按 path:

**own** (`own-skills/<name>/SKILL.md`):

- `name`: 与目录名一致, kebab-case
- `description`: 含触发关键词 + "Do NOT trigger when" 段 (LLM 路由用), ≥ 2 句
- `version`: 默认 `0.1.0`
- `author`: `gh api user -q .login`
- `updated_at`: `date -u +%Y-%m-%d`
- `origin: own` (写死, 不应有 `source_url`)

**external** (`external-skills/<name>/SKILL.md`):

- `name`, `description` 同上
- `origin: external` (写死)
- `source_url`: **必填**, 指向上游 skill (HTTP 200)
- `author`: 上游作者
- `version`, `updated_at`: 上游若有则填, 否则空
- body: 薄指针, 含 "完整内容见 source_url" 引导

**case**: 不动 SKILL.md frontmatter.

缺则起草补全后给用户审, **不反向问用户**.

### 4. 起草 README.md §同类对比 + §使用技巧 (own · external 必跑, case 跳过)

按 `templates/section-同类对比.md` + `templates/section-使用技巧.md` 渲染, 落到 **README.md** (不是 SKILL.md).

**own**: 若 $SRC README.md 已含这两段, AI 评估内容是否符合模板要求 (≤3 候选 / ≤3 句独特价值 / 3 子段 etc), 不符就在 §7 预览给出 diff 建议. 若缺段 → AI 起草 append 到 README.md 末尾.

**external**: README.md 由 AI 起草 (含 §推荐场景 + §同类对比 + §使用技巧), 因为推荐者通常不写 README.

**§同类对比** 内容:

- 内部候选 (≤3): 跑 `tfs list --json` 看公司库现有 skill, 选最相近
- 外部候选 (≤3): web search "<关键词> claude skill / agent" 找外部对标; `WebFetch` 验活
- 独特价值: ≤3 句, 每句 ≤30 字, 具体到能力 / 场景 / 输出. NEVER "更快 / 更好 / 更优雅"

**§使用技巧** 3 子段:

- 材料方案: 用之前 user 该准备什么
- 推荐用法: 典型场景 + prompt 模板
- 已知限制: 不能做什么 / 边界 / 已知 bug

约束: 每子段 ≤3 bullet, 全段 ≤9 bullet ≤500 字.

### 5. 起草 case-file

按 `templates/case-file.md` 渲染.

| variant | 必须? | recommender | 落点 |
|---|---|---|---|
| own | **必须** | author 自己 (`gh api user -q .login`) | `own-skills/<name>/cases/<author>.md` |
| external | **不需要** | — | — (后续可走 case path 补) |
| case | **必须** | 用户当前身份 | `<own|external>-skills/<name>/cases/<recommender>.md` |

frontmatter 三必填: `recommender` / `recommended_at` / `reason_kind` (8 枚举之一).

**同名 recommender 已存在** → append 新场景到 body 末尾, 用二级标题 `## <new scenario tag>` 起新段. **不开第二份文件**.

### 6. 起草 PR title + body

**title**:

- 单 skill: `skill: 加 <name> (own | external | case)` — ≤ 70 字符
- 多 skill: `skill: 加 <name1>, <name2>, ... (<path_type> ×N)` — ≤ 70 字符

**body**: 按 `templates/pr-body.md` 选对应 variant 渲染, 填齐 `{占位符}`.

**自检清单**全部由 AI 据实判 + 据实勾, 砍到 3-5 条只查"流程产物齐不齐":

- own: README.md 存在 / README 有 §同类对比 / README 有 §使用技巧 / SKILL.md frontmatter 齐 / cases/<author>.md 齐
- external: README 有 §同类对比 + §使用技巧 / SKILL.md 薄指针 + source_url 有效
- case: 不动 SKILL/README / case frontmatter 齐

勾法:

- 实际达成 → `- [x]`
- 实际没达成 → 老实留 `- [ ]`, 让 reviewer 看到卡点. **NEVER 偷偷勾上**
- 真不适用 → `- [~] N/A — 一句原因`

不留任何"需用户跑测试"项. 也不允许整段删自检清单.

### 7. 预览门禁 (HARD — 走 AskUserQuestion form, 不用 [1][2][3] 文字)

**完整渲染**写到临时文件 `/tmp/tranfu-publish-preview-<timestamp>.md`, 含: 所有 skill 的 frontmatter + README 新增段 + case-file + PR title + body. 告诉用户文件路径.

chat 里只发**简要摘要**:

```
=== 发布预览 ===
路径: own | external | case (×N if 多 skill)
分支: skill/<name>  (多 skill: skill/batch-<timestamp>)
目标目录 / 文件:
  - <列出每个 skill 的落点 (SKILL.md, README.md, cases/...)>

PR title: <title>

完整 markdown 渲染见: /tmp/tranfu-publish-preview-<timestamp>.md

§同类对比 摘要 (每个 skill 1 句, 仅汇报落到 README 的内容): <...>
§使用技巧 摘要 (每个 skill 1 句): <...>
case-file 摘要 (own/case 必有): <...>

风险点 (自动检测): <列出, 或 N/A>
```

然后调 `AskUserQuestion`:

- question: "发布这 N 个 skill 到 tranfu-skills 公司库?"
- header: "发布预览"
- 3 选项:
  - `[发布]` — 确认, 跑完整提交流程 (Recommended)
  - `[改]` — 给我具体改动指示, 重跑本预览
  - `[取消]` — 中止, 不动公司库

**阻塞规则**:

- 拿 `[发布]` → 执行 §8
- 拿 `[改]` → 改后**重新跑整个 §7**
- 拿 `[取消]` → 中止
- form "Other" 自由文字 → 当 `[改]` 处理 (除非明确确认)

NEVER 在拿 `[发布]` 之前动公司库文件.

### 8. 提交 (仅 §7 拿到 [发布] 后执行)

按 path 决定改动 (多 skill: 对每个 skill 重复, 一个 commit per skill):

| path | 改动 | git add 目标 |
|---|---|---|
| own | `cp -r $SRC $REPO/own-skills/<name>/` (含 SKILL.md / README.md / cases/<author>.md / 其他作者带来的文件) | `own-skills/<name>/` |
| external | 写 `$REPO/external-skills/<name>/{SKILL.md, README.md}` | `external-skills/<name>/` |
| case | append / 新建 `$REPO/<own|external>-skills/<name>/cases/<recommender>.md`; 不动 SKILL.md / README.md | 该 case 文件 |

`index.json` **不要手动 add / commit** — CI 自动处理.

执行步骤 (TaskCreate 第 7 项):

1. 切分支: `cd $REPO && git checkout main && git pull --ff-only && git checkout -b skill/<name>` (多 skill: `skill/batch-<timestamp>`)
2. 写文件: 按上表
3. git add + commit: path-specific add + `git commit -m "skill: 加 <name> (<path_type>)"`. 多 skill 多 commit
4. push: `git push -u origin <branch>`
5. 开 PR (见 §9)
6. 输出 PR URL

### 9. 提 PR

```bash
gh pr create --base main --head $BRANCH \
  --title "<§6 起草的 title>" \
  --body "$(cat <<'EOF'
<§6 起草的 body>
EOF
)"
```

成功 → 输出 PR URL. 失败 (gh auth / network) → 报错 + **不重试**.

## Hard rules

- ❌ **跳 §0 版本预检 = 违规** — 必须 npx 式强制检测 + 强制升级 + 升级后中止本轮让用户重 trigger
- ❌ **不静默走 `gh pr create`** — 必须用户从 §7 form 拍 `[发布]`
- ❌ **不直推 main** — 一定走 `skill/<name>` 或 `skill/batch-<timestamp>` 分支
- ❌ **不动公司库任何文件 until §8** — §1-7 全部是起草, 不写盘
- ❌ **§0 没建 TaskCreate 任务列就开始干活 = 违规**
- ❌ **own 路径 $SRC 没 README.md 不自动起草** — 报错让用户先写 (历史已在公司库的 skill 不卡, 但本次 publish 加进来的必须有)
- ❌ **§7 用 [1][2][3] 文字而非 AskUserQuestion form = 违规**
- ❌ **PR body 留"用户要勾"的项 = 违规** — 自检清单全 AI 判, 不要求用户跑测试
- ❌ **多 skill URL 让用户选哪个发 = 违规** — 自动全收
- ❌ **§同类对比 / §使用技巧 落 SKILL.md = 违规** — 必须落 README.md
- ❌ **external 路径强制 case = 违规** — external 不需要 case
- ❌ **own 路径不带 cases/<author>.md = 违规** — own 必须有作者本人 case
- ❌ **必须按 `templates/` 渲染** — 不允许换成 `## Summary / ## Validation / ## Rollback`
- ❌ **不要手动 add / commit `index.json`** — CI 处理
- ❌ **`gh` 失败 → 报错, 不重试**
- ❌ **不接 router 范围意图** (search / install / list / update / uninstall / doctor)
- ❌ **不跨仓 PR** — 只发到 `tranfu-labs/tranfu-skills`
- ❌ **永远不 force push**
- ❌ **不删现有 skill**
- ❌ **不开同名 recommender 的第二份 case 文件** — append

## 常用工具

- `TaskCreate` / `TaskUpdate` — §0 建任务列, 全流程跟踪
- `AskUserQuestion` — §2 path 兜底 + §7 预览门禁
- `gh repo clone / view` — 验公司库
- `gh api repos/<owner>/<repo>/contents` — external 检测 multi-skill
- `git checkout -b skill/<name>` — 切分支
- `gh pr create --base main --head <branch>` — 提 PR
- `tfs list --json` — 查公司库现有 skill 做同类对比
- `WebSearch` / `WebFetch` — external 找外部对标 + 验活
