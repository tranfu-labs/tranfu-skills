---
description: "Turn opportunity hunting from waiting for inspiration into a repeatable drill — four hunting grounds, why-now trigger, pick-and-shovel test, four kill gates."
prompt_examples:
  - prompt: OpenAI cut prices again. Is this a trigger for infra startups? Walk the chain.
    scene: Check a market change
  - prompt: Building an AI compliance monitor for mid-market SaaS. Run the four kill gates.
    scene: Test a startup idea
  - prompt: I paste product data across 5 platforms daily. Is this a real opportunity?
    scene: Start from daily friction
---

# Startup Opportunity Hunter

Turn opportunity hunting from waiting for inspiration into a repeatable drill — four hunting grounds, why-now trigger, pick-and-shovel test, four kill gates.

## When to use it

**Sitting on an observation**:

I keep getting nagged by the same friction, or I just saw a news headline / policy shift / new model capability that smells like an opportunity — I want the skill to tell me whether it is real.

**Reading a fresh catalyst**:

A big player just entered a market / a model just got cheap / a new regulation just dropped — I want to trace the causal chain and figure out whether this is tailwind or headwind, a trigger or a death knell.

**Pick-and-shovel judgment**:

I'm thinking about building a tool / platform / infrastructure — I want the skill to check whether this shovel is "everyone must buy no matter who strikes gold," or a reverse shovel that big players give away free or one that only pays out while prices stay high.

**Brainstorming directions**:

I'm hunting for a startup direction — I want the skill to shift me from "think up ideas" to "pick the right vantage point": which hunting ground to camp in, which question to press the catalyst on.

**Culling my backlog**:

I've stockpiled a few candidate ideas — I want to run the four kill gates on each and keep only the ones that survive.

**Not for**:

Deep death-risk review of surviving AI candidates → **ai-startup-feasibility-check**; writing business plans / pitch decks / competitor analysis → not triggered.

## What it produces

**Verdicts are binary — survive or kill, never a wishy-washy "maybe think more"**.

- **Hunting-ground placement**: puts your idea into one of the four grounds (daily personal friction / frontier capability shift / regulatory change / dirty work in unsexy industries), or calls out that it belongs to none
- **why-now trigger test**: forces a "who + right now + must pay for what" answer; if you can't produce one, you get a warning
- **Four kill gates**: real pain / defensible against big players / leverage direction / unit economics — run in sequence, later gates skipped once an earlier one fails
- **Thin-slice suggestion** (survivors only): one sentence on the smallest end-to-end real-world path to test
- **AI-track handoff**: for AI-domain survivors, actively suggests running **ai-startup-feasibility-check** for a structural death-risk review
- **Never does**: business plans, pitch decks, competitor reports

## Prerequisites & boundaries

**Prerequisite**:

A concrete candidate (observation / friction / news / policy / new model capability) or a clear direction intent. Show up empty-handed with "find me an opportunity" — you'll get bounced back to name your hunting ground first.

**Neighboring skills**:

| Task | Route to |
|---|---|
| Deep death-risk review of surviving AI candidates | **ai-startup-feasibility-check** |

**Not for**:

- Business plans / pitch decks / competitor analysis
- Tech-stack selection for a project you've already committed to
- Generic industry trend reports unrelated to opportunity hunting

**Subtle edges**:

- Asks "is this change an opportunity?" → triggers; asks "how will AI reshape industry X?" as a broad trend discussion → doesn't
- AI survivor → actively hands off to **ai-startup-feasibility-check**; non-AI survivor → stops at the fast filter
