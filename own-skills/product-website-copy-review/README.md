---
description: Review product website copy systematically, then make only the changes that clearly improve clarity, consistency, and trust.
prompt_examples:
  - prompt: Review the copy across this product website before we rewrite anything.
    scene: Review a full website
  - prompt: Quickly audit this landing page and suggest only necessary edits.
    scene: Audit one page
  - prompt: Check these pages for inconsistent terms, CTAs, and product claims.
    scene: Check site consistency
---

# Product Website Copy Review

Find the copy problems that matter across a product website, then fix them without flattening the brand voice or changing product facts.

## When to use it

**Review a full website**

I'm preparing a product website for launch or a major revision. I want a structured review of the pages that shape product understanding, trust, and conversion before anyone starts rewriting them.

**Audit one page**

I have a homepage, landing page, feature page, or pricing page that feels unclear or generic. I want the most important problems identified first, followed by restrained edits.

**Check site consistency**

I need to know whether feature names, calls to action, user terms, tone, and product claims stay consistent across several pages.

**Not for**

This skill is not for translating isolated text, reviewing implementation code, or evaluating visual design when copy quality is outside the request.

## What it produces

**It reviews before it rewrites, and it leaves effective copy alone.**

- **Product model**: Summarizes the product, primary audience, core value, main calls to action, and pages covered.
- **Page findings**: Separates local issues from site-wide patterns and labels their impact and priority.
- **Site summary**: Assesses clarity, information hierarchy, consistency, trust, and signs of formulaic AI or SaaS copy.
- **Edit recommendations**: Suggests deletion, small replacement, reordering, or rewriting only where the result is materially better.
- **Final check**: Verifies that proposed copy preserves product facts, brand tone, layout constraints, and cross-page consistency.
- **Never does**: It does not invent capabilities, claims, metrics, permissions, or guarantees, and it does not publish or edit website code by itself.

## Prerequisites and boundaries

**What to provide**

Share a website URL, one or more page URLs, screenshots, exported copy, or a page structure with its text. Restricted pages must be accessible in the current session or supplied as screenshots or text.

**Related work**

| Need | Use |
|---|---|
| Visual UI changes | **tranfu-website-design** |
| Search optimization | **seo** |
| Accessibility review | **accessibility** |

**Boundaries**

- A full-site review covers the pages that influence understanding, decisions, conversion, trust, and product experience; it does not crawl every page mechanically.
- A quick single-page review still follows review, summary, and revision in that order.
- Unavailable pages are marked as not covered rather than inferred from surrounding content.
