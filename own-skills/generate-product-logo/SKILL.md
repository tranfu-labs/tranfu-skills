---
name: generate-product-logo
description: Generate product-aware logo concepts in a minimalist 3D frosted-glass style. Use when the user asks to create, explore, refine, or export a product logo, app icon, browser icon, favicon, social-preview logo, or brand mark. Ask for missing product context before image generation. Do NOT trigger when the user only wants generic image generation, non-logo brand copy, trademark/legal clearance, vectorization of an existing final logo, or unrelated UI design.
version: 0.1.0
author: 06666666
updated_at: 2026-06-15
origin: own
---

# Generate Product Logo

Create logo concepts from product context first, then render them in a reusable premium style: a minimal 3D frosted-glass mark, usually built around a dark glass base and a vivid red directional symbol.

Before generating, read `references/style-and-workflow.md`. If the task asks to match the bundled style closely, inspect the reference images in `assets/`.

## Product Gate

Do not generate a logo until the product has enough shape to guide the mark.

Minimum required product information:

- product name or working name;
- product category and core function;
- target user or buyer;
- main product motion, such as upload, download, relay, routing, sync, growth, protection, automation, review, or management;
- intended logo usage, such as app icon, browser icon, website header, social preview, product badge, or all of these.

If any of the above is missing, ask one concise question that collects the missing pieces. Do not ask for visual style first; this skill already owns the default style. Example:

```text
先补一下产品信息：产品叫什么、做什么、给谁用、核心动作是什么（比如路由/同步/上传/下载/管理），以及 Logo 主要用在浏览器图标、官网还是社交预览？
```

Optional inputs to respect when provided:

- brand colors;
- existing logo or reference image;
- must-avoid symbols;
- required arrow direction or product metaphor;
- desired number of concepts;
- whether the result should continue into favicon, app icon, social preview, or page head assets.

## Workflow

1. Confirm the product gate is satisfied.
2. Translate the product shape into 2-4 logo directions.
3. Use the base-plus-directional-symbol style unless the user asks for another metaphor.
4. Generate square 1:1 image concepts with image generation.
5. Save project-bound outputs into a durable workspace path, usually `outputs/logos/<product-slug>/<round-name>/`.
6. Verify every generated candidate is a real image and square.
7. Create a comparison contact sheet and a small-size preview, ideally at 32px.
8. Recommend the strongest candidate based on product fit and small-size recognition.
9. Wait for selection before producing final browser icons, social-preview images, or implementation changes.

## Examples

<example>
User asks: "Create logo options for VpnHub, a VPN smart-routing admin platform for operators. The core motion is routing traffic through a stable gateway, and the logo will be used as a browser icon and website header."

Expected behavior: treat the product gate as satisfied, plan 3-4 square glass-mark directions, generate icon-first candidates, save them under a durable workspace path, create a contact sheet plus 32px preview, then recommend the strongest option based on product fit and small-size recognition.
</example>

<bad-example>
WRONG: Trigger this skill for "write a premium slogan for my company" or "make a generic red 3D image".

Reason: brand copy and generic image generation are outside this skill; it is only for product logo, icon, favicon, social-preview logo, or brand-mark work.
</bad-example>

## Failure Paths

- If required product context is missing, ask one concise product-gate question and stop before image generation.
- If image generation is unavailable or fails, report the blocker and do not describe nonexistent outputs.
- If generated candidates are not real square images, regenerate or mark them unusable before making a recommendation.
- If bundled reference files are missing, continue from the written style contract and mention that the visual references could not be inspected.

## Direction Rules

Choose the symbol from the product's behavior, not from decoration.

- Use an upward arrow for growth, publishing, dispatch, routing out, deployment, acceleration, or capacity increase.
- Use a downward arrow for intake, import, receive, download, ingestion, syncing in, or settlement.
- Use paired up/down marks when the product clearly handles bidirectional transfer.
- Replace or adapt the arrow only when another product motion is more accurate, but preserve the same simple glass-base grammar.
- Keep the mark brand-like. Avoid generic upload/download UI icon shapes unless the product itself is explicitly about upload/download.

## Generation Defaults

Default to 3-4 options for exploration. If the user has selected a route and asks for one change, generate one focused variant unless comparison is useful.

Prompt every option as:

- square 1:1 canvas;
- white or very light background;
- centered mark with generous padding;
- dark graphite/black frosted-glass base;
- vivid red translucent glass primary symbol;
- subtle bevel, refraction, soft highlight, restrained 3D depth;
- no wordmark, no readable text, no letters, no Apple logo, no extra scene.

## Handoff

Show the generated comparison image and the small-size preview when possible. Keep the user-facing summary simple:

- what was made;
- which option is strongest and why;
- where the files were saved;
- what selection is needed next.

Do not claim the generated raster image is a final production vector or trademark-cleared logo. After selection, offer the next concrete production step: final polish, favicon/app-icon exports, social preview, or site integration.
