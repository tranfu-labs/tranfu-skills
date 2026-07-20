---
name: visual-builder
display_name: Visual Style Bundle Builder
display_name_zh: 视觉风格包构建
description: >-
  Convert a user-supplied designed image or an existing visual_dna_system document into a debranded, platform-specific illustration-style candidate bundle. Use when the user asks to extract a reusable visual template, turn a poster, knowledge card, infographic, illustration, or designed interface into a style, compile Visual DNA into a post illustration template, calibrate a new style across multiple content structures, or approve such a candidate for local installation. Do NOT trigger when the request is for ordinary image editing, one-off image generation, natural-photo presets, logo extraction, pixel-identical cloning, or installing an unreviewed style.
version: 0.1.0
author: BruceL017
updated_at: 2026-07-17
origin: own
allow_exec: true
---

# Visual Builder

Build a reusable style candidate from visual evidence without carrying over its identity or subject. Treat the reference as evidence for visual grammar, never as a generation reference or a source to imitate literally.

## Companion Preflight

Run this preflight once at the start of each task, before validating inputs. Set a task-local `CompanionContext` and never write it into the candidate bundle.

1. Mark `visual-dna-system` or `post-illustration-images` available when the current runtime lists that skill.
2. For any unresolved skill, check for a readable `SKILL.md` at `${CODEX_HOME:-$HOME/.codex}/skills/<skill-name>/SKILL.md`. Do not search unrelated directories.
3. When both skills are available, continue silently.
4. When one or both skills are missing, issue one concise, non-blocking recommendation that lists all and only the missing skills, calls them optional, explains the applicable fallbacks below, and states that the current task will continue. Do not ask the user to choose, do not install automatically, and do not repeat the recommendation in the same task.

Treat this as installation onboarding, independent of the current `input_mode` or installation intent. Preflight availability means only that a skill was discovered; validate the downstream scripts separately if installation is later requested. A later `target-skill-unavailable` result is an installation blocker, not a repeated onboarding recommendation.

Use the companions only for these boundaries:

- `visual-dna-system`: preferred upstream extractor for image input. When missing, use the built-in extraction path in Section 1.
- `post-illustration-images`: optional downstream registry and production skill. When missing, complete and approve a portable candidate bundle but do not describe it as installed or production-ready.

## Inputs

Require all named inputs before compiling:

- `input_mode`: `image` or `visual-dna`.
- `source`: readable image path for `image`, or JSON/Markdown containing a `visual_dna_system` object for `visual-dna`.
- `target_platform`: exactly `wechat`, `xhs`, `zhihu`, `weibo`, or `toutiao`; never infer it from the source ratio.
- `output_root`: directory in which to create `visual-builder-output/<style_id>/`.
- Optional overrides before review: `style_id`, `display_name`, `purpose`, `aliases`, `default_use`, `brand_default_enabled`, and `make_default`. Map `purpose` only to `style.md` `## Purpose`; map `default_use` to `candidate.style.defaultUse` and the registry's `defaultUse`. Map `make_default` to optional `candidate.style.makeDefault`; omit it or use `false` unless the user explicitly requests this style as the platform default.

Use these authoritative platform design coordinate systems. They define layout geometry, not required delivery pixels:

| `target_platform` | Canvas | Ratio | Target style platform |
| --- | ---: | ---: | --- |
| `wechat` | 1600 x 1200 | 4:3 | `wechat` |
| `xhs` | 1080 x 1440 | 3:4 | `xiaohongshu` |
| `zhihu` | 1600 x 900 | 16:9 | `zhihu` |
| `weibo` | 1080 x 1440 | 3:4 | `weibo` |
| `toutiao` | 1600 x 900 | 16:9 | `toutiao` |

Accepted calibration rasters preserve native pixel dimensions when their ratio is within `0.002`. Toutiao additionally requires a shortest edge of at least `900px`; `1672 x 941` is valid.

## Outputs And Done

Write one candidate bundle at `visual-builder-output/<style_id>/` with this shape:

```text
candidate.json
visual-dna.md
visual-dna.json
style.md
style.spec.json
provenance.json
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
qa.json
```

Use statuses `draft`, `ready_for_review`, `approved`, `installed`, or `blocked`. Read [candidate-contract.md](references/candidate-contract.md) before creating or changing a bundle.

