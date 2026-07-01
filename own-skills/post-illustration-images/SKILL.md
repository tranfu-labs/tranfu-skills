---
name: post-illustration-images
version: 0.1.0
author: BruceL017
updated_at: 2026-07-01
origin: own
allow_exec: true
description: Generate stable AI illustrations for Chinese posts across WeChat official account articles, Xiaohongshu notes, and Zhihu posts. Use when the user asks for post/article/note illustrations, content images, explainer images, cover/content cards, or platform-ready visual assets for 公众号、小红书、知乎. The skill analyzes the source content first, selects a suite-level visual style, creates a shot list and visual metaphors, then uses native Codex image generation to produce and QA one image at a time.
---

# Post Illustration Images

## Core Rule

Do not reduce this workflow to "analyze content -> choose template -> generate image". Stability depends on the middle layers:

```text
content analysis
-> content type and expression need
-> suite-level Style Spec
-> anchor selection
-> shot list
-> per-image content structure
-> per-image visual metaphor
-> selected visual style constraints
-> brand slot reservation when Brand Plugin is enabled
-> single-image prompt without model-drawn brand or page badge
-> native Codex image generation
-> optional Brand Plugin overlay using the selected Style Spec slot
-> QA and fallback
-> saved assets and delivery notes
```

Always read the content before choosing a visual style. Use one suite-level style for the whole image set. Vary each image only through its content structure and visual metaphor.

## Architecture Boundary

Style Spec is the authority for each platform visual template. It controls canvas size, aspect ratio, fixed color values, layout, safe areas, negative constraints, and any fixed component slots such as a brand slot.

Style Reference images are long-lived QA baselines for failure review. They show the expected visual presentation of a style, but they are not generation inputs and their semantic content must never be copied into new images.

Brand Plugin is optional and pluggable. It only decides whether a brand is enabled and which brand asset to use. It must not decide canvas size, color palette, coordinates, or platform layout. When enabled, the Brand Plugin must obey the selected Style Spec's brand slot. If the selected style has no brand slot, do not improvise a global placement.

The image model must not draw logos, `TF`, `Tranfu`, watermarks, page-number badges, placeholder frames, reserve boxes, or other fixed brand components. Those are either omitted or added after generation by a deterministic overlay step.

## Supported Scope

Strong support:

- WeChat official account body illustrations.
- Xiaohongshu note illustrations, including cover/content carousel images.
- Zhihu post illustrations.
- Method, workflow, concept, comparison, checklist, boundary, and decision-flow explainers.

Conditional support:

- Image sets requiring real product screenshots or factual data: ask for the material or state the assumption.
- Explicit style names: use the matching style file if it exists.
- Explicit image count: override the selected style's default count.

Out of scope:

- Pure photography, portrait retouching, product mockups, or photorealistic brand campaigns.
- Tasks where exact long text inside images is mandatory. Native image generation may distort text; use short labels and retry with less text if needed.
- Any request to route through other image-generation skills unless the user explicitly asks for them.

## Required References

Use references by need, not all at once:

- Start with `references/style-index.md` to identify platform and candidate style files.
- Read the selected file under `references/styles/` completely before compiling prompts.
- Read `references/brand.md` unless the user explicitly disables the Brand Plugin.
- When Brand Plugin may be enabled, run `node scripts/check-rsvg-convert.mjs` before generation to verify deterministic overlay support.
- Read `references/content-structures.md` when selecting per-image expression structures.
- Read `references/prompt-compiler.md` before writing final generation prompts.
- Read `references/qa-checklist.md` before delivery or regeneration.
- When QA finds style drift or a regeneration is needed, inspect the selected style's Style Reference image from `references/style-index.md` or the selected `.spec.json`.
- Read `references/product-design.md` only when maintaining or extending this skill.

## Workflow

### 1. Intake

Determine the platform, source content, requested output, explicit style, explicit count, output location, and whether the Brand Plugin is disabled.

If platform cannot be inferred, ask one concise question. If platform is clear and content is available, proceed without asking for confirmation.

If Brand Plugin may be enabled for the selected or candidate style, run `node scripts/check-rsvg-convert.mjs`:

