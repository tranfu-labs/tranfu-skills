---
prompt_examples:
  - prompt: Design the settings page for our internal review tool.
    scene: Design a new page
  - prompt: The header on the review page doesn't feel right, help me fix it.
    scene: Improve an existing design
  - prompt: Take the dashboard, list, and detail pages of the new product through the pipeline one by one.
    scene: Design several pages
  - prompt: Fields and user scenario are already locked, push it straight to high-fidelity.
    scene: Start the visual design
  - prompt: The overall vibe is off, I want a magazine feel instead of a dashboard feel.
    scene: Change the visual style
  - prompt: Get the wireframe out first, don't jump to color yet — I want to see the skeleton before pixels.
    scene: Review the layout first
---

[English](./README.md) | [中文](./README.zh.md)

# visual-pipeline

A back-half product-design pipeline: given "user scenario + what to display" as input, drive it to a high-fidelity chosen version.

The unit is a **page**. One page runs the pipeline once. Three stages in strict order: display info → skeleton → style + practice. Every stage writes docs before HTML, no stage-skipping, and every change goes through a routing decision.

Code implementation and everything after it are out of scope.

## When to use it

- The user says "design / build / change page X" and the ask is on the visual / product layer
- Input has already converged to "user scenario + what to display", now waiting to be turned into pixels
- One page one run, multiple pages multiple runs, each page judges its own style

Not for: pure copy tweaks / single-bug code fixes / pure backend work / requirement-discovery stage where the ask is still unclear.

## Comparison with similar skills

> Drafted by tranfu-publish, signed off by the author. Helps a reader decide horizontally which one to install, or jump to a better-fit sibling.

### Inside the company library
- [ui-ux-pro-max](../../external-skills/ui-ux-pro-max/SKILL.md) — a UI/UX material library (67 styles / 96 palettes / 57 font pairings); **this skill differs**: it's a material library called inside the "style stage"; this skill is process discipline, governing stage order and change routing
- [claude-design-system](../../external-skills/claude-design-system/SKILL.md) — a mirror of Anthropic's internal design-tool system prompt (a reference for HTML artifacts); **this skill differs**: it's a prompt reference, whereas this skill is an executable pipeline that enforces non-skippable stages

### Outside world
- [claude-wireframe-skill](https://github.com/Magdoub/claude-wireframe-skill) — one-shot output of five B&W wireframes plus parallel color variants; **this skill differs**: that one is "many parallel options", this one is "single page in depth with reversible changes"
- [claude-design-skill](https://github.com/jiji262/claude-design-skill) — a replica of the Claude.ai internal prompt, produces HTML artifacts (decks / landing / animation); **this skill differs**: that one covers a wide range (including slides and posters), this one is scoped to page design with a mandatory three-stage order

### Unique value of this skill
- Mandatory stages, docs before HTML, so visual decisions leave a traceable paper trail
- Any change is routed to its owning stage first, preventing the historical blocker from coming back
- Each page has its own style stage, protecting per-page choices from being flattened by a project-wide tone

## Tips for using it

> Drafted by the author. Helps a reader get started vertically.

### Material lessons
- We tried "one-shot pile of HTML, let the user pick" — decisions had no docs, no way to roll back, and round two fell apart
- We tried "one style fits all pages" — special per-page scenarios got flattened, and after a few user rejections there was no anchor left

### Recommended usage
- First confirm the page output directory with the caller (e.g. `web-goal-docs/<page>/`)
- Run all three stages on the first page to set a baseline; later pages can reference "inherited from the project shared design language"
- When the user says "wrong", route first, then edit — don't jump straight into the HTML; this is the core discipline

### Known limits
- Doesn't make requirement-layer decisions (user scenario, field priority) — inputs must be locked upstream
- Doesn't emit code; `03-selected.html` is the ground truth, decisions made at code layer can't roll back into the style stage
- Everything is in Chinese, artifacts forbid short labels like S1/P0/R1 (may not match the conventions of an English-first project)