Define **candidate done** as: the complete bundle validates, all three calibration images pass QA, and status is `ready_for_review`. Define **approval done** as: a human explicitly reviewed the contact sheet/images, `mark-approved.mjs` succeeds, status is `approved`, and `template_ready` is `true`. An approved bundle is a portable standalone deliverable even when no downstream skill is available. Define **installation done** as: the target skill installer succeeds, its registry and generated index agree, and status is `installed`. Never describe an approved but unregistered bundle as installed or production-ready, and never describe a draft or merely generated bundle as done.

## Guarded Procedure

CREATE A TODO LIST FOR THE TASKS BELOW and update it while running. Stop at the first failed gate; record the failure instead of improvising around it.

- [ ] Run the companion preflight and show any one-time optional recommendation.
- [ ] Confirm named inputs and explicit `target_platform`.
- [ ] Extract or validate Visual DNA.
- [ ] Pass the design-signal and source-integrity gates.
- [ ] Suggest and confirm debranded candidate metadata.
- [ ] Compile debranded style documents and platform geometry.
- [ ] Generate the three neutral calibration images independently.
- [ ] Run machine QA and select the best unbranded reference.
- [ ] Validate the candidate bundle.
- [ ] Obtain explicit human approval.
- [ ] Mark approved and deliver the portable bundle.
- [ ] If installation was requested, invoke the target skill installer and revalidate its registry.

### 1. Acquire Visual DNA

For `image` mode:

1. Verify the source is a designed artifact, readable, and at least 512 px on its shortest edge.
2. When `CompanionContext` marks `visual-dna-system` available, use it to extract its complete five-part output. Preserve the normalized design system as `visual-dna.md` and `visual-dna.json`.
3. Otherwise extract a compact Visual DNA directly from the image. In `visual-dna.md`, record evidence and confidence, design essence, color roles, typography hierarchy, layout and composition, shape components, material and texture, illustration or icon language, transferable principles, non-transferable identity, and originality rules. In `visual-dna.json`, write `schema_version: 1`, a non-empty `visual_dna_system` with the same evidenced concepts, and the exact `design_signal` object required by [candidate-contract.md](references/candidate-contract.md).
4. In either path, assess all six design signals plus source scope and identity dominance. Absence of a signal is `false`, not missing evidence. Do not invent unsupported visual facts. If the readable image does not support a complete assessment or fails the signal gate, follow the existing blocked or extraction-failure path instead of weakening the contract.
5. Hash the original with SHA-256 and write the complete image-mode `provenance.json` from [candidate-contract.md](references/candidate-contract.md), including schema version, source hash and dimensions, confidence, `original_retained: false`, and `used_as_generation_reference: false`.
6. Run the existing image-mode originality review with the source pixels visible to that review. Do not copy, embed, upload, or retain the original image in the candidate or target skill.

For `visual-dna` mode:

1. Require a non-empty top-level `visual_dna_system` object in JSON or an unambiguous fenced JSON object in Markdown.
2. Preserve the normalized object in both Visual DNA files and record `extraction_mode: "visual-dna"`.
3. Treat missing evidence as unknown. Do not invent source dimensions, identity analysis, or confidence.
4. Record `design_signal.evidence_complete` and the supported `missing_evidence` keys.

### 2. Enforce The Design-Signal Gate

Evaluate exactly six signals: color roles, typography hierarchy, composition, shape components, material/texture, and illustration/icon language. Require at least four observable signals.

Block with `status: "blocked"`, `template_ready: false`, and reason `insufficient-design-signal` when any condition holds:

- fewer than four signals are observable;
- an image's shortest edge is below 512 px;
- a logo, brand name, mascot, signature icon, or other identity element dominates the artifact;
- the input is a natural photo, pure logo, blurry crop, or content fragment without a reusable design system;
- fewer than four design signals are evidenced, even in DNA-only mode.

Do not produce `style.md`, prompts, or calibration images after a hard gate fails. A blocked bundle may contain only the audit files required by [candidate-contract.md](references/candidate-contract.md).

DNA-only input with at least four signals and no dominant identity may continue as a full `draft` when key evidence is missing. It must list those gaps, cannot become `ready_for_review`, and cannot be approved or installed. After the user supplies the missing evidence, normalize the DNA again, rerun affected compilation and QA, then validate before changing status.

