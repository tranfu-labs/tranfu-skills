---
description: "Decide whether reusable material is a good fit for a Claude or Codex skill."
prompt_examples:
  - prompt: I want to crystallize this postmortem into a skill — is it a good fit?
    scene: Learn from an incident
  - prompt: Is this project convention worth packaging as a skill?
    scene: Reuse project knowledge
  - prompt: Could this style guide become a skill?
    scene: Package reference material
---

# Skill Content Fit Check

Decides whether source material belongs in a reusable skill.

## Good fits

- Project conventions, domain knowledge, patterns, style guides, terminology, and rules.
- Deployment, commit, code-generation, or other recognizable task guidance.
- Material that will be useful across similar future requests.

## What it considers

- The material is reusable rather than one-off context.
- It adds knowledge Claude would not reliably infer on its own.
- The task or situation that should activate it is recognizable.

A skill does not need a workflow, examples, validation steps, boundaries, or acceptance criteria. Add those only when the task benefits from them. Keep `SKILL.md` concise and move detailed material into referenced files when useful.

## Related skills

| Task | Skill |
|---|---|
| Create the new skill | `skill-create-workflow` |
| Clarify an uncertain task domain or name | `skill-domain-framing` |
| Review an existing skill | Platform skill editor |
