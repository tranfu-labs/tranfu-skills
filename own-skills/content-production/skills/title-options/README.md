---
description: Generates platform-fit article titles that stay faithful to the finished content.
prompt_examples:
  - prompt: Give me title options for this finished article.
    scene: Title options
  - prompt: Improve this old title using the article body.
    scene: Improve title
  - prompt: Create platform-specific headline candidates for WeChat and Xiaohongshu.
    scene: Platform titles
---

# Article Title Generation

Create promise-safe article titles from completed content, with platform fit and no unsupported claims.

## When to use it

**Title options**

When I have a finished article or substantial excerpt, I want several usable titles that reflect the actual content.

**Improve title**

When an old title exists, I want it improved against the body rather than rewritten from vibes.

**Platform titles**

When different platforms need different headline styles, I want candidates adapted without factual additions.

**Not for**

Do not use it for topic planning, body writing, covers, openings, SEO title tags, landing pages, ads, email subjects, naming, URLs, DOCX, PDF, or TXT input.

## What it produces

**The skill keeps its scope narrow: it prepares local deliverables and never performs platform publishing.**

- **Title pool**: Returns article-title candidates with platform awareness.
- **Promise guard**: Rejects unsupported time, numbers, authority, quotes, causality, conflict, or outcomes.
- **Selection support**: Helps compare candidates without drifting away from the body.
- **Never does**: It does not merge workflow stages, publish content, or invent missing user approvals.

## Prerequisites & boundaries

**Prerequisites**

Provide a completed article, excerpt, or old title plus body text. The input must be readable text, not a remote URL or office document.

**Neighboring skills**

| Action | Use |
|---|---|
| Choose topic | **content-topics** |
| Draft content | **draft-content** |
| Proofread copy | **proofread-content** |

**Out of scope**

- Requests that belong to another named skill should be routed there instead.
- Missing or unreadable inputs should stop the workflow rather than produce guessed content.
- Platform publishing, account login, scheduling, and post-publication analytics stay outside this skill.

**Subtle boundaries**

- A complete content-production run may call this skill as a provider, but this skill still owns only its own contracted output.
- Standalone use should leave unrelated project files untouched and report only the files or findings it actually produced.
