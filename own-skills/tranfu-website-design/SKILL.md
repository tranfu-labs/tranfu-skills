---
name: tranfu-website-design
description: >
  Apply TranFu website brand and UI design rules for create, modify, refactor,
  review, or visual QA tasks on TranFu React/Vite website UI. Trigger for
  "按 TranFu 风格做一个新区块", "检查这个页面是否符合 TranFu 网站设计规范",
  "重构这个组件但保持官网风格", Figma-to-TranFu UI integration, and TranFu
  layout, color, typography, logo, component, motion, media, or copy-impact UI
  work. Do NOT trigger when the site is not TranFu, the task is pure copywriting
  with no UI/brand impact, logo redesign, a standalone brand book, or
  visual-irrelevant code work.
version: 0.2.0
author: aquarius-wing
updated_at: 2026-06-22
origin: own
---

# TranFu Website Design

Use this skill to preserve the TranFu website's visual language while creating, modifying, or reviewing UI.

## Target Types and Ownership

This skill owns TranFu React/Vite website UI and brand-design work: layout, color, typography, logo usage, components, motion, media, screenshots, and product-facing copy that changes UI meaning.

| Mode | Inputs | Ownership | Named output | Done means |
| --- | --- | --- | --- | --- |
| `create` / `modify` / `refactor` | User request, target TranFu React/Vite project or supplied component files, relevant `references/design-spec.md` sections | `edit file` when the task authorizes implementation; `suggest patch` only when editing is not authorized | `TRANFU_UI_CHANGE_REPORT` | Relevant source files were inspected; design rules used are named; changed files are listed; viewport checks and command results are reported as `passed`, `failed`, or `not_run:<reason>` |
| `review` | Target files, screenshots, or described UI area | `review-only` | `TRANFU_DESIGN_REVIEW` | No files were changed; every finding uses the review schema below; each finding cites a design rule and a concrete file, line, screenshot, viewport, or UI area |
| `visual QA` | Running app, screenshots, or explicit UI states to inspect | `review-only` unless the user explicitly asks for fixes | `TRANFU_VISUAL_QA_REPORT` | Desktop and mobile checks are reported as `passed`, `failed`, or `not_run:<reason>`; no visual pass is claimed for any `not_run` viewport |

If the user intent is ambiguous between implementation and review, ask one concise question before editing files.

## Core Reference

MUST read `references/design-spec.md` before making brand, layout, component, motion, media, or copy decisions. If this file is missing or unreadable, report `BLOCKER: missing design spec` and exit this skill.

After the first pass, load the sections required by the task:
- Layout and page structure: sections 2, 6, and 13.
- Color, typography, radius, components: sections 3, 5, 7, and 8.
- Logo usage: section 4.
- Background, decoration, and motion: sections 9 and 10.
- Copy tone: section 11.
- Final visual review: section 12.

## Logo Assets

This skill includes canonical TranFu logo assets exported from the TranFu Figma file in `assets/`.

When implementing a TranFu website or app, MUST use these bundled assets first:
- `assets/logo-lockup-h-en-primary-on-light.svg` for the standard red horizontal lockup on light backgrounds.
- `assets/logo-symbol-primary.svg` for compact brand symbol use such as favicons, avatars, and tight UI spaces.
- `assets/logo-wordmark-primary.svg` for wordmark-only brand use.
- `assets/app-icon-primary.svg` for app icon or square social/icon previews.

Copy the required asset into the target project, using `public/brand/` unless the project already has a brand-asset directory, then reference the project-local asset. NEVER reference `/Users/.../Downloads` paths, NEVER fetch logo assets from older deployed sites, and NEVER redraw, recolor, stretch, crop, or add effects to the logo.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW and keep it current while using this skill:

