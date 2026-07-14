# Technology Selection Protocol

Read this file completely whenever `strategy-first-development` selects, reopens, or revalidates a technology stack. It governs direct libraries, frameworks, managed services, self-hosted platforms, native/no-dependency baselines, and custom-build proposals. It does not require individual selection of every transitive dependency unless security, license, provenance, or runtime compatibility makes one decision-critical.

## Contents

1. Stable vocabulary
2. `SELECT_STACK` procedure
3. Capability inventory baseline
4. Candidate-pool coverage
5. Search and evidence standards
6. Hard filters and weighted comparison
7. Shortlist, spike, and convergence
8. Whole-stack coherence
9. Parallel research protocol
10. Canonical schemas
11. Failure exits and revalidation
12. Method basis

## 1. Stable Vocabulary

Use these enums consistently:

```yaml
RESEARCH_STATUS: not_applicable|open|in_progress|pass|incomplete_with_reason|pool_exhausted_with_evidence|blocked
GATE_STATUS: pass|provisional|open|fail|not_applicable
DEPENDENCY_DISPOSITION: keep|adopt|spike|defer|reject
BLOCK_DECISION_STATUS: accepted|provisional_pending_spike|deferred|rejected
EVIDENCE_DEPTH: E0_discovered|E1_verified|E2_deep_read|E3_spiked
```

- `keep`: retain an existing/native/no-new-dependency solution.
- `adopt`: introduce or standardize the candidate after all applicable gates pass.
- `spike`: run a named, bounded experiment to resolve a material uncertainty.
- `defer`: no current need; record the roadmap and revisit trigger.
- `reject`: do not use under current constraints; retain the reason.
- `accepted`: eligible for implementation in its declared scope.
- `provisional_pending_spike`: may enter the roadmap, but only the named spike is authorized until the gate is rerun.

For reference projects, keep the separate vocabulary `adopt|absorb|spike|defer|reject`; `absorb` means reuse a pattern without depending on the project.

## 2. `SELECT_STACK` Procedure

CREATE A TODO LIST FOR THE TASKS BELOW before running this procedure.

1. Validate prerequisites. If strategic goal, primary workflow, product shape, roadmap slice, or hard constraints are open -> return `STACK_SELECTION_GATE` with the open fields and stop.
2. Inspect existing dependencies, manifests, canonical docs, accepted ADRs, deployment/runtime constraints, and current module/data/process owners. If unreadable -> return `blocked` and stop.
3. Classify scope as `wide_first_selection`, `targeted_change`, or `revalidate_existing`. If an accepted decision is outside scope -> freeze it as a constraint; do not reopen it.
4. Build `CAPABILITY_BLOCK_INVENTORY`. Mark every baseline category `applicable|not_applicable|deferred` with reason. Assign each applicable block Tier A, B, or C.
5. For every Tier A/B block, freeze a `DECISION_BRIEF`, hard filters, scoring dimensions, weights, and candidate floor before scoring candidates. A later criteria change MUST record who changed it and why.
6. Search mature product/architecture references and per-block technology candidates as separate workstreams. Record search date, query families, source classes, discovered candidates, and rejected candidates.
7. Verify candidate identity, target capability, supported versions/runtime, license, lifecycle, maintenance, official evidence, and obvious hard constraints. Only verified candidates count toward the credible floor.
8. Check coverage. If a block misses its candidate/archetype/source floor -> search additional query families. If new credible archetypes still appear -> continue discovery. If discovery is saturated -> record `pool_exhausted_with_evidence`; otherwise keep the gate open.
9. Apply hard filters before weighted scoring. Any hard failure -> `reject`; do not score it into the shortlist.
10. Deep-read eligible candidates. Inspect relevant official docs/API/config, package metadata, releases, tests/examples, issue/discussion evidence, security status, migration/exit path, and the mature reference projects that actually use them.
11. Score evidence-backed criteria, attach confidence, and run sensitivity analysis. If the ranking changes under reasonable weights/measurement uncertainty -> keep the decision provisional and define a spike.
12. For Tier A/B, select 2-3 finalists representing real trade-offs. Tier C may select one E2 winner after comparing at least two credible options. If only one credible option survives -> require `pool_exhausted_with_evidence` or an immutable constraint plus independent review.
13. Define and, only when authorized, run the same-harness spike for candidates that require E3. If code or dependency changes are not authorized -> record the spike plan and keep the block provisional.
14. Record winner, runner-up, rejected alternatives, smallest integration, verification gate, owner, custom surface, exit condition, and revisit triggers for each block.
15. Run `STACK_COHERENCE_REVIEW` across all provisional winners. Resolve overlaps or incompatibilities; an individually strong candidate does not pass a failing whole stack.
16. Fill `STACK_SELECTION_GATE`. If all applicable hard fields pass -> mark eligible block decisions accepted. If a field is provisional/open/fail -> preserve that status and prohibit a settled-stack claim.
17. Produce `STACK_SELECTION_PACKET` and end.

