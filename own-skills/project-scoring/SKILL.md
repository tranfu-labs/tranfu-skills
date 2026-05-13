---
name: project-scoring
description: Use when user says "评估这个 AI 项目" to score AI workflows and produce a decision memo.
version: 0.1.0
author: griffithkk3-del
updated_at: 2026-05-13
origin: own
---

# Project Scoring

Use this skill to perform a civilized project approval review for AI workflow ideas. The goal is not to predict success; it is to decide whether the project deserves current investment in validation, demo development, or co-creation.

## When To Use

Use this skill when the user asks to:
- score or review an AI workflow project idea
- decide whether a project should enter Tranfu demo development, observation, or co-creation pool
- analyze demand, technology, heat/distribution, time cost, funding cost, or responsibility risk
- compare several candidate projects and rank priority
- generate a 7-day validation plan before implementation
- produce a project decision memo for teammates or agents

## 同类 Skill 对比

> 由 publish-skill 起草, 推荐者签字. 帮助阅读者横向决定要装哪个 / 跳到更合适的同类.

### 公司库内
- 暂无

### 外部世界
- RICE / ICE prioritization tools — 用 Reach、Impact、Confidence、Effort 排功能优先级; **本 skill 区别**: 面向 AI 工作流立项, 输出硬门槛、风险、验证实验和下一步动作。
- WSJF prioritization tools — 用 Cost of Delay / Job Size 排敏捷 backlog; **本 skill 区别**: 支持内部立项、Transfu skill、公开 demo 等不同项目上下文权重。
- AI startup idea validator agents — 评估创业想法的市场、竞争和 SWOT; **本 skill 区别**: 先做立项访谈, 信息不足时主动追问, 不对两句话想法直接评分。

### 本 skill 独特价值
- 先访谈, 再评分。
- 内部立项有专用权重。
- 输出唯一下一步和 7 天验证。

## 使用技巧

> 由 publish-skill 引导起草 (作者/推荐者答, AI 整合, 推荐者签字).
> 帮助阅读者纵向上手 — tacit knowledge 在此. 横向同类对比见上方 §同类 Skill 对比.

### 材料方案
- Skill-first, 网页只做 demo。
- 按项目类型切换权重。
- 缺数据降置信度, 不判差。

### 推荐用法
- 先给用户、场景、替代方案。
- 允许它先问 3-5 个问题。
- 内部立项注明 projectType。

### 已知限制
- 不替代正式投委会。
- 高风险领域仍需人工复核。
- 分数要结合置信度阅读。

## Required Inputs

Do not score a slogan. Before scoring, collect enough project facts to make the judgment evidence-bearing rather than imagined. The core inputs are:
- project name
- project context: `commercial_product`, `internal_initiative`, `tranfu_skill`, `public_demo`, or `research_probe` when known
- one-sentence description
- target user and specific usage scene
- current workaround or substitute solution
- AI role in the workflow
- evidence level: L0 guess, L1 public observation, L2 interviews/samples, L3 behavior signal, L4 payment/delivery
- first validation path or first user source

## Clarification Gate

The skill must actively interview the user before scoring when the project facts are thin. Do not execute the full score just because the user gave a project name, a slogan, or a two-sentence idea.

Ask 3-5 focused questions when any of these are unclear:
- who the specific user is and in what repeated scene the problem appears
- how the user solves the problem today and why that workaround is painful
- what concrete job AI performs in the workflow, including input, output, and human review point
- what evidence exists: observation, interviews, samples, behavior, payment, or delivery
- where the first 5-10 users or samples will come from
- what responsibility boundary is required for legal, medical, finance, minors, privacy, copyright, or other high-risk projects

Only proceed directly to scoring when enough facts are present to evaluate the hard gates. If the user explicitly says not to ask questions or asks for an immediate provisional view, score with low confidence, mark missing facts in `missingInfo`, and cap the status at `先验证`, `重构方向`, `观察入池`, or `暂不立项`.

## Workflow

1. Choose review mode: `quick` for thin ideas, `standard` by default, `strict` before real build investment.
2. Identify project context. Use `internal_initiative` for company-internal立项, `tranfu_skill` for reusable Tranfu/Codex skill assets, `commercial_product` for external product/MVP decisions. If unclear and it affects weights, ask one context question.
3. Run the clarification gate. If core facts are missing, ask focused questions first and stop.
4. Clarify the project enough to avoid scoring an abstract slogan.
5. Select the weight profile from `references/scoring-contexts.md`. Do not over-penalize internal or skill projects for lacking payment evidence.
6. Score the project across 10 dimensions: demand reality, AI workflow fit, technical feasibility, validation feasibility, distribution reachability, business/value recovery, reuse and retention, cost structure, risk and responsibility, Tranfu fit.
7. Use `references/scoring-anchors.md` to calibrate 0-20, 21-40, 41-60, 61-80, and 81-100 scores.
8. Apply hard gates: user gate, demand gate, AI-fit gate, responsibility gate.
9. Apply evidence confidence and weak-link downgrade. Low evidence limits decision confidence; for internal立项 it should usually cap scope, not automatically否定项目.
10. Separate missing information from negative evidence: missing information lowers confidence and may cap status; proven flaws lower dimension scores.
11. Produce a decision memo with context, weights, score, status, confidence level, reasons, risks, one riskiest assumption, one 7-day validation experiment, failure preview, and one next action.

## Output Rules

- Do not only provide a score.
- Do not score when the request lacks core facts; ask clarification questions first.
- Do not ask a generic questionnaire. Ask only the 3-5 questions that most affect the hard gates.
- Be specific, restrained, and action-oriented.
- Do not use hype or popularity as a substitute for real demand and distribution.
- Prefer a Markdown decision memo for human users and JSON only when the caller asks for machine-readable output.
- For agent-to-agent handoff, include `schemaVersion`, `reviewMode`, `projectType`, `weightProfile`, `inputSummary`, `missingInfo`, dimension-specific `evidence`, `scoreBeforeConfidence`, `informationCompleteness`, `confidenceCoefficient`, and whether evidence was applied to the final score.
- For privacy, medical, legal, finance, copyright, minors, or other high-risk projects, require responsibility boundaries before development.
- Provide exactly one primary next action. Put secondary ideas under risks or experiment steps, not as competing conclusions.
- When exact weights, schema, or prompt wording matter, read the reference files instead of improvising.

## GitHub Distribution Notes

This folder is self-contained. To install from a cloned repository, copy this folder to `$CODEX_HOME/skills/project-scoring` or `~/.codex/skills/project-scoring` when `CODEX_HOME` is unset, then restart Codex so the skill metadata is discovered.

## References

- `references/scoring-framework.md`: dimensions, weights, evidence levels, gates, downgrade rules, and statuses.
- `references/scoring-contexts.md`: project contexts, weight profiles, and limited-information policy.
- `references/scoring-anchors.md`: score calibration anchors, high-risk downgrades, and missing-information policy.
- `references/output-schema.md`: JSON and Markdown decision memo formats.
- `references/prompt.md`: reusable LLM evaluator prompt.
- `references/examples.md`: calibrated example reviews.
- `scripts/score_project.py`: optional local rule pre-scorer for JSON inputs.
