# Evaluation Gates

Use this reference when defining how to prove an agentic architecture works.

## Baseline First

Every agentic design needs a simpler baseline:

- deterministic workflow;
- prompt-only model call;
- simple RAG;
- single-pass structured output;
- existing manual process.

Do not claim agentic value until the agentic version beats the baseline on task-specific metrics.

## Evaluation Types

| Evaluation | What It Proves |
|---|---|
| Unit tests | Deterministic modules and schemas work |
| Integration tests | Tools, storage, queues, and APIs connect |
| Golden tasks | Known tasks produce expected outcomes |
| Trajectory eval | Step sequence, tool calls, and branching are correct |
| Output quality eval | Final answer/report/action meets rubric |
| Safety eval | Refusals, approvals, boundaries, and injection defenses work |
| Cost/latency eval | The architecture is operationally viable |
| Soak test | Long-running or autonomous behavior is stable |

## Metrics

Choose metrics that match the product:

- task success rate;
- tool-call accuracy;
- schema validity;
- evidence coverage;
- groundedness;
- goal completion;
- drift rate;
- human correction rate;
- cost per successful task;
- p95 latency;
- interruption/resume success;
- rollback success;
- approval policy violations.

## Gates

Define gates before scaling:

```yaml
evaluation:
  baseline:
  success_metrics:
  minimum_bar:
  guardrail_metrics:
  anti_metrics:
  failure_modes:
  test_plan:
  go_no_go:
```

## Anti-Patterns

- Evaluating only final prose while ignoring tool trajectory.
- Treating a critic model score as truth before calibration.
- No adversarial or malformed inputs.
- No cost or latency threshold.
- No test for interruption, retry, or partial failure.
- No human review of high-impact actions.

## Reporting

Final handoff for implementation work must include:

- commands or checks run;
- pass/fail result;
- unverified items;
- known risks;
- next verification step.
