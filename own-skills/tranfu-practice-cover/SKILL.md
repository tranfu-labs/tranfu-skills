---
name: tranfu-practice-cover
display_name: TranFu Practice Cover
display_name_zh: TranFu 实践封面
description: >-
  Generate, revise, typeset, optimize, and visually verify TranFu `/practice`
  article-cover images with a deterministic left-title/right-subject layout.
  Trigger for requests such as “生成实践页封面”, “按 TranFu 风格重做实践配图”,
  “给封面加入左侧标题”, or reviewing whether practice covers match the local
  red-white glass style. Do NOT trigger for practice-page Hero images, generic
  article covers outside TranFu, logos, icon sets, posters, slide covers,
  full-page UI design, or image-only edits unrelated to practice covers.
version: 0.1.0
author: chuanye312-coder
updated_at: 2026-07-30
origin: own
---

# TranFu Practice Cover

Create a versioned 16:9 article cover whose title is exact at thumbnail size and
whose topic-specific subject remains compact on the right.

## Required resources

MUST read [references/workflow.md](references/workflow.md) completely before
generating or revising covers.

Use:

- `assets/layout-reference.png` only as the composition, scale, material, and
  whitespace reference. NEVER copy its topic-specific chat or code symbols.
- `assets/article-input.yaml` as the input contract.
- The runtime `imagegen` skill for new raster backgrounds or image edits.
- The installed `render-cover-title` skill for MiSans title rendering and
  deterministic layout validation.

If `imagegen` is unavailable, report the missing capability and stop before
claiming that a cover was created. If `render-cover-title` is unavailable,
generate no final titled asset; return the accepted no-text background and name
the missing dependency.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW:

1. Validate the request and source files.
2. Plan the cover title and protected technical terms.
3. Generate a no-text right-side subject.
4. Inspect and, when necessary, regenerate the background.
5. Render and validate the MiSans title.
6. Export versioned PNG, layout manifest, and optimized JPG.
7. Update the target page only when the user requested integration.
8. Build and visually verify integrated pages.
9. Report artifacts, checks, and residual risks.

### 1. Validate inputs

Collect:

- full article title;
- article topic or source summary;
- output directory;
- current asset version, if any;
- reference images, if provided;
- whether page integration is requested.

If the article title or topic is missing, ask only for the missing value and
stop. If the output directory is unavailable, stop and report the exact path.
NEVER overwrite an existing asset; choose the next version number.

### 2. Plan the title

Compress the full title into one to three faithful lines. Record:

- exact line breaks;
- protected product names, filenames, and technical terms;
- one optional inline accent;
- optional full red lines.

Keep technical spelling and casing exact, including terms such as
`AGENTS.md`, `Git Worktree`, `OpenClaw`, and `Sketch-to-Game`. NEVER ask the
image model to render these terms.

### 3. Generate the background

Use image generation only for a text-free background:

- canvas: 16:9;
- left 42%–46%: calm white or pale-blush title field;
- right 48%–50%: one compact topic-specific subject;
- subject: one core object plus two or three supporting objects;
- style: high-key white studio, `#E63A46`, clear glass, polished acrylic;
- density: comparable to `assets/layout-reference.png`;
- no text, letters, numbers, logos, watermarks, fake UI, or unrelated objects.

When two references exist, state their roles explicitly:

```text
Use the FIRST image only for semantic content and object identity.
Use the SECOND image only for composition, scale, density, lighting,
glass style, and whitespace. Do not copy its topic-specific icons.
```

Avoid repeated robot lineups, generic conveyor pipelines, and dense node
diagrams. Use abstract folders, modules, documents, portals, or other
topic-specific objects when they communicate the subject more directly.

### 4. Inspect the background

Inspect the generated image before title rendering. Regenerate it if any check
fails:

- the subject enters the left title field;
- the subject is visually larger or denser than the layout reference;
- the image contains pseudo-text, logos, or malformed symbols;
- the topic is expressed as a repeated robot lineup or generic pipeline;
- the subject is unreadable at card-thumbnail size;
- adjacent covers reuse the same subject structure.

Do not hide a failed background with cropping, title blocks, or overlays.

### 5. Render and validate the title

Use the `render-cover-title` skill with:

- MiSans only;
- canvas `2048 × 1152`;
- default safe area `x=130`, `y=160`, `width=740`, `height=832`;
- base color `#171717`;
- accent color `#E63A46`;
- every exact technical term passed as a protected token.

Run its layout validator. The final title asset is accepted only when all are
true:

```text
status: ready
single_font_family: true
font_family: MiSans
safe_area_passed: true
protected_token_coverage: 100%
```

If a long English line does not fit, reduce only that line’s font size. NEVER
distort glyphs, change spelling, or allow title/subject overlap.

### 6. Export

Produce:

```text
article-name-vN.png
article-name-vN-layout.json
article-name-vN.jpg
```

Export JPG at quality 84–88 and keep it below 500KB when visually acceptable.
Preserve the PNG and manifest as the lossless source and validation record.

### 7. Integrate only when requested

If the user asked for page integration:

1. update only the intended image import;
2. preserve unrelated working-tree changes;
3. run the project build;
4. open the actual practice page;
5. verify image load, `object-cover` cropping, category-badge overlap, desktop
   card readability, and narrow viewport loading.

If integration was not requested, do not edit application code.

### 8. Finish

Return:

```yaml
result: created | updated | blocked
assets:
  png: <absolute path>
  manifest: <absolute path>
  jpg: <absolute path>
title_lines: [<line 1>, <line 2>, <line 3>]
protected_terms: [<term>]
checks:
  background_inspection: passed | failed
  layout_validation: passed | failed | skipped
  build: passed | failed | skipped
  browser_check: passed | failed | skipped
remaining_risks: []
```

## Examples

<example>
User: “按 TranFu 风格为《为什么默认工作流应该写在 AGENTS.md》生成实践页封面。”

Plan `默认工作流 / AGENTS.md 优先`, protect `AGENTS.md`, generate one compact
rules-document composition on the right, render the title with MiSans, validate
the safe area, and export the next version without overwriting prior assets.
</example>

<example>
User: “这张多 Agent 封面机器人太多，帮我调整。”

Keep the topic, replace the robot lineup with three abstract Worktree folders
and a restrained handoff rail, preserve the left title field, re-render the
exact title, and save a new version.
</example>

<bad-example>
WRONG: Ask the image model to generate `Cursor + Git Worktree` inside the image.

Reason: generated technical text is nondeterministic and may be misspelled.
Generate a no-text background, then render the title with MiSans.
</bad-example>

<bad-example>
WRONG: Reuse the same three-node chat/orchestration/code objects for every
article because they match the reference style.

Reason: the reference controls scale and visual density, not topic identity.
Each cover must use subject objects specific to its article.
</bad-example>
