# Artifact Router

Use this reference to choose the output structure for `visual-design-producer`.

## Routing Table

| User target | Default output | Notes |
|---|---|---|
| Website or landing page | HTML page | Use responsive layout, clear content hierarchy, and original composition. |
| App UI | HTML prototype | Include realistic screens and interaction states when useful. |
| Dashboard | HTML dashboard | Prioritize density, scan paths, data hierarchy, and control states. Avoid fake metrics unless supplied. |
| PPT or deck | HTML deck plus slide outline | Use fixed-size slide logic when implementing deck HTML. Keep slide text appropriately large. |
| Poster | HTML poster | Use fixed composition, strong hierarchy, and print/social-safe dimensions when specified. |
| WeChat article visual | HTML article layout plus export guidance | Respect long-form reading rhythm and image/caption placement. |
| Xiaohongshu card or carousel | HTML card/carousel | Use mobile-first composition and strong per-card hierarchy. |
| Product prototype | HTML clickable prototype | Include navigation and stateful interactions that fit the brief. |
| Prompt requested | HTML plus copyable production prompt | The prompt should describe the new original artifact, not the source sample. |
| CSS requested | HTML plus CSS variables/tokens | Include variables for colors, type, spacing, radius, surfaces, and state colors. |

## Route Selection Rules

- If the user gives a channel, choose the matching route.
- If the channel is ambiguous, ask one focused clarification question.
- If the user requests a non-HTML-only workflow, follow that request and state which HTML default was skipped.
- If multiple outputs are requested, make HTML the primary artifact and attach secondary outputs.
- If content is missing, use structure-preserving placeholders sparingly and mark assumptions.

## Medium Adaptation

Do not copy the source sample composition. Translate DNA into medium-specific decisions:

- Landing page: narrative hierarchy, conversion path, hero/supporting sections.
- Dashboard: dense information architecture, filters, tables, charts, state colors.
- Deck: slide rhythm, section breaks, large type, image strategy.
- Poster/card: single-glance hierarchy, crop, balance, and export dimensions.
- Prototype: screens, state transitions, affordances, and interaction feedback.
