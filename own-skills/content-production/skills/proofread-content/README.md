---
description: Runs three-pass proofreading on finished Simplified Chinese platform drafts without changing their facts or stance.
prompt_examples:
  - prompt: Proofread this finished WeChat draft before layout.
    scene: Pre-layout review
  - prompt: Make this draft sound less AI-written without changing the claims.
    scene: Natural voice
  - prompt: Run the three-pass proofreading workflow on this platform draft.
    scene: Three-pass edit
---

# Chinese Content Proofreading

Polish finished Simplified Chinese platform drafts while protecting the title, claims, facts, stance, and structure.

## When to use it

**Pre-layout review**

When a finished draft is ready for layout or publishing handoff, I want a final language and consistency pass.

**Natural voice**

When the copy feels AI-written, I want a more natural self-media voice without factual drift.

**Three-pass edit**

When I explicitly need the full proofreading workflow, I want content, voice, and detail passes in order.

**Not for**

Do not use it for writing from scratch, topics, outlines, translation, formatting only, academic or legal writing, publishing, or detector evasion.

## What it produces

**The skill keeps its scope narrow: it prepares local deliverables and never performs platform publishing.**

- **Clean copy**: Returns polished copy ready for layout.
- **Regression checks**: Protects claims, stance, facts, data, cases, and structure.
- **Scoped edits**: Improves wording and rhythm without inventing new substance.
- **Never does**: It does not merge workflow stages, publish content, or invent missing user approvals.

## Prerequisites & boundaries

**Prerequisites**

Provide a complete Simplified Chinese draft for a supported platform. Unfinished ideas and source material should go to upstream writing skills first.

**Neighboring skills**

| Action | Use |
|---|---|
| Draft content | **draft-content** |
| Generate titles | **title-options** |
| Format WeChat HTML | **format-content** |

**Out of scope**

- Requests that belong to another named skill should be routed there instead.
- Missing or unreadable inputs should stop the workflow rather than produce guessed content.
- Platform publishing, account login, scheduling, and post-publication analytics stay outside this skill.

**Subtle boundaries**

- A complete content-production run may call this skill as a provider, but this skill still owns only its own contracted output.
- Standalone use should leave unrelated project files untouched and report only the files or findings it actually produced.
