---
name: publish-skill
description: 当用户说"把本地 skill X 发到公司库 / 共享出去 / 推上去 aistore-labs"时, 完成发布流程 — 检测/补全 frontmatter, 补 README.md, 按 origin 落到 own-skills/ 或 external-skills/ 子目录, 按 checklist 模板创建 PR, 回填本地标记
version: 0.1.2
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
- 仓库子目录映射 (按 origin):
  - `origin: own` → `own-skills/`
  - `origin: external` → `external-skills/`
  - `meta-skills/` 仅由仓库维护者直接编辑, **publish-skill 不写 meta-skills/**
- meta-skill 名单 (publish-skill 拒绝发布): `publish-skill / search-skills / install-skill / update-skills`

## Steps

### 1. 定位本地 skill + 拒绝 meta-skill

询问用户 skill 名 (若未明确). 检查路径:
- `~/.claude/skills/<name>/SKILL.md`
- 当前 project 的 `.claude/skills/<name>/SKILL.md`

如果 `<name>` 命中 meta-skill 名单 (publish-skill / search-skills / install-skill / update-skills) → 立即拒绝:

> "<name> 是 meta-skill, 由仓库维护者直接编辑 meta-skills/, 不通过 publish-skill 发布。如果你要改 meta-skill, clone aistore-labs/claude-skills 直接改 meta-skills/<name>/ 然后 PR。"

否则读 SKILL.md frontmatter, 进入步骤 2.

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

### 3.5. README.md 补全 (使用者视角)

SKILL.md 是给 LLM 读的; 仓库 PR body 是给 reviewer 读的. **README.md 是给用户读的** —— 单独检查/补全:

读 `<local-skill-path>/README.md`:

- **不存在** → AI 直接基于 SKILL.md 起一稿, 询问用户确认 (不让用户从零写)
- **存在但缺章节** → 补缺的; 已有的不动

README.md 必含以下 4 段 (用户视角, 不是开发者视角):

```markdown
# <skill-name>

<1-2 句话, 它解决什么问题. 不写"实现细节", 写"用户能拿它干什么">

## 什么时候用它

<具体场景描述, 比 frontmatter description 详细一点>

## 怎么用 (触发示例)

跟 Claude 说:

- "<触发语 1>"
- "<触发语 2>"
- "<触发语 3>"

## 你会看到什么

<它跑完后用户能观察到的输出 / 副作用. e.g. "终端打印 X / 仓库多一个 PR / 文件夹多了 Y">
```

补完让用户**确认或改**, 不强推. 确认后写到 `<local-skill-path>/README.md`.

### 4. 更新发布的 bump 决策

- 默认 patch +1 (e.g. 0.1.0 → 0.1.1)
- 用户显式说 "bump minor" → +0.1.0 重置 patch (0.1.5 → 0.2.0)
- 用户显式说 "bump major" → +1.0.0 重置 minor/patch (0.5.0 → 1.0.0)
- bump 跨过 1.0.0 边界 (即 0.x.y → 1.0.0) **强提示**:
  > "这是 1.0.0 大版本 bump, 需要人手动 review approve, 不能 self-merge.
  >  commit message 会加 [MAJOR] 前缀."

写入新 version + 更新 updated_at.

### 5. 复制到缓存仓库 (按 origin 落对应子目录)

```bash
cd ~/.aistore-labs/claude-skills/
git checkout main
git pull --ff-only

# 唯一分支名
ts=$(date +%s)
git checkout -b "contrib/<skill-name>-$ts"

# 按 origin 决定 subdir
case "<origin>" in
  own)      subdir=own-skills ;;
  external) subdir=external-skills ;;
  *)        echo "BUG: unknown origin <origin>"; exit 1 ;;
esac

# 更新场景: 已存在则 cp 覆盖 (不 rm)
mkdir -p "$subdir/"
cp -r "<local-skill-path>/" "$subdir/<skill-name>/"
```

### 6. Commit

```bash
cd ~/.aistore-labs/claude-skills/
git add "$subdir/<skill-name>/"

# major 时加 [MAJOR] 前缀
prefix=""
[ "<is-major-bump>" = "true" ] && prefix="[MAJOR] "

git commit -m "${prefix}<subdir>/<skill-name>: <description-one-liner ≤ 70 字>"
```

### 7. 创建 PR (checklist 模板, 直接填)

PR body 是给 **reviewer** 看的 —— 是检查项, 不是介绍文. 用户视角的介绍在 skill 自带的 README.md.

模板按下面顺序逐项填; 不存在的项写 N/A, 不要删项:

```bash
gh pr create \
  --title "${prefix}<skill-name>: <≤70字 一句话>" \
  --body "$(cat <<'EOF'
## 元信息

- skill: <name>
- version: <version> (此次: <new vs old, 或 first publish>)
- origin: <own | external>
- author (frontmatter): <handle>
- source_url (external 必填): <url 或 N/A>

## 自检清单 (作者勾)

- [ ] frontmatter 5 必填齐全: name / description / version / author / updated_at
- [ ] description ≤ 100 字, 包含触发场景
- [ ] origin 字段正确 (external 须含 source_url + recommend_reason)
- [ ] README.md 存在且含 4 段: 介绍 / 什么时候用 / 触发示例 ≥3 / 期望输出
- [ ] SKILL.md 含 When to use / Steps / What NOT to do
- [ ] 触发语写法是用户视角 (不是 "调用此 skill 当...", 而是"用户说 ...")
- [ ] 本地 dogfood: 至少跑过 1 次完整流程, 输出符合预期
- [ ] 不在子目录嵌套其他 skill, 不引入需要额外手动安装的二进制

## 不在范围 (告诉 reviewer 不用查)

- <e.g. 不需要测网络异常 / 不依赖 API key / 不修改用户原文件 ...>

## 风险点 (有则填, 无则 N/A)

- <e.g. 这个 skill 会 git push, reviewer 注意确认目标分支>

## 推荐理由 (1 段, external 时填 recommend_reason 原文)

<...>
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
- 缓存里同名 skill 不是用户先前发布的 (即 cache 有 X, 用户本地 published_to 没填但要发 X) → 提示 "缓存已有同名 skill (位置: <subdir>/X), 改本地名 / 当作更新发?"
- 用户的 origin=own skill 与 cache 里 `external-skills/<同名>` 冲突 (反之亦然) → 报错让用户改名, 不允许跨子目录覆盖
- bump 过程用户改主意 → 重新询问

## What NOT to do

- ❌ 不反向问用户填 5 个字段 — frontmatter 缺啥 AI 自己补全/推断, 用户只**确认/纠正**
- ❌ 不直 push main, 必走 PR
- ❌ PR body 不塞 risk / test plan / rollback 段 (产品仪式)
- ❌ 不在 PR 里塞 emoji 标题
- ❌ 不调子 LLM (Task tool) — 按字面跑 bash
- ❌ 不在用户没说 "bump major" 时自动 bump major — 默认 patch
