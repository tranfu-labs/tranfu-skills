---
name: post-illustration-images
description: "Generate stable platform-ready AI illustrations for WeChat official account articles, Xiaohongshu notes, Zhihu posts, Toutiao posts, and Weibo posts with a registered style through either a runtime-native image tool or an already-configured API backend. Use when the user asks for post/article/note illustrations, content images, explainer images, cover/content cards, 公众号配图, 小红书组图, 知乎配图, 微博配图, 头条号配图, 今日头条配图, 帮我做配图, or 给文章画几张图. Do NOT trigger when the task is pure photography, portrait/product retouching, photoreal brand campaigns, exact long text inside images, or when the user explicitly names another image-generation skill. Safety boundaries: verify the generation backend before production, use one registered suite style, generate and QA one image at a time, preserve accepted native pixels, forbid model-drawn logos/page badges, and resolve deterministic branding from the user override or selected style policy."
version: "0.5.0"
author: BruceL017
updated_at: "2026-07-17"
origin: own
allow_exec: true
---

# Post Illustration Images

## Orchestrated Provider Route

Before the standalone workflow, inspect any structured request for `contract: content-production-provider/v1`,
`capability: illustration`, `provider_contract: illustration-v1`, or the marker below:

```text
content-production-provider: illustration-v1
```

If any marker is present, use [`references/orchestrated-provider.md`](references/orchestrated-provider.md)
and `scripts/provider-contract.mjs`. A partial, conflicting, or invalid provider request returns a
structured `BLOCKED` result and never falls back to standalone output. Provider mode runs either a
plan-only pass or an approved generate pass, returns control to the orchestrator, and does not create
`post-illustration-output/<content-slug>/`.

When no provider marker is present, keep the independent workflow below unchanged.

## Core Rule

Do not reduce this workflow to "analyze content -> choose template -> generate image". Stability depends on the middle layers:

```text
generation backend preflight
-> content analysis
-> content type and expression need
-> suite-level style_spec
-> gpt-image-2 generation geometry
-> anchor selection
-> shot list
-> per-image content structure
-> per-image visual metaphor
-> selected visual style constraints
-> active top-right brand slot reservation after resolving user override and style policy
-> single-image prompt without model-drawn brand or page badge
-> verified generation backend
-> Brand Plugin overlay when the resolved brand state is enabled
-> QA and fallback
-> saved assets and delivery notes
```

This is the mental model; the actual runnable steps are the numbered Workflow sections below.

Always read the content before choosing a visual style. Use one suite-level style for the whole image set. Vary each image only through its content structure and visual metaphor.

Ownership: edit files in the user's project output folder only. This skill creates or updates `post-illustration-output/<content-slug>/` and never writes generated assets into the skill folder. Do not overwrite an existing `manifest.md`, prompt, or image unless the user explicitly asks to replace it or the current run owns that file.

Named artifact: `PostIllustrationBundle` = `{ output_dir, BackendContext, GenerationGeometry, manifest.md, shot-list.md, prompts/*.md, images/unbranded/*.png, images/branded/*.<png-or-required-export-ext>, or images/*.<native-or-required-export-ext>, final_response_summary }`.

Terminology:

- `style_id`: the stable ID from `references/style-registry.json`, for example `wechat-doodle`.
- `style_file`: the selected human-readable Markdown style file under `references/styles/`.
- `style_spec`: the selected machine-readable `.spec.json`; required for every supported production style because it owns the default brand geometry.
- `style_reference`: the QA-only reference image listed in `references/style-registry.json`.
- `selected_style_bundle`: `{ style_id, platform, style_file, style_spec, style_reference?, brand_policy, brand_slot_enabled }`.
- `brand_override`: `enabled`, `disabled`, or `null`; `null` delegates to the selected Style Spec.
- `brand_policy_source`: `user-override`, `style-default`, or `legacy-default`.
- `generation_backend`: a verified runtime-native image tool or already-configured API backend; it is not another image-generation skill.
- `BackendContext`: `{ kind, adapter, endpoint_source, api_dialect?, model_preference?, model_preference_source, resolved_model, model_resolution_note, artifact_format, credential_access, model_check, process_cleanup_plan, process_cleanup_status }`.
- `GenerationGeometry`: `{ geometry_profile, resolved_model, requested_dimensions, target_aspect_ratio, design_dimensions, delivery_dimensions, ratio_tolerance, minimum_short_edge?, native_output_policy, post_generation_resize }`.

