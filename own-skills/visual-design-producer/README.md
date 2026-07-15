---
description: "Turn a Producer Handoff, a Visual DNA, or a plain brief into an original HTML visual — landing pages, posters, Xiaohongshu cards, dashboards, decks — in a single pass."
prompt_examples:
  - prompt: Use this Visual DNA to make an HTML landing page for an AI notebook.
    scene: Build from visual references
  - prompt: Design a Xiaohongshu card set for an autumn citywalk guide — cover plus inner pages, HTML.
    scene: Create a Xiaohongshu card
  - prompt: Here is the Producer Handoff for a dashboard — produce the HTML directly from it.
    scene: Build from a handoff
---

# visual-design-producer

Turn a Producer Handoff, a Visual DNA, or a plain brief into an original HTML visual — landing pages, posters, Xiaohongshu cards, dashboards, decks — in a single pass.

## When to use it

**DNA-driven**:

I already have a Visual DNA (or JSON tokens) and want the skill to produce an HTML landing page / dashboard / deck straight from it, without another style interview.

**Scene-direct**:

I explicitly say "make a Xiaohongshu card," "design a job-fair poster," "give me a WeChat article cover" — I want the skill to pick the right output route (card / poster / page / deck) on its own.

**Build from a handoff**:

Upstream (the design strategy layer) already wrote a Producer Handoff. I drop it in and let the skill produce HTML from it, without re-interviewing the target.

**Apply brand guidelines**:

The artifact has to carry our brand color / logo / typography. I attach the brand guide in the prompt and want the skill to flip from default `brandless` to `brand-on`.

**Start from a short brief**:

No DNA, no Handoff — one line ("make a poster in X style for Y") and I want the skill to run production from that brief alone.

**Out of scope**:

Extracting Visual DNA from source samples → **visual-dna-system**; prompt / SKILL quality review → **prompt-review**; code review → **code-review**; "copy the logo and layout from this source sample" — that part is refused; only original output from abstract design principles.

## What it produces

**Original HTML only by default — reference samples are abstract direction, not templates, and requests to copy source-sample logos or layouts are refused.** This is the most counterintuitive part.

- **Primary artifact**: one HTML visual, following the engineering spec in `references/html-engineering-spec.md`
- **Route note**: one line stating which output route was chosen (landing page / card / poster / dashboard / deck ...)
- **Brand mode**: one line marking `brandless` or `brand-on`
- **Input type**: one line marking whether the run used `Producer Handoff`, `Visual DNA`, or a standalone brief
- **Quality gate**: `references/anti-slop-quality-gate.md` runs before delivery and returns a brief pass summary
- **Optional secondary outputs** (only on request): slide outline, CSS variables / tokens, a copyable production prompt, export notes
- **Never does**: copy source-sample logos / layouts / proprietary components / exact copy; require an internal brand-manual path in default `brandless` mode; fabricate fake data or filler content

## Prerequisites & boundaries

**Prerequisites**:

At least one input — Producer Handoff / Visual DNA (or JSON tokens) / standalone brief. If all three are missing, the skill asks for a brief and stops.

**Adjacent skills**:

| Task | Route to |
|---|---|
| Extract Visual DNA from source samples | **visual-dna-system** |
| Review prompt or SKILL quality | **prompt-review** |
| Review code | **code-review** |

**Out of scope**:

- Copying source-sample identity (logos / layout / proprietary components / exact copy) — that part is refused; output is original from abstract DNA
- No Handoff, no Visual DNA, no brief — the skill stops and asks for one
- `brand-on` requested but no brand context provided — the skill asks for brand material or offers to continue in `brandless`

**Subtle edges**:

- When a Producer Handoff exists, it is the primary input — the skill will not ask "should I read the Visual DNA too"; Visual DNA is used only when no Handoff exists
- Real target context you provide (product code / screenshots / URLs / copy / data) is read before production; Visual DNA is direction, never a substitute for that context
- When content is missing, the skill uses clearly labeled placeholders rather than fabricated data
