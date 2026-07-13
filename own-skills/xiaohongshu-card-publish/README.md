---
prompt_examples:
  - prompt: Turn this Xiaohongshu draft into a preview card in the claude-code-quick-reference series.
    scene: Preview from text
  - prompt: Arrange these paragraphs into a Xiaohongshu card set, series named claude-code-quick-reference.
    scene: Start a new series
  - prompt: Append a /compact card at the end of the claude-code-quick-reference series.
    scene: Add one card
  - prompt: Export the claude-code-quick-reference series as final Xiaohongshu images.
    scene: Export a finished series
  - prompt: Batch-export both these series to lossless WebP.
    scene: Export several series
  - prompt: Move the /clear card to position 3 in the series.
    scene: Reorder the cards
---

[English](./README.md) | [中文](./README.zh.md)

# Xiaohongshu Card Export

Turn a Xiaohongshu draft into finished 1080×1440 cards — one pipeline covering template fill, series layout, and playwright lossless WebP export.

## When to use it

**Preview from text**:

I paste a Xiaohongshu draft and say "generate a preview from this doc" — I want the skill to fill the template, create the card folder, and update `pages.json`.

**Start a new series**:

I have several drafts to arrange as one Xiaohongshu series — pick a series slug, produce one preview card at a time, order tracked in `pages.json`.

**Add one card**:

An existing series needs one more card at the end — the skill only adds the card folder and a new `pages.json` entry; the series shell and other cards stay untouched.

**Export a finished series**:

I say "export" / "screenshot" / "cut to size" — the skill runs playwright and drops 1080×1440 lossless WebPs into `dist/<series>/snapshot/`.

**Export several series**:

Several series exported in one call, each respecting its own `pages.json` order.

**Not in scope**:

Editing the card template layout / CSS / adding a new theme → that's editing `assets/` itself, done separately; defining the copy input format / paging rules → data modelling, out of scope; generic HTML or screenshot tasks unrelated to this repo → not applicable.

## What it produces

**By default, no variable is silently filled** — a brand name / page number / account / highlight target missing from the copy stops the skill to ask with a proposed value; a made-up placeholder is never quietly used. This is the most counter-intuitive part.

- **Card output**: `dist/<series>/<card-name>/index.html`, copied from `assets/default.html` and filled at every `{{variable}}`
- **Series shell**: `dist/<series>/index.html` (copied from `assets/app.html`) + `dist/<series>/pages.json` (array order = preview order = export order)
- **Finished images**: `dist/<series>/snapshot/01.webp…NN.webp`, every image measured at 1080×1440, lossless WebP
- **Image-quality contract**: 2x supersampling + LANCZOS downscale to real size + WebP lossless — applied on every export path
- **First-time export**: prompts you to run `pip install playwright pillow && playwright install chromium`
- **Never does**: change the 1080×1440 real dimensions; leak `.ruler` / `.stage` / `--scale` into a card output; commit generated `.png` / `.jpg` / `.webp` into the repo

## Prerequisites and boundaries

**Prerequisites**:

Writable `dist/` under the repo root; playwright + chromium + pillow installed before an export run; `assets/default.html` + `assets/app.html` inside this skill directory are the sole authoritative templates — day-to-day runs only copy them, never edit.

**Not accepted**:

- Editing the templates in `assets/` themselves (that's editing the source of truth, done separately)
- Defining copy input format / paging rules — data modelling, out of scope
- Generic HTML or screenshot tasks unrelated to this repo

**Subtle boundaries**:

- "Change series content" = edit `pages.json` only (add / remove / reorder cards); the series shell and card HTML are never touched
- Variable missing in the copy → stop and ask with a proposed value; never silently fill
- The in-browser "Export all" button is a fallback path; the production route is always `scripts/export.py`
- Card outputs must never contain `.ruler` / `.stage` / `--scale` — those are the shell's preview-only helpers
