# RUNTIME — agentic CLI 识别 + skill 目录映射

> 这份文档是给 **agent 自己** 看的, 不是给人看的。INSTALL.md / UNINSTALL.md / install-skill / update-skills 都引用这一份, 不要在别处重复写表格或检测规则 — 改了这里, 三处的行为一起变。

## 1. 支持的 runtime + 目录映射

| Runtime | user 级 skill 目录 (扁平加载) | project 级 |
|---|---|---|
| **Claude Code** | `~/.claude/skills/` | `<cwd>/.claude/skills/` |
| **OpenAI Codex CLI** | `~/.codex/skills/` (即 `$CODEX_HOME/skills/`) | `<cwd>/.codex/skills/` |

两边 SKILL.md frontmatter 格式互相兼容, 同一份 skill 文件不需要改造。

后续步骤里用两个变量指代选定结果:

- `$TARGET_SKILLS_USER` — user 级 (e.g. `~/.claude/skills` 或 `~/.codex/skills`)
- `$TARGET_SKILLS_PROJECT` — project 级 (e.g. `<cwd>/.claude/skills` 或 `<cwd>/.codex/skills`)

## 2. 识别算法 (按顺序)

1. **自报身份优先 (默认走这条)** — 你 (执行这份文档的 agent) 知道自己是 Claude Code 还是 Codex CLI, 直接用, **不要问用户**。Claude Code 和 Codex CLI 都实测能稳定回答自己是谁; 多问一句是噪音。
2. **兜底问用户** — 只在你**真判不出自己是谁**才问 (例如你是别的第三方 CLI 而表里没列):
   > "我没法确定当前 runtime, 你是在 Claude Code 还是 OpenAI Codex CLI 里跑? skill 目录不同, 装错地方就白装。"
3. **不要靠 env var 自动检测** — Codex CLI 没有 `CODEX_CLI=1` 这种稳定标记; `$CODEX_HOME` 默认为空, 看不到值不代表不是 Codex。env var 当辅助信号 OK, 当唯一依据会误判。Claude Code 那边的 `CLAUDECODE` / `CLAUDE_CODE_*` 同理只是辅助。

## 3. 前置检查

定下 runtime 之后, 用之前确认目录可写:

```bash
# 例: Claude Code
[ -d "$HOME/.claude/skills" ] && [ -w "$HOME/.claude/skills" ] || \
  echo "目标目录不存在或不可写, 让用户先初始化 CLI / 修权限, 不替它建目录"
```

目录不存在 → **不要替用户 mkdir**。提示用户先在对应 CLI 里初始化 (Claude Code 首次跑 `claude` / Codex CLI 首次跑 `codex`), 让 CLI 自己建。

## 4. 加新 runtime 的标准

未来想加第三种 (e.g. 某个新 agentic CLI), 改这一份就行:

1. 表里加一行 (user + project 路径)
2. 第 2 节算法不动 — 还是自报身份优先
3. 若有特殊兼容性 (frontmatter / 加载格式不同), 在表后面单独写一段说明
4. 不需要改 INSTALL.md / UNINSTALL.md / 任何 meta-skill — 它们引用这一份的变量
