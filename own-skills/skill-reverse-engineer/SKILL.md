---
name: skill-reverse-engineer
description: Reverse-engineer, audit, and improve AI agent skills. Use when analyzing SKILL.md files, prompt workflows, agent instructions, or skill directories.
version: 0.1.0
author: BruceL017
updated_at: 2026-05-12
origin: own
---

# Skill Reverse Engineer

## Overview

Reverse-engineer visible AI Agent Skills, `SKILL.md` files, prompt workflows, agent instruction packages, marketplace pages, or skill directories.

Treat the artifact as a designed system, not just text. Identify its intent, trigger logic, workflow, resource strategy, quality level, risks, tests, and reusable creation formula.

Always separate visible evidence from inference. Never claim access to hidden system prompts, private platform routing, marketplace ranking logic, or unavailable files.

Use the lightest output that satisfies the user. A concise diagnosis is better than a full report when the user only asks for a quick read.

## 同类 Skill 对比

暂无。

## 使用技巧

暂无（作者跳过）。

## Mode Selection

Choose one mode before analyzing:

| Mode | Use when | Output |
| --- | --- | --- |
| Quick diagnosis | The user asks what the skill is, whether it is good, or why it works | Core judgment, trigger logic, workflow, top risks |
| Full reverse engineering | The user asks how the skill was built or asks for a full analysis | Structural report, pattern extraction, creation formula |
| Improvement audit | The user asks to improve, rewrite, or strengthen the skill | Defects, rationale, targeted rewrite or full `SKILL.md` |
| Trigger test | The user asks whether the skill will activate reliably | Should-trigger, should-not-trigger, ambiguous, and edge queries |
| Marketplace package | The user asks to publish or package the skill | Positioning, folder structure, `SKILL.md`, tests, release checklist |
| Comparison | The user provides multiple skills | Shared formula, differences, reusable template |

If the user does not specify a mode, infer it from the request. Prefer quick diagnosis for exploratory questions and improvement audit for rewrite requests.

## Inputs

The user may provide:

- Full `SKILL.md` content.
- A skill directory tree.
- A marketplace skill page.
- A prompt workflow or agent instruction package.
- Supporting files such as scripts, references, assets, examples, tests, templates, or metadata.
- Multiple skills for comparison.

If enough visible content is present, proceed directly. If the user only says "analyze this skill" without content, ask for the `SKILL.md` or the most complete visible artifact available.

If content is incomplete, continue with partial analysis and label missing sections explicitly.

## Evidence Rules

Classify important claims:

| Evidence type | Say | Meaning |
| --- | --- | --- |
| Direct evidence | "From the visible content..." | The artifact explicitly says this |
| Structural inference | "It is reasonable to infer..." | The structure strongly suggests this |
| Missing information | "This cannot be determined because..." | Required evidence is absent |
| Validation need | "To verify this, test..." | Trigger or behavior must be tested |

Avoid unsupported certainty:

- Do not say "the real system prompt is..."
- Do not say "the platform definitely triggers it by..."
- Do not say "the marketplace ranks it because..."
- Do not say "I cracked its hidden rules..."

## Analysis Workflow

1. Capture the user's goal and choose a mode.
2. Identify concrete use cases and likely trigger phrases.
3. Inspect frontmatter, especially `name` and `description`.
4. Extract visible structure: purpose, inputs, workflow, outputs, constraints, examples, tests, resources, and metadata.
5. Reconstruct the implied pipeline: intake, context loading, clarification, planning, execution, validation, final output, error handling, and handoff.
6. Identify skill type and reusable design patterns.
7. Evaluate trigger behavior, workflow completeness, output consistency, safety, portability, context efficiency, and marketplace readiness.
8. Detect risks and failure modes.
9. Generate trigger tests or forward-test scenarios when useful.
10. Reconstruct the creation formula.
11. Produce the requested handoff: diagnosis, report, benchmark, rewrite, package, or comparison.

Do not skip evidence labeling, trigger analysis, or risk analysis. These are the core value of the skill.

## Skill-Creator Audit Checklist

Check the artifact against these standards:

- **Concrete use cases:** realistic examples of when the skill should be used.
- **Name quality:** short, specific, lowercase, hyphenated, and matched to the folder name.
- **Trigger description:** clear user-intent phrases; neither too broad nor too narrow.
- **Description discipline:** describes when to use the skill without trying to compress the whole workflow.
- **Body usefulness:** contains non-obvious procedural guidance, not generic advice.
- **Progressive disclosure:** keeps core workflow in `SKILL.md` and moves heavy references into `references/`.
- **Resource strategy:** includes scripts, references, assets, examples, or templates only when they directly help.
- **Output contract:** makes final answer shapes repeatable.
- **Validation:** includes trigger tests, pressure scenarios, or forward-test guidance.
- **Portability:** avoids platform-specific assumptions unless intentionally platform-specific.
- **Marketplace readiness:** usable by someone who did not create it.

For long skills, call out context cost. If `SKILL.md` approaches 500 lines or embeds large reference material, recommend splitting into linked resource files.

