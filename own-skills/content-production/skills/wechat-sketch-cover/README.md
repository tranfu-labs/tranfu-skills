---
description: Generates one warm hand-drawn WeChat Official Account cover and normalizes it to 1923x818 PNG.
prompt_examples:
  - prompt: Create a WeChat cover from this exact Chinese title.
    scene: Title cover
  - prompt: Generate a warm hand-drawn cover for this Markdown article.
    scene: Article cover
  - prompt: Make one 1923x818 WeChat public-account cover in the fixed style.
    scene: Fixed style
---

# WeChat Sketch Cover

Create a single fixed-style WeChat cover image from an exact title or Markdown article.

## When to use it

**Title cover**

When I have the exact Chinese or Chinese-mixed title, I want one WeChat cover that matches it.

**Article cover**

When I provide a Markdown article, I want the skill to derive one cover concept in the fixed warm hand-drawn notebook style.

**Fixed style**

When the output must be exactly 1923x818 PNG for WeChat Official Accounts, this skill owns the normalization.

**Not for**

Do not use it for generic covers, other platforms, critique, design advice, prompt-only requests, body illustrations, other styles, brand overlays, retouching, URLs, or publishing.

## What it produces

**The skill keeps its scope narrow: it prepares local deliverables and never performs platform publishing.**

- **Cover PNG**: Writes one normalized 1923x818 PNG candidate.
- **Prompt and QA notes**: Derives a concept, compiles prompts, evaluates candidates, and records the selected result.
- **No publishing**: It creates the local asset only and does not upload to WeChat.
- **Never does**: It does not merge workflow stages, publish content, or invent missing user approvals.

## Prerequisites & boundaries

**Prerequisites**

Provide an exact Chinese or Chinese-mixed title, or one readable Markdown article. The runtime needs an available image-generation path.

**Neighboring skills**

| Action | Use |
|---|---|
| Body illustrations | **post-illustration-images** |
| Compress cover | **compress-image** |
| Format article | **format-content** |

**Out of scope**

- Requests that belong to another named skill should be routed there instead.
- Missing or unreadable inputs should stop the workflow rather than produce guessed content.
- Platform publishing, account login, scheduling, and post-publication analytics stay outside this skill.

**Subtle boundaries**

- A complete content-production run may call this skill as a provider, but this skill still owns only its own contracted output.
- Standalone use should leave unrelated project files untouched and report only the files or findings it actually produced.
