---
description: "Review a prompt, skill, or agent definition and explain each problem, why it matters, and how to fix it, without editing the original file."
prompt_examples:
  - prompt: Review this prompt and point out the engineering problems.
    scene: Review a prompt
  - prompt: Review own-skills/example/SKILL.md and give me actionable findings.
    scene: Review a skill
  - prompt: Check whether this agent definition has conflicting instructions.
    scene: Review an agent
---

# prompt-review

An engineering review for prompts, skills, and agent definitions, built around one question: **could the model infer this content on its own?** Inferable content is noise to cut; non-inferable content is checked for having exactly one home and a form that matches the skill's type. The review runs in both directions — it flags missing load-bearing information *and* redundant rule bloat. It never uses "add a new section" as a fix.

The target is first classified by where its information weight sits — **experience-capture** (scenario→expected-output tables, real numbers), **orchestration** (multi-step flows, subagent dispatch), **tool-wrapper** (CLI/API contracts), or **reference** (mirrored external knowledge). Each type carries exactly one must-have check (its unique value carrier) and one signature-disease check (its unique way of rotting), on top of a small set of universal checks (routing surface, trigger coverage, scenario-based exclusions, one-home-per-fact, information-not-sections, scoped hard markers).

Returns a `REVIEW_PACKET`: every issue carries severity, fix type, the check it hits, all locations (redundancy issues are batched with multiple locations), evidence, and an observable acceptance test. Issues with a canonical answer (`direct`) come with a concrete rewrite; issues that depend on the author's judgment (`think`) come with 2-3 decision questions rather than a fabricated answer. Review-only — it never writes to disk.

## When to use it

- Right after writing a skill / agent / prompt file, when you want an engineering critique
- When a skill has grown heavy and you want the redundant sections identified — restated rules, acceptance tables that mirror the scenario table, examples that repeat the body
- Auditing an existing prompt library for missing trigger coverage, sibling-skill name-drops in exclusions, or stale tool contracts
- Fully offline — self-contained checklist, no network needed

## How to trigger it

Say to Claude:
- "Review this prompt for me: agents/evaluator.md"
- "review skill ~/.claude/skills/foo/SKILL.md"
- "Audit this agent definition and check the prompt quality"

Or just paste a chunk of prompt text and ask for a review.

## What you get back

- A type verdict (which of the four types, or undetermined with a question back to you)
- A structured `REVIEW_PACKET` where every issue maps to a named check with severity and locations
- Redundancy findings arrive as one batched issue naming the single surviving home for each fact, instead of a dozen scattered nitpicks
- `direct` issues include a drop-in rewrite; `think` issues include 2-3 questions (what to decide / why only you can answer / where the answer lands)
- This skill reviews only — whether to apply fixes stays with you or the calling workflow.
