# INSTALL — bootstrap tranfu-labs/claude-skills 到本地

> 这份文档不是给人看流水的，是给 **agentic CLI** 看的 (目前支持 Claude Code 和 OpenAI Codex CLI)。用户复制 README.md 里那段提示词后, CLI 会克隆本仓库, 读到这份 INSTALL.md, 按下面步骤执行。

## 0. 运行时识别 (必做, 不能跳)

按 [RUNTIME.md](./RUNTIME.md) 第 2 节识别你自己 (Claude Code / Codex CLI / 兜底问用户), 取到 user 级路径, 后续步骤里用 `$TARGET_SKILLS` 指代。

## 前置检查

执行前先确认:

- `gh auth status` 已登录 GitHub (用来 clone 私仓 + 后续 PR)
- `~/.tranfu-labs/` 目录可写
- `$TARGET_SKILLS` 目录存在 (按步骤 0 选定, 详见 RUNTIME.md 第 3 节)

任一不满足 → 停下来告诉用户具体哪一项, 不静默修。目录不存在 → 提示用户先初始化对应 CLI, **不替它建目录**。

## 步骤

### 0.5. 旧缓存路径迁移 (一次性兼容, 仅老用户)

公司库从 `aistore-labs` 改名到 `tranfu-labs`. 如检测到老缓存 `~/.aistore-labs/claude-skills/` 且新路径还不在, 静默 `mv` 过去并修 git remote:

```bash
if [ -d ~/.aistore-labs/claude-skills ] && [ ! -d ~/.tranfu-labs/claude-skills ]; then
  mkdir -p ~/.tranfu-labs
  mv ~/.aistore-labs/claude-skills ~/.tranfu-labs/claude-skills
  cd ~/.tranfu-labs/claude-skills && \
    git remote get-url origin 2>/dev/null | grep -q aistore-labs && \
    git remote set-url origin git@github.com:tranfu-labs/claude-skills.git
fi
```

新装用户条件不满足, 整块静默跳过, 不影响首装.

### 1. clone 缓存仓库 (幂等)

```bash
if [ ! -d ~/.tranfu-labs/claude-skills/.git ]; then
  git clone git@github.com:tranfu-labs/claude-skills.git ~/.tranfu-labs/claude-skills
else
  cd ~/.tranfu-labs/claude-skills && git pull --ff-only
fi
```

### 2. cp 4 个 meta-skill 到 user 级 (从 meta-skills/ 子目录拍扁)

把步骤 0 选定的 user 级路径代入 `$TARGET_SKILLS`:

```bash
TARGET_SKILLS=<按步骤 0 选定>   # RUNTIME.md 第 1 节查表
for s in publish-skill search-skills install-skill update-skills; do
  cp -r ~/.tranfu-labs/claude-skills/meta-skills/$s/ "$TARGET_SKILLS/$s/"
done
```

**注**: 缓存仓库里 skill 按类目分文件夹 (meta-skills / own-skills / external-skills), 但 user 级 skill 目录必须扁平加载, 所以 cp 时自动拍扁, 没有 `meta-skills/` 中间层。

### 3. 验证

```bash
ls -1 "$TARGET_SKILLS" | grep -E '^(publish-skill|search-skills|install-skill|update-skills)$' | wc -l
```

期望输出 `4`。少于 4 → 报告哪几个缺, 重跑步骤 2。

### 4. 通知用户

汇报给用户 (措辞按当前 runtime 调整, e.g. "重启 Codex CLI" / "重启 Claude Code"):

> "公司 skill 库已经装到本地 (`$TARGET_SKILLS`)。重启当前 CLI 或开新会话, 这 4 个 meta-skill 会自动加载:
>  - publish-skill — 把本地 skill 发到公司库
>  - search-skills — 搜公司库
>  - install-skill — 装公司 skill 到本地
>  - update-skills — 拉最新
> 之后跟 Claude 说 '搜公司 skill 关于 X' / '把本地 X 发到公司库' 之类自然语言即可。
> 想拉后续更新 → 跟 Claude 说 '更新公司 skill 缓存' (触发 update-skills)。
> 想卸载 → 看仓库 README.md 的卸载段。"

## 失败模式

- `git clone` 失败 → 让用户检查 `gh auth status` 和 SSH key (不代办 token)
- `cp` 报权限 → 让用户确认 `$TARGET_SKILLS` 可写
- 某个 meta-skill 在 cache 里缺失 → 仓库本身有问题, 报到 issue, 不试图修补

## What NOT to do

- ❌ 不动 `$TARGET_SKILLS` 下其他已有 skill (只 cp 这 4 个)
- ❌ 不写 ~/.zshrc / 不改环境变量
- ❌ 不靠环境变量自动猜 runtime (详见 RUNTIME.md 第 2 节)
- ❌ 不"双装"到两个目录 — 即使用户两个 CLI 都用, 也只装到他当前 runtime 那个; 想再装一份 → 让他在另一个 CLI 里重跑 bootstrap
- ❌ 不静默任何失败