### 2.5 Suggest Candidate Metadata

When overrides are absent, derive a generic two-to-four-token `style_id`, a concise display name, `purpose`, `default_use`, and zero or more natural-language aliases from the debranded DNA. Default `makeDefault` to false or omit it; only set it to true from an explicit user request. Do not reuse source brands, titles, proper nouns, topics, or identity-bearing motifs. Check the target registry for case-insensitive ID/alias conflicts when it is available. Write the suggestions into the candidate and `style.md`; the user may change them before approval. Revalidate after any change, and rebuild paths/prompts/QA when `style_id` or brand default changes.

### 3. Compile Without Identity Leakage

Read [compiler.md](references/compiler.md). Preserve mood, color relationships, typography character, whitespace density, material treatment, component language, illustration/icon language, and composition grammar.

Always remove or generalize:

- logos, brand names, watermarks, mascots, signatures, and unique icons;
- source copy, proper nouns, claims, numbers, topic, and narrative;
- exact layout coordinates and a full exact palette;
- product-specific navigation, forms, controls, motion, and interaction behavior;
- copyrighted characters or a living artist's identity.

Never pass the source image to a generation backend. Never ask for “the same image,” pixel matching, or literal reconstruction. Use the compiled text-only style contract for generation.

Compile `style.md` and a target-compatible `style.spec.json`. Derive the design coordinate system, content safe area, brand reserved area, and brand slot from the platform baseline, not from the source. Include:

```json
"brandPolicy": {
  "defaultEnabled": true,
  "userOverrideAllowed": true
}
```

Allow `defaultEnabled: false` only when the user changes it before approval. Keep a valid brand slot either way. Set `styleReference.isGenerationInput` to `false` and its final path to `assets/style-references/<style_id>.png`.

### 4. Calibrate Across Three Structures

Resolve image generation by capability, not by credential variable name or provider label. Accept a callable runtime-native backend or an already-configured API adapter, including third-party endpoints and third-party keys. Names such as `openai-compatible` or `OPENAI_API_KEY` describe an adapter dialect only; they never prove that the endpoint or credential was issued by OpenAI, and an official OpenAI key must not be required. For a configured API adapter, resolve its active endpoint and credential context explicitly; a runtime-native tool needs only callable image capability and current-request artifact verification. In both cases verify an image-capable model and its platform-compatible geometry, and never persist or print credential values. Use non-billable model metadata when the backend supports it, then treat the first readable, current-request raster artifact as the capability canary. Generate images two and three only after that canary passes artifact, aspect-ratio, single-meaning, fixed-area, and any platform minimum-edge checks. Preserve accepted native pixels; never crop, pad, stretch, upscale, or force them to the design coordinate dimensions.

Create new, neutral subject matter unrelated to the source. Compile and save one text-only prompt per structure:

- `concept`: explain one abstract concept with a focal relationship.
- `process`: show a clear three- or four-step directional sequence.
- `checklist`: show a scannable set of four or five parallel items.

Generate each image independently at the platform ratio. Record backend, model, requested dimensions, actual dimensions, and prompt path in `qa.json`. The three prompts must share the style contract but not a fixed composition. Do not place production branding or page numbers in calibration images. When `brandPolicy.defaultEnabled` is true, keep the platform brand area naturally quiet; when false, that area is inactive and receives no reservation instruction.

### 5. Review And Select

Read [qa.md](references/qa.md). Score every image independently for color, typography, texture, illustration, spacing, composition, and cross-content adaptability. Require every dimension to be at least 75, every image total to be at least 85, and the three-image average to be at least 88. Require all hard checks to pass.

Choose the highest-total passing image, copy it byte-for-byte to `calibration/style-reference.png`, and record both paths in `qa.selected_reference`. A tie resolves in the stable order `concept`, `process`, `checklist`. Run `node scripts/build-contact-sheet.mjs --concept <path> --process <path> --checklist <path> --output calibration/contact-sheet.png`, then record it as `qa.contact_sheet`. The reference must be unbranded and is for QA/failure review only.

Run:

```bash
node scripts/validate-candidate.mjs /absolute/path/to/candidate
```

Set status to `ready_for_review` only after validation succeeds and `design_signal.evidence_complete` is true. Present all three images plus the selected reference to the user. Do not infer approval from silence, previous approval, or a request to “finish.”

