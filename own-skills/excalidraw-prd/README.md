---
description: Draw consistent Excalidraw PRD prototypes with explicit page boundaries, structured product annotations, and direct navigation arrows.
prompt_examples:
  - scene: Draw a PRD prototype
    prompt: Use $excalidraw-prd to turn this PRD into an annotated Excalidraw prototype.
  - scene: Improve an existing board
    prompt: Use $excalidraw-prd to fix the page frames, annotations, and navigation arrows in this Excalidraw PRD.
  - scene: Add product annotations
    prompt: Use $excalidraw-prd to add structured product annotation cards around these page designs.
---

# Excalidraw PRD

Create or revise Excalidraw PRD prototypes with a consistent visual grammar for page boundaries, product annotations, and navigation.

## When to use it

- Turn a written PRD into an Excalidraw page prototype.
- Add product annotations that explain module responsibilities, state boundaries, business rules, and recovery paths.
- Repair crowded or incomplete page frames in an existing PRD board.
- Make page-to-page navigation explicit and traceable from the real interaction point.

## What it enforces

- Each page uses a rectangle as its visible boundary.
- A named outer frame contains both the page rectangle and its product annotations.
- Product annotations sit outside the page rectangle but inside its outer frame.
- Annotation cards use a semantic-color number marker, matching border, dark title, and gray description.
- Navigation uses a solid arrow from the real action point to the destination page; long return arrows handle cross-canvas or loop-back routes.

## Boundaries

This Skill defines the structure and presentation of Excalidraw PRD boards. It does not write the product requirements, implement frontend code, or replace a technical architecture-diagram skill.
