# Product Logo Design Spec And Workflow

## Design Spec Contract

Before visual generation, derive a product-specific logo design specification. The specification should be short enough to guide prompts, but concrete enough to prevent generic image generation.

It MUST cover:

- brand personality: 2-4 adjectives grounded in product context;
- audience signal: what the mark should communicate to the target user or buyer;
- symbol logic: candidate metaphors tied to product motion or domain;
- shape language: geometric, organic, modular, monoline, dimensional, editorial, technical, playful, or another explicit direction;
- color direction: use provided brand colors when available, otherwise propose a restrained palette with rationale;
- material/depth direction: flat, dimensional, tactile, material, linework, or another explicit choice with rationale;
- composition rules: square icon-first framing, padding, silhouette, and 32px recognition requirements;
- avoid list: symbols, styles, colors, or claims that would make the mark generic or misleading.

## Product Mapping

Map product information into a design specification before writing prompts.

Use these cues:

- API, routing, relay, infrastructure: system, path, gateway, channel, or orchestration metaphors.
- Data import or ingestion: intake, receiving, stream, container, or transformation metaphors.
- Sync or transfer: continuity, pairing, loop, handoff, or state-change metaphors.
- Admin console or management: control, clarity, hierarchy, monitoring, or command metaphors.
- Security or trust: protection, boundary, verification, custody, or stability metaphors; avoid generic shields unless they are product-true.
- Growth or scale: expansion, capacity, compounding, lift, or network metaphors.
- Automation: flow, continuity, orchestration, or repeatability metaphors; avoid robotic mascots unless requested.
- Finance, quota, capacity, billing: measurement, allocation, pool, ledger, or threshold metaphors; avoid currency icons unless requested.

## Prompt Shape

Use this prompt structure for each candidate:

```text
Use case: logo-brand
Asset type: square product logo / app icon / browser icon concept
Product context: <product name, category, users, function>
Logo design specification: <brand personality, audience signal, symbol logic, shape language, color/material direction, avoid list>
Primary request: Create a logo mark for <product> that follows the design specification and expresses <product motion or domain>.
Subject: <symbol family + composition relationship>
Style/medium: <explicit style direction derived from the design specification>
Composition/framing: square 1:1 canvas, neutral background, centered mark, generous padding, readable at 32px.
Color palette: <palette derived from product context or provided brand assets>
Materials/textures: <flat/dimensional/tactile/material direction from the design specification>
Text: none.
Constraints: no wordmark, no readable letters, no Apple logo, no extra symbols, no scene background, no generic stock icon.
```

## Variant Planning

For a first round, generate 3-4 variants:

- one safest brand-icon version;
- one more distinctive product-metaphor version;
- one more compact favicon-first version;
- one more expressive style-system version.

For a refinement round, preserve the selected variant and change only the requested axis, such as symbol family, shape language, color, material/depth, simplification, or small-size legibility.

## Validation

After generation:

- copy project-bound images out of the generated-images folder into a durable workspace path;
- verify image type and dimensions;
- reject or regenerate non-square outputs for icon work;
- create a contact sheet for comparison;
- create a 32px preview enlarged with nearest-neighbor scaling so small-size recognition is visible;
- inspect the contact sheet and small preview before reporting.

## Reference Assets

Reference assets are optional inputs, not a built-in style.

When present, inspect user-provided references for concrete constraints: colors, proportions, density, tone, category conventions, and avoid patterns. Do not copy another brand mark directly.
