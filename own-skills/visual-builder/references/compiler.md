# Visual DNA Compiler

Use this reference after the design-signal gate passes and before writing prompts.

## Compiler Boundary

Translate observed design rules into a static illustration system. The output must generalize to a concept, a process, and a checklist without relying on source topic or layout.

Preserve these abstractions:

| DNA evidence | Compile into |
| --- | --- |
| Color roles and contrast | semantic palette roles and approximate relationships |
| Typography hierarchy | family character, weight contrast, scale rhythm, alignment |
| Composition | hierarchy grammar, focal balance, density, whitespace behavior |
| Shape components | reusable panels, dividers, labels, callouts, connectors |
| Material/texture | paper, grain, ink, shadow, border, surface treatment |
| Illustration/icon language | abstraction level, stroke character, fill behavior, geometry |
| Mood | concise tone constraints and negative mood constraints |

Drop motion, timing, navigation, forms, buttons, gestures, and other interactive behavior. These are not static post-illustration style rules.

## Debrand Transform

Apply all transformations, even when the user owns the source brand:

1. Replace exact colors with a smaller semantic palette that preserves relationships but not the full exact set. Avoid copying every hex value.
2. Replace exact coordinates with composition rules and platform baseline geometry.
3. Replace proprietary typography with generic characteristics unless the font is explicitly licensed and requested.
4. Remove logos, names, slogans, watermarks, mascots, product chrome, unique icons, proper nouns, source text, numbers, and topic-specific objects.
5. Replace identity-bearing motifs with generic primitives serving the same visual function.
6. Prohibit source-image input to the generator and prohibit prompts asking for imitation, sameness, or reconstruction.

Record a short `debranding` section in `style.md` listing what was generalized and the negative constraints passed to generation.

## style.md Shape

Write these sections in order:

1. `# <Display Name>`
2. `## Purpose`
3. `## Visual Character`
4. `## Palette Roles`
5. `## Typography`
6. `## Composition Grammar`
7. `## Components And Illustration`
8. `## Texture And Material`
9. `## Platform Geometry`
10. `## Debranding And Prohibitions`
11. `## Calibration Guidance`

Use declarative rules. Do not mention the source filename, brand, subject, or original layout.

## style.spec.json Shape

Use the target skill's current schema and the exact baseline in [candidate-contract.md](candidate-contract.md). Minimum top-level keys are:

```json
{
  "id": "<style_id>",
  "styleFile": "references/styles/<style-id>.md",
  "platform": "<mapped platform>",
  "canvas": {},
  "colors": {},
  "layout": {},
  "fixedComponents": {},
  "brandPolicy": {
    "defaultEnabled": true,
    "userOverrideAllowed": true
  },
  "inputHandling": {
    "preserveNativeOutput": true,
    "ratioTolerance": 0.002,
    "outputCanvasRole": "design-coordinate-system",
    "allowPostGenerationResize": false,
    "allowCrop": false,
    "allowPadding": false,
    "allowRotation": false,
    "allowWrongRatioStretch": false,
    "wrongRatioAction": "regenerate"
  },
  "generationConstraints": {},
  "styleReference": {}
}
```

Use the candidate ID directly in both installed style paths. Keep `fixedComponents.brandSlot.enabled: true` regardless of the brand default; runtime policy controls whether the slot is active.

Keep optional `candidate.style.makeDefault` out of `style.spec.json`; it is registry installation intent, not a visual rule. Omitted and `false` preserve the current platform default. Use `true` only when the user explicitly requests the candidate as that platform's default.

## Prompt Compiler

Each prompt is self-contained text and includes:

1. the platform ratio, design coordinate system, safe area, and any minimum short edge;
2. one neutral content brief;
3. the same compiled style rules;
4. a structure-specific composition request;
5. negatives: no logo, watermark, brand name, source copy, page number, copyrighted character, photorealistic reference reconstruction, or model-drawn production brand;
6. when `brandPolicy.defaultEnabled` is true, a request to keep the brand reserved area visually quiet without drawing a brand; when false, no brand-area reservation instruction.

Do not include the source path, source image, original semantic content, or a link to it. Vary composition by meaning; do not freeze one template arrangement across the three prompts.

## Neutral Calibration Briefs

- `concept`: “How small feedback loops improve a daily practice.” Show one central relationship and two supporting consequences.
- `process`: “Turn a vague idea into a testable question.” Show four directional steps with distinct verbs.
- `checklist`: “Before sharing a draft.” Show five parallel checks with short labels.

These briefs are defaults, not branded copy. Replace them only with equally neutral, non-source material.
