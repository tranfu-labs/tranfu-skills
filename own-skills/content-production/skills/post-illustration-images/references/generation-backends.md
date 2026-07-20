# Generation Backends

Use this reference to resolve and verify image generation execution. It defines backend behavior, not visual style or prompt content.

## Contents

- Boundary and resolution order
- Backend context and non-billable preflight
- First-image canary
- Credentials, endpoint, and model availability
- `gpt-image-2` generation geometry
- Output geometry, retries, and failure codes
- Platform delivery compatibility

## Boundary

- An image-generation skill decides the workflow. A generation backend executes one compiled prompt and returns an image artifact.
- Supported backend kinds are `runtime-native` and `configured-api`.
- An already-configured API backend is not another image-generation skill.
- Use one verified backend for a bundle. Do not silently build a fallback chain across unrelated tools, endpoints, or child runtimes.

## Resolution Order

1. Follow an explicit user backend instruction.
2. Otherwise use a callable runtime-native image tool when present.
3. Otherwise use an already-configured API image backend when the environment or user says one exists.
4. If none can be verified, stop with `BLOCKER: generation backend unavailable`.

When the user says the current environment already has a configured API backend:

- Treat the statement as authoritative intake context.
- Do not start public API-key creation or setup.
- Do not ask the user to paste or reveal a key.
- Do not treat a missing shell variable as proof that credentials are absent.
- Do not infer the service operator or endpoint from a provider label such as `openai`; it may describe only an API dialect.
- Use active approved configuration through an adapter that can consume the configured endpoint and credentials.
- Do not mine backups, unrelated projects, or stale credential stores as the normal resolution path.

## BackendContext

Record safe metadata only:

```yaml
kind: runtime-native | configured-api
adapter: <callable tool or adapter id>
endpoint_source: runtime-native | active-runtime-config | user-confirmed-config
api_dialect: <dialect or null>
model_preference: <configured/user model id or null>
model_preference_source: user | active-config | none
resolved_model: <verified image model id>
model_resolution_note: unchanged | preferred-unavailable-selected-current | backend-default-resolved
artifact_format: png | jpeg | other-supported-raster
credential_access: pass | fail
model_check: pass | fail
process_cleanup_plan: pass | fail
process_cleanup_status: not-run | pass | fail
```

Never record endpoint credentials, bearer tokens, key fragments, decrypted values, or secret-bearing command output.

## Non-Billable Preflight

Complete these checks before compiling or generating the full suite:

1. Confirm the adapter is callable in the current process.
2. Confirm the adapter can access configured credentials without printing them.
3. Resolve the endpoint from active configuration, not from a guessed official default.
4. Confirm the API dialect when the backend is API-based.
5. Query model metadata or a model list when supported and confirm at least one image-capable model is currently available.
6. Treat a stored default model as a preference only. It is not proof that a channel is active.
7. Confirm how the adapter returns image artifacts and how the current request will be distinguished from stale cache files.
8. Confirm retry limits and how processes started by the run will be terminated. Record `process_cleanup_plan: pass` and leave `process_cleanup_status: not-run` until a request actually exits.

Do not make a billable test image only to discover basic endpoint, credential, or model-list failures when the backend exposes non-billable metadata checks.

## First-Image Canary

After prompts are compiled, generate image 1 only.

Before generating image 2, verify:

- The output belongs to the current prompt and request.
- The artifact exists and is a readable raster image.
- Actual dimensions and aspect ratio are recorded.
- The image expresses the planned single core meaning.
- Required short labels are correct enough for delivery.
- The selected visual style and fixed-component clear areas are respected.
- The request process exited and no child process from the request remains active.

Standalone runs continue the suite one image at a time only after this canary passes. Under an
orchestrator-issued `bounded-per-image` profile, the queue may then submit at most two children from
this suite while respecting its global limit; every child still has independent artifacts and QA.

## Credentials And Endpoint Safety

