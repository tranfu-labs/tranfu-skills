---
description: A brand-neutral baseline for designing, implementing, reviewing, and visually validating websites and product interfaces while preserving the target project's existing design system.
prompt_examples:
  - prompt: Design and implement this SaaS dashboard using the project's existing components and theme.
    scene: Build a product interface
  - prompt: Review this website's typography, spacing, component states, and responsive behavior.
    scene: Review a website UI
  - prompt: Refactor these forms and tables without changing the current brand or technology stack.
    scene: Refactor existing UI
---

# Website & Product UI Design

Use a consistent, brand-neutral UI baseline across websites, landing pages, SaaS products, dashboards, forms, tables, and responsive application shells.

## When to use it

- Create or modify a website or product interface inside an existing project.
- Translate a design into code while preserving the project's framework, tokens, components, and theme.
- Review typography, spacing, radius, controls, icons, depth, states, or responsive behavior.
- Run visual QA against real rendered viewports and interaction states.

## What it standardizes

- Separate typography scales for marketing websites and dense product interfaces.
- A 16px body baseline, 400/600 font weights, and 150% line height.
- An 8px spacing grid with a single 4px micro-spacing exception.
- Semantic radius, control height, hit-target, depth, and layer roles.
- One primary functional icon system with semantic aliases and verified exports.
- Distinct focus, selected, loading, empty, error, success, disabled, and read-only states.
- Responsive containers, breakpoints, reflow strategies, and observable viewport checks.

## Decision order

The user's explicit request and the target project's design system always take precedence. The bundled defaults apply only when the project has no corresponding rule.

The skill does not generate or choose a color palette. When no color system exists, it can establish structure, typography, spacing, component roles, and state semantics while leaving color decisions out of scope.

## Not for

- Organization-specific brand governance, including TranFu-only brand rules.
- Standalone color systems, font pairing, brand identity, or logo design.
- Copy-only, backend-only, or visually irrelevant changes.
- Accessibility, performance, or compliance audits when no UI design decision is requested.

## Outputs

Depending on the task, it returns one structured report:

- `UI_CHANGE_REPORT` for creation, modification, or refactoring.
- `UI_DESIGN_REVIEW` for evidence-backed design review.
- `UI_VISUAL_QA_REPORT` for rendered viewport validation.
- `UI_DESIGN_BLOCKER_REPORT` only when required inputs or dependencies prevent progress.
