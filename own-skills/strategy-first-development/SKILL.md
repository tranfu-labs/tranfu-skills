---
name: strategy-first-development
description: >
  复杂项目开发前的战略共识、成熟项目调研、技术栈选择、路线图规划和项目控制面文档落地 workflow。Always trigger for: 新产品/MVP、多页面 web app、AI 产品、前后端系统、provider/deployment 选择、架构升级、复杂开发、用户要求先定战略/北极星/路线图/技术栈/参考项目或避免重复造轮子。Do NOT trigger when: 创建/更新/审查 skill 的元任务、单行命令、小文案、翻译、已明确范围的 bug 修复、纯代码 review、仅安装/部署已有项目且无需重选产品技术路线。
version: 0.2.0
author: griffithkk3-del
updated_at: 2026-06-22
origin: own
---

# Strategy First Development

Use this skill to turn a vague or high-impact product/engineering request into a shared project control plane before coding. The goal is to stop agents from wandering through random features, arbitrary stacks, one-off UI, duplicate infrastructure, or fragile custom logic when strategic consensus and mature projects should guide the work.

This skill is a development workflow, not a skill-creation or prompt-review workflow. For skill creation, skill review, prompt review, or agent-definition review, route to the relevant skill-specific workflow instead.

## Core Contract

CRITICAL: After enough strategic discussion and mature-project research, this skill MUST create or update the default project strategy artifacts unless the user explicitly requests discussion only:

- `AGENTS.md`
- `docs/product/strategy.md`
- `docs/product/north-star.md`
- `docs/architecture/technical-stack.md`
- `docs/product/roadmap.md`

These artifacts are the project control plane for future harness/agent development. Their purpose is to make later work strategy-aligned, stack-consistent, roadmap-aware, evidence-backed, and resistant to random generation or repeated reinvention.

CRITICAL: Strategy artifact materialization may create or update documentation artifacts only. It MUST NOT modify production app code, install dependencies, scaffold runtime modules, change deployment files, run destructive operations, or claim implementation completion unless a later implementation gate is explicitly passed.

## When To Use

Use this skill when the user says or implies:

- 先和 AI 多轮讨论战略目标、项目形态、产品形态、北极星、路线图;
- 新产品、新 MVP、复杂功能、架构升级、AI 产品、前后端系统、provider/deployment 选择;
- 给 agent 看预期截图、参考产品、竞品页面，或让 agent 生成预期页面方向;
- 先搜索 GitHub 成熟项目、官方框架、生态默认方案，再确定技术栈;
- 优化架构、模块、工作流程，避免重复造轮子;
- 让项目有战略、技术栈、路线图和后续 harness/agent 可遵循的控制面文档。

Do NOT trigger this skill for one-line commands, small copy edits, simple translations, already-scoped bug fixes, pure code review, release/publish work, or skill/prompt/agent meta-work unless the user explicitly asks to rethink product strategy, technology direction, or roadmap.

## Run Modes

The agent MUST choose one mode before acting:

- `discuss-only`: use when the user wants conversation, analysis, or options only. Output consensus checkpoints and stop without writing files.
- `strategy-packet`: use only when the user explicitly asks for a complete strategy plan without writing files. Output `STRATEGY_PACKET`, `CONSENSUS_GATE`, and next decisions.
- `materialize-strategy`: use when the user asks to generate, initialize, or land strategy files. Complete the consensus and mature-project gates, show or infer the artifact plan, then create/update the default artifacts.
- `plan-then-implement`: use when the user explicitly asks to proceed with implementation after planning. First complete the strategy/materialization gates; only then produce an implementation plan and verification matrix before code changes.

If the mode is ambiguous, ask one focused question or offer 2-3 concrete mode choices. If the user explicitly says to generate the default strategy files, that is sufficient authorization for documentation edits, but not for production code edits.

## Critical Gates

