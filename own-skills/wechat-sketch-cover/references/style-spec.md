# Fixed Warm Hand-Drawn WeChat Cover Specification

This file is the only visual specification for wechat-sketch-cover. It defines one style, one composition, and one output size. There are no variants or user-selectable settings.

## Canvas and geometry

- Final canvas: exactly 1923 x 818 pixels, PNG.
- Descriptive ratio: approximately 2.35:1; the pixel dimensions are authoritative.
- Safe outer margin: keep important title strokes and illustration details at least 64 pixels from every edge.
- Left title zone: x=80..760, y=120..650, approximately 40% of the canvas.
- Right illustration zone: x=820..1840, y=70..750, approximately 60% of the canvas.
- Keep a clear visual gap between the zones. Do not add a divider line.

## Fixed palette

Use this warm family for primary solid fills and strokes. QA uses visual comparison with view_image, not pixel-level hex matching. Paper grain, anti-aliasing, and local blending may vary; a clearly off-palette hue used as a primary visual element is an absolute failure.

| Role | Color |
|---|---|
| Paper background | #FCEECF |
| Paper highlight | #FEF6DB |
| Deep brown ink | #3D2418 |
| Warm brown shading | #936336 |
| Orange accent | #E96A00 |
| Golden fill | #D7A365 |

Hex values are rendering guidance. NEVER show color names, role labels, or hex values as visible text.

## Surface and rendering

- Warm cream paper with subtle grain, speckles, and faint uneven pigment.
- Deep-brown hand-drawn outlines with visible pressure variation and slight natural wobble.
- Loose pencil, pen, and marker fills with visible stroke direction.
- Minimal depth: light hatching and soft hand-drawn shadows only.
- Simple stick figures, cards, arrows, stars, checkmarks, notes, folders, screens, or content-specific objects.
- Friendly editorial sketchbook feeling: explanatory, warm, clear, and restrained.

## Fixed composition

- The exact article title is the visual anchor on the left.
- Break the title naturally into two or three large lines without changing any character.
- Use one fixed Chinese handwritten title treatment in deep brown: bold brush strokes, hand-written Chinese calligraphy title forms, and marker / brush handwritten Chinese lettering. For mixed titles, preserve every Latin letter and digit verbatim in the same hand-lettered treatment.
- Add one loose orange underline beneath the title and at most three small orange doodle accents.
- Place one coherent conceptual scene on the right. It must express one core meaning through physical objects and actions.
- Right-side panels may contain abstract lines, dots, or checkmarks, but no additional readable words.
- Preserve breathing room; avoid filling every gap with decoration.

## Reference image policy

assets/style-reference.png is a QA baseline only.

Compare only:

- palette and paper texture;
- hand-drawn line quality;
- title hierarchy;
- left-title/right-illustration balance;
- icon vocabulary, spacing, and visual warmth.

Ignore and never reproduce:

- the reference title;
- OfferPilot or interview-specific meaning;
- the dashboard/workbench arrangement as literal content;
- people, objects, or UI details unless independently required by the new article.

NEVER pass the reference image to image generation.

## Negative constraints

- No subtitle, tags, captions, labels, random English, letters, numbers, or additional readable text outside the exact supplied title. Latin letters and digits inside the exact supplied title are allowed and must be preserved verbatim.
- No logo, watermark, brand mark, QR code, barcode, signature, or page badge.
- No photorealism, photography, realistic portrait, 3D rendering, glossy product mockup, or cinematic lighting.
- No blue-purple neon, cyberpunk, cold corporate technology style, rigid business-PPT grid, or high-saturation gradient.
- No pure-white background, pure-black ink, dense wallpaper pattern, excessive decoration, or crowded infographic.
- No title truncation, paraphrase, translation, invented punctuation, or spelling changes.

## Execution handoff

This specification is consumed by the ordered workflow in SKILL.md. Before generation, CREATE A TODO LIST FOR THE TASKS BELOW:

1. Resolve and validate the exact title and optional content source.
2. Derive the summary, core meaning, metaphor, and objects.
3. Compile one prompt or build specification and generate one candidate with any available backend.
4. Normalize the candidate to 1923 x 818 and run every QA gate.
5. Retry, select BEST_EFFORT, or stop according to the SKILL.md status contract.
6. Verify and deliver the named artifact, then end.

If assets/style-reference.png is missing, unreadable, corrupt, or cannot be inspected, stop before visual comparison and report the exact path; do not fall back to another image or silently claim reference-based QA.

## Prompt assembly contract

