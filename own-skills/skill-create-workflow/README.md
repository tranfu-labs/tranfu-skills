---
description: "Create a concise Codex or Claude Code skill from an idea, document, experience, or prior conversation."
prompt_examples:
  - prompt: Turn docs/postmortem.md into a project-level skill.
    scene: Build from a source file
  - prompt: Yeah, make that a skill.
    scene: Continue from earlier context
  - prompt: Let's skill-ify the release checklist we just discussed.
    scene: Turn an idea into a skill
---

# skill-create-workflow

Creates a new Codex or Claude Code skill from an idea, document, checklist, postmortem, or earlier conversation.

## How it works

- Uses `skill-content-fit` to decide whether the material belongs in a skill.
- Uses `skill-domain-framing` only when the name or task domain is unclear.
- Uses the platform's native `skill-creator` to write a concise skill and runs the available structural validation.
- Adds workflows, examples, scripts, references, and assets only when the task needs them.
- Reviews or publishes the skill only when explicitly requested.

## Boundaries

Use it for creating a new skill, including follow-ups such as “make that a skill” when the source is clear from context.

Use the relevant focused tool instead when you only need content-fit analysis, domain naming, display-name generation, publishing, installation, plugin creation, ordinary code changes, or non-skill documentation.
