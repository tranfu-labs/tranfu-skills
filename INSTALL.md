# INSTALL — 装 tranfu-labs/tranfu-skills 到本地

> 这份文档不是给人看流水的, 是给 **agentic CLI** 看的 (目前支持 Claude Code 和 OpenAI Codex CLI). 用户复制 README.md 里那段提示词后, CLI 会读这份 INSTALL.md, 按下面步骤执行.

## 前置检查

执行前先确认:

- `node --version` ≥ 20 (CLI 用 ESM + node20 target)
- `npm --version` 能跑, 且 `npm prefix -g` 指向的目录可写 (装全局 CLI 用)

任一不满足 → 停下来告诉用户具体哪一项, 不静默修. node 太老 → 提示装 nvm/fnm 后重试, **不替它装 node**.

## 步骤

### 0.5. 旧 git-clone 装法残留清理 (一次性兼容, 仅老用户)

老版本通过 `git clone` + `cp meta-skill` 装, 缓存在 `~/.tranfu-labs/`, 4 个旧 meta-skill 直接散在 `~/.claude/skills/` 或 `~/.codex/skills/` 下. 新 CLI 完全取代它们, 静默清理掉 — 新装用户条件都不满足, 整块 no-op:

```bash
# (a) 删旧 git-clone 缓存 (覆盖 3 代仓库名)
for old in ~/.aistore-labs/claude-skills \
           ~/.tranfu-labs/claude-skills \
           ~/.tranfu-labs/tranfu-skills; do
  [ -d "$old" ] && rm -rf "$old"
done
rmdir ~/.aistore-labs ~/.tranfu-labs 2>/dev/null  # 空目录顺手收, 非空保留

# (b) 删旧 4 个 meta-skill (两个 runtime 目录都扫)
for dir in ~/.claude/skills ~/.codex/skills; do
  [ -d "$dir" ] || continue
  for s in search-skills install-skill update-skills publish-skill; do
    [ -d "$dir/$s" ] && rm -rf "$dir/$s"
  done
done
```

rm 失败 (权限等) → 报具体路径让用户手处理, 不吞错.

### 1. 全局装 CLI

```bash
npm i -g tranfu-skills
```

装完应有两个二进制: `tfs` (短) 和 `tranfu-skills` (长, 等价). 后续步骤都用 `tfs`.

失败模式:
- `EACCES` → 提示用户改 `npm prefix -g` 到家目录, 或用 nvm/fnm 管理 node (**不教 sudo npm**, 那会污染系统 node)
- 拉包超时 → 让用户检查 npm registry / 网络

### 2. bootstrap meta-skill

```bash
tfs init --both
```

`--both` 让 CLI 把 `tranfu-router` + `tranfu-publish` 装到所有探测到的 runtime (Claude Code → `~/.claude/skills/`, Codex CLI → `~/.codex/skills/`). 只装到一个 runtime 也行: 去掉 `--both`, CLI 单 runtime 自动探, 多 runtime 走交互选.

### 3. 自检

```bash
tfs doctor
```

期望 4/4 ✓ (node-version / runtime / tfs-in-path / legacy-cache). 任一 ✗ 或 ⚠ → 按 doctor 自己的提示处理, 不绕过.

### 4. 通知用户

汇报给用户 (措辞按当前 runtime 调整, e.g. "重启 Codex CLI" / "重启 Claude Code"):

> "公司 skill CLI 已装好 (`tranfu-skills` npm 全局包, 二进制 `tfs`). 重启当前 CLI 或开新会话, 这 2 个 meta-skill 会自动加载:
>  - **tranfu-router** — 搜 / 装 / 列 / 卸载 / 升级 公司 skill (路由到 `tfs` 命令)
>  - **tranfu-publish** — 把本地 skill 发到公司库
>
> 之后跟我说 '搜公司 skill 关于 X' / '装 X 到 user' / '把本地 X 发到公司库' 之类自然语言即可.
> 想升级: 跟我说 '升级公司 skill' (走 tranfu-router → `tfs update`).
> 想卸载某个 skill: '卸载公司 skill X'. 想整套拆掉: 看 README.md 卸载段."

## 失败模式总览

- `npm i -g` 报权限 → 让用户改 npm prefix 或上 nvm/fnm, 不上 sudo
- `tfs init` 探不到 runtime → 让用户先初始化对应 CLI (`~/.claude` 或 `~/.codex` 至少有一个), 不替它建目录
- `tfs doctor` legacy-cache 仍然 ⚠ → 步 0.5 漏了, 重跑步 0.5 那段 rm

## What NOT to do

- ❌ 不动 `~/.claude/skills/` 或 `~/.codex/skills/` 下其他已有 skill (只装 `tranfu-router` + `tranfu-publish`)
- ❌ 不写 ~/.zshrc / 不改环境变量 / 不动 npm 全局 prefix (除非用户报 EACCES 才提建议)
- ❌ 不靠环境变量自动猜 runtime — `tfs init` 自己探, 多 runtime 走 CLI 交互
- ❌ 不"加装" — 步 0.5 静默删, 步 2 静默装, 不在中间问用户 y/n
- ❌ 不 `sudo npm i -g` — 污染系统 node, 后续 update 反而废
