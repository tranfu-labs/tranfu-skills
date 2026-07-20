---
description: Proofread a finished Simplified Chinese article in three passes, reduce formulaic AI phrasing, and deliver a clean layout-ready draft.
prompt_examples:
  - prompt: Proofread this finished WeChat draft and remove formulaic AI phrasing.
    scene: Polish pasted draft
  - prompt: Proofread article.md in place while preserving every factual value.
    scene: Polish a local file
  - prompt: Keep my voice but make this Xiaohongshu draft read more naturally.
    scene: Preserve author voice
---

# proofread-content

Turn a finished Simplified Chinese draft into clean, natural copy while preserving its facts, position, structure, and author voice.

## When to use it

**Polish pasted draft**

I have a complete self-media article in the conversation and want three editing passes before it moves to layout.

**Polish a local file**

I have one readable UTF-8 `.md` or `.txt` file and authorize an in-place update only after every preservation gate passes.

**Preserve author voice**

I want repetitive or formulaic AI phrasing removed without inventing anecdotes, turning the piece into chatty copy, or changing its platform-appropriate voice.

**Not for**

Do not use it to write from scratch, translate, format, publish, restructure for virality, handle specialist legal or academic text, or evade AI detectors.

## What it produces

**No content is written back until all preservation gates pass.**

- **Three-pass edit**: checks logic and internal consistency, reviews 24 AI-pattern categories in context, then fixes language detail and reading rhythm.
- **Clean draft**: file input is atomically replaced in place; pasted input creates or replaces `proofread-content.md` in the current working directory.
- **Structured result**: the conversation receives one `PROOFREAD_RESULT` with status, platform, output path, gate result, and concise pass summaries.
- **Protected content**: titles, heading structure, facts, numbers, dates, amounts, versions, entities, quotations, links, cases, and Markdown semantics remain intact.
- **Failure safety**: `NEEDS_AUTHOR_INPUT` or `BLOCKED` leaves the existing target byte-for-byte unchanged and removes temporary files.
- **Never does**: it does not create a backup, add facts or calls to action, verify external truth by default, publish, or promise detector evasion.

## Prerequisites and boundaries

**Prerequisites**

Supply one finished Simplified Chinese article, either pasted or as one non-empty UTF-8 `.md` or `.txt` file. The bundled humanization and platform-register references must be readable.

**Supported platforms**

WeChat Official Accounts, Xiaohongshu, Weibo, Zhihu, Toutiao, and a general self-media fallback are supported. An explicitly requested unsupported platform blocks the run.

**Write boundaries**

- File input authorizes atomic replacement of that file after successful gates.
- Pasted input authorizes creation or replacement of only `proofread-content.md` in the current directory.
- Conflicting facts, unresolved placeholders, or missing author intent stop the write and produce specific questions.

**Subtle boundary**

`READY_FOR_LAYOUT` means the draft is editorially ready under this workflow. It does not certify external facts, legal compliance, or current platform policy.
