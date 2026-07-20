---
description: "Run a complete Chinese content workflow from one brief, topic, or outline to audited deliverables for five publishing platforms."
prompt_examples:
  - prompt: "Turn this one-line brief into a complete five-platform content package."
    scene: Start from a brief
  - prompt: "Use this chosen topic and run the full A/B content production workflow."
    scene: Use a chosen topic
  - prompt: "Build the full content package from this approved Markdown outline."
    scene: Use an approved outline
---

# Multiplatform Content Production Workflow

Run an audited local workflow for five-platform content.

## When to use it

**Start from a brief**

I have only a one-line creative direction and want the workflow to choose a viable topic, research it, and carry it through every production stage.

**Use a chosen topic**

I already know the subject and need two master variants plus finished versions for WeChat, Xiaohongshu, Zhihu, Weibo, and Toutiao.

**Use an approved outline**

I have a Markdown outline and want it verified, normalized, and expanded into a complete package with titles, illustrations, a WeChat cover, and clean HTML.

**Won't take**

This is not for a quick edit, one title, one illustration, layout-only work, publishing, scheduling, or post-publication analytics.

## What it produces

**The endpoint is a verified local delivery package, not a published post or platform draft.**

- **Writing set**: Creates two platform-neutral masters and ten reviewed platform versions
- **Title set**: Produces exactly 34 candidates and one selected title for each platform
- **Visual set**: Produces five illustration suites plus one exact-size WeChat cover
- **Publishing package**: Builds platform folders, optimized images, WeChat clean HTML, and a browser preview
- **Audit trail**: Preserves versioned decisions, hashes, gates, QA records, and recovery state under `runs/<run-id>/`
- **External activity**: May research public sources and call validated local providers; all deliverables stay local
- **Never**: Logs into platforms, creates platform drafts, schedules posts, publishes, or reads performance data

## Prerequisites & boundaries

**Prerequisites**

Provide exactly one starting point: a brief, a chosen topic, a Markdown outline path, or pasted outline text. All required local provider skills and their matching contracts must be available.

**Neighbor skill split**

| Need | Hand off to |
|---|---|
| Research only | **collect-sources** |
| Drafting only | **draft-content** |
| Illustrations only | **post-illustration-images** |

**Scenarios it declines**

- Lightweight editing or a single-platform writing request
- A request for only titles, images, layout, or proofreading
- Any publishing, scheduling, account login, or post-publication operation

**Subtle edges**

- Autonomous mode records and approves fixed-rule gates without pretending the user approved them
- Reviewed mode pauses only at the named decision gates
- A failed provider contract blocks initialization instead of being replaced by a generic agent
