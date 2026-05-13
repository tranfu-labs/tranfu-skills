# Wangchuanfu Project Scoring Framework

## Positioning

The Wangchuanfu Project Scoring framework evaluates whether an AI workflow project deserves current investment in validation, demo development, or co-creation. It does not predict guaranteed success.

## Scoring Dimensions

Total score is 100 points before confidence and weak-link correction.
Use `scoring-contexts.md` before scoring to choose the project context and weight profile. Use `scoring-anchors.md` for dimension-level calibration. Missing information should be recorded as missing evidence and confidence loss, not silently treated as a neutral 50.

The default table below is for unknown or commercial-product contexts. For company-internal立项, Tranfu skill assets, public demos, or research probes, adjust weights using `scoring-contexts.md`.

| Dimension | Weight | Core Question |
|---|---:|---|
| Demand reality | 16 | Is there a specific user, specific scene, and real pain? |
| AI workflow fit | 12 | Does AI improve efficiency, quality, cost, or access? |
| Technical feasibility | 10 | Can a first version be built with low complexity? |
| Validation feasibility | 10 | Can real behavior signals be collected in 7-14 days? |
| Distribution reachability | 10 | Is there a path to the first users? |
| Business/value recovery | 10 | Is there payment, conversion, reuse, or asset value? |
| Reuse and retention | 8 | Will it be repeatedly used or templateable? |
| Cost structure | 8 | Are time, money, model, maintenance, and human costs controlled? |
| Risk and responsibility | 8 | Are privacy, copyright, compliance, harm, and brand risks bounded? |
| Wangchuanfu fit | 8 | Can it become a public case, workflow, template, tool, or co-creation asset? |

## Context and Weighting

The evaluator must not use one fixed commercial weighting for every project. First identify `projectType`:

- `commercial_product`: external product or market MVP
- `internal_initiative`: company-internal project立项
- `transfu_skill`: reusable Codex/agent skill or Tranfu method asset
- `public_demo`: demo or public case
- `research_probe`: small learning experiment

For `internal_initiative` and `transfu_skill`, demand reality, AI workflow fit, technical feasibility, reuse/template value, and Wangchuanfu fit should receive more weight. Business/payment, broad distribution, risk, and cost should receive lower weight unless they are the decisive bottleneck.

If payment is intentionally out of scope, reinterpret `Business/value recovery` as internal value, method asset value, reusable skill value, or decision-quality improvement. Do not score it low merely because there is no external payment plan.

## Project Statuses

| Status | Typical Score | Action |
|---|---:|---|
| 立即立项 | 85-100 | Enter demo development and public build log. |
| 小步立项 | 75-84 | Build, but with strict MVP scope. |
| 先验证 | 60-74 | Do interviews, landing page, concierge test, or sample test first. |
| 重构方向 | 45-59 | Rewrite user, scene, boundary, delivery, or business model. |
| 观察入池 | 35-59 | Put into observation pool, track timing/evidence. |
| 暂不立项 | 0-44 | Do not invest Wangchuanfu resources now. |

`重构方向` and `观察入池` can overlap. Use `重构方向` for structural flaws; use `观察入池` for valuable but premature or under-evidenced ideas.

## Hard Gates

Hard gates limit final status regardless of average score.

1. User gate: target user cannot be vague, such as "everyone", "enterprises", "young people", or "creators" without a specific role and scene. Highest status: `重构方向`.
2. Demand gate: pain cannot be only "probably useful" without frequency, loss, or current workaround. Highest status: `先验证`; if demand reality is below 30, highest status: `暂不立项`.
3. AI-fit gate: AI cannot be decoration. It must have a clear job in the workflow. Highest status: `重构方向`.
4. Responsibility gate: medical, legal, financial, psychological, minors, sensitive privacy, copyright-heavy, or other high-risk scenarios require clear responsibility boundaries. Highest status: `先验证`; if risk/responsibility is below 30, highest status: `重构方向`.

## Evidence Confidence

| Level | Name | Meaning | Coefficient |
|---|---|---|---:|
| L0 | Guess | Only subjective judgment | 0.75 |
| L1 | Public observation | Competitors, trends, community discussion, public cases | 0.82 |
| L2 | Interviews/samples | Target user interviews, real samples, clear feedback | 0.90 |
| L3 | Behavior signal | Signup, trial, click, waitlist, repeated use | 0.97 |
| L4 | Payment/delivery | Payment, repeat purchase, delivery, procurement intent | 1.00 |

Low-confidence projects, especially L0-L1, should not be recommended for direct full-product development. They can still enter validation or observation.

For internal initiatives, limited information is normal at the立项 stage. Missing data lowers confidence and may cap the status, but it should not erase strong known facts. The decision should answer: given limited information, is a small next investment justified?

When evidence differs by dimension, report dimension-specific evidence rather than forcing one global level:

- demand
- distribution
- payment
- technical
- risk

## Weak-Link Correction

Core dimensions:
- Demand reality
- AI workflow fit
- Validation feasibility
- Distribution reachability
- Risk and responsibility

Formula:

```text
base_score = sum(dimension_score * weight)
confidence_score = base_score * evidence_coefficient
weak_link_factor = 1

for each core dimension:
  if score < 20: weak_link_factor *= 0.70
  else if score < 30: weak_link_factor *= 0.85
  else if score < 45: weak_link_factor *= 0.95

final_score = clamp(round(confidence_score * weak_link_factor), 0, 100)
```

## Civilized Approval Checks

Always check:
- Does it ask users to upload sensitive data?
- Does it save raw materials unnecessarily?
- Does it imply AI has professional authority it does not have?
- Are human review and user correction possible?
- Are copyright sources clear?
- Is AI responsibility separated from human responsibility?
- Is data collection minimized?
