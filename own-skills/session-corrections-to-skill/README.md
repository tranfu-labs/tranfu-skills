---
description: "Distills a session's user corrections and verified reality corrections into the matching SKILL as one or more definitions (name + requirement), implementation details (scenario + action), or error cases (scenario + error); nothing is written before user confirmation."
prompt_examples:
  - prompt: Distill this session's corrections into the matching skills.
    scene: Capture session corrections
  - prompt: Record the verified pitfall we just hit into skill XX.
    scene: Capture a pitfall
---

# session-corrections-to-skill

Turns corrections made during a session into durable knowledge in the matching skills. It accepts two sources: a user explicitly rejecting the agent's existing behavior, or reality disproving an approach when the root cause and correct approach have already been verified.

One-off scope instructions, choices between valid options, general preferences about how the agent should work, and unresolved problems are not deposited. Each accepted correction is checked against the target skill's `description`; corrections outside that scope are never forced into the nearest skill.

## Deposited content

One correction may produce one or more of these forms:

- Definition: `name + requirement`
- Implementation detail: `scenario + action`
- Error case: `scenario + error`

Drafted content is shown to the user before any file is changed. Only confirmed content is written, using an existing matching table or a minimal new two-column table. The workflow does not opportunistically restructure or expand the target skill.

## When to use it

- At the end of a session where you corrected a skill's behavior and want the correction to stick
- After a pitfall whose root cause and correct approach were verified in the session

## What you get back

- Confirmed definitions, implementation details, or error cases added to the matching SKILL
- A list of rejected one-off, general, or unresolved items
- A separate list of corrections that need a new skill, with a recommended name
- A ledger mapping each original correction to the exact content written
