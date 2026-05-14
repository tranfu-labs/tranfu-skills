---
name: tranfu-publish
description: 当用户说"发布本地 skill X 到公司库 / 推荐这个外部 skill (URL) 到公司库 / 把当前 skill 提到 tranfu-skills / 给公司库 X 加使用案例"时, 起草 PR 内容 (frontmatter / §同类对比 / §使用技巧 / case-file / PR title+body) 全部按 templates/ 渲染, 用户审完拍 y 才走 gh pr create. 不接 search / 装 / 列 / 更新 / 卸载意图 (那走 tranfu-router skill).
type: meta
---

# tranfu-publish

把本地写的 / 推荐的 skill / 案例发到公司库 (tranfu-labs/tranfu-skills) 走 PR. 起草所有内容 → 用户审 → 用户拍 `y` 才提交.

参考 `README.md` 看框架图 / 路径概览. 本 SKILL.md 是完整步骤 + Hard rules.

## 触发判断

| 用户说 | path |
|---|---|
| "发布本地 skill X 到公司库" | **own** — 完整复制 skill 目录到 `own-skills/<name>/` |
| "推荐这个外部 skill (https://...) 到公司库" / "把这个 skill 推到公司库" | **external** — 写 `external-skills/<name>/SKILL.md` 薄指针 + `cases/<recommender>.md`. skill 实际 body 不进公司库, install 时从 source_url 拉 |
| "给公司库 X 加使用案例 / 补一个用法" | **case** — 仅在 `external-skills/<name>/cases/<recommender>.md` 追加 / 新建 |

**不接** (留给 `tranfu-router`):

- search / install / list / installed / update / uninstall / doctor 意图

## 模板 (`templates/` — 渲染时必须用, 不自创结构)

| 文件 | 用途 | 路径 |
|---|---|---|
| `templates/pr-body.md` | PR body 骨架, 含 variant=own / external / case 三段 | 三路径全用 |
| `templates/case-file.md` | case 文件骨架, frontmatter 8-enum `reason_kind` + 4 段 body | external · case |
| `templates/section-同类对比.md` | SKILL.md `## 同类 Skill 对比` section | own · external |
| `templates/section-使用技巧.md` | SKILL.md `## 使用技巧` section | own · external |

NEVER 把模板段换成 GitHub 通用习惯写法 (`## Summary` / `## Validation` / `## Test plan` / `## Rollback`) — 它们对 reviewer 看似熟悉, 但本仓库 lark 通知 + lint workflow 都按模板段名读, 换名 = 静默失效.

## 标准流程

### 0. 前置 — 定位 $REPO + $SRC

**$REPO** = 公司库 `tranfu-labs/tranfu-skills` 本地 clone path. 检测优先级:

1. 用户原话给的 path
2. 当前 cwd 含 `.git` 且 `git remote -v` origin 指向 `tranfu-skills`
3. 常见路径 `~/work/tranfu-skills`
4. 找不到 → 提示 `gh repo clone tranfu-labs/tranfu-skills ~/work/tranfu-skills` 再回来

**$SRC** = 本地 skill 源 path:

- **own**: 用户本地 skill 目录, e.g. `~/.claude/skills/<name>` 或他工作目录下的 `<name>/`. 用户原话 / `find ~/.claude/skills -name <name>` 定位
- **external**: 不需要 (skill body 不进公司库)
- **case**: $SRC 即公司库内已有 skill 的 path, e.g. `$REPO/external-skills/<name>/`

```bash
gh repo view tranfu-labs/tranfu-skills --json sshUrl  # 验仓库可访问
```

### 1. 识别 path

own / external / case 三选一. 不确定 → 显式问用户.

### 2. 检查 / 补全 frontmatter

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
- `source_url`: **必填**, 指向上游 skill (HTTP 200, 不是 vaporware)
- `author`: 上游作者
- `version`, `updated_at`: 上游若有则填, 否则空

