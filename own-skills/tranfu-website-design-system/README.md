---
prompt_examples:
  - prompt: Build a new skill card list page in the TranFu website style.
    scene: create page
  - prompt: Here's a Figma node screenshot — implement it as a React component per the design spec.
    scene: figma to code
  - prompt: Review the tranfu-site homepage against the TranFu design system and give me a findings report.
    scene: spec review
  - prompt: This page breaks at 375 and 1440 — run a visual QA pass per the spec at every breakpoint.
    scene: responsive QA
  - prompt: This hero uses too much red decoration — refactor it to respect the restrained brand-red rule.
    scene: brand voice
  - prompt: Give me a copyable prompt for building the product center page in TranFu style.
    scene: prompt guide
---

[English](./README.md) | [中文](./README.zh.md)

# TranFu Website Design System

Keep the TranFu official website visually consistent — pull any starting point (Figma node, screenshot, existing code) back onto the extracted responsive design system.

## When to use it

**Creating a page**:

I'm building a new TranFu website page — skill card list, detail page, product center — and I want it to land on the design system from the start.

**Figma to code**:

I have a Figma node or screenshot, and I want a React implementation that matches color, type, spacing, radius, and responsive rules exactly.

**Refactoring existing UI**:

An existing TranFu page has drifted — too much red, wrong radius scale, decorative blobs in the hero — and I want it pulled back to neutral surfaces with brand red as focused accent.

**Visual QA**:

I want the page checked against the spec at documented breakpoints (1920, 1440, 1280, 756, 375) and a structured findings report.

**Prompt guidance**:

I want a copyable production prompt I can hand to another agent for building a TranFu page in the correct style.

**Not for**:

Non-TranFu websites → generic design workflows; pure copywriting; logo redesign; backend-only changes; code review unrelated to TranFu UI.

## What it produces

**It reads `references/design-spec.md` first, then acts on evidence — no UI decisions before the spec is loaded.**

- **Files changed**: only the relevant UI files; unrelated code stays untouched
- **Change report** (create / implement / refactor mode): `TRANFU_UI_CHANGE_REPORT` YAML with `changed_files`, `design_rules_used`, `validation` (desktop + mobile viewports and validation commands), `deviations`
- **Review report** (review mode): `TRANFU_DESIGN_REVIEW` YAML with `findings` — each carries id, severity, rule, location, evidence, fix, verification — and no files are edited
- **Prompt output** (prompt_guidance mode): `TRANFU_AGENT_PROMPT` YAML holding a copyable prompt plus the design-spec sections it references
- **Visual QA**: desktop and mobile viewports validated separately; missing evidence → `not_run:<reason>`, never a silent pass
- **Never**: redraws, recolors, stretches, crops, or decorates the TranFu logo

## Prerequisites & boundaries

**Prerequisites**:

`references/design-spec.md` must be present and readable; the target must be a TranFu website surface; there must be evidence to inspect (Figma node, screenshot, running page, or code).

**Neighbor skills**:

| Task | Route to |
|---|---|
| Generic palette / typography / chart selection | **ui-ux-pro-max** |
| Generic UI code review not tied to this spec | **code-review** |

**Not accepted**:

- Non-TranFu websites
- Pure copywriting
- Logo redesign
- Backend-only changes
- Code review unrelated to TranFu UI

**Subtle edges**:

- Existing implementation conflicts with the spec → cite both the code evidence and the spec rule, then apply the smallest scoped correction; never a large rewrite
- Figma context unavailable → fall back to local screenshots, mark confidence as partial
- Ambiguous intent between "edit this" and "just review it" → one clarifying question, then wait
