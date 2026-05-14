# UNINSTALL — 完整卸载 tranfu-labs/tranfu-skills

> 这份文档是给 **agentic CLI** 看的 (Claude Code / OpenAI Codex CLI). 用户复制 README.md 里的卸载提示词后, CLI 读到这份 UNINSTALL.md, 按下面流程执行.

## 卸载范围 (默认)

- `tranfu-skills` npm 全局包 (二进制 `tfs` / `tranfu-skills`)
- 当前 runtime 下的 2 个新 meta-skill: `tranfu-router` / `tranfu-publish`
- CLI 缓存目录 `~/.tfs/` (index.json 缓存 + ack.json)

## 老用户额外清理 (一次性兼容)

如检测到旧 git-clone 装法的残留, 一起清掉. 新用户条件都不满足 → 整块 no-op:

- `~/.tranfu-labs/tranfu-skills/` / `~/.tranfu-labs/claude-skills/` / `~/.aistore-labs/claude-skills/` (旧 git-clone 缓存, 3 代仓库名)
- 当前 runtime 下旧 4 个 meta-skill: `search-skills` / `install-skill` / `update-skills` / `publish-skill`

## 默认保留 (不动)

- 本地非 meta-skill 的 SKILL.md frontmatter 里 `published_to / published_version / published_at` 三字段 — 是审计痕迹, 用户后悔重装时可以查
- 其他公司 skill 通过 `tfs install` 装到本地的副本 — 那是用户主动装的, 不属于 bootstrap, 不动. 想一起清 → 让用户先跑 `tfs installed` 看清单, 再单独说要清哪几个
- 用户自己其他来源的 skill — 当然不动
- **另一个 runtime 目录**: 若用户两个 CLI 都装过这套 skill, 只清当前 runtime 的; 另一个目录单独让用户在另一个 CLI 里跑一次卸载 (或卸载前先 `tfs uninstall --runtime <other>` 跨清, 见步骤 3)

如果用户主动要求清这些, 单独问一次再清, 不要默认清.

## 步骤

### 0. 运行时识别

`tfs` 自己探 runtime, 但卸载语义需要明确当前面向哪个 runtime (因为只清当前那个). 默认按 agent 自报身份选 (Claude Code / Codex CLI); 探不到 → 问用户. 后续所有引用 `<RUNTIME>` 代入这个值.

### 1. 二次确认 (硬约束, 不能省)

明确列出要删的内容, 让用户最后确认一次:

```
要卸载 tranfu-labs/tranfu-skills (当前 runtime: <Claude Code / Codex CLI>):

会删:
- npm 全局包 tranfu-skills (二进制 tfs / tranfu-skills)
- <RUNTIME 目录>/tranfu-router/
- <RUNTIME 目录>/tranfu-publish/
- ~/.tfs/  (CLI 缓存)
[如检测到老用户残留, 一起列出:]
- <RUNTIME 目录>/{search-skills, install-skill, update-skills, publish-skill}/  (旧 meta-skill, 如存在)
- ~/.tranfu-labs/tranfu-skills/  (旧 git-clone 缓存; 如存在)
- ~/.tranfu-labs/claude-skills/  (一次改名前的中间缓存; 如存在)
- ~/.aistore-labs/claude-skills/  (两次改名前的旧缓存; 如存在)

会保留:
- 本地 skill 里 published_* frontmatter 标记
- tfs install 装到本地的其他公司 skill (跑 `tfs installed` 看清单)
- 另一个 runtime 的目录 (如有)

确认?
```

用户 → 否 → 中止, 不做任何动作.
用户 → 是 → 进入步骤 2.

### 2. 卸载 meta-skill (当前 runtime)

```bash
tfs uninstall tranfu-router 2>/dev/null || true
tfs uninstall tranfu-publish 2>/dev/null || true
```

`tfs uninstall` 只删带 tranfu-skills 装机戳的目录, 不会误删用户其他 skill. 如戳不在 (e.g. 用户手动改过), 会报 `skill_not_found`, 这步用 `|| true` 兜底.

