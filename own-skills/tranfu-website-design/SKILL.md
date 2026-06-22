---
name: tranfu-website-design
description: Apply TranFu website brand and UI design rules when Codex creates, modifies, refactors, reviews, or visually QA's TranFu React/Vite website pages and components. Trigger for "按 TranFu 风格做一个新区块", "检查这个页面是否符合 TranFu 网站设计规范", Figma-to-code integration, or tasks touching TranFu website layout, colors, typography, logo, UI components, motion, screenshots, or product-facing copy. Do NOT trigger when the site is not TranFu, the request is pure copywriting with no UI/brand impact, a standalone brand book, a logo redesign from scratch, or a visual-irrelevant code change.
version: 0.1.1
author: aquarius-wing
updated_at: 2026-06-22
origin: own
---

# TranFu Website Design

Use this skill to preserve the TranFu website's visual language while creating, modifying, or reviewing UI.

## Core Reference

Read `references/design-spec.md` before making brand, layout, component, motion, media, or copy decisions.

Load only the sections needed for the task after the first pass:
- Layout and page structure: sections 2, 6, and 13.
- Color, typography, radius, components: sections 3, 5, 7, and 8.
- Logo usage: section 4.
- Background, decoration, and motion: sections 9 and 10.
- Copy tone: section 11.
- Final visual review: section 12.

## Logo Assets

This skill includes canonical TranFu logo assets exported from the TranFu Figma file in `assets/`.

When implementing a TranFu website or app, use these bundled assets first:
- `assets/logo-lockup-h-en-primary-on-light.svg` for the standard red horizontal lockup on light backgrounds.
- `assets/logo-symbol-primary.svg` for compact brand symbol use such as favicons, avatars, and tight UI spaces.
- `assets/logo-wordmark-primary.svg` for wordmark-only brand use.
- `assets/app-icon-primary.svg` for app icon or square social/icon previews.

Copy the required asset into the target project, preferably under `public/brand/`, then reference the project-local asset. Do not reference `/Users/.../Downloads` paths, do not fetch logo assets from older deployed sites, and do not redraw, recolor, stretch, crop, or add effects to the logo.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW.

1. Read the user request and identify the target project, page, component, or UI area. If the request has no TranFu website UI or brand-design impact, state that this skill is out of scope and stop using it.
2. Read `references/design-spec.md` before making brand, layout, component, motion, media, or copy decisions. If the reference is unavailable or unreadable, report a BLOCKER with the missing path and stop.
3. Classify the task as create, modify, refactor, review, or visual QA. If the task cannot be classified from the request and local context, ask one concise clarification and stop.
4. Inspect the relevant existing code before changing UI. Prefer these files when present:
   - `src/styles/theme.css`
   - `src/styles/fonts.css`
   - `src/styles/index.css`
   - `src/app/App.tsx`
   - `src/app/components/*`
   - `src/imports/*/index.tsx`
   If the target project or relevant files cannot be found, report a BLOCKER with the searched paths and stop.
5. Route by task type:
   - Create, modify, or refactor -> run subflow "Implement UI".
   - Review -> run subflow "Review UI".
   - Visual QA -> run subflow "Visual QA".
   - Otherwise -> report the unsupported task type and stop.
6. Run the relevant validation in "Validation" and finish with the output required by "Outputs and Done Criteria".
7. Report any intentional deviation from `references/design-spec.md`, the reason it was necessary, and any skipped verification with a concrete reason. End.

Subflow "Implement UI":

1. Reuse existing TranFu tokens, layout scale, typography, component patterns, and motion conventions before introducing new ones.
2. Keep the visual direction system-like, restrained, engineering-oriented, and product-grounded. Prefer real product screenshots or interface-like visuals over abstract illustration.
3. Copy required bundled logo assets into the target project before referencing them.
4. Implement narrowly inside the relevant component, style, or asset boundary. Do not redesign unrelated sections.
5. Return to step 6 of the main workflow.

Subflow "Review UI":

1. Produce findings first. Tie each finding to a specific rule in `references/design-spec.md` and a concrete file or UI area. If local context does not expose a concrete file or UI area, state the missing context in the finding.
2. Do not edit files unless the user explicitly asks for edits.
3. Return to step 6 of the main workflow.

Subflow "Visual QA":

1. Run the local frontend when UI behavior or layout changed.
2. Inspect at least one desktop viewport and one mobile viewport. If a dev server, browser tool, dependency, or viewport check is unavailable, record the skipped check and concrete reason for the final response.
3. Return to step 6 of the main workflow.

## Design Rules

- Use Brand Red `#E63A46` only for logo, primary actions, active states, focus, or key emphasis. Do not use it as a large decorative background.
- Keep page and section surfaces in the TranFu neutral system, especially `#F0F0F0`, `#F7F7F7`, `#F5F5F5`, white, and the documented border grays.
- Preserve the 1920-stage logic and existing centered content widths unless the task explicitly asks for a new responsive model.
- Use the documented font hierarchy: `MiSans` for regular UI, `Alimama_ShuHeiTi` for hero-scale headings, and `Hammersmith One` for command/badge-like English text.
- Keep radii inside the documented scale: `6`, `8`, `12`, `16`, `24`, `30`, `40`, or full radius for status dots and circular buttons.
- Keep cards light by default; add stronger shadow only for hover or active affordance.
- Use the standard logo lockup and badge rules. Never redraw, stretch, decorate, or repurpose the logo as a generic icon.
- Keep motion subtle and respect `prefers-reduced-motion`.
- Make copy concrete, engineering-oriented, and tied to real work. Avoid vague marketing claims.

## Validation

Before finishing a create, modify, or refactor task:

- Confirm the changed UI follows the relevant sections of `references/design-spec.md`.
- Confirm colors, fonts, radii, spacing, logo treatment, media style, motion, and copy tone do not introduce a conflicting visual system.
- Confirm brand red remains a focused accent.
- Confirm new media is a real product screenshot, interface capture, or UI-like product visual unless the user explicitly asks for another direction.
- Confirm text does not overflow or overlap in checked viewports.
- Confirm reduced-motion handling remains intact when animation is added or changed.
- Run the project's lint, typecheck, build, or targeted tests when the commands exist and the change touches implementation logic or shared UI. If a command cannot be run, report the skipped command and concrete reason.

For review-only tasks, produce findings first. Tie each finding to a specific rule in `references/design-spec.md` and a concrete file or UI area. If local context does not expose a concrete file or UI area, state the missing context in the finding.

## Outputs and Done Criteria

Create, modify, or refactor done = changed files are limited to the relevant UI/style/asset boundary, required assets are project-local, the relevant `references/design-spec.md` checks pass or deviations are reported, desktop and mobile viewport checks are completed or skipped with reasons, and verification commands present in the project scripts are run or skipped with reasons.

Review-only done = findings are listed before summary, each finding has a concrete file or UI area, each finding cites the relevant design-spec rule, and no files are edited unless the user explicitly asks for edits.

Visual QA done = checked viewport sizes, observed issues, design-spec deviations, skipped checks, and verification blockers are reported in the final response.

## Do Not Use

Do not use this skill for:

- Non-TranFu websites, generic landing pages, or unrelated product design systems.
- Pure copywriting review with no TranFu website UI or brand-design impact.
- Redesigning the TranFu logo from scratch.
- Creating a standalone brand book detached from the current React/Vite website.
- One-off code changes where visual consistency is irrelevant.
- Replacing the existing TranFu website visual direction with a new art direction unless the user explicitly asks for a redesign.