## Architecture Boundary

`style_spec` is the authority for each platform visual template. It controls the design-coordinate canvas, target aspect ratio, fixed colors, layout, safe areas, negative constraints, and fixed component slots such as a brand slot; it does not force accepted model output to those pixel dimensions.

`style_reference` images are long-lived QA baselines for failure review. They show the expected visual presentation of a style, but they are not generation inputs and their semantic content must never be copied into new images. Whether a reference image contains a watermark, and where that watermark appears, never controls production branding.

Brand Plugin resolves enablement in this order: explicit user override -> `style_spec.brandPolicy.defaultEnabled` -> legacy default `true`. `brandPolicy.userOverrideAllowed` MUST be `true` for styles installed by Visual Builder. Brand Plugin MUST NOT decide canvas size, color palette, coordinates, or platform layout. Every production `style_spec` MUST define an enabled top-right `brandSlot` even when its default brand state is disabled, so a later user override can enable deterministic branding without rebuilding the style.

When the resolved brand state is disabled, the selected Style Spec still defines the production brand slot for template completeness, but that slot and its reserved area are inactive for the current run. Do not reserve, mark, or QA that brand area.

The image model MUST NOT draw logos, `TF`, `Tranfu`, watermarks, page-number badges, placeholder frames, reserve boxes, or other fixed brand components. Those are either omitted or added after generation by a deterministic overlay step. If the user requests model-drawn branding, decline that part and offer the deterministic overlay path.

Generation backend selection is separate from visual style selection. Treat an explicit user statement that the current environment has a configured API image backend as authoritative intake context. Do not redirect that user to public API-key setup, do not infer an official endpoint from an `openai`-like provider label, and do not treat a missing shell environment variable as proof that no backend exists. Resolve and verify the active backend using `references/generation-backends.md`.

## Supported Scope

Strong support:

- WeChat body illustrations, Xiaohongshu cover/content carousels, and Zhihu post illustrations.
- Weibo vertical 3:4 post illustrations using the registered weibo-signal-core style.
- Toutiao post illustrations using the registered native 16:9 style.
- Method, workflow, concept, comparison, checklist, boundary, and decision-flow explainers.

Conditional support:

- Image sets requiring real product screenshots or factual data: require user-provided material. State assumptions only for non-factual illustrative placeholders.
- Explicit style names: use the matching registered `style_id`, alias, or `style_file` only if it exists in `references/style-registry.json`; unknown styles require user confirmation before fallback.
- Explicit image count: treat it as a target or ceiling after anchor selection. Anchor quality wins; never create filler images to satisfy a quota.

Out of scope:

- Pure photography, portrait retouching, product mockups, or photorealistic brand campaigns.
- Tasks where exact long text inside images is mandatory. Image models may distort text; use short labels and retry with less text if needed.
- Any request to route through other image-generation skills unless the user explicitly asks for them.

## Required References

Use references by need, not all at once:

