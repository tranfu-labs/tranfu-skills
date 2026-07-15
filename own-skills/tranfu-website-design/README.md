---
prompt_examples:
  - prompt: Add a new "customer stories" section to the TranFu homepage, following the site's brand look.
    scene: Create a page section
  - prompt: Change this CTA button to TranFu brand red — but keep the surface neutral, don't paint a red background.
    scene: Update a component
  - prompt: Review src/app/components/Hero.tsx against the TranFu website design rules — findings only, don't edit.
    scene: Review the design
  - prompt: Run visual QA on the pricing page — desktop and mobile viewport, flag overflow, overlap, or brand-red misuse.
    scene: Check visual details
  - prompt: I need the TranFu favicon and header lockup — use the bundled logo assets, don't grab one from the old deployed site.
    scene: Update logo assets
  - prompt: Refactor this card component but keep the TranFu radii, shadow, and typography intact.
    scene: Refactor without visual changes
  - prompt: Add responsive behavior to the card component while preserving the original TranFu website style. Adapt the card width, layout, spacing, typography, and stacking behavior across desktop, tablet, and mobile breakpoints.
    scene: Responsive adaptation
---

[English](./README.md) | [中文](./README.zh.md)

# TranFu Website Design

A rule set that keeps the TranFu website visually consistent — apply the brand system when building UI, or run review / visual QA without touching a line of code.

## When to use it

**Create a section**:

I'm adding a new section or page on the TranFu site and I want the skill to align brand red, neutral surfaces, type hierarchy, and radii before I write the component.

**Modify a component**:

I'm tweaking a button, card, or hero and I want the skill to catch brand-red misuse or a font-family drift before it lands.

**Review the design**:

I hand over the changed files or screenshots and I want a review — every finding cites a rule and a location, and the skill edits zero files.

**Check visual details**:

I want the skill to check one desktop and one mobile viewport for overflow, overlap, missing responsive framing, or brand red used as a large background.

**Logo & assets**:

I'm placing the favicon, header lockup, or app icon and I want the skill to use the bundled SVG assets under `assets/`, not fetch an old version from a deployed site or `Downloads`.

**Not for**:

Non-TranFu sites → **ui-ux-pro-max**; pure copy edits with no UI or brand impact; redrawing the TranFu logo from scratch; a standalone brand book; one-off code changes where visual consistency is irrelevant.

## What it produces

**Reads `references/design-spec.md` first — if it's missing or unreadable, reports `BLOCKER: missing design spec` and exits.** The most counterintuitive part.

- **`create` / `modify` / `refactor`**: Edits the target files inside the relevant boundary, prints `TRANFU_UI_CHANGE_REPORT` (changed files, design rules used, intentional deviations, desktop and mobile viewport results, command results).
- **`review`**: Findings only, no edits — `TRANFU_DESIGN_REVIEW` with `severity`, rule citation, `location` (file:line / screenshot / UI area), `fix`, and `verification` per finding.
- **`visual QA`**: Inspects one desktop and one mobile viewport, prints `TRANFU_VISUAL_QA_REPORT` with per-viewport `passed | failed | not_run:<reason>`.
- **Ambiguity gate**: If the intent is unclear between implementation and review, the skill asks one concise question before editing.
- **Will never**: redesign unrelated sections, redraw / recolor / stretch the logo, reference `/Users/.../Downloads` paths for logo assets, use brand red `#E63A46` as a large decorative background, or claim a viewport passed when it was never inspected.

## Prerequisites & boundaries

**Prerequisites**:

A TranFu React/Vite project — or at least a target component file, screenshot, or UI area. `references/design-spec.md` must be readable. Bundled logo assets under `assets/` are the source of truth; copy the required one into the project's `public/brand/` before referencing it.

**Adjacent skills**:

| Action | Owner |
|---|---|
| Responsive system across `1920` / `1440` / `1280` / `756` / `375` breakpoints | **tranfu-website-design-system** |
| Non-TranFu brand or generic design system work | **ui-ux-pro-max** |
| Technical / architecture diagrams (not brand UI) | **fireworks-tech-graph** |

**Won't handle**:

- Non-TranFu sites or generic landing pages
- Pure copywriting review with no TranFu UI or brand-design impact
- Redrawing the TranFu logo from scratch
- A standalone brand book detached from the current React/Vite site
- Replacing the existing TranFu visual direction unless the user explicitly asks for a redesign

**Subtle boundaries**:

- No edit authorization → switches to `suggest patch`, keeps the report schema but changes zero files
- No target implementation found for a code-changing task → reports `BLOCKER: target implementation not found` and stops
- Screenshot and code evidence disagree → cites both sources and marks verification as `deferred_with_user_visible_risk`
- Command, dev server, browser, or viewport unavailable → records `not_run:<reason>`, never claims that item passed
