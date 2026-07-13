---
prompt_examples:
  - prompt: Make a cover for "AI Agents Are Rewriting the Interface".
    scene: Start from a title
  - prompt: Here's my article draft — give me one horizontal cover for it.
    scene: Use the full article
  - prompt: I need a 16:9 thumbnail for my YouTube video, here's the title.
    scene: Make a video thumbnail
  - prompt: Don't generate the image, just give me the prompt to run elsewhere.
    scene: Return a prompt only
  - prompt: Text-free please, leave a clean safe area — I'll add the title myself.
    scene: Create without text
  - prompt: Editorial magazine feel this time, not another dark tech look.
    scene: Try another style
---

[English](./README.md) | [中文](./README.zh.md)

# article-cover-image

Turns one title (or a full article) into a single 16:9 editorial cover — brand color #E63A46, MiSans-style typography, matte non-plastic finish.

## When to use it

**Title only**

I have a headline or single-sentence topic and I want the skill to jump straight to a cover image — no long analysis first.

**Title + article**

I have a full draft ready and need one horizontal cover for a WeChat post, a video, a PPT title page, or a website banner.

**Prompt only**

I want the raw image prompt so I can run it in another model. The skill switches to text mode and does not call image generation.

**Text-free**

I will typeset the title myself. I just need the background artwork with a clean text-safe area.

**Style hint**

I do not want yet another dark blue tech look. I ask for editorial magazine, cinematic, or matte 3D-icon style and the skill routes to a different lane in its style pool.

**Not for**

- icons or black-line symbols → **black-line-icon-style**
- in-body article illustrations (not the cover) → **post-illustration-images**
- infographics, knowledge cards, comparison tables, process long-scrolls → the infographic workflow
- brand logo finalization → the logo design workflow
- pure copywriting or non-visual analysis → the writing workflow

## What you get

**By default the skill generates the image directly — no plan, no long preamble** unless you explicitly say "prompt only", "no image", or "analyze first".

- **Cover image**: one 16:9 horizontal image, brand color #E63A46 clearly present, MiSans-style Chinese typography, matte low-reflection finish
- **Title compression**: a long headline gets compressed to a cover title of at most 12 Chinese characters (e.g. "Why the default workflow belongs in AGENTS.md, not a Skill" → "AGENTS.md 优先")
- **Auto style routing**: picks one of 8 lanes — minimal magazine, modern product UI, cinematic metaphor, young playful illustration, editorial business, matte 3D icon, abstract art, or futuristic tech — based on the topic keywords
- **Text-mode output**: when you ask for the prompt only, you get the main Prompt plus a Negative Prompt, ready to paste elsewhere
- **Never**: generates infographics, VS comparison layouts, multiple main subjects, glossy plastic or toy 3D looks, subtitles, or long body copy

## Prerequisites & boundaries

**Prerequisites**

An image-generation runtime — without it, only "prompt only" mode works. At least one title, or a topic recoverable from the article body.

**Adjacent skills**

| Task | Route to |
|---|---|
| icon or black-line symbol | **black-line-icon-style** |
| in-body article illustration | **post-illustration-images** |
| infographic / knowledge card / process diagram | infographic workflow |
| formal brand logo | logo design workflow |

**Not accepted**

- No title given and none extractable from the body — the skill stops and asks
- Article copywriting or generic writing prompts
- Non-visual analysis or general prompt engineering

**Subtle boundaries**

- "I want an illustration" — a single horizontal cover triggers this skill; multiple in-body illustrations route to **post-illustration-images**
- "I want an infographic or knowledge card" — does not trigger; this skill is deliberately built to prevent infographic drift
- "Prompt only" — a cover-image target triggers this skill in text mode; a writing or general prompt target does not