- Start with `references/style-registry.json` to identify platform and candidate style files. Use `references/style-index.md` only as the generated human-readable view.
- Read the selected file under `references/styles/` completely before compiling prompts.
- Read `references/brand.md` before resolving the Brand Plugin state.
- Read `references/content-structures.md` when selecting per-image expression structures.
- Read `references/prompt-compiler.md` before writing final generation prompts.
- Read `references/generation-backends.md` during backend preflight and whenever generation fails before producing a valid image artifact.
- Read `references/gpt-image-2-geometry.spec.json` after selecting a Style Spec and before compiling prompts.
- Read `references/qa-checklist.md` before delivery or regeneration.
- Inspect the selected `style_reference` before Section 8 delivery QA. Inspect it earlier when QA finds style drift or a regeneration is needed.
- Read `references/product-design.md` only when maintaining or extending this skill.

Resolve `references/`, `assets/`, `scripts/`, and `vendor/` from the skill root. User source content and generated outputs are project-relative or absolute user paths. Run deterministic commands from the skill root so the finalizer can load its vendored renderer, even when output paths are elsewhere.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW and update it while running: Intake, Preflight Generation Backend, Content Analysis, Select Suite-Level Style Spec, Resolve Generation Geometry, Select Anchors, Build Shot List, Compile Prompts, Generate One Image At A Time, Continue Existing Assets when used, Finalize Image And Apply Brand when enabled, QA And Fallback, Save And Deliver.

### 1. Intake

1. Collect `IntakeContext` fields:
   - `platform`: one of `wechat`, `xhs`, `zhihu`, `weibo`, `toutiao`, or `unknown`.
   - `source_content`: pasted text, file path, URL content already fetched into the conversation, or user-provided notes.
   - `requested_output`: body illustration, cover, carousel, continuation, overlay-only, or unknown.
   - `publishing_path`: known web editor/API/uploader path or `null`; `null` preserves native output without speculative format/byte adaptation.
   - `style_id`: explicit style ID or `null`.
   - `count`: positive integer or `null`.
   - `output_dir`: user-provided path or default `post-illustration-output/<content-slug>/`.
   - `brand_override`: `enabled`, `disabled`, or `null`; use `null` when the user gave no explicit brand instruction.
   - `generation_backend_hint`: `runtime-native`, `configured-api`, or `unknown`; a user statement that an API backend is already configured sets `configured-api`.

2. If `source_content` is missing, ask for the article/note/post content and stop this run until it is provided.

3. If `platform` is `unknown`, ask one concise platform question. If the user mentions multiple platforms, split the work into one `PostIllustrationBundle` per platform unless they ask for only one shared draft.

4. If `style_id` and `platform` conflict, or `count` conflicts with a platform format, ask one concise question before selecting style.

5. Produce `IntakeContext` and enter Section 1.5.

Exit when:

- `platform` is in `{wechat, xhs, zhihu, weibo, toutiao}`.
- `source_content` is non-empty or references an existing readable file path.
- `output_dir`, `requested_output`, `publishing_path`, `style_id`, and `count` are explicitly set to a value or `null`, `brand_override` is one of `{enabled, disabled, null}`, and `generation_backend_hint` is set.

### 1.5 Preflight Generation Backend

1. Read `references/generation-backends.md` completely.
2. Resolve one backend using this order: explicit user backend instruction -> callable runtime-native image tool -> already-configured API image backend -> `unknown`.
3. When the user says an API backend is already configured:
   - Treat that statement as authoritative; do not start public API-key provisioning or ask the user to paste a key.
   - Use the active configured endpoint and credential path through an adapter that can consume them. A provider label may name an API dialect, not the service operator.
   - Do not treat a missing shell environment variable as proof that credentials or backend capability are absent.
4. Verify without exposing secrets: adapter availability, credential accessibility, endpoint source, API dialect when relevant, `gpt-image-2` availability, and artifact format. Branding requires the backend to materialize a PNG source for the built-in overlay; do not silently re-encode another source format. A stored default model is not availability proof, and another model must not inherit this geometry profile.
5. Do not assume a child process inherits the parent runtime's tools, credentials, or endpoint. Do not use a nested fallback until a non-billable capability preflight proves it exposes a usable image-artifact output contract in this environment; the first-image canary proves actual output.
6. Do not mine backup configs or unrelated credential stores as the normal routing path. If active configuration cannot be consumed, stop with the precise integration blocker from `references/generation-backends.md`.
7. Set `BackendContext`. Backend preflight does not generate a production image; Section 7 performs the first-image canary after prompts exist.

