# Product Design: Post Illustration Images

## Purpose

`post-illustration-images` turns Chinese post content into stable AI-generated illustration assets for WeChat official account articles, Xiaohongshu notes, and Zhihu posts.

The product goal is not to store one magical prompt. The goal is to productize a repeatable image workflow:

```text
content analysis
-> expression need
-> suite-level Style Spec
-> anchors
-> shot list
-> per-image structure
-> per-image metaphor
-> native Codex generation
-> default Brand Plugin overlay
-> QA
-> saved assets
```

## Design Decisions

1. Style details live outside `SKILL.md`.
   - Full style prompts are stored in `references/styles/`.
   - `SKILL.md` only routes and enforces the process.
   - This keeps future style additions cheap.

2. The suite-level Style Spec is selected before shot list execution.
   - The style decides platform appearance, default image count, ratio, color values, typography, layout, safe areas, fixed component slots, and visual DNA.
   - Explicit user style/count instructions can override the default.

3. Style Reference images are QA baselines, not generation inputs.
   - Long-lived reference images live in `assets/style-references/`.
   - Each routed style must have exactly one reference image.
   - Every production Style Spec records its reference under `styleReference.image`; production styles without a machine spec are incomplete.
   - Reference images are used for style drift review and prompt correction only. Ignore their semantic content and any brand watermark presence or position.
   - Canvas size, geometry, slots, and palette values still come from the Style Spec, not from the reference image.

4. Shot list is mandatory.
   - It is the stabilizing artifact between content understanding and image generation.
   - It prevents overstuffed images and repeated ideas.

5. Content expression structure and visual metaphor are separate.
   - Structure organizes information relationships.
   - Metaphor turns abstract content into a concrete scene.

6. Brand Plugin is default-on, user-disableable, and slot-bound.
   - Brand enablement and assets live in `references/brand.md`.
   - Brand assets live in `assets/brand/`.
   - The selected Style Spec controls brand placement and size.
   - Every production Style Spec defines an enabled top-right brand slot and matching reserved area.
   - Missing overlay capability blocks branded delivery unless the user explicitly disables branding.
   - Native image generation must not draw brand logos.

7. Native Codex image generation is the primary generation path.
   - Other image skills are not part of the default route.
   - HTML/CSS rendering is not the main path for this skill.
   - Deterministic overlay scripts may be used for fixed components after generation.
   - `scripts/apply-brand-overlay.mjs` validates the enabled top-right slot, reserved-area containment, canvas bounds, top-right quadrant, and clear-area constraint before rendering.
   - `scripts/apply-brand-overlay.mjs` requires `rsvg-convert` and no npm package.
   - `scripts/check-rsvg-convert.mjs` verifies that dependency and provides install guidance before Brand Plugin overlay work.
   - If `rsvg-convert` is still unavailable after two recorded install checks, stop branded delivery and provide manual install instructions.

## Skill Folder Structure

```text
post-illustration-images/
  SKILL.md
  agents/
    openai.yaml
  assets/
    brand/
      tranfu-logo-reference.svg
    style-references/
      wechat-doodle.png
      xhs-cream-paper.png
      xhs-explainer-notebook.png
      xhs-orange-card.png
      zhihu-tech.png
  scripts/
    apply-brand-overlay.mjs
    check-rsvg-convert.mjs
  references/
    brand.md
    content-structures.md
    product-design.md
    prompt-compiler.md
    qa-checklist.md
    style-index.md
    styles/
      wechat-style-doodle.md
      wechat-style-doodle.spec.json
      xhs-style-cream-paper.md
      xhs-style-cream-paper.spec.json
      xhs-style-explainer-notebook.md
      xhs-style-explainer-notebook.spec.json
      xhs-style-orange-card.md
      xhs-style-orange-card.spec.json
      zhihu-style-title.md
      zhihu-style-title.spec.json
```

## Default Output Contract

Generated images should be saved in the user's current project, not inside the skill folder:

```text
post-illustration-output/<content-slug>/
  shot-list.md
  prompts/
    01-topic.md
    02-topic.md
  images/
    unbranded/
      01-topic.png
      02-topic.png
    branded/
      01-topic.png
      02-topic.png
  manifest.md
```

When the user explicitly disables Brand Plugin, `images/` may contain the final PNG files directly. Otherwise the branded PNG is the production deliverable and the unbranded PNG is retained as its source.

`manifest.md` records:

- File
- Platform
- Style Spec
- Machine Spec path
- Brand Plugin enabled/disabled
- Shot list path
- Prompt path
- Sequence or placement
- Core meaning
- Content expression structure
- Visual metaphor
- Content QA status
- Style Spec QA status
- Brand Plugin QA status, if enabled
- Brand overlay status; `applied` by default or `disabled-by-user` only after an explicit opt-out

## Extension Rules

To add a new visual style:

1. Add the full style prompt to `references/styles/<style-id>.md`.
2. Add a row to `references/style-index.md`.
3. Add one long-lived style reference image to `assets/style-references/<style-id>.png`.
4. Include platform, default use, routing hints, Style Reference path, and a machine-readable Style Spec; it is required for default brand-overlay geometry.
5. Add `styleReference.image`, `styleReference.usage`, `styleReference.contentPolicy`, and `styleReference.isGenerationInput` to the machine spec.
6. Add an enabled top-right `fixedComponents.brandSlot`, a matching `layout.brandReservedArea`, and `generationConstraints.keepBrandReservedAreaClear: true`.
7. Do not copy the full style prompt into `SKILL.md`.

To change brand behavior:

1. Edit `references/brand.md`.
2. Replace or add assets under `assets/brand/`.
3. Do not put platform coordinates, colors, or dimensions in `references/brand.md`.
4. Put placement and size in the selected Style Spec.

To improve quality:

1. Add new recurring failures to `references/qa-checklist.md`.
2. Add new reusable structures to `references/content-structures.md`.
3. Avoid writing one-off user preferences as universal rules.

## Acceptance Criteria

The skill is working when a fresh agent can:

- Infer or ask for platform.
- Read source content before choosing style.
- Select one suite-level Style Spec.
- Resolve one Style Reference image for the selected style and use it only for QA/failure review.
- Produce a shot list before generation.
- Generate one image prompt per shot.
- Save `shot-list.md` and `prompts/*.md` before generation.
- Keep the image set visually consistent.
- Keep model-drawn brand and page-number badges out of generated images.
- Apply the Brand Plugin overlay to every production image unless the user explicitly disables it, and only through the selected Style Spec's top-right slot.
- Ignore Style Reference watermark presence and position when deciding production branding.
- Save outputs with a manifest.
- Explain QA results and fallback decisions.
