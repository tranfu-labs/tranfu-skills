---
description: Turn research, fact bases, or current public signals into evidence-backed topic plans tailored to five major Chinese content platforms.
prompt_examples:
  - prompt: Turn this research folder into cross-platform topic ideas for today.
    scene: Plan from research
  - prompt: Find a timely topic for our account and verify the supporting signals.
    scene: Find timely topics
  - prompt: Adapt the strongest topic for WeChat, Zhihu, and Weibo.
    scene: Adapt across platforms
---

# content-topics

Choose a defensible topic before drafting, with evidence, platform fit, and a practical outline already attached.

## When to use it

**Plan from research**

I have a research folder, fact base, or collection of source material and need it narrowed into one strong topic plus credible alternatives.

**Find timely topics**

I need a current angle for a fixed content account. The skill checks both factual support and a recent public-attention signal instead of treating popularity as proof.

**Adapt across platforms**

I want the same core opportunity shaped for WeChat Official Accounts, Xiaohongshu, Zhihu, Weibo, and Toutiao, or for an explicitly requested subset.

**Not for**

Use another workflow when the topic is already fixed and the request is only for titles, a full draft, rewriting, research collection, a content calendar, publishing, or performance analysis.

## What it produces

**It selects a topic and stops before full drafting.**

- **Topic decision**: one primary topic and four alternatives when the evidence supports a usable plan.
- **Evidence boundary**: source links or files, freshness checks, confidence, and unresolved gaps are recorded without inventing attention metrics.
- **Platform treatment**: each requested platform receives a title prototype, fit rationale, and content format; the primary topic also gets a shared outline.
- **File creation**: standalone mode writes a new `02-选题方案.md`, adding a timestamp instead of overwriting an existing plan.
- **Orchestrated output**: provider mode writes only its contracted discovery files and returns control to the orchestrator.
- **Never does**: it does not edit source material, save temporary profile changes, write a complete article, publish content, or expose hidden scores.

## Prerequisites and boundaries

**Prerequisites**

The bundled account profile, topic-selection system, and platform playbooks must be readable. Supply local material, pasted evidence, public URLs, or authorize a current-topic search; without material, live search capability is required.

**Evidence rules**

- A primary timely topic needs both a credible factual source and a traceable attention signal from the last 72 hours.
- If evidence is incomplete, the result becomes `NEEDS_EVIDENCE`; if required input cannot be read or live search is unavailable, it becomes `BLOCKED`.
- Public pages behind login, verification, or a paywall are not guessed from context.

**Nearby responsibilities**

| Need | Use instead |
|---|---|
| Generate or optimize titles | `title-options` |
| Draft the full article | a writing workflow |
| Collect and maintain sources | a research workflow |

**Subtle boundary**

A platform title prototype is part of explaining a chosen topic. A title pool for an already finished article is a separate title-generation task.
