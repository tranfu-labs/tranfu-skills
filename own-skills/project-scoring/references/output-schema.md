# Output Schema

## Clarification Result

Use this shape when the project input is too thin to score without inventing facts. Clarification is the default response for slogan-level or two-sentence ideas.

```json
{
  "schemaVersion": "1.0",
  "type": "clarification",
  "reviewMode": "quick|standard|strict",
  "canScoreNow": false,
  "reason": "Direct scoring would require guessing the user, repeated scene, AI job, or first validation path.",
  "knownFacts": {
    "name": "AI customer QA assistant",
    "description": "Helps customer success teams review support quality",
    "targetUser": "",
    "currentSolution": "",
    "aiRole": ""
  },
  "questions": [
    {
      "id": "target_user_scene",
      "question": "Who is the specific user, and in what repeated scene would they use it?",
      "whyItMatters": "This determines the user gate and demand reality score."
    }
  ],
  "provisionalBoundary": "If the user insists on immediate judgment, score as low-confidence provisional and cap status at 先验证."
}
```

Clarification rules:

- Ask 3-5 focused questions, not a long generic questionnaire.
- Questions must map to hard gates or major score changes.
- Prioritize user/scene, current workaround, AI job, evidence, first validation channel, and responsibility boundary for high-risk projects.
- Do not include a score in a clarification result.

## Score Result

Use this shape for tools, APIs, and agent-to-agent handoff.

```json
{
  "schemaVersion": "1.0",
  "type": "score",
  "reviewMode": "quick|standard|strict",
  "projectType": "commercial_product|internal_initiative|tranfu_skill|public_demo|research_probe",
  "weightProfile": {
    "demandReality": 16,
    "aiWorkflowFit": 12,
    "technicalFeasibility": 10,
    "validationFeasibility": 10,
    "distributionReachability": 10,
    "businessValueRecovery": 10,
    "reuseRetention": 8,
    "costStructure": 8,
    "riskResponsibility": 8,
    "tranfuFit": 8
  },
  "inputSummary": {
    "name": "Project name",
    "description": "One-sentence summary",
    "targetUser": "Specific user and scene",
    "currentSolution": "Current workaround",
    "aiRole": "Concrete AI job in the workflow"
  },
  "missingInfo": ["First user source is not specified"],
  "evidence": {
    "demand": "L2",
    "distribution": "L1",
    "payment": "L0",
    "technical": "L2",
    "risk": "L1"
  },
  "evidenceLedger": [
    {
      "id": "E1",
      "dimension": "demandReality",
      "claim": "Target users review support conversations weekly.",
      "source": "project.targetUser",
      "sourceType": "user_input|public_url|local_file|local_directory|provided|missing",
      "evidenceLevel": "L2",
      "quote": "20-80 person support teams review conversations weekly",
      "confidenceNote": "Source is user-provided and should be checked with real samples."
    }
  ],
  "subscores": {
    "demandReality": [
      {"name": "目标用户具体度", "score": 82, "evidenceRefs": ["E1"], "reason": "Target user and repeated scene are concrete."}
    ]
  },
  "scoreRange": {"low": 64, "current": 72, "high": 78, "explanation": "Range reflects evidence and missing information."},
  "sensitivity": [
    {"assumption": "Real samples are unavailable", "impact": -12, "why": "Validation would weaken."}
  ],
  "multiViewReview": [
    {"role": "需求审查员", "averageScore": 76, "support": "Repeated workflow pain is plausible", "concern": "Needs real samples", "missingEvidence": "Interview count is unknown", "impact": "Affects validation scope"}
  ],
  "scoreBeforeConfidence": 80,
  "informationCompleteness": 0.82,
  "confidenceCoefficient": 0.9,
  "evidenceAppliedToScore": false,
  "score": 72,
  "level": "先验证",
  "confidence": "中置信度",
  "verdict": "The project has real workflow pain but needs evidence before development.",
  "dimensions": [
    {"key": "demandReality", "label": "需求真实性", "score": 78, "missing": false}
  ],
  "gates": [
    {"label": "用户门槛", "pass": true, "fix": ""}
  ],
  "strengths": ["Clear repeated workflow pain"],
  "risks": ["Payment willingness is unproven"],
  "riskiestAssumption": "Target users will provide real samples and use the generated output in work.",
  "experiment": {
    "title": "7-day validation experiment",
    "steps": ["Recruit 5 target users", "Collect 10 sanitized samples", "Run AI + human concierge delivery"],
    "passCriteria": ["3 users want to reuse it", "2 users show payment or referral intent"],
    "stopCriteria": ["Users refuse to provide samples", "Output requires too much manual repair"]
  },
  "failurePreview": ["Users like the demo but do not repeat use"],
  "nextAction": "Run a 7-day concierge validation with 5 target users."
}
```

