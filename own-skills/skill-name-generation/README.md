---
description: "Generate paired English + Chinese display names for an existing skill — 1 recommended + 3 alternates in a single pass, candidates only, no files touched."
prompt_examples:
  - prompt: Give me an English + Chinese display_name for this skill — I'll paste the description.
    scene: Name one skill
  - prompt: None of the skills under own-skills/ have display_names yet — backfill the whole batch with the same conventions.
    scene: Name several skills
  - prompt: Come up with a display_name and display_name_zh for skill-content-fit.
    scene: Name a specific skill
---

# skill-name-generation

Generate paired English + Chinese display names for an existing skill — 1 recommended + 3 alternates in a single pass, candidates only, no files touched.

## When to use it

**Name one skill**:

You just finished the slug and description for a skill and need to fill in `display_name` / `display_name_zh` in its frontmatter — you want paired candidates in one shot.

**Name several skills**:

A batch of older skills in the repo has slugs but no display names. You want the same conventions applied across the board, English and Chinese paired without drift.

**Regenerate display names**:

An existing display name reads like an explanation, not a name; or the word you'd reach for when trying to find this skill later doesn't appear in it. You want to see whether a tighter candidate exists.

**Path-only input**:

You don't want to copy-paste the slug and description — hand over a `SKILL.md` path and let the skill pull them from the frontmatter itself.

**Out of scope**:

Naming a product / feature / module → **product-title-generation**; naming a skill's slug (lowercase, hyphenated) → **skill-domain-framing**; deciding whether a piece of content is worth crystallizing into a skill → **skill-content-fit**; code variables / functions / classes, ad slogans / marketing copy / SEO titles / trademark clearance → don't trigger.

## What it produces

**Candidate text only — never edits any file. Whether and where to write is your call.** This is the most counterintuitive part.

- **Paired in one pass**: 1 recommended + 3 alternates. Each set = `display_name` (English, Title Case phrase) + `display_name_zh` (Chinese, 4–8 characters) + one line of rationale (must call out which phrase in the description the core word was pulled from).
- **Never does**: touch the target skill's `SKILL.md` / `agents/openai.yaml` / `index.json` or any other repo file.

## Prerequisites & boundaries

**Prerequisites**:

Needs two pieces of information — the skill's slug and its description. Alternatively, hand over a `SKILL.md` path and the skill will pull `name` and `description` from the frontmatter itself (body ignored). If both are missing, ask once; if still missing, stop.

**Adjacent skills**:

| Task | Route to |
|---|---|
| Name a skill's slug (lowercase, hyphenated) | **skill-domain-framing** |
| Name a short Chinese title for a product / feature / module | **product-title-generation** |
| Orchestrate the full skill creation flow | **skill-create-workflow** |

**Out of scope**:

- Code variable / function / class naming
- Ad slogans / marketing copy / SEO titles / trademark clearance
- Bootstrapping a skill from scratch (that's **skill-create-workflow**)

**Subtle edges**:

- Target skill already has a `display_name` → ask once "regenerate or keep", default to keep if the user doesn't confirm
- Slug suffixes (`-workflow` / `-set` / `-review`) are only auxiliary signals; the primary job is always judged by the first capability verb in the description
