---
description: "Choose or review the structural layout for a TranFu page before visual styling or implementation begins."
prompt_examples:
  - prompt: "Choose the right layout system for this SaaS management page."
    scene: Choose a page layout
  - prompt: "Review this dashboard structure and flag layout problems."
    scene: Review page structure
  - prompt: "Plan how this desktop workspace should reorganize on mobile."
    scene: Plan responsive structure
---

# TranFu Layout Systems

Choose page structure before styling or implementation.

## When to use it

**Choose a page layout**

I am creating a website, SaaS screen, knowledge base, landing page, form, wizard, dashboard, or detail page and need the right structural model before styling.

**Review page structure**

I have a page, screenshot, file, or running interface and want its navigation, information hierarchy, workspace, and required states reviewed.

**Plan responsive structure**

I need to decide what stays primary, what collapses, and what becomes a drawer or separate path as the page moves from desktop to mobile.

**Won't take**

This is not for copywriting, logos, color and typography choices, component styling, or any change that leaves page structure untouched.

## What it produces

**It makes layout decisions only; it never edits code, design files, or brand assets.**

- **Layout decision**: Names one primary system, frame layout, and page pattern with desktop and mobile structure
- **Layout review**: Reports observed structural issues, evidence, severity, consistency, and allowed deviations
- **Blocker record**: Returns a named blocker when the activity, evidence, or required reference cannot support a decision
- **Implementation handoff**: Can pass the named layout artifact to `tranfu-website-design` when implementation is also requested
- **Never**: Chooses visual tokens, invents unobserved interface facts, or modifies project files

## Prerequisites & boundaries

**Prerequisites**

Provide a page description, file, screenshot, running target, or enough task context to identify the user's main activity. The required `references/layout-contracts.md` must be readable.

**Neighbor skill split**

| Need | Hand off to |
|---|---|
| Visual styling and implementation | **tranfu-website-design** |
| Reusable visual style extraction | **visual-builder** |

**Scenarios it declines**

- Pure copy or brand-asset work
- Color, type, radius, shadow, or icon decisions without structural change
- Reviews where page, code, screenshot, and runtime evidence materially conflict

**Subtle edges**

- More information does not automatically justify a multi-panel layout
- Mobile structure is reorganized by task priority, not merely scaled down
- Unobserved viewports and states are marked `not_run`, never guessed as passing
