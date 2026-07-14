# Brand Plugin

Brand Plugin is default-on, user-disableable, and pluggable. Every production image receives the real brand asset unless the user explicitly requests no watermark, no logo, or no Tranfu branding. Brand Plugin does not define canvas size, color palette, safe area, logo coordinates, or platform layout.

The selected Style Spec is always the authority for brand placement and size.

## Enablement

- Enabled by default for every production image.
- Disable it only when the user explicitly says not to add brand elements, watermark, logo, or Tranfu.
- Every production Style Spec must define an enabled top-right `brandSlot` and matching `brandReservedArea`.
- If a selected production Style Spec has no enabled top-right `brandSlot`, do not invent a placement and do not silently deliver unbranded. Stop as `BLOCKER: required production brand slot unavailable` or update the Style Spec first.
- Style Reference watermark presence, absence, or position never changes production enablement or placement.

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

The image model must never draw or simulate the brand, including when the user disables Brand Plugin. Always add this constraint to image-generation prompts:

```text
Do not draw any logo, TF mark, Tranfu text, watermark, brand sticker, or page-number badge.
```

When Brand Plugin is enabled, additionally require the selected Style Spec's top-right brand slot to remain naturally clear for the real SVG overlay. When the user explicitly disables Brand Plugin, omit only the reservation and overlay instructions, not the no-brand constraint.

## Overlay Rule

After image generation, overlay the real brand asset using the selected Style Spec's top-right `brandSlot` before delivery. Do not scale, move, recolor, or restyle the brand according to a global coordinate rule. If the slot is too large, too small, or poorly placed, fix the Style Spec, not this Brand Plugin.

The deterministic overlay must reject a Style Spec when its brand slot is disabled, not anchored at top-right, outside the matching reserved area or canvas, outside the top-right quadrant, or when `keepBrandReservedAreaClear` is not `true`.

If the overlay dependency is unavailable and installation is not approved or does not succeed, unbranded delivery is allowed only after the user explicitly disables branding. Otherwise stop as `BLOCKER: required brand overlay unavailable`.
