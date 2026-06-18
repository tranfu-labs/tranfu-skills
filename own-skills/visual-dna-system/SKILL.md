---
name: visual-dna-system
description: Extract a reusable, de-branded Visual DNA Design System from visual samples such as websites, screenshots, Figma references, images, decks, posters, app UIs, or HTML/CSS. Use when the user asks to analyze visual style, distill design DNA, create transferable visual tokens, or make a downstream prompt without copying the source. Do NOT use for producing final websites, dashboards, decks, posters, prototypes, direct brand recreation, prompt review, or code review.
version: 0.1.0
author: BruceL017
updated_at: 2026-06-18
origin: own
---

# Visual DNA System

## Purpose

Extract transferable visual DNA from a visual sample and convert it into a reusable abstract design system. Preserve design principles; remove source brand identity, protected layouts, exact copy, and proprietary components.

## Inputs

Accept one or more of:

- Website URL, screenshot, Figma reference, image, HTML/CSS, app UI, deck, poster, card, dashboard, or other visual artifact.
- Optional user notes about what attracted them to the sample.
- Optional target industry, audience, elements to ignore or emphasize, abstraction level, and originality constraints.

If source access requires tools that are unavailable, ask for a screenshot, file, or visual description.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW:

1. Read the visual sample and user notes. If no usable sample exists, ask for a URL, screenshot, file, or visual description and stop.
2. Classify the evidence: URL, screenshot, Figma, image, HTML/CSS, deck, poster, UI, or mixed source.
3. Extract visible design signals across essence, color, typography, layout, components, material, imagery, iconography, motion, and composition.
4. Separate transferable principles from non-transferable identity markers.
5. Remove source brand assets, logos, exact layouts, proprietary components, exact copy, and unique identity markers.
6. Write the Markdown `Visual DNA Design System` using the schema in `references/output-schema.md`.
7. Write the JSON/tokens representation using the schema in `references/output-schema.md`.
8. Write a copyable downstream production prompt for `visual-design-producer`.
9. Apply the originality guardrails in `references/originality-guardrails.md`.
10. Deliver the named artifacts and end.

Failure paths:

- If evidence is partial, continue with lower confidence and list missing evidence.
- If the user asks for direct copying or source brand recreation, refuse that part and extract only abstract transferable principles.
- If the user asks for final production, route to `visual-design-producer`.
- If visual details are too vague to infer, ask one focused clarification question or request a better visual sample.

## Required Output

Always output these named artifacts:

1. `Visual DNA Design System` in Markdown.
2. `visual_dna_system` JSON/tokens block.
3. `Downstream Production Prompt`.
4. `Transferability Notes`.
5. `Originality Guardrails`.

Read `references/output-schema.md` when writing the Markdown or JSON structure.
Read `references/originality-guardrails.md` when deciding what must not transfer.

## Quality Gate

Before finalizing, verify:

- The output is a portable design system, not only a report.
- Transferable and non-transferable elements are clearly separated.
- The downstream prompt can be used without re-reading the original sample.
- Source logos, brand names, exact layouts, exact copy, and proprietary components are not reused as instructions.
- The result enables original downstream work.

## Examples

<example>
User: "Extract the visual DNA of this SaaS landing page. I like the calm premium feeling, but do not copy the brand."

Action: Analyze the sample, remove source identity, and output a Visual DNA Design System, JSON/tokens, downstream prompt, transferability notes, and originality guardrails.
</example>

<example>
User: "Make this screenshot into a reusable visual system for future product pages."

Action: Distill the visual temperament, color roles, type hierarchy, spacing rhythm, component language, material behavior, and composition grammar. Do not produce a final page.
</example>

<bad-example>
WRONG: "Use the same logo, same hero layout, same navigation, same color palette, and same copy."

Reason: This copies source identity. Extract abstract principles instead, such as calm density, restrained contrast, editorial pacing, or soft hierarchy.
</bad-example>

<bad-example>
WRONG: "Here is a beautiful landing page based on the reference."

Reason: This skill extracts a design system. Final HTML production belongs to `visual-design-producer`.
</bad-example>

## Acceptance Criteria

The task is complete when:

- Markdown `Visual DNA Design System` exists.
- JSON/tokens block is present and parseable.
- Downstream prompt is present.
- Transferable and non-transferable elements are separated.
- Originality guardrails are explicit.
- No final website, dashboard, deck, poster, app UI, or prototype is produced by this skill.
