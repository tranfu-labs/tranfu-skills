---
prompt_examples:
  - prompt: Write a PRD for SSO support in our platform.
    scene: feature name
  - prompt: Enterprise customers keep asking for centralized auth — turn that into a spec.
    scene: problem statement
  - prompt: Users want to export their data as CSV. Spec it end-to-end.
    scene: user request
  - prompt: We should do something about onboarding drop-off — help me scope a first version.
    scene: vague idea
  - prompt: This SSO scope is too big for one release — break it into phased specs.
    scene: phased spec
  - prompt: For the CSV export spec, tighten the non-goals so scope creep does not blow us up.
    scene: non-goals focus
---

[English](./README.md) | [中文](./README.zh.md)

# Write Spec

Turn a vague idea, problem statement, or user request into a structured PRD — with goals, non-goals, user stories, P0/P1/P2 requirements, acceptance criteria, and success metrics.

## When to use it

**Feature name**:

I have a one-word feature ("SSO support", "CSV export") and want the skill to interview me and expand it into a full PRD.

**Problem statement**:

I describe a pain users hit ("enterprise keeps asking for centralized auth") and want the skill to reframe it as a spec that leads with the user problem.

**User request**:

A specific ask came in from users ("export data as CSV") and I want a spec that ties requirements back to the ask, with acceptance criteria eng can build against.

**Vague idea**:

I have a hunch ("onboarding drop-off feels bad") and want the skill to tighten it into a shippable v1 with explicit non-goals.

**Phased spec**:

The feature is too big for one release. I want the skill to break it into phase 1 / phase 2 specs, keeping the same problem statement but slicing scope.

**Non-goals focus**:

I already have a draft spec and want the skill to sharpen the non-goals section to prevent scope creep during implementation.

**Not in scope**:

Multi-round spec evolution on an existing project → **openspec-driven-development**; breaking an approved PRD into engineering tickets → **ticket splitter workflow**; design mockups / wireframes → **design brief workflow**; launch marketing copy → **copywriting workflow**.

## What it produces

**Default delivery: one structured PRD** — sections output in a fixed order, no more, no less, unless you ask.

- **Output sections**: Problem Statement / Goals / Non-Goals / User Stories / Requirements (P0/P1/P2 with acceptance criteria) / Success Metrics (leading + lagging) / Open Questions / Timeline
- **Never does**: write code / open tickets / edit product surfaces / pick launch dates for you

## Preconditions & boundaries

**Precondition**:

Supply at least a feature name, problem statement, or user ask — pure blank input is bounced back once with a clarifying question, never guessed at.

**Out of scope**:

- Multi-round spec evolution on an existing project → **openspec-driven-development**
- Turning an approved PRD into engineering tickets → **ticket splitter workflow**
- Design exploration, mockups, wireframes → **design brief workflow**
- Launch marketing copy or press materials → **copywriting workflow**

**Fine-grained edges**:

- Idea too big for one spec → the skill proposes phasing and specs phase 1 only, parking the rest as P2
- Requirements list has everything as P0 → the skill pushes back and forces a re-categorization
- Acceptance criteria come out vague ("fast", "user-friendly") → the skill flags them and asks for concrete thresholds
