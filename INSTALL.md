# INSTALL — bootstrap aistore-labs/claude-skills 到本地

> 这份文档不是给人看流水的，是给 **Claude Code** 看的。用户复制 README.md 里那段提示词, Claude Code 会克隆本仓库后读到这份 INSTALL.md, 按下面步骤执行。

## 前置检查

执行前先确认:

- `gh auth status` 已登录 GitHub (用来 clone 私仓 + 后续 PR)
- `~/.aistore-labs/` 目录可写
- `~/.claude/skills/` 目录存在 (Claude Code 标准位置)

任一不满足 → 停下来告诉用户具体哪一项, 不静默修。

## 步骤

### 1. clone 缓存仓库 (幂等)

```bash
if [ ! -d ~/.aistore-labs/claude-skills/.git ]; then
  git clone git@github.com:aistore-labs/claude-skills.git ~/.aistore-labs/claude-skills
else
  cd ~/.aistore-labs/claude-skills && git pull --ff-only
fi
```

### 2. cp 4 个 meta-skill 到 user 级

```bash
for s in publish-skill search-skills install-skill update-skills; do
  rm -rf ~/.claude/skills/$s
  cp -r ~/.aistore-labs/claude-skills/$s ~/.claude/skills/$s
done
```

### 3. 验证

```bash
ls -1 ~/.claude/skills/ | grep -E '^(publish-skill|search-skills|install-skill|update-skills)$' | wc -l
```

期望输出 `4`。少于 4 → 报告哪几个缺, 重跑步骤 2。

### 4. 通知用户

汇报给用户:

> "公司 skill 库已经装到本地。重启 Claude Code 或开新会话, 这 4 个 meta-skill 会自动加载:
>  - publish-skill — 把本地 skill 发到公司库
>  - search-skills — 搜公司库
>  - install-skill — 装公司 skill 到本地
>  - update-skills — 拉最新
> 之后跟 Claude 说 '搜公司 skill 关于 X' / '把本地 X 发到公司库' 之类自然语言即可。
> 想拉后续更新 → 跟 Claude 说 '更新公司 skill 缓存' (触发 update-skills)。
> 想卸载 → 看仓库 README.md 的卸载段。"

## 失败模式

- `git clone` 失败 → 让用户检查 `gh auth status` 和 SSH key (不代办 token)
- `cp` 报权限 → 让用户确认 `~/.claude/skills/` 可写
- 某个 meta-skill 在 cache 里缺失 → 仓库本身有问题, 报到 issue, 不试图修补

## What NOT to do

- ❌ 不动 `~/.claude/skills/` 下其他已有 skill (只 cp 这 4 个)
- ❌ 不写 ~/.zshrc / 不改环境变量
- ❌ 不静默任何失败
