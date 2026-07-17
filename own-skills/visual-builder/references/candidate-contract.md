# Candidate Bundle Contract

Read this file when creating, validating, approving, or installing a candidate. `candidate.json` uses the installer's public contract; other JSON files use the field names shown here.

## Lifecycle

Allowed status transitions are:

```text
draft -> ready_for_review -> approved -> installed
  |             |              |
  +----------> blocked <--------+
```

`blocked` is an audit terminal for the current attempt; create a corrected draft rather than silently changing a hard-gate decision. Only `approved` and `installed` may have `template_ready: true`. `ready_for_review` must have passing machine QA and `template_ready: false`. Only `mark-approved.mjs` performs the review-to-approval transition.

## Complete Bundle

A reviewable or approved candidate contains:

```text
candidate.json
visual-dna.md
visual-dna.json
style.md
style.spec.json
provenance.json
prompts/concept.md
prompts/process.md
prompts/checklist.md
calibration/concept.png
calibration/process.png
calibration/checklist.png
calibration/style-reference.png
calibration/contact-sheet.png
qa.json
```

A hard-gate-blocked bundle contains `candidate.json`, `visual-dna.md`, `visual-dna.json`, and `provenance.json`. It must not claim readiness and must omit compiled/generation artifacts.

All manifest paths are relative, remain inside the bundle, use `/`, and are never symlinks. Source images are forbidden anywhere in a bundle.

## candidate.json

Use this exact public shape. Do not introduce a second candidate manifest.

```json
{
  "schemaVersion": 1,
  "status": "ready_for_review",
  "template_ready": false,
  "style": {
    "id": "quiet-grid",
    "displayName": "Quiet Grid",
    "platform": "xhs",
    "defaultUse": "structured explainers and practical checklists",
    "aliases": ["editorial-grid"],
    "makeDefault": false,
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
    "status": "pending",
    "approvedAt": null,
    "note": null
  }
}
```

- `style.id`: lowercase letters, digits, and single hyphens; 2-63 characters.
- `style.displayName` and `style.defaultUse`: non-empty strings.
- `style.platform`: `wechat`, `xhs`, `zhihu`, `weibo`, or `toutiao`; this is the explicit `target_platform` input.
- `style.aliases`: unique, trimmed, non-empty natural-language strings excluding `style.id`, compared case-insensitively.
- `style.makeDefault`: optional boolean installation intent. Omitted is equivalent to `false`; use `true` only after the user explicitly requests this style as the platform default. The first installed style for a supported platform that is not yet registered necessarily becomes that platform's default even when this field is omitted or false.
- `style.brandPolicy`: both fields are booleans and `userOverrideAllowed` is always `true`.
- `files`: use exactly the relative paths shown above. The installer consumes them directly.
- `humanApproval.status`: `pending`, `approved`, or `rejected`.
- `approvedAt`: a valid ISO 8601 instant only when approval status is `approved`; otherwise `null`.
- `note`: `null` or a non-empty string. `mark-approved.mjs` records the confirming reviewer here.

Lifecycle invariants:

| Candidate status | `template_ready` | Human approval |
| --- | --- | --- |
| `draft` | `false` | `pending` or `rejected` |
| `ready_for_review` | `false` | `pending` |
| `approved` | `true` | `approved` with timestamp |
| `installed` | `true` | `approved` with timestamp |
| `blocked` | `false` | `pending` or `rejected` |

## visual-dna.json

```json
{
  "schema_version": 1,
  "visual_dna_system": {},
  "design_signal": {
    "observable": {
      "color_roles": true,
      "typography_hierarchy": true,
      "composition": true,
      "shape_components": true,
      "material_texture": false,
      "illustration_icon_language": true
    },
    "identity_dominates": false,
    "observable_count": 5,
    "evidence_complete": true,
    "missing_evidence": [],
    "decision": "pass",
    "reason": null
  }
}
```

Use exactly the six named observations. `observable_count` equals the number of `true` values. The hard signal gate passes with at least four and `identity_dominates: false`; otherwise use `decision: "blocked"` and reason `insufficient-design-signal`. `evidence_complete` is a boolean. When false, `missing_evidence` lists unique keys from the six observations plus `identity_analysis` or `source_scope`; a passing DNA-only candidate must remain `draft`. Review, approval, and installation require `evidence_complete: true` with an empty list.

## provenance.json

For image mode:

```json
{
  "schema_version": 1,
  "extraction_mode": "image",
  "source": {
    "sha256": "<64 lowercase hex characters>",
    "width": 1080,
    "height": 1440,
    "short_edge": 1080
  },
  "confidence": 0.9,
  "original_retained": false,
  "used_as_generation_reference": false
}
```

Require `short_edge` to equal `min(width, height)`. It must be at least 512 for a non-blocked image candidate; a smaller image is valid only in a blocked audit with reason `insufficient-design-signal`. For Visual DNA mode, use `extraction_mode: "visual-dna"`, set `source` to `{ "kind": "provided-visual-dna" }`, and omit unsupported image facts. Confidence is a number from 0 through 1 when evidence supports it, otherwise `null`. The two policy booleans are always `false`.

## style.spec.json

Follow the post skill's existing spec shape:

