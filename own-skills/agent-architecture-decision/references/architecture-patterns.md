# Agentic Architecture Patterns

Use this reference when selecting the right agentic shape. Prefer the least complex pattern that still satisfies product value, state, tools, and verification.

## Pattern Matrix

| Pattern | Use When | Avoid When | Verification |
|---|---|---|---|
| Linear pipeline | Steps are fixed and deterministic | Tool choice or branching depends on runtime reasoning | Unit tests and fixture outputs |
| Deterministic workflow with LLM nodes | Workflow is fixed but some steps need extraction, ranking, or generation | LLM decides critical control flow without guardrails | Schema validation plus golden tasks |
| Single-agent tool loop | One agent can plan and call tools within bounded retries | Multiple roles require independent context or audit | Tool-call accuracy, retry limits, cost |
| Graph workflow | State, branches, retries, interruption, or checkpointing matter | A plain function pipeline is enough | Node tests plus trajectory tests |
| Human-in-the-loop graph | Clarification, approval, or escalation is part of success | The task can complete safely without user intervention | Interrupt/resume tests |
| Supervisor + subagents | Specialized workers have distinct inputs, outputs, and acceptance criteria | Roles are only labels over the same context | Per-worker contract tests and merge eval |
| Multi-agent debate/collaboration | Independent perspectives measurably improve quality | Debate has no scoring or synthesis gate | Baseline vs debate quality eval |
| Autonomous event-driven agent | Work is triggered by schedules/events and can run safely unattended | Actions have legal, financial, production, or security impact without approval | Soak tests, approvals, audit log |

## Selection Rules

- Start with the non-agentic baseline.
- Add LLM nodes only where deterministic logic cannot robustly handle ambiguity.
- Add a loop only when retry, reflection, or incremental tool use improves measurable outcomes.
- Add a graph only when state and branching are explicit enough to test.
- Add subagents only when work units can be independently scoped and verified.
- Add autonomy only after observation-mode runs prove reliability.

## Common Failure Modes

- Multi-agent theater: roles exist, but all agents read the same context and produce overlapping work.
- Hidden deterministic logic inside prompts: business rules become untestable.
- Reflection without calibration: a critic model adds cost but does not correlate with human judgment.
- No baseline: the agentic system cannot prove it beats a simpler workflow.
- No state owner: working state, runtime memory, canonical knowledge, and audit logs blur together.

## Output Guidance

When recommending a pattern, state:

- why simpler patterns fail;
- why more complex patterns are premature;
- which components stay deterministic;
- which components are AI-assisted;
- what would trigger an upgrade or downgrade.
