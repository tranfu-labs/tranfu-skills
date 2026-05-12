# Skill Reverse Engineer

逆向分析、审计和改进 AI Agent Skills，把黑箱 skill 拆成可理解、可复用的设计公式。

## 什么时候用它

- 看到一个外部 skill 想学习它的设计模式
- 手头的 prompt/workflow 想包装成标准 SKILL.md
- 需要对比多个 skill 提取共用模板
- 怀疑某个 skill 有触发盲区或输出契约漏洞

## 怎么用 (触发示例)

跟 Claude 说:
- "帮我 reverse-engineer 这个 SKILL.md，看看它怎么触发的"
- "分析一下这三个 skill 有什么共同模式"
- "把这个 prompt 改成标准的 agent skill"
- "这个 skill 有没有 trigger 风险？"

## 你会看到什么

- 模式选择建议 (Quick / Full / Audit / Trigger-test / Package / Compare)
- 结构诊断：trigger 逻辑、workflow 步骤、output contract、quality risks
- 可复用的创建公式和改写建议

---

默认中文说明 | [English README](README.en.md)

`skill-reverse-engineer` 是一个标准 Agent Skill，用来逆向分析、审计和改进其他 AI Agent Skills、`SKILL.md`、prompt 工作流、agent instructions、marketplace skill 页面或 skill 目录。

它特别适合回答这些问题：

- 这个 skill 真正解决什么问题？
- 它为什么这样写？
- 它会被哪些用户请求触发？
- 它的 workflow、output contract、quality risks 是什么？
- 如何把一个弱 skill 改成更可靠、更容易被 agent 调用的 `SKILL.md`？
- 如何把一个 prompt/workflow 包装成可复用 skill？

## 仓库结构

```text
skill-reverse-engineer/
├── README.md
├── README.en.md
├── LICENSE
└── skill-reverse-engineer/
    ├── SKILL.md
    └── agents/
        └── openai.yaml
```

Skill 本体位于：

```text
skill-reverse-engineer/SKILL.md
```

它遵循 Agent Skills 目录结构：每个 skill 是一个目录，目录内至少包含 `SKILL.md`，并用 YAML frontmatter 声明 `name` 和 `description`。

## 安装方式

先克隆仓库：

```bash
git clone https://github.com/BruceL017/skill-reverse-engineer.git
cd skill-reverse-engineer
```

然后按你使用的 agent 安装。

## Claude Code

Claude Code 支持个人级和项目级 Skills。个人级路径通常是：

```text
~/.claude/skills/
```

安装为个人 Skill：

```bash
mkdir -p ~/.claude/skills
cp -R skill-reverse-engineer ~/.claude/skills/
```

安装为当前项目 Skill：

```bash
mkdir -p .claude/skills
cp -R skill-reverse-engineer .claude/skills/
```

使用方式：

```text
Use $skill-reverse-engineer to analyze this SKILL.md and suggest improvements.
```

在支持 slash invocation 的 Claude Code 版本中，也可以尝试：

```text
/skill-reverse-engineer
```

## Codex

在 Codex 中，推荐使用内置 `$skill-installer` 从 GitHub 安装：

```text
Use $skill-installer to install https://github.com/BruceL017/skill-reverse-engineer/tree/main/skill-reverse-engineer
```

也可以手动安装到 Codex skills 目录：

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R skill-reverse-engineer "${CODEX_HOME:-$HOME/.codex}/skills/"
```

如果你的 Codex 环境使用 `~/.agents/skills` 作为个人 skills 目录，也可以复制到那里：

```bash
mkdir -p ~/.agents/skills
cp -R skill-reverse-engineer ~/.agents/skills/
```

安装后重启 Codex，让新的 skill 被发现。

使用方式：

```text
Use $skill-reverse-engineer to reverse-engineer this skill package.
```

## OpenClaw

OpenClaw 的官方 CLI `openclaw skills install` 主要面向 ClawHub skill。对于 GitHub 上的公开 `SKILL.md` 仓库，稳妥做法是手动安装到 OpenClaw 可扫描的 skills 目录。

全局安装：

```bash
mkdir -p ~/.openclaw/skills
cp -R skill-reverse-engineer ~/.openclaw/skills/
openclaw skills list
openclaw skills check
```

项目或 workspace 安装：

```bash
mkdir -p skills
cp -R skill-reverse-engineer skills/
openclaw skills list
```

使用方式：

```text
Use skill-reverse-engineer to analyze this SKILL.md and identify trigger risks.
```

## Hermes Agent

Hermes 支持从 hub、GitHub repo/path、tap 和其他来源安装 skills。这个仓库的 skill 位于仓库子目录 `skill-reverse-engineer/`，因此使用 GitHub path 安装：

```bash
hermes skills install BruceL017/skill-reverse-engineer/skill-reverse-engineer
```

安装后检查：

```bash
hermes skills list
hermes skills inspect skill-reverse-engineer
```

使用方式：

```text
Use skill-reverse-engineer to compare these two SKILL.md files and extract their shared pattern.
```

## 示例请求

```text
Use $skill-reverse-engineer to analyze this SKILL.md. Focus on trigger precision, output contract, and marketplace readiness.
```

```text
Use $skill-reverse-engineer to turn this prompt workflow into a proper agent skill.
```

```text
Use $skill-reverse-engineer to compare these three skills and extract a reusable creation formula.
```

## 设计原则

- 默认中文输出，除非用户要求英文。
- 先判断模式，再分析，避免每次都输出超长报告。
- 区分可见证据、合理推断、缺失信息和需要验证的结论。
- 优先分析 trigger、workflow、output contract、risk、testability。
- 只在用户明确要求或确有必要时生成完整改写版 `SKILL.md`。
- 避免声称知道隐藏系统提示词、私有平台路由或 marketplace 排序逻辑。

## 兼容性说明

这个仓库采用通用 Agent Skills 结构，核心文件是 `skill-reverse-engineer/SKILL.md`。不同 agent 的发现目录、安装命令和自动触发机制可能不同，请以各自官方文档为准。

参考资料：

- [Agent Skills specification](https://agentskills.io/specification)
- [Claude Code Skills docs](https://docs.claude.com/en/docs/claude-code/skills)
- [OpenAI skills catalog for Codex](https://github.com/openai/skills)
- [OpenClaw skills CLI docs](https://docs.openclaw.ai/cli/skills)
- [OpenClaw creating skills docs](https://docs.openclaw.ai/tools/creating-skills)
- [OpenClaw skills config docs](https://docs.openclaw.ai/tools/skills-config)
- [Hermes skills system docs](https://hermes.dhuar.com/en/user-guide/features/skills)

## License

MIT
