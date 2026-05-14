---
name: tranfu-publish
description: 当用户说"发布本地 skill X 到公司库 / 推荐这个外部 skill (URL) 到公司库 / 把当前 skill 提到 tranfu-skills / 给公司库 X 加使用案例"时, 起草 PR 内容 (frontmatter / §同类对比 / §使用技巧 / PR title+body), 用户审完拍 y 才走 gh pr create. 不接 search / 装 / 列 / 更新 / 卸载意图 (那走 tranfu-router skill).
type: meta
---

# tranfu-publish

把本地写的 skill 发到公司库 (tranfu-labs/tranfu-skills) 走 PR. 起草所有内容 → 用户审 → 用户拍 `y` 才提交.

## 触发判断

接:

| 用户说 | path |
|---|---|
| "发布本地 skill X 到公司库" | **own** 路径: 完整复制 skill 目录到 `own-skills/<name>/` |
| "推荐这个外部 skill (https://...) 给公司库" | **external** 路径: 公司库 `external-skills/<name>/SKILL.md` 是 thin pointer (frontmatter 含 source_url + 推荐者补充: §推荐场景 + §同类对比 + §使用技巧). skill 实际 body 不进公司库 — install 时从 source_url 拉. 参考 `external-skills/andrej-karpathy-skills/SKILL.md`. |
| "给公司库 X 加使用案例 / 补一个用法" | **case** 路径: 在该 skill 的 SKILL.md 追加 `## 案例` 章节 (或在已有 `## 案例` 下加条目). 不动 frontmatter, 不动其他章节. |

**不接** (留给 `tranfu-router`):
- search / install / list / installed / update / uninstall / doctor 意图

## 标准流程

### 0. 前置: 定位两个 path

**$REPO** = 公司库 `tranfu-labs/tranfu-skills` 本地 clone path. 检测优先级:
1. 用户原话给的 path
2. 当前 cwd 含 `.git` 且 `git remote -v` origin 指向 tranfu-skills
3. 常见路径 `~/work/tranfu-skills`
4. 找不到 → 提示用户 `gh repo clone tranfu-labs/tranfu-skills ~/work/tranfu-skills` 再回来

**$SRC** = 本地 skill 源 path (own / case 用; external 不需要):
- **own**: 用户本地 skill 目录, e.g. `~/.claude/skills/<name>` 或他工作目录下的 `<name>/`. 用户原话 / `find ~/.claude/skills -name <name>` 定位.
- **external**: 不需要 (skill body 不进公司库, 仅写 SKILL.md thin pointer).
- **case**: $SRC 即公司库内已有 skill 的 path, e.g. `$REPO/own-skills/<name>/SKILL.md`.

```bash
gh repo view tranfu-labs/tranfu-skills --json sshUrl  # 验仓库可访问
```

### 1. 识别 path

问用户 (或从原话推断): own / external / case 三选一. 不确定时显式问.

### 2. 检查 / 补全 frontmatter (own / external)

必填:
- `name`: 与目录名一致, kebab-case
- `description`: 含触发关键词 + "Do NOT trigger when" 段 (LLM 路由用), ≥ 2 句
- `origin`: own 或 external

可选:
- `version` / `author` / `updated_at` / `recommend_reason` (external 强烈建议)
- `source_url` (external **必填**)

如缺则起草补全后给用户审.

### 3. 起草 §同类 Skill 对比 (own + external 都必做)

- 内部候选 (≤3): 跑 `tfs list --json` 看公司库现有 skill, 选最相近的列出
- 外部候选 (≤3): web search "<关键词> claude skill / agent" 找外部对标
- 独特价值: 一句话 — 为什么这个值得收, 跟上述 6 个相比有何不同

### 4. 起草 §使用技巧 (3 子段)

- **材料方案**: 用之前 user 该准备什么 (文件 / spec / context / 工具). 列具体 input.
- **推荐用法**: 典型场景 + prompt 模板.
- **已知限制**: 不能做什么 / 边界 / 已知 bug.

### 5. 起草 PR title + body

- title: `skill: 加 <name> (own / external / case)` — ≤ 70 字符
- body 含:
  - ## Motivation: 为什么加 / 业务背景
  - ## §同类对比 摘要
  - ## §使用技巧 摘要
  - ## Test plan: 怎么验装上能跑

### 6. 强制门控 (HARD)

**完整渲染** 给用户看: frontmatter + §同类对比 + §使用技巧 + PR title + body 全部, markdown 形式.

