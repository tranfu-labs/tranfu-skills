---
description: "Distill a session's corrections into table rows appended to the matching SKILL files: user corrections as scenario → expected-output rows, reality corrections (the correct way established after an error or pitfall) as trigger → correct-way → causal-chain rows with the postmortem in references/; general preferences are listed separately for memory."
prompt_examples:
  - prompt: Distill this session's corrections into the matching skills.
    scene: Capture session corrections
  - prompt: Record the pitfall we just hit into skill XX.
    scene: Capture a pitfall
  - prompt: Which of my corrections this session belong in skills vs memory?
    scene: Route corrections
---

# session-corrections-to-skill

Turns the corrections made during a session into durable skill knowledge, stored in two separate tables. The qualification gate asks one question — was an existing behavior negated? — with two kinds of negator: user corrections, where the user negated the agent's approach (preference/convention class), and reality corrections, where reality (an error, a failure) negated the old approach, the root cause is understood, and the correct way was verified in the session (if no correct way was found yet, research it first and confirm with the user before recording). Scope instructions, jointly agreed one-off designs, and one-time edits never pass the gate; corrections about how the agent should work in general never land in a SKILL file — they are listed separately as pending for memory; this skill does not write memory itself.

Output shape: a user correction is one row with two columns (scenario → expected output); a reality correction is one row with three columns (trigger scenario → correct way → causal-chain link), with the postmortem written to `references/<slug>.md` — the SKILL file holds only the quick-use experience, never the causal chain itself. No new sections, no restating existing skill content, no opportunistic rewrites.

## When to use it

- At the end of a session where you corrected a skill's behavior several times and want it to stick
- After hitting a pitfall in a session, with the root cause understood and the correct way verified, and you want the lesson recorded in the matching skill
- When you want a clean split between "this belongs in the skill" and "this is just my general preference"

## What you get back

- Each user correction appended as one `scenario → expected output` row in the right SKILL file
- Each reality correction appended as one `trigger → correct way → causal chain` row, with the postmortem in a reference doc
- A ledger: correction → target SKILL path → the exact row added (plus the reference path for reality corrections)
- A separate pending-for-memory list for general-workflow corrections — those never touch a SKILL file, and writing them into memory stays with you or the runtime