- MUST keep a visible task plan. Use `update_plan` when available. If no plan tool exists, maintain a checklist in the reply and update it as phases complete.
- MUST inspect existing repo docs and structure before proposing paths or creating files in an existing project.
- MUST prefer updating canonical existing docs over creating duplicate docs.
- MUST ask focused questions across multiple rounds until the consensus gate is satisfied, unless the user explicitly accepts visible assumptions.
- MUST search and analyze mature GitHub projects, official frameworks, package registries, ecosystem defaults, and primary docs before choosing the technical stack when network access is available.
- MUST record what to `adopt`, what to `absorb`, what to `reject`, and what remains custom because it is strategic differentiation.
- MUST NOT hand-roll established engines such as auth, payments, charts, rich text, media processing, scraping, scheduling, search, forms, queues, workflow orchestration, parsing, game/physics rules, or model/provider clients without a written reason.
- MUST define verification before editing and report verification results before handoff.
- NEVER claim completion from code edits or doc edits alone when verification failed, was skipped, or was impossible.

CREATE A TODO LIST FOR THE TASKS BELOW before running this workflow. Use `update_plan` when available; otherwise keep a visible checklist in the reply. Update the plan after each gate with `pending`, `in_progress`, `completed`, or `blocked`.

## Executable Procedure

1. Read the user request and current workspace. If the request is skill/prompt/agent meta-work -> route to the relevant workflow and end.
2. Classify the request. If it is trivial, one-line, or an already-scoped bug fix with no strategy/stack/roadmap question -> do not use this skill; explain the route and end.
3. Select run mode: `discuss-only`, `strategy-packet`, `materialize-strategy`, or `plan-then-implement`. If no mode can be inferred -> ask one focused question and end.
4. Inspect existing repo docs before path decisions. If the repo cannot be read -> report a blocker and end.
5. Run consensus rounds. If a required consensus field is open -> ask 1-3 focused questions or offer 2-3 concrete options; stop until answered unless the user accepts assumptions.
6. Produce a `STRATEGY_PACKET` with strategic goal, product shape, primary workflow, non-goals, constraints, risks, and open questions.
7. Run mature-project search before stack choice. If network is unavailable -> mark search `incomplete_with_reason`, use local evidence and known ecosystem defaults, and do not present the stack as fully validated.
8. Produce mature-project findings with `adopt` / `absorb` / `reject` / `inspect_later` decisions.
9. Produce a technical stack direction tied to strategic requirements and mature-project findings.
10. Produce roadmap slices: `Now`, `Next`, `Later`, and `Not Doing`, each with gates or evidence requirements.
11. Fill `CONSENSUS_GATE`. If any hard-required field is `open` -> stop, show the gap, and ask one focused question.
12. Build `ARTIFACT_PLAN`. If the user explicitly requested no file writes -> show the plan and stop without editing.
13. If mode is `materialize-strategy` or the user confirmed file generation -> create/update the default artifacts only; otherwise output the packet and end.
14. Verify documentation edits: intended files exist, existing canonical docs were not duplicated, generated docs have status/source/open-question sections, and no production code/deployment files changed.
15. If mode is `plan-then-implement`, continue only after the implementation gate is visible and passes; otherwise stop with handoff notes.
16. Output final handoff with changed/created files, research/search status, verification commands/results, assumptions, open risks, and next recommended action. End.

Failure exits:

- Existing repo unreadable -> report blocker; do not make architecture claims.
- Network unavailable -> mark mature-project search incomplete; do not present stack as fully validated.
- Private reference projects unavailable -> ask for links, screenshots, package names, or file trees; do not pretend they were inspected.
- Strategic disagreement remains -> do not write artifacts as accepted; ask focused questions or write only draft assumptions if the user explicitly accepts that.
- Artifact path conflict -> update canonical docs or ask before creating duplicates.
- User requests implementation before gates pass -> run the compressed gates first; if hard-required fields remain open, stop before code.

## Consensus Rounds

Use multiple short rounds instead of one long questionnaire. Each round should ask only the highest-leverage missing questions and end with a checkpoint.

### Round 1: Strategic Goal

Infer or ask:

- Who is the primary user: the builder, an internal team, public users, enterprise customers, or other AI agents?
- What concrete evidence would prove this project is successful in 1-3 months?
- What is the dominant constraint: speed, quality, extensibility, compliance, safety, cost, polish, or demo impact?

### Round 2: Product Shape

Infer or ask:

- What is the first high-value user action or API/agent call?
- Is the product a web app, API, CLI, MCP server, agent workflow, dashboard, browser extension, plugin, data pipeline, internal tool, or platform?
- Which tempting features are explicitly out of scope for the first slice?

