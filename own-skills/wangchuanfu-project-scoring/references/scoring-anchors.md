# Scoring Anchors

Use these anchors to keep Wangchuanfu project reviews consistent across agents and reviewers. Scores should reflect both project quality and evidence. Missing information lowers confidence first; proven negative information lowers the dimension score.

## General Calibration

- 0-20: Absent, contradicted, or actively harmful.
- 21-40: Vague, weak, or mostly speculative.
- 41-60: Plausible but under-evidenced or operationally unclear.
- 61-80: Concrete, testable, and supported by early evidence.
- 81-100: Strongly evidenced, repeatable, and ready for focused build or co-creation.

Do not award 80+ without evidence stronger than a founder guess. Do not use trend heat as a substitute for user pain, reachable users, or responsibility boundaries.

## 1. Demand Reality

- 0-20: No specific user, scene, or pain; only a broad market slogan.
- 21-40: User group exists, but the scene and current workaround are unclear.
- 41-60: Clear user and pain, but frequency, loss, or urgency is weak.
- 61-80: Repeated workflow pain with interviews, samples, or observed behavior.
- 81-100: Strong behavior, payment, delivery, or repeated pull from real users.

Required evidence: target role, repeated scene, current workaround, pain frequency, pain cost.

## 2. AI Workflow Fit

- 0-20: AI is decorative; rules, forms, or search would solve the same job.
- 21-40: AI can generate output, but correctness is subjective or hard to verify.
- 41-60: AI helps one step, but human repair cost may erase the gain.
- 61-80: AI has a concrete role with stable inputs and checkable outputs.
- 81-100: AI is essential to the workflow and creates clear speed, quality, or scale advantage.

Required evidence: input type, output type, verification method, human review point, measurable gain.

## 3. Technical Feasibility

- 0-20: Requires unavailable data, unsafe automation, or unproven core capability.
- 21-40: Technically possible but blocked by data access, integration, or quality risk.
- 41-60: MVP possible, but reliability or integration risks remain material.
- 61-80: Prototype path is clear with available models, data, and fallback controls.
- 81-100: Low engineering uncertainty; implementation and QA path are already proven.

Required evidence: data availability, model capability, integration surface, quality checks, fallback plan.

## 4. Validation Feasibility

- 0-20: No reachable users or observable pass/fail signal.
- 21-40: Users might be reachable, but the test path is vague.
- 41-60: A test can be designed, but sample access or criteria are weak.
- 61-80: 7-day concierge or prototype test is realistic with clear pass/fail criteria.
- 81-100: Users, samples, and measurement channel are already available.

Required evidence: first users, sample source, test method, pass criteria, stop criteria.

## 5. Distribution Reachability

- 0-20: No credible channel to reach target users.
- 21-40: Generic channels only; no relationship, community, or search intent.
- 41-60: One plausible channel exists but conversion is unproven.
- 61-80: First user source is credible and reachable within days.
- 81-100: There is repeated inbound demand, owned audience, partner access, or existing customer flow.

Required evidence: channel, audience fit, first 5-20 users, acquisition friction, message clarity.

## 6. Business And Value Recovery

- 0-20: No payer, budget, or value capture path.
- 21-40: User value exists, but payer and pricing are unclear.
- 41-60: Plausible willingness to pay or internal ROI, but no proof.
- 61-80: Clear economic buyer, value metric, or saved cost/time with early proof.
- 81-100: Payment, budget commitment, delivery revenue, or strong internal ROI is evidenced.

Required evidence: payer, budget owner, value metric, pricing hypothesis, payment/ROI signal.

## 7. Reuse And Retention

- 0-20: One-off novelty with no repeated workflow.
- 21-40: Occasional use; unclear habit or repeat trigger.
- 41-60: Repeatable scenario exists, but retention loop is weak.
- 61-80: Fits a weekly/daily workflow or recurring team process.
- 81-100: Reuse loop, templates, data accumulation, or workflow lock-in is strong.

Required evidence: recurrence, repeat trigger, team workflow, saved templates/data, switching cost.

## 8. Cost Structure

- 0-20: Unit cost, model cost, or human review cost destroys value.
- 21-40: Cost likely high and unmeasured.
- 41-60: Cost could work but needs measurement or scope control.
- 61-80: Cost is bounded with clear simplifications, batching, or review controls.
- 81-100: Cost is low, predictable, and improves with reuse or scale.

Required evidence: model cost, latency, human review time, data preparation cost, support cost.

## 9. Risk And Responsibility

- 0-20: High-risk domain with no boundary, auditability, or human responsibility.
- 21-40: Risk is acknowledged but controls are vague.
- 41-60: Basic controls exist; sensitive edge cases remain unresolved.
- 61-80: Clear human-in-the-loop, disclaimers, data boundaries, and audit trail.
- 81-100: Risk is low or strongly bounded by workflow design, compliance, and accountability.

Required evidence: domain risk, data sensitivity, human review, auditability, prohibited claims.

## 10. Wangchuanfu Fit

- 0-20: Not aligned with AI workflow validation, demo development, or co-creation.
- 21-40: Interesting idea but not a good fit for current assets or audience.
- 41-60: Related to the mission but requires repositioning or partner access.
- 61-80: Fits current demo, skill, workflow, or co-creation direction.
- 81-100: Strong fit with reusable assets, near-term validation, and teammate/agent adoption.

Required evidence: relationship to existing assets, reusable workflow, co-creation path, strategic learning.

## High-Risk Domain Downgrades

For medical, legal, finance, mental health, minors, employment, education credentials, privacy-sensitive, copyright-sensitive, or safety-critical workflows:

- Direct professional advice without licensed human review should fail the responsibility gate.
- Reposition toward summarization, checklisting, preparation, triage, drafting, or human-review support.
- Require explicit data boundaries and non-retention assumptions before build approval.
- A project may still score well only if the risky decision remains with a qualified human.

## Missing Information Policy

Missing information is not the same as negative evidence.

- If a dimension has missing inputs but no negative evidence, mark it as uncertain and lower confidence.
- If a hard gate cannot be evaluated, do not approve direct build; choose `先验证` or `重构方向`.
- If the user asks for a fast judgment, provide a provisional score and list the missing information that would change the decision.
