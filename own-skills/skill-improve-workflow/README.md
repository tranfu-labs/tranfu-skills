---
prompt_examples:
  - prompt: Improve the own-skills/daily-report skill
    scene: improve existing
  - prompt: Does own-skills/foo still qualify as a skill?
    scene: qualification doubt
  - prompt: Health check own-skills/bar before I merge, fix what fits
    scene: pre-merge health
  - prompt: Run a review pass over the whole own-skills/ directory
    scene: batch dir audit
  - prompt: Just review this skill, don't touch files yet
    scene: review only
  - prompt: How is own-skills/xxx written? Worth rebuilding?
    scene: rebuild assessment
---

[English](./README.md) | [中文](./README.zh.md)

# skill-improve-workflow

Bring an existing skill up to today's quality bar: run the same gate checks that `skill-create-workflow` uses when creating a new skill, only backward against something that already exists (content-fit review via `skill-content-fit`, domain-and-naming review via `skill-domain-framing`, prompt-engineering quality via `prompt-review` axes A–G, structural completeness via a mechanical checklist). The output is a `SKILL_REVIEW_REPORT` with a three-way verdict (pass / needs-fix / recommend-rebuild), followed by fixing what can be fixed. Review is the means; improvement is the result — the name is chosen by the result, mirrored against `skill-create-workflow` (create).

Two phases. The **review phase** only reads, never writes. The **post-review repair phase** handles issues with a settled fix (missing `Do NOT` clause, soft wording that should be `MUST`, non-kebab naming, and so on) by editing the files directly after batched consent, and hands judgment-type issues (does this even belong as a skill / is the container name right / where to draw the boundary) back to the user through an interview — which opens by announcing the total count and prefixes each round with `[k/N]` so the process feels bounded, and always uses plain language instead of internal jargon. Anything that means switching container or rewriting from scratch is a large refactor and gets handed back to `skill-create-workflow`.

Architecture: the orchestrator only routes, merges, and adjudicates — it never reads the target files in full. All four gates run in subagents with tiered short-circuits: if Gate 1 fails or Gate 2 flags the container as wrong, emit a partial report and exit. Gate 3 audits `SKILL.md` first (three reviewers work in parallel along axes A,B / C,D / E,F,G, alongside the Gate 4 structural check on the same wave); if `SKILL.md` has any BLOCKER or HIGH, exit here, and the remaining prompt-bearing files go into a later wave. When merging `REVIEW_PACKET`s, the orchestrator prefixes each issue id with its file path (promoted to `file#localid`) to avoid collisions; the in-file local ids stay stable so re-review can still reference them.

## When to use it

- You want to bring an existing skill in your library up to today's create-gate bar
- Someone else's skill lands on your desk and you want a full health check before merging, then fix what's fixable
- You suspect a skill has the wrong name or wrong boundary and want a score to justify the rebuild call
- You want to batch-audit every skill in a directory and get a per-skill verdict table

## How to invoke (trigger phrases)

Say to Claude:

- "Improve the `own-skills/daily-report` skill for me"
- "Polish up `~/.claude/skills/foo`"
- "Review this skill, and fix whatever's fixable while you're at it"
- "Does this skill need to be rebuilt?"
- "Run a review pass over the whole `own-skills/` directory"

## What you'll see

- Four gates report in sequence: content-fit reverse check / domain reverse check / prompt quality (with an embedded `REVIEW_PACKET`) / structural completeness
- Mechanical verdict: Gate 1 or Gate 2 fails → recommend-rebuild; Gate 3 or Gate 4 has BLOCKER/HIGH → needs-fix; otherwise → pass
- Once the report is out and you're around to fix things: mechanical issues get batched consent and are applied directly; judgment issues become an interview with progress markers so you can decide; the run closes with a repair summary (what changed / what you decided / what got deferred)
- The review phase never touches files. Edits only happen in the repair phase, and every edit maps to one of your consents. Large refactors get punted back to `skill-create-workflow`.

## Compared to similar skills

- `prompt-review`: a quality checklist for a single prompt file or inline prompt text; it is Gate 3 inside this skill. If your target isn't a full skill directory, use it directly instead of this one.
- `skill-create-workflow`: the create-side orchestrator (build a new skill from scratch). This skill owns review plus fixing mechanical and judgment-type issues to the bar; only container-swap or full rewrite refactors get handed back to it.
