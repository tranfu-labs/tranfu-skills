---
description: Generate semantic 48×48 SVG and PNG icons for one Skill at a time, with brand-logo handling, similarity checks, and OpenAI interface metadata updates.
prompt_examples:
  - prompt: Generate icons for own-skills/my-skill without replacing existing assets.
    scene: Generate icons
  - prompt: Replace this Skill icon with a better semantic mark.
    scene: Replace an icon
  - prompt: Run the icon generator self-check after upgrading dependencies.
    scene: Self-check
---

# Skill Icon Generator

Create one verified Skill icon package at a time: `assets/icon.svg`, `assets/icon.png`, and matching `agents/openai.yaml` metadata.

## When to use it

**Generate icons**

I have a Skill directory with `SKILL.md` and want a 48×48 icon that matches the Skill’s core task, not just a keyword in the name.

**Replace an icon**

I explicitly want to replace an existing icon because it is duplicated, unclear, or semantically wrong, and I accept that the generator will use `--force`.

**Self-check**

I upgraded dependencies, moved machines, or suspect the generator runtime is broken, so I want the bundled checks to prove Sharp, Lucide masters, brand marks, and similarity gates work.

**Not for**

This is not for batch icon rewrites, non-Skill icons, website assets, deployment work, CI changes, or logo redesign.

## What it produces

**Existing icon files are protected unless replacement is explicit.** The generator stops instead of silently overwriting assets.

- **Icon assets**: writes `assets/icon.svg` and `assets/icon.png`, with the PNG verified as a real 48×48 file.
- **Interface metadata**: updates `agents/openai.yaml` with `icon_small` and `icon_large` while preserving other fields.
- **Brand handling**: brand-bound Skills use a verified pure brand mark and official color when the brand is registered.
- **Similarity report**: enforces a perceptual similarity gate so non-brand icons stay visually distinct.
- **Never does**: bypass the gate, invent a brand logo from memory, rewrite batches, or modify CI / website / deployment configuration.

## Prerequisites & boundaries

**Prerequisites**

The target must be one Skill directory or `SKILL.md`. The generator needs Node.js and its local Sharp dependency installed under the generator Skill directory.

**Adjacent work**

| Need | Use instead |
|---|---|
| Create or repair the Skill content itself | Skill creation / improvement workflow |
| Write README presentation copy | `skill-readme-generation` |
| Design product or website icons | A brand or UI design workflow |

**Hard boundaries**

- One invocation handles one target Skill.
- Brand marks must come from the registry or a verified official source.
- Non-brand icons must express the primary task shape and pass the similarity threshold.
- Failure reports are final until the user chooses a different icon, brand source, or replacement scope.