- Check credential accessibility with silent status checks. Never print, quote, summarize, or log credential values.
- Pass credentials only through the backend's approved runtime mechanism.
- If credentials exist in the parent application but the selected adapter cannot consume them, report `BLOCKER: backend credentials unavailable to adapter`. This is an integration mismatch, not proof that the user lacks credentials.
- If the user asserted a configured backend, do not redirect to public vendor key provisioning.
- If the configured endpoint cannot be resolved from active approved configuration, report `BLOCKER: backend configuration inaccessible`.
- If a request reaches an unexpected official/default endpoint, stop as `BLOCKER: backend endpoint mismatch`; do not retry with the same unresolved routing.

## Dynamic Model Availability

- A configured model id can be stale even when credentials and endpoint are valid.
- On `model_not_found`, `no channel`, or equivalent errors, refresh model availability once.
- If the user explicitly required the unavailable model, stop and report it.
- If the user did not require a model, select another image-capable model only when that model has a verified geometry profile; otherwise stop instead of borrowing incompatible size rules.
- Record the original preference, its source, the resolved model, and why they differ. Never overwrite the preference in the record as though it had always named the resolved model.
- Do not switch service operators, endpoints, or backend kinds merely to preserve a stale model preference.
- Authentication, endpoint, and model-availability failures are not image-quality failures and must not consume the image QA retry budget.

For the built-in production styles, require the `gpt-image-2` geometry profile. If `gpt-image-2` is unavailable, refresh once and stop as `BLOCKER: backend model channel unavailable`. Do not silently select another model unless that model has its own verified geometry profile; no other profile is currently bundled.

## `gpt-image-2` Generation Geometry

Read `references/gpt-image-2-geometry.spec.json` and run `scripts/resolve-generation-geometry.mjs` after the Style Spec is selected. The resolver maps the Style Spec target ratio to a valid API request:

| Style ratio | Request dimensions |
|---|---:|
| `4:3` | `1600x1200` |
| `3:4` | `1152x1536` |
| `16:9` | `2048x1152` |

These are request dimensions, not promised output dimensions. The configured gateway may return a different size even after accepting `size`. Never use observed gateway outputs such as `1448x1086`, `1086x1448`, or `1672x941` as API request values. For built-in styles, resolve this mapping automatically and never ask the user to choose a size.

## Output Geometry

The Style Spec canvas is a design coordinate system. `GenerationGeometry` owns the API request. An accepted backend raster owns delivery pixel dimensions.

1. Record requested dimensions before generation and actual source format, width, height, and aspect ratio after it.
2. If the actual ratio matches within `ratioTolerance` and any configured `minimum_short_edge` is met, accept it as `pass-native`; `delivery_dimensions` equals `source_dimensions`.
3. Reject output outside ratio tolerance or below the configured minimum edge. Retry the same canonical request with stronger geometry wording; never crop, pad, rotate, stretch, resize, or upscale it.
4. Allow at most three submitted image candidates per image, then stop as `BLOCKER: backend output geometry mismatch` without asking the user to select a size.
5. When branding is disabled, deliver the accepted source directly and do not invoke a raster renderer.
6. When branding is enabled, require the verified backend artifact contract to materialize PNG, then run `scripts/apply-brand-overlay.mjs`. Do not silently convert a JPEG source; stop as `BLOCKER: brand overlay input format unavailable`. The overlay must return exactly the source width and height.
7. Record `requested_dimensions`, `source_dimensions`, `delivery_dimensions`, `native_output_preserved`, ordered `post_generation_actions`, structured geometry attempts, and any overlay renderer or hard-limit exporter used.
8. Never claim the requested generation size was honored without inspecting the actual raster.

## Platform Delivery Compatibility

Accepted source geometry remains native. Platform format and byte limits never authorize automatic crop, padding, rotation, stretch, resizing, or upscaling.

| Platform and publishing path | Native geometry policy | Format or byte adaptation only when required |
|---|---|---|
| WeChat web editor | No exact body-image pixel requirement; accept an in-tolerance raster such as `1448x1086`. | BMP, PNG, JPEG, JPG, or GIF, at most 5 MiB. |
| WeChat permanent-material API | Same native geometry policy. | JPG or PNG below 1 MiB; convert or compress without changing width and height when necessary. |
| Xiaohongshu image post | No exact `1080x1440` requirement; accept an in-tolerance raster such as `1086x1448`. | PNG or JPEG; current uploader checks are publishing constraints, not a resize mandate. |
| Zhihu body image | No exact body-image pixel requirement; accept `2048x1152` and in-tolerance `1672x941` natively. | Use a same-dimension PNG/JPEG export only when the active upload path rejects the source. |