**case**: 不动 SKILL.md frontmatter.

缺则起草补全后给用户审, **不反向问用户**.

### 3. 起草 §同类 Skill 对比 (own · external 必跑, case 跳过)

按 `templates/section-同类对比.md` 渲染. 起草时:

- **内部候选 (≤3)**: 跑 `tfs list --json` 看公司库现有 skill, 选最相近的
- **外部候选 (≤3)**: web search "<关键词> claude skill / agent" 找外部对标; 每个 `WebFetch` 验活 (HTTP 200 + 是 skill 不是博文)
- **独特价值**: ≤3 句, 每句 ≤30 字, 具体到能力 / 场景 / 输出. NEVER 写 "更快 / 更好 / 更优雅 / 更轻量" 这类无名词形容词句

落点:

- **own**: `own-skills/<name>/SKILL.md`, `## When to use` 之后
- **external**: `external-skills/<name>/SKILL.md`, `## 推荐场景` 之后

### 4. 起草 §使用技巧 (own · external 必跑, case 跳过)

按 `templates/section-使用技巧.md` 渲染. 3 子段:

- **材料方案**: 用之前 user 该准备什么 (文件 / spec / context / 工具). 列具体 input.
- **推荐用法**: 典型场景 + prompt 模板.
- **已知限制**: 不能做什么 / 边界 / 已知 bug.

约束: 每子段 ≤3 bullet, 全段 ≤9 bullet ≤500 字. 与 §同类对比 焦点严格分离 — 横向 vs 纵向, 互不引用.

落点同 §同类对比, 紧接其后.

### 5. 起草 case-file (external · case 必跑, own 跳过)

按 `templates/case-file.md` 渲染. 落点: `external-skills/<name>/cases/<recommender>.md`.

frontmatter 三必填: `recommender` / `recommended_at` / `reason_kind` (8 枚举之一).

**同名 recommender 已存在** → append 新场景到 body 末尾, 用二级标题 `## <new scenario tag>` 起新段. **不开第二份文件** (e.g. `<recommender>-1.md`).

### 6. 起草 PR title + body

**title**: `skill: 加 <name> (own | external | case)` — ≤ 70 字符.

**body**: 按 `templates/pr-body.md` 选对应 variant 渲染, 填齐每个 `{占位符}`. 自检清单逐项评估:

- AI 能直接判定 (文件存在 / frontmatter 字段齐) → 自己勾 `- [x]`
- AI 不能判定 (本地 dogfood 跑过) → 留 `- [ ]` 让用户回答 / N/A → 改 `- [~] N/A — 一句原因`
- 不允许偷偷换成"已勾", 不允许整段删自检清单

### 7. 预览门禁 (HARD)

**完整渲染**给用户审: frontmatter + §同类对比 + §使用技巧 + case-file (如有) + PR title + body 全部, markdown 形式.

输出格式:

```
=== 发布预览 ===
路径: own | external | case
分支: skill/<name>
目标目录 / 文件: <列出>

PR title: <title>

PR body (从 templates/pr-body.md variant=<...> 渲染):
---
<完整 body markdown — 每段标题原样保留>
---

§同类对比 摘要 (own/external): <1 句 / "暂无">
§使用技巧 摘要 (own/external): <1 句 / "暂无">
case-file 摘要 (external/case): <1 句 / "暂无">

自检清单完成度: <勾 X / 共 Y / N/A Z>
未勾项 (需用户回答): <逐条列出, 或写"无">

风险点 (自动检测): <列出, 或 N/A>

[1] 确认发, 跑完整提交流程 (切分支 → 写文件 → build:index → push → gh pr create)
[2] 我改 X (你给指示, AI 改后重新跑本预览)
[3] 取消, 不发
```

**阻塞规则**:

