---
name: format-content
display_name: WeChat Article Formatting
display_name_zh: 微信文章排版
description: "Format Markdown text or a readable .md file as WeChat Official Account HTML with the fixed red-and-white theme, producing a validated clean section fragment and a browser preview with a copy button. Use when the user asks for 公众号排版, 微信排版, WeChat Official Account formatting, or Markdown-to-WeChat HTML and supplies Markdown. Do NOT trigger when the request concerns Word, PDF, TXT, rich text, unstructured prose, other themes, ordinary web pages, substantive rewriting, or WeChat publishing/API operations."
---

# Format Content

Convert one Markdown article into WeChat-compatible inline-styled HTML with the bundled red-and-white component library. Preserve the article's substantive content and produce only the two contracted files.

## Orchestrated provider route

Before applying the standalone scope guard, inspect the task input for any of these provider markers:

- `contract: content-production-provider/v1`
- `capability: wechat_layout`
- `provider_contract: wechat-layout-v1`
- `content-production-provider: wechat-layout-v1`

If any marker is present, do not use the standalone workflow or filenames. A complete packet must use
[references/orchestrated-provider.md](references/orchestrated-provider.md) and
`scripts/provider_contract.py`. Partial, malformed, or conflicting provider markers return structured
`BLOCKED`; they never fall back to standalone output. Provider mode writes only its authorized staging
candidate and canonical result. The orchestrator owns promotion into the publish package and owns
`layout-result.json`.

## Scope guard

- Trigger for requests such as “公众号排版”, “微信排版”, “把这篇 Markdown 排成公众号 HTML”, or “format this Markdown for a WeChat Official Account”.
- Accept either Markdown supplied directly in the request or one readable file whose extension is exactly `.md`.
- Do not accept `.doc`, `.docx`, `.pdf`, `.txt`, HTML/rich text, or unstructured prose. Do not normalize those formats into Markdown; ask the user to provide Markdown instead.
- Use only `<SKILL_ROOT>/references/theme-red-white.md`. Do not select, recommend, create, or mix themes.
- Do not rewrite or omit substantive content. Do not create a normal website, publish an article, create a WeChat draft, or call any WeChat API.

## Guarded procedure

CREATE A TODO LIST FOR THE TASKS BELOW, with one TODO for each numbered stage, then execute stages 1–8 in order.

### 1. Establish paths and validate the input

Treat the installed directory containing this file as `SKILL_ROOT` and the Agent's current working directory as `WORKDIR`. Keep them separate: resolve bundled resources under `SKILL_ROOT`, and always write both outputs under `WORKDIR`, regardless of the source file's directory.

Require exactly one Markdown source:

- For a file, confirm it exists, is readable, is non-empty, and ends in `.md`. Set `stem` to its filename without the final `.md`.
- For Markdown pasted into the request, confirm the user supplied it as Markdown rather than asking the Agent to infer structure from plain prose. Set `stem` to the deterministic default `article`; do not ask the user to name the output.
- If the input is missing, unreadable, empty, unsupported, or ambiguous between multiple sources, stop before creating files and request the needed Markdown or source choice.

Set the exact output paths:

```text
CLEAN_PATH   = WORKDIR/{stem}_排版_红白色系(red-white).html
PREVIEW_PATH = WORKDIR/{stem}_排版_红白色系(red-white)_预览.html
```

### 2. Load and guard the bundled assets

Read these two files before generating HTML:

1. `<SKILL_ROOT>/references/theme-red-white.md` — authoritative design variables, theme components, full article skeleton, article-type recipes, and Markdown mapping.
2. `<SKILL_ROOT>/references/common-components.md` — authoritative code, media/GIF, pending-media, and small-label components.

Also confirm these files exist before assembly:

- `<SKILL_ROOT>/scripts/validate_gzh_html.py`
- `<SKILL_ROOT>/scripts/wrap_preview.py`
- `<SKILL_ROOT>/assets/preview-template.html`

