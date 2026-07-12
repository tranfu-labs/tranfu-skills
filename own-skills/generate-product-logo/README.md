[English](./README.md) | [中文](./README.zh.md)

# generate-product-logo

Nails down a product's logo design brief and visual direction first, then generates a comparable set of logo / app icon / favicon candidates. It doesn't lock you into a fixed style — the point is translating product positioning, users, use context, and small-size legibility requirements into executable visual rules.

## When to use it

- You want to explore logo directions for a product that already has a basic positioning.
- You need a browser favicon, app icon, social preview mark, or brand emblem.
- You want to settle the logo's design spec, style constraints, and candidate directions upfront.
- You need to fill in missing product info before generating candidates that can be compared side by side.

## Compared to sibling skills

> Drafted by tranfu-publish, signed off by the author. Helps readers decide which one to install / when to jump to a better-fit sibling.

### Inside the company library
- [visual-pipeline](../visual-pipeline/SKILL.md) — Pushes a converged page spec into a hi-fi page; **this skill differs**: this skill only produces product logo / icon candidates, not full-page UI.
- [daily-report](../daily-report/SKILL.md) — Renders AI daily-brief material into TranFu publish images; **this skill differs**: this skill doesn't render long-form images — it focuses on brand marks and small-size legibility.
- [tranfu-website-design](../tranfu-website-design/SKILL.md) — Maintains the TranFu website's visual system and page consistency; **this skill differs**: this skill is for greenfield product logo exploration, not editing the official site's components.

### Out in the wild
- [logo-designer-skill](https://github.com/neonwatty/logo-designer-skill) — A Claude Code SVG logo design workflow; **this skill differs**: this skill nails the product logo design brief first, then generates candidates and runs a 32px preview check.
- [logo-generator-skill](https://github.com/op7418/logo-generator-skill) — Generates multiple SVG logo variants and showcase images; **this skill differs**: this skill locks in product semantics, style constraints, and small-size legibility standards before entering image exploration.
- [claude-design-skill](https://github.com/jiji262/claude-design-skill) — Generates landing pages, slides, prototypes, and other HTML design artifacts; **this skill differs**: this skill has a narrower scope — only logo / icon.

### What makes this skill unique
- Generates a logo design spec first.
- Style is derived from product positioning.
- Every round runs a 32px legibility check.

## How to use it well

> Drafted with tranfu-publish's guidance. Helps readers get productive quickly.

### What to bring
- Prepare the product name, function, users, and core action.
- Say where it'll be used: favicon / app icon / official site.
- Provide brand colors, reference images, or symbols to avoid.

### Recommended usage
- First run, ask for 3-4 directions.
- After picking one, only change a single axis per iteration.
- Export favicons / social images at the very end.

### Known limitations
- Not a legal trademark review.
- Default output isn't a final vector master.
- Not for pure copywriting or full-page UI.

## How to invoke it

You can say something like:

```text
Use generate-product-logo to produce 4 logo directions for VpnHub. It's a VPN smart-routing platform used by ops staff and administrators, the core actions are routing / distribution / stable connections, and it'll mainly show up as a browser favicon and in the site's header.
```

If product info is incomplete, it will ask one follow-up question first rather than generate right away.

## What you'll get

- A logo design spec and style direction.
- 3-4 logo directions generated against that spec.
- Square candidate images, tuned for icon-first contexts.
- A comparison sheet plus a 32px small-size preview.
- One recommended option, along with the next steps for favicon, app icon, or social preview exports.
