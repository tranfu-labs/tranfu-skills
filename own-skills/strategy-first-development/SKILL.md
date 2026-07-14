---
name: strategy-first-development
display_name: Strategy-First Development
display_name_zh: 战略先行开发流程
description: >
  复杂项目开发前的战略共识、成熟项目调研、逐能力积木的广候选池技术选型、路线图规划和项目控制面文档落地 workflow。Always trigger for: 新产品/MVP、多页面 web app、AI 产品、前后端系统、首次技术栈选型、provider/deployment 选择、架构升级、复杂开发，或用户要求先定战略/北极星/路线图/参考项目并避免重复造轮子。Do NOT trigger when: 创建/更新/审查 skill 的元任务、单行命令、小文案、翻译、已明确范围的 bug 修复、纯代码 review，或仅安装/部署已有项目且无需重选产品技术路线。
version: 0.3.0
author: griffithkk3-del
updated_at: 2026-07-14
origin: own
---

# Strategy First Development

Turn a vague or high-impact product/engineering request into a shared control plane before coding. Prevent arbitrary stacks, one-off UI, duplicate infrastructure, and custom engines chosen from memory instead of evidence.

This skill is a development workflow, not a skill-creation or prompt-review workflow. For skill creation, skill review, prompt review, or agent-definition review, route to the relevant skill-specific workflow instead.

## Core Contract

CRITICAL: Complete strategic consensus, reference-project research, and the applicable technology-selection gate before presenting a stack as settled or starting implementation.

When technology selection is in scope, MUST read [Technology Selection Protocol](references/technology-selection-protocol.md) completely and run its `SELECT_STACK` procedure. Mature-product research and per-capability library selection are separate evidence layers; completing one does not satisfy the other.

Only `materialize-strategy` and the strategy phase of `plan-then-implement` may create or update the default artifacts:

`AGENTS.md`, `docs/product/strategy.md`, `docs/product/north-star.md`, `docs/architecture/technical-stack.md`, and `docs/product/roadmap.md`.

`discuss-only` and `strategy-packet` MUST NOT write files. All modes may surface assumptions, gaps, and provisional decisions.

CRITICAL: Strategy artifact materialization may create or update documentation artifacts only. It MUST NOT modify production app code, install dependencies, scaffold runtime modules, change deployment files, run destructive operations, or claim implementation completion unless a later implementation gate is explicitly passed.

For user-facing products, MUST define the project-specific AI/agent role and user-visible experience. Shipped UI MUST NOT expose planning notes, prompts, chain-of-thought, provider/model names, debug text, TODOs, or implementation workflow labels unless the product is explicitly a developer or observability tool.

## Routing Boundaries

- Use this workflow for product direction, initial or reopened stack selection, architecture scope, roadmap, and strategy artifacts.
- Route deep similar-project discovery to `similar-project-reference`, AI/agent architecture to `agentic`, post-stack UI ecosystem work to `ui-ecosystem`, and evaluation-system implementation to `eval` when those skills exist.
- Treat an accepted ADR or canonical stack as a constraint. Reopen it only for an explicit architecture revisit, a broken hard constraint, or new evidence that invalidates the accepted decision.

## Run Modes

Choose one mode before acting:

| Mode | Strategy docs | Production code | Required result |
|---|---|---|---|
| `discuss-only` | MUST NOT write | MUST NOT write | consensus checkpoints and evidence-backed options |
| `strategy-packet` | MUST NOT write | MUST NOT write | `STRATEGY_PACKET`, gates, and next decisions |
| `materialize-strategy` | MAY write after gates | MUST NOT write | updated canonical strategy artifacts |
| `plan-then-implement` | MAY write after gates | MAY write only when explicitly requested and the Implementation Gate passes | strategy artifacts, implementation plan, verification matrix, then bounded implementation |

If mode is ambiguous, ask one focused question or offer 2-3 concrete choices. Authorization to generate strategy files is not authorization to change production code.

## Critical Gates

