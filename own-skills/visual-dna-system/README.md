---
description: "Extract a de-branded, reusable visual DNA — palette, type, layout rhythm, material, voice — from any visual sample, then hand it off to downstream producers. Never a final page."
prompt_examples:
  - prompt: Pull the visual DNA out of stripe.com — keep the calm premium feel, drop the brand.
    scene: Analyze a reference website
  - prompt: Distill a design system from this landing-page screenshot, no brand names.
    scene: Analyze a screenshot
  - prompt: Three landing pages attached — synthesize one main DNA or tell me they clash.
    scene: Combine several references
---

# Visual DNA System

Extract a de-branded, reusable visual DNA — palette, type, layout rhythm, material, voice — from any visual sample, then hand it off to downstream producers. Never a final page.

## When to use it

**Reference in hand**:

I saw a site, screenshot, poster, deck, or app UI whose vibe I like, and I want that vibe abstracted into portable tokens without the original brand attached.

**Combine several references**:

I dropped in several samples at once — let the skill synthesize one main DNA, or tell me they clash and split them into parallel systems.

**Feeding a downstream skill**:

Next step I run `ui-ux-pro-max` (or another producer) on a real page. I need a copy-paste-ready downstream prompt that carries the DNA forward without re-reading the original.

**Style leaning explicit**:

I say "keep the restrained editorial rhythm, drop the icon set, ignore the imagery choices" — the skill respects my call on what to abstract and what to skip.

**Not this**:

Give me a real landing page or dashboard → **ui-ux-pro-max**; draw an architecture or flow diagram → **fireworks-tech-graph**; review whether a design is any good → out of scope.

## What you get

**By default the skill returns a portable design system only — no final page, poster, dashboard, or prototype.** For finished pixels you hand off to a downstream producer.

- **Five-pack**: `Visual DNA Design System` (Markdown) + `visual_dna_system` (JSON tokens) + `Downstream Production Prompt` + `Transferability Notes` + `Originality Guardrails`
- **Delivered inline**: five artifacts stream back into the chat as named blocks — no files touched
- **File only on request**: name a path (e.g. `docs/visual-dna/finance.md`) for the pack to land on disk
- **Originality guard runs**: source logos, brand names, exact layouts, exact copy, and proprietary components are stripped; only transferable abstractions survive
- **Never does**: produce a final page, poster, dashboard, or prototype; reuse source brand assets; crawl locked or anti-bot URLs (asks for a screenshot instead)

## Prerequisites & boundaries

**Prerequisites**:

A readable visual sample — URL, screenshot, Figma frame, image, HTML+CSS, poster, deck, dashboard, or even a written description. Login-walled or 404 URLs → the skill asks for a screenshot or HTML snippet rather than forcing access.

**Adjacent skills**:

| Task | Route to |
|---|---|
| Ship a real page, dashboard, or component design | **ui-ux-pro-max** |
| Draw architecture, flow, or concept diagrams | **fireworks-tech-graph** |
| Review whether a prompt is well-written | **prompt-review** |

**Won't accept**:

- Producing final artifacts (pages, posters, dashboards, decks) — hand off to a downstream producer
- Full brand recreation (source logos, layouts, copy) — the originality guard forces abstraction
- Prompt review or code review → route out

**Fine-line edges**:

- A random nature photo or screenshot with no design intent → no DNA to extract; the skill asks for a better sample
- Multiple samples with clashing styles → the skill asks whether to synthesize one main DNA or split them
- User says "copy this brand exactly" → the skill flags it and continues with abstract extraction only
