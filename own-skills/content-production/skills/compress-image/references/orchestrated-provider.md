# Content Production Image Compression Provider

Use this route whenever any content-production provider marker appears. A valid request must contain
`contract: content-production-provider/v1`, `capability: image_compression`,
`provider_contract: image-compression-v1`, and `mode: compress_one`; partial or conflicting markers
must be validated and returned as BLOCKED. Standalone file and directory behavior remains unchanged
when no provider marker is present.

## Execute

1. Run `node "<SKILL_ROOT>/scripts/provider-contract.mjs" validate-request <request.json>`.
2. If validation passes, run
   `node "<SKILL_ROOT>/scripts/provider-contract.mjs" execute <request.json>`.
3. If the pinned runtime cannot run, use
   `node "<SKILL_ROOT>/scripts/provider-contract.mjs" block <request.json> <reason>`.
4. Return the canonical `compression.result.json` to the orchestrator. Do not copy a candidate into
   a publish path and do not write a manifest or `optimization.json`.

`execute` invokes the bundled `main.mjs` with one absolute source, one explicit candidate output,
`--json`, and no directory, recursive, or replace option. The source must remain byte-identical.

## Request Contract

The request binds one `source_image`, one current package attempt, and one staging candidate.
Task IDs use:

```text
image-compression:<run-id>:<platform>:<variant>:<asset-id>:package-NNN
```

Attempt 1 uses:

```text
08-publish-pack/_compression/<platform>/<asset-id>/compression.request.json
08-publish-pack/_compression/<platform>/<asset-id>/compression.result.json
08-publish-pack/_compression/<platform>/<asset-id>/candidate.webp|png
```

Attempt 2 uses the same layout under `_compression/v002/`. Prior attempts are immutable.

Top-level request keys are exactly:

```text
schema_version, contract, task_id, capability, provider_contract, run_dir, run_mode,
mode, attempt, platform, variant, asset_id, asset_kind, inputs, output_dir,
expected_artifacts, options, interaction_policy
```

`asset_kind` is `body_image` or `wechat_cover`. Body images require WebP, quality 80, and
`lossless=false`. The WeChat cover requires `platform=wechat`, `asset_id=wechat-cover`, lossless
PNG, no quality value, and actual normalized dimensions of 1923x818. Options are exactly:

```text
format, quality, lossless, preserve_source, preserve_display_dimensions, selection_policy
```

The final three policy values are `true`, `true`, and `strictly-smaller-else-source`.
Requests with directories, symlinks, stale hashes, escapes, an existing candidate or result, a
source/candidate alias, unsupported formats, or extra fields are invalid.

## Result Contract

A PASS result has one `compressed_candidate` artifact and these exact top-level keys:

```text
schema_version, contract, provider_contract, task_id, request_sha256, status,
artifacts, checks, compression, issues, warnings
```

`checks` is exactly `{request_valid, mode}` and a canonical result always records
`request_valid=true`, `mode=compress_one`.

`compression.source` and `compression.candidate` each contain exactly:

```text
path, sha256, bytes, format, width, height
```

Formats are decoded content formats: JPEG sources use `jpeg` even when the filename ends in `.jpg`.
Dimensions are display dimensions after EXIF orientation normalization.

The remaining compression fields are:

```text
source_unchanged, dimensions_preserved, saved_bytes, saved_percent,
recommended_selection
```

Recommend `candidate` only when its byte count is strictly lower. Otherwise recommend `source` and
emit `compression_candidate_not_smaller`. This is still PASS: the orchestrator owns the final
publish copy, extension, manifest, and optimization aggregation.

Malformed or unsafe requests return BLOCKED without a canonical result. A valid request that cannot
run may write BLOCKED. An execution or verification failure writes FAILED. Every canonical result
binds the exact request bytes through `request_sha256`.