Exit when `BackendContext.kind`, `adapter`, `endpoint_source`, `resolved_model`, `artifact_format`, `credential_access`, `model_check`, and `process_cleanup_plan` are verified. Set `process_cleanup_status: not-run` until the first request exits, then update it after every request. Record any configured/user model preference separately from the resolved live model. Otherwise stop with a specific backend blocker; never collapse these failures into “native image generation unavailable.”

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

1. Read and parse `references/style-registry.json`. If it is missing, invalid, or refers to missing files, stop as `BLOCKER: style registry invalid`.
2. If the user provided `style_id` or alias and it is not registered, show available candidates for the platform and ask the user to choose or approve automatic selection.
3. If no style is specified, select the best registered `style_id` for `platform` and `AnalysisSummary.expression_need`. If none exists, stop as `BLOCKER: no registered platform style`; never borrow another platform's style.
4. Read the selected `style_file` completely.
5. Read the selected `style_spec` before building the shot list. If `style_file` or `style_spec` is missing or unreadable, stop before Section 4 and report the missing path.
6. Read `style_spec.brandPolicy`. Missing policy means `{ defaultEnabled: true, userOverrideAllowed: true }` for backward compatibility.
7. Validate that the selected `style_spec` defines an enabled top-right `brandSlot`. If it does not, stop as `BLOCKER: required production brand slot unavailable`.
8. Run `node scripts/resolve-brand-policy.mjs --style-spec <selected_style_bundle.style_spec> --override <brand_override-or-null>` and set `{ brand_enabled, brand_policy_default_enabled, brand_override, brand_policy_source }` from its output.
9. Set `selected_style_bundle = { style_id, platform, style_file, style_spec, style_reference?, brand_policy, brand_slot_enabled }`.
10. Happy path order is: select and read `style_file`/`style_spec` -> validate the brand slot -> resolve `brand_enabled` -> verify the raster renderer only when branding is enabled.
11. When branding is enabled, require Node.js 22+ and readable `vendor/resvg-wasm/index.js` plus `vendor/resvg-wasm/index_bg.wasm`. The overlay loads and checksum-verifies vendored `@resvg/resvg-wasm@2.6.2` in-process; do not run `npm install`, install a native SVG renderer, or request an API key. Use `node scripts/apply-brand-overlay.mjs --self-test` only for release/package diagnostics. If unavailable, stop as `BLOCKER: required brand overlay unavailable`. When branding is disabled, do not require or invoke this renderer.

Rules:
- Otherwise choose the best platform style based on content type and expression need.
- Do not decide image count, aspect ratio, palette, safe area, or fixed component slots before selecting the style. Geometry and fixed slots always come from the selected `style_spec`; choose a different registered style when the user needs different geometry.
- For Zhihu, use the fixed Zhihu style unless future style files add alternatives.

Exit when `selected_style_bundle` and `brand_enabled` are set, and the selected `style_file` plus any required `style_spec` have been read.

### 3.5 Resolve Generation Geometry

1. Run `node scripts/resolve-generation-geometry.mjs --style-spec <selected_style_bundle.style_spec> --model <BackendContext.resolved_model>` from the skill root.
2. Set `GenerationGeometry` from the script output. `requested_dimensions` is the API request, `design_dimensions` is the Style Spec coordinate system, and `delivery_dimensions: source` preserves the accepted backend raster.
3. For every built-in style, resolve the mapped size automatically. Do not ask the user to choose or confirm dimensions.
4. If the resolved model or ratio has no verified profile, stop as `BLOCKER: backend geometry profile unavailable`; never reuse a different model's size rules.

