---
description: Turn a Weibo writing request into verified hotspot commentary with a long post, publishable images, and one final delivery package.
prompt_examples:
  - prompt: Write a long Weibo post about today’s current hotspots.
    scene: Current hotspots
  - prompt: Write a Weibo commentary around enterprise AI adoption.
    scene: Fixed theme
  - prompt: Turn this specific news event into a deep Weibo post with images.
    scene: Specific event
---

# Weibo Hotspot Commentary

Create evidence-backed Weibo long-form commentary from a hotspot, theme, or specific event, then deliver the final copy and images together.

## When to use it

**Current hotspots**

Use it when I want the skill to discover and review the current Weibo Top 50, choose a safe and meaningful topic, and write a long post that explains why the event matters instead of merely repeating the news.

**Fixed theme**

Use it when I already have a direction, such as enterprise AI adoption or AI content tools, and want the skill to find a recent public event that can anchor a timely Weibo post.

**Specific event**

Use it when I already have one news item, product launch, public incident, or social topic, and want a verified long-form Weibo commentary with a clear AI angle and supporting images.

**Not for**

This is not for short Weibo snippets, generic copy for other platforms, hotspot lookup only, company research only, publishing or scheduling posts, or social analytics. It reads public sources only and never logs in or posts to Weibo.

## What it produces

**It does not hand over draft fragments during the run; it delivers the complete approved package once the pipeline finishes.**

- **Hotspot evidence**: verifies whether the request is a live hotspot search, fixed event, or fixed theme, then records public evidence and rejection reasons.
- **Editorial AI bridge**: turns the event into a concrete AI-related analysis angle with mechanism, impact, judgment, and boundaries.
- **Optional company evidence**: uses TranFu as the default company only when relevant, and omits product mentions when public evidence does not support them.
- **Long Weibo post**: creates a 1,500-2,000 character long-form post, rewrites it in plain language, and checks that analysis outweighs event recap.
- **Images**: searches for publishable public images first, then generates missing images only after the copy is frozen.
- **Final delivery**: writes complete items into `final-delivery/` with copy, image files, source notes, and a manifest.
- **Never does**: invent facts, use private systems, bypass login walls, publish, schedule, promote, or modify external content.

## Prerequisites & boundaries

**Prerequisites**

The runtime needs access to the required content providers, public web/search tools, the skill’s `references/provider-contracts.md`, `references/delivery-contract.md`, and the validation/package scripts under `scripts/`.

**Adjacent work**

| Need | Use instead |
|---|---|
| A short Weibo post or one-off social caption | A shorter social copy skill |
| Only checking current hot topics | A hotspot discovery or research tool |
| Company-only market research | A research or company profiling workflow |
| Publishing, scheduling, or analytics | A social platform operations workflow |

**Hard boundaries**

- It only uses public sources and refuses unverifiable events, victim-consuming disasters, privacy exposure, pure entertainment gossip, and high-harm controversy.
- Product mentions are optional and evidence-bound; when the public evidence is weak, the post stays focused on the event and AI implications.
- Fixed events and fixed themes do not need to appear in the Weibo Top 50, but they still need current, verifiable public evidence.

**Subtle distinctions**

- Asking “write Weibo” with no topic triggers live discovery and defaults the company context to TranFu.
- Giving a long-term topic triggers fixed-theme evidence search, first within seven days and then up to thirty days if needed.
- Giving one concrete event triggers fixed-event verification and skips the Top 50 scan.