### Round 3: Constraints

Infer or ask:

- What data, provider, model, deployment, budget, license, privacy, or compliance constraints matter?
- Which logic must be deterministic, and which can be AI-assisted?
- What existing repo, team, runtime, or hosting choices must be respected?

### Round 4: Mature Project Search

Search based on the agreed strategy, not generic taste. Include mature boring defaults as well as close reference projects.

Required sources when available:

- GitHub repositories;
- official documentation;
- package registries;
- release notes;
- issue trackers/discussions when maturity risk matters;
- ecosystem boring defaults.

Required decision vocabulary:

- `adopt`: directly use the framework/library/project.
- `absorb`: do not directly depend on it, but reuse its architecture, UI workflow, data model, API shape, module boundary, or operating pattern.
- `reject`: do not use it, with reason.
- `inspect_later`: promising but insufficient evidence for this gate.

### Round 5: Stack And Absorption Plan

Choose the stack only after strategy and mature-project search. Record:

- strategic requirements served by the stack;
- adopted libraries/frameworks;
- absorbed patterns from mature projects;
- rejected alternatives and reasons;
- custom-build surface and why it is strategic differentiation;
- temporary choices and exit conditions.

### Round 6: Roadmap And Artifact Plan

Define:

- `Now`: smallest verified slice that proves the strategy.
- `Next`: expansion after `Now` passes.
- `Later`: longer-term opportunities.
- `Not Doing`: attractive but intentionally deferred or rejected work.
- default artifacts to create/update/skip and why.

Each round should output:

```markdown
**Consensus Checkpoint**
- Agreed:
- Still Open:
- Proposed Default:
- Need Your Decision:
```

## Consensus Gate

Before writing default artifacts, fill this gate:

```yaml
CONSENSUS_GATE:
  strategic_goal: pass|open
  target_user: pass|open
  primary_workflow: pass|open
  product_shape: pass|open
  non_goals: pass|open
  north_star_direction: pass|open
  technical_constraints: pass|open
  mature_project_search: pass|incomplete_with_reason|open
  stack_direction: pass|open
  roadmap_slice: pass|open
  artifact_plan: pass|open
```

Gate rules:

- If `strategic_goal`, `target_user`, `primary_workflow`, `product_shape`, or `roadmap_slice` is `open`, MUST ask more questions and MUST NOT write files.
- If `mature_project_search` is `open`, MUST search before writing `docs/architecture/technical-stack.md`.
- If `mature_project_search` is `incomplete_with_reason`, MAY write draft files, but MUST mark the research gap inside `technical-stack.md`.
- If `stack_direction` is `open`, MAY write product strategy and roadmap as draft, but MUST NOT present `technical-stack.md` as settled.
- If `artifact_plan` is `open`, MUST show proposed file actions and wait unless the user explicitly requested default file generation now.

## Strategy Packet

Use this stable schema before materialization:

```yaml
STRATEGY_PACKET:
  mode: discuss-only|strategy-packet|materialize-strategy|plan-then-implement
  request_class: greenfield|existing-repo|feature|refactor|deployment|provider-choice|architecture-upgrade
  strategic_goal:
    objective:
    target_user:
    success_evidence:
    non_goals:
  product_shape:
    product_form:
    project_form:
    primary_workflow:
  north_star:
    candidate_metric:
    input_metrics:
    guardrail_metrics:
    anti_metrics:
  constraints:
    technical:
    data:
    provider:
    deployment:
    compliance_or_safety:
  mature_project_findings:
    search_status: complete|incomplete_with_reason|skipped_with_reason
    candidates:
      - name:
        source:
        maturity:
        strategic_fit:
        reusable_parts:
        what_to_absorb:
        risks:
        decision: adopt|absorb|reject|inspect_later
  stack_decision:
    chosen_stack:
    adopted_projects:
    absorbed_patterns:
    rejected_options:
    custom_build_surface:
    temporary_choices_and_exit_conditions:
  roadmap:
    now:
    next:
    later:
    not_doing:
  assumptions:
  open_questions:
```

## Default Artifact Contract

Default artifacts MUST be created or updated after consensus and research:

```text
AGENTS.md
docs/product/strategy.md
docs/product/north-star.md
docs/architecture/technical-stack.md
docs/product/roadmap.md
```

