# Brand Plugin

Brand Plugin is style-defaulted, user-overridable, and pluggable. Resolve its state from an explicit user override first, then `style_spec.brandPolicy.defaultEnabled`, then legacy default `true` when the policy is absent. Brand Plugin does not define canvas size, color palette, safe area, logo coordinates, or platform layout.

The selected Style Spec is always the authority for brand placement and size.

## Enablement

- Every Visual Builder style MUST define `brandPolicy: { defaultEnabled: <boolean>, userOverrideAllowed: true }`.
- Existing styles without `brandPolicy` resolve to `{ defaultEnabled: true, userOverrideAllowed: true }`.
- An explicit user request to enable or disable brand elements wins when `userOverrideAllowed` is true.
- If the user gives no brand instruction, use `brandPolicy.defaultEnabled`.
- Every production Style Spec must define an enabled top-right `brandSlot` and matching `brandReservedArea`.
- If a selected production Style Spec has no enabled top-right `brandSlot`, do not invent a placement or use that absence as a brand policy. Stop as `BLOCKER: required production brand slot unavailable` or update the Style Spec first.
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

When Brand Plugin resolves enabled, additionally require the selected Style Spec's top-right brand slot to remain naturally clear for the real SVG overlay. When it resolves disabled, omit only the reservation and overlay instructions, not the no-brand constraint.

## Overlay Rule

When branding is enabled, overlay the real brand asset using the selected Style Spec's top-right `brandSlot` before delivery. Map that design-space slot proportionally onto the source raster; the overlay canvas and output must remain exactly the source width and height. Do not recolor or restyle the brand. If the slot is too large, too small, or poorly placed, fix the Style Spec, not this Brand Plugin.

The deterministic overlay must reject a Style Spec when its brand slot is disabled, not anchored at top-right, outside the matching reserved area or canvas, outside the top-right quadrant, or when `keepBrandReservedAreaClear` is not `true`.

`scripts/apply-brand-overlay.mjs` loads vendored `@resvg/resvg-wasm@2.6.2` from `vendor/resvg-wasm/` under Node.js 22+. It requires no runtime `npm install`, native SVG renderer, network access, or API key. It is an overlay-only tool and must preserve source dimensions.

If Node.js 22+ or the vendored renderer is unavailable, stop as `BLOCKER: required brand overlay unavailable` only when branding resolves enabled. When branding resolves disabled, deliver the accepted model raster directly and do not run the finalizer.