- MUST keep a visible task plan. Use `update_plan` when available. If no plan tool exists, maintain a checklist in the reply and update it as phases complete.
- MUST inspect existing repo docs and structure before proposing paths or creating files in an existing project.
- MUST prefer updating canonical existing docs over creating duplicate docs.
- MUST ask focused questions across multiple rounds until the consensus gate is satisfied, unless the user explicitly accepts visible assumptions.
- MUST separate mature product/architecture references from per-capability frameworks, libraries, services, platforms, and native/no-dependency baselines.
- For first selection, MUST inventory every applicable decision-worthy capability and compare each against the candidate floor in the Technology Selection Protocol before naming a preferred stack.
- MUST record current primary-source evidence, hard rejects, weighted trade-offs, shortlists, required spikes, cross-stack coherence, smallest integration, verification gate, and exit condition.
- MUST record reference-project dispositions as `adopt|absorb|spike|defer|reject` and technology dispositions as `keep|adopt|spike|defer|reject`.
- MUST NOT hand-roll established engines such as auth, payments, charts, rich text, media processing, scraping, scheduling, search, forms, queues, workflow orchestration, parsing, game/physics rules, or model/provider clients without a written reason.
- MUST define verification before editing and report verification results before handoff.
- NEVER claim completion from code edits or doc edits alone when verification failed, was skipped, or was impossible.

CREATE A TODO LIST FOR THE TASKS BELOW before running this workflow. Use `update_plan` when available; otherwise keep a visible checklist in the reply. Update the plan after each gate with `pending`, `in_progress`, `completed`, or `blocked`.

## Executable Procedure

1. Read the request and workspace. If it is skill/prompt/agent meta-work -> route to the relevant workflow and end.
2. Classify the request. If it is trivial or already scoped with no strategy/stack/roadmap decision -> explain the route and end.
3. Select a run mode. If none can be inferred -> ask one focused question and end.
4. Inspect canonical docs, manifests, runtime/deployment files, tests, accepted ADRs, and uncommitted work before proposing paths or choices. If unreadable -> report a blocker and end.
5. Run consensus rounds. If a hard-required field is open -> ask 1-3 focused questions and stop unless the user accepts visible assumptions.
6. Produce `STRATEGY_PACKET` as the canonical in-memory result.
7. Search mature product and architecture references; record search date, queries, evidence depth, and `adopt|absorb|spike|defer|reject` decisions.
8. Determine `technology_selection.scope`. If stack selection is not applicable -> mark it `not_applicable` with reason and continue. Otherwise -> read the Technology Selection Protocol and run `SELECT_STACK` to produce `STACK_SELECTION_PACKET`.
9. Produce `Now`, `Next`, `Later`, and `Not Doing`, each with evidence gates.
10. Fill `CONSENSUS_GATE` and the applicable `STACK_SELECTION_GATE`. If a hard gate is open/fail -> stop or keep the stack provisional; NEVER label it settled.
11. Build `ARTIFACT_PLAN`. If the mode forbids writes -> output the packet and end.
12. For an authorized materialization mode, update canonical strategy docs only; preserve user-authored content and avoid duplicates.
13. Verify documentation scope, required sections, research status, references, and that no code/deployment/dependency files changed.
14. For `plan-then-implement`, continue only after a visible implementation plan, verification matrix, explicit code authorization, and the Implementation Gate pass.
15. Output the final handoff with decisions, evidence status, changed files, commands/results, assumptions, open risks, and next action. End.

Failure exits:

- Existing repo unreadable -> report blocker; do not make architecture claims.
- Network unavailable -> use local evidence only, mark research `incomplete_with_reason`, keep stack `provisional_pending_spike`, and do not claim current versions or maintenance status.
- Private reference projects unavailable -> ask for links, screenshots, package names, or file trees; do not pretend they were inspected.
- Strategic disagreement remains -> do not write artifacts as accepted; ask focused questions or write only draft assumptions if the user explicitly accepts that.
- Candidate floor cannot be met after documented saturation -> mark `pool_exhausted_with_evidence`; do not pad with weak candidates or silently pass the gate.
- No candidate passes hard constraints -> revise requirements, keep the current/native baseline, spike, or defer; NEVER choose the least-bad failing candidate.
- Primary evidence conflicts or a critical unknown remains -> require a spike or keep the decision provisional.
- Artifact path conflict -> update canonical docs or ask before creating duplicates.
- User requests implementation before gates pass -> run the compressed gates first; if hard-required fields remain open, stop before code.

## Consensus Rounds

Use multiple short rounds instead of one long questionnaire. Each round MUST ask only the highest-leverage missing questions and end with a checkpoint.

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
- For user-facing products, what role should the AI/agent appear to play, what authority does it have, what internal details must stay hidden, and what role-specific quality bar applies?