问: "审完了, `y` 走完整提交流程 (切分支 → 复制文件 → build:index → push → gh pr create), `n` 中止, 或告诉我哪里改."

`n` → 中止, **不动公司库任何文件**, 不切分支. 修改 → 重审一轮.

### 7. 提交 (仅 step 6 用户拍 y 后执行)

按 path 决定改动:

| path | 改动 | git add 目标 |
|---|---|---|
| own | `cp -r $SRC $REPO/own-skills/<name>/` | `own-skills/<name>/` + `index.json` |
| external | 写 `$REPO/external-skills/<name>/SKILL.md` (含完整推荐者补充, 不是仅 frontmatter — 参考 step 3-4 起草的内容) | `external-skills/<name>/` + `index.json` |
| case | append `## 案例` 章节 / 新条目到 `$REPO/own-skills/<name>/SKILL.md` (或 external-skills/) | 该 SKILL.md + `index.json` (如果 description 因为案例变了) |

执行:

```bash
cd $REPO
git checkout main && git pull --ff-only
BRANCH="skill/$NAME"          # e.g. skill/auth-helper
git checkout -b $BRANCH

# 按 path 复制 / 写文件
case "$PATH_TYPE" in
  own)
    cp -r $SRC $REPO/own-skills/$NAME/
    ;;
  external)
    mkdir -p $REPO/external-skills/$NAME/
    # 写完整 SKILL.md: frontmatter (含 source_url) + ## 推荐场景 + ## 同类 Skill 对比 + ## 使用技巧
    cat > $REPO/external-skills/$NAME/SKILL.md << 'EOF'
<step 2 + 3 + 4 起草的完整内容>
EOF
    ;;
  case)
    # 在已有 SKILL.md 末尾追加 (或 ## 案例 已存在则在它下面加条目)
    # 用 Edit 工具 / sed; 不要 git mv 也不要重写 frontmatter
    ;;
esac

# 重新生成 index.json (公司库 root 已有 npm run build:index, build-index.mjs zero-dep)
npm run build:index

# commit (path-specific git add)
case "$PATH_TYPE" in
  own)      git add own-skills/$NAME index.json ;;
  external) git add external-skills/$NAME index.json ;;
  case)     git add <修改的 SKILL.md> index.json ;;
esac
git commit -m "skill: 加 $NAME ($PATH_TYPE)"

# push 到 origin
git push -u origin $BRANCH
```

### 8. 提 PR (仅 step 7 全部成功后)

```bash
gh pr create --base main --head $BRANCH \
  --title "<step 5 起草的 title>" \
  --body "$(cat <<EOF
<step 5 起草的 body>
EOF
)"
```

成功 → 输出 PR URL 给用户. 失败 (gh auth / network) → 报错 + 不重试.

## Hard rules

- ❌ **不静默走 gh pr create** — 必须用户最后拍 `y`, 才执行 step 7 + 8
- ❌ **不直推 main** — 一定走 `skill/<name>` 分支
- ❌ **不动公司库任何文件 until step 7** — step 1-6 全部是起草, 不写盘
- ❌ **起草后必须完整 markdown 渲染给用户审** (不能只说"已起草, 我走了")
- ❌ **build:index 必须跑** — 若漏跑, PR CI 会 fail (CI 会 validate index.json 是否 up-to-date)
- ❌ **gh 失败 → 报错给用户, 不重试** — 不假装成功; 用户可能需要 `gh auth login` 或检查网络
- ❌ **不接 router 范围的意图** (search / install 等)
- ❌ **不跨仓 PR** — tranfu-publish 只发到 `tranfu-labs/tranfu-skills`, 别的仓走别的 skill
- ❌ **永远不 force push** (`git push --force` / `git push -f`) — 即使 PR 已开, 也不强推; 改动重新切分支提新 commit
- ❌ **不删现有 skill** — publish 是新增 / 改 / 加 case, 不删 (删 skill 要单独走管理流程, 不走这个 skill)

## 常用工具

- `gh repo clone / view` — 验公司库可访问 / 找本地 clone
- `git checkout -b skill/<name>` — 切分支 (永远不动 main)
- `npm run build:index` — 公司库 root 跑, 重新生成 index.json
- `gh pr create --base main --head <branch>` — 提 PR
- `tfs list --json` — 查公司库现有 skill 做同类对比
- `tfs install <name>` — 用户在自己机器验自己 publish 的 skill
- web search — 找外部 skill 对标
