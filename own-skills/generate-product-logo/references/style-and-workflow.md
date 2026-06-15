# Product Logo Style And Workflow

## Style Contract

Use this visual grammar as the default:

- minimalist product logo, not a marketing illustration;
- square 1:1 composition for icon-first use;
- centered object with generous white-space padding;
- premium 3D frosted-glass material;
- dark graphite, smoky black, or translucent black base;
- vivid red translucent glass primary symbol;
- rounded bevels, soft internal diffusion, restrained reflection;
- light background, preferably white or near-white;
- strong silhouette at 32px;
- no text, no letters, no wordmark in first-pass icon concepts.

The reference style is based on a dark glass dock or base supporting a red glass directional arrow. Keep the grammar flexible enough to fit the product: the base can become a tray, dock, relay platform, data slot, console tile, shield-like foundation, or resource pool if that better matches the product.

## Product Mapping

Map product information into the mark before writing prompts.

Use these cues:

- API, routing, relay, infrastructure: platform base, upward dispatch arrow, subtle channel slot.
- Data import or ingestion: downward arrow into glass base, receiving slot, compact foundation.
- Sync or transfer: paired up/down family, but each icon should stay simple.
- Admin console or management: controlled base, stable platform, precise centered symbol.
- Security or trust: heavier base, protected slot, but avoid generic shields unless the product requires it.
- Growth or scale: upward arrow, wider base, brighter red glow, but keep it restrained.
- Automation: smooth continuous motion cue, not a robotic mascot.
- Finance, quota, capacity, billing: stacked or pooled base, measured red symbol, no currency icons unless requested.

## Prompt Shape

Use this prompt structure for each candidate:

```text
Use case: logo-brand
Asset type: square product logo / app icon / browser icon concept
Product context: <product name, category, users, function>
Primary request: Create a minimalist logo mark for <product>. Use a dark frosted-glass base and a vivid red translucent <symbol> that expresses <product motion>.
Subject: <base shape + symbol relationship>
Style/medium: premium 3D frosted-glass app icon, iOS-inspired glassmorphism, enterprise SaaS identity.
Composition/framing: square 1:1 canvas, white or very light background, centered mark, generous padding, readable at 32px.
Color palette: vivid red primary symbol, smoky graphite/black translucent base, silver-white edge highlights.
Materials/textures: frosted glass, rounded bevels, subtle refraction, soft internal diffusion, restrained reflection.
Text: none.
Constraints: no wordmark, no readable letters, no Apple logo, no extra symbols, no scene background, no generic stock icon.
```

## Variant Planning

For a first round, generate 3-4 variants:

- one safest brand-icon version;
- one more dimensional glass version;
- one more compact favicon-first version;
- one more product-specific metaphor version.

For a refinement round, preserve the selected variant and change only the requested axis, such as arrow direction, base shape, material intensity, color, or simplification.

## Validation

After generation:

- copy project-bound images out of the generated-images folder into a durable workspace path;
- verify image type and dimensions;
- reject or regenerate non-square outputs for icon work;
- create a contact sheet for comparison;
- create a 32px preview enlarged with nearest-neighbor scaling so small-size recognition is visible;
- inspect the contact sheet and small preview before reporting.

## Asset References

Reference assets, when present:

- `assets/reference-arrow-up-glass.png`: selected upward-arrow glass style;
- `assets/reference-arrow-down-glass.png`: matching downward-arrow companion.

Use them as style references only. Do not overwrite them.
