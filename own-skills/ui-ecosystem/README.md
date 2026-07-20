---
description: Match an established frontend direction with compatible UI tools, libraries, examples, and skills before implementation starts.
prompt_examples:
  - prompt: Recommend the best UI ecosystem for this Next.js and Tailwind dashboard.
    scene: Recommend UI tools
  - prompt: Use compatible ecosystem components to build this settings page.
    scene: Build with the ecosystem
  - prompt: Audit this existing UI for places where we are hand-rolling too much.
    scene: Audit ecosystem use
---

# ui-ecosystem

Turn an established frontend direction into a practical ecosystem plan so the UI can borrow mature components and patterns instead of rebuilding everything.

## When to use it

**Recommend UI tools**

My framework, styling approach, page type, and design direction are already known, and I want stack-matched libraries, tools, skills, plugins, or official examples.

**Build with the ecosystem**

I want a page built or polished, and expect approved ecosystem choices to be used in the actual implementation rather than left as a recommendation list.

**Audit ecosystem use**

I have an existing interface and want to identify custom controls, icons, motion, forms, tables, or charts that should rely on mature project-compatible primitives.

**Not for**

Use strategy work before the product shape or frontend direction exists. Use dedicated review workflows for accessibility-only audits, generic design compliance, backend bugs, tiny CSS fixes, or installation of one already selected package.

## What it produces

**A `UI_ECOSYSTEM_PACKET` is produced before any frontend edit or dependency installation.**

- **Context summary**: records the framework, styling, design system, page type, constraints, and local files inspected.
- **Decision matrix**: labels each candidate `adopt`, `activate`, `absorb`, `spike`, or `reject`, with fit, risk, and action.
- **Implementation plan**: lists planned installations or activations, the remaining custom surface, verification methods, and unresolved items.
- **Mode-dependent side effects**: recommendation mode is read-only; implementation mode may edit UI files and install authorized dependencies; audit mode edits only when fixes are requested.
- **Verification evidence**: runs relevant type checks, lint, tests, builds, and browser inspection when rendered UI changes.
- **Never does**: it does not invent tool names, install without authority, copy unlicensed templates, or let ecosystem tools override project, accessibility, or design-system rules.

## Prerequisites and boundaries

**Prerequisites**

The frontend framework, styling approach, page or application type, and enough design context must already exist. Project rules, manifests, components, styling configuration, and current official documentation need to be inspectable.

**Discovery requirements**

- Available MCPs, plugins, and skills must be discovered before they are named as usable.
- Existing project libraries and design-system primitives take priority over new dependencies.
- License, compatibility, bundle impact, runtime impact, and accessibility risk are checked before adoption.

**Nearby responsibilities**

| Need | Use instead |
|---|---|
| Choose product shape or frontend stack | `strategy-first-development` |
| Apply TranFu brand rules | `tranfu-website-design` |
| Review accessibility or design compliance | `web-design-guidelines` |

**Subtle boundary**

“Recommend tools” stops after the packet. “Build,” “polish,” or “improve the UI” continues into implementation, but dependency installation still requires clear authorization.
