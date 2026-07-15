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

An engineering-grade review checklist for prompts, skills, and agent definitions. Runs the A-G checklist embedded in SKILL.md (each item tagged with severity and fix type) locally against the target file. Returns a `REVIEW_PACKET`: every issue carries severity, fix type (`fix_type`), the checklist item it hits, a line anchor, evidence, and acceptance criteria, plus a summary ledger. Issues with a canonical answer (`direct`) come with a concrete rewrite; issues that depend on the author's judgment (`think`) come with 2-3 questions rather than a fabricated answer. Whether to apply the fixes on disk, and whether to run more rounds, is left to the caller or the harness.

## When to use it

- Right after writing a skill / agent / prompt file, when you want a line-by-line engineering critique
- Auditing an existing prompt library for common hard problems: hedging words like "should" / "try to", missing quantitative pass criteria, missing negative guardrails
- Reviewing a longer or multi-file skill / agent, one A-G dimension at a time
- Fully offline — the full checklist lives inside SKILL.md, self-contained, no network needed

## How to trigger it

Say to Claude:
- "Review this prompt for me: agents/evaluator.md"
- "review skill ~/.claude/skills/foo/SKILL.md"
- "Audit this agent definition and check the prompt quality"

Or just paste a chunk of prompt text and ask for a review.

## What you get back

- A local pass over the file against every A-G item; each hit becomes one issue
- A structured `REVIEW_PACKET` where every issue maps to an A-G item and carries a severity
- Each issue is split by fix type:
  - **direct** (canonical answer exists): a concrete rewrite / drop-in patch — e.g. replacing a hedge word, aligning a field name, adding a WRONG label
  - **think** (author judgment required): no fabricated answer — instead, 2-3 questions (what's the question / why only you can answer it / how would you rewrite once you decide), for cases like colloquial trigger phrasing, done criteria, or which of two conflicting hard rules should win
- A `by_fix_type` breakdown in the ledger so you can see at a glance how many are direct edits vs. how many need your own thinking
- This skill reviews only — it never writes to disk. Whether to apply fixes, and how many rounds to run, stays with the user or the harness.
