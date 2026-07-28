---
description: Generates stable AI illustration sets for Chinese social and article platforms using registered visual styles.
prompt_examples:
  - prompt: Create article illustrations for this WeChat draft.
    scene: WeChat images
  - prompt: Generate a Xiaohongshu image set for this note.
    scene: Xiaohongshu set
  - prompt: Make platform-ready explainer images from this article section.
    scene: Explainer images
---

# Multiplatform Post Illustrations

Produce platform-ready AI illustration bundles with stable style, backend checks, and per-image QA.

## When to use it

**WeChat images**

When a WeChat article needs body illustrations, I want a consistent registered style and delivery-ready files.

**Xiaohongshu set**

When a note or post needs multiple platform-specific cards, I want each image planned, generated, and checked separately.

**Explainer images**

When article sections need visual explanations, I want prompts and outputs tied to the content rather than generic templates.

**Not for**

Do not use it for pure photography, portrait or product retouching, photoreal campaigns, exact long text in images, or another explicitly named image skill.

## What it produces

**The skill keeps its scope narrow: it prepares local deliverables and never performs platform publishing.**

- **Image bundle**: Writes prompts, native images, branded or unbranded outputs, and a manifest in the user project output folder.
- **Backend preflight**: Verifies the generation backend before production work begins.
- **Per-image QA**: Checks every accepted image and preserves approved pixels instead of silently overwriting them.
- **Never does**: It does not merge workflow stages, publish content, or invent missing user approvals.

## Prerequisites & boundaries

**Prerequisites**

Requires readable article or note content, a supported generation backend, and a registered style policy. It writes outputs in the user project, not inside the skill directory.

**Neighboring skills**

| Action | Use |
|---|---|
| Create WeChat cover | **wechat-sketch-cover** |
| Compress outputs | **compress-image** |
| Full visual stage | **content-production** |

**Out of scope**

- Requests that belong to another named skill should be routed there instead.
- Missing or unreadable inputs should stop the workflow rather than produce guessed content.
- Platform publishing, account login, scheduling, and post-publication analytics stay outside this skill.

**Subtle boundaries**

- A complete content-production run may call this skill as a provider, but this skill still owns only its own contracted output.
- Standalone use should leave unrelated project files untouched and report only the files or findings it actually produced.
