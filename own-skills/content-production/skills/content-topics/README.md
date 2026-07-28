---
description: Turns research material or public signals into evidence-backed topics for Chinese content platforms.
prompt_examples:
  - prompt: Pick today’s topic from these research notes.
    scene: Pick a topic
  - prompt: Turn this batch of sources into platform-specific content angles.
    scene: Use source batch
  - prompt: Find a hot AI topic that can work across WeChat and Xiaohongshu.
    scene: Hot topic
---

# Cross-Platform Topic Selection

Choose one evidence-backed content direction and adapt it for multiple Chinese media platforms.

## When to use it

**Pick a topic**

When I have research notes or a content account to feed, I want a main topic that can become a real article or post.

**Use source batch**

When a batch of material feels scattered, I want it turned into platform-ready angles and a concise main outline.

**Hot topic**

When I need a timely AI or technology angle, I want public signals and evidence to shape the choice.

**Not for**

Do not use it for full drafting, title-only work, rewriting, pure research, calendars, publishing, or analytics.

## What it produces

**The skill keeps its scope narrow: it prepares local deliverables and never performs platform publishing.**

- **Topic candidates**: Generates evidence-backed options and identifies a main topic.
- **Platform angles**: Maps the topic to WeChat, Xiaohongshu, Zhihu, Weibo, and Toutiao contexts.
- **Brief outline**: Hands off a concise direction for the drafting workflow.
- **Never does**: It does not merge workflow stages, publish content, or invent missing user approvals.

## Prerequisites & boundaries

**Prerequisites**

Provide local research material, a fact library, or permission to use public information. The goal should be content planning, not publication.

**Neighboring skills**

| Action | Use |
|---|---|
| Collect sources | **collect-sources** |
| Draft the content | **draft-content** |
| Generate titles | **title-options** |

**Out of scope**

- Requests that belong to another named skill should be routed there instead.
- Missing or unreadable inputs should stop the workflow rather than produce guessed content.
- Platform publishing, account login, scheduling, and post-publication analytics stay outside this skill.

**Subtle boundaries**

- A complete content-production run may call this skill as a provider, but this skill still owns only its own contracted output.
- Standalone use should leave unrelated project files untouched and report only the files or findings it actually produced.
