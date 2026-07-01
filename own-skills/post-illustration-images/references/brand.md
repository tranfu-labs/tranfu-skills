# Brand Plugin

Brand Plugin is optional and pluggable. It decides whether a brand asset is used and which asset is used. It does not define canvas size, color palette, safe area, logo coordinates, or platform layout.

The selected Style Spec is always the authority for brand placement and size.

## Enablement

- Enabled by default only when the selected Style Spec defines a `brandSlot`.
- Disable it when the user explicitly says not to add brand elements, watermark, logo, or Tranfu.
- If a selected Style Spec has no `brandSlot`, do not invent a placement. Leave Brand Plugin disabled for that run or update the Style Spec first.

## Brand Asset

SVG-only asset:

```text
assets/brand/tranfu-logo-reference.svg
```

Brand text represented by the asset:

```text
TF + Tranfu
```

## Non-Responsibilities

Brand Plugin must not decide or override:

- Canvas size or aspect ratio.
- Platform color palette.
- Background, paper, typography, or layout system.
- Safe-area geometry.
- Logo position or rendered size.
- Page badges, pagination marks, or other fixed style components.

## Generation Rule

The image model must not draw the brand.

Add this constraint to image-generation prompts when Brand Plugin is enabled:

```text
Do not draw any logo, TF mark, Tranfu text, watermark, brand sticker, or page-number badge. Keep the selected Style Spec's brand slot clear for a real SVG logo overlay after generation.
```

## Overlay Rule

After image generation, overlay the real brand asset using the selected Style Spec's `brandSlot`. Do not scale, move, recolor, or restyle the brand according to a global brand rule. If the slot is too large, too small, or poorly placed, fix the Style Spec, not this Brand Plugin.
