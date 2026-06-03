---
name: organize-meeting-actions
description: 整理、生成或审查涉及多人协作会议的会议纪要、会后总结、行动项和 follow-up todo，确保会后 24 小时内形成可追责行动清单；每个行动项必须包含负责人、截止时间、交付物和确认人，缺少任一字段不得进入待办列表。When meeting notes mention 小王, merge related valid actions or clarification items into his project work arrangement, usually at week-jobs/xiaowang.md. Always trigger when the user asks to summarize meeting notes, extract action items, create meeting follow-ups, review meeting minutes, or validate collaborative meeting todos, even if they do not use the word "action item". Do NOT trigger when the user asks for personal notes, non-meeting documents, calendar scheduling, reminders, project-management ticket creation, or prioritization decisions.
version: 0.1.0
author: aquarius-wing
updated_at: 2026-06-03
origin: own
---

# Organize Meeting Actions

## Core Rule

For any meeting involving multi-person collaboration, MUST produce action items within 24 hours after the meeting.

Each action item must include:

- Owner: the person directly responsible for execution.
- Deadline: a specific date or time by which the item is due.
- Deliverable: the concrete output or completed state.
- Confirmer: the person who verifies acceptance or completion.

NEVER put an item into the todo list if it lacks Owner, Deadline, Deliverable, or Confirmer.

## Workflow

1. Determine whether the source is a multi-person collaboration meeting.
   - Use this skill when the meeting includes decisions, cross-person handoffs, dependencies, commitments, approvals, or follow-up work.
   - DO NOT force this workflow onto personal notes, brainstorming with no commitments, or non-meeting documents.

2. Extract candidate actions from the notes.
   - Look for explicit commitments, assigned work, unresolved blockers, decisions that require execution, and follow-up checks.
   - Convert vague discussion points into candidate actions only when there is enough evidence of an expected next step.
   - DO NOT invent owners, deadlines, deliverables, or confirmers.

3. Normalize every valid action item into this structure:

```text
- Action:
  Owner:
  Deadline:
  Deliverable:
  Confirmer:
  Source:
```

4. Split output into two sections.
   - `Todo list`: only include items with all four required fields: `Owner`, `Deadline`, `Deliverable`, and `Confirmer`.
   - `Needs clarification`: include candidate actions missing any required field. Items missing owner or deadline must stay out of the todo list.

5. For clarification items, ask concise follow-up questions.
   - Missing owner: ask who is accountable.
   - Missing deadline: ask for the due date or time box.
   - Missing deliverable: ask what artifact, decision, status, or measurable outcome will be produced.
   - Missing confirmer: ask who will verify the work is accepted.

6. If the source mentions `小王`, merge the related work into Xiao Wang's work arrangement.
   - Default target path: `<project-root>/week-jobs/xiaowang.md`.
   - Read the existing file before writing. Preserve existing sections, wording, completed items, and ordering when possible.
   - Merge only items connected to `小王`: items owned by 小王, items that require 小王's input, or clarification candidates whose source text mentions 小王.
   - Add valid four-field items to the work arrangement as actionable work.
   - Add incomplete items under a clarification or pending-info section instead of treating them as confirmed work.
   - Deduplicate by comparing action, deadline, deliverable, and source. Update an existing matching item instead of appending a duplicate.
   - If `week-jobs/xiaowang.md` does not exist, look for an obvious Xiao Wang work file under `week-jobs/`. If none exists and the user asked to update files, create `week-jobs/xiaowang.md`; otherwise report the intended target path and ask before writing.
   - NEVER overwrite Xiao Wang's existing work arrangement wholesale.

## Examples

<example>

Input note:

```text
June 3 meeting: Lin will publish the API migration plan by June 7 18:00. Maya will confirm whether the plan is acceptable.
```

Output:

```text
Todo list
- Action: Publish the API migration plan.
  Owner: Lin
  Deadline: June 7, 18:00
  Deliverable: API migration plan
  Confirmer: Maya
  Source: "Lin will publish the API migration plan by June 7 18:00. Maya will confirm..."

Needs clarification
- None
```

</example>

<example>

Input note:

```text
June 3 meeting: 小王 will draft the rollout checklist by June 6 12:00. Chen will confirm it before release.
```

Required file update:

```text
Target: week-jobs/xiaowang.md

- Action: Draft the rollout checklist.
  Owner: 小王
  Deadline: June 6, 12:00
  Deliverable: Rollout checklist
  Confirmer: Chen
  Source: "小王 will draft the rollout checklist by June 6 12:00. Chen will confirm..."
```

</example>

<bad-example>

WRONG: This candidate lacks both owner and deadline, so it MUST NOT enter `Todo list`.

```text
Todo list
- Action: Follow up on the rollout risks.
  Owner:
  Deadline:
  Deliverable: Risk follow-up
  Confirmer: Project lead
```

Correct handling:

```text
Needs clarification
- Candidate action: Follow up on the rollout risks.
  Missing: Owner, Deadline
  Questions:
  - Who is accountable for this follow-up?
  - What is the deadline?
```

</bad-example>

## Output Requirements

When producing meeting minutes or action lists:

- Include the meeting date if available.
- State whether the 24-hour action-item window is still satisfied when the meeting time is known.
- Keep the todo list free of ownerless or undated items.
- Preserve ambiguity in `Needs clarification` instead of silently filling gaps.
- Use specific deadlines. Avoid vague values like "ASAP", "next week", or "later" unless the user explicitly supplied them.

## Validation Checklist

Before finalizing, verify:

- Every todo item has an owner.
- Every todo item has a deadline.
- Every todo item has a deliverable.
- Every todo item has a confirmer.
- No discussion-only note was converted into a todo without evidence of commitment.
- Items missing any required field are outside the todo list and listed under `Needs clarification`.
- If the source mentioned `小王`, related work was merged into the project-local Xiao Wang work arrangement or the missing target path was reported.
- Xiao Wang's work arrangement was merged incrementally, not overwritten.

## Boundaries

This skill does not manage calendars, send reminders, create project-management tickets, or decide team priorities unless the user explicitly asks for that separate work. It only structures and validates meeting follow-up actions, with the specific exception that `小王`-related meeting work should be merged into his project work arrangement.
