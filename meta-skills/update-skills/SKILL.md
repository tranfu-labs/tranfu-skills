---
name: update-skills
description: 当用户说"更新公司 skill 缓存 / 同步公司库 / 拉最新"时, git pull 缓存仓库, 并把更新后的 4 个 meta-skill 副本 (从 meta-skills/ 子目录拍扁) 覆盖到当前 runtime 的 user 级 skill 目录 (Claude Code → ~/.claude/skills/, Codex CLI → ~/.codex/skills/)
version: 0.2.0
author: aquarius-wing
updated_at: 2026-05-12
origin: own
---

# Update local cache of aistore-labs/claude-skills

## When to use

用户主动要求更新缓存. 触发语示例:
- "更新公司 skill 缓存"
- "拉公司库最新"
- "同步 aistore-labs"
- "看看公司库有什么新东西"

**不要**自动定时跑. 不要在 SessionStart 跑. 仅用户主动触发.

## Constants

- 缓存路径: `~/.aistore-labs/claude-skills/`
- 缓存内仓库结构: `meta-skills/`, `own-skills/`, `external-skills/` 三个子目录
- 4 个 meta-skill 缓存源路径: `~/.aistore-labs/claude-skills/meta-skills/{publish-skill,search-skills,install-skill,update-skills}/`
- 加载点 (扁平, 按 runtime): `$TARGET_SKILLS_USER/{publish-skill,search-skills,install-skill,update-skills}/`, 详见 [RUNTIME.md](../../RUNTIME.md) 第 1 节

## Steps

### 0. 运行时识别

按 [RUNTIME.md](../../RUNTIME.md) 第 2 节识别你自己, 取到 `$TARGET_SKILLS_USER` (e.g. `~/.claude/skills` 或 `~/.codex/skills`)。默认自报身份, 别问用户。后续 cp 目标都用这个变量。

### 1. 预检查

```bash
cd ~/.aistore-labs/claude-skills/
status=$(git status -s)
```

若 status 非空 (有 uncommitted 变更, 通常是 publish-skill 中态):

> "缓存里有 uncommitted 变更 — 看起来你在某次 publish 中态. 先完成 publish 还是 stash?"

不强制处理, 由用户决定.

### 2. git pull (失败大声报错)

```bash
cd ~/.aistore-labs/claude-skills/
git fetch
git pull --ff-only
```

任一步失败 → 把错误**完整输出**给用户, 不静默. (用户主动触发, 知道发生了什么是必要的)

### 3. Diff 出新增/更新 skill

```bash
cd ~/.aistore-labs/claude-skills/
git diff HEAD@{1}..HEAD --name-only -- '*/*/SKILL.md' | sort -u
```

按 path 解析: `<category>/<skill-name>/SKILL.md` → skill = `<skill-name>`, category ∈ {meta-skills, own-skills, external-skills}.

分类:
- 之前不存在 SKILL.md, 现在存在 = 新增
- 之前存在, version 字段变化 = 更新

### 4. 升级 4 个 meta-skill 副本 (从 meta-skills/ 拍扁到 $TARGET_SKILLS_USER)

for skill in publish-skill search-skills install-skill update-skills:

```bash
cache_path=~/.aistore-labs/claude-skills/meta-skills/$skill
local_path=$TARGET_SKILLS_USER/$skill

# 取 version
cache_v=$(grep -E '^version:' "$cache_path/SKILL.md" | head -1 | awk '{print $2}')
local_v=$(grep -E '^version:' "$local_path/SKILL.md" | head -1 | awk '{print $2}' 2>/dev/null || echo "missing")

if [ "$cache_v" != "$local_v" ]; then
  # 升级 (cp 覆盖, 不 rm)
  cp -r "$cache_path/" "$local_path/"

  meta_upgraded+=("$skill: $local_v -> $cache_v")
fi
```

(LLM 用真实 yq 或 grep 实现, 上为伪码)

若有任何 meta-skill 升级了, 通知用户:

> "meta-skill 自我升级:
>  - publish-skill: 0.1.0 -> 0.1.1
>  - search-skills: 0.1.0 -> 0.2.0
>  下次会话生效."

### 5. 报告普通 skill 的新增/更新

```
公司库本次更新:
- 新增: <name1>, <name2>
- 更新: <name3> (0.1.2 -> 0.1.3)

想装哪个? 用 install-skill 触发.
```

若没有任何新增/更新:

> "公司库没有变化."

### 6. dogfood log

```bash
echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"actor\":\"$(gh api user -q .login)\",\"event\":\"update\",\"runtime\":\"<claude-code|codex-cli>\",\"ok\":true,\"new\":<N1>,\"updated\":<N2>,\"meta_upgraded\":[<list>]}" \
  >> ~/.aistore-labs/claude-skills/.dogfood-r1.log
```

## Failure modes

- 缓存目录不存在 → 提示用户先 bootstrap
- git fetch 网络失败 → 完整报错给用户, 让用户检查网络/auth
- git pull 非 ff (有本地 commit 没 push) → 报错, 提示 "本地有未推送 commit, 先解决 (push / 撤销 / stash)"
- meta-skill 升级时 cp 失败 (权限/磁盘) → 该 skill 不升级, 其他继续, 末尾汇报失败列表
- `$TARGET_SKILLS_USER/<meta-skill>/` 不存在 (用户删了或 bootstrap 不全) → 不当成升级, 当成首次 cp 处理

## What NOT to do

- ❌ 不在没有 git pull 成功时就 cp meta-skill (避免覆盖到旧版)
- ❌ 不主动 install 任何非 meta-skill — 仅汇报, 安装由用户单独触发 install-skill
- ❌ 不静默任何错误
- ❌ 不调子 Agent
- ❌ 不在 update 时改 frontmatter 任何字段
- ❌ 不 git push (update 是只读, 仅 pull)
