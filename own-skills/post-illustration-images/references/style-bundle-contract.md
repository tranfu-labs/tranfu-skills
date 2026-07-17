# Style Bundle Contract

`visual-builder` produces a candidate bundle. `post-illustration-images` validates and installs that bundle without reading the source image or using it as a generation reference.

## Required layout

```text
<bundle>/
  candidate.json
  visual-dna.md
  visual-dna.json
  style.md
  style.spec.json
  provenance.json
  qa.json
  prompts/
    concept.md
    process.md
    checklist.md
  calibration/
    concept.png
    process.png
    checklist.png
    style-reference.png
    contact-sheet.png
```

All paths stored in the bundle must be relative POSIX paths without `..`, backslashes, absolute roots, URL schemes, or NUL characters. The source image is never copied into the bundle or the installed Skill.

## Candidate metadata

`candidate.json` uses this shape:

```json
{
  "schemaVersion": 1,
  "status": "approved",
  "template_ready": true,
  "style": {
    "id": "xhs-example-style",
    "displayName": "Example style",
    "platform": "xhs",
    "makeDefault": true,
    "defaultUse": "Default routing use",
    "aliases": ["example alias"],
    "brandPolicy": {
      "defaultEnabled": true,
      "userOverrideAllowed": true
    }
  },
  "files": {
    "styleMarkdown": "style.md",
    "styleSpec": "style.spec.json",
    "provenance": "provenance.json",
    "styleReference": "calibration/style-reference.png",
    "qa": "qa.json"
  },
  "humanApproval": {
    "status": "approved",
    "approvedAt": "2026-07-16T08:00:00.000Z",
    "note": null
  }
}
```

- `style.id` must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- `style.platform` is exactly `wechat`, `xhs`, `zhihu`, `weibo`, or `toutiao`.
- `style.makeDefault` is optional and must be boolean when present. It behaves as `false` when absent. The first installed style for an unregistered supported platform becomes that platform's default regardless, because the registry cannot expose a platform without a usable default.
- Installation requires `status: "approved"` and `template_ready: true`.
- `humanApproval.status` must be `approved` and `approvedAt` must be an ISO 8601 timestamp.
- `style.aliases` must contain unique, non-empty strings. `style.displayName` and `style.defaultUse` are required.
- Every `files` value is a safe relative path and resolves to a required bundle file.

## Platform design geometry

New candidates use the platform baseline as a design coordinate system, not as required delivery pixels:

| Target platform | Spec platform | Canvas | Ratio | Orientation |
|---|---|---|---|---|
| `wechat` | `wechat` | `1600 x 1200` | `4:3` | horizontal |
| `xhs` | `xiaohongshu` | `1080 x 1440` | `3:4` | vertical |
| `zhihu` | `zhihu` | `1600 x 900` | `16:9` | horizontal |
| `weibo` | `weibo` | `1080 x 1440` | `3:4` | vertical |
| `toutiao` | `toutiao` | `1600 x 900` | `16:9` | horizontal |

`style.spec.json` must use the candidate ID, the mapped spec platform, and the exact baseline design canvas. `styleFile` must be `references/styles/<style_id>.md`. Every rectangle under `layout`, including `contentSafeArea` and `brandReservedArea`, must have positive finite dimensions and stay inside that coordinate system.

The content safe area, brand reserved area, and brand slot must equal the platform baseline. `inputHandling` must set `preserveNativeOutput: true`, `outputCanvasRole: "design-coordinate-system"`, `allowPostGenerationResize: false`, and `ratioTolerance: 0.002`; it must forbid crop, padding, rotation, and wrong-ratio stretching and use `wrongRatioAction: "regenerate"`. An accepted model raster owns its delivery pixel dimensions. Toutiao additionally uses `minShortEdge: 900` as an internal calibration quality floor, not an uploader limit.

The Weibo baseline uses content safe area `{ "x": 80, "y": 96, "width": 920, "height": 1248 }`, brand reserved area `{ "x": 842, "y": 44, "width": 208, "height": 90 }`, and brand slot `{ "x": 872, "y": 64, "width": 148, "height": 40 }`.