- If it reports `rsvg-convert` is installed, briefly tell the user the environment is ready and they can trigger the flow with keywords such as `公众号配图`, `小红书配图`, `知乎配图`, or a style ID.
- If it reports missing, ask the user whether to install the shown dependency command. Do not install without user approval.
- After an install attempt, run `node scripts/check-rsvg-convert.mjs --record-attempt`.
- If the second recorded install check still fails, stop the Brand Plugin path, show the manual install command from the script, and do not continue to branded deliverables.
- If the selected style has Brand Plugin disabled, continue without blocking on `rsvg-convert`.

Exit when:

- Platform is known.
- Source content is available.
- Any explicit count/style/brand override is captured.

### 2. Content Analysis

Read the full source content. Summarize the main line in 3-5 sentences, then classify the expression need:

- Concept explanation
- Workflow/process
- Before-after comparison
- Layered framework
- Common mistakes or boundaries
- Decision tree
- Checklist or summary
- Story/state transition

Exit when the core claim, audience value, and visualizable parts are clear.

### 3. Select Suite-Level Style Spec

Use `references/style-index.md` to choose one style for the whole set.

Rules:

- Explicit user style wins if the style exists.
- Otherwise choose the best platform style based on content type and expression need.
- Do not decide image count, aspect ratio, palette, safe area, or fixed component slots before selecting the style. These come from the style file or its machine-readable Style Spec unless the user explicitly overrides them.
- For Zhihu, use the fixed Zhihu style unless future style files add alternatives.

Exit when one style file is selected and read completely.
If the selected style has a machine-readable spec, read it before building the shot list and treat it as authoritative for canvas, safe area, fixed component reservations, and Brand Plugin enablement.

### 4. Select Anchors

Choose only the content points that deserve images. Do not create images to fill a quota.

Good anchors include:

- Core judgment
- Cognitive turn
- Input-output loop
- Before-after contrast
- Common mistake
- Process breakpoint
- Role/state change
- Method layer
- Trust, conversion, or handoff relationship

Exit when each selected anchor can answer: "why does this need an image?"

### 5. Build Shot List

The shot list is mandatory. Each image must contain:

- Placement or sequence
- Topic
- One core meaning
- Content expression structure
- Visual metaphor
- Main actor/object action
- Suggested elements
- Short labels
- Fixed component reservations from the selected Style Spec, if any
- QA risk

Each image must express exactly one core idea. If one image contains multiple ideas, split or delete.
Save the finalized shot list to `shot-list.md` in the output folder before generating images.

### 6. Compile Prompts

For each image, combine:

- User content anchor
- Selected suite-level style file
- Per-image content structure
- Per-image visual metaphor
- Style Spec safe areas and fixed component reservations
- Brand Plugin status from `references/brand.md`
- Native Codex generation constraints
- Negative constraints from the style and QA references

Generate one prompt per image. Do not ask the image model to create an entire multi-image set in one call.
Save each final single-image prompt under `prompts/`, for example `prompts/01-cover.md`, before calling native image generation.

If a style file contains batch language such as "generate the whole set", treat it as planning guidance for count, sequence, and consistency. Still compile and generate one image at a time.

The prompt must explicitly forbid model-drawn logos, `TF`, `Tranfu`, watermarks, page-number badges, placeholder frames, reserve boxes, and visible brand-slot markers. When the Brand Plugin is enabled, ask the model to keep the selected Style Spec's brand slot free of important content so the real brand asset can be overlaid after generation. Do not ask the model to visibly "reserve" or "mark" the slot.

### 7. Generate One Image At A Time

Use native Codex image generation only. Do not invoke other image skills by default.

After each generation:

- Save the image into the current project, not into the skill folder.
- Recommended output path: `post-illustration-output/<content-slug>/`.
- Save the finalized shot list as `shot-list.md`.
- Save final prompts as `prompts/*.md`.
- Save native generated images under `images/unbranded/` when Brand Plugin is enabled.
- Save post-overlay deliverables under `images/branded/` when Brand Plugin is enabled.
- If Brand Plugin is disabled, save deliverables under `images/`.
- Use ordered filenames, for example `01-cover.png`, `02-process-breakpoint.png`.