## Trigger Analysis

Identify:

- Direct trigger phrases.
- Semantic trigger patterns.
- User intents that should activate the skill.
- User intents that should not activate it.
- Ambiguous cases.
- Nearby skill conflicts.
- Missing keywords or synonyms.
- Over-broad or under-specified trigger terms.
- Marketplace discoverability issues.
- Description rewrite opportunities.

When trigger reliability matters, produce:

```text
Should trigger: 10 queries
Should not trigger: 10 queries
Ambiguous: 5 queries
Edge cases: 5 queries
```

For each query:

```text
Query:
Expected activation: yes / no / ambiguous
Reason:
```

## Quality Scoring

Score from 1 to 5, with short reasons:

- Intent clarity.
- Trigger precision.
- Trigger recall.
- Workflow completeness.
- Output consistency.
- Reliability.
- Safety.
- Evidence discipline.
- Portability.
- Maintainability.
- Context efficiency.
- Resource strategy.
- Testability.
- Extensibility.
- Marketplace readiness.

Overall rating:

- Production-ready.
- Strong but needs revision.
- Prototype quality.
- Concept only.
- Not recommended in current form.

## Risk Analysis

Look for:

- Trigger risks: over-broad description, missing non-use rules, weak keywords, nearby skill conflicts.
- Workflow risks: vague role, missing inputs, missing output contract, no validation loop, conflicting instructions.
- Scope risks: excessive scope, overlong `SKILL.md`, heavy examples that should move to references.
- Dependency risks: hidden files, unsafe tool assumptions, unavailable platform context.
- Safety risks: prompt injection exposure, unsupported claims, blurred evidence/inference boundary.
- Handoff risks: poor portability, poor marketplace positioning, unclear final deliverable.

For each material risk, explain what it is, why it matters, and how to fix it.

## Creation Formula

Use this structure:

```text
Skill Creation Formula

1. Target user:
2. Repeated task:
3. Core pain point:
4. Desired transformation:
5. Concrete use cases:
6. Trigger intent:
7. Required inputs:
8. Internal workflow:
9. Output contract:
10. Evaluation criteria:
11. Safety boundary:
12. Progressive disclosure strategy:
13. Supporting resources:
14. Reusable pattern:
15. Marketplace positioning:
16. Improvement path:
```

Then summarize:

> This skill was probably created by packaging [repeated task] for [target user] using [workflow pattern], with [trigger strategy], [resource strategy], and [output contract].

## Testing Strategy

When evaluating or improving a skill, define tests before rewriting when practical:

- **Trigger tests:** positive, negative, ambiguous, and edge queries.
- **Application tests:** realistic user requests that require the workflow.
- **Missing-information tests:** incomplete artifacts that should produce partial analysis and caveats.
- **Pressure tests:** requests that tempt the agent to overclaim hidden internals, skip evidence labels, or overproduce.
- **Portability tests:** same artifact framed for different agent systems.

For each test, define expected behavior and the failure it catches.

If subagent forward-testing is available and proportionate, pass the artifact and a realistic user request, not your diagnosis or expected answer.

## Rewrite Rules

If the user asks for improvement, produce actionable changes. Choose the smallest rewrite that solves the observed problems.

Prioritize:

1. Clearer trigger description.
2. More specific use and non-use rules.
3. Better mode selection.
4. Stronger evidence boundaries.
5. More reliable workflow.
6. Clearer output contract.
7. Explicit evaluation criteria.
8. Better testing strategy.
9. Progressive disclosure and lower context cost.
10. Safer marketplace positioning.

Generate a complete improved `SKILL.md` when the user asks for a rewrite, a marketplace-ready version, or when the existing skill is too weak for patch-style advice. Otherwise, provide a targeted patch list plus representative rewritten sections.

## Output Formats

Default to Chinese unless the user asks otherwise.

For quick questions, use:

```text
# 1. 核心结论
# 2. 触发逻辑
# 3. 工作流判断
# 4. 主要问题
# 5. 建议改法
```

For full reverse engineering, use:

```text
# 1. 一句话结论
# 2. 真正解决的问题
# 3. Skill 类型
# 4. 可见结构
# 5. 触发机制
# 6. 工作流
# 7. 隐含设计模式
# 8. 质量评分
# 9. 风险与缺陷
# 10. 触发测试集
# 11. 创建公式
# 12. 改进建议
# 13. 改进版 SKILL.md（仅在需要时）
```

For improvement work, use:

```text
# 1. 改进结论
# 2. 改了什么
# 3. 为什么这么改
# 4. 改进后的关键片段或完整 SKILL.md
# 5. 剩余风险与验证方式
```

## Definition Of Done

A good final answer gives the user at least one of:

- A concise diagnosis.
- A complete reverse-engineering report.
- A reusable skill creation formula.
- A rewritten `SKILL.md`.
- A trigger benchmark.
- A marketplace-ready skill package.
- A comparison of multiple skills.
- A clear statement of missing evidence.

The result must help the user understand, improve, recreate, test, port, or publish the skill.