Failure exits:

- Network or primary sources unavailable -> `incomplete_with_reason`; current versions, maintenance, price, compatibility, or security MUST NOT be claimed as verified.
- No candidate passes hard filters -> revisit capability shape, requirements, build/buy boundary, or roadmap; NEVER select the least-bad failure.
- Evidence conflicts -> define an E3 spike or keep the decision provisional.
- Timebox expires -> record `timeboxed_exception`, owner, allowed scope, expiration, and next gate; do not silently reduce security/license/data hard filters.

## 3. Capability Inventory Baseline

Inventory decision-worthy capabilities, not arbitrary package names. A block is decision-worthy when it owns or materially affects state, data, identity, security, tasks, deployment topology, a primary framework, the core workflow, or a critical build/test/operations boundary.

### All projects: MUST mark each item

| Capability block | Default tier guidance |
|---|---|
| language/runtime and version policy | A |
| application/backend framework and API transport | A |
| API contracts, schema, and validation | B; A when public or cross-service |
| primary persistence/database | A |
| query layer, ORM, and schema migrations | A/B |
| configuration and secrets | A |
| logging, metrics, tracing, and audit | B; A when regulated/mission-critical |
| unit/integration/contract test harness | B |
| packaging, deployment runtime, CI/CD, and rollback | A |

### Conditional production capabilities

Mark `applicable` or `not_applicable` with reason:

- identity, auth/session, authorization/policy;
- jobs, queue, scheduler, workflow, retry, idempotency, and webhooks;
- cache, search/index, object/file storage, parsing/ingestion, and media processing;
- external provider/API clients, rate limiting, notifications, analytics, feature flags;
- payments, billing, tax, subscription, and entitlement;
- backup/restore, retention, data export, privacy deletion, and disaster recovery.

Treat auth/authorization, payments, workflow/orchestration, primary queues, canonical storage, untrusted-input parsing, core search/RAG, deployment runtime, and any new state/process owner as Tier A by default.

### Web/UI products

- frontend/meta-framework, router, rendering mode, server/client boundary;
- styling, component primitives, and design-system ownership;
- server/client state, data fetching, caching, and mutation;
- forms and validation;
- tables/data grids, charts, editor, upload, date/time, command/search UI only when the primary workflow requires them;
- browser/E2E, visual regression, accessibility, and performance budgets.

### AI/agent products

- provider/model client or gateway and provider failover policy;
- structured output/schema validation and deterministic baseline;
- orchestration shape, tool permissions, approval/handoff, and failure recovery;
- runtime state/checkpoint, memory, canonical knowledge, and business database boundaries;
- retrieval, embedding, reranking, vector store only when the workflow proves a need;
- eval, tracing, observability, safety/policy, cost/latency controls, and prompt/version governance.

Transitive dependencies are normally reviewed by lockfile/SBOM/security tooling rather than receiving their own stack block. Promote one into the inventory when it is security-critical, license-sensitive, runtime-shaping, or otherwise high blast radius.

## 4. Candidate-Pool Coverage

Use the Tier A/B/C floors in the parent `SKILL.md`. The floor is satisfied only by credible, materially distinct candidates; candidate count alone never passes the gate.

### Required archetype coverage

For Tier A/B, attempt to include at least three viable archetypes among:

1. current solution, stack-native default, or no-new-dependency baseline;
2. mature boring/category default;
3. focused specialist closest to the primary workflow;
4. different architecture or operating model: library/framework, managed/self-hosted, embedded/service, relational extension/specialized store;
5. portable/open-source versus vendor/cloud-specific;
6. promising challenger with a clearly stated advantage and maturity risk.

Do not count:

- multiple wrappers/forks around the same engine as independent archetypes;
- archived, deprecated, toy, incompatible, or capability-missing projects;
- search snippets, LLM memory, marketing copy, or an “awesome” list without primary-source verification;
- a starter template's dependency set as proof that each component was selected.

### Mature reference-project floor

