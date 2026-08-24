---
description: "Distill a session's user corrections into scenario → expected-output table rows appended to the matching SKILL files, listing general preferences separately for memory."
prompt_examples:
  - prompt: Distill this session's corrections into the matching skills.
    scene: Capture session corrections
  - prompt: Add the corrections I just made to the skill's table.
    scene: Append to one skill
  - prompt: Which of my corrections this session belong in skills vs memory?
    scene: Route corrections
---

# session-corrections-to-skill

Turns the corrections a user made during a session into durable skill knowledge. Four steps: enumerate every correction (including reverts and "no, not that" turns), route each one to the skill it corrects, extract it as a scenario → expected-output pair (the scenario the agent was in → what the user actually wanted), and append each pair as one table row to the "user corrections" table of that skill. Corrections about how the agent should work in general never land in a SKILL file — they are listed separately as pending for memory; this skill does not write memory itself.

The output shape matches the scenario table that experience-capture skills are built around: one correction, one row, two columns. No new sections, no restating existing skill content, no opportunistic rewrites.

## When to use it

- At the end of a session where you corrected a skill's behavior several times and want it to stick
- When you want a clean split between "this belongs in the skill" and "this is just my general preference"

## What you get back

- Each correction appended as one `scenario → expected output` row in the right SKILL file
- A ledger: correction → target SKILL path → the exact row added
- A separate pending-for-memory list for general-workflow corrections — those never touch a SKILL file, and writing them into memory stays with you or the runtime
