---
name: post-illustration-images
version: 0.1.0
author: BruceL017
updated_at: 2026-07-01
origin: own
allow_exec: true
description: Generate stable platform-ready AI illustrations for WeChat official account articles, Xiaohongshu notes, and Zhihu posts. Use when the user asks for post/article/note illustrations, content images, explainer images, cover/content cards, 公众号配图, 小红书组图, 知乎配图, 帮我做配图, or 给文章画几张图. Do NOT trigger when the task is pure photography, portrait/product retouching, photoreal brand campaigns, exact long text inside images, or the user explicitly names another image-generation skill. Safety boundaries: one suite style, one image per generation, no model-drawn logos or page badges.
---

# Post Illustration Images

## Core Rule

Do not reduce this workflow to "analyze content -> choose template -> generate image". Stability depends on the middle layers:

```text
content analysis
-> content type and expression need
-> suite-level style_spec
-> anchor selection
-> shot list
-> per-image content structure
-> per-image visual metaphor
-> selected visual style constraints
-> brand slot reservation when Brand Plugin is enabled
-> single-image prompt without model-drawn brand or page badge
-> native Codex image generation
-> optional Brand Plugin overlay using the selected style_spec slot
-> QA and fallback
-> saved assets and delivery notes
```

This is the mental model; the actual runnable steps are the numbered Workflow sections below.

Always read the content before choosing a visual style. Use one suite-level style for the whole image set. Vary each image only through its content structure and visual metaphor.

Ownership: edit files in the user's project output folder only. This skill creates or updates `post-illustration-output/<content-slug>/` and never writes generated assets into the skill folder. Do not overwrite an existing `manifest.md`, prompt, or image unless the user explicitly asks to replace it or the current run owns that file.

Named artifact: `PostIllustrationBundle` = `{ output_dir, manifest.md, shot-list.md, prompts/*.md, images/(branded|unbranded|direct)/*.png, final_response_summary }`.

Terminology:

- `style_id`: the stable ID from `references/style-index.md`, for example `wechat-doodle`.
- `style_file`: the selected human-readable Markdown style file under `references/styles/`.
- `style_spec`: the selected machine-readable `.spec.json`, if present.
- `style_reference`: the QA-only reference image listed in `references/style-index.md`.
- `selected_style_bundle`: `{ style_id, platform, style_file, style_spec?, style_reference?, brand_slot_enabled }`.

## Architecture Boundary

`style_spec` is the authority for each platform visual template. It controls canvas size, aspect ratio, fixed color values, layout, safe areas, negative constraints, and any fixed component slots such as a brand slot.

`style_reference` images are long-lived QA baselines for failure review. They show the expected visual presentation of a style, but they are not generation inputs and their semantic content must never be copied into new images.

Brand Plugin is optional and pluggable. It only decides whether a brand is enabled and which brand asset to use. It MUST NOT decide canvas size, color palette, coordinates, or platform layout. Priority: user-explicit-disable > selected `style_spec` brand slot presence > default disabled. Brand Plugin runs only when the user has not disabled it and the selected `style_spec` defines an enabled brand slot.

The image model MUST NOT draw logos, `TF`, `Tranfu`, watermarks, page-number badges, placeholder frames, reserve boxes, or other fixed brand components. Those are either omitted or added after generation by a deterministic overlay step. If the user explicitly requests model-drawn brand text or inline logo simulation, state the QA risk and ask for confirmation before proceeding.

## Supported Scope

Strong support:

- WeChat official account body illustrations.
- Xiaohongshu note illustrations, including cover/content carousel images.
- Zhihu post illustrations.
- Method, workflow, concept, comparison, checklist, boundary, and decision-flow explainers.

Conditional support:

- Image sets requiring real product screenshots or factual data: require user-provided material. State assumptions only for non-factual illustrative placeholders.
- Explicit style names: use the matching `style_id` or `style_file` only if it exists in `references/style-index.md`; unknown styles require user confirmation before fallback.
- Explicit image count: treat it as a target or ceiling after anchor selection. Anchor quality wins; never create filler images to satisfy a quota.

Out of scope:

- Pure photography, portrait retouching, product mockups, or photorealistic brand campaigns.
- Tasks where exact long text inside images is mandatory. Native image generation may distort text; use short labels and retry with less text if needed.
- Any request to route through other image-generation skills unless the user explicitly asks for them.

