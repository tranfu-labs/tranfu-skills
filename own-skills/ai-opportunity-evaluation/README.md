---
name: ai-opportunity-evaluation
display_name: AI Opportunity Evaluation
display_name_zh: AI 机会立项判断
description: A go/no-go gate for TranFu product ideas before PRD or development. Runs a 2-3 round short-question triage on a one-liner idea and outputs a one-screen decision card (Go / Refine first / Don't do).
prompt_examples:
  - prompt: "Evaluate this idea: a WeChat article formatter"
    scene: Single product idea go/no-go triage
  - prompt: "Run a go/no-go check on this internal tool: personal attention dashboard"
    scene: Gate before an internal tool enters PRD
  - prompt: "Is this direction worth pursuing: AI intelligence subscription platform"
    scene: Judge whether a new direction deserves investment
  - prompt: "Is this product idea worth building: VPN smart routing platform"
    scene: Value judgment on a one-liner idea
  - prompt: "Use the AI Opportunity Evaluation skill to analyze this project"
    scene: Explicit skill invocation
  - prompt: "Can this idea be distilled into a TranFu skill or agent"
    scene: Judge capability-precipitation value
---

[English](./README.md) | [中文](./README.zh.md)

# AI Opportunity Evaluation

Triages a one-liner product idea before PRD or development. Asks 2-3 short questions, then outputs a one-screen decision card so a raw idea does not slide straight into a low-quality demo.

## When to use it

- A teammate has only a product name or a one-liner idea and needs a quick worth-doing verdict.
- An internal tool is about to enter PRD or development, and the real problem and validation goal must be confirmed first.
- You want to judge whether a project can be distilled into a TranFu skill, agent, SOP, website product, or external case study.

## Sibling skill comparison

> Drafted by tranfu-publish, signed off by author / recommender. Helps a reader pick across siblings or jump to a better fit.

### Inside the company library

- [project-scoring](../project-scoring/SKILL.md) — Quantitative scoring and decision memo for AI-workflow projects; **this skill differs**: it is a one-screen upstream gate, not a full scoring report.
- [ai-startup-feasibility-check](../ai-startup-feasibility-check/SKILL.md) — Feasibility self-check for AI startup directions; **this skill differs**: it focuses on TranFu internal projects, capability validation, and brand risk.
- [strategy-first-development](../strategy-first-development/SKILL.md) — Locks strategy, product shape, and tech plan before development; **this skill differs**: it runs even earlier — deciding whether the project should reach PRD at all.

### Outside the company

- None known.

### Unique value of this skill

- Phase-two go/no-go gate.
- One-screen decision card.
- Explicit check on TranFu capability precipitation.

## Usage tips

> Drafted through tranfu-publish (author / recommender answers, AI integrates, recommender signs off).
> Helps readers ramp up vertically — tacit knowledge lives here. See §Sibling skill comparison above for horizontal choice.

### What to feed in

- Start with the project name and a one-liner idea.
- Add who will use it and how it is solved today.
- State the validation flow, skill, or SOP you want to prove.

### Recommended usage

- Evaluate one project idea per session.
- Accept 2-3 short follow-up questions.
- Only enter PRD after the verdict is Go.

### Known limits

- Not a substitute for commercial due diligence or investment review.
- Does not directly produce a PRD or development plan.
- Confidence is low when input information is thin.

## What you will get

- A definite verdict: Go / Refine first / Don't do.
- A short card: core reasons, real problem, validation goal, v1 scope, risk flags, and next step.