### Round 3: Constraints

Infer or ask:

- What data, provider, model, deployment, budget, license, privacy, or compliance constraints matter?
- Which logic must be deterministic, and which can be AI-assisted?
- What existing repo, team, runtime, or hosting choices must be respected?
- Is this a first stack selection, a bounded addition to an accepted stack, or a deliberate architecture revisit?

### Round 4: Mature Product And Architecture References

Search based on the agreed strategy, not generic taste. Include mature boring defaults as well as close reference projects.

Required sources when available: GitHub repositories, official documentation, package registries, release notes, issue trackers/discussions when maturity risk matters, and ecosystem boring defaults.

Required decision vocabulary:

- `adopt`: directly use the framework/library/project.
- `absorb`: do not directly depend on it, but reuse its architecture, UI workflow, data model, API shape, module boundary, or operating pattern.
- `reject`: do not use it, with reason.
- `spike`: promising but a named uncertainty must be tested.
- `defer`: not needed now; record the revisit trigger.

### Round 5: Technology Building Blocks And Stack

Run the Technology Selection Protocol. Record:

- the complete applicable `CAPABILITY_BLOCK_INVENTORY`;
- per-block candidate pools and coverage floors;
- frozen hard constraints and weights;
- current primary-source evidence, rejections, shortlists, and spikes;
- selected smallest integrations, custom-build surface, coherence conflicts, verification gates, and exit conditions.

### Round 6: Roadmap And Artifact Plan

Define:

- `Now`: smallest verified slice that proves the strategy.
- `Next`: expansion after `Now` passes.
- `Later`: longer-term opportunities.
- `Not Doing`: attractive but intentionally deferred or rejected work.
- default artifacts to create/update/skip and why.

Each round MUST output:

```markdown
**Consensus Checkpoint**
- Agreed:
- Still Open:
- Proposed Default:
- Need Your Decision:
```

## Wide Technology Selection Contract

Use these selection scopes:

| Scope | Use when | Search behavior |
|---|---|---|
| `wide_first_selection` | greenfield, no accepted stack, core state/process/topology owner is new, or user explicitly requests a broad rethink | inventory all applicable decision-worthy blocks and apply full floors |
| `targeted_change` | add/replace one bounded capability inside an accepted stack | keep accepted choices fixed; compare the current/native baseline and credible compatible alternatives for affected blocks |
| `revalidate_existing` | architecture remains accepted but evidence may be stale or a constraint changed | recheck current evidence, risks, versions, and exit conditions; reopen only failed blocks |

For `wide_first_selection`, these are default minimums, not targets to pad:

| Tier | Typical consequence | Discovered | Credible after basic verification | Distinct solution archetypes | E2 deep-read candidates | Spike |
|---|---|---:|---:|---:|---:|---|
| `A` | high lock-in, state/security/topology owner, expensive migration | 7 | 5 | 3 | 3 | required unless equivalent current evidence exists; test top 1-2 |
| `B` | meaningful production subsystem, reversible with planned work | 5 | 3 | 3 | 2 | when critical evidence is unknown or ranking is fragile |
| `C` | local, low-risk, easily replaceable utility | 3 | 2 | 2 | 1 | normally not required |

Rules:

- Candidate archetypes include the ecosystem default, mature boring default, focused specialist, managed service, self-hosted option, and current/native/no-new-dependency baseline when each is genuinely viable.
- Forks, wrappers around the same engine, toy projects, incompatible options, or candidates with only search-summary evidence do not count toward the credible floor.
- If the market is smaller, record queries, source classes, rejected candidates, and discovery saturation as `pool_exhausted_with_evidence`; NEVER invent weak candidates to meet a number.
- Keep `research_status: pool_exhausted_with_evidence`. `candidate_pool_coverage` may become `pass` only with a schema-valid `CANDIDATE_FLOOR_WAIVER` that names the owner, exhausted evidence, rejected candidates, current/native baseline, accepted residual risk, expiration, and exit path; otherwise it remains `provisional`.
- Freeze must-have constraints, hard filters, and weights before scoring. Hard failures in capability, runtime, license, security/privacy/compliance, data/process ownership, deployment, budget, or explicit non-goals cannot be offset by a weighted score.
- Use `E0 discovered`, `E1 verified`, `E2 deep_read`, and `E3 spiked`. A formal `keep|adopt` decision requires E2. Tier A acceptance requires E3 unless the project has recent evidence for the same major version, deployment shape, workload, and critical constraints.
- Score only eligible candidates. Weights MUST total 100; every score needs evidence; `unknown` is not a neutral score. Run sensitivity analysis for Tier A and spike when the winner changes under reasonable weights or the top two differ by less than 5/100.
- Select per block, then run a whole-stack coherence review for overlapping responsibility, runtime/version compatibility, process and state ownership, auth flow, retry/idempotency, observability/audit, testing, deployment, license, operational burden, and exit paths.
- A candidate can be individually strong yet make the stack fail. `stack_coherence: fail` blocks a settled stack.