## Required References

Use references by need, not all at once:

- Start with `references/style-index.md` to identify platform and candidate style files.
- Read the selected file under `references/styles/` completely before compiling prompts.
- Read `references/brand.md` unless the user explicitly disables the Brand Plugin.
- Read `references/content-structures.md` when selecting per-image expression structures.
- Read `references/prompt-compiler.md` before writing final generation prompts.
- Read `references/qa-checklist.md` before delivery or regeneration.
- When QA finds style drift or a regeneration is needed, inspect the selected `style_reference` from `references/style-index.md` and the selected `style_spec`.
- Read `references/product-design.md` only when maintaining or extending this skill.

Resolve `references/`, `assets/`, and `scripts/` from the skill root. User source content and generated outputs are project-relative or absolute user paths. Deterministic commands should be run from the skill root, for example `cd <skill-root> && node scripts/check-rsvg-convert.mjs`.

## Workflow

MUST create and update a task list for the tasks below: Intake, Content Analysis, Select Suite-Level Style Spec, Select Anchors, Build Shot List, Compile Prompts, Generate One Image At A Time, Continue Existing Assets when used, Apply Brand Plugin Overlay when used, QA And Fallback, Save And Deliver.

### 1. Intake

1. Collect `IntakeContext` fields:
   - `platform`: one of `wechat`, `xhs`, `zhihu`, or `unknown`.
   - `source_content`: pasted text, file path, URL content already fetched into the conversation, or user-provided notes.
   - `requested_output`: body illustration, cover, carousel, continuation, overlay-only, or unknown.
   - `style_id`: explicit style ID or `null`.
   - `count`: positive integer or `null`.
   - `output_dir`: user-provided path or default `post-illustration-output/<content-slug>/`.
   - `brand_disabled`: boolean.

2. If `source_content` is missing, ask for the article/note/post content and stop this run until it is provided.

3. If `platform` is `unknown`, ask one concise platform question. If the user mentions multiple platforms, split the work into one `PostIllustrationBundle` per platform unless they ask for only one shared draft.

4. If `style_id` and `platform` conflict, or `count` conflicts with a platform format, ask one concise question before selecting style.

5. Produce `IntakeContext` and enter Section 2.

Exit when:

- `platform` is in `{wechat, xhs, zhihu}`.
- `source_content` is non-empty or references an existing readable file path.
- `output_dir`, `requested_output`, `style_id`, `count`, and `brand_disabled` are explicitly set to a value or `null`.

### 2. Content Analysis

1. Read the full source content.
2. Write `AnalysisSummary` with:
   - `main_line`: 3-5 sentences.
   - `core_claim`: one sentence.
   - `audience_value`: one sentence.
   - `expression_need`: one value from the list below.
   - `anchor_candidates`: at least one visualizable content point.

Allowed `expression_need` values:

- Concept explanation
- Workflow/process
- Before-after comparison
- Layered framework
- Common mistakes or boundaries
- Decision tree
- Checklist or summary
- Story/state transition

Exit when `AnalysisSummary.main_line`, `core_claim`, `audience_value`, `expression_need`, and `anchor_candidates[]` are written.

### 3. Select Suite-Level Style Spec

1. Read `references/style-index.md`.
2. If the user provided `style_id` and it is not listed, show available candidates for the platform and ask the user to choose or approve automatic selection.
3. If no style is specified, select the best `style_id` for `platform` and `AnalysisSummary.expression_need`.
4. Read the selected `style_file` completely.
5. If the selected row has `style_spec`, read it before building the shot list. If `style_file` or required `style_spec` is missing or unreadable, stop before Section 4 and report the missing path.
6. Set `selected_style_bundle = { style_id, platform, style_file, style_spec?, style_reference?, brand_slot_enabled }`.
7. Compute `brand_enabled = !brand_disabled && selected_style_bundle.brand_slot_enabled`.
8. Happy path order is: select and read `style_file`/`style_spec` -> determine `brand_enabled` -> run `rsvg-convert` checks only when `brand_enabled` is true.
9. If `brand_enabled` is true, run `cd <skill-root> && node scripts/check-rsvg-convert.mjs`:
   - If installed, continue.
   - If missing, ask whether to install the command shown by the script. Do not install without approval.
   - If the user declines or does not answer, set `brand_enabled = false`, continue unbranded, and record this in `manifest.md`.
   - After an approved install attempt, run `cd <skill-root> && node scripts/check-rsvg-convert.mjs --record-attempt`.
   - If the second recorded check still fails, set `brand_enabled = false`, show the manual install command, and continue unbranded.

