---
name: publish-skill
description: 当用户说"把本地 skill X 发到公司库 / 共享出去 / 推上去 aistore-labs"时, 完成发布流程 — 检测/补全 frontmatter, 复制到缓存仓库, 创建 PR, 回填本地标记
version: 0.1.0
author: aquarius-wing
updated_at: 2026-05-09
origin: own
---

# Publish a local skill to aistore-labs/claude-skills

## When to use

用户明确要求把某个本地 skill 共享到公司库. 触发语示例:
- "把这个 skill 发布到公司库"
- "把本地 my-cool-skill 共享出去"
- "推到 aistore-labs"
- "推荐一个外部 skill 到公司库" (走 origin=external 分支)

## Constants

- 公司仓库: `aistore-labs/claude-skills`
- 缓存路径: `~/.aistore-labs/claude-skills/`

## Steps

### 1. 定位本地 skill

询问用户 skill 名 (若未明确). 检查路径:
- `~/.claude/skills/<name>/SKILL.md`
- 当前 project 的 `.claude/skills/<name>/SKILL.md`

读 SKILL.md frontmatter.

### 2. 检测发布历史

读本地 frontmatter 的 `published_to` 字段:

- 有 `published_to: aistore-labs/claude-skills` → 走"更新"分支 (步骤 4)
- 没有 → 走"全新"分支 (步骤 3)

### 3. 全新发布的字段补全

必填字段检查; 缺则按以下方式补:

| 字段 | 补全方式 |
|---|---|
| name | 用目录名 (kebab-case 校验) |
| description | 询问用户 (≤ 100 字, 含触发场景) |
| version | 默认 `0.1.0` |
| author | 默认 `gh api user -q .login`, 询问用户是否改成原作者 |
| updated_at | `date -u +%Y-%m-%d` |
| origin | **询问用户**: own 还是 external? external 必须再问 source_url + recommend_reason |

**不写** `published_to / published_version / published_at` — 步骤 8 才回填.

### 4. 更新发布的 bump 决策

- 默认 patch +1 (e.g. 0.1.0 → 0.1.1)
- 用户显式说 "bump minor" → +0.1.0 重置 patch (0.1.5 → 0.2.0)
- 用户显式说 "bump major" → +1.0.0 重置 minor/patch (0.5.0 → 1.0.0)
- bump 跨过 1.0.0 边界 (即 0.x.y → 1.0.0) **强提示**:
  > "这是 1.0.0 大版本 bump, 需要人手动 review approve, 不能 self-merge.
  >  commit message 会加 [MAJOR] 前缀."

写入新 version + 更新 updated_at.

### 5. 复制到缓存仓库

```bash
cd ~/.aistore-labs/claude-skills/
git checkout main
git pull --ff-only

# 唯一分支名
ts=$(date +%s)
git checkout -b "contrib/<skill-name>-$ts"

# 更新场景: 先清空再 cp
[ -d "<skill-name>" ] && rm -rf "<skill-name>/"

# 拷贝
cp -r "<local-skill-path>/" "<skill-name>/"
```

### 6. Commit

```bash
cd ~/.aistore-labs/claude-skills/
git add "<skill-name>/"

# major 时加 [MAJOR] 前缀
prefix=""
[ "<is-major-bump>" = "true" ] && prefix="[MAJOR] "

git commit -m "${prefix}<skill-name>: <description-one-liner ≤ 70 字>"
```

### 7. 创建 PR

```bash
gh pr create \
  --title "${prefix}<skill-name>: <same as commit message>" \
  --body "$(cat <<'EOF'
## 这个 skill 干什么
<2–3 句, 从 description 扩展>

## 为什么写它 / 推荐它
<用户提供的动机, 一段>

## 触发场景
<1–3 个用户语句例子>

## 谁可能受益
<角色: 前端 / 设计 / 运维 / ...>

## origin
<own | external + source_url + recommend_reason>
EOF
)"
```

把生成的 PR URL 反馈给用户:

> "PR 已开 <url>. 等 review merge. 我已经把发布标记写回你本地的 SKILL.md frontmatter."

### 8. 回填本地 SKILL.md frontmatter (PR 创建后立即, 不等 merge)

在本地 skill (步骤 1 找到的路径) 的 SKILL.md frontmatter 加/更新 3 个字段:

```yaml
published_to: aistore-labs/claude-skills
published_version: <步骤 4 决定的 version>
published_at: <步骤 5 的 date>
```

### 9. dogfood log

```bash
echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"actor\":\"$(gh api user -q .login)\",\"event\":\"publish\",\"skill\":\"<name>\",\"pr\":\"<url>\",\"origin\":\"<own|external>\",\"version\":\"<version>\"}" \
  >> ~/.aistore-labs/claude-skills/.dogfood-r1.log
```

## Failure modes

- `gh auth status` 失败 → 让用户 `gh auth login`, 不代办 token
- `git pull --ff-only` 失败 (本地有冲突) → 提示用户先解决, AI 不强 reset
- `gh pr create` 网络失败 → 提示晚点重试, **本地 commit 不丢** (用户自己可后跑 `gh pr create`)
- 缓存里同名 skill 不是用户先前发布的 (即 cache 有 X, 用户本地 published_to 没填但要发 X) → 提示 "缓存已有同名 skill, 改本地名 / 当作更新发?"
- bump 过程用户改主意 → 重新询问

## What NOT to do

- ❌ 不反向问用户填 5 个字段 — frontmatter 缺啥 AI 自己补全/推断, 用户只**确认/纠正**
- ❌ 不直 push main, 必走 PR
- ❌ PR body 不塞 risk / test plan / rollback 段 (产品仪式)
- ❌ 不在 PR 里塞 emoji 标题
- ❌ 不调子 LLM (Task tool) — 按字面跑 bash
- ❌ 不在用户没说 "bump major" 时自动 bump major — 默认 patch
