---
description: Guide a product conversation from an unclear page or flow idea into a confirmed PRD, without inventing decisions for the user.
prompt_examples:
  - prompt: Help me interview through the PRD for the billing settings page.
    scene: New page PRD
  - prompt: The onboarding flow concept changed; walk me through the PRD again.
    scene: Rethink a flow
  - prompt: Interview me before writing requirements for this implemented module.
    scene: Clarify requirements
---

# PRD Interview

Turn a vague page or cross-page flow into a confirmed PRD by asking the product questions that actually change the outcome.

## When to use it

**New page PRD**

Use this when you need to define a product page from scratch, especially when the page already has some implementation evidence but no clear product decision record.

**Rethink a flow**

Use this when an existing PRD, wireframe, or implementation no longer matches the concept in your head. The skill helps reopen the core assumptions instead of patching old text.

**Clarify requirements**

Use this when you want the agent to interview you before it writes `docs/product/pages/<page>.md` or `docs/product/flows/<flow>.md`. It is designed for decisions, not filler prose.

**Not for**

Do not use it to read an existing PRD back to you, tweak copy, fix a typo, add one status sentence, write implementation specs, or split engineering work. Those should stay as direct edits, OpenSpec work, or roadmap planning.

## What it produces

**It pauses at the decision points instead of racing to a complete-looking document.**

- **Current-state judgment**: reads the relevant PRD, wireframe, and implementation evidence, then summarizes what is a real product fact and what is only historical implementation.
- **High-leverage questions**: asks 3-6 questions with default recommendations, so the user can approve, reject, or adjust concrete product choices.
- **Product thesis**: condenses the answers into one sentence for the product purpose and one core user journey.
- **Confirmed draft**: writes only the decisions the user has approved; unresolved points stay visibly marked as pending.
- **User-perspective review**: sends the draft to a read-only subagent that role-plays the PRD's stated target user and reports confusing or unrealistic parts.
- **One-file commit discipline**: one interview produces one PRD file and, when authorized, one commit containing only that file.
- **Never does**: silently invent product decisions, use old wireframes as product truth, or merge unrelated PRD files into one commit.

## Prerequisites & boundaries

**Prerequisites**

The target project should have a product-documentation convention. The skill looks first for `docs/product/AGENTS.md`, then project-level `AGENTS.md` or `CLAUDE.md`; if none exists, it asks where the PRD should live and what structure to follow.

**Expected output paths**

- Page PRDs normally go under `docs/product/pages/<page>.md`.
- Cross-page flow PRDs normally go under `docs/product/flows/<flow>.md`.
- If the project defines different paths, the project convention wins.

**Nearby responsibilities**

| Need | Use |
|---|---|
| Engineering specs or implementation tasks | OpenSpec workflow |
| Copy edits or typo fixes | Direct editing |
| Product-documentation system rules | Project documentation conventions |

**Boundaries**

- If the user brings several pages at once, start with one implemented page slice so the discussion has evidence to push against.
- If the user changes the product thesis after confirmation, go back to the thesis step before editing the draft.
- If the review subagent cites personas or product documents outside the PRD, discard that feedback and rerun with a tighter prompt.
- If the current implementation cannot support the PRD's requirement, record that as a product gap instead of weakening the PRD to match old code.
