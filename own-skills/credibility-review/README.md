---
description: "Check whether an article sounds credible or like marketing fluff, then list the problems without rewriting the draft."
prompt_examples:
  - prompt: Take a look at this draft and tell me if it's ready to ship.
    scene: Review a pasted draft
  - prompt: Review tranfu-site/src/content/posts/pitfall-mcp-not-working.md and flag the problems.
    scene: Review a file
  - prompt: Does this read like a PR puff piece? Are there uplift punchlines or buried sentimental turns? Flag them.
    scene: Check the writing style
---

# Article Credibility Review

Review a draft for content-mill fluff — two independent parallel tracks diagnose it, a tri-state verdict (ship / needs review / reject) combines them, and the skill only flags problems, never rewrites.

![Dual-track review workflow](./workflow.svg)

## When to use it

**Paste a draft**:

I finished a 踩坑记 / 养成记 post and before publishing I want the skill to flag anything that reads like PR-speak or a content-mill listicle.

**Review a file**:

The draft lives under `tranfu-site/src/content/posts/`, I say "review this path," and the skill reads the file itself.

**Check the writing style**:

I explicitly ask "does this read like a PR puff piece / are there uplift punchlines / is there a buried sentimental turn," and I want the skill to chase my suspicion.

**Review English content**:

I'm reviewing an English long-form industry piece / incident postmortem / research write-up and I want the skill to run its violation scan on the English branch.

**Confirm the article type**:

I tagged it as 养成记 but the timespan is only a month. I want the skill to judge the genre first, then decide which structural checklist applies.

**Review multiple drafts**:

I hand in a whole posts directory at once and want the skill to run both tracks per file, verdict per file, and report every issue in one pass.

**Not for**:

Rewrite / polish / expand — that's an editor's job; this skill only diagnoses. "Give me an overall critique / suggest a few angles to develop" — not accepted (critique slides into encouragement-flavored rewriting). Star-rating / scoring / ranking published articles — not accepted (reader-trajectory diagnosis is not a rating).

## What it produces

**Diagnose only, never rewrite — the skill is a diagnostic instrument, not a treatment.** That's the most counterintuitive part.

- **Spawns two independent subagents**: Track A skims on reader intuition; Track B walks the anti-pattern catalog item by item. They don't talk to each other and reach verdicts independently — not one agent run twice.
- **Track A output**: paragraph-by-paragraph notes on how reader 耐心 / 信任 shifts + unmet-expectations list + final verdict + a one-line qualitative summary.
- **Track B output**: hit list of reject-level / must-fix / suggested violations, each with line number + original sentence + rule citation.
- **Tri-state verdict**: both tracks pass → ship; both fail → reject; split → needs human review (with a note on why the tracks disagreed).
- **Prints to the terminal**: the report lands directly in the chat window — 0 emoji, 0 scores, 0 softening language. Nothing like "consider polishing further."
- **Will never**: change a single character of the original; assign stars / rankings; push anywhere; short-circuit on a severe violation (it always reports the full set in one pass).

## Prerequisites & boundaries

**Prerequisites**:

The target markdown path must be readable — use the original path, don't copy to `/tmp`. Reviewing 踩坑记 / 养成记 requires access to the rule sources `tranfu-site/goal-docs/05-design-踩坑记-final.md` and `06-design-养成记-final.md`. `grep` uses macOS default BSD or GNU ≥ 2.6 — no reliance on PCRE / `-P` / `\b` / `\d` / `\w`.

**Won't handle**:

- Rewrite / polish / expand the article
- "Overall critique / suggest a few angles to develop"
- Star-rating / scoring / editorial ranking of already-published pieces

**Subtle boundaries**:

- "Can this ship / flag the problems" → triggers; "give me an SEO score" → doesn't (that's content ops)
- "Does this read like a PR puff piece / content-mill piece" → triggers dual-track intuition + catalog scan; "just give it a general critique" → doesn't (critique slides into encouragement-flavored rewriting)
- Tagged 养成记 but timespan < 2 months → the skill rejects it in Track B's structural check, no forcing
- Non-踩坑 / non-养成 genre (news / postmortem / long-form) → Track B skips the structural check but still runs the anti-pattern catalog; Track A applies generic reader expectations