The formal reference path is `assets/style-references/<style_id>.png`. The spec must declare it under `styleReference.image`, set `styleReference.isGenerationInput` to `false`, and include non-empty `usage` and `contentPolicy` strings. `calibration/style-reference.png` must be byte-identical to the selected unbranded calibration image.

## Brand contract

Every installed spec keeps valid top-right brand geometry even when branding defaults off:

```json
{
  "brandPolicy": {
    "defaultEnabled": true,
    "userOverrideAllowed": true
  },
  "fixedComponents": {
    "brandSlot": {
      "enabled": true,
      "anchor": "top-right",
      "x": 872,
      "y": 64,
      "width": 148,
      "height": 40,
      "assetFit": "contain"
    }
  }
}
```

`brandPolicy.defaultEnabled` may be `true` or `false`; `userOverrideAllowed` must be `true`. The slot must fit inside `layout.brandReservedArea`, which must sit in the top-right canvas quadrant. `generationConstraints.forbidModelDrawnBrand` and `keepBrandReservedAreaClear` must both be `true`.

At runtime, brand resolution is: explicit user choice, then template default, then compatibility default `true` for an older spec without `brandPolicy`. When the resolved value is false, the reserved area is not active, but its geometry remains valid.

## QA contract

`qa.json` contains `schemaVersion: 1`, top-level `hard_gates`, `dimension_averages`, and exactly three `calibration_images` with IDs `concept`, `process`, and `checklist`. The seven required dimensions are `color`, `typography`, `texture`, `illustration`, `spacing`, `composition`, and `cross_content_adaptability`.

It also records separate `reviews.style` and `reviews.originality` runs with different run IDs, backend/model/timestamp, pass conclusions, and the visibility fields defined by Visual Builder. The source-blind style run sees all three images to assess cross-content adaptability. Image-mode originality review sees source pixels; DNA-only review records `source-pixels-unavailable` and cannot claim source-pixel visibility.

- Every `dimension_averages` and per-image `scores` value is at least `75`.
- Every image `total_score` is at least `85`; `average_score` is at least `88`.
- Every item under top-level and per-image `hard_gates` is a pass flag and must be `true`: `dimensions`, `aspect_ratio`, `safe_area`, `single_core_meaning`, `identity_leakage`, and `brand_free`. Here `identity_leakage: true` means the no-leakage check passed.
- Each image records a non-empty generation backend and model plus dimensions matching the actual calibration PNG. Calibration images and the selected Style Reference must match the design canvas ratio within tolerance; they do not need to equal its pixel dimensions.
- `selected_reference.image_id` selects one of the three images, `source_image` matches that image's file, `path` is `calibration/style-reference.png`, and `unbranded` is `true`.
- Image `file` and `prompt_file` values must be the canonical paths shown in the required layout.
- `contact_sheet` must be `calibration/contact-sheet.png`; it is a valid PNG used only for human comparison and is never installed as the formal style reference.

`provenance.json` records either image extraction or supplied Visual DNA. Image mode requires the source SHA-256, source dimensions, computed short edge of at least 512, and confidence from 0 to 1. DNA mode records `source.kind: "provided-visual-dna"`. Both modes require `original_retained: false` and `used_as_generation_reference: false`.

`visual-dna.json` must pass the four-of-six design-signal gate, record `identity_dominates: false`, and have `evidence_complete: true` with no missing evidence before installation.

## Commands

Validate without changing either repository:

```bash
node scripts/validate-style-bundle.mjs --bundle /path/to/bundle
```

Install after approval:

```bash
node scripts/install-style-bundle.mjs --bundle /path/to/bundle
```

The installer holds one skill-root install lock, copies the style Markdown, spec JSON, provenance JSON, and selected reference PNG; appends one registry entry; regenerates `style-index.md`; validates the complete installed registry; and marks the candidate `installed`. The first approved Weibo or Toutiao style also registers that platform and makes the new style its default. On an existing platform, `style.makeDefault: true` changes that platform's default; absent or false preserves it. It refuses concurrent installation, an existing ID, path, alias collision, or destination file. If any install step fails, it removes files created by that attempt and restores the prior registry, generated index, and candidate metadata, including platform/default changes.