老用户残留 (旧 4 个 meta-skill) 没装机戳, 走 `rm -rf` 直接删:

```bash
RUNTIME_DIR=<按步骤 0 选定, 例 $HOME/.claude/skills 或 $HOME/.codex/skills>
for s in search-skills install-skill update-skills publish-skill; do
  [ -d "$RUNTIME_DIR/$s" ] && rm -rf "$RUNTIME_DIR/$s"
done
```

### 3. (可选) 跨 runtime 清

如用户两个 runtime 都装过, 想一次清完 → 重跑步骤 2, 把 `RUNTIME_DIR` 换成另一个. 默认不跨清 (见上文"默认保留").

### 4. 删 CLI 缓存

```bash
rm -rf ~/.tfs
```

只是 index.json 缓存 + ack.json, 删了无副作用.

### 5. 卸载 npm 全局包

```bash
npm uninstall -g tranfu-skills
```

报权限 → 让用户检查 `npm prefix -g`, 别上 sudo.

### 6. 老用户额外: 删旧 git-clone 缓存

```bash
rm -rf "$HOME/.tranfu-labs/tranfu-skills"
rm -rf "$HOME/.tranfu-labs/claude-skills"
rm -rf "$HOME/.aistore-labs/claude-skills"
rmdir ~/.tranfu-labs ~/.aistore-labs 2>/dev/null  # 空目录顺手收
```

注: 只删 `tranfu-skills` / `claude-skills` 这几个子目录 (+ 空父目录), 不强删非空的 `~/.tranfu-labs/` / `~/.aistore-labs/` 本身.

### 7. 验证

```bash
which tfs  # 应该 not found
ls <RUNTIME_DIR> 2>/dev/null | grep -E '^(tranfu-router|tranfu-publish|search-skills|install-skill|update-skills|publish-skill)$' | wc -l
# 应输出 0
[ -d ~/.tfs ] && echo "tfs cache still here" || echo "tfs cache gone"
[ -d ~/.tranfu-labs/tranfu-skills ] || [ -d ~/.tranfu-labs/claude-skills ] || [ -d ~/.aistore-labs/claude-skills ] && echo "legacy cache still here" || echo "legacy cache gone"
```

期望: `which tfs` not found, meta-skill 计数 0, 两个 cache 均 gone. 任一不符 → 报告给用户, 不静默.

### 8. 通知用户

```
卸载完成. 重启当前 CLI 后, tranfu-router / tranfu-publish 不再加载.

保留:
- 本地 skill 的 published_* frontmatter (审计痕迹)
- tfs install 装到本地的其他公司 skill (在 <RUNTIME_DIR> 下, 没动)
- 另一个 runtime 的目录 (如有)

要清这些请单独说. 重新装回来 → 看仓库 README.md 的 bootstrap 段.
```

## Failure modes

- `npm uninstall -g` 报权限 → 让用户检查 `npm prefix -g`, 不上 sudo
- `tfs uninstall` 报 `skill_not_found` → 戳不在或目录不存在, 当幂等 success 跳过
- `rm -rf` 报权限 → 让用户 `sudo` 自己跑, 不代办
- 卸载 npm 包但 `which tfs` 仍能找到 → 多个 npm prefix (e.g. nvm vs 系统), 让用户跑 `which -a tfs` 自查

## What NOT to do

- ❌ 不在没二次确认时 `rm` 任何东西
- ❌ 不动 `<RUNTIME_DIR>` 下非 meta-skill 的目录 (用户 `tfs install` 装的别的 skill)
- ❌ 不动另一个 runtime 的目录 — 只清当前 runtime (除非用户在步骤 3 主动确认跨清)
- ❌ 不改/删本地任何 skill SKILL.md 的 frontmatter
- ❌ 不动 `~/.zshrc` / 环境变量 / shell config (从来没写过, 没东西要清)
- ❌ 不递归删 `~/.tranfu-labs/` 本身, 只删 `tranfu-skills` / `claude-skills` 子目录 (+ 空父目录)
- ❌ 不 `sudo npm uninstall` — 污染系统 node
- ❌ 不调子 LLM