For a broad first selection, discover at least 8 product/architecture references, retain at least 5 credible references, and deep-read at least 3. For a bounded feature, default to 5 discovered, 3 credible, and 2 deep-read. If the domain is genuinely narrow, use the saturation exception; do not pad with unrelated repositories.

### Search saturation

A wide candidate pool is complete only when:

- the applicable numeric, archetype, and source-class floors pass;
- at least three query families were used for Tier A/B: capability/synonyms, stack-specific integration, and alternative operating/architecture model;
- two consecutive reasonable new queries or source classes yield no new credible archetype; and
- unresolved gaps are recorded.

If the floor cannot be met, keep `RESEARCH_STATUS: pool_exhausted_with_evidence`. It requires saved queries, checked sources, rejected names/reasons, at least two independent discovery channels, registry/official-ecosystem inspection, and a current/native baseline. `candidate_floor_and_archetype_coverage` remains `provisional` unless a schema-valid `CANDIDATE_FLOOR_WAIVER` records the decision owner, exhausted queries/sources, rejected candidates, current/native baseline, accepted residual risk, expiration, and exit path. With that complete waiver the coverage gate may be `pass`, while research status remains `pool_exhausted_with_evidence`.

## 5. Search And Evidence Standards

### Source order

Use multiple source classes:

1. Current project facts: code, manifests, lockfiles, ADRs, runtime/deployment and team constraints.
2. Official ecosystem/foundation: official recommendations, lifecycle, compatibility matrices, landscapes used only for discovery.
3. Package registry and releases: supported versions, deprecated/yanked/archive status, license, provenance, release history.
4. Official repository: source, tests, examples, CI, security policy/advisories, issues/discussions, maintainers/governance.
5. Mature reference projects: actual manifest, module boundary, operations, migration notes, and pinned tag/commit.
6. Reproducible local evidence: import/fixture/benchmark/spike under the same harness.

Search engines, LLMs, blogs, comparison pages, stars, downloads, and aggregate scores may discover or prioritize candidates. They MUST NOT be the sole adoption evidence.

### Evidence depth

- `E0_discovered`: name plus discovery metadata; may enter the raw pool only.
- `E1_verified`: official identity, capability, registry/release, license/lifecycle, and basic compatibility verified; may count as credible.
- `E2_deep_read`: relevant API/config/source/tests/examples, risks/issues, operating model, migration/exit, and current evidence inspected; required for `keep|adopt`.
- `E3_spiked`: critical assumptions tested under a repeatable representative harness.

### Evidence record and freshness

Every dynamic claim MUST record `source_url`, `source_type`, `checked_at`, `applies_to_version`, `claim`, and `confidence`.

- Check current version/release, deprecation/archive/EOL, license, compatibility, price/region, and security during the decision run when network is available.
- Before installing or pinning a dependency, refresh release and security evidence if the decision snapshot is more than 7 days old.
- Revalidate fast-moving provider/pre-1.0/security-sensitive decisions after 30 days; revalidate other library decisions after 90 days before implementation. A major release, advisory, license/price change, archive/deprecation, or changed project constraint invalidates the prior window immediately.
- Inspect maintenance/release/issue signals across an appropriate window, normally 12 months. A quiet, narrow, stable library is not automatically abandoned.
- External benchmarks must match the relevant major version, workload, data, and environment or be treated only as a hypothesis.
- Pin inspected reference projects to a release/tag/commit and record the inspection date.

For high-risk dependencies, inspect applicable provenance, signed releases, SBOM, vulnerability response, OpenSSF checks, and SLSA evidence. An OpenSSF aggregate score or missing SLSA level alone is neither proof of safety nor an automatic rejection.

## 6. Hard Filters And Weighted Comparison

### Freeze hard filters before scoring

At minimum:

- required workflow and must-have scenarios;
- runtime/framework/platform/version compatibility;
- license, procurement, privacy, security, compliance, and data residency;
- accepted ADRs, non-goals, process topology, module/state/data ownership;
- deployment, backup/restore, export/migration, idempotency, and audit requirements where applicable;
- budget/TCO ceiling, provider lock-in ceiling, API stability, and support horizon;
- spike must-have acceptance criteria.

Default hard rejects include incompatible license/runtime/deployment, missing must-have capability, official deprecation/archive/EOL/quarantine, relevant unmitigated critical vulnerability, prohibited data/lock-in model, failed same-harness must-have, or requiring an unowned permanent compatibility bridge. No weighted score can compensate.

Do not hard-reject solely for low stars/downloads, few maintainers, infrequent commits/releases, low aggregate OpenSSF score, or absence from CNCF. Investigate context.

