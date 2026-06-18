---
name: visual-design-producer
description: 'Produce original HTML visual artifacts from a Producer Handoff, Visual DNA Design System, JSON/tokens, or standalone design brief. Use for landing pages, app UIs, dashboards, decks, posters, WeChat visuals, Xiaohongshu cards, product prototypes, or other HTML-based outputs; also match Chinese requests such as "帮我做一个页面", "出一张海报", "用这个 DNA 做小红书卡", or "产 HTML deck". Supports optional brand integration when brand context is provided. Do NOT use for: extracting visual DNA from source samples (use visual-dna-system); prompt review (use prompt-review); code review (use code-review); copying source sample brand identity (refuse that part).'
version: 0.1.0
author: BruceL017
updated_at: 2026-06-18
origin: own
---

# Visual Design Producer

## Purpose

Produce original visual artifacts from the best available production input. Use a `Producer Handoff` first when present, use `Visual DNA` as abstract design direction when present, and operate from the user brief alone when no Visual DNA exists. Output HTML by default and add secondary formats only when requested.

## Required Inputs

Require at least one production input:

- `Producer Handoff`
- `Visual DNA Design System` or JSON/tokens representation
- Standalone user brief or context

Optional:

- Target artifact type, when it is not obvious from the brief
- Brand context or brand guide
- Brand mode: `brandless` or `brand-on`
- Desired number of variations
- Specific output formats
- Required dimensions, platform, or channel
- Existing copy, content, or information architecture

If no production input exists, ask for the missing brief before producing.

## Input Priority

Follow this priority exactly:

1. If `Producer Handoff` is present, use it as the primary production brief.
2. If absent but `Visual DNA` is present, infer production direction from Visual DNA.
3. If no Visual DNA is present, operate in standalone production mode from the user brief.

Do not ask for Visual DNA when the user is clearly asking for standalone production.

## Clarification Rule

Default to action. Ask at most one focused question only when missing information blocks production or would change the core artifact. If a safe assumption is available, state it briefly and continue.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW:

1. Resolve the production input using the `Input Priority` section.
2. Read any real target context the user provides, such as product code, screenshots, URLs, assets, copy, data, information architecture, or brand material. Treat Visual DNA as direction, not a substitute for this context.
3. Read the Visual DNA and JSON/tokens when present. If tokens are missing, continue when the Markdown system has enough concrete design rules; ask only when token-level detail is essential.
4. Read the new design brief and target artifact type. Infer missing noncritical details; ask one focused clarification question only when the route cannot be chosen safely.
5. Resolve brand mode using `references/brand-integration-slot.md`.
6. Select the artifact route using `references/artifact-router.md`.
7. Create a new medium-specific visual system from the production input, new brief, real target context, and optional brand context.
8. Generate original layout and visual directions. Do not treat source samples as templates.
9. Produce HTML by default, following `references/html-engineering-spec.md`.
10. Add user-requested secondary formats such as slide outline, CSS variables, copyable prompt, or export notes.
11. Run the anti-slop quality gate in `references/anti-slop-quality-gate.md`.
12. Deliver the HTML artifact, secondary outputs if any, and a brief quality-gate summary.

Failure paths:

- If no production input exists, ask for a brief and stop.
- If real target context is referenced but inaccessible, ask for an accessible fallback only when that context is necessary for fidelity.
- If brand integration is requested but no brand context exists, ask for brand material or offer to continue in `brandless` mode.
- If the user requests source sample brand identity copying, refuse that part and create an original output from abstract DNA.
- If the requested artifact type is unsupported, choose the nearest HTML-based route and state the assumption.
- If content is missing, use clearly marked placeholders only when necessary and avoid fake data.

## Brand Mode

Default to `brandless`.

Use `brand-on` only when the user provides brand context or explicitly asks to apply brand elements. The first version must not require a fixed brand manual path.

Read `references/brand-integration-slot.md` whenever brand context is provided or requested.

## Artifact Routing

Read `references/artifact-router.md` when choosing the output structure.

Default mappings:

- Website or landing page -> HTML page.
- App UI -> HTML prototype.
- Dashboard -> HTML dashboard.
- PPT or deck -> HTML deck plus slide outline.
- Poster -> HTML poster.
- WeChat article visual -> HTML layout plus export guidance when needed.
- Xiaohongshu card or carousel -> HTML card/carousel.
- Product prototype -> HTML clickable prototype.
- Prompt requested -> HTML plus copyable production prompt.
- CSS requested -> HTML plus CSS variables/tokens.

## Required Output

Always deliver:

1. Primary HTML visual artifact, unless the user explicitly requests a non-HTML-only workflow.
2. Brief statement of selected artifact route.
3. Brief statement of brand mode: `brandless` or `brand-on`.
4. Brief statement of production input: `Producer Handoff`, `Visual DNA`, or `standalone brief`.
5. Anti-slop quality-gate summary.

When requested, also deliver secondary outputs such as slide outline, CSS variables/tokens, copyable production prompt, or export guidance.

## Quality Gate

Read `references/anti-slop-quality-gate.md` before delivery.

Never deliver if:

- The output copies the source sample identity instead of using abstract visual DNA.
- Provided real target context was ignored.
- The output requires a missing brand path in default `brandless` mode.
- The output uses source sample logos, source sample assets, exact layouts, proprietary components, or exact copy.
- The result is mostly filler content, fake data, unnecessary icons, or generic AI visual tropes.

## Examples

<example>
User: "Use this Visual DNA Design System to create a landing page for an AI research notebook."

Action: Use `brandless` mode, adapt the DNA to a landing page, create original HTML, and run the anti-slop gate.
</example>

<example>
User: "Use this Visual DNA but add our brand elements from the guide below."

Action: Activate `brand-on`, read the provided brand guide, blend target brand with abstract DNA, avoid source sample identity copying, and produce HTML.
</example>

<bad-example>
WRONG: "Cannot run because no internal brand manual path is configured."

Reason: The first version must run in `brandless` mode without brand context.
</bad-example>

<bad-example>
WRONG: "I will recreate the same hero, logo placement, colors, and proprietary navigation from the source sample."

Reason: This copies source sample identity. Produce an original artifact from abstract visual principles.
</bad-example>

## Acceptance Criteria

The task is complete when:

- HTML output is produced by default.
- HTML follows the engineering spec in `references/html-engineering-spec.md`.
- The output follows the input priority: `Producer Handoff`, `Visual DNA`, or standalone brief.
- Any provided real target context is read before production.
- `references/anti-slop-quality-gate.md` Required Checks item 3 passes when Visual DNA is present.
- `brandless` mode works without any brand path.
- Optional `brand-on` mode is available when brand context is provided.
- `references/anti-slop-quality-gate.md` Required Checks item 4 passes, and all four Originality Check answers are `No`.
- Anti-slop gate results are checked before delivery.
- Secondary outputs are included only when requested.