Read the reference protocol for the capability baseline, query/source rules, schemas, multi-agent research timetable, spike triggers, convergence rules, and failure exits.

## Consensus Gate

Before writing default artifacts, fill this gate:

```yaml
GATE_RESULT:
  status: pass|provisional|open|fail|not_applicable
  evidence_or_reason:
  owner:
  next_gate:
CONSENSUS_GATE:
  strategic_goal: GATE_RESULT
  target_user: GATE_RESULT
  primary_workflow: GATE_RESULT
  product_shape: GATE_RESULT
  non_goals: GATE_RESULT
  north_star_direction: GATE_RESULT
  agent_positioning: GATE_RESULT
  user_visible_experience: GATE_RESULT
  technical_constraints: GATE_RESULT
  reference_project_search: GATE_RESULT
  technology_selection_scope: GATE_RESULT
  capability_inventory: GATE_RESULT
  candidate_pool_coverage: GATE_RESULT
  current_primary_evidence: GATE_RESULT
  required_spikes: GATE_RESULT
  stack_coherence: GATE_RESULT
  stack_direction: GATE_RESULT
  roadmap_slice: GATE_RESULT
  artifact_plan: GATE_RESULT
```

Gate rules:

- `pass` requires an explicit user decision or canonical source/packet evidence that satisfies the field predicate and has no material conflict; agent inference alone cannot pass.
- `provisional` means a visible unaccepted assumption, waiver, or unresolved spike with owner and next gate. `open` means required input is missing/ambiguous. `fail` means evidence demonstrates a hard conflict. `not_applicable` requires a reason.
- Strategic/product/role fields pass only when populated and accepted by the user or canonical docs. Selection fields pass only through the applicable research protocol. `roadmap_slice` needs a bounded `Now` outcome and evidence gate; `artifact_plan` needs explicit actions and mode-compatible permissions.
- If `strategic_goal`, `target_user`, `primary_workflow`, `product_shape`, or `roadmap_slice` is `open|fail`, MUST ask more questions and MUST NOT materialize accepted artifacts.
- For a user-facing product, `agent_positioning` and `user_visible_experience` MUST be `pass` before accepted artifacts or UI implementation.
- If technology selection is applicable, `capability_inventory`, `candidate_pool_coverage`, `current_primary_evidence`, `required_spikes`, `stack_coherence`, and `stack_direction` MUST all be `pass` before the stack is called settled.
- `provisional` MAY be documented in draft artifacts with the exact gap and next gate, but MUST NOT be presented as accepted.
- `fail` blocks the dependent decision; `not_applicable` requires a reason.
- If `artifact_plan` is `open`, MUST show proposed file actions and wait unless the user explicitly requested default file generation now.

## Strategy Packet

Use this stable schema before materialization:

```yaml
STRATEGY_PACKET:
  schema_version: 0.3
  mode: discuss-only|strategy-packet|materialize-strategy|plan-then-implement
  request_class: greenfield|existing-repo|feature|refactor|deployment|provider-choice|architecture-upgrade
  status_vocabulary:
    research_status: not_applicable|open|in_progress|pass|incomplete_with_reason|pool_exhausted_with_evidence|blocked
    block_decision: accepted|provisional_pending_spike|deferred|rejected
  strategic_goal:
    objective:
    target_user:
    success_evidence:
    non_goals:
  product_shape:
    product_form:
    project_form:
    primary_workflow:
  agent_positioning:
    product_role:
    user_visible_role:
    internal_role:
    authority_boundary:
    hidden_internal_details:
    role_specific_quality_bar:
    failure_behavior:
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
  reference_project_findings:
    research_status:
    search_date:
    queries:
    candidates:
      - name:
        source:
        evidence_depth:
        maturity:
        strategic_fit:
        reusable_parts:
        what_to_absorb:
        risks:
        decision: adopt|absorb|spike|defer|reject
  technology_selection:
    scope: wide_first_selection|targeted_change|revalidate_existing|not_applicable
    scope_reason:
    research_status:
    capability_inventory_ref_or_inline:
    decision_briefs_ref_or_inline:
    candidate_register_ref_or_inline:
    block_decisions:
    stack_coherence_review:
    custom_build_surface:
    smallest_integrations:
    temporary_choices_and_exit_conditions:
    stack_selection_gate:
  roadmap:
    now:
    next:
    later:
    not_doing:
  assumptions:
  open_questions:
```