### Weighted dimensions

Freeze each Tier A/B `DECISION_BRIEF` before revealing final measurements. It MUST include `brief_version`, `frozen_at`, `frozen_by`, hard filters, candidate floor, scoring dimensions/anchors, and integer weights totaling 100. Every candidate score MUST reference that brief version. Any later criteria change increments the version and records before/after values, actor, time, and reason. This default is a starting profile, not a universal truth:

| Dimension | Default weight |
|---|---:|
| primary workflow and required capability fit | 25 |
| architecture and existing-stack compatibility | 15 |
| maintenance, maturity, governance, docs, tests, releases | 15 |
| security, license, privacy, compliance | 10 |
| operability, observability, testability, recovery | 10 |
| integration, migration, and team learning cost | 10 |
| performance, bundle/runtime, infrastructure, and TCO | 10 |
| reversibility, lock-in, and exit path | 5 |

For every score record evidence, confidence, assumptions, and an operational 1-5 anchor. `unknown` is not a neutral 3; it lowers confidence and may require a spike. Stars/downloads are weak adoption signals, not quality scores.

For Tier A, rerun the ranking under at least two reasonable profiles or vary the two highest weights by about 20 percent. If the winner flips, measurement uncertainty overlaps, or the top two are within 5/100, the result is fragile and remains provisional pending better evidence or an E3 spike.

## 7. Shortlist, Spike, And Convergence

### Shortlist

- Keep 2-3 Tier A/B finalists with real trade-offs after hard filters; Tier C may deep-read one winner after two credible options are compared.
- More than 3 usually means the desktop criteria are not discriminating enough; deepen research before expensive spikes.
- One finalist requires market exhaustion or immutable constraints, an independent review, and a documented exit path.
- Every finalist MUST have a named question the spike or final evidence will answer.

### Spike triggers

Tier A acceptance requires E3 unless the project has recent evidence for the same major version, deployment shape, workload, and critical constraints. Tier B requires E3 when a critical capability, compatibility, security, performance, migration, or operations uncertainty remains. Tier C normally needs E2 only.

A same-harness spike uses the same scenarios, fixture/data, versions, environment, resource limits, commands, and acceptance thresholds. At minimum test:

1. one end-to-end primary happy path;
2. the highest-risk failure/recovery path;
3. representative performance/capacity where material;
4. configuration, logs, metrics/traces, and debugging;
5. upgrade, rollback, migration, export, or restore where material;
6. security/permission and dependency/provenance checks where material;
7. integration code, extra services, operational burden, raw commands/results, and untested items.

“Hello world runs” is not sufficient. Strategy-only modes may specify a spike but MUST NOT install or change code; keep the block provisional until an authorized spike passes.

### Convergence gate

Accept a block only when:

- decision brief, hard filters, weights, candidate coverage, and current evidence pass;
- for Tier A/B, the winner and runner-up are E2; for Tier C, the winner is E2 and the runner-up at least E1; or the evidence-backed saturation exception explains why only one exists;
- required E3 evidence passes or an equivalent-evidence waiver is documented;
- sensitivity is stable, critical unknowns are resolved, owner and mitigations exist;
- smallest integration, verification gate, rollback/exit, revalidation triggers, and required ADR exist;
- the whole-stack coherence review passes.

If a PoC cannot distinguish candidates, prefer the more reversible, lower-dependency, lower-operational-burden, existing-stack-compatible option and record that tie-breaker. Do not invent a performance or feature advantage.

Custom build enters the final comparison only when it is genuine strategic differentiation or hard constraints eliminate mature solutions. Compare at least three mature alternatives plus current/native baseline, name the maintenance owner and cost, and define a sunset/exit condition.

## 8. Whole-Stack Coherence

Per-block winners MUST be reviewed together:

```yaml
STACK_COHERENCE_REVIEW:
  runtime_and_version_compatibility:
  overlapping_responsibilities:
  process_topology:
  module_ownership:
  data_state_and_checkpoint_ownership:
  identity_auth_and_permission_flow:
  retry_idempotency_failure_and_recovery:
  observability_audit_and_privacy:
  test_ci_and_release_compatibility:
  deployment_network_and_data_residency:
  license_commercial_and_total_tco:
  operational_burden:
  lock_in_migration_and_exit_paths:
  conflicts:
  result: pass|provisional|fail
```

