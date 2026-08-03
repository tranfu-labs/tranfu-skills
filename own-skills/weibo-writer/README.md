---
description: Write or polish one Chinese Weibo short post from a topic, source article, notes, or existing draft without inventing facts.
prompt_examples:
  - prompt: Write a Weibo post about why more AI tools do not always mean higher efficiency.
    scene: Write a post
  - prompt: Turn this article into one Weibo post, keeping the main facts intact.
    scene: Article to Weibo
  - prompt: Polish this Weibo draft without changing the core point.
    scene: Polish a draft
---

# Weibo Post Writer

Turn a theme, source article, notes, or draft into one publish-ready Chinese Weibo short post with strong spread potential and strict fact boundaries.

## When to use it

**Write a post**

I have a topic, audience, stance, or a few notes and want one Chinese Weibo short post that is clear, compact, and emotionally controlled.

**Article to Weibo**

I have a complete article and want it compressed into one Weibo post while preserving names, numbers, dates, quotes, causal limits, and the author’s voice.

**Polish a draft**

I already wrote a Weibo draft and want structure, opening, rhythm, hashtags, or interaction improved without changing the core point.

**Not for**

This is not for generic summaries, copy for other platforms, hotspot research, ads, literary writing, images, publishing, long Weibo posts, Toutiao articles, or professional medical, legal, or financial conclusions.

## What it produces

**On success it outputs only the final Weibo text.** It does not show the plan, self-check, explanation, word count, or evidence notes unless the user explicitly asks.

- **One final post**: 200–500 Chinese characters by default, including selected hashtags, emoji, and interaction sentence when they genuinely fit.
- **Mode routing**: chooses article conversion, direct writing, or draft polishing from the input.
- **Fact protection**: preserves user-provided facts and removes unsupported precise claims instead of fabricating sources.
- **Style checks**: applies the bundled high-spread short-post model before delivery.
- **Never does**: browse automatically, edit source files, publish to Weibo, invent lived experience, or use shame and false anxiety for reach.

## Prerequisites & boundaries

**Prerequisites**

The request must target a Chinese Weibo short post and provide either a topic, complete source text, notes, or an existing draft.

**Adjacent work**

| Need | Use instead |
|---|---|
| Current-hotspot long commentary with images | `weibo-hotspot-commentary` |
| Public hotspot or trend research only | A research workflow |
| Publishing, scheduling, or analytics | A social platform operations workflow |

**Hard boundaries**

- If audience, mode, stance, or competing focus cannot be inferred safely, the skill asks one focused question and stops.
- Time-sensitive facts need a source; if the claim is not needed, it is deleted.
- User-supplied identity, quotes, numbers, dates, and causal limits are not rewritten into stronger claims.
