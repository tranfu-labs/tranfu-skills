# UNINSTALL — 完整卸载 aistore-labs/claude-skills

> 这份文档是给 **Claude Code** 看的。用户复制 README.md 里的卸载提示词后, Claude 读到这份 UNINSTALL.md, 按下面流程执行。

## 卸载范围 (默认)

- `~/.claude/skills/` 下的 4 个 meta-skill: `publish-skill` / `search-skills` / `install-skill` / `update-skills`
- `~/.aistore-labs/claude-skills/` 整个缓存目录 (含 `.git` + 所有 skill 副本 + `.dogfood-*.log`)

## 默认保留 (不动)

- 本地非 meta-skill 的 SKILL.md frontmatter 里 `published_to / published_version / published_at` 三字段 — 是审计痕迹, 用户后悔重装时可以查
- 其他公司 skill 通过 `install-skill` 装到本地的副本 — 那是用户主动 cp 的, 不属于 bootstrap, 不动
- 用户自己其他来源的 skill — 当然不动

如果用户主动要求清这些, 单独问一次再清, 不要默认清。

## 步骤

### 1. 二次确认 (硬约束, 不能省)

明确列出要删的内容, 让用户最后确认一次:

```
要卸载 aistore-labs/claude-skills:

会删:
- ~/.claude/skills/publish-skill/
- ~/.claude/skills/search-skills/
- ~/.claude/skills/install-skill/
- ~/.claude/skills/update-skills/
- ~/.aistore-labs/claude-skills/  (含 git 历史 + dogfood log)

会保留:
- 本地 skill 里 published_* frontmatter 标记
- install-skill 装到本地的其他公司 skill

确认?
```

用户 → 否 → 中止, 不做任何动作。
用户 → 是 → 进入步骤 2。

### 2. 预检查缓存里的未提交工作

```bash
cd ~/.aistore-labs/claude-skills/ 2>/dev/null && git status -s
```

输出非空 (说明有未提交的中态, 可能是 publish-skill 的中途 commit/PR) → 警告:

> "缓存里有未提交工作:
> <git status 输出>
> 删掉就丢了。还要继续? (是 / 否 / 让我先 push)"

用户选"否"或"先 push" → 中止/暂停, 不删。

### 3. 删 user 级 4 个 meta-skill

```bash
for s in publish-skill search-skills install-skill update-skills; do
  rm -rf "$HOME/.claude/skills/$s"
done
```

### 4. 删缓存目录

```bash
rm -rf "$HOME/.aistore-labs/claude-skills"
```

注: 只删 `claude-skills` 子目录, 不删 `~/.aistore-labs/` 本身 (将来可能放别的 aistore-labs 资源)。

### 5. 验证

```bash
present=$(ls -1 ~/.claude/skills/ 2>/dev/null | grep -E '^(publish-skill|search-skills|install-skill|update-skills)$' | wc -l | tr -d ' ')
[ -d ~/.aistore-labs/claude-skills ] && cache=exists || cache=gone
echo "user-meta-remaining=$present cache=$cache"
```

期望: `user-meta-remaining=0 cache=gone`。任一不符 → 报告给用户, 不静默。

### 6. 通知用户

```
卸载完成。重启 Claude Code 后, 4 个 meta-skill 不再加载。

保留:
- 本地 skill 的 published_* frontmatter (审计痕迹)
- install-skill 装到本地的其他公司 skill

要清这些请单独说。重新装回来 → 看仓库 README.md 的 bootstrap 段。
```

## Failure modes

- `rm` 报权限 → 让用户用 `sudo` 自己跑, 不代办
- `~/.claude/skills/` 整个不存在 → 当成幂等 success, 跳到下一步
- 缓存目录有 uncommitted 但用户选"先 push" → 引导用户 `cd ~/.aistore-labs/claude-skills && gh pr create`, 等用户处理完再回来重跑

## What NOT to do

- ❌ 不在没二次确认时 `rm` 任何东西
- ❌ 不动 `~/.claude/skills/` 下非 meta-skill 的目录
- ❌ 不改/删本地任何 skill SKILL.md 的 frontmatter
- ❌ 不动 `~/.zshrc` / 环境变量 / shell config (从来没写过, 没东西要清)
- ❌ 不递归删 `~/.aistore-labs/` 本身, 只删 `claude-skills` 子目录
- ❌ 不调子 LLM
