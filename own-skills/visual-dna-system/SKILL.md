---
name: visual-dna-system
description: Extract a reusable, de-branded Visual DNA Design System from visual samples such as websites, screenshots, Figma references, images, decks, posters, app UIs, or HTML/CSS. Use when the user asks to analyze visual style, distill design DNA, create transferable visual tokens, or make a downstream prompt without copying the source. Also trigger for Chinese requests like "提取这个网站的视觉风格", "把这个 UI 抽成可复用设计系统", "分析这套海报的视觉 DNA", "生成可迁移视觉 tokens". Do NOT use for producing final websites, dashboards, decks, posters, prototypes, direct brand recreation, prompt review, or code review.
version: 0.1.0
author: BruceL017
updated_at: 2026-06-18
origin: own
---

# Visual DNA System

## Purpose

MUST extract transferable visual principles from a visual sample and convert them into a reusable abstract design system. MUST remove source brand identity, protected layouts, exact copy, and proprietary components. NEVER reuse source logos, brand names, exact layouts, exact copy, or proprietary components.

## Inputs

Accept one or more of:

- Website URL, screenshot, Figma reference, image, HTML/CSS, app UI, deck, poster, card, dashboard, or other visual artifact.
- Optional user notes about what attracted them to the sample.
- Optional target industry, audience, elements to ignore or emphasize, abstraction level, and originality constraints.

If source access requires tools that are unavailable, ask for a screenshot, file, or visual description.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW:

1. Confirm required references are readable: `references/output-schema.md` and `references/originality-guardrails.md`. If either file is missing or unreadable, report `BLOCKER reference-unavailable: <path>` and stop.
2. Read the visual sample and user notes. If no usable sample exists, report `missing-visual-sample`, ask for a URL, screenshot, file, or visual description, and stop.
3. Apply input guards before extraction:
   - If the user asks only for final production, report `production-requested`, route to `visual-design-producer`, and stop.
   - If visual details are too vague to infer, report `insufficient-visual-detail`, ask one focused clarification question or request a better visual sample, and stop.
   - If the user asks for direct copying or source brand recreation, report `source-copy-request`, NEVER produce that copied part, and continue with abstract extraction only.
   - If evidence is partial, report `partial-evidence`, continue with lower confidence, and fill `Evidence And Confidence` / `missing_evidence`.
4. Classify the evidence: URL, screenshot, Figma, image, HTML/CSS, deck, poster, UI, or mixed source.
5. If a URL is unreachable because of login, anti-bot protection, 404, or network failure, report `source-unreachable`, ask for screenshots or HTML/CSS snippets, and stop.
6. If the sample is non-design content such as a natural photo, video frame, or random screenshot with no design intent, report `insufficient-design-signal`, request a sample with clear design intent, and stop.
7. If multiple samples have conflicting styles, report `conflicting-style-samples`, list the differences, and ask whether to synthesize one main DNA, output separate DNA systems, or choose one primary sample. If the user does not answer, output separate DNA systems and continue.
8. Extract visible design signals across essence, color, typography, layout, components, material, imagery, iconography, motion, and composition.
9. Separate transferable principles from non-transferable identity markers.
10. MUST remove source brand assets, logos, brand names, exact layouts, proprietary components, exact copy, and unique identity markers.
11. Compose the Markdown `Visual DNA Design System` using the schema in `references/output-schema.md`.
12. Emit the JSON/tokens representation using the schema in `references/output-schema.md`.
13. Compose a copyable downstream production prompt for `visual-design-producer`.
14. Apply the originality guardrails in `references/originality-guardrails.md`. If any Self-Check answer is not a clear "No", return to steps 9-10 and rewrite the transferable/non-transferable split. Retry at most 2 times; if the gate still fails, report `guardrails-cannot-converge` and ask the user to decide.
15. Deliver the named artifacts and end.

Failure paths:

- If a required reference is missing or unreadable, report `BLOCKER reference-unavailable: <path>` and stop. Do not generate schema from memory.
- If no usable sample exists, report `missing-visual-sample`, ask for a URL, screenshot, file, or visual description, and stop.
- If evidence is partial, report `partial-evidence`, continue with lower confidence, and fill `Evidence And Confidence` / `missing_evidence`.
- If a URL is unreachable because of login, anti-bot protection, 404, or network failure, report `source-unreachable`, ask for screenshots or HTML/CSS snippets, and stop.
- If the sample is non-design content such as a natural photo, video frame, or random screenshot with no design intent, report `insufficient-design-signal`, request a sample with clear design intent, and stop.
- If multiple samples have conflicting styles, report `conflicting-style-samples`, list the differences, and ask whether to synthesize one main DNA, output separate DNA systems, or choose one primary sample. If the user does not answer, output separate DNA systems and continue.
- If the user asks for direct copying or source brand recreation, report `source-copy-request`, NEVER produce that copied part, and MUST extract only abstract transferable principles.
- If the user asks for final production, report `production-requested`, route to `visual-design-producer`, and stop this skill unless the user also requested extraction.
- If visual details are too vague to infer, report `insufficient-visual-detail`, ask one focused clarification question or request a better visual sample, and stop.

## Required Output

Ownership: rewrite inline by default. Return the five-pack directly in the conversation as named Markdown and code blocks. Only create files when the user explicitly requests a path, for example `docs/visual-dna/{name}.md`.

MUST always output these 5 named artifacts:

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
- `Evidence And Confidence` is present and includes evidence sources, confidence level, and missing evidence.
- Transferable and non-transferable elements are clearly separated.
- The downstream prompt can be used without re-reading the original sample.
- Source logos, brand names, exact layouts, exact copy, and proprietary components are not reused as instructions.
- The result enables original downstream work.

If any quality-gate check fails, MUST revise before delivery. NEVER deliver a result that fails source-identity removal or schema completeness.

## Examples

<example>
User: "Extract the visual DNA of this SaaS landing page. I like the calm premium feeling, but do not copy the brand."

Action: Analyze the sample, remove source identity, and output a Visual DNA Design System, JSON/tokens, downstream prompt, transferability notes, and originality guardrails.
</example>

<example>
User: "Make this screenshot into a reusable visual system for future product pages."

Action: Distill the visual temperament, color roles, type hierarchy, spacing rhythm, component language, material behavior, and composition grammar. Do not produce a final page.
</example>

See `references/example-mini-output.md` for a filled minimal five-pack reference.

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
- NEVER produce final website, dashboard, deck, poster, app UI, or prototype in this skill. Route final production to `visual-design-producer`.
