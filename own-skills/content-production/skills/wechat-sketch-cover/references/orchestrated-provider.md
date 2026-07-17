# Content Production WeChat Cover Provider

Use this route only for an orchestrator request with `contract: content-production-provider/v1`,
`capability: wechat_cover`, `provider_contract: wechat-cover-v1`, and `mode: generate_cover`.
Standalone output ownership and its human delivery record remain unchanged when no provider marker
is present.

## Execute

1. Run `node "<SKILL_ROOT>/scripts/provider-contract.mjs" validate-request <request.json>` before
   reading or writing business artifacts.
2. Use the exact title from the approved WeChat `selection`. The bound final draft supplies content
   context; its existing H1 is not a competing title candidate.
3. Write `source[.vNNN].md`, then follow the normal concept, prompt, generation, normalization, visual
   inspection, targeted retry, and selection workflow. Do not ask the user or create a standalone
   output directory.
4. Save one complete prompt before each candidate attempt. Normalize every readable candidate with
   `normalize_cover.py`; keep only current-attempt source, prompts, and normalized PNG candidates.
5. On an exact PASS, copy the selected candidate byte-for-byte to `cover[.vNNN].png`, write the
   generation-only `cover[.vNNN].json`, then run
   `node "<SKILL_ROOT>/scripts/provider-contract.mjs" finalize <request.json>`.
6. On an external dependency, run `block <request.json> <reason>`. If the standalone final selector
   would return BEST_EFFORT, do not create the core cover files; run
   `block-best-effort <request.json> <visible-title-defects>`. Provider BEST_EFFORT is always BLOCKED.

The provider never edits the draft, decision, `run.json`, a gate, a package, or a publish file.

## Paths And Attempts

The task ID is `wechat-cover:<run-id>:wechat:<variant>:attempt-NNN`. Visual attempt 1 uses:

```text
07-visual/wechat-cover/wechat-cover.request.json
07-visual/wechat-cover/wechat-cover.result.json
07-visual/wechat-cover/source.md
07-visual/wechat-cover/prompts/attempt-01.md
07-visual/wechat-cover/candidates/attempt-01.png
07-visual/wechat-cover/cover.png
07-visual/wechat-cover/cover.json
```

Visual attempt 2 preserves attempt 1 and uses `.v002` controls/core files plus
`prompts/v002/attempt-01.md` and `candidates/v002/attempt-01.png`. The internal candidate number
always restarts at 01 and is contiguous through at most 03. `RETRY_NO_CANDIDATE` has a prompt and no
candidate; every other recorded attempt has one normalized candidate.

The request's expected artifacts are only the current cover PNG and JSON. The canonical result also
binds the current source, prompts, and candidates. Unlisted current-attempt dynamic files, symlinks,
directory escapes, stale hashes, old-attempt paths, or overwritten prior artifacts are invalid.

## Cover Metadata

`cover[.vNNN].json` is generation-only. It contains exactly:

```text
schema_version, contract, task_id, status, attempt, platform, variant,
request, selection, inputs, style, source, backend, generation, cover, residual_risk
```

`style` binds the current `SKILL.md`, `references/style-spec.md`,
`assets/style-reference.png`, and `scripts/normalize_cover.py` by provider-relative path and SHA-256.
The reference image remains QA-only and is never passed to generation.

`generation.attempts` contains contiguous rows with exactly:

```text
attempt, prompt, candidate, backend, status,
failed_gates, absolute_failures, visible_title_defects
```

The selected QA records `model_visual_inspection`, reviewer, ISO-8601 review time, cover path/hash,
the provider-observed title, and these ten gates as `PASS`:

```text
title_accuracy, additional_text, composition, safe_margin, underline_accents,
spacing, visual_style, semantic_fidelity, forbidden_elements, dimensions
```

The exact-title evidence is a provider visual observation, not OCR proof. Record
`expected_title=observed_title=selection.title`, `comparison=exact`, readable title on the left in two
or three lines, no extra readable text, no failures or defects, and this sole limitation:

```text
No deterministic OCR was performed; title exactness is a provider visual observation bound to this artifact hash.
```

The final cover must be a real 1923x818 PNG, byte-identical to the selected candidate. Use
`status: PASS` and `residual_risk: none`. Package hashes and image optimization do not belong in this
file.

## Status Mapping

| Native outcome | Provider result |
|---|---|
| Exact title and all ten gates pass | `PASS` |
| BEST_EFFORT title-only defect | `BLOCKED`, `wechat_cover_best_effort_rejected` |
| Missing backend, source, or author dependency | `BLOCKED` |
| Malformed, unsafe, incomplete, stale, or unverifiable output | `FAILED` |

The canonical result envelope uses the shared provider schema and binds the request bytes with
`request_sha256`; a PASS result reports `title_status: provider_observed_exact`. Only PASS can advance
the visual stage.
