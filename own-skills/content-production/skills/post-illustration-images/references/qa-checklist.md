# QA Checklist

Run QA after each image, after overlay when `brand_enabled` is true, and before delivery. Skip overlay checks when branding is false; native geometry QA always runs.

## Backend And Artifact QA

- `BackendContext` records one verified runtime-native or configured API backend.
- Credential access and model availability preflight passed without exposing secret values.
- The resolved model is currently image-capable; a stored default alone is not accepted as proof. Any difference between model preference and resolved model is recorded with its reason.
- `GenerationGeometry` comes from the verified model profile, and its request size satisfies that profile before submission.
- The image artifact belongs to the current prompt/request, not a stale cache or earlier run.
- The source file is a readable raster image and its actual format, dimensions, and aspect ratio are recorded. Branding requires a PNG source; unbranded delivery keeps the native extension.
- Any source within the Style Spec ratio tolerance and at or above a configured minimum short edge passes as `pass-native`; requested, source, and delivery dimensions are recorded, and delivery dimensions equal source dimensions.
- Output outside ratio tolerance or below the minimum edge fails QA and is never resized, cropped, padded, rotated, stretched, or upscaled. It is retried with the canonical request size, then blocked after the three-candidate limit without a size question.
- When branding is enabled, the vendored `resvg-wasm@2.6.2` overlay preserves the source width and height. When branding is disabled, no renderer runs.
- A `hard-limit-export` runs only for a known publishing path through a verified same-dimension exporter; the exporter and final format/bytes are recorded, or delivery stops with its precise blocker.
- The request process exited and no child process started by the request remains active.
- Saved prompts, manifests, logs, and delivery notes contain no credentials or secret fragments.

## Content QA

- Platform and selected Style Spec match the request.
- Image expresses one core meaning.
- Shot list anchor is visible in the image.
- Content expression structure is clear within one second.
- Visual metaphor is concrete and relevant.
- Main actor or object participates in the key action.
- Short labels are readable and not overlong.
- No invented facts, exaggerated claims, or unrelated examples.
- Layout is neither empty nor crowded.
- Image does not drift into a forbidden style from the selected Style Spec.

## Style Spec QA

- Target ratio, orientation, and design-coordinate layout follow the selected Style Spec; delivery pixels remain native.
- Fixed palette follows the selected Style Spec closely enough for the platform template.
- The selected style has one Style Reference image, and the generated image matches its baseline visual system.
- Style Reference comparison ignores semantic content and checks only palette, texture, spacing, typography feel, icon/illustration style, composition language, and non-brand fixed-component treatment.
- Style Reference watermark presence, absence, and position are ignored; production branding is validated only against the selected Style Spec.
- Content stays inside the proportional mapping of the Style Spec's design-space content safe area onto the native raster.
- Active fixed component reserved areas stay clear. When Brand Plugin resolves disabled, do not enforce the brand slot or brand reserved area.
- Page-number badges are absent unless the selected Style Spec explicitly enables them.
- Template-level components do not move randomly between images.
- Active fixed component slots are not visibly marked by placeholder frames, reserve boxes, guide outlines, empty labels, or stickers.

## Brand Plugin QA

Run when `brand_enabled` resolves true. Skip when it resolves false, whether from a user override or the selected style default.

- The image model did not draw a logo, `TF`, `Tranfu`, watermark, or brand sticker.
- The image model did not draw a placeholder frame, reserve box, guide outline, empty label, or visible marker for the brand slot.
- The real brand asset was overlaid after generation.
- The final PNG visibly contains the approved mark inside `brandSlot`; dimensions alone do not prove that overlay succeeded.
- The asset matches `references/brand.md`.
- Placement and size follow the selected Style Spec's `brandSlot`.
- The selected Style Spec's `brandSlot` is enabled and anchored at `top-right`.
- The brand overlay does not block body text, labels, icons, or key visual elements.
- There is only one brand mark unless the selected Style Spec explicitly allows more.

When branding resolves false, record `brand_qa_status: disabled-by-user` for a user override or `disabled-by-style-default` for the selected style default. Any unbranded production image with `brand_enabled: true` fails Brand Plugin QA.

## Set-Level QA

- One Style Spec is used across the whole set.
- Images vary by structure/metaphor, not by random style shifts.
- Sequence has a clear reading order through filenames and manifest records, not through model-drawn page badges.
- No two images repeat the same core meaning.
- Filename order matches the sequence.
- `manifest.md` records platform, publishing path or `null`, selected Style Spec, verified backend/model, source/delivery artifact formats and bytes, requested/source/delivery dimensions, optional hard-limit exporter, geometry attempts, native-output status, post-generation actions, brand state, overlay renderer when used, QA statuses, and residual risks.

## Fallback Rules

| Failure | Fix |
|---|---|
| Text is wrong or unreadable | Reduce labels; regenerate with shorter text. |
| Too many ideas in one image | Split anchor or delete secondary idea. |
| Style drift | Compare with the Style Reference, ignore its semantic content, then reinsert selected Style Spec constraints and negative constraints. |
| Weak metaphor | Rewrite as physical action plus concrete object. |
| Looks like PPT | Reduce grid density, title bars, and rigid arrows; emphasize scene/object. |
| Model drew logo, `TF`, `Tranfu`, or watermark | Regenerate with stronger fixed-component negative constraints. |
| Model drew a brand-slot placeholder frame, reserve box, or guide outline | Regenerate with explicit "no placeholder frame/no reserve box/no visible brand-slot marker" constraints; overlay afterward only when branding is enabled. |
| Brand overlay blocks content | Regenerate with the Style Spec brand slot kept clear, or revise that Style Spec's slot. |
| Page-number badge appears | Regenerate with page badge forbidden. |
| Output ratio falls outside tolerance or misses the minimum edge | Retry the same canonical request size with stronger geometry wording; never ask the user to choose a size. |
| Layout is empty | Add one content card, conclusion bar, icon group, or action detail. |
| Layout is crowded | Remove secondary labels and reduce visual elements. |

Do not retry blindly. Each regeneration must name the failure being corrected.

If the user requires existing content to remain unchanged, avoid full-image regeneration for a local brand-slot artifact. Restore the original unbranded image and remove only the artifact using same-image texture; rerun the overlay and slot QA only when branding is enabled.
