---
prompt_examples:
  - prompt: Make me a minimalist black-and-white icon for AI workflow — abstract.
    scene: Concept theme
  - prompt: Need an empty-state icon for the notifications page — clean line, no color.
    scene: Empty state
  - prompt: Give me a UI entry icon for goal decomposition, readable at 32px.
    scene: UI entry
  - prompt: Just the generation prompt for a prompt-review icon — no image needed.
    scene: Prompt only
  - prompt: Logo-like mark for our AI review module, not a formal brand logo.
    scene: Logo-like mark
  - prompt: Icon for multi-round prompt review — cycle arrows, feedback loop feel.
    scene: Cycle concept
---

[English](./README.md) | [中文](./README.zh.md)

# black-line-icon-style

Ask for a minimalist black-and-white line icon — transparent background, thick rounded strokes, single centered subject, no text — and get the image on the first turn.

## When to use it

**Concept theme**:

I have a theme in my head — AI workflow, goal decomposition, review loop, data analysis — and I want a single abstract symbol that stands for the whole thing.

**UI entry**:

I'm laying out a product page and need a feature entry icon, an empty-state icon, or a small auxiliary mark that still reads at 24-48px.

**Logo-like mark**:

I want something that reads as a module badge or auxiliary graphic — logo-adjacent — without committing to full brand identity work.

**Prompt only**:

I want the generation prompt itself (Chinese, English, or with the negative list) to paste elsewhere. Say "only the prompt / just the prompt / don't generate" and the skill stops at text.

**Not this**:

Colorful illustration, photorealistic, or 3D → different workflow; article cover with title bar → **article-cover-image**; infographic with text and charts → dedicated infographic workflow; formal brand logo, trademark, or VI master mark → logo design workflow or a human designer.

## What you get

**By default the skill generates the image directly — no upfront analysis, no prompt-only reply — unless you explicitly ask for prompt-only mode.**

- **The image**: one black-and-white line icon, transparent background (white fallback), thick black rounded strokes, single centered subject, no text or numbers
- **Pre-generation prompt check**: 7-item self-check confirms the prompt names black-and-white, transparent background, rounded strokes, single subject, no-text rule, small-size readability, and the negative-prompt list before any image call goes out
- **Post-generation image check**: 7-item verification on the produced image; a failure sends the prompt back to tightening
- **Retry policy**: the same failure twice in a row triggers a simpler geometric fallback rather than an infinite loop
- **Prompt-only mode**: on explicit request, returns the Chinese prompt, English prompt, and negative-prompt list instead of calling image generation
- **Never does**: colorful illustration, 3D or shadow effects, decorative posters, text-heavy infographics, or a finalized brand logo

## Prerequisites & boundaries

**Prerequisites**:

An image-generation tool at runtime (Codex or Claude Code image capability). A theme, concept, or use scenario from you — the skill asks for one if missing.

**Adjacent skills**:

| Job | Route to |
|---|---|
| Article cover / horizontal title graphic | **article-cover-image** |
| Formal brand logo, trademark, VI final artwork | logo design workflow or human designer |
| Text-heavy infographic or knowledge card | dedicated infographic workflow |

**Won't accept**:

- Colorful, photorealistic, or 3D/C4D imagery
- Complex posters or article covers with title bars
- Infographics with labels, charts, or knowledge cards
- Final brand logos, trademarks, or VI master marks

**Fine-line edges**:

- "logo-like" auxiliary mark or concept badge → triggers
- "brand logo final / trademark / VI master mark" → does not trigger, routes out
- "only the prompt" + target is a black-line icon → returns prompt text, skips image
- "only the prompt" + target is not an icon → does not trigger
