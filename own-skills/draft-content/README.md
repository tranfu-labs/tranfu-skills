---
description: "Turn approved topics and evidence into one shared outline, two master drafts, and ten platform-specific drafts."
prompt_examples:
  - prompt: "Use the approved topic and research package to prepare a shared outline."
    scene: Prepare a shared outline
  - prompt: "I approve this outline path and hash; continue with the A/B drafts."
    scene: Produce A/B drafts
  - prompt: "Adapt both approved masters for all five supported content platforms."
    scene: Adapt five platforms
---

# Multiplatform Drafting Workflow

Turn approved evidence into two masters and ten drafts.

## When to use it

**Prepare a shared outline**

I have an approved topic and research package, or equivalent authorized materials. I want one evidence-bound outline prepared for review before any full draft is written.

**Produce A/B drafts**

I have approved the exact outline path and hash. I want two platform-neutral masters that share facts and structure while keeping the B style isolated from variant A.

**Adapt five platforms**

I need complete WeChat, Xiaohongshu, Zhihu, Weibo, and Toutiao drafts for both variants, each adapted directly from its matching master.

**Won't take**

This is not for research, topic selection, one-off writing, title pools, proofreading, images, layout, publishing, or post-publication analysis.

## What it produces

**Full drafting pauses at one human gate: the shared outline must be approved by exact path and SHA-256.**

- **Approved outline**: Writes a versioned shared outline and stops for explicit approval
- **Master drafts**: Creates one A master and one B master with controlled input separation
- **Platform drafts**: Creates ten complete adaptations across five platforms and two variants
- **Verification**: Checks snapshots, hashes, required files, titles, placeholders, and handoff status
- **File changes**: Writes only under `03-内容创作/<run-id>/` in independent mode
- **Handoff**: Ends at `READY_FOR_PROOFREAD` with paths and QA data
- **Never**: Searches for facts, silently approves the outline, proofreads, illustrates, formats, or publishes

## Prerequisites & boundaries

**Prerequisites**

Provide one valid approved topic plan plus a completed research run, or an explicit topic, audience, outline, and authorized materials. Required references and scripts must be readable.

**Neighbor skill split**

| Need | Hand off to |
|---|---|
| Research and evidence | **collect-sources** |
| Review completed drafts | **proofread-content** |
| Run the full pipeline | **content-production** |

**Scenarios it declines**

- Ordinary or single-platform copywriting
- Requests that stop at outline advice without the full A/B workflow
- Title, image, layout, publishing, or scheduling tasks

**Subtle edges**

- A and B share facts and the approved outline, but A never reads the B style file
- Every platform version comes from its own master, never from another platform draft
- Provider mode returns to the orchestrator and does not create an independent nested run