Choose the rule only when `IntakeContext.publishing_path` identifies the actual path. If it is `null`, deliver the native artifact and do not ask for a path merely to speculate about compression. If the source already passes a known path's format and byte limit, perform no export. If an export is required, first verify an available exporter can preserve width and height while meeting that exact format/byte limit; otherwise stop as `BLOCKER: required hard-limit export unavailable`. Record the exporter, append `hard-limit-export` to `post_generation_actions`, and verify output dimensions. A branded export may record both `brand-overlay-native` and `hard-limit-export` in execution order. Compression or conversion is not geometry normalization.

No Weibo or Toutiao uploader limit is bundled yet. Do not invent one: format/byte adaptation requires a verified publishing path, while `publishing_path: null` keeps native delivery. Toutiao's `minShortEdge: 900` is an internal style quality floor enforced in calibration and production, not a claim about the uploader.

Sources checked for this policy: [WeChat web editor image requirements](https://kf.qq.com/faq/161220AVNfeI161220AVvAr6.html), [WeChat permanent-material image API](https://developers.weixin.qq.com/doc/service/api/material/permanent/api_uploadimage), [Xiaohongshu creator image publisher](https://creator.xiaohongshu.com/publish/publish?target=image), and [Zhihu creator manual](https://www.zhihu.com/knowledge-plan/manual). Xiaohongshu and Zhihu uploader behavior must be rechecked when their active frontend changes; do not turn an observed uploader threshold into a timeless contract.

## Retries And Process Cleanup

- Keep backend transport retries separate from visual QA retries.
- `generation_attempt` counts image candidates submitted for one image. Endpoint/credential/model-list preflight failures do not increment it. Record adapter-internal transport retries separately when observable.
- Do not retry authentication failures, endpoint mismatches, missing model channels, or invalid programmer arguments without changing the failed condition.
- Do not start another request while the previous request or its child process is still running.
- After failure or timeout, terminate only processes created by the current run and verify they exited.
- Do not assume a nested CLI or child agent inherits the parent runtime's tools, credentials, endpoint, or image capability. Verify it before use.
- If the adapter exits successfully but no current valid artifact exists, report `BLOCKER: backend output unavailable`.
- If cleanup cannot be verified, report `BLOCKER: backend process cleanup failed`.

## Failure Codes

| Condition | Required result |
|---|---|
| No callable native or configured API adapter | `BLOCKER: generation backend unavailable` |
| Active backend configuration cannot be consumed | `BLOCKER: backend configuration inaccessible` |
| Credentials exist but adapter cannot access them | `BLOCKER: backend credentials unavailable to adapter` |
| Request resolves to an unintended endpoint | `BLOCKER: backend endpoint mismatch` |
| No currently available image-capable model | `BLOCKER: no image-capable model available` |
| Explicitly required model has no active channel | `BLOCKER: backend model channel unavailable` |
| Resolved model or ratio has no verified geometry profile | `BLOCKER: backend geometry profile unavailable` |
| Request returns no current valid raster artifact | `BLOCKER: backend output unavailable` |
| Source ratio or configured minimum edge conflicts with the Style Spec | `BLOCKER: backend output geometry mismatch` |
| Branding is enabled but the backend cannot materialize PNG | `BLOCKER: brand overlay input format unavailable` |
| A known publishing limit requires export but no same-dimension exporter is available | `BLOCKER: required hard-limit export unavailable` |
| Node.js 22+ or the vendored finalizer is unavailable | `BLOCKER: required brand overlay unavailable` only when branding is enabled |
| A process started by the run cannot be stopped | `BLOCKER: backend process cleanup failed` |

Always name the observed layer: adapter, configuration, credential access, endpoint, model, artifact, geometry, or process cleanup. Never reduce all of these to “native image generation unavailable.”
