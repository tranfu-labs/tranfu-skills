---
prompt_examples:
  - prompt: Give me 4 dashboard icons — settings, analytics, notifications, users.
    scene: Add icons to a UI
  - prompt: Draw 4 minimal linear UI icons for a payment app.
    scene: Describe the product area
  - prompt: I need a 64×64 icon set, soft pastel backing, 6px stroke, four colors.
    scene: Set the visual style
  - prompt: "My app already uses this linear icon style — extend it with 4 more: cloud, share, upload, download."
    scene: Extend an icon set
  - prompt: "Two colors only, blue and green — 4 messaging icons: DM, group, mute, notification."
    scene: Limit the colors
  - prompt: Design 4 minimal calendar icons, square backing, 6px rounded stroke.
    scene: Set size and stroke
---

[English](./README.md) | [中文](./README.zh.md)

# Linear UI Icon Set

Have AI hand you four style-consistent 64×64 minimal linear UI icons that drop straight into your interface.

## When to use it

**Add icons to a UI**:

I'm building a web dashboard or an app screen and need a set of feature icons with a shared visual language — I want AI to give me four candidates in one go.

**Describe the product area**:

I describe the domain in one sentence (payments / cloud storage / messaging / calendar) and let AI pick the right graphic metaphor for each icon, so I don't have to spell out shapes one by one.

**Extend an icon set**:

My interface already uses a soft-pastel + 6px rounded-stroke icon style; new icons must extend that language rather than shift to a different look.

**Limit the colors**:

I want only two colors — say, blue and green — or only warm tones. The whole set should stay within the palette I dictate.

**Set size and stroke**:

I've already committed to a 64×64 square backing. Any other canvas size is off-scope.

**Not for**:

- Brand logos or brand marks — use a dedicated brand-design tool
- Full-page UI mocks or posters — route to **ui-ux-pro-max**
- Architecture or flow diagrams — route to **fireworks-tech-graph**
- 3D, skeuomorphic, cartoon, doodle, or pixel styles

## What you get

**Always four standalone square icons — never a merged poster, never a full-page UI mock.** That's the whole point.

- **Canvas**: four 64×64px canvases with square (non-rounded) backings; the subject sits centered at ~32–40px with generous margins
- **Stroke**: uniform 6px linear stroke, rounded caps and rounded joins, matching visual weight across all four
- **Palette**: each icon pairs one soft pastel background with a deeper matching stroke color — the default pool is `#FFF3E8` orange / `#F1EAFE` purple / `#EAF2FF` blue / `#EAF8F2` green
- **Graphics**: four distinct metaphors or structures, but stroke, proportion, negative space, and corner handling stay identical
- **Never does**: add text, digits, letters, watermarks, or logos; apply gradients, shadows, highlights, or textures; render rounded backings or transparent backgrounds

## Prerequisites & boundaries

**Prerequisites**:

Any prompt-to-image model (Midjourney, DALL·E, Nano-banana, and so on). This skill produces the prompt — it does not render pixels itself.

**Adjacent skills**:

| Need | Route to |
|---|---|
| Full-page UI mock / poster / landing visual | **ui-ux-pro-max** |
| Architecture / flow / data diagram | **fireworks-tech-graph** |
| Brand logo / trademark / brand mark | Not covered — use a brand-design tool |

**Out of scope**:

- Brand logos, trademarks, or brand-identity marks
- Full-page UI, posters, or promotional visuals with copy
- 3D, skeuomorphic, cartoon, doodle, or pixel styles
- Transparent backgrounds, rounded backings, or elaborate containers

**Subtle boundaries**:

- Asking for a count other than 4 (3, 6, 8) → not triggered; four is a hard constraint
- Asking for a canvas other than 64×64 (128×128, 32×32) → not triggered; the size is part of the constraint
- Asking for two saturations of the same hue → still triggered, as long as one color per icon holds