## Default Artifact Contract

Create or update these only in a write-enabled mode after the applicable gates:

```text
AGENTS.md
docs/product/strategy.md
docs/product/north-star.md
docs/architecture/technical-stack.md
docs/product/roadmap.md
```

If the project already has canonical equivalents, update those instead of creating duplicates. If an existing file has user-authored content, preserve it and merge new strategy sections conservatively.

Optional artifacts MAY be proposed when the user gives richer information:

- `docs/research/technology-selection.md`: when there are more than 8 applicable blocks, more than 20 credible candidates, or the evidence matrix would obscure the canonical stack summary.
- `docs/research/reference-projects.md`: when mature-project research is too large for `technical-stack.md`.
- `docs/product/agent-positioning.md` or `docs/product/experience-contract.md`: when user-facing role, authority, or hidden-detail rules need dedicated governance.
- `docs/product/vision.md`, `docs/product/non-goals.md`, `docs/architecture/system-overview.md`, `docs/architecture/module-map.md`, `docs/quality/verification-strategy.md`, or `docs/research/open-questions.md`: only when their content is substantial and no canonical equivalent exists.
- `docs/decisions/NNNN-*.md`: REQUIRED for a Tier A accepted decision that changes orchestration, state/data ownership, primary runtime/framework, auth, deployment topology, or another expensive-to-reverse boundary.
- `CLAUDE.md` and `CODEX.md`: optional pointer/overlay files only. Keep `AGENTS.md` canonical; do not duplicate the complete strategy into tool-specific files.

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

## Artifact Content Requirements

Generated strategy docs MUST expose status, source basis, assumptions, open questions, and change policy, unless an established project format provides equivalent fields. `draft` is the default until the project owner accepts the decision.

| Artifact | Required content |
|---|---|
| `AGENTS.md` | project mission; canonical docs; project agent positioning; user-visible experience and hidden details; before-editing rules; architecture/development rules; verification; safety; handoff |
| `docs/product/strategy.md` | status/source basis; vision; strategic goal; users; primary workflow; product shape; differentiation; non-goals; agent role/experience; assumptions; questions; change policy |
| `docs/product/north-star.md` | status/source basis; metric; value rationale; inputs; guardrails; anti-metrics; measurement; assumptions/unknowns; review cadence; change policy |
| `docs/architecture/technical-stack.md` | status/source basis; selection scope/date; strategic constraints; capability inventory; search method/query log; reference findings; hard filters/weights; per-block candidate summaries; deep shortlists/spikes; stack coherence; accepted/provisional/deferred/rejected choices; smallest integrations; custom surface; versions checked; verification gates; exit/revalidation triggers; assumptions/questions/change policy |
| `docs/product/roadmap.md` | status/source basis; Now/Next/Later/Not Doing; phase gates; stack spikes and provisional decisions; risks; assumptions/questions; change policy |

If detailed selection evidence is split into `docs/research/technology-selection.md`, `technical-stack.md` MUST remain the canonical summary and link to it. Do not create one file per capability block.

## Implementation Gate

Only start coding when all are visible:

- strategic goal, product shape, primary workflow, project agent role, and expected user experience;
- reference-project findings and `STACK_SELECTION_PACKET` for every applicable `Now`/P0 block;
- every `Now`/P0 block is `accepted`; a `provisional_pending_spike` block authorizes only the named spike, not production implementation;
- architecture/module ownership, smallest integration points, custom-build surface, and accepted ADRs;
- implementation plan, verification matrix, rollback/exit conditions, artifact status, and explicit code authorization.