## Review Modes

- `quick`: Use for a thin idea or early conversation. Ask at most 3 focused questions unless the user requests an immediate judgment. Output may be provisional.
- `standard`: Default mode. Produce the full decision memo with all dimensions, hard gates, risks, and one validation experiment.
- `strict`: Use before real build investment. Do not approve direct development when hard gates, evidence, responsibility boundaries, or first-user access are unclear.

## Field Rules

- `type` must be `clarification` when core facts are missing and the user has not requested an immediate provisional score.
- `type` must be `score` only when enough facts exist or the user explicitly asks to skip clarification.
- `projectType` records the scoring context. Use `internal_initiative` for company-internal立项 and `tranfu_skill` for reusable Tranfu/Codex skill assets.
- `weightProfile` must expose the exact dimension weights used, because different project contexts should not share one fixed formula.
- `scoreBeforeConfidence` is the weighted score before evidence and missing-information penalties.
- `informationCompleteness` is the weighted share of dimensions supported by the available facts, from 0 to 1.
- `confidenceCoefficient` combines evidence level, missing-information coverage, and weak evidence penalty.
- `evidenceAppliedToScore` explains whether evidence confidence directly reduced the final numeric score. For company-internal initiatives, Tranfu skills, demos, and research probes, weak evidence should usually lower confidence and cap scope instead of erasing strong known facts. For commercial products, evidence may directly reduce the final score.
- `missingInfo` must list missing facts that would change the decision.
- `evidence` should be dimension-specific when possible. Do not collapse all evidence into one level if demand, payment, risk, and distribution have different proof quality.
- `dimensions[].score` may be `null` only when the dimension is missing. Missing dimensions lower confidence; they are not automatically treated as 50.
- Local pre-scorer output includes the core handoff fields above plus evidence ledger, subcriteria scores, score range, sensitivity analysis, and multi-view review notes. The full LLM/agent score schema may additionally include richer narrative fields such as `verdict`, dimension reasons, `strengths`, `risks`, `experiment`, and `failurePreview` when producing a complete decision memo.
- `nextAction` must contain exactly one primary action.

## Markdown Decision Memo

Use this shape for human-readable reports. The local pre-scorer can emit this format with `--format markdown` or `--md`.

```markdown
## 立项结论

- 项目：
- 总分：
- 分数区间：
- 状态：
- 置信度：
- 评审模式：
- 证据等级：
- 一句话判断：
- 缺失信息：

## 证据台账

| ID | 维度 | 等级 | 来源类型 | 来源 | 摘要 |
|---|---|---|---|---|---|

## 评分总览

| 维度 | 权重 | 分数 | 理由 |
|---|---:|---:|---|

## 维度子项拆解

| 子项 | 分数 | 证据引用 | 判断 |
|---|---:|---|---|

## 硬门槛

| 门槛 | 是否通过 | 修正建议 |
|---|---|---|

## 多视角评审摘要

| 角色 | 均分 | 支撑点 | 反对点/担忧 | 对结论影响 |
|---|---:|---|---|---|

## 通过理由

1.
2.
3.

## 主要风险

1.
2.
3.

## 最危险假设

...

## 分数区间与敏感性分析

| 假设变化 | 分数影响 | 原因 |
|---|---:|---|

## 7 天验证实验

- 对象：
- 动作：
- 样本量：
- 通过标准：
- 停止/重构标准：

## 失败预演

1.
2.
3.

## 下一步动作

Only one primary action.
```
