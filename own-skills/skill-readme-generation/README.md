---
prompt_examples:
  - prompt: Just finished own-skills/skill-name-generation—generate its companion README too.
    scene: Document a new skill
  - prompt: Backfill READMEs for every skill under own-skills/ that's missing one.
    scene: Add missing READMEs
  - prompt: This README is the old single-language version—regenerate it bilingual, overwrite.
    scene: Replace an old README
  - prompt: Generate the README for own-skills/openspec-driven-development/.
    scene: Document a specific skill
  - prompt: This skill goes live on the catalog soon—get its README ready first.
    scene: Prepare for publishing
  - prompt: Same treatment as skill-name-generation—give this skill a README too.
    scene: Follow another README
---

[English](./README.md) | [中文](./README.zh.md)

# Skill README Generation

Turn any existing skill's `SKILL.md` into a bilingual, human-readable pair — English `README.md` plus Chinese `README.zh.md` — ready for the internal skill catalog page.

## When to use it

**Document a new skill**:

I just wrapped up a new skill and its `SKILL.md` is written. Now I want to list it on the internal catalog, so I ask this skill to hand-craft the paired README on the spot.

**Add missing READMEs**:

`own-skills/` still holds a batch of older skills that never got a README. I want every missing one filled in with the same spec — one independent pair per directory, never merged.

**Replace an old README**:

Some skill's old README was hand-written way back and its shape no longer matches the current spec. I say "regenerate to the new bilingual shape and overwrite" and both files get rewritten.

**Prepare for publishing**:

I'm about to publish a skill to the catalog detail page. That page reads the example prompts from the README's top matter and renders them as scene tabs — no README, nothing to show.

**Follow another README**:

I point at a peer skill that already has a good README and say "give this one the same treatment." The skill mirrors that shape against my target's own SKILL.md.

**Won't take**:

Editing one paragraph of an existing README — plain editing is enough; building a `SKILL.md` or a whole skill from scratch → **skill-create-workflow**; naming a skill (`display_name` / `display_name_zh`) → **skill-name-generation**; picking the English directory slug → **skill-domain-framing**; deciding whether a piece of content deserves to become a skill → **skill-content-fit**; the target's `SKILL.md` is too thin and needs a full review → **skill-improve-workflow**.

## What it produces

**One call writes two files — English `README.md` and Chinese `README.zh.md`, matched in structure but never word-for-word translated.**

- **Writes**: `<skill dir>/README.md` (English body) plus `<skill dir>/README.zh.md` (Chinese body)
- **Language switcher**: each file drops `[English](./README.md) | [中文](./README.zh.md)` right below the top matter, above the H1
- **Top matter**: only field is `prompt_examples` — 5-6 natural spoken lines, covering at least 4 distinct trigger scenes
- **Four sections**: opening one-liner, when to use it, what it produces, prerequisites & boundaries — each version 30-80 lines
- **Plain-language pass**: the Chinese version is scanned line by line, insider slang gets rewritten in plain Chinese so a non-author can still read it
- **Terminal report**: both output paths, line counts, prompt_examples count, covered scenes, and any "not sure about" note
- **Never touches**: the target's `SKILL.md` or any other file in the repo

## Prerequisites & boundaries

**Prerequisites**:

Target is a skill directory containing `SKILL.md` with complete top matter and a description. No external dependencies — no network, no API calls, no subagent spawns.

**Neighbor skills**:

| Action | Route to |
|---|---|
| Build a skill from scratch (SKILL.md skeleton included) | **skill-create-workflow** |
| Name a skill (`display_name` / `display_name_zh`) | **skill-name-generation** |
| Pick the English directory slug (kebab-case) | **skill-domain-framing** |
| Decide whether a piece of content deserves a skill | **skill-content-fit** |
| SKILL.md too thin — needs a full quality review | **skill-improve-workflow** |

**Won't take**:

- Editing one section of an existing README — plain editing is enough
- Writing a README for a non-skill project or general docs
- CI checks on existing README top-matter compliance — that's a script's job

**Fine-grained boundaries**:

- Target already has `README.md` or `README.zh.md` and the user didn't say "regenerate / overwrite" → ask once, don't clobber
- Target `SKILL.md` too thin to yield four solid sections → stop and route to **skill-improve-workflow** first, rather than pad with hollow text
- Target skill has no `display_name` → still generate the README, and flag the routing to **skill-name-generation** in the report