Stop and report the missing path if any required asset is unavailable. Copy component HTML from the references and fill its slots; do not recreate components from memory. Use a theme component whenever it has the required semantic role, and use a common component only when the theme library lacks that role.

### 3. Parse the Markdown without changing its meaning

Build a complete ordered inventory before assembly:

| Markdown | Interpretation |
|---|---|
| `# title` or frontmatter `title` | Article title; keep it out of the body because WeChat sets it separately |
| Opening `> quote` | Opening quotation/introduction card |
| `## heading` | Numbered chapter |
| `### heading` | Unnumbered subsection |
| Paragraphs and `**bold**`, `==highlight==`, `<u>underline</u>`/`++underline++`, `~~strike~~` | Body and inline semantics |
| Later `> quote` | Quotation, core statement, or aside according to meaning |
| Fenced code and inline code | Code; preserve characters and indentation |
| Ordered/unordered lists, thematic breaks, and Markdown tables | Structured content |
| `![alt](source)`, including `.gif` | Media; preserve source and real alt text |
| `【插入…】` or an explicit pending-media note | Centered pending-media component |

Account for every original paragraph, list item, table row, code block, image/GIF, and link. The body may omit the `#` title only. Never invent facts, image captions, URLs, author names, or missing media.

Classify the dominant article type, allowing a secondary type only when genuinely mixed:

- many steps/commands → tutorial or operation guide;
- many parallel tools/items → roundup or tool list;
- quotations and personal narrative → interview or profile;
- numbers and comparisons → data review or report;
- argued conclusions → opinion or deep analysis;
- reflective narrative → life or emotional essay;
- staged implementation and outcomes → case study.

### 4. Select the fixed-theme recipe

Use the matching row in `<SKILL_ROOT>/references/theme-red-white.md` under “文章类型 → 组件组合配方”. Treat its core components as the article's visual rhythm. Add components required by the Markdown mapping, but use no more than three kinds of optional embellishment components across the article.

Apply the red-white visual hierarchy:

- strong red anchors: at most five across the article;
- pale-pink underline marks: one to three important phrases of 4–15 Chinese characters per meaningful body paragraph, with no mark when a paragraph has no real focal phrase;
- containers: only for quotations, notes, warnings, structured data, or comparable semantics.

Do not use a four-sided dashed border for emphasis. The centered pending-media component is the only dashed-border exception.

### 5. Assemble the clean section fragment

Follow the full skeleton in `<SKILL_ROOT>/references/theme-red-white.md` and its mapping table. The clean file must contain one outer red-white `<section>…</section>` fragment and no `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`, preview toolbar, button, or script.

Preserve these upstream behaviors:

1. Put the introduction card first. Use the opening blockquote when present; otherwise select an existing sentence that expresses the article's core view without adding a new claim. Highlight its key phrase. Remove the attribution row when the author is unknown.
2. Put introductory paragraphs after the card. With at least three `##` chapters, add the guide component before chapter one and show exactly three selected core takeaways.
3. Number `##` chapters in source order as `01`, `02`, `03`… and derive a short relevant English label. Use `∞` with `THE END` or `EPILOGUE` only when the final chapter is genuinely a conclusion or summary. Render `###` with the subsection component, never as a numbered chapter.
4. Map inline semantics and block structures through the theme reference. Use common 1a/1b for fenced code, theme 14 for standard images, common 2b for GIFs, and common 2c for pending media. Render each code line as its own `<p style="margin:0">` and never use `white-space:pre`; keep code punctuation, identifiers, and visual indentation unchanged. Keep image sources unchanged, omit captions for empty alt text, and use `max-width:100%;height:auto;display:block;margin:0 auto` rather than forcing small images to full width.
5. Normalize Chinese prose punctuation to full-width punctuation while preserving code, URLs, identifiers, and English proper nouns. Wrap every text node in `<span leaf="">`; keep all styles inline and all decorative empty elements populated exactly as the theme reference requires.
6. End with exactly one END divider and one author/CTA footer. Reuse an existing final author signature instead of duplicating it; otherwise fill author details supplied by the user or frontmatter. If the author is still unknown, keep `{{作者名}}` and `{{简介}}` in the author line and tell the user to replace them. Fill every other component template slot, remove any image row whose real URL is unavailable, and merge an existing like/share CTA into this single footer.