### 7.1 Continue Existing Assets

Use this branch when the user asks to continue from images already generated in this thread or saved locally, for example adding a watermark, processing "the previous image", restoring a candidate, or adding one more image to an existing set.

Keep the scope minimal:

- First identify the exact target image set from the current output folder, `manifest.md`, user-provided screenshots/paths, and recent native generation cache when needed.
- Do not regenerate or reprocess the whole set when the request concerns only one or a few existing images.
- If the target image is ambiguous or the discovered count conflicts with the user's count, create a quick contact sheet or ask for confirmation before copying candidates into the final output.
- For overlays, start from the unbranded/source image when available so the same brand mark is not applied twice.
- Keep only the minimal manifest update needed for the changed files: file, source/candidate note if relevant, overlay status, size check, and QA status.

Exit when the intended files, count, source images, and output paths are known. Then run only the required overlay, copy, or single-image generation step.

### 7.5 Apply Brand Plugin Overlay

If the Brand Plugin is enabled and the selected Style Spec defines a brand slot:

- Use the real brand asset from `references/brand.md`.
- Overlay the asset after image generation. Do not ask the image model to redraw the logo.
- Use the selected Style Spec's slot, size, and safe-area rules.
- Keep the unbranded generated image unless the user explicitly asks to replace it.
- For the WeChat doodle style, use `scripts/apply-brand-overlay.mjs` with `references/styles/wechat-style-doodle.spec.json`.
- For the Xiaohongshu explainer notebook style, use `scripts/apply-brand-overlay.mjs` with `references/styles/xhs-style-explainer-notebook.spec.json`.
- The overlay script has no npm dependency, but it requires `rsvg-convert` to be available on the machine.

### 8. QA And Fallback

Check every image against `references/qa-checklist.md`. If the result has style drift, compare it with the selected style's Style Reference image and use only visual-system observations to adjust the next prompt.

If an image fails, identify the reason before retrying:

- Text error: reduce text, keep only short labels, regenerate.
- Too many ideas: split or remove anchors.
- Style drift: inspect the Style Reference, ignore its semantic content, then strengthen selected style source and negative constraints.
- Weak metaphor: rewrite physical action and object.
- Brand or placeholder frame was drawn by the model: regenerate with stronger "no logo/no TF/no Tranfu/no placeholder frame/no reserve box" constraints, then apply the Brand Plugin overlay.
- Brand overlay blocks content: use the Style Spec's reserved brand slot; if content occupies that slot, regenerate with a clearer reserved area.
- Existing content must not change but a brand-slot artifact exists: avoid full-image regeneration; restore the original unbranded image, remove only the local artifact with same-image paper/background texture, then reapply the deterministic brand overlay.
- Layout too empty or crowded: adjust structure, not the whole style.

### 9. Save And Deliver

Create or update `manifest.md` in the output folder with:

- File
- Platform
- Style
- Brand Plugin enabled/disabled
- Machine Spec path, if any
- Shot list path
- Prompt path
- Style QA status
- Brand Plugin QA status, if enabled
- Placement/sequence
- Core meaning
- Structure
- Visual metaphor
- QA status

Final response must include:

- Output path.
- Number of images.
- Which style was used.
- Each image's usage.
- QA conclusion and any residual risk.

## Non-Negotiables

- Analyze content before style selection.
- Use one suite-level visual style for the whole set.
- Never skip the shot list.
- Every image expresses one core meaning.
- Content expression structure organizes information.
- Visual metaphor turns abstraction into a concrete scene.
- Suite-level Style Spec controls platform appearance, dimensions, colors, layout, safe areas, and fixed component slots.
- Brand Plugin is enabled by default only when the selected Style Spec defines a brand slot; it must obey that slot and must not behave as a global visual system.
- The image model must not draw brand logos, page-number badges, placeholder frames, reserve boxes, or visible brand-slot markers.
- Generate and QA one image at a time.
- Save `shot-list.md`, `prompts/*.md`, and `manifest.md` for every run.
- Save generated assets outside the skill folder.