If the project already has canonical equivalents, update those instead of creating duplicates. If an existing file has user-authored content, preserve it and merge new strategy sections conservatively.

Optional artifacts MAY be proposed when the user gives richer information:

- `docs/product/vision.md`: only when long-term company/product vision is clear enough to deserve its own file.
- `docs/product/non-goals.md`: when non-goals are numerous or high-risk.
- `docs/architecture/system-overview.md`: when the project crosses frontend, backend, AI, data, and deployment.
- `docs/architecture/module-map.md`: when an existing repo has enough structure that agents need module ownership boundaries.
- `docs/architecture/verification-strategy.md`: when verification needs dedicated treatment.
- `docs/research/reference-projects.md`: when mature-project research is too large for `technical-stack.md`.
- `docs/research/open-questions.md`: when unresolved questions are numerous.
- `docs/decisions/0001-*.md`: when a decision should be tracked as an ADR.

## Artifact Plan

Before writing files, produce or infer:

```yaml
ARTIFACT_PLAN:
  default_artifacts:
    - path: AGENTS.md
      action: create|update|skip
      reason:
    - path: docs/product/strategy.md
      action: create|update|skip
      reason:
    - path: docs/product/north-star.md
      action: create|update|skip
      reason:
    - path: docs/architecture/technical-stack.md
      action: create|update|skip
      reason:
    - path: docs/product/roadmap.md
      action: create|update|skip
      reason:
  optional_artifacts:
    - path:
      action: create|update|skip
      reason:
  may_write_docs: true|false
  may_write_code: false
```

## Artifact Templates

All generated strategy artifacts MUST include a draft status, source basis, assumptions, open questions, and a change policy unless the existing project format clearly uses another equivalent structure.

### `AGENTS.md`

```markdown
# Project Agent Guide

## Project Mission

## Canonical Docs

- Strategy: `docs/product/strategy.md`
- North Star: `docs/product/north-star.md`
- Roadmap: `docs/product/roadmap.md`
- Technical Stack: `docs/architecture/technical-stack.md`

## Before Editing

## Development Rules

## Verification

## Safety Boundaries

## Handoff Requirements
```

### `docs/product/strategy.md`

```markdown
---
status: draft
created_by: strategy-first-development
---

# Product Strategy

## Vision

## Strategic Goal

## Target Users

## Primary Use Case

## Product Shape

## Core Workflow

## Differentiation

## Non-Goals

## Assumptions

## Open Questions

## Change Policy
```

### `docs/product/north-star.md`

```markdown
---
status: draft
created_by: strategy-first-development
---

# North Star

## North Star Metric

## Why This Metric Represents Core Value

## Input Metrics

## Guardrail Metrics

## Anti-Metrics

## Measurement Plan

## Current Unknowns

## Review Cadence
```

### `docs/architecture/technical-stack.md`

```markdown
---
status: draft
created_by: strategy-first-development
---

# Technical Stack

## Strategic Requirements

## Existing Constraints

## Mature Project Research Summary

| Candidate | Source | Maturity | Strategic Fit | Reusable Parts | What To Absorb | Risks | Decision |
|---|---|---|---|---|---|---|---|

## Chosen Stack

- Frontend:
- Backend:
- Data / Storage:
- AI / Model / Agent:
- Auth:
- Jobs / Queue:
- Search:
- Deployment:
- Observability:
- Testing:

## What We Adopt

## What We Absorb

## What We Reject

## Custom-Build Surface

## Temporary Choices And Exit Conditions

## Change Policy
```

### `docs/product/roadmap.md`

```markdown
---
status: draft
created_by: strategy-first-development
---

# Roadmap

## Now

## Next

## Later

## Not Doing

## Phase Gates

## Risks

## Open Questions
```

## Implementation Gate

Only start coding after producing a compact implementation plan with:

- strategic goal;
- chosen product/project shape;
- expected experience artifact or description;
- mature project/library findings;
- chosen stack and rejected alternatives;
- architecture/module plan;
- verification matrix;
- status of default strategy artifacts.

For urgent tasks, this can be compressed, but strategy, mature-project search/stack, roadmap, architecture, and verification must still be visible.

## Verification And Handoff

For documentation materialization, verify:

