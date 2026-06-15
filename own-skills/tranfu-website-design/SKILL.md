---
name: tranfu-website-design
description: Apply TranFu website brand and UI design rules when Codex creates, modifies, refactors, reviews, or visually QA's TranFu React/Vite website pages and components. Use for requests like "按 TranFu 风格做一个新区块", "检查这个页面是否符合 TranFu 网站设计规范", "重构这个组件但保持官网风格", "把 Figma 导出组件融入 TranFu 网站", or any task touching TranFu website layout, colors, typography, logo usage, UI components, motion, screenshots, or product-facing copy.
version: 0.1.0
author: aquarius-wing
updated_at: 2026-06-15
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

## Workflow

1. Classify the task as create, modify, refactor, review, or visual QA.
2. Inspect the relevant existing code before changing UI. Prefer these files when present:
   - `src/styles/theme.css`
   - `src/styles/fonts.css`
   - `src/styles/index.css`
   - `src/app/App.tsx`
   - `src/app/components/*`
   - `src/imports/*/index.tsx`
3. Reuse existing TranFu tokens, layout scale, typography, component patterns, and motion conventions before introducing new ones.
4. Keep the visual direction system-like, restrained, engineering-oriented, and product-grounded. Prefer real product screenshots or interface-like visuals over abstract illustration.
5. Implement narrowly inside the relevant component, style, or asset boundary. Do not redesign unrelated sections.
6. Run the local frontend when UI behavior or layout changed. Inspect at least one desktop viewport and one mobile viewport when feasible.
7. Report any intentional deviation from `references/design-spec.md` and why it was necessary.

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
- Run the project's available lint, typecheck, build, or targeted tests when the change touches implementation logic or shared UI.

For review-only tasks, produce findings first. Tie each finding to a specific rule in `references/design-spec.md` and a concrete file or UI area when possible.

## Do Not Use

Do not use this skill for:

- Non-TranFu websites, generic landing pages, or unrelated product design systems.
- Pure copywriting review with no TranFu website UI or brand-design impact.
- Redesigning the TranFu logo from scratch.
- Creating a standalone brand book detached from the current React/Vite website.
- One-off code changes where visual consistency is irrelevant.
- Replacing the existing TranFu website visual direction with a new art direction unless the user explicitly asks for a redesign.