- `id` equals `candidate.style.id`.
- `platform` is `wechat`, `xiaohongshu`, `zhihu`, `weibo`, or `toutiao` according to the mapping below.
- `canvas` exactly matches the platform baseline design coordinate system; it is not a required delivery pixel size.
- `layout.contentSafeArea` and `layout.brandReservedArea` exactly match the baseline and remain inside the canvas.
- `fixedComponents.brandSlot` exactly matches the baseline, with `enabled: true`, `anchor: "top-right"`, and `assetFit: "contain"`.
- `brandPolicy` equals `candidate.style.brandPolicy`.
- `styleFile` is exactly `references/styles/<style-id>.md`.
- `styleReference.image` is `assets/style-references/<style-id>.png`, `isGenerationInput` is `false`, and its policy says to ignore semantic content and identity.
- `inputHandling` sets `preserveNativeOutput: true`, `outputCanvasRole: "design-coordinate-system"`, `allowPostGenerationResize: false`, and ratio tolerance `0.002`; it forbids crop, padding, rotation, and wrong-ratio stretching and uses `wrongRatioAction: "regenerate"`. Toutiao also sets `minShortEdge: 900`.

Platform baseline geometry:

| Candidate platform | Spec platform | Canvas | Safe area | Reserved area | Brand slot |
| --- | --- | --- | --- | --- | --- |
| `wechat` | `wechat` | `1600,1200` | `80,80,1440,1040` | `1320,44,240,100` | `1350,64,170,46` |
| `xhs` | `xiaohongshu` | `1080,1440` | `80,96,920,1248` | `842,44,208,90` | `872,64,148,40` |
| `zhihu` | `zhihu` | `1600,900` | `80,70,1440,760` | `1320,44,240,100` | `1350,64,170,46` |
| `weibo` | `weibo` | `1080,1440` | `80,96,920,1248` | `842,44,208,90` | `872,64,148,40` |
| `toutiao` | `toutiao` | `1600,900` | `80,70,1440,760` | `1320,44,240,100` | `1350,64,170,46` |

Use ratio `4:3` for WeChat, `3:4` for XHS and Weibo, and `16:9` for Zhihu and Toutiao. XHS and Weibo are vertical; the other platforms are horizontal. Delivery images keep accepted native dimensions; Toutiao rejects a shortest edge below `900px`. Keep target-compatible input handling and generation constraints, including no crop, padding, stretching, or model-drawn brand.

## qa.json

See [qa.md](qa.md) for scoring meaning. The machine contract is:

```json
{
  "schemaVersion": 1,
  "reviews": {
    "style": {
      "reviewer": "style-review-subagent",
      "run_id": "unique-style-run",
      "backend": "record-backend",
      "model": "record-model",
      "reviewed_at": "2026-07-16T08:00:00.000Z",
      "input_scope": "style-contract-and-all-calibration-images",
      "source_visible": false,
      "originality_review_visible": false,
      "conclusion": "pass"
    },
    "originality": {
      "reviewer": "originality-review-subagent",
      "run_id": "unique-originality-run",
      "backend": "record-backend",
      "model": "record-model",
      "reviewed_at": "2026-07-16T08:01:00.000Z",
      "input_scope": "source-and-all-calibration-images",
      "source_mode": "image",
      "source_pixels_visible": true,
      "style_scores_visible": false,
      "limitation": null,
      "conclusion": "pass"
    }
  },
  "hard_gates": {
    "dimensions": true,
    "aspect_ratio": true,
    "safe_area": true,
    "single_core_meaning": true,
    "identity_leakage": true,
    "brand_free": true
  },
  "calibration_images": [
    {
      "id": "concept",
      "file": "calibration/concept.png",
      "prompt_file": "prompts/concept.md",
      "total_score": 90,
      "scores": {
        "color": 90,
        "typography": 88,
        "texture": 90,
        "illustration": 89,
        "spacing": 92,
        "composition": 91,
        "cross_content_adaptability": 90
      },
      "hard_gates": {
        "dimensions": true,
        "aspect_ratio": true,
        "safe_area": true,
        "single_core_meaning": true,
        "identity_leakage": true,
        "brand_free": true
      },
      "generation": {
        "backend": "runtime-image-tool",
        "model": "record-the-actual-model",
        "width": 1080,
        "height": 1440
      }
    }
  ],
  "average_score": 90,
  "dimension_averages": {
    "color": 90,
    "typography": 88,
    "texture": 90,
    "illustration": 89,
    "spacing": 92,
    "composition": 91,
    "cross_content_adaptability": 90
  },
  "selected_reference": {
    "image_id": "concept",
    "source_image": "calibration/concept.png",
    "path": "calibration/style-reference.png",
    "unbranded": true
  },
  "contact_sheet": "calibration/contact-sheet.png"
}
```

Provide exactly one `concept`, one `process`, and one `checklist`. The source-blind style review sees the compiled contract and all three images so it can assess cross-content adaptability; the originality review sees source evidence and all images but no style scores. The two review records use different run IDs. For DNA-only originality review, use `input_scope: "visual-dna-and-all-calibration-images"`, `source_mode: "visual-dna"`, `source_pixels_visible: false`, and `limitation: "source-pixels-unavailable"`. Repeat all seven scores and six hard gates per image. Every hard-gate value being `true` means that check passed, including `identity_leakage: true` meaning no identity leakage was found. Top-level gates are the logical ANDs across images. `dimension_averages` and `average_score` are arithmetic means rounded to two decimals. `style-reference.png` is byte-identical to `source_image`; `contact_sheet` names the required generated comparison sheet.

## Registry Check

`validate-candidate.mjs --registry <path>` accepts `{ "styles": [...] }`, a top-level array, or a top-level object keyed by style ID. Before installation, any registry entry with the candidate's ID or aliases is a conflict. For status `installed`, exactly one matching ID is required.