Exit when `GenerationGeometry.geometry_profile`, `requested_dimensions`, `target_aspect_ratio`, `design_dimensions`, `delivery_dimensions`, `ratio_tolerance`, `native_output_policy`, and `post_generation_resize` are set.

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

The shot list is mandatory. If `style_spec` has not been read, return to Section 3 before writing the shot list. `shot-list.md` MUST use this markdown bullet order for each image:

- Placement or sequence
- Topic
- One core meaning
- Content expression structure
- Visual metaphor
- Main actor/object action
- Suggested elements
- Short labels
- Active fixed component reservations from the selected `style_spec`, including the top-right brand slot only when `brand_enabled` is true
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
- Fixed component reservations from the selected `style_spec`: active top-right brand slot from selected `style_spec`, no important content there
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
- Selected generation backend constraints
- `GenerationGeometry.target_aspect_ratio`; keep API-only `requested_dimensions` out of the visual prompt
- Negative constraints from the style and QA references

MUST compile and generate one prompt per image. NEVER ask the image model to create an entire multi-image set in one call.
Save each final single-image prompt under `prompts/`, for example `prompts/01-cover.md`, before calling the verified generation backend.

If a style file contains batch language such as "generate the whole set", MUST treat it as planning guidance only. MUST compile and generate one image at a time.

The prompt MUST explicitly forbid model-drawn logos, `TF`, `Tranfu`, watermarks, page-number badges, placeholder frames, reserve boxes, and visible brand-slot markers. When Brand Plugin is enabled, ask the model to keep the selected `style_spec` brand slot free of important content so the real brand asset can be overlaid after generation. MUST NOT ask the model to visibly "reserve" or "mark" the slot.

Use the complete single-image template and good/bad examples in `references/prompt-compiler.md`; do not duplicate them here.

### 7. Generate One Image At A Time

MUST use the verified `BackendContext` from Section 1.5 and `GenerationGeometry` from Section 3.5. Pass `GenerationGeometry.requested_dimensions` as the API size parameter. NEVER invoke another image-generation skill unless the user explicitly names it.

Do not begin production when credential or model checks are unresolved. Do not silently chain runtime-native, API, child-process, or public-endpoint fallbacks. Resolve a backend failure using `references/generation-backends.md`, then either retry the same verified backend or stop with its precise blocker.

Dispatch generation mode:

- New suite: generate the first image as a canary, inspect it, then continue one image per prompt. Run Section 7.5 for accepted sources only when branding is enabled.
- Continue existing assets: use Section 7.1.
- Overlay-only request: use Section 7.5 without regenerating source images.
- Otherwise: ask one concise question or stop as `BLOCKER: unknown generation mode`.

After each generation:

- Confirm the request process has exited and the output belongs to the current prompt, not a stale cache or previous run. Clean up any process started by this run before retrying or switching operations, then set `process_cleanup_status: pass`; set `fail` and stop if cleanup cannot be verified.
- Validate that the output is a readable raster image and record source/delivery formats, requested/source/delivery dimensions, and each `geometry_attempt`. Branding requires a PNG source; when disabled, preserve the native extension. `generation_attempt` counts submitted candidates only.
- Compare the actual raster with `GenerationGeometry`: ratio must be within tolerance and, when `minimum_short_edge` is non-null, the short edge must meet it. Then pass as `pass-native`; delivery dimensions equal source dimensions. Never resize, crop, pad, rotate, stretch, or upscale accepted output.
- Reject a ratio or minimum-edge mismatch and retry the same verified backend with the same canonical request size and stronger geometry wording. Allow at most three submitted candidates per image; then stop as `BLOCKER: backend output geometry mismatch` without asking the user to choose a size.
- For the first-image canary, also inspect content meaning, style, short labels, and fixed-component clear areas before generating image 2.
- Save the image into the current project, not into the skill folder.
- Recommended output path: `post-illustration-output/<content-slug>/`.
- Save the finalized shot list as `shot-list.md`.
- Save final prompts as `prompts/*.md`.
- Save generated source images under `images/unbranded/` when Brand Plugin is enabled.
- Save post-overlay deliverables under `images/branded/` when Brand Plugin is enabled.
- If Brand Plugin is disabled, save each accepted model raster with its native extension directly under `images/`; do not create a second rasterized copy.
- Use ordered filenames with the actual extension, for example `01-cover.<source-ext>` and `02-process-breakpoint.<source-ext>`.

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

