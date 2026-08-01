---
description: A decision method for finding, comparing, and validating technical solutions before implementation.
prompt_examples:
  - prompt: Help me choose a rich text editor approach before we build it.
    scene: Choose a new module
  - prompt: We hit a WebView performance wall; find existing fixes before we dig deeper.
    scene: Solve a blocker
  - prompt: This service keeps collecting bugs; decide whether it needs refactoring.
    scene: Review decay
---

# Solution Sourcing Method

Find where a technical solution should come from before writing the solution itself: proven outside options, internal evidence, or a time-boxed experiment.

## When to use it

**Choose a new module**

When I'm introducing a new capability such as state management, rich text editing, authentication, or another shared module, I want the work to start with mature options and explicit trade-offs instead of a blank-page design.

**Solve a blocker**

When implementation hits a concrete technical wall, I want to assume other teams have probably seen it before, scan official issues and community fixes, then verify the answer locally before copying it into the project.

**Review decay**

When code smells, repeated bugs, or maintenance pain cluster around the same structure, I want evidence before refactoring: what changes for independent reasons, what behavior must be protected, and whether the net benefit is real.

**Explore a new field**

When no mature pattern exists, I want a time-boxed comparison between at least two directions, with success criteria written before the experiment starts.

**Not for**

Pure lookup questions, executing an already approved plan, or product discussions that are not about a technical solution choice.

## What it produces

**It makes source selection part of the technical plan, not an afterthought.**

- **Problem frame**: a short statement of what counts as solved and what success looks like before candidates are discussed.
- **Source type**: one of four routes: introducing something new, solving a blocker, repairing decay, or exploring unknown territory.
- **Candidate comparison**: at least two viable options plus the baseline option of doing nothing, each with explicit costs.
- **Smallest validation**: a spike, prototype, local reproduction, baseline test, or comparison experiment that tests the key assumption with minimal cost.
- **Decision record**: the chosen path and the current alternatives, written into the project's design record or current OpenSpec change.
- **Never does**: it does not implement the chosen solution, approve the plan, or override the active project contract.

## Prerequisites & boundaries

**Prerequisites**

A concrete technical problem, enough project context to define success, and permission to read the relevant code, docs, issues, or external references. If the project uses OpenSpec, the decision should land in the current change's `design.md`.

**Adjacent skill split**

| Need | Use |
|---|---|
| Implement an already approved plan | the project's development workflow |
| Review whether a skill itself is well formed | **skill-review-workflow** |
| Create display names for skills | **Skill Display Name Generation** |

**Out of scope**

- Product requirement discovery with no technical architecture question.
- One-off factual lookup where no solution trade-off exists.
- Retrofitting a decision after implementation just to justify what already happened.

**Subtle boundaries**

- "Which library should we adopt?" -> use this method.
- "Install the library we already picked" -> do not use this method.
- "This file is long" -> only use this method if there is evidence of separate change reasons or repeated maintenance pain.
