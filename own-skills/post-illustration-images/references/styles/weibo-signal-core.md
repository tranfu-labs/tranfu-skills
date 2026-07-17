# Weibo 信号核心科技图解

## Purpose

Create vertical Weibo illustrations for technical concepts, process mechanisms, comparisons, and practical checklists. Turn dense information into an urgent but controlled visual signal without reproducing any reference topic, copy, layout, or identity.

## Visual Character

Use a near-black field, decisive warm-white hierarchy, and one concentrated red signal role. Keep the frame technical, cinematic, and information-dense, but divide it into explicit zones with one organizing relationship. Energy may be high; reading order must stay controlled.

## Palette Roles

- `canvas.void`: near-black matte field.
- `surface.glass`: charcoal translucent information surfaces.
- `ink.primary`: warm white for headlines and primary labels.
- `ink.muted`: softened neutral gray for supporting copy.
- `accent.signal`: hot warm red for decisions, paths, state, and emphasis.
- `accent.soft`: pale warm red for monoline icons and secondary edge light.
- `line.cool`: rare steel-neutral counterpoint for depth, never a second dominant accent.

Use the palette as semantic roles. Do not sample or reproduce a complete reference palette.

## Typography

Use a generic geometric sans-serif suitable for concise Chinese labels. Establish an extra-bold display headline, bold section headings, medium item labels, and regular supporting copy. Keep lines short, use one emphasized phrase at most, and avoid paragraphs, tiny annotations, decorative fonts, or model-invented microcopy.

## Composition Grammar

Use an adaptive vertical sequence: a strong proposition, one relationship system, and one concise synthesis. Let meaning choose the topology: comparison, loop, route, hierarchy, or parallel checklist. Preserve local alignment and consistent spacing while changing focal position, module count, connector routing, title placement, and synthesis treatment between images. Do not freeze one exact poster layout.

## Components And Illustration

Use low-radius or clipped-corner dark panels, fine technical outlines, compact section plates, original monoline icons, semantic connectors, and small state markers. Keep connectors meaningful and decoration subordinate. Avoid soft floating cards, pill-heavy interfaces, product chrome, screenshots, proprietary icons, and large solid-color blocks.

## Texture And Material

Use shallow dark-glass layering, subtle matte grain, sparse particles, restrained grid traces, and localized red emission. Build depth through overlap, edge luminance, and contrast falloff rather than conventional drop shadows. Do not use excessive bloom, decorative debris, or photorealistic reconstruction.

## Platform Geometry

Use 1080 x 1440 as the Weibo design coordinate system. Preserve any accepted native 3:4 raster within ratio tolerance `0.002`; never crop, pad, stretch, rotate, resize, or upscale it to the design coordinates. Keep meaningful content inside `x=80, y=96, w=920, h=1248`. Keep the top-right reserved area `x=842, y=44, w=208, h=90` naturally quiet when branding is enabled; the production brand slot is `x=872, y=64, w=148, h=40`.

## Reference And Branding Policy

The Style Reference is a user-authorized QA baseline only and is never a generation input. Ignore all reference text, topic, names, logo, watermark state, exact icon assets, and exact layout. Compare only abstract color roles, typography character, density, material treatment, component language, and composition grammar. The image model must not draw branding; production branding is resolved from `brandPolicy` and added deterministically after generation.

## Prohibitions

No source copy, source topic, named entities, exact coordinates, exact panel counts, exact connector paths, proprietary assets, logo, fake brand, watermark, model signature, page-number badge, placeholder, reserve box, visible slot marker, or source reconstruction. Never pass the Style Reference to the generation backend.