Urgency may compress presentation, never skip hard constraints, current evidence, candidate coverage, coherence, or verification.

## Verification And Handoff

For documentation materialization, verify:

- intended files exist in the intended locations;
- existing canonical docs were updated rather than duplicated;
- generated docs are marked `draft` unless the user explicitly accepted them;
- source basis, assumptions, open questions, research status, block decisions, and revalidation triggers are visible;
- every selected technology maps to one capability block and every applicable block has a decision or explicit deferral;
- production app code, dependency manifests, deployment files, and runtime modules were not changed during strategy materialization.

For later code implementation, verify in layers:

1. deterministic checks: tests, typecheck, lint, build, config render;
2. runtime checks: local server, API health, smoke workflow, browser screenshot if UI;
3. deployment checks: compose/rendered config, env template consistency, healthcheck, logs;
4. product checks: compare against strategy, north star, roadmap, and expected experience.

Final handoff must say:

- what was discussed, decided, created, or changed;
- which strategic choice and capability blocks the work covers;
- what references were adopted/absorbed and what technologies were kept/adopted/spiked/deferred/rejected;
- verification commands and results;
- remaining risks, assumptions, or follow-up decisions.

## What NOT To Do

Stop and reset if the agent is about to:

- write accepted artifacts before strategic goal, target user, product shape, roadmap slice, and applicable gates are clear;
- code before understanding the target user, product shape, and roadmap;
- invent a custom framework when mature libraries exist;
- choose a stack from familiar names before inventorying capability blocks;
- count same-engine wrappers, weak/incompatible projects, or search snippets as credible breadth;
- score a candidate that failed a hard constraint or treat `unknown` as a neutral score;
- call a provisional decision settled, or omit the runner-up, rejection reason, smallest integration, verification gate, or exit condition;
- build UI without references, expected states, agent positioning, or a hidden-internal-details contract;
- add provider/API integrations without reading current docs or local config;
- mix unrelated refactors with strategy materialization;
- overwrite existing canonical docs without preserving user-authored content;
- claim completion without running checks;
- let parallel researchers change frozen criteria or independently choose incompatible stacks; the primary agent owns scoring and whole-stack coherence.

## Output Contract

Render the canonical schemas; do not invent a second incompatible output shape:

- `STRATEGY_PACKET` is canonical; `CONSENSUS_GATE` and `STACK_SELECTION_GATE` control status and permissions.
- `STACK_SELECTION_PACKET` contains auditable capability/candidate decisions; `ARTIFACT_PLAN` controls file actions.
- Human-readable summaries MUST preserve canonical statuses, gaps, and next gates.

## Examples

<example>
User: 这是新项目，先广泛比较技术栈，不要写代码。

Good result fragment:

```yaml
technology_selection:
  scope: wide_first_selection
  block_decisions:
    - block_id: identity-auth
      tier: A
      pool: {discovered: 7, credible: 5, archetypes: 3, gate: pass}
      shortlist: ["candidate-a:E2", "candidate-b:E2", "candidate-c:E2"]
      spike: {required: true, reason: session-and-tenant-boundary-unknown}
      decision_status: provisional_pending_spike
    - block_id: date-formatting
      tier: C
      pool: {discovered: 3, credible: 2, archetypes: 2, gate: pass}
      shortlist: ["native-baseline:E2"]
      decision_status: accepted
  stack_coherence_review: provisional
```
</example>

<bad-example>
WRONG: "我搜索了 Next.js、Supabase 和 LangChain，所以技术栈调研完成。"

Why bad: no capability inventory, per-block pool, native baseline, hard filters, evidence depth, shortlist/spike, or whole-stack coherence review.
</bad-example>

## Related Workflows

- `similar-project-reference` handles deep reference discovery; `agentic`, `ui-ecosystem`, and `eval` handle domain architecture or post-selection execution.
- `write-spec`, `project-init-docs`, and `architecture-hygiene` handle later specification, project-control, and drift work.
- `skill-creator`, `skill-create-workflow`, `skill-domain-framing`, `skill-content-fit`, and `prompt-review`: skill meta-work; this workflow does not handle skill creation/review.

## Known Limits

- This skill neither replaces final strategic judgment nor proves product-market fit; private domains require user-provided material.
- Network failure permits only provisional stack recommendations with visible research gaps.
- Strategy artifacts are revisable baselines; update them when evidence changes.