Rules:

- Otherwise choose the best platform style based on content type and expression need.
- Do not decide image count, aspect ratio, palette, safe area, or fixed component slots before selecting the style. These come from the selected `style_file` or `style_spec` unless the user explicitly overrides them.
- For Zhihu, use the fixed Zhihu style unless future style files add alternatives.

Exit when `selected_style_bundle` and `brand_enabled` are set, and the selected `style_file` plus any required `style_spec` have been read.

### 4. Select Anchors

Choose only the content points that deserve images. Explicit `count` is a target or ceiling, not permission to invent filler. If `count` is lower than viable anchors, select the top `count`. If `count` is higher than viable anchors, ask once whether to deliver fewer justified images or provide more content; otherwise deliver only justified anchors and note the mismatch.

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

Exit when each selected anchor has `{ anchor_id, source_excerpt, rationale, priority }`, every `rationale` is non-empty, and selected anchor count is within the explicit `count` or selected style default.

### 5. Build Shot List

The shot list is mandatory. If `style_spec` has not been read when present, return to Section 3 before writing the shot list. `shot-list.md` MUST use this markdown bullet order for each image:

- Placement or sequence
- Topic
- One core meaning
- Content expression structure
- Visual metaphor
- Main actor/object action
- Suggested elements
- Short labels
- Fixed component reservations from the selected `style_spec`, if any
- QA risk

Each image MUST express exactly one core idea. If one image contains multiple ideas, split or delete. Save the finalized shot list to `shot-list.md` in the output folder before generating images.

GOOD:

```markdown
- Placement or sequence: 01-cover
- Topic: Why the handoff between draft and visual matters
- One core meaning: A clear anchor prevents decorative filler.
- Content expression structure: Before-after comparison
- Visual metaphor: A messy note stack becomes one labeled storyboard frame.
- Main actor/object action: A hand moves one highlighted note into a clean frame.
- Suggested elements: notes, frame, arrow, small checklist marks
- Short labels: "before", "anchor", "image"
- Fixed component reservations from the selected `style_spec`, if any: bottom-right brand slot from selected `style_spec`, no important content there
- QA risk: model may add extra labels or draw a fake logo
```

WRONG:

```markdown
- One core meaning: Explain the workflow, list all mistakes, and sell the brand.
```

Reason: one image carries multiple core ideas. Split into separate anchors or delete lower-priority ideas.

### 6. Compile Prompts

For each image, combine:

- User content anchor
- Selected `style_file`
- Per-image content structure
- Per-image visual metaphor
- `style_spec` safe areas and fixed component reservations
- Brand Plugin status from `references/brand.md`
- Native Codex generation constraints
- Negative constraints from the style and QA references

MUST compile and generate one prompt per image. NEVER ask the image model to create an entire multi-image set in one call.
Save each final single-image prompt under `prompts/`, for example `prompts/01-cover.md`, before calling native image generation.

If a style file contains batch language such as "generate the whole set", MUST treat it as planning guidance only. MUST compile and generate one image at a time.

The prompt MUST explicitly forbid model-drawn logos, `TF`, `Tranfu`, watermarks, page-number badges, placeholder frames, reserve boxes, and visible brand-slot markers. When Brand Plugin is enabled, ask the model to keep the selected `style_spec` brand slot free of important content so the real brand asset can be overlaid after generation. MUST NOT ask the model to visibly "reserve" or "mark" the slot.

WRONG:

```text
Generate a five-image Xiaohongshu carousel and put the Tranfu logo in the corner of each page.
```

Reason: this asks for a batch output and model-drawn branding.

GOOD:

```text
Create image 01-cover only for the selected style_id xhs-explainer-notebook. Use the selected style_file visual system and selected style_spec canvas/safe areas. Core meaning: a clear anchor prevents decorative filler. Visual metaphor: a messy note stack becomes one labeled storyboard frame. Keep text to short labels only: before, anchor, image. Leave the style_spec brand slot free of important content, but do not draw, reserve, mark, frame, or label that slot. Negative constraints: no logo, no TF, no Tranfu, no watermark, no page badge, no placeholder frame, no reserve box, no copied semantic content from the style_reference.
```