1. Classify the task as `create`, `modify`, `refactor`, `review`, or `visual QA`. If the request matches "Do Not Use" below, state the out-of-scope reason, route to the relevant workflow, and exit this skill.
2. Verify the target. If no TranFu React/Vite project, target file, screenshot, or UI area is available, ask for the missing target and exit this skill. If the user intent is ambiguous between implementation and review, ask one concise question and exit until answered.
3. Read `references/design-spec.md`. If the file is missing or unreadable, report `BLOCKER: missing design spec` and exit this skill.
4. Inspect the existing implementation before changing UI. Start with these files when present, then search `src/` for the target component or style if needed:
   - `src/styles/theme.css`
   - `src/styles/fonts.css`
   - `src/styles/index.css`
   - `src/app/App.tsx`
   - `src/app/components/*`
   - `src/imports/*/index.tsx`
   If a code-changing task has no relevant implementation target after inspection, report `BLOCKER: target implementation not found` and exit this skill.
5. Route by mode: `create` / `modify` / `refactor` -> run subflow "Implement UI Change"; `review` -> run subflow "Run Design Review"; `visual QA` -> run subflow "Run Visual QA"; otherwise report `BLOCKER: unknown TranFu design mode` and exit this skill.
6. Validate the result with the Validation section. If a command, browser, dev server, screenshot, or viewport check cannot run, record `not_run:<reason>` for that exact item and do not claim it passed.
7. Produce `TRANFU_UI_CHANGE_REPORT`, `TRANFU_DESIGN_REVIEW`, or `TRANFU_VISUAL_QA_REPORT`, then end.

## Failure Paths

- Missing or unreadable `references/design-spec.md` -> report `BLOCKER: missing design spec` and exit this skill.
- Missing target project, target file, screenshot, or UI area -> ask for the missing target and exit this skill.
- Out-of-scope request -> state the matching "Do Not Use" rule, route to the relevant workflow, and exit this skill.
- No edit authorization -> switch to `suggest patch`, report that no files were changed, and keep output in the named report format.
- Patch conflict or concurrent file change -> reread the current file, apply the smallest scoped patch once more, and report the affected file if the conflict remains.
- Command, browser, dev server, screenshot, or viewport unavailable -> record `not_run:<reason>` for that item and do not claim it passed.
- Screenshot and code evidence disagree -> cite both evidence sources in the finding and mark verification as `deferred_with_user_visible_risk`.
- Visual issue is not reproducible -> record `not_reproduced:<checked target>` and do not claim the issue is fixed.

### Subflow: Implement UI Change

1. MUST reuse existing TranFu tokens, layout scale, typography, component patterns, and motion conventions before introducing new ones.
2. MUST keep the visual direction system-like, restrained, engineering-oriented, and product-grounded. MUST use real product screenshots, interface captures, or UI-like product visuals unless the user explicitly asks for another direction.
3. MUST implement narrowly inside the relevant component, style, or asset boundary. NEVER redesign unrelated sections unless the user explicitly asks for a redesign.
4. MUST apply the Design Rules below and cite any intentional deviation from `references/design-spec.md`.
5. MUST return changed files, validation results, and deviations to the parent workflow.

### Subflow: Run Design Review

1. MUST inspect the target files, screenshots, or described UI area against `references/design-spec.md`.
2. MUST produce findings first, using `TRANFU_DESIGN_REVIEW` schema. If there are no findings, output an empty `findings: []` list and still include validation status.
3. NEVER edit files in this subflow.

### Subflow: Run Visual QA

1. MUST inspect one desktop viewport and one mobile viewport. If the app or browser cannot run, record the exact `not_run:<reason>` and continue with static review only.
2. MUST check overlap, overflow, responsive framing, asset rendering, motion, logo treatment, and brand-rule drift.
3. MUST produce findings first, using `TRANFU_VISUAL_QA_REPORT` schema. NEVER claim a viewport passed unless it was inspected.
4. NEVER edit files in this subflow unless the user explicitly asks for fixes.

## Design Rules

