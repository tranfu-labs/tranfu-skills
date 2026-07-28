---
description: Formats Markdown as validated WeChat Official Account HTML with the fixed red-and-white theme.
prompt_examples:
  - prompt: Format this Markdown for a WeChat Official Account article.
    scene: Format Markdown
  - prompt: Create the WeChat HTML preview for this .md file.
    scene: Create preview
  - prompt: Turn this final article into the fixed red-and-white WeChat layout.
    scene: Apply theme
---

# WeChat Article Formatting

Convert a clean Markdown article into a validated WeChat section fragment and preview.

## When to use it

**Format Markdown**

When I have final Markdown and need it formatted for WeChat Official Accounts, I want the fixed theme applied without rewriting.

**Create preview**

When I need a browser preview with a copy button, I want the clean fragment validated first.

**Apply theme**

When the content-production package reaches layout, this skill handles the WeChat formatting provider step.

**Not for**

Do not use it for Word, PDF, TXT, rich text, other themes, rewriting, web pages, publishing, or WeChat API operations.

## What it produces

**The skill keeps its scope narrow: it prepares local deliverables and never performs platform publishing.**

- **Clean HTML**: Writes a validated WeChat section fragment.
- **Preview page**: Wraps the clean fragment only after validation and provides a copy-friendly preview.
- **No rewriting**: Preserves the Markdown meaning and does not publish to WeChat.
- **Never does**: It does not merge workflow stages, publish content, or invent missing user approvals.

## Prerequisites & boundaries

**Prerequisites**

Provide readable Markdown text or a local .md file. The request must fit the fixed WeChat Official Account theme.

**Neighboring skills**

| Action | Use |
|---|---|
| Proofread copy | **proofread-content** |
| Create cover | **wechat-sketch-cover** |
| Full package | **content-production** |

**Out of scope**

- Requests that belong to another named skill should be routed there instead.
- Missing or unreadable inputs should stop the workflow rather than produce guessed content.
- Platform publishing, account login, scheduling, and post-publication analytics stay outside this skill.

**Subtle boundaries**

- A complete content-production run may call this skill as a provider, but this skill still owns only its own contracted output.
- Standalone use should leave unrelated project files untouched and report only the files or findings it actually produced.