Never use `<style>`, `<script>`, `<div>`, `class`, `id`, external CSS/fonts, CSS variables, `position:fixed/absolute/sticky`, `float`, `@media`, `@keyframes`, `@import`, or `display:grid` in the clean fragment.

### 6. Write and validate the clean file

Write only the section fragment to `CLEAN_PATH`, then run the validator with resolved absolute paths:

```sh
python3 "<SKILL_ROOT>/scripts/validate_gzh_html.py" "<CLEAN_PATH>"
```

Inspect both the exit status and printed diagnostics. A zero exit status is not sufficient because warning-only runs also exit zero. Completion requires no printed `ERROR` and no printed `WARNING`, ending in `✅ 完全合规，可直接粘贴到公众号编辑器`.

For any error or warning, return to assembly, correct the clean file, and rerun the validator. Do not suppress diagnostics, weaken the validator, or create the preview while either count is nonzero. If the clean file cannot reach zero errors and zero warnings, stop, leave the clean file for diagnosis, report the latest diagnostics, and do not claim completion.

### 7. Wrap the preview only after clean validation

After the clean fragment reaches zero errors and zero warnings, run:

```sh
python3 "<SKILL_ROOT>/scripts/wrap_preview.py" "<CLEAN_PATH>" "<PREVIEW_PATH>"
```

The preview is a complete browser document and may contain the template's style, script, IDs, and copy button outside the copy target. Never run the clean-fragment validator against the preview. Confirm the wrapper succeeded and that, after trimming outer whitespace only, the clean fragment appears byte-for-byte unchanged exactly once inside the preview's `#gzh-content` copy target.

### 8. Verify observable completion

Completion means all of the following are observable:

- `CLEAN_PATH` exists with the exact name and contains only the clean section fragment.
- Clean validation completed with zero errors and zero warnings.
- `PREVIEW_PATH` exists with the exact name, contains the clean fragment once unchanged after outer-whitespace normalization, and includes the “复制到公众号” button.
- No WeChat API, draft creation, or publishing action occurred.

Report both absolute output paths, the zero-error/zero-warning result, and this instruction: open the preview, click “复制到公众号”, then paste into the WeChat editor. Also report the clean file as the manual-copy fallback, call out unresolved author or media placeholders, and end the procedure.

## Failure exits

| Condition | Required exit |
|---|---|
| No Markdown, unreadable/empty `.md`, or multiple ambiguous sources | Ask for the missing input or choice; create nothing |
| Unsupported format, unstructured plain text, another theme, ordinary webpage, rewriting, or publishing request | State the supported Markdown + red-white formatting scope; do not convert or publish |
| Required bundled file missing | Report the exact missing path; create no deliverable |
| Validation still reports an error or warning | Do not wrap the preview or claim completion; report diagnostics |
| Preview wrapping or unchanged-embedding verification fails | Keep the validated clean file, report the failure, and do not claim both deliverables |

<example>
Current working directory: `/workspace`

User: “请把 `/work/article.md` 排成微信公众号 HTML。”

Result: read the Markdown from `/work/article.md`, use only the red-white libraries under `SKILL_ROOT`, write `/workspace/article_排版_红白色系(red-white).html`, validate it to zero errors and zero warnings, then write `/workspace/article_排版_红白色系(red-white)_预览.html` and report both paths. Do not write either output beside the source file.
</example>

<bad-example>
User: “把 `report.docx` 自动选个主题排版，再直接发布到公众号。”

WRONG: convert the Word file, choose or generate a theme, and call a publishing API. Correct: create nothing and ask for Markdown, while explaining that this Skill uses only the fixed red-white theme and never publishes.
</bad-example>
