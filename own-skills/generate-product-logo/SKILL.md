---
name: generate-product-logo
description: Generate product-aware logo design rules, visual style directions, and logo/icon concepts. Use when the user asks to create, explore, refine, or export a product logo, app icon, browser icon, favicon, social-preview logo, brand mark, or logo style guide. Also match Chinese requests like "做个/设计 Logo", "做 app icon/favicon", "品牌标记", or "Logo 设计规范". Ask for missing product context before visual work. Do NOT trigger when the user only wants generic image generation, non-logo brand copy, trademark/legal clearance, vectorization of an existing final logo, or unrelated UI design.
version: 0.1.0
author: 06666666
updated_at: 2026-06-15
origin: own
---

# Generate Product Logo

Create product-specific logo design rules first, then generate logo or icon concepts that follow those rules. This skill owns the process for turning product context into a reusable visual style direction; it does not own one fixed aesthetic.

Before generating, read `references/style-and-workflow.md`. If the user provides brand assets or reference images, inspect them and use them as inputs to the style direction.

## Product Gate

CRITICAL: MUST NOT generate any logo until the product gate is satisfied; if any required field is missing, ask one product-gate question and STOP.

Minimum required product information:

- product name or working name;
- product category and core function;
- target user or buyer;
- main product motion, such as upload, download, relay, routing, sync, growth, protection, automation, review, or management;
- intended logo usage, such as app icon, browser icon, website header, social preview, product badge, or all of these.

If any of the above is missing, ask one concise question that collects the missing pieces. Do not ask for visual style first; derive the style direction from product context unless the user provides explicit visual constraints. Example:

```text
先补一下产品信息：产品叫什么、做什么、给谁用、核心动作是什么（比如路由/同步/上传/下载/管理），以及 Logo 主要用在浏览器图标、官网还是社交预览？
```

Optional inputs to respect when provided:

- brand colors;
- existing logo or reference image;
- must-avoid symbols;
- required product metaphor, symbol family, or style direction;
- desired number of concepts;
- whether the result should continue into favicon, app icon, social preview, or page head assets.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW (one TODO per step):

1. Confirm the product gate is satisfied. If it is not satisfied, follow the Product Gate question rule and STOP before image generation.
2. Derive a short logo design specification: audience fit, brand personality, symbol logic, shape language, color/material direction, composition rules, and must-avoid choices.
3. Translate the design specification into 3-4 distinct logo directions.
4. Generate square 1:1 image concepts with image generation, unless the user explicitly asks for a text-only style guide.
5. Save project-bound outputs into a durable workspace path, usually `outputs/logos/<product-slug>/<round-name>/`.
6. Verify every generated candidate is a real image and square.
7. MUST create a comparison contact sheet and a 32px nearest-neighbor preview for generated image concepts.
8. Recommend the strongest candidate based on product fit, style-spec alignment, and small-size recognition.
9. Wait for selection before producing final browser icons, social-preview images, page-head assets, or implementation changes.

## Examples

<example>
User asks: "Create logo options for VpnHub, a VPN smart-routing admin platform for operators. The core motion is routing traffic through a stable gateway, and the logo will be used as a browser icon and website header."

Expected behavior: treat the product gate as satisfied, write a compact logo design specification, plan 3-4 distinct icon-first directions, generate candidates that follow the specification, save them under a durable workspace path, create a contact sheet plus 32px preview, then recommend the strongest option based on product fit and small-size recognition.
</example>

<bad-example>
WRONG: Trigger this skill for "write a premium slogan for my company" or "make a cool generic image".

Reason: brand copy and generic image generation are outside this skill; it is only for product logo, icon, favicon, social-preview logo, or brand-mark work.
</bad-example>

## Failure Paths

- If required product context is missing, ask one concise product-gate question and stop before image generation.
- If image generation is unavailable or fails, report the blocker and do not describe nonexistent outputs.
- If generated candidates are not real square images, regenerate or mark them unusable before making a recommendation.
- If reference files or user-provided assets are missing, continue from the written design specification and mention which inputs could not be inspected.

## Neighbor Workflows

- Generic image generation without logo or icon intent belongs to the active image-generation workflow, not this skill.
- Non-logo brand copy belongs to a copywriting or brand-messaging workflow, not this skill.
- Unrelated UI or page design should use `visual-pipeline`, `tranfu-website-design`, or the active product-design workflow.
- Trademark clearance, legal review, and production vectorization require specialist review or a dedicated vector/logo production workflow.

## Style Direction Rules

Choose the visual system from the product's behavior, audience, and usage context, not from decoration.

- State the design logic before generation: what the mark should make users feel, what it should signal, and what it must avoid.
- Pick a symbol family from the product motion, domain, or buyer expectation. Do not default to generic direction symbols, shields, letters, or abstract shapes unless they fit the product.
- Pick shape language, material, color, contrast, and depth from the intended brand personality and usage surface.
- Keep the mark brand-like. Avoid generic UI icon shapes unless the product itself is explicitly about that UI action.
- Preserve small-size recognition over illustration detail.

## Generation Defaults

Default to 3-4 options for exploration. Each option should express a different design direction, not minor color swaps. If the user has selected a route and asks for one change, generate one focused variant unless comparison is useful.

Prompt every option as:

- square 1:1 canvas;
- neutral background that does not compete with the mark;
- centered mark with generous padding;
- style direction derived from the design specification;
- color palette derived from product context or provided brand assets;
- material and depth choices appropriate to the chosen direction;
- no wordmark, no readable text, no letters, no Apple logo, no extra scene.

## Handoff

Show the generated comparison image and the small-size preview when possible. Keep the user-facing summary simple:

- what was made;
- which option is strongest and why;
- where the files were saved;
- what selection is needed next.

MUST NEVER claim the generated raster image is a production-ready vector or a trademark-cleared logo. After selection, offer the next concrete production step: final polish, favicon/app-icon exports, social preview, or site integration.