### 6. Approve And Optionally Install

After the human explicitly confirms the candidate, run:

```bash
node scripts/mark-approved.mjs /absolute/path/to/candidate \
  --confirm-human-review \
  --confirmed-by "<reviewer>"
```

Approval is standalone. After the command succeeds, keep status `approved` and deliver the portable candidate bundle. If the user did not request downstream installation, report that it is approved but not registered and stop.

Only resolve `post-illustration-images` when the user requests installation. Resolve its root in this order:

1. Use a user-provided absolute path only when it is readable and contains `SKILL.md`, `scripts/validate-style-bundle.mjs`, and `scripts/install-style-bundle.mjs`.
2. Otherwise use `${CODEX_HOME:-$HOME/.codex}/skills/post-illustration-images` and require the same files.
3. If neither resolves, report installation blocker `target-skill-unavailable`, keep the bundle unchanged at `approved`, and deliver its path. Do not search for a similarly named directory, repair links implicitly, or downgrade the approved bundle.

Run the target validator first, then its installer with the exact same approved bundle and resolved root. Do not manually copy files or edit its registry:

```bash
node <post-skill>/scripts/validate-style-bundle.mjs \
  --bundle /absolute/path/to/candidate \
  --skill-root /absolute/path/to/post-illustration-images

node <post-skill>/scripts/install-style-bundle.mjs \
  --bundle /absolute/path/to/candidate \
  --skill-root /absolute/path/to/post-illustration-images
```

Installation must refuse overwrites and roll back files created by a failed attempt. Do not install when validation fails, status is not `approved`, or `template_ready` is not `true`.

## Examples

Good requests:

- “Use this 1080 x 1440 knowledge card to build an XHS illustration template; remove its brand and keep the paper texture and editorial hierarchy.”
- “Compile this `visual_dna_system` JSON into a WeChat candidate, generate the three calibration structures, and stop for my approval.”
- “Compile this DNA into a Weibo candidate with branding off by default and make it the Weibo default after approval.”
- “I reviewed the calibration contact sheet. Mark candidate `quiet-grid` approved and install it locally.”

Expected handling:

- A clear poster with five observable signals becomes a debranded candidate at the explicit platform geometry.
- A valid DNA document with only three evidenced signals remains blocked; do not fill the fourth from guesswork.
- A candidate with passing machine scores remains `ready_for_review` until the user explicitly approves it.

Bad requests and required response:

- “Turn this holiday photo into a reusable design template.” -> Return `insufficient-design-signal`; suggest supplying a designed layout.
- “Copy this branded campaign exactly, including logo and slogan.” -> Refuse literal/identity copying; offer debranded visual abstraction.
- “Pick whatever platform fits the image.” -> Ask for `wechat`, `xhs`, `zhihu`, `weibo`, or `toutiao`; do not infer.
- “Install the first generated result; no need to review.” -> Stop before approval because three-image QA and human confirmation are mandatory.

## Failure Handling

- Missing/ambiguous input: stop and request only the missing named input.
- Extraction failure: preserve provenance and diagnostics, set `blocked`, and do not compile.
- Generation failure: keep successful artifacts, remain `draft`, and regenerate only the failed structure.
- QA failure: remain `draft`; revise the compiler contract or failed prompt, then regenerate affected calibration images. Never edit scores to pass.
- Validation failure: report exact error paths from the validator and repair the bundle before review.
- Human rejection: keep `template_ready: false`, record the note, and return to the requested stage.
- Duplicate style ID or installer failure: do not overwrite; keep status `approved`, report the conflict, and leave the target skill unchanged.

## Resources

- [candidate-contract.md](references/candidate-contract.md): bundle schemas, lifecycle invariants, and platform geometry.
- [compiler.md](references/compiler.md): Visual DNA-to-template mapping and debranding rules.
- [qa.md](references/qa.md): calibration content, scoring rubric, hard checks, and approval policy.
- `scripts/build-contact-sheet.mjs`: deterministic three-image review sheet renderer.
- `scripts/validate-candidate.mjs`: deterministic bundle validator; add `--json` for machine-readable output and `--registry <path>` for duplicate checks.
- `scripts/mark-approved.mjs`: guarded human-approval transition; it never installs a template.