- First identify the exact target image set from the current output folder, `manifest.md`, user-provided screenshots/paths, and the verified backend's recent generation cache when needed.
- Do not regenerate or reprocess the whole set when the request concerns only one or a few existing images.
- Resolve branding again for newly generated, regenerated, restored, or continued images. An explicit current user override wins; otherwise use the selected style default. An older manifest does not override the current request.
- If the target image is ambiguous or the discovered count conflicts with the user's count, create a quick contact sheet or ask for confirmation before copying candidates into the final output. If ambiguity remains unresolved, stop as `BLOCKER: unresolved target`.
- For overlays, start from the unbranded/source image when available so the same brand mark is not applied twice.
- If overlay is requested and no unbranded/source image exists, ask whether to use the current branded image with duplicate-mark risk or regenerate the source. If the user does not choose, stop as `BLOCKER: missing source image`.
- Keep only the minimal manifest update needed for changed Section 9 keys: `file`, `source_note`, attempts, requested/source/delivery dimensions, source/delivery artifact format and bytes, optional hard-limit exporter, native-output fields, `post_generation_actions`, brand/QA statuses, and `residual_risk`. Update backend metadata only when it changed; when overlay runs, set `brand_overlay_renderer: resvg-wasm@2.6.2`.

Exit when `ContinuePlan.targets`, `operation`, `source_images`, `output_paths`, and `manifest_rows_to_update` are non-empty where required. Then run only the required overlay, copy, or single-image generation step.

### 7.5 Finalize Image And Apply Brand When Enabled

Run this deterministic overlay only when `brand_enabled` is true and the accepted source is PNG. The script maps the Style Spec's design-space brand slot onto that source and renders through bundled `resvg-wasm@2.6.2` without changing width or height. When branding is disabled, the accepted source is already the deliverable.

```bash
PROJECT_OUTPUT_DIR="$(cd <project-output-dir> && pwd)"
cd <skill-root>
node scripts/apply-brand-overlay.mjs \
  --style-spec <selected_style_bundle.style_spec> \
  --brand-svg assets/brand/tranfu-logo-reference.svg \
  --input <absolute-source-path> \
  --output <absolute-final-path>
```

Never pass a wrong-ratio source to the overlay. Keep the unbranded source, append `brand-overlay-native` to `post_generation_actions`, and assert output dimensions equal source dimensions before QA. The overlay requires Node.js 22+ but no runtime package installation, native SVG command, network access, or API key.

### 8. QA And Fallback

1. Read `references/qa-checklist.md` before judging output.
2. Check every image against the QA checklist and selected `style_reference`. Ignore brand-watermark presence and position in the reference; validate production branding only against the selected `style_spec`.
3. If all images pass content QA, style QA, brand QA, and set QA, enter Section 9.
4. If an image fails, identify the reason before retrying. Never exceed three submitted candidates total across geometry and visual failures.
5. If the same image still fails after retries, return to Section 4 for anchor/shot-list adjustment or deliver only with explicit `residual_risk` if the user approves.

If an image fails, identify the reason before retrying:

- Text error: reduce text, keep only short labels, regenerate.
- Too many ideas: split or remove anchors.
- Style drift: inspect the `style_reference`, ignore its semantic content, then strengthen selected style source and negative constraints.
- Weak metaphor: rewrite physical action and object.
- Brand or placeholder frame was drawn by the model: regenerate with stronger "no logo/no TF/no Tranfu/no placeholder frame/no reserve box" constraints, then apply the Brand Plugin overlay only when `brand_enabled` is true.
- Brand overlay blocks content: use the selected `style_spec` brand slot; if content occupies that slot, regenerate with a clearer unmarked area.
- Existing content must not change but a brand-slot artifact exists: avoid full-image regeneration; restore the original unbranded image and remove only the local artifact with same-image texture, then reapply the overlay only when `brand_enabled` is true.
- Layout too empty or crowded: adjust structure, not the whole style.

### 9. Save And Deliver

Create or update `manifest.md` in the output folder using this stable YAML schema. Continuation work in Section 7.1 MUST patch this same schema instead of inventing a separate mini manifest.

When `brand_enabled` is true, each final `file` MUST point to `images/branded/`, each `source_file` MUST point to its same-dimension unbranded source, and `brand_overlay_status` MUST be `applied`. When false, set bundle-level `brand_overlay_renderer: null`, use the accepted source as `file` under `images/`, and omit `source_file`. Set `post_generation_actions` to an empty list unless same-dimension `hard-limit-export` occurred; set brand statuses to `disabled-by-user` or `disabled-by-style-default`.

```yaml
post_illustration_bundle:
  output_dir: post-illustration-output/example-slug
  platform: xhs
  publishing_path: null
  style_id: xhs-cream-paper
  style_file: references/styles/xhs-style-cream-paper.md
  style_spec: references/styles/xhs-style-cream-paper.spec.json
  style_reference: assets/style-references/xhs-cream-paper.png
  brand_plugin_enabled: true
  brand_policy_default_enabled: true
  brand_override: null
  brand_policy_source: style-default
  brand_overlay_renderer: resvg-wasm@2.6.2
  generation_backend:
    kind: configured-api
    adapter: runtime-configured-adapter
    endpoint_source: active-runtime-config
    api_dialect: openai-compatible
    model_preference: stored-or-user-model-id
    model_preference_source: active-config
    resolved_model: gpt-image-2
    model_resolution_note: unchanged
    artifact_format: png
    credential_access: pass
    model_check: pass
    process_cleanup_plan: pass
    process_cleanup_status: pass
  generation_geometry:
    geometry_profile: gpt-image-2-v1
    requested_dimensions: 1152x1536
    target_aspect_ratio: "3:4"
    design_dimensions: 1080x1440
    delivery_dimensions: source
    ratio_tolerance: 0.002
    native_output_policy: preserve
    post_generation_resize: forbidden
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
      size_check_status: pass-native
      generation_attempt: 1
      requested_dimensions: "1152x1536"
      source_dimensions: "<actual-width>x<actual-height>"
      source_aspect_ratio: 0.75
      source_artifact: { format: png, bytes: "<actual-source-bytes>" }
      delivery_dimensions: "<same-as-source>"
      delivery_artifact: { format: png, bytes: "<actual-delivery-bytes>", hard_limit_exporter: null }
      native_output_preserved: true
      post_generation_actions: [brand-overlay-native]
      geometry_attempts:
        - { attempt: 1, requested_dimensions: "1152x1536", source_dimensions: "<actual>", status: pass-native }
      source_note: generation candidate 1
      residual_risk: none
```

Final response must include:

- `output_dir`, `image_count`, and `style_id`.
- `brand_plugin_enabled`, policy default, user override, `brand_policy_source`, and `brand_overlay_renderer`.
- Generation backend kind, adapter, model preference/source, resolved model, resolution note, and preflight conclusion without secrets or credential values.
- Each image's `image_id`, `file`, usage, source/delivery artifact formats and bytes, requested/source/delivery dimensions, native-output status, post-generation actions, and hard-limit exporter when used.
- QA conclusion using `content_qa_status`, `style_qa_status`, `brand_qa_status`, `set_qa_status`, and `residual_risk`.

