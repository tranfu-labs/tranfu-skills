# Tranfu Project Scoring

Tranfu Project Scoring is a Codex/Agent skill for reviewing AI workflow projects before validation, internal investment, reusable skill development, public case development, or co-creation. It behaves like a restrained project approval interviewer: it asks for core facts first, then produces a decision memo with weighted scoring, hard-gate checks, risks, and one next action.

## 什么时候用

Use this skill when a teammate or agent needs to decide whether an AI workflow idea should be approved, validated, deferred, rejected, or reshaped. It is especially useful for company-internal AI initiatives, Tranfu skill assets, public demos, research probes, and external product/MVP ideas.

Do not use it as a generic product backlog sorter. RICE, ICE, and WSJF are better for ranking many already-approved features. This skill is for deciding whether an AI workflow project deserves investment at all.

## 触发示例

- `用 Tranfu 项目评分器评估这个 AI 工作流项目: ...`
- `Use $project-scoring to review this internal AI initiative: ...`
- `帮我判断这个 Tranfu skill idea 是否值得小步立项: ...`
- `对这个 demo 概念做立项审核，如果信息不足先问我问题。`

## 期望输出

When the input is thin, the skill should return clarification questions instead of a fake score. When enough facts are available, it should produce a Markdown decision memo with:

- project type and weight profile
- total score, confidence, and information completeness
- hard-gate checks
- 10-dimension scoring table
- missing information and evidence levels
- riskiest assumption
- 7-day validation experiment
- failure preview
- exactly one primary next action

For agent-to-agent handoff or tool usage, return the JSON shape described in `references/output-schema.md`.

## 本地预评分脚本

The Python pre-scorer is a deterministic, conservative helper for local checks and regression tests. It is not a replacement for the full agent decision memo, but it implements the same core scoring mechanics:

- reads JSON from a file path or stdin
- returns `type: clarification` for thin inputs by default
- supports `--force-score` for provisional scoring
- supports `--format markdown` / `--md` for readable Markdown reports and `--format json` for machine handoff
- builds an evidence ledger from project fields, `evidenceItems`, public URLs, repositories, docs, and authorized local files/directories
- adds subcriteria breakdowns, multi-view review, score range, and sensitivity analysis
- infers project context when `projectType` is not provided
- applies context-specific weights
- calculates missing information, confidence, hard gates, weak-link penalties, and one next action

From the skill directory:

```bash
python3 scripts/score_project.py --format markdown ../../examples/inputs/ai-customer-qa.json
```

From the repository root:

```bash
python3 skills/project-scoring/scripts/score_project.py --format markdown examples/inputs/ai-customer-qa.json
```

Use `--force-score` only when you intentionally want a provisional low-confidence score for thin input. By default, thin input should return `type: clarification`.

```bash
python3 skills/project-scoring/scripts/score_project.py --force-score --format markdown examples/inputs/thin-idea.json
```

For machine-readable JSON, use `--format json` or omit `--format`:

```bash
python3 skills/project-scoring/scripts/score_project.py --format json examples/inputs/ai-customer-qa.json
```

## 回归测试

The pre-scorer uses only the Python standard library. Tests use `pytest`:

```bash
python3 -m pytest tests/test_score_project.py
```

## Source of Truth

- `SKILL.md`: invocation rules, clarification gate, workflow, and output policy.
- `references/scoring-framework.md`: dimensions, statuses, hard gates, confidence, and weak-link rules.
- `references/scoring-contexts.md`: project type contexts and weight profiles.
- `references/scoring-anchors.md`: score calibration anchors.
- `references/output-schema.md`: JSON and Markdown output contracts.
- `references/prompt.md`: reusable JSON-only evaluator prompt.
- `references/examples.md`: calibrated examples.
- `scripts/score_project.py`: optional local rule pre-scorer.
