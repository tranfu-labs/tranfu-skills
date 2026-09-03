---
description: "Review MUST-style hard emphasis when asked to review, audit, optimize, or lint a prompt, skill, or agent definition, and suggest plain replacements."
prompt_examples:
  - prompt: Review this prompt and replace any overused hard-emphasis wording.
    scene: Review a prompt
  - prompt: Review own-skills/example/SKILL.md for MUST-style wording.
    scene: Check a skill
---

# prompt-review

Finds hard-emphasis words such as `MUST`, `NEVER`, `ALWAYS`, `CRITICAL`, and `REQUIRED` in
prompts, skills, and agent definitions, then suggests plain replacements that preserve the meaning.

The result lists each location, the original wording, and the suggested replacement.