- 拿 `[1]` → 执行 §8
- 拿 `[2]` → 改后**重新跑整个 §7** (不能跳过第二次预览)
- 拿 `[3]` → 中止, **不动公司库任何文件**, 不切分支
- 用户沉默 / 给出非 `[1] [2] [3]` 回复 → MUST NOT 执行 §8, 重问一次

NEVER 在拿 `[1]` 之前动公司库文件.

### 8. 提交 (仅 §7 拿到 [1] 后执行)

按 path 决定改动:

| path | 改动 | git add 目标 |
|---|---|---|
| own | `cp -r $SRC $REPO/own-skills/<name>/` | `own-skills/<name>/` + `index.json` |
| external | 写 `$REPO/external-skills/<name>/SKILL.md` (薄指针 + §推荐场景 + §同类对比 + §使用技巧) + `cases/<recommender>.md` | `external-skills/<name>/` + `index.json` |
| case | append `## <scenario>` 到 `$REPO/external-skills/<name>/cases/<recommender>.md` (或新建); 不动 SKILL.md | 该 case 文件 + `index.json` (仅当 description 因 case 变了) |

执行:

```bash
cd $REPO
git checkout main && git pull --ff-only
BRANCH="skill/$NAME"          # e.g. skill/auth-helper
git checkout -b $BRANCH

# 按 path 写文件 (上表)
# ...

# 重新生成 index.json (公司库 root, npm run build:index zero-dep)
npm run build:index

# commit (path-specific git add — 上表)
git add <按 path 决定>
git commit -m "skill: 加 $NAME ($PATH_TYPE)"

# push 到 origin
git push -u origin $BRANCH
```

### 9. 提 PR (仅 §8 全部成功后)

```bash
gh pr create --base main --head $BRANCH \
  --title "<§6 起草的 title>" \
  --body "$(cat <<'EOF'
<§6 起草的 body>
EOF
)"
```

成功 → 输出 PR URL 给用户. 失败 (gh auth / network) → 报错 + **不重试** (用户可能要 `gh auth login` 或检查网络).

## Hard rules

- ❌ **不静默走 `gh pr create`** — 必须用户拍 `[1]`, 才执行 §8 + §9
- ❌ **不直推 main** — 一定走 `skill/<name>` 分支
- ❌ **不动公司库任何文件 until §8** — §1-7 全部是起草, 不写盘
- ❌ **起草后必须完整 markdown 渲染给用户审** (不能只说"已起草, 我走了")
- ❌ **必须按 `templates/` 渲染** — 不允许换成 GitHub 通用 `## Summary / ## Validation / ## Test plan / ## Rollback` 这些段
- ❌ **`npm run build:index` 必须跑** — 若漏跑, PR CI 会 fail (CI 会 validate index.json 是否 up-to-date)
- ❌ **`gh` 失败 → 报错给用户, 不重试** — 不假装成功
- ❌ **不接 router 范围意图** (search / install / list / update / uninstall / doctor)
- ❌ **不跨仓 PR** — tranfu-publish 只发到 `tranfu-labs/tranfu-skills`, 别的仓走别的 skill
- ❌ **永远不 force push** — 即使 PR 已开, 改动重新切分支提新 commit
- ❌ **不删现有 skill** — publish 是新增 / 改 / 加 case, 不删 (删要单独走管理流程)
- ❌ **不开同名 recommender 的第二份 case 文件** — append 到已有那份, 用 `## <新场景>` 起新段

## 常用工具

- `gh repo clone / view` — 验公司库可访问 / 找本地 clone
- `git checkout -b skill/<name>` — 切分支 (永远不动 main)
- `npm run build:index` — 公司库 root 跑, 重新生成 index.json
- `gh pr create --base main --head <branch>` — 提 PR
- `tfs list --json` — 查公司库现有 skill 做同类对比
- `tfs install <name>` — 用户在自己机器验自己 publish 的 skill
- `WebSearch` / `WebFetch` — external 路径找外部 skill 对标 + 验活
