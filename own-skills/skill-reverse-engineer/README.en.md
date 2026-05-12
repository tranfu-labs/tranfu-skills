# Skill Reverse Engineer

[中文 README](README.md) | English README

`skill-reverse-engineer` is a standard Agent Skill for reverse-engineering, auditing, and improving other AI Agent Skills, `SKILL.md` files, prompt workflows, agent instructions, marketplace skill pages, and skill directories.

It helps answer questions like:

- What problem does this skill really solve?
- Why is it written this way?
- Which user requests should trigger it?
- What are its workflow, output contract, and quality risks?
- How can a weak skill be rewritten into a more reliable `SKILL.md`?
- How can a prompt or workflow be packaged as a reusable skill?

## Repository Structure

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

The skill itself lives at:

```text
skill-reverse-engineer/SKILL.md
```

It follows the Agent Skills directory structure: a skill is a folder containing at least one `SKILL.md` file with YAML frontmatter declaring `name` and `description`.

## Install

Clone the repository first:

```bash
git clone https://github.com/BruceL017/skill-reverse-engineer.git
cd skill-reverse-engineer
```

Then install it for your agent.

## Claude Code

Claude Code supports personal and project Skills. The common personal path is:

```text
~/.claude/skills/
```

Install as a personal Skill:

```bash
mkdir -p ~/.claude/skills
cp -R skill-reverse-engineer ~/.claude/skills/
```

Install as a project Skill:

```bash
mkdir -p .claude/skills
cp -R skill-reverse-engineer .claude/skills/
```

Usage:

```text
Use $skill-reverse-engineer to analyze this SKILL.md and suggest improvements.
```

In Claude Code versions that support slash invocation, you can also try:

```text
/skill-reverse-engineer
```

## Codex

In Codex, the recommended path is to use the built-in `$skill-installer` from GitHub:

```text
Use $skill-installer to install https://github.com/BruceL017/skill-reverse-engineer/tree/main/skill-reverse-engineer
```

You can also install manually:

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R skill-reverse-engineer "${CODEX_HOME:-$HOME/.codex}/skills/"
```

If your Codex environment uses `~/.agents/skills` as its personal skills directory, copy it there instead:

```bash
mkdir -p ~/.agents/skills
cp -R skill-reverse-engineer ~/.agents/skills/
```

Restart Codex after installation so the new skill is discovered.

Usage:

```text
Use $skill-reverse-engineer to reverse-engineer this skill package.
```

## OpenClaw

OpenClaw's official `openclaw skills install` command primarily installs skills from ClawHub. For a public GitHub repository containing a `SKILL.md`, the safest approach is manual installation into an OpenClaw-scanned skills directory.

Global install:

```bash
mkdir -p ~/.openclaw/skills
cp -R skill-reverse-engineer ~/.openclaw/skills/
openclaw skills list
openclaw skills check
```

Project or workspace install:

```bash
mkdir -p skills
cp -R skill-reverse-engineer skills/
openclaw skills list
```

Usage:

```text
Use skill-reverse-engineer to analyze this SKILL.md and identify trigger risks.
```

## Hermes Agent

Hermes supports installing skills from hubs, GitHub repo/path identifiers, taps, and other sources. This repository stores the skill in the `skill-reverse-engineer/` subdirectory, so use the GitHub path install form:

```bash
hermes skills install BruceL017/skill-reverse-engineer/skill-reverse-engineer
```

Check the install:

```bash
hermes skills list
hermes skills inspect skill-reverse-engineer
```

Usage:

```text
Use skill-reverse-engineer to compare these two SKILL.md files and extract their shared pattern.
```

## Example Prompts

```text
Use $skill-reverse-engineer to analyze this SKILL.md. Focus on trigger precision, output contract, and marketplace readiness.
```

```text
Use $skill-reverse-engineer to turn this prompt workflow into a proper agent skill.
```

```text
Use $skill-reverse-engineer to compare these three skills and extract a reusable creation formula.
```

## Design Principles

- Default to Chinese output unless the user asks for English.
- Choose an operating mode before analyzing, so short requests do not receive oversized reports.
- Separate visible evidence, reasonable inference, missing information, and validation needs.
- Prioritize trigger behavior, workflow, output contract, risk, and testability.
- Generate a complete rewritten `SKILL.md` only when the user asks for it or when a patch list is not enough.
- Never claim hidden system prompt access, private platform routing knowledge, or marketplace ranking knowledge.

## Compatibility Notes

This repository uses the general Agent Skills structure. The core file is `skill-reverse-engineer/SKILL.md`. Discovery folders, install commands, and automatic triggering behavior vary by agent, so check the official docs for your runtime.

References:

- [Agent Skills specification](https://agentskills.io/specification)
- [Claude Code Skills docs](https://docs.claude.com/en/docs/claude-code/skills)
- [OpenAI skills catalog for Codex](https://github.com/openai/skills)
- [OpenClaw skills CLI docs](https://docs.openclaw.ai/cli/skills)
- [OpenClaw creating skills docs](https://docs.openclaw.ai/tools/creating-skills)
- [OpenClaw skills config docs](https://docs.openclaw.ai/tools/skills-config)
- [Hermes skills system docs](https://hermes.dhuar.com/en/user-guide/features/skills)

## License

MIT
