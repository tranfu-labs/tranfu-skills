---
prompt_examples:
  - prompt: Here's the body of my WeChat article — put together a few illustrations for it.
    scene: Illustrate a WeChat article
  - prompt: For this new Xiaohongshu post, make me a cover plus four body slides, built around a before/after comparison.
    scene: Create a Xiaohongshu set
  - prompt: Use the wechat-doodle style to draw 3 concept illustrations for this piece.
    scene: Follow a chosen style
  - prompt: This paragraph needs a process breakdown, that one needs a common-mistakes diagram, and add a side-by-side comparison too.
    scene: Plan images by paragraph
  - prompt: For the earlier 01-cover, just apply the brand logo — don't redraw it.
    scene: Add a logo afterward
  - prompt: Skip the brand logo, just give me the raw images — I'll add a watermark myself later.
    scene: Remove brand elements
---

English | [中文](./README.zh.md)

# Post Illustration Images

Generates a full illustration set for a WeChat / Xiaohongshu / Zhihu post in one pass — reading the body, storyboarding, shot-by-shot generation, and QA all handled end-to-end.

## When to use it

**Illustrate a WeChat article**:

I've finished a WeChat post, paste in the body, and say "make me a few illustrations." I want the skill to read the whole piece, pick a style based on what the article is doing (method walk-through, process, comparison, checklist), and generate one image at a time.

**Create a Xiaohongshu set**:

I need a cover plus a body carousel that read as a single visual set — each slide carrying exactly one point — with the shot list derived from anchors in the text before anything is drawn.

**Follow a chosen style**:

I name `wechat-doodle` / `xhs-explainer-notebook` / `zhihu-tech` up front, so the skill skips the style-selection prompt and generates directly against that `style_file` and `style_spec`.

**Plan images by paragraph**:

I go paragraph by paragraph — "this one needs a process breakdown, that one needs a common-mistakes diagram" — and the skill builds the shot list from content anchors, one idea per image, without padding the count to hit a number.

**Follow-ups and logo overlay**:

For images from a previous run, I want to add the logo / append one more shot / re-run a single image — only the specified one changes, the whole set is not regenerated.

**Not in scope**:

Pure photography / portrait retouching / product renders / photorealistic brand hero shots — won't trigger; long precise paragraphs baked into the image — won't trigger (native image models can't render them reliably); explicit routing to a different image skill — hand it off.

## What it produces

**By default, one image is generated at a time, series consistency is carried by the `style_spec`, and brand logos / page numbers / placeholder frames are never drawn by the image model** — these three defaults are the counter-intuitive ones.

- **Output location**: `post-illustration-output/<article-slug>/` under the project root — never written inside the skill directory
- **Every run produces**: `shot-list.md` (storyboard) + `prompts/*.md` (one prompt file per shot) + `manifest.md` (set-level metadata in YAML)
- **Image paths**: `images/unbranded/*.png` (originals before logo overlay) + `images/branded/*.png` (logo applied); with branding off, only `images/*.png`
- **Overlay side effect**: runs `scripts/apply-brand-overlay.mjs` for the logo overlay, which depends on `rsvg-convert` on the machine; on first missing dependency you're asked once whether to install — declining falls back to an unbranded delivery
- **QA loop**: a failing image is retried up to 2 times; still failing, it either falls back to a content-anchor tweak or, with your consent, ships with a `residual_risk` note
- **Never does**: ask the image model to draw the logo / TF / watermark / page-number frame; generate the whole carousel in one shot; copy the visual semantics of a `style_reference`

## Prerequisites and boundaries

**Prerequisites**:

Codex / OpenAI native image generation is available; the target platform is WeChat / Xiaohongshu / Zhihu; if the brand overlay is enabled, `rsvg-convert` must be present on the machine (the script checks first, and declining install falls back to unbranded).

**Not accepted**:

- Photography / portrait retouching / product renders / photorealistic brand hero shots
- Images that must carry a long, exact block of prose (native image models aren't stable at that)
- Explicit routing to a different image-generation skill

**Subtle boundaries**:

- "Make me 5" — the 5 is an **upper bound, not a quota**; if the content anchors don't support 5, fewer are delivered instead of padding
- `style_reference` is a **long-lived QA baseline**; it is never fed in as generation input, nor is its visual semantics copied
- Whether branding is applied is decided by three tiers: explicit user opt-out > `style_spec` slot not enabled > default off; any one hit means no overlay
- Single-image re-run: only the named image is touched, the whole set is not regenerated; when the pre-overlay original is missing, you're asked whether to accept the risk of re-applying the logo on top of an already-branded image
