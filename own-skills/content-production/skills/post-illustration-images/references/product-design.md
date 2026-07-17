# Product Design: Post Illustration Images

## Purpose

`post-illustration-images` turns Chinese post content into stable AI-generated illustration assets for WeChat official account articles, Xiaohongshu notes, Zhihu posts, Weibo feed posts, and Toutiao posts.

The product goal is not to store one magical prompt. The goal is to productize a repeatable image workflow:

```text
intake
-> generation backend preflight
-> content analysis
-> expression need
-> suite-level Style Spec
-> model-specific generation geometry
-> anchors
-> shot list
-> per-image structure
-> per-image metaphor
-> first-image canary through verified generation backend
-> remaining images one at a time
-> deterministic finalization and resolved Brand Plugin overlay
-> QA
-> saved assets
```

## Design Decisions

1. Style details live outside `SKILL.md`.
   - Full style prompts are stored in `references/styles/`.
   - `references/style-registry.json` is the machine-readable routing authority; `references/style-index.md` is its generated human-readable view.
   - `SKILL.md` only routes and enforces the process.
   - This keeps future style additions cheap.

2. The suite-level Style Spec is selected before shot list execution.
   - The style decides platform appearance, default image count, ratio, color values, typography, layout, safe areas, fixed component slots, and visual DNA.
   - Explicit user style/count instructions can override the default.

3. Style Reference images are QA baselines, not generation inputs.
   - Long-lived reference images live in `assets/style-references/`.
   - Each routed style must have exactly one reference image.
   - Every production Style Spec records its reference under `styleReference.image`; production styles without a machine spec are incomplete.
   - Reference images are used for style drift review and prompt correction only. Ignore their semantic content and any brand watermark presence or position.
   - Canvas size, geometry, slots, and palette values still come from the Style Spec, not from the reference image.

4. Shot list is mandatory.
   - It is the stabilizing artifact between content understanding and image generation.
   - It prevents overstuffed images and repeated ideas.

5. Content expression structure and visual metaphor are separate.
   - Structure organizes information relationships.
   - Metaphor turns abstract content into a concrete scene.

6. Brand Plugin is style-defaulted, user-overridable, and slot-bound.
   - Brand enablement and assets live in `references/brand.md`.
   - Brand assets live in `assets/brand/`.
   - The selected Style Spec controls brand placement and size.
   - Every production Style Spec defines an enabled top-right brand slot and matching reserved area.
   - Enablement resolves from an explicit user override, then `brandPolicy.defaultEnabled`, then legacy default `true`.
   - Missing overlay capability blocks only branded delivery; disabling branding delivers the accepted model raster directly.
   - Model generation must not draw brand logos.

7. Generation backend resolution is explicit and preflighted.
   - Valid backend kinds are a runtime-native image tool and an already-configured API image backend.
   - A configured API backend is execution infrastructure, not another image-generation skill.
   - An explicit user statement that the environment already has an API backend is authoritative; do not redirect that user to public API-key setup.
   - Backend labels may describe an API dialect rather than the service operator, so endpoint and model availability come from active configuration and live metadata checks.
   - Missing shell variables do not prove that application-managed credentials are absent.
   - Child processes do not inherit parent tools, credentials, endpoints, or image capability by assumption.
   - `references/generation-backends.md` owns backend resolution, secret safety, dynamic model checks, first-image canary behavior, output geometry, retry separation, and failure codes.
   - `references/gpt-image-2-geometry.spec.json` maps supported Style Spec ratios to legal request dimensions; request size, design coordinates, and native delivery pixels are separate contracts.
   - `scripts/resolve-generation-geometry.mjs` validates that mapping before generation, so built-in styles never require a user size choice.
   - Other image skills are not part of the default route.
   - HTML/CSS rendering is not the main path for this skill.
   - `scripts/apply-brand-overlay.mjs` maps the brand slot onto an accepted source and preserves that source's width and height; it runs only when branding is enabled.
   - The finalizer loads vendored `@resvg/resvg-wasm@2.6.2` in-process under Node.js 22+; it needs no runtime `npm install`, native SVG renderer, network access, or API key.
   - If Node.js 22+ or the vendored renderer is unavailable, use the brand-overlay blocker only when branding is enabled.

## Skill Folder Structure