Explicitly check for two orchestration frameworks, two full UI systems, queue/workflow overlap, checkpoint storage misused as a business database, memory/vector storage misused as canonical data, unclear auth ownership, incompatible runtime/version matrices, excessive glue code, or too many production dependencies.

## 9. Parallel Research Protocol

Use this path when at least four independent Tier A/B blocks require wide research. If subagents are unavailable, run the same contracts serially and record the fallback.

| Stage | Owner | Input | Parallel | Output |
|---|---|---|---|---|
| T0 | primary agent | strategy, constraints, inventory | no | frozen block IDs, briefs, floors, hard filters, weights |
| T1 | evidence researchers | non-overlapping block batches | yes | candidate/evidence records only; no winner |
| T2 | challenger reviewer | merged finalists and rejects | after T1 | missing archetypes, weak evidence, invalid rejects, conflicts |
| T3 | primary agent | all records | no | scoring, sensitivity, block decisions, coherence, gate |

### T1 evidence researcher dispatch

When the parallel path applies and subagents are available, MUST SPAWN A SUBAGENT TO COMPLETE THIS TASK for each non-overlapping block batch using the template immediately below; if unavailable, execute the same template serially and record the fallback.
```text
Role: You are a technology evidence researcher. Do not edit files and do not choose the final stack.
Read: {ABSOLUTE_SKILL_DIR}/references/technology-selection-protocol.md
Inputs:
- block_ids: {BLOCK_IDS}
- decision_briefs: {FROZEN_DECISION_BRIEF_RECORDS}
- evidence_as_of: {CURRENT_DATE}
Task:
1. Build each block's candidate pool to its numeric, archetype, query-family, and source-class floor.
2. Return only schema-valid candidate records, search logs, hard-filter evidence, gaps, and pool status.
3. Use current primary sources; label every dynamic claim with URL, checked_at, version, and confidence.
4. Do not score with changed weights, make cross-block decisions, install dependencies, or modify files.
```

### T2 challenger dispatch

After all T1 records are merged, MUST SPAWN A SUBAGENT TO COMPLETE THIS TASK as a challenger distinct from every T1 researcher using the template immediately below; if unavailable, perform the same review serially and record the fallback.
```text
Role: You are an independent selection challenger. Do not edit files and do not select the final stack.
Read: {ABSOLUTE_SKILL_DIR}/references/technology-selection-protocol.md
Inputs:
- decision_briefs: {FROZEN_DECISION_BRIEF_RECORDS}
- candidate_records_and_shortlists: {MERGED_RECORDS}
Task:
1. Check floor/archetype/source coverage, hard-filter consistency, evidence freshness, same-engine duplicates, and rejected alternatives.
2. Identify fragile rankings, missing simpler baselines, conflicts, and required spikes.
3. Return findings mapped to block_id/candidate_id with a concrete gate impact; do not rewrite criteria or name a final winner.
```

The primary agent is the sole owner of weights, final scoring, cross-block coherence, and accepted decisions.

## 10. Canonical Schemas

```yaml
STACK_SELECTION_PACKET:
  schema_version: 0.3
  selection_scope: wide_first_selection|targeted_change|revalidate_existing
  scope_reason:
  evidence_as_of:
  research_status:
  decision_briefs:
    - block_id:
      brief_version:
      workflow_and_must_have_scenarios:
      hard_filters:
      scoring_dimensions:
        - {name: "", weight: 0, score_anchors: ""}
      weights_total: 100
      candidate_floor:
      frozen_at:
      frozen_by:
      criteria_changes:
        - {changed_at: "", changed_by: "", reason: "", before: "", after: ""}
  capability_inventory:
    - block_id:
      category: foundation|product|data|ai|operations|quality|security
      capability:
      workflow_served:
      roadmap_slice: now|next|later|not_applicable
      tier: A|B|C
      change_cost: high|medium|low
      state_security_or_topology_owner: true|false
      differentiation: commodity|strategic
      current_owner:
      current_solution:
      plain_or_existing_baseline:
      hard_constraints:
      candidate_floor:
      research_status:
  search_log:
    - block_id:
      search_date:
      query_families:
      source_classes:
      discovered_count:
      credible_count:
      new_archetypes_by_round:
      gaps:
  candidate_floor_waivers:
    - block_id:
      research_status: pool_exhausted_with_evidence
      exhausted_queries_and_sources:
      rejected_candidates_and_reasons:
      current_or_native_baseline:
      accepted_residual_risk:
      decision_owner:
      expires_at:
      exit_path:
  candidates:
    - block_id:
      candidate_id:
      decision_brief_version:
      name:
      kind: library|framework|service|platform|native_baseline|custom
      archetype:
      assessed_version:
      package_or_project_url:
      source_release_tag_or_commit:
      license:
      lifecycle_and_maintenance:
      evidence:
        - {claim: "", url: "", source_type: "", checked_at: "", applies_to_version: "", confidence: ""}
      evidence_depth: E0_discovered|E1_verified|E2_deep_read|E3_spiked
      hard_gate_results:
      score_breakdown:
      weighted_total:
      confidence:
      unknowns:
      finalist: true|false
      dependency_disposition: keep|adopt|spike|defer|reject
      decision_reason:
      smallest_integration:
      verification_gate:
      spike_or_waiver:
      exit_condition:
      revisit_triggers:
  block_decisions:
    - block_id:
      winner_candidate_id:
      runner_up_candidate_ids:
      rejected_candidate_ids_and_reasons:
      sensitivity_result:
      decision_status: accepted|provisional_pending_spike|deferred|rejected
      owner:
      decided_at:
      adr_or_record:
  stack_coherence_review:
  custom_build_surface:
  temporary_choices:
  stack_selection_gate:
```

