---
description: Builds a shared outline, A/B masters, and five-platform Chinese content drafts from approved inputs.
prompt_examples:
  - prompt: Use the approved outline to draft the five-platform A/B set.
    scene: Draft from outline
  - prompt: Improve this shared outline before writing the platform versions.
    scene: Improve outline
  - prompt: Run the complete drafting workflow from these upstream materials.
    scene: Full drafting
---

# Multiplatform Drafting Workflow

Move prepared research into a shared outline, two masters, and complete platform adaptations.

## When to use it

**Draft from outline**

When upstream topic and source work is approved, I want A/B masters and five-platform adaptations.

**Improve outline**

When the shared outline needs one approval step before writing, I want the workflow to pause there.

**Full drafting**

When I explicitly need the complete shared-outline plus A/B five-platform workflow, this is the drafting stage.

**Not for**

Do not use it for ordinary single-platform writing, fiction, ads, research, topic selection, titles only, proofreading, images, layout, or publishing.

## What it produces

**The skill keeps its scope narrow: it prepares local deliverables and never performs platform publishing.**

- **Shared outline**: Creates or improves the approved outline used by all drafts.
- **A/B masters**: Produces two platform-neutral masters with separated style treatment.
- **Platform drafts**: Creates adaptations for WeChat, Xiaohongshu, Zhihu, Weibo, and Toutiao.
- **Never does**: It does not merge workflow stages, publish content, or invent missing user approvals.

## Prerequisites & boundaries

**Prerequisites**

Requires approved upstream topic and source material. It is a drafting stage, so unresolved research or topic decisions should be handled first.

**Neighboring skills**

| Action | Use |
|---|---|
| Choose topic | **content-topics** |
| Proofread drafts | **proofread-content** |
| Generate titles | **title-options** |

**Out of scope**

- Requests that belong to another named skill should be routed there instead.
- Missing or unreadable inputs should stop the workflow rather than produce guessed content.
- Platform publishing, account login, scheduling, and post-publication analytics stay outside this skill.

**Subtle boundaries**

- A complete content-production run may call this skill as a provider, but this skill still owns only its own contracted output.
- Standalone use should leave unrelated project files untouched and report only the files or findings it actually produced.