## Failure Paths

- Missing source content: return to Section 1 and ask for the article/note/post.
- Unknown or unreadable `style_id`, `style_file`, or required `style_spec`, or no registered style for the platform: stop before Section 4 and list candidates or state that none is registered.
- Missing, invalid, duplicate, or internally inconsistent style registry: stop as `BLOCKER: style registry invalid`.
- Node.js 22+, vendored resvg WASM, or a PNG source is unavailable: stop as `BLOCKER: required brand overlay unavailable` or `BLOCKER: brand overlay input format unavailable` only when branding is enabled.
- Selected production Style Spec lacks an enabled top-right `brandSlot`: stop as `BLOCKER: required production brand slot unavailable`.
- Generation backend preflight failure: stop with the exact blocker code from `references/generation-backends.md`; do not report a generic native-tool failure when a configured API backend was asserted.
- `gpt-image-2` has no active channel: refresh model availability once, then stop as `BLOCKER: backend model channel unavailable`; do not apply its geometry profile to another model.
- Resolved model or Style Spec ratio has no verified geometry mapping: stop as `BLOCKER: backend geometry profile unavailable`.
- Three submitted candidates for one image all miss the required ratio or minimum edge: stop as `BLOCKER: backend output geometry mismatch` without asking the user to choose a size.
- Backend process exits without a current valid image artifact or leaves a child process running: clean up only processes started by this run, then stop as `BLOCKER: backend output unavailable` or `BLOCKER: backend process cleanup failed`.
- QA failure after retry limit: return to Section 4 for anchor revision or record `residual_risk` only with user approval.
- User changes platform or suite style mid-run: return to Section 3, mark previous shot list superseded, and do not mix styles inside one bundle.

## Non-Negotiables

- CRITICAL: MUST analyze content before style selection.
- MUST use one suite-level visual style for the whole `PostIllustrationBundle`.
- NEVER skip the shot list, unless the run is a Section 7.1 continuation that works only on already-shot-listed images.
- MUST make every image express one core meaning.
- MUST use content expression structure to organize information.
- MUST use visual metaphor to turn abstraction into a concrete scene.
- MUST verify one `BackendContext` before content production and use that same backend until an explicit user change or a newly verified replacement.
- MUST treat a user's statement that an API backend is already configured as authoritative; MUST NOT redirect that user to public API-key setup or infer an official endpoint from a provider/dialect label.
- MUST NOT treat missing shell variables as proof that configured credentials are absent or assume child processes inherit tools, endpoints, credentials, or image-generation capability.
- MUST resolve built-in style request dimensions from the verified `gpt-image-2` geometry profile without asking the user to confirm sizes.
- MUST treat the suite-level `style_spec` as authority for platform appearance, target ratio, design-coordinate geometry, colors, layout, safe areas, and fixed component slots.
- MUST resolve Brand Plugin enablement from explicit user override, then Style Spec default, then legacy default `true`; Visual Builder styles allow explicit overrides.
- MUST require every production `style_spec` to define an enabled top-right `brandSlot`.
- MUST ignore Style Reference watermark state for production branding and apply the real brand SVG overlay before delivery when branding is enabled.
- MUST NOT let Brand Plugin define the visual system or let the image model draw brand logos, page-number badges, placeholder frames, reserve boxes, or visible brand-slot markers.
- MUST generate and QA one image at a time.
- MUST record requested, actual source, and delivery geometry; permit same-dimension format/byte adaptation only for a known publishing path through a verified exporter, otherwise block; reject sources outside ratio tolerance without resizing, cropping, padding, rotating, stretching, or upscaling.
- MUST save `shot-list.md`, `prompts/*.md`, and `manifest.md` for every completed production run. On an earlier blocker, save only artifacts whose workflow stage was actually reached; never fabricate later-stage files or QA passes.
- MUST save generated assets outside the skill folder.
