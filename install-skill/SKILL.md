---
name: install-skill
description: 当用户说"装公司 skill X 到 ___"时, 从缓存复制到 user 或 project scope; external 时走 source_url 拉最新并回写 cache stub
version: 0.1.0
author: aquarius-wing
updated_at: 2026-05-09
origin: own
---

# Install a skill from cache to user/project scope

## When to use

用户已知 skill 名字 (通常通过 search-skills 看到), 要求装到本地. 触发语示例:
- "装第 2 个到 user 级"
- "把 my-cool-skill 装到当前 project"
- "安装公司 skill X 到用户级"

## Constants

- 缓存路径: `~/.aistore-labs/claude-skills/`
- user 级路径: `~/.claude/skills/`
- project 级路径: `<cwd>/.claude/skills/`

## Steps

### 1. 确认 skill 在缓存

```bash
ls "~/.aistore-labs/claude-skills/<name>/SKILL.md"
```

不存在 → 提示用户:
> "缓存里没有 '<name>'. 要不要先 update-skills 拉最新? 或检查名字拼写?"

读该 SKILL.md frontmatter 拿 origin / source_url.

### 2. 强制问 scope

无论用户是否在请求里写了 scope, **明确二次确认**:

```
装到哪里?
① user 级 (~/.claude/skills/, 所有项目都能用)
② 当前 project 级 (<cwd>/.claude/skills/, 仅本 project)
```

(如果用户已经在请求里说了 "user 级", 这一问可以快速 "你说 user 级, 确认?")

### 3. 检测目标冲突

```bash
ls "<target>/<name>/" 2>/dev/null
```

存在 →

```
<target>/<name>/ 已存在. 怎么办?
① 覆盖 (会丢失本地修改)
② 跳过 (取消安装)
③ 装到别的名字 (e.g. <name>-v2)
```

### 4. 执行复制

#### 4a. origin=own

直接 cp:
```bash
cp -r ~/.aistore-labs/claude-skills/<name>/ <target>/<name>/
```

#### 4b. origin=external

需要走 source_url 拉最新:

```bash
# 临时下载点
tmp=$(mktemp -d)

# 根据 source_url 形式选实现 (LLM 判断):
# - source_url 是 raw GitHub URL → curl -L
# - source_url 是 GitHub repo 子路径 → gh repo clone --depth 1 + cp 子目录
# - source_url 是普通 URL → curl -L
# 都失败 → 退回到使用缓存 stub (告知用户"无法拉最新, 用缓存版本")

# 假设是 raw github url 形式 SKILL.md (常见):
curl -L "$source_url" -o "$tmp/SKILL.md"
# 如果 source 是整个目录, 要 git clone 上游 repo + cp 子树
# 这里 LLM 判断 + 执行

# 拷到目标
mkdir -p "<target>/<name>/"
cp -r "$tmp/"* "<target>/<name>/"
rm -rf "$tmp"
```

下载失败 → 提示用户 "拉 source_url 失败, 是否退回用缓存 stub?"

### 5. 若 external — 回写 cache stub

读步骤 4b 拉到的最新 SKILL.md frontmatter, 抽 name / description / version.

```bash
# 比对 cache stub
cache_stub=~/.aistore-labs/claude-skills/<name>/SKILL.md
# 抽 cache stub 的 name/description/version

# 若任一不同 → patch cache stub frontmatter (仅 frontmatter, 保留 body 薄指针文案)
# 检测实质变化:
# - version 字面 != → 实质
# - description 字面差异: 计算 abs(len(new) - len(old)) / max(len) > 0.2 → 实质
# - 其他变化 → 非实质 (typo / 标点)
```

#### 5a. 仅本地 patch (非实质变化)

直接 sed/yq 改 cache stub 的 frontmatter, 不 commit。

#### 5b. 自动 PR (实质变化)

```bash
cd ~/.aistore-labs/claude-skills/
git checkout main && git pull --ff-only
ts=$(date +%s)
git checkout -b "refresh/<name>-$ts"

# patch frontmatter 后:
git add "<name>/SKILL.md"
git commit -m "refresh: <name> metadata from upstream"

gh pr create \
  --title "refresh: <name> metadata from upstream" \
  --body "$(cat <<'EOF'
## 自动元数据刷新

由 install-skill 在用户安装时检测到 source_url 上游变化:

| 字段 | old | new |
|---|---|---|
| version | <old> | <new> |
| description | <old, 截断> | <new, 截断> |

仅 frontmatter 更新, body 保持薄指针.
EOF
)"
```

### 6. 告知用户

```
已装到 <target>/<name>/. 重启 Claude Code 或新会话即可触发该 skill.

[若 external 触发了 cache stub refresh 自动 PR:]
顺便: 检测到 upstream 有更新, 已自动开 PR <url> refresh cache stub.
```

### 7. dogfood log

```bash
extra=""
[ "<origin>" = "external" ] && extra=",\"cache_refresh\":\"<status: none|local-patch|pr-opened>\""

echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"actor\":\"$(gh api user -q .login)\",\"event\":\"install\",\"skill\":\"<name>\",\"scope\":\"<user|project>\",\"origin\":\"<origin>\"$extra}" \
  >> ~/.aistore-labs/claude-skills/.dogfood-r1.log
```

## Failure modes

- 缓存里没有该 skill → 提示 update-skills 或检查名字
- 目标路径父目录不存在 → mkdir -p
- external source_url 拉失败 → 退回缓存 stub + 告知用户
- 回写 cache stub 失败 (sed/yq 报错) → 不阻塞 install 本身; warn 用户 "stub 元数据未刷新, 下次 install 时再试"

## What NOT to do

- ❌ 不默认 scope — 强制问 (硬约束)
- ❌ 不用 symlink (update 后用户无意识被换掉)
- ❌ 不在 install 时改用户本地原 skill 任何字段
- ❌ external 时不在用户没确认前就直接 git push refresh PR — 该 PR 是自动开的, 但分支命名 + 不直推 main, 留 reviewer 拒绝余地
- ❌ 不调子 Agent
- ❌ 不在用户中断时留下半装状态 (用 mktemp + 末尾原子 cp)
