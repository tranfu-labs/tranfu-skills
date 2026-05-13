---
name: search-skills
description: 当用户说"搜公司 skill 关于 X / 看看公司库有没有 Y / 列一下公司 skill"时, grep 缓存仓库 SKILL.md frontmatter (跨 meta-skills / own-skills / external-skills 三个子目录) 返回匹配项
version: 0.1.2
author: aquarius-wing
updated_at: 2026-05-13
origin: own
---

# Search tranfu-labs/tranfu-skills cache

## When to use

用户问公司库里是否有某类 skill. 触发语示例:
- "搜公司 skill 关于 UI 设计的"
- "公司库有没有 typescript 类型推断的 skill"
- "看看 tranfu-labs 有什么 skill"
- "列一下公司 skill"

## Constants

- 缓存路径: `~/.tranfu-labs/tranfu-skills/`
- 三个子目录都搜: `meta-skills/`, `own-skills/`, `external-skills/`
- meta-skills 默认**包含**在结果里, 但条目末尾标 `[meta]` (用户搜 "publish" 时找得到 publish-skill, 不藏)
- 跳过任何 `.` 或 `_` 开头的目录, 跳过 `external-skills/.gitkeep` 这类占位文件

## Steps

### 0.5. 旧缓存路径迁移 (一次性兼容)

公司库经历两次改名: `aistore-labs/claude-skills` → `tranfu-labs/claude-skills` → `tranfu-labs/tranfu-skills`. 如检测到任一老缓存且新路径不在, 静默迁移并修 git remote:

```bash
for old in ~/.aistore-labs/claude-skills ~/.tranfu-labs/claude-skills; do
  if [ -d "$old" ] && [ ! -d ~/.tranfu-labs/tranfu-skills ]; then
    mkdir -p ~/.tranfu-labs
    mv "$old" ~/.tranfu-labs/tranfu-skills
    cd ~/.tranfu-labs/tranfu-skills && \
      git remote set-url origin git@github.com:tranfu-labs/tranfu-skills.git
    break
  fi
done
```

新装用户条件不满足, 静默跳过.

### 1. 解析关键词

从用户语句抽取关键词. 简单规则:
- 砍掉 "搜 / 公司 / skill / 关于 / 的" 等套话
- 剩下的按空格 split, lowercase
- 中文不做分词, 整词当 substring

例:
- "搜公司 skill 关于 UI 设计的" → `["ui", "设计"]`
- "公司库有没有 ts 类型推断" → `["ts", "类型推断"]` (类型推断作为整词)

### 2. 列出候选 skill 目录 (跨 3 个子目录)

```bash
cd ~/.tranfu-labs/tranfu-skills/
ls -1 meta-skills/ own-skills/ external-skills/ 2>/dev/null \
  | grep -E '/$' \
  || find meta-skills own-skills external-skills -maxdepth 1 -mindepth 1 -type d 2>/dev/null
```

实务: 直接 glob `meta-skills/*/ own-skills/*/ external-skills/*/` 拿目录列表, 每条记录 `<category>/<skill-name>` 两段。

### 3. 读每个 SKILL.md frontmatter

对每个候选目录 `<category>/<skill-name>`:

```bash
cat "<category>/<skill-name>/SKILL.md" | sed -n '1,/^---$/p; /^---$/,/^---$/p' | head -30
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

格式 (meta-skill 末尾标 `[meta]`):

```
找到 N 个相关 skill:

1. <name>  (v<version>, by <author>, origin=<own|external>) [meta]?
   <description>

2. <name>  (...)
   ...
```

`[meta]` 标只在 category=meta-skills 时显示, 提示用户这是仓库自带的, 不需要 install (用 update-skills 拉就有)。

### 7. 提示下一步

```
想装哪个? 我可以帮你装到 user 级 或当前 project 级 (具体路径按当前 runtime 决定, 见 RUNTIME.md).
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
  >> ~/.tranfu-labs/tranfu-skills/.dogfood-r1.log
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
