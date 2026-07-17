# Calibration And QA

Use this reference after all three calibration images exist. Review actual pixels; do not score prompts or intentions.

## Independent Review

MUST SPAWN A SUBAGENT TO COMPLETE THIS TASK. Spawn two separate review runs, in parallel when slots allow. Their `run_id` values must differ. If independent subagents are unavailable, keep the candidate `draft` with blocker `independent-review-unavailable`; the primary agent must not substitute its own combined review.

Use this style-reviewer task verbatim after replacing paths:

```text
Review visual style only. Read <candidate>/style.md and <candidate>/style.spec.json, then inspect <candidate>/calibration/concept.png, process.png, and checklist.png together. Never read the source artifact, provenance identity fields, or originality review. Score all seven dimensions for each image, including cross-content adaptability across the set. Do not edit files. Return exactly:
{"review":{"reviewer":"<reviewer>","run_id":"<unique-run-id>","backend":"<backend>","model":"<model>","reviewed_at":"<ISO-8601>","input_scope":"style-contract-and-all-calibration-images","source_visible":false,"originality_review_visible":false,"conclusion":"pass|fail"},"calibration_images":[{"id":"concept","scores":{"color":0,"typography":0,"texture":0,"illustration":0,"spacing":0,"composition":0,"cross_content_adaptability":0},"total_score":0,"hard_gates":{"dimensions":true,"aspect_ratio":true,"safe_area":true,"single_core_meaning":true}},{"id":"process","scores":{"color":0,"typography":0,"texture":0,"illustration":0,"spacing":0,"composition":0,"cross_content_adaptability":0},"total_score":0,"hard_gates":{"dimensions":true,"aspect_ratio":true,"safe_area":true,"single_core_meaning":true}},{"id":"checklist","scores":{"color":0,"typography":0,"texture":0,"illustration":0,"spacing":0,"composition":0,"cross_content_adaptability":0},"total_score":0,"hard_gates":{"dimensions":true,"aspect_ratio":true,"safe_area":true,"single_core_meaning":true}}]}
```

Use this originality-reviewer task verbatim after replacing paths:

```text
Review originality only. In image mode inspect <source-image-path> and <candidate>/calibration/concept.png, process.png, and checklist.png; never copy or return the source path. In DNA-only mode inspect <candidate>/visual-dna.json, provenance.json, and all three PNGs. Never read style.md, style.spec.json, style scores, or the style review. Evaluate source identity, copy, topic, asset, brand, and exact-layout leakage. Do not edit files. Return exactly:
{"review":{"reviewer":"<reviewer>","run_id":"<unique-run-id>","backend":"<backend>","model":"<model>","reviewed_at":"<ISO-8601>","input_scope":"source-and-all-calibration-images|visual-dna-and-all-calibration-images","source_mode":"image|visual-dna","source_pixels_visible":true,"style_scores_visible":false,"limitation":null,"conclusion":"pass|fail"},"image_gates":[{"id":"concept","identity_leakage":true,"brand_free":true},{"id":"process","identity_leakage":true,"brand_free":true},{"id":"checklist","identity_leakage":true,"brand_free":true}]}
For DNA-only mode set `source_pixels_visible` to false and `limitation` to `source-pixels-unavailable`.
```

The primary agent merges both outputs into `qa.json` without changing scores or conclusions. All per-image gates are the AND of the four style gates and two originality gates; both review conclusions must pass. Record the two `review` objects using the schema in [candidate-contract.md](candidate-contract.md).

Score each dimension from 0 to 100:

| Dimension | Passing evidence |
| --- | --- |
| `color` | semantic roles, contrast, and palette balance match the contract |
| `typography` | hierarchy, alignment, density, and type character are coherent |
| `texture` | surface/material treatment is visible, controlled, and consistent |
| `illustration` | icons/shapes/illustrations share the specified abstraction and stroke/fill language |
| `spacing` | whitespace rhythm, grouping, and margins remain intentional |
| `composition` | content meaning determines a clear focal structure without copying a fixed layout |
| `cross_content_adaptability` | style remains recognizable while serving this structure naturally |

Require every score to be at least 75. Require each image's `total_score` to be at least 85. Compute the mean of the seven scores as guidance; a reviewer may set a lower total when interactions create a visible defect, but never a higher total than the rounded score mean.

Require `average_score >= 88` across the three totals. Set `dimension_averages` to arithmetic means of respective scores, rounded to two decimals.

## Hard Gates

Every gate is a boolean pass flag and must be `true` for every image:

- `dimensions`: PNG IHDR equals generation metadata, preserves native output, and meets any platform minimum short edge.
- `aspect_ratio`: target ratio is exact; no crop, padding, rotation, or stretch workaround.
- `safe_area`: meaningful content fits inside `layout.contentSafeArea`; the reserved brand area stays quiet only when `brandPolicy.defaultEnabled` is true and is inactive otherwise.
- `single_core_meaning`: image communicates one assigned brief rather than unrelated ideas.
- `identity_leakage`: no source logo, name, text, mascot, unique icon, topic, or recognizably exact arrangement appears. `true` means the leakage check passed.
- `brand_free`: no production brand, fake brand, logo-like mark, watermark, or model signature appears.

Top-level `hard_gates` contains the logical AND for each gate across all calibration images. A failed gate cannot be offset by numeric scores.

## Reference Selection

Select only after all three images pass. Choose the highest `total_score`; resolve equal scores in stable order: `concept`, `process`, `checklist`. Copy the selected PNG byte-for-byte to `calibration/style-reference.png` and record:

```json
{
  "image_id": "concept",
  "source_image": "calibration/concept.png",
  "path": "calibration/style-reference.png",
  "unbranded": true
}
```

The copied file is a QA reference only. Never supply it or another calibration image to a generation model.

Build `calibration/contact-sheet.png` after reference selection, showing the three calibration images with stable `concept`, `process`, and `checklist` labels. Record `"contact_sheet": "calibration/contact-sheet.png"` in `qa.json`. The sheet is review-only and is never installed as a style reference.

## Human Approval

Show the three calibration images together at readable size and identify the selected reference. Ask the human to confirm whether the style is recognizable, debranded, and adaptable across all structures. An explicit yes for this candidate is required.

Before approval, `candidate.humanApproval` is:

```json
{
  "status": "pending",
  "approvedAt": null,
  "note": null
}
```

`mark-approved.mjs` changes this public manifest, records the reviewer in `note`, and sets the timestamp. Never hand-edit `template_ready` to bypass it. Rejection leaves the candidate unapproved.

## Failure Routing

| Failure | Return to |
| --- | --- |
| Wrong dimensions or ratio | regeneration with corrected platform request |
| Identity or brand leakage | compiler debranding and affected prompts |
| One weak structure | that structure's prompt and image only |
| All structures share a style defect | `style.md`/`style.spec.json`, then all prompts |
| Fixed layout repeated across structures | composition grammar and all prompts |
| Human rejects despite passing QA | requested compiler/prompt stage; retain unapproved audit |

Do not raise scores, waive gates, or select a different reference merely to make validation pass.
