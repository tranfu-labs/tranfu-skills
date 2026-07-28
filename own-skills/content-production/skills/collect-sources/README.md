---
description: Collects and verifies technology sources before drafting platform-ready Chinese media content.
prompt_examples:
  - prompt: Research this AI model launch before I write about it.
    scene: Research a topic
  - prompt: Enrich these article notes with reliable source material.
    scene: Enrich notes
  - prompt: Check whether these claims have enough evidence for a WeChat article.
    scene: Verify claims
---

# Source Research and Fact-Checking

Turn a technology writing idea into an auditable source pack before any draft is written.

## When to use it

**Research a topic**

When I have a technology angle, launch, product update, or industry question, I want the skill to gather primary and credible secondary sources before drafting.

**Enrich notes**

When I already have URLs, Markdown, TXT, or PDF material, I want it to extract useful claims and fill evidence gaps.

**Verify claims**

When a later article depends on specific facts, I want the source pack to show what is supported, weak, or missing.

**Not for**

Do not use it for non-technology topics, one-off lookups with no writing goal, rewriting finished copy, titles only, publishing, or post-publication analytics.

## What it produces

**The skill keeps its scope narrow: it prepares local deliverables and never performs platform publishing.**

- **Research run**: Creates an append-only local research run with captured sources, notes, and traceable decisions.
- **Claim evidence**: Extracts claims, records supporting links, and marks weak or unresolved evidence.
- **Handoff**: Returns structured material for topic selection, outlining, or drafting; it does not publish content.
- **Never does**: It does not merge workflow stages, publish content, or invent missing user approvals.

## Prerequisites & boundaries

**Prerequisites**

Network access and permission to read any local material you provide. The request should have a technology-content goal, not just a generic search question.

**Neighboring skills**

| Action | Use |
|---|---|
| Choose platform topics | **content-topics** |
| Draft the article | **draft-content** |
| Proofread finished copy | **proofread-content** |

**Out of scope**

- Requests that belong to another named skill should be routed there instead.
- Missing or unreadable inputs should stop the workflow rather than produce guessed content.
- Platform publishing, account login, scheduling, and post-publication analytics stay outside this skill.

**Subtle boundaries**

- A complete content-production run may call this skill as a provider, but this skill still owns only its own contracted output.
- Standalone use should leave unrelated project files untouched and report only the files or findings it actually produced.
