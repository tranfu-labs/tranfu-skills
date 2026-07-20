---
description: Convert one Markdown article into validated red-and-white WeChat HTML plus a browser preview with one-click copying.
prompt_examples:
  - prompt: Format this Markdown article for a WeChat Official Account.
    scene: Format pasted Markdown
  - prompt: Turn article.md into validated WeChat HTML and a copyable preview.
    scene: Format a Markdown file
---

# format-content

Transform one finished Markdown article into copy-ready WeChat HTML without changing what the article says.

## When to use it

**Format pasted Markdown**

I have a complete article written as Markdown in the conversation and want it laid out in the fixed red-and-white WeChat theme.

**Format a Markdown file**

I have exactly one readable `.md` file and need both a clean inline-styled fragment and a browser preview with a copy button.

**Not for**

Do not use it for Word, PDF, TXT, rich text, unstructured prose, another theme, an ordinary webpage, substantive rewriting, draft creation, or publishing through WeChat APIs.

## What it produces

**The clean fragment must pass with zero errors and zero warnings before the preview is created.**

- **Clean HTML**: writes `{stem}_排版_红白色系(red-white).html` as one outer `<section>` with inline styles only.
- **Browser preview**: writes `{stem}_排版_红白色系(red-white)_预览.html` with the validated fragment embedded unchanged and a copy button.
- **Content preservation**: keeps paragraphs, lists, tables, code, media, links, headings, and factual meaning; only the article's top-level title may stay outside the body.
- **Fixed design system**: uses the bundled red-and-white theme and common components rather than choosing or inventing another visual style.
- **Validation loop**: runs the bundled validator until no `ERROR` or `WARNING` remains, then verifies the wrapped preview.
- **Never does**: it does not call a WeChat API, create a draft, publish, rewrite claims, or write outputs beside the source file.

## Prerequisites and boundaries

**Prerequisites**

Provide one non-empty Markdown source, either pasted content or one readable `.md` file. The theme references, validator, preview wrapper, and preview template bundled with the skill must all exist.

**Output location**

Both files are always written to the agent's current working directory. A source file in another directory does not change that destination.

**Accepted and rejected inputs**

- Accepted: one structured Markdown article with an unambiguous source.
- Rejected: `.doc`, `.docx`, `.pdf`, `.txt`, HTML, rich text, ambiguous multiple sources, or prose that would require inventing Markdown structure.
- Missing author or media details remain explicit placeholders or omitted rows; they are never fabricated.

**Subtle boundary**

Formatting may choose components and reading rhythm, but it must not add facts, captions, links, authors, calls to action, or other substantive content.
