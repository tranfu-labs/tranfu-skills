---
name: search-skills
description: 当用户说"搜公司 skill 关于 X / 看看公司库有没有 Y / 列一下公司 skill"时, grep 缓存仓库 SKILL.md frontmatter 返回匹配项
version: 0.1.0
author: aquarius-wing
updated_at: 2026-05-09
origin: own
---

# Search aistore-labs/claude-skills cache

## When to use

用户问公司库里是否有某类 skill. 触发语示例:
- "搜公司 skill 关于 UI 设计的"
- "公司库有没有 typescript 类型推断的 skill"
- "看看 aistore-labs 有什么 skill"
- "列一下公司 skill"

## Constants

- 缓存路径: `~/.aistore-labs/claude-skills/`
- 跳过的目录: `publish-skill`, `search-skills`, `install-skill`, `update-skills` (4 个 meta-skill 自身)
- 跳过的目录: 任何 `.` 或 `_` 开头的目录

## Steps

### 1. 解析关键词

从用户语句抽取关键词. 简单规则:
- 砍掉 "搜 / 公司 / skill / 关于 / 的" 等套话
- 剩下的按空格 split, lowercase
- 中文不做分词, 整词当 substring

例:
- "搜公司 skill 关于 UI 设计的" → `["ui", "设计"]`
- "公司库有没有 ts 类型推断" → `["ts", "类型推断"]` (类型推断作为整词)

### 2. 列出候选 skill 目录

```bash
cd ~/.aistore-labs/claude-skills/
ls -1 | grep -v '^\.' | grep -v '^_' \
  | grep -vE '^(publish-skill|search-skills|install-skill|update-skills)$'
```

### 3. 读每个 SKILL.md frontmatter

对每个候选目录 D:

```bash
cat "$D/SKILL.md" | sed -n '1,/^---$/p; /^---$/,/^---$/p' | head -30
```

抽 `name` / `description` / `version` / `author` / `origin` 字段.

(若用 yq / python -c 解析更稳, LLM 自选实现)

### 4. 匹配评分

对每个 skill, 计算命中分:
- 关键词 in name (lowercase) → +2
- 关键词 in description (lowercase, 中文 substring) → +1
- 同一关键词重复命中只算一次

跳过: 0 命中的 skill.

### 5. 排序

按命中分 desc; 同分按 frontmatter `updated_at` desc.

### 6. 返回 top N (N = min(命中数, 10))

格式:

```
找到 N 个相关 skill:

1. <name>  (v<version>, by <author>, origin=<own|external>)
   <description>

2. <name>  (...)
   ...
```

### 7. 提示下一步

```
想装哪个? 我可以帮你装到 user 级 (~/.claude/skills/) 或当前 project (.claude/skills/).
说 "装第 N 个到 user/project" 触发 install-skill.
```

### 8. 0 命中分支

```
公司库没找到匹配 "<关键词>" 的 skill. 可选:
① 用更宽的关键词重搜 (告诉我换什么词)
② 你自己写一个再 publish-skill 发布
③ 找一个外部 skill, 我帮你 publish-skill --origin external 推荐
```

### 9. dogfood log

```bash
echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"actor\":\"$(gh api user -q .login)\",\"event\":\"search\",\"query\":\"<关键词以逗号 join>\",\"matches\":<N>}" \
  >> ~/.aistore-labs/claude-skills/.dogfood-r1.log
```

## Failure modes

- 缓存目录不存在 → 提示用户先 bootstrap (在 README 找两步命令)
- 缓存里 0 个非 meta skill → 提示 "公司库还没有 own/external skill, 用 publish-skill 发一个"
- frontmatter 解析失败 (该 skill 缺 SKILL.md 或 frontmatter 损坏) → skip 该 skill, 继续其他, 末尾警告 "X 个 skill frontmatter 异常, 跳过"

## What NOT to do

- ❌ 不调 LLM 做语义搜索 — 按字面 grep + 关键字命中评分
- ❌ 不调子 Agent (Task tool)
- ❌ 不主动 install — 用户必须二次确认装哪个
- ❌ 不打开任何编辑器/浏览器
- ❌ 不在搜索过程中修改任何文件 (read-only 操作; 仅末尾 append 一行 dogfood log)
- ❌ 不返回超过 10 个结果 (信噪比下降)