- `[TITLE]` is required and comes from the resolved exact title; preserve every character.
- `[SUMMARY]` is optional input context. If absent, derive a factual summary from the title without adding claims.
- `[CORE_MEANING]`, `[METAPHOR]`, and `[OBJECTS]` are always derived by the workflow from the title and available content; callers do not supply them as configuration choices.
- Article text or summary is optional; one Markdown article supplies its title and body under the input rules in SKILL.md.

## Prompt template

Use case: infographic-diagram
Asset type: WeChat Official Account article cover

Primary request:
Generate exactly one ultra-wide warm hand-drawn notebook-style article cover.

Exact visible text:
[TITLE]

The supplied title is the only readable text allowed in the image. Reproduce every character exactly. Do not translate, shorten, paraphrase, add a subtitle, or add any other readable words, letters, numbers, labels, signatures, or branding.

Content context:
[SUMMARY]

Core meaning:
[CORE_MEANING]

Right-side visual metaphor:
[METAPHOR]

Content-grounded objects:
[OBJECTS]

Canvas and composition:
- Compose for an approximately 2.35:1 ultra-wide canvas that will be normalized to exactly 1923 x 818.
- Keep all important content at least 64 pixels from the canvas edges.
- Reserve the left 40% for the title: two or three large lines in deep-brown, bold marker / brush handwritten Chinese lettering with a hand-written Chinese calligraphy feel, plus one loose orange underline.
- Use the right 60% for one coherent hand-drawn conceptual scene.
- Keep a clear gap between title and illustration.

Style:
- Warm cream paper background with subtle grain and speckles.
- Deep-brown, slightly imperfect hand-drawn outlines.
- Warm brown shading, orange accents, and muted golden fills.
- Loose pen, pencil, and marker texture; light hatching; minimal depth.
- Friendly editorial sketchbook mood: explanatory, warm, clear, restrained.

Fixed palette guidance (do not render these names or hex values as visible text):
- Paper background: #FCEECF
- Paper highlight: #FEF6DB
- Deep brown ink: #3D2418
- Warm brown shading: #936336
- Orange accent: #E96A00
- Golden fill: #D7A365

Constraints:
- The title must remain the dominant left-side element.
- Include exactly one loose orange underline beneath the title and no more than three small orange doodle accents.
- The right side must communicate one idea, not a multi-topic infographic.
- Interface-like panels may use abstract scribble lines, dots, arrows, and checkmarks only.
- No additional readable text.
- No logo, watermark, brand mark, QR code, barcode, signature, or page badge.
- No photography, realistic people, 3D, glossy rendering, neon, cyberpunk, cold corporate technology styling, or business-PPT layout.
- No pure-white background, pure-black ink, high-saturation gradients, dense decoration, or edge-crowded content.

Generate one image only.

## QA pass

A candidate returns `PASS` only when every gate below is observed in the normalized image. After three attempts, `BEST_EFFORT` may bypass only the character-for-character part of gate 1 when the title remains readable, localized, and correctly positioned; gates 2 through 10 still MUST pass:

1. The title matches the supplied title character-for-character and is readable.
2. No other readable text appears; interface-like marks remain abstract scribbles, dots, arrows, or checkmarks.
3. The title is the dominant element in the left zone, split into two or three large lines, and uses the fixed bold marker / brush handwritten Chinese treatment with a hand-written Chinese calligraphy feel; the coherent content metaphor occupies the right zone.
4. Important title strokes and illustration details stay at least 64 pixels from every edge.
5. There is one loose orange underline beneath the title and no more than three small orange doodle accents.
6. A clear gap separates the title and illustration, with visible breathing room rather than edge-crowded decoration.
7. Visual comparison through view_image shows the six warm roles in primary fills and strokes; no clearly off-palette hue dominates a primary element; lines retain hand-drawn pressure variation; and paper texture is warm, lightly grainy, and restrained.
8. The right side communicates one core meaning with content-grounded objects; icon vocabulary, spacing, and visual warmth are consistent with the QA reference without copying its semantics.
9. No forbidden visual element appears.
10. The normalized PNG measures exactly 1923 x 818.

Treat title inaccuracy as the only eligible BEST_EFFORT defect after three attempts, and only when every title line remains readable in the required left two-or-three-line layout and the defect is limited to localized glyph substitutions or omissions. A missing, unreadable, translated, truncated, or displaced title is an absolute failure. Any extra readable text, branding, QR code, barcode, signature, prohibited rendering style, invalid dimensions, or missing left/right composition is also an absolute failure and must not produce cover.png.