WRONG:

```text
Copy the example reference image but change the words.
```

Reason: `style_reference` is QA-only; semantic content from reference images must not be copied.

WRONG:

```text
Draw an empty dashed rectangle labeled "logo area" in the bottom-right corner.
```

Reason: visible brand-slot markers and reserve boxes are fixed components, not image-model content.

GOOD:

```text
Keep important content away from the selected style_spec brand slot. Do not draw, label, outline, reserve, or mark the slot.
```

WRONG:

```text
Put this complete paragraph inside the image: "Our new method first parses the article, then builds a reusable abstraction layer, then optimizes every downstream interaction for clarity and conversion."
```

Reason: exact long text inside generated images is unreliable and out of scope.

GOOD:

```text
Use at most three short labels: parse, anchor, image.
```

### 7. Generate One Image At A Time

MUST use native Codex/OpenAI image generation only. NEVER invoke other image skills unless the user explicitly names a specific alternative image skill. If native image generation is unavailable in the current runtime, stop with a clear blocker and do not silently route to another image tool.

Dispatch generation mode:

- New suite: generate one image per prompt, then run Section 7.5 if `brand_enabled`.
- Continue existing assets: use Section 7.1.
- Overlay-only request: use Section 7.5 without regenerating source images.
- Otherwise: ask one concise question or stop as `BLOCKER: unknown generation mode`.

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

Inputs:

- `target_image_ids_or_paths`: user-provided IDs/paths, manifest rows, screenshots, or recent generation candidates.
- `operation`: overlay-only, copy/restore, regenerate one image, or add one new image.
- `source_image_path`: unbranded/source image path when overlaying.
- `requested_count`: integer or `null`.

Outputs:

- `ContinuePlan`: `{ targets, operation, source_images, output_paths, manifest_rows_to_update }`.
- Updated rows in the Section 9 `manifest.md` schema; unchanged fields stay unchanged.

Steps:

- First identify the exact target image set from the current output folder, `manifest.md`, user-provided screenshots/paths, and recent native generation cache when needed.
- Do not regenerate or reprocess the whole set when the request concerns only one or a few existing images.
- If the target image is ambiguous or the discovered count conflicts with the user's count, create a quick contact sheet or ask for confirmation before copying candidates into the final output. If ambiguity remains unresolved, stop as `BLOCKER: unresolved target`.
- For overlays, start from the unbranded/source image when available so the same brand mark is not applied twice.
- If overlay is requested and no unbranded/source image exists, ask whether to use the current branded image with duplicate-mark risk or regenerate the source. If the user does not choose, stop as `BLOCKER: missing source image`.
- Keep only the minimal manifest update needed for changed Section 9 keys: `file`, `source_note`, `brand_overlay_status`, `size_check_status`, QA fields, and `residual_risk`.

Exit when `ContinuePlan.targets`, `operation`, `source_images`, `output_paths`, and `manifest_rows_to_update` are non-empty where required. Then run only the required overlay, copy, or single-image generation step.

### 7.5 Apply Brand Plugin Overlay

If `brand_enabled` is true and the selected `style_spec` defines an enabled brand slot:

- Use the real brand asset from `references/brand.md`.
- Overlay the asset after image generation. Do not ask the image model to redraw the logo.
- Use the selected `style_spec` slot, size, and safe-area rules.
- Keep the unbranded generated image unless the user explicitly asks to replace it.
- Run from the skill root so script and spec paths are stable:

```bash
cd <skill-root>
node scripts/apply-brand-overlay.mjs \
  --style-spec <selected_style_bundle.style_spec> \
  --brand-svg assets/brand/tranfu-logo-reference.svg \
  --input <project-output-dir>/images/unbranded/01-cover.png \
  --output <project-output-dir>/images/branded/01-cover.png
```

- The overlay command is generic for every brand-enabled `style_spec`, including `wechat-doodle`, `xhs-explainer-notebook`, and `zhihu-tech`.
- The overlay script has no npm dependency, but it requires `rsvg-convert` to be available on the machine.

### 8. QA And Fallback

1. Read `references/qa-checklist.md` before judging output.
2. Check every image against the QA checklist and selected `style_reference`.
3. If all images pass content QA, style QA, brand QA, and set QA, enter Section 9.
4. If an image fails, identify the reason before retrying. Retry a failed image at most two times after the first failed output.
5. If the same image still fails after retries, return to Section 4 for anchor/shot-list adjustment or deliver only with explicit `residual_risk` if the user approves.

