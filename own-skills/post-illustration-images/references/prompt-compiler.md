# Prompt Compiler

Compile one prompt per image. The selected Style Spec remains the suite-level visual system. The per-image prompt only changes the anchor, structure, metaphor, action, labels, and content elements.

Do not ask the image model to create fixed brand components. Logos, `TF`, `Tranfu`, watermarks, and page-number badges are not part of model generation.

Resolve Brand Plugin from the explicit user override, then the selected Style Spec's `brandPolicy.defaultEnabled`, then legacy default `true`. The selected Style Spec's top-right `brandSlot`, not the Style Reference, controls the reservation and deterministic overlay when the resolved state is enabled.

Some style files may be written as "generate a whole set" prompts. Use those passages to infer default count, sequence logic, and set consistency, but never pass a batch-generation instruction into a single image prompt.

Save each compiled single-image prompt under the output folder's `prompts/` directory before image generation, using the same sequence prefix as the target image filename.

## Prompt Assembly Order

1. Platform and purpose.
2. Selected Style Spec constraints, including target ratio, design-coordinate layout, palette, safe area, fixed components, and negative constraints.
3. Image sequence and one core meaning.
4. Content expression structure.
5. Visual metaphor and physical action.
6. Required page text or short labels.
7. Resolved Brand Plugin status, policy source, and the selected Style Spec's active top-right brand-slot reservation.
8. Negative constraints.
9. Single-image generation instruction.

## Single-Image Prompt Template

```text
Generate one <platform> post illustration for image <n> of a coherent image set.

Use the selected Style Spec exactly:
<paste or summarize the selected style file's target ratio, design-coordinate layout, fixed palette, safe areas, fixed component rules, typography, and negative constraints>

Source content anchor:
<anchor from the article/note/post>

Core meaning:
<one idea only>

Content expression structure:
<workflow / before-after / concept metaphor / checklist / etc.>

Visual metaphor:
<turn the abstract idea into a concrete physical scene or object>

Main action:
<what the main actor/object is doing>

Suggested elements:
<3-6 concrete elements; model may choose content-specific icon details within the selected Style Spec>

Short labels:
<short Chinese labels only; avoid long paragraphs>

Brand Plugin:
<enabled / disabled>
Policy source:
<user-override / style-default / legacy-default>
Always: do not draw any logo, TF mark, Tranfu text, watermark, brand sticker, page-number badge, placeholder frame, reserve box, outline, empty label, or visible brand-slot marker.
If enabled: keep the selected Style Spec's top-right brand slot naturally free of important content. The real brand SVG will be overlaid after generation.
If disabled: omit the reservation and overlay instructions, but keep the no-logo/no-watermark constraint.

Constraints:
- Generate only this one image, not a collage and not the whole set.
- Keep the selected Style Spec consistent with the rest of the set.
- This image must express only the core meaning above.
- Do not add claims, examples, or facts not present in the source content.
- Avoid long text blocks. Use short, readable labels.
- Keep important content inside the selected Style Spec's content safe area.
- Keep active fixed component reserved areas clear. When Brand Plugin resolves disabled, the brand slot and brand reserved area are inactive for that run.
- Keep active reserved areas visually natural; do not mark them with a box, border, sticker, badge, or guide line.
```

## Visual Metaphor Method

Convert abstraction into an image with this chain:

```text
abstract concept -> physical action -> concrete object -> actor/object doing the action
```

Examples:

- "内容没有承接" -> cannot connect -> broken pipe / dropped package -> character reaches out but the package falls into a gap.
- "信息很多但没有筛选" -> clogged/filtering -> funnel / sieve / drawers -> character filters a pile through a simple machine.
- "工具调用边界" -> guarded handoff -> gate / checkpoint / permission stamp -> agent pauses at a checkpoint before taking action.

## Generation Backend Policy

Use the verified `BackendContext` and `GenerationGeometry` selected by `SKILL.md`. A runtime-native tool and an already-configured API backend are both valid execution backends; neither changes the suite-level visual prompt.

Do not call other image-generation skills by default. Do not embed endpoint, credential, provider-setup, or fallback-routing instructions inside image prompts.

Describe the Style Spec's target ratio and design-coordinate layout in the visual prompt. Pass `GenerationGeometry.requested_dimensions` only as the backend size parameter; do not copy it into the prompt or treat the design canvas as required output pixels. Inspect the actual raster and preserve it when its ratio is within tolerance.

## Fixed Component Policy

Always keep these out of the image model:

- Brand logos.
- `TF` or `Tranfu` text.
- Watermarks.

Keep these out unless a selected Style Spec explicitly enables them:

- Page-number badges.
- Placeholder frames, reserve boxes, guide outlines, or visible markers for fixed component slots.
- Template-level overlays that must be pixel-stable.

If the model draws any of these by accident, regenerate with stronger negative constraints; apply overlays afterward only when the resolved Brand Plugin state is enabled.

Do not use Style Reference watermark presence, absence, or position to enable, disable, or place the production brand overlay.

## Text Handling

Image models may distort text. Prefer:

- Big short title.
- 2-5 short labels.
- Icon plus keyword.
- Footer conclusion under 12 Chinese characters when possible.

If text fails, regenerate with fewer words instead of switching styles.
