---
description: "Turn reusable source material into a new skill through content fit, domain framing, creation, and prompt review."
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

## Workflow

1. `skill-content-fit` checks whether the source is reusable, executable, verifiable, and bounded. A rejection stops the flow.
2. `skill-domain-framing` selects the skill name, scope, and placement. Close or conflicting candidates are returned to you for a decision.
3. The platform `skill-creator` writes the skill files.
4. `prompt-review` checks generated prompt-bearing files for unnecessary hard-emphasis wording.
5. The workflow reports the paths, validation result, and unresolved risks. Publishing runs only when requested.

## Boundaries

Use it for creating a new skill, including follow-ups such as “make that a skill” when the source is clear from context.

Use the relevant focused tool instead when you only need content-fit analysis, domain naming, display-name generation, publishing, installation, plugin creation, ordinary code changes, or non-skill documentation.