- MUST use Brand Red `#E63A46` only for logo, primary actions, active states, focus, or key emphasis. NEVER use it as a large decorative background.
- MUST keep page and section surfaces in the TranFu neutral system, especially `#F0F0F0`, `#F7F7F7`, `#F5F5F5`, white, and the documented border grays.
- MUST preserve the 1920-stage logic and existing centered content widths unless the task explicitly asks for a new responsive model.
- MUST use the documented font hierarchy: `MiSans` for regular UI, `Alimama_ShuHeiTi` for hero-scale headings, and `Hammersmith One` for command/badge-like English text.
- MUST keep radii inside the documented scale: `6`, `8`, `12`, `16`, `24`, `30`, `40`, or full radius for status dots and circular buttons.
- MUST keep cards light by default; stronger shadow belongs only to hover or active affordance.
- MUST use the standard logo lockup and badge rules. NEVER redraw, stretch, decorate, or repurpose the logo as a generic icon.
- MUST keep motion subtle and respect `prefers-reduced-motion`.
- MUST make copy concrete, engineering-oriented, and tied to real work. Avoid vague marketing claims.

## Validation

Before finishing a create, modify, or refactor task:

1. MUST verify the changed UI follows the relevant sections of `references/design-spec.md`.
2. MUST verify colors, fonts, radii, spacing, logo treatment, media style, motion, and copy tone do not introduce a conflicting visual system.
3. MUST verify brand red remains a focused accent.
4. MUST verify new media is a real product screenshot, interface capture, or UI-like product visual unless the user explicitly asks for another direction.
5. MUST verify text does not overflow or overlap in checked viewports.
6. MUST verify reduced-motion handling remains intact when animation is added or changed.
7. MUST run the project's available lint, typecheck, build, or targeted tests when the change touches implementation logic or shared UI. If none exist or the command cannot run, report `not_run:<reason>`.

## Output Schemas

For implementation tasks, produce:

```yaml
TRANFU_UI_CHANGE_REPORT:
  mode: create|modify|refactor
  changed_files:
    - <file path>
  design_rules_used:
    - <references/design-spec.md section or rule>
  deviations:
    - rule: <rule>
      reason: <why the deviation was necessary>
  validation:
    desktop_viewport: passed|failed|not_run:<reason>
    mobile_viewport: passed|failed|not_run:<reason>
    commands:
      - command: <command>
        result: passed|failed|not_run:<reason>
```

For review-only tasks, produce findings first:

```yaml
TRANFU_DESIGN_REVIEW:
  mode: review
  findings:
    - id: TWD-1
      severity: HIGH|MEDIUM|LOW
      rule: <references/design-spec.md section or exact rule>
      location: <file:line | screenshot | viewport | UI area>
      evidence: <what is visible or present>
      fix: <specific correction>
      verification: <how to verify after fixing>
  validation:
    inspected_targets:
      - <file | screenshot | UI area>
```

For visual QA tasks, produce:

```yaml
TRANFU_VISUAL_QA_REPORT:
  mode: visual_qa
  viewport_checks:
    desktop: passed|failed|not_run:<reason>
    mobile: passed|failed|not_run:<reason>
  findings:
    - id: TWD-QA-1
      severity: HIGH|MEDIUM|LOW
      rule: <references/design-spec.md section or exact rule>
      location: <viewport | screenshot | UI area>
      evidence: <what is visible>
      fix: <specific correction>
      verification: <how to verify after fixing>
```

## Examples

WRONG: "This page feels off-brand and could be improved."
Reason: No severity, no rule, no location, no evidence, and no verification.

GOOD:

```yaml
TRANFU_DESIGN_REVIEW:
  mode: review
  findings:
    - id: TWD-1
      severity: HIGH
      rule: references/design-spec.md section 3, Brand Red usage
      location: src/app/components/Hero.tsx:42
      evidence: "The full hero background uses #E63A46."
      fix: "Move #E63A46 to the primary CTA and use #F0F0F0 or #F7F7F7 for the hero surface."
      verification: "Hero background is neutral and brand red appears only on focused accents."
  validation:
    inspected_targets:
      - src/app/components/Hero.tsx
```

## Do Not Use

Do not use this skill for:

- Non-TranFu websites, generic landing pages, or unrelated product design systems.
- Pure copywriting review with no TranFu website UI or brand-design impact.
- Redesigning the TranFu logo from scratch.
- Creating a standalone brand book detached from the current React/Vite website.
- One-off code changes where visual consistency is irrelevant.
- Replacing the existing TranFu website visual direction with a new art direction unless the user explicitly asks for a redesign.