```yaml
STACK_SELECTION_GATE:
  # every field is GATE_RESULT {status, evidence_or_reason, owner, next_gate}
  selection_scope_defined:
  capability_inventory_complete:
  decision_briefs_frozen:
  candidate_floor_and_archetype_coverage:
  source_diversity_and_search_saturation:
  hard_filters_defined_before_scoring:
  current_primary_evidence:
  deep_shortlists_complete:
  sensitivity_stable:
  required_spikes_resolved:
  custom_build_surface_justified:
  whole_stack_coherence:
  smallest_integrations_defined:
  verification_gates_defined:
  owners_exit_and_revisit_conditions_defined:
  required_adrs_created:
```

```yaml
temporary_choice:
  reason:
  owner:
  expires_at:
  allowed_scope:
  prohibited_expansion:
  success_gate:
  exit_or_migration_trigger:
```

## 11. Failure Exits And Revalidation

- `STACK_SELECTION_GATE` with any Tier A `open|fail` MUST block a settled stack.
- `provisional` authorizes only research or a named spike, not broad production adoption.
- A failed whole-stack review sends affected blocks back to shortlist; do not patch conflicts with an unnamed permanent bridge.
- A timeboxed temporary choice MUST expire and prohibit scope expansion until reevaluated.
- Revalidate on major-version change, security advisory, deprecation/archive/EOL, license/price/data-region change, new compliance requirement, failed SLO, changed deployment/state ownership, or accepted ADR change.
- Before implementation, refresh evidence that exceeded the freshness rules and confirm the recommended version from the official registry/release; never install a version recalled from memory.
- Preserve meaningful rejects and their conditions so later agents do not repeat the same discovery without new evidence.

## 12. Method Basis

These sources inform the method; the numeric floors and time windows above are this skill's engineering defaults, not universal rules published by those organizations.

- [Thoughtworks: Build your own Technology Radar](https://www.thoughtworks.com/en-us/insights/blog/build-your-own-technology-radar): separate assess/trial/adopt/hold maturity from simple awareness.
- [NASA Decision Analysis](https://www.nasa.gov/reference/6-8-decision-analysis/) and [NASA Systems Engineering Handbook appendix](https://www.nasa.gov/reference/system-engineering-handbook-appendix/): define alternatives, measurable criteria, mandatory constraints, uncertainty, sensitivity, and decision records before convergence.
- [CNCF Project Lifecycle](https://contribute.cncf.io/projects/lifecycle/) and [TOC Due Diligence Guide](https://contribute.cncf.io/community/toc/operations/dd-toc-guide/): use maturity, production adoption, governance, and archived status as evidence, not as a substitute for project fit.
- [OpenSSF Scorecard checks](https://github.com/ossf/scorecard/blob/main/docs/checks.md), [SLSA v1.2](https://slsa.dev/spec/v1.2/), and [NIST SP 800-161 Rev.1 Update 1](https://csrc.nist.gov/pubs/sp/800/161/r1/upd1/final): inspect repository and supply-chain risk with evidence and known tool limits.
- [GitHub community profiles](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories), [npm deprecation](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/), and [PyPA project status markers](https://packaging.python.org/en/latest/specifications/project-status-markers/): distinguish collaboration, lifecycle, registry, and deprecation signals.

Do not copy ecosystem versions from this reference. Verify current versions, statuses, compatibility, and security in the decision run.
