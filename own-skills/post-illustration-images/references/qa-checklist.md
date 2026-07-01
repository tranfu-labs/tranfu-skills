# QA Checklist

Run QA after each image, after optional overlays, and before delivery.

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

- Canvas size and page orientation follow the selected Style Spec unless explicitly overridden.
- Fixed palette follows the selected Style Spec closely enough for the platform template.
- The selected style has one Style Reference image, and the generated image matches its baseline visual system.
- Style Reference comparison ignores semantic content and checks only palette, texture, spacing, typography feel, icon/illustration style, composition language, and fixed-component treatment.
- Content stays inside the selected Style Spec's content safe area.
- Fixed component reserved areas stay clear.
- Page-number badges are absent unless the selected Style Spec explicitly enables them.
- Template-level components do not move randomly between images.
- Fixed component slots are not visibly marked by placeholder frames, reserve boxes, guide outlines, empty labels, or stickers.

## Brand Plugin QA

Run only when Brand Plugin is enabled.

- The image model did not draw a logo, `TF`, `Tranfu`, watermark, or brand sticker.
- The image model did not draw a placeholder frame, reserve box, guide outline, empty label, or visible marker for the brand slot.
- The real brand asset was overlaid after generation.
- The asset matches `references/brand.md`.
- Placement and size follow the selected Style Spec's `brandSlot`.
- The brand overlay does not block body text, labels, icons, or key visual elements.
- There is only one brand mark unless the selected Style Spec explicitly allows more.

If Brand Plugin is disabled, QA should record `Brand Plugin: disabled`, not fail the run.

## Set-Level QA

- One Style Spec is used across the whole set.
- Images vary by structure/metaphor, not by random style shifts.
- Sequence has a clear reading order through filenames and manifest records, not through model-drawn page badges.
- No two images repeat the same core meaning.
- Filename order matches the sequence.
- `manifest.md` records platform, selected Style Spec, Brand Plugin enabled/disabled, Content QA, Style Spec QA, Brand Plugin QA, and residual risks.

## Fallback Rules

| Failure | Fix |
|---|---|
| Text is wrong or unreadable | Reduce labels; regenerate with shorter text. |
| Too many ideas in one image | Split anchor or delete secondary idea. |
| Style drift | Compare with the Style Reference, ignore its semantic content, then reinsert selected Style Spec constraints and negative constraints. |
| Weak metaphor | Rewrite as physical action plus concrete object. |
| Looks like PPT | Reduce grid density, title bars, and rigid arrows; emphasize scene/object. |
| Model drew logo, `TF`, `Tranfu`, or watermark | Regenerate with stronger fixed-component negative constraints. |
| Model drew a brand-slot placeholder frame, reserve box, or guide outline | Regenerate with explicit "no placeholder frame/no reserve box/no visible brand-slot marker" constraints before overlay. |
| Brand overlay blocks content | Regenerate with the Style Spec brand slot kept clear, or revise that Style Spec's slot. |
| Page-number badge appears | Regenerate with page badge forbidden. |
| Layout is empty | Add one content card, conclusion bar, icon group, or action detail. |
| Layout is crowded | Remove secondary labels and reduce visual elements. |

Do not retry blindly. Each regeneration must name the failure being corrected.

If the user requires existing content to remain unchanged, avoid full-image regeneration for a local brand-slot artifact. Restore the original unbranded image, remove only the artifact using same-image paper/background texture, then rerun the deterministic brand overlay and QA the slot again.