- intended files exist in the intended locations;
- existing canonical docs were updated rather than duplicated;
- generated docs are marked `draft` unless the user explicitly accepted them;
- assumptions and open questions are visible;
- mature-project search status is visible in `technical-stack.md`;
- production app code, dependency manifests, deployment files, and runtime modules were not changed during strategy materialization.

For later code implementation, verify in layers:

1. deterministic checks: tests, typecheck, lint, build, config render;
2. runtime checks: local server, API health, smoke workflow, browser screenshot if UI;
3. deployment checks: compose/rendered config, env template consistency, healthcheck, logs;
4. product checks: compare against strategy, north star, roadmap, and expected experience.

Final handoff must say:

- what was discussed, decided, created, or changed;
- which strategic choice the work implements;
- what mature projects/frameworks were adopted or absorbed;
- verification commands and results;
- remaining risks, assumptions, or follow-up decisions.

## What NOT To Do

Stop and reset if the agent is about to:

- write strategy artifacts before strategic goal, target user, product shape, roadmap slice, and mature-project search are clear or explicitly assumed;
- code before understanding the target user, product shape, and roadmap;
- invent a custom framework when mature libraries exist;
- choose a stack before searching mature projects and official defaults;
- build UI without references, mockups, or expected states;
- add provider/API integrations without reading current docs or local config;
- mix unrelated refactors with strategy materialization;
- overwrite existing canonical docs without preserving user-authored content;
- claim completion without running checks;
- treat "I know a stack" as a substitute for mature-project search;
- let multiple agents independently choose incompatible stacks or edit overlapping files.

## Output Template

For a new project or major feature, use this concise structure:

```markdown
**Mode**
...

**Consensus Checkpoint**
- Agreed:
- Still Open:
- Proposed Default:
- Need Your Decision:

**Mature Project Findings**
| Candidate | Source | Maturity | Strategic Fit | Reusable Parts | What To Absorb | Risks | Decision |
|---|---|---|---|---|---|---|---|

**Stack Direction**
...

**Roadmap**
- Now:
- Next:
- Later:
- Not Doing:

**Artifact Plan**
- `AGENTS.md`: create/update/skip because ...
- `docs/product/strategy.md`: create/update/skip because ...
- `docs/product/north-star.md`: create/update/skip because ...
- `docs/architecture/technical-stack.md`: create/update/skip because ...
- `docs/product/roadmap.md`: create/update/skip because ...

**Next Action**
...
```

## Examples

<example>
User: 我想做一个高考生知道分数后准备选学校和专业的网页，先充分讨论并落地战略文件。

Good response shape:

```markdown
**Mode**
materialize-strategy

**Consensus Checkpoint**
- Agreed: target user is gaokao students/families after score release; first workflow is province/score/rank -> comparable school/major shortlist.
- Still Open: data source and target province/year.
- Proposed Default: use public fixture data for strategy docs, mark official data integration open.
- Need Your Decision: start with one province or national multi-province support?
```

After consensus and mature-project search, create/update the default artifact set. `technical-stack.md` records table/form/chart libraries to adopt, admissions-project patterns to absorb, and generic education portals to reject.
</example>

<bad-example>
User: 做一个高考出分后选学校和专业的网页。

Bad response:

```markdown
我直接用 Next.js + Tailwind 开始写。页面包括首页、推荐页、详情页。
```

Why bad: it skips strategic consensus, target user evidence, expected workflow, mature-project search, stack reasoning, roadmap, default strategy artifacts, and verification.
</bad-example>

## Related Workflows

- `write-spec`: feature PRD/spec generation after strategy and product direction are clear.
- `project-scoring`: evaluates whether an AI workflow is worth investing in.
- `architecture-hygiene`: audits and cleans architecture drift after or during development.
- `project-init-docs`: initializes broader AI collaboration docs for an existing repo.
- `skill-create-workflow`, `skill-domain-framing`, `skill-content-fit`, `prompt-review`: skill meta-work. This skill does not handle skill creation/review tasks.

## Known Limits

- This skill does not replace the user's final strategic judgment.
- It does not prove a business model or product-market fit.
- Private domains require user-provided material.
- Network failure can only produce draft stack recommendations with visible research gaps.
- Strategy artifacts are baselines, not immutable specs; update them when evidence changes.
