# Prompt Compiler

Compile one prompt per image. The selected Style Spec remains the suite-level visual system. The per-image prompt only changes the anchor, structure, metaphor, action, labels, and content elements.

Do not ask the image model to create fixed brand components. Logos, `TF`, `Tranfu`, watermarks, and page-number badges are not part of native image generation.

Some style files may be written as "generate a whole set" prompts. Use those passages to infer default count, sequence logic, and set consistency, but never pass a batch-generation instruction into a single image prompt.

Save each compiled single-image prompt under the output folder's `prompts/` directory before image generation, using the same sequence prefix as the target image filename.

## Prompt Assembly Order

1. Platform and purpose.
2. Selected Style Spec constraints, including canvas, ratio, palette, layout, safe area, fixed components, and negative constraints.
3. Image sequence and one core meaning.
4. Content expression structure.
5. Visual metaphor and physical action.
6. Required page text or short labels.
7. Brand Plugin status and the selected Style Spec's brand-slot reservation, if enabled.
8. Negative constraints.
9. Single-image generation instruction.

## Single-Image Prompt Template

```text
Generate one <platform> post illustration for image <n> of a coherent image set.

Use the selected Style Spec exactly:
<paste or summarize the selected style file's canvas, ratio, fixed palette, layout language, safe areas, fixed component rules, typography, and negative constraints>

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
<enabled/disabled>
If enabled: keep the selected Style Spec's brand slot free of important content. Do not draw any logo, TF mark, Tranfu text, watermark, brand sticker, page-number badge, placeholder frame, reserve box, outline, empty label, or visible brand-slot marker. The real brand SVG will be overlaid after generation.

Constraints:
- Generate only this one image, not a collage and not the whole set.
- Keep the selected Style Spec consistent with the rest of the set.
- This image must express only the core meaning above.
- Do not add claims, examples, or facts not present in the source content.
- Avoid long text blocks. Use short, readable labels.
- Keep important content inside the selected Style Spec's content safe area.
- Keep fixed component reserved areas clear.
- Keep reserved areas visually natural; do not mark them with a box, border, sticker, badge, or guide line.
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

## Native Generation Policy

Use native Codex image generation as the primary image path. Do not call other image skills by default.

If native generation requires dimensions instead of ratios, derive dimensions from the selected Style Spec. Do not override platform ratio before selecting the style.

## Fixed Component Policy

Keep these out of the image model unless a selected Style Spec explicitly says otherwise:

- Brand logos.
- `TF` or `Tranfu` text.
- Watermarks.
- Page-number badges.
- Placeholder frames, reserve boxes, guide outlines, or visible markers for fixed component slots.
- Template-level overlays that must be pixel-stable.

If the model draws any of these by accident, regenerate with stronger negative constraints before applying overlays.

## Text Handling

Native image models may distort text. Prefer:

- Big short title.
- 2-5 short labels.
- Icon plus keyword.
- Footer conclusion under 12 Chinese characters when possible.

If text fails, regenerate with fewer words instead of switching styles.