```text
post-illustration-images/
  SKILL.md
  agents/
    openai.yaml
  assets/
    brand/
      tranfu-logo-reference.svg
    style-references/
      wechat-doodle.png
      xhs-cream-paper.png
      xhs-explainer-notebook.png
      xhs-orange-card.png
      zhihu-tech.png
  scripts/
    apply-brand-overlay.mjs
    generate-style-index.mjs
    install-style-bundle.mjs
    resolve-brand-policy.mjs
    resolve-generation-geometry.mjs
    test-brand-overlay.mjs
    validate-style-bundle.mjs
    vendor-resvg-wasm.mjs
  vendor/
    resvg-wasm/
      index.js
      index_bg.wasm
      LICENSE
      VERSION
      SOURCE.md
      SHA256SUMS
  references/
    brand.md
    content-structures.md
    generation-backends.md
    gpt-image-2-geometry.spec.json
    product-design.md
    prompt-compiler.md
    qa-checklist.md
    style-bundle-contract.md
    style-index.md
    style-registry.json
    styles/
      wechat-style-doodle.md
      wechat-style-doodle.spec.json
      xhs-style-cream-paper.md
      xhs-style-cream-paper.spec.json
      xhs-style-explainer-notebook.md
      xhs-style-explainer-notebook.spec.json
      xhs-style-orange-card.md
      xhs-style-orange-card.spec.json
      zhihu-style-title.md
      zhihu-style-title.spec.json
      <visual-builder-style-id>.provenance.json
```

## Default Output Contract

Generated images should be saved in the user's current project, not inside the skill folder:

```text
post-illustration-output/<content-slug>/
  shot-list.md
  prompts/
    01-topic.md
    02-topic.md
  images/
    unbranded/
      01-topic.png
      02-topic.png
    branded/
      01-topic.<png-or-required-export-ext>
      02-topic.<png-or-required-export-ext>
  manifest.md
```

When Brand Plugin resolves disabled, save the accepted backend raster under `images/` with its native or required export extension. Otherwise the branded artifact is the production deliverable and the same-dimension unbranded PNG is retained as its source.

`manifest.md` records:

- File
- Platform and known publishing path, or `null`
- Style Spec
- Machine Spec path
- Verified generation backend kind, adapter, endpoint source, API dialect when relevant, model preference/source, resolved model, and resolution note
- Verified model geometry profile, requested dimensions, and target aspect ratio
- Credential/model preflight, cleanup-plan, and final cleanup status without secret values
- Brand Plugin default, user override, policy source, and resolved enabled/disabled state
- Flat bundle-level `brand_overlay_renderer`: `resvg-wasm@2.6.2` when used, otherwise `null`
- Shot list path
- Prompt path
- Sequence or placement
- Core meaning
- Content expression structure
- Visual metaphor
- Content QA status
- Style Spec QA status
- Brand Plugin QA status, if enabled
- Brand overlay status: `applied`, `disabled-by-user`, or `disabled-by-style-default`
- Generation and geometry attempts, requested/source/delivery dimensions, source/delivery formats and bytes, optional hard-limit exporter, native-output status, and ordered post-generation actions

## Extension Rules

To add a new visual style:

1. Build an approved `StyleCandidateBundle` outside this skill.
2. Run `node scripts/validate-style-bundle.mjs --bundle <candidate-dir>`.
3. Run `node scripts/install-style-bundle.mjs --bundle <candidate-dir>` only after explicit human approval.
4. The installer copies the style Markdown, machine spec, provenance, and neutral reference image, updates `style-registry.json`, regenerates `style-index.md`, and refuses duplicate IDs.
5. Never hand-edit the generated style index or copy source reference images into the skill.

To change brand behavior:

1. Edit `references/brand.md`.
2. Replace or add assets under `assets/brand/`.
3. Do not put platform coordinates, colors, or dimensions in `references/brand.md`.
4. Put placement and size in the selected Style Spec.
5. Put per-style default enablement in `brandPolicy`; keep user overrides allowed.

To improve quality:

1. Add new recurring failures to `references/qa-checklist.md`.
2. Add new reusable structures to `references/content-structures.md`.
3. Add new backend integration failures to `references/generation-backends.md`; do not mix them into visual QA retries.
4. Avoid writing one-off user preferences as universal rules.

## Acceptance Criteria

The skill is working when a fresh agent can:

- Infer or ask for platform.
- Resolve one verified generation backend before production without confusing tool availability, credential storage, endpoint routing, and model availability.
- Respect an asserted configured API backend without starting public key provisioning.
- Read source content before choosing style.
- Select one suite-level Style Spec.
- Resolve one Style Reference image for the selected style and use it only for QA/failure review.
- Produce a shot list before generation.
- Generate one image prompt per shot.
- Save `shot-list.md` and `prompts/*.md` before generation.
- Generate and inspect image 1 as a canary before continuing the suite.
- Resolve legal `gpt-image-2` request dimensions automatically for every built-in style.
- Record requested, source, and delivery dimensions; preserve sources within ratio tolerance and reject sources outside tolerance without resize, crop, padding, rotation, stretch, or upscale.
- Keep delivery dimensions equal to source dimensions, including after brand overlay.
- Apply branding locally with vendored `resvg-wasm@2.6.2` under Node.js 22+ and no runtime package installation or API key.
- Keep the image set visually consistent.
- Keep model-drawn brand and page-number badges out of generated images.
- Resolve Brand Plugin state from the user override and selected Style Spec, then apply the overlay only when enabled and only through the selected top-right slot.
- Ignore Style Reference watermark presence and position when deciding production branding.
- Save outputs with a manifest.
- Explain QA results and fallback decisions.
