---
description: "Turn designed visual evidence into a debranded, reusable illustration-style bundle for one content platform."
prompt_examples:
  - prompt: "Build a reusable Xiaohongshu illustration style from this designed card."
    scene: Build from a design
  - prompt: "Compile this visual DNA document into a WeChat style candidate."
    scene: Compile visual DNA
  - prompt: "I reviewed the contact sheet; approve this style and install it locally."
    scene: Approve a style bundle
---

# Visual Style Bundle Builder

Build a reusable style bundle without copying identity.

## When to use it

**Build from a design**

I have a designed poster, knowledge card, infographic, illustration, or interface and want a reusable style for one named content platform.

**Compile visual DNA**

I already have a structured visual system description and want it compiled into a portable candidate with platform geometry and calibration images.

**Approve a style bundle**

I have reviewed the three calibration images and contact sheet. I want the candidate formally approved and, only if requested, installed into the illustration registry.

**Won't take**

This is not for one-off image generation, ordinary editing, natural-photo presets, logo extraction, exact cloning, or installing an unreviewed result.

## What it produces

**A generated candidate is not approved; a human must review the calibration images first.**

- **Visual evidence**: Saves normalized Visual DNA, source provenance, confidence, and originality checks without retaining the source image
- **Style contract**: Writes a debranded `style.md` and platform-specific `style.spec.json`
- **Calibration set**: Generates independent concept, process, and checklist images plus a contact sheet
- **QA record**: Scores each image, selects an unbranded reference, and validates the complete candidate bundle
- **Lifecycle state**: Moves through draft, ready for review, approved, installed, or blocked without skipping gates
- **External activity**: Uses a verified image backend for calibration and may incur generation cost
- **Never**: Passes the source image to generation, copies source identity, or installs without explicit review and approval

## Prerequisites & boundaries

**Prerequisites**

Provide a readable designed image or a complete Visual DNA document, an explicit target platform, and an output root. Image input needs at least four observable design signals and a shortest edge of 512 pixels.

**Neighbor skill split**

| Need | Hand off to |
|---|---|
| Extract richer Visual DNA | **visual-dna-system** |
| Produce article illustrations | **post-illustration-images** |

**Scenarios it declines**

- Natural photos, pure logos, blurry crops, or identity-dominated artwork
- Requests to preserve a brand, slogan, character, or exact layout
- Approval or installation before calibration, QA, and human review

**Subtle edges**

- The target platform must be named; it is never inferred from source dimensions
- An approved bundle remains portable even when the downstream installer is unavailable
- Missing evidence can leave a DNA-based candidate in draft, but it cannot become review-ready