If an image fails, identify the reason before retrying:

- Text error: reduce text, keep only short labels, regenerate.
- Too many ideas: split or remove anchors.
- Style drift: inspect the `style_reference`, ignore its semantic content, then strengthen selected style source and negative constraints.
- Weak metaphor: rewrite physical action and object.
- Brand or placeholder frame was drawn by the model: regenerate with stronger "no logo/no TF/no Tranfu/no placeholder frame/no reserve box" constraints, then apply the Brand Plugin overlay.
- Brand overlay blocks content: use the selected `style_spec` brand slot; if content occupies that slot, regenerate with a clearer unmarked area.
- Existing content must not change but a brand-slot artifact exists: avoid full-image regeneration; restore the original unbranded image, remove only the local artifact with same-image paper/background texture, then reapply the deterministic brand overlay.
- Layout too empty or crowded: adjust structure, not the whole style.

### 9. Save And Deliver

Create or update `manifest.md` in the output folder using this stable YAML schema. Continuation work in Section 7.1 MUST patch this same schema instead of inventing a separate mini manifest.

```yaml
post_illustration_bundle:
  output_dir: post-illustration-output/example-slug
  platform: xhs
  style_id: xhs-explainer-notebook
  style_file: references/styles/xhs-style-explainer-notebook.md
  style_spec: references/styles/xhs-style-explainer-notebook.spec.json
  style_reference: assets/style-references/xhs-explainer-notebook.png
  brand_plugin_enabled: true
  shot_list_path: shot-list.md
  images:
    - image_id: 01-cover
      file: images/branded/01-cover.png
      source_file: images/unbranded/01-cover.png
      prompt_path: prompts/01-cover.md
      placement: 01-cover
      core_meaning: "A clear anchor prevents decorative filler."
      structure: Before-after comparison
      visual_metaphor: "A messy note stack becomes one labeled storyboard frame."
      content_qa_status: pass
      style_qa_status: pass
      brand_qa_status: pass
      set_qa_status: pass
      brand_overlay_status: applied
      size_check_status: pass
      source_note: native generation candidate 1
      residual_risk: none
```

Final response must include:

- `output_dir`.
- `image_count`.
- `style_id`.
- `brand_plugin_enabled`.
- Each image's `image_id`, `file`, `placement`, and usage.
- QA conclusion using `content_qa_status`, `style_qa_status`, `brand_qa_status`, `set_qa_status`, and `residual_risk`.

## Failure Paths

- Missing source content: return to Section 1 and ask for the article/note/post.
- Unknown or unreadable `style_id`, `style_file`, or required `style_spec`: stop before Section 4 and list available candidates.
- `rsvg-convert` missing and user declines install: continue unbranded and record `brand_plugin_enabled: false`; if user required branding, stop as `BLOCKER: brand overlay unavailable`.
- Native image generation unavailable: stop as `BLOCKER: native image generation unavailable`.
- QA failure after retry limit: return to Section 4 for anchor revision or record `residual_risk` only with user approval.
- User changes platform or suite style mid-run: return to Section 3, mark previous shot list superseded, and do not mix styles inside one bundle.

## Non-Negotiables

- CRITICAL: MUST analyze content before style selection.
- MUST use one suite-level visual style for the whole `PostIllustrationBundle`.
- NEVER skip the shot list, unless the run is a Section 7.1 continuation that works only on already-shot-listed images.
- MUST make every image express one core meaning.
- MUST use content expression structure to organize information.
- MUST use visual metaphor to turn abstraction into a concrete scene.
- MUST treat the suite-level `style_spec` as authority for platform appearance, dimensions, colors, layout, safe areas, and fixed component slots.
- MUST enable Brand Plugin only when the user has not disabled it and the selected `style_spec` defines an enabled brand slot.
- MUST NOT let Brand Plugin behave as a global visual system.
- MUST NOT let the image model draw brand logos, page-number badges, placeholder frames, reserve boxes, or visible brand-slot markers.
- MUST generate and QA one image at a time.
- MUST save `shot-list.md`, `prompts/*.md`, and `manifest.md` for every run.
- MUST save generated assets outside the skill folder.
