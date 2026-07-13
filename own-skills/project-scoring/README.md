---
name: project-scoring
display_name: AI Project Scoring
display_name_zh: AI 项目评分
description: A restrained project-approval reviewer for AI workflow ideas — asks 3-5 clarification questions first, then produces a decision memo with weighted 10-dimension scoring, hard gates, evidence ledger, risks, a 7-day validation experiment, and exactly one next action. Use before validation, internal investment, reusable skill development, public case development, or co-creation. Not a generic backlog sorter (RICE / ICE / WSJF fit that better).
prompt_examples:
  - prompt: "Use project-scoring to review this internal AI initiative: <one-line idea, target user, current workaround>"
    scene: Review an internal project
  - prompt: "Help me decide whether this Tranfu skill idea deserves a small-step commitment: <purpose, users, evidence level>"
    scene: Review a reusable skill
  - prompt: "Run project-scoring on this demo concept; if information is thin, ask me questions first"
    scene: Review a public demo
  - prompt: "Score this AI workflow product for commercial launch: <name, target user, willingness-to-pay evidence>"
    scene: Score a commercial product
  - prompt: "Compare and rank these three AI workflow candidates with project-scoring: <A, B, C>"
    scene: Rank several projects
  - prompt: "The idea is thin — ask 3-5 clarification questions before scoring, then produce a low-confidence memo"
    scene: Clarify an early idea
---

[English](./README.md) | [中文](./README.zh.md)

# Tranfu Project Scoring

Tranfu Project Scoring reviews AI workflow projects before validation, internal investment, reusable skill development, public case development, or co-creation. It behaves like a restrained project approval interviewer: it collects core facts first, then produces a decision memo with weighted scoring, hard-gate checks, risks, and one next action.

## When to Use

Use this skill when a teammate or agent needs to decide whether an AI workflow idea should be approved, validated, deferred, rejected, or reshaped. It fits company-internal AI initiatives, Tranfu skill assets, public demos, research probes, and external product/MVP ideas.

Do not use it as a generic product backlog sorter. RICE, ICE, and WSJF are better for ranking many already-approved features. This skill is for deciding whether an AI workflow project deserves investment at all.

## Expected Output

When input is thin, the skill returns clarification questions instead of a fake score. When enough facts are available, it produces a Markdown decision memo covering project type and weight profile, total score, confidence, information completeness, hard-gate checks, a 10-dimension scoring table, missing information and evidence levels, the riskiest assumption, a 7-day validation experiment, failure preview, and exactly one primary next action. For agent-to-agent handoff, it returns the JSON shape described in `references/output-schema.md`.

## Local Pre-scorer

`scripts/score_project.py` is a deterministic, conservative Python helper for local checks and regression tests, using only the standard library. It reads JSON from a file path or stdin, returns `type: clarification` for thin inputs by default, supports `--force-score` for provisional scoring and `--format markdown` for readable reports, builds an evidence ledger, adds subcriteria breakdowns, and applies context-specific weights. Tests use `pytest` on `tests/test_score_project.py`.

## Source of Truth

`SKILL.md` covers invocation rules, the clarification gate, workflow, and output policy. Framework references live under `references/` — `scoring-framework.md` for dimensions and gates, `scoring-contexts.md` for weight profiles, `scoring-anchors.md` for calibration, `output-schema.md` for output contracts, `prompt.md` for the reusable evaluator prompt, and `examples.md` for calibrated examples.
