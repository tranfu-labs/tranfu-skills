---
prompt_examples:
  - prompt: Turn docs/postmortem.md into a project-level skill.
    scene: Build from a source file
  - prompt: Yeah, make that a skill.
    scene: Continue from earlier context
  - prompt: Let's skill-ify the release checklist we just talked about.
    scene: Turn an idea into a skill
  - prompt: Package this daily-report workflow as a new skill under own-skills/.
    scene: Turn a workflow into a skill
  - prompt: Create a company skill from my brand-voice notes and publish it.
    scene: Create and publish
  - prompt: Wrap that agent's system prompt into a Codex skill.
    scene: Turn a prompt into a skill
---

[English](./README.md) | [中文](./README.zh.md)

# skill-create-workflow

Turn a reusable idea, postmortem, or prompt into a new skill — three gates (content-fit, naming, prompt review) run before anything hits disk.

## When to use it

**Fresh idea worth crystallizing**:

Something in your head or in a doc — a postmortem, a checklist, a team rule, an agent's system prompt — keeps getting reused, and you want to turn it into a skill so a one-liner triggers it next time.

**Follow-up "yes"**:

The last round of chat already asked "is this worth a skill?" and you reply with a short "yeah / do it / go for it". The flow picks up the discussed material as the source without asking for a path again.

**Existing material at a path**:

You hand over a docs page / postmortem / internal wiki entry by path. The flow wraps it into a fresh skill directory (name, frontmatter, triggers, workflow, examples, failure paths).

**Create and publish in one shot**:

Once the new skill lands you don't want to branch / commit / open a PR by hand — you want the flow to push it to the company skill library on the way out.

**Out of scope**:

Review or improve an existing skill → **skill-improve-workflow**; only pick a display name → **skill-name-generation**; only pick a slug and boundaries → **skill-domain-framing**; only judge whether the content is worth a skill without building it → **skill-content-fit**; install / list / upgrade / uninstall an installed skill → **tranfu-router**.

## What it produces / you'll see

**Four gates run before anything hits disk — fail any gate and the flow stops at the gate instead of silently inventing a bad skill.** This is the most counterintuitive part.

- **Content gate**: `skill-content-fit` decides whether the material is worth becoming a skill at all; a `打回` result stops the flow before naming
- **Container & boundary**: `skill-domain-framing` picks the slug, include / exclude scope, and placement; if the top-two candidates are within 2 points the flow stops and asks you to choose
- **Skill files on disk**: `skill-creator` (Codex system one, or Claude Code's native authoring) writes only under `{owned_skill_directory}` — `SKILL.md` plus any `agents/` directory
- **Prompt review loop**: `prompt-review` audits every file that carries a prompt for engineering quality; up to 5 rounds; if it still fails the flow stops and asks you
- **Publish leg**: `tranfu-publish` uploads to the company skill library (git commit / push / PR); non-blocking — a publish failure never rolls back the skill
- **Never does**: touch unrelated skills, project code, or hand-written files; skip any gate; merge your PR

## Prerequisites & boundaries

**Prerequisites**:

Requires `skill-content-fit`, `skill-domain-framing`, `skill-creator`, and `prompt-review` to be available in the current runtime; missing any one → the flow reports the exact missing command and stops, never installs or scrapes an unofficial template. On Codex the "stop and ask" path uses `request_user_input` when Plan mode exposes it, otherwise falls back to a numbered plain-text prompt. The publish leg additionally needs `tranfu-publish` plus a working `git` environment.

**Adjacent skills**:

| Task | Route to |
|---|---|
| Health check / improve an existing skill | **skill-improve-workflow** |
| Pick display names (English + Chinese) | **skill-name-generation** |
| Pick a slug and its boundaries | **skill-domain-framing** |
| Only judge whether content is worth a skill | **skill-content-fit** |
| Publish an already-built skill | **tranfu-publish** |
| Install / list / upgrade / uninstall an installed skill | **tranfu-router** |

**Out of scope**:

- Installing / listing / upgrading / uninstalling skills
- Creating a plugin
- Editing ordinary project code or writing non-skill documentation
- Managing scheduled tasks

**Subtle edges**:

- Previous turn discussed "is this worth a skill?" and you reply "yeah / go for it" → triggers this skill; the discussed content is the source, no path required
- Pronoun reference ("it / this / that thing above") plus a create verb → triggers this skill; resolve context instead of refusing on "no path given"
- Add a specific feature to an existing skill → this skill in `update` mode; full quality review of an existing skill → **skill-improve-workflow**
