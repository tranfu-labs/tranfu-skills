# Goal-Driven Decomposition — Iteration History

These appendices record the failure traces that produced each rule in `SKILL.md`. They are not needed at execution time — load only when you need to understand *why* a rule exists, or when proposing a change to one.

---

## Appendix: The seed conversation (failure trace)

This skill was distilled from a real conversation. Recording it serves two purposes: (1) it provides a concrete worked example of the failure modes; (2) future readers of this SKILL.md can verify that the rules above came from observed failures, not abstract theorizing.

**User goal**: "我打算做一个蒙特卡洛模拟网站" (I'm going to make a Monte Carlo simulation website)

**Turn-by-turn failures**:

1. **Turn 1 (LLM)**: Treated as a research-precedent question, searched the literature. *(Acceptable but missed the design intent.)*
2. **Turn 3 (LLM)**: Asked which of three categories (teaching / quant / DSL) the user wanted, then proceeded to design a full Kubernetes-grade architecture spanning all three: Redis Streams, worker pools, NumPy+numba, Rust+PyO3, t-digest aggregation, Hetzner deployment, OpenTelemetry observability. **Failure: ignored the prior that "网站" in casual register implies lightweight.**
3. **Turn 4 (User)**: "你这就不对，我都说了是网站，那么从概率上来说，我会需要那么复杂的worker，python吗？" — explicitly named the prior the LLM had ignored.
4. **Turn 5 (LLM)**: Acknowledged, regenerated as pure-frontend SPA. *(Correct shape, but only after being told.)*
5. **Turn 6 (User)**: Pointed out that the deeper failure was in goal-decomposition methodology, not in this specific answer.
6. **Turn 7 (LLM)**: Proposed adding a "clarification step" before decomposition. **Failure: regression to "ask the user" rather than "use priors better."**
7. **Turn 8 (User)**: "完全错误，压根不需要质询，你自己分析出几种可能，然后基于用户的目标自然就能判断轻量化是大概率的" — explicitly stated the algorithm this skill now encodes.

**What the LLM should have done in Turn 3**: Listed shapes silently with priors (~70% teaching demo, ~20% portfolio project, <5% quant platform), committed to the modal shape, and answered with the pure-frontend SPA in ~5 lines. The 5 turns of correction would have been unnecessary.

This appendix exists so that the skill's rules can always be traced back to observed failures rather than treated as arbitrary stylistic preferences.

---

## Appendix B: 2nd iteration — intent must propagate through dimensions

A later conversation surfaced a gap in the first version of this skill. The seed conversation had fixed "don't over-engineer when the goal is casual" — but didn't say what the *committed answer* should look like beyond "be simple."

In practice, when an LLM commits to "teaching website" and produces a leaf answer, the answer naturally falls along the stable dimensions of a website: 功能模块 / UI 风格 / 技术选型 / 部署. The original Step 2 example already did this implicitly (Vite + Web Worker + Canvas + Cloudflare = exactly those four cells). What it didn't say was: **the recognized intent has to flow through every cell**, or you end up walking the right dimensions but filling them with generic answers.

**User's framing in this iteration**: "我理解的到实体的一层就OK了，但是它们的是互通的，比如意图识别我们是要教学那么自然而言就会以教学的场景来思考如何设计UI" — i.e., the entity-level dimensions are stable, but they're "互通" (interconnected): once the intent is recognized, that intent conditions every dimension's answer, not just one.

**What was added**:
1. Step 2 was rewritten to name the dimensions explicitly and to require intent-conditioning per cell.
2. A 3-column contrast table (教学网站 / 个人博客 / 内部工具) was added to show that *same dimensions, different intents → different answers* — so the LLM has worked examples to generalize from rather than a rigid template.
3. A coverage rule was added: every dimension is walked; depth per dimension is set by intent (obvious cells collapse to one line; high-stakes cells expand).
4. Anti-pattern: "walked the dimensions but the UI advice would read identically on a SaaS dashboard" — i.e., generic answers in each cell.
5. Self-test #6 mirrors the anti-pattern as a check.

**Why no template library**: the user explicitly asked for examples instead of templates, on the grounds that an LLM only needs a few worked cases to generalize. This keeps the skill thin and avoids freezing dimension lists that should grow as new entity types appear.

---

## Appendix C: 3rd iteration — persona as proactive co-designer + doc-relay dialogue

The 2nd iteration added "intent flows through dimensions." But on the next attempt to use the skill, the user reported: **the result still felt generic, basically the same as not using the skill at all** — there was no felt sense of "repeatedly aligning to the goal." The user diagnosed the missing piece: the target user existed only as an attribute ("intent = teaching") and not as a participant. Nobody actually stood in the user's position and pushed back on each design choice.

User's framing in this iteration (paraphrased, with one direct quote):
- "感觉还是不对，结果跟没用 goal skill 基本一致，没有反复对齐目标的感觉"
- "缺少跟目标用户 Agent 仿佛对齐的过程"
- "我希望我们的画像就是会主动思考和提问或者主动提出想法，比如在UI环节，用户Agent会提到XX产品的设计风格很不错"

Two key design decisions came out of the conversation:

1. **Persona as proactive co-designer, not reactive critic.** A reactive persona only reacts to drafts; a proactive persona speaks first, brings external references, has wishes and questions. The proactive form is what produces the "alignment felt" effect — design has to incorporate the user's frame, not just survive its critique.
2. **Multi-Agent collaboration via fresh Agent() + doc-relay, not SendMessage.** SendMessage keeps an Agent's own conversation alive, accumulating drift — which is the failure mode subagents were supposed to escape. Fresh Agent + persistent docs forces re-engagement with the goal on every turn. The "consistent voice" of the persona then comes from the persona doc being *specifiable in writing* — a feature, not a bug, because it makes vagueness in the persona profile audible.

**What was added**:

1. Step 1 expanded to identify a target user in addition to shape/intent.
2. Step 1.5 (new): persona instantiation as `00-用户画像.md` with a required-fields template — including 审美参考, without which a persona cannot proactively bring external references.
3. Step 2 protocol added: per-dimension doc-relay dialogue between persona Agent (speaks first) and design Agent, communicating only via `@mention`'d docs in `goal-docs/`. Round 2 only fires on substantive pushback.
4. Worked Monte Carlo UI dialogue added as concrete example so the protocol is imitable.
5. Anti-patterns: thin demographic-only personas, design-first turn order, persistent SendMessage agents, design docs that ignore persona's bullets.
6. Self-test items 7–9: persona reproducibility, persona's external references in briefs, item-by-item addressing in design docs.

**Why persona speaks first** (worth restating because it's counterintuitive): if design speaks first, persona's role degenerates into commentary on what design has already chosen. The frame is set by the designer. Persona-first inverts the burden of proof — the design must justify itself relative to the user's stated references and wishes, which is what produces alignment as a structural property rather than a stylistic claim.

**Boundary**: this protocol is overhead for trivial goals. Skip it for "write a 10-line script"-class requests. The protocol earns its keep when there are ≥2 dimensions where persona has substantive opinions; otherwise the original "modal answer in 5 lines" still applies.

---

## Appendix D: 4th iteration — round 2 must be a check, not a judgment call

The 3rd iteration introduced the persona-Agent ↔ design-Agent doc-relay and made round 2 (persona reaction) "optional, only if substantive pushback." On the next test (session `7c661804-a4d0-4a11-9ca1-8b6fb61019c2`), the LLM ran the protocol correctly through round 1: it spawned 8 Agents (persona brief + design draft × 4 dimensions), wrote all the docs, and produced a final index. **But it never spawned a single round-2 reaction Agent.** The main agent decided on its own that no draft needed pushback, and called the goal done.

This is the same failure mode as 1st iteration's "skip the protocol entirely," just one level deeper: instead of skipping the *whole* doc-relay, the LLM skipped the *check* that the doc-relay was working. Round 2 had been described as "fire only if there is pushback" — which left the *detection* of pushback to the orchestrator, which is the agent we're trying not to trust with alignment in the first place.

**Fix in this iteration**:

1. Round 2 (persona reaction Agent) is now **MANDATORY per dimension**. The reaction Agent runs every time, reads the draft, and writes a doc. The doc may be just "@design 没意见，OK" — that's fine, but the *Agent must run*, because that's what creates the audit trail.
2. The reaction Agent is now **async + sonnet**: `run_in_background: true`, `model: "sonnet"`. Most reactions are no-ops, so blocking the next dimension waiting for them is wasteful. Sonnet is enough capacity for a "did design address my brief?" check; reserving opus for the design draft is where the budget belongs.
3. Round 2 (design-final Agent) becomes the conditional one: fire only if the reaction doc contains substantive pushback (concrete asks, not just "OK").
4. Anti-pattern + self-test item added pinned to session `7c661804` as the failure trace.

**Why async sonnet, specifically**: the reaction step's job is to certify alignment, not to invent design. It's structurally a verifier, and verifiers can be smaller models running in parallel without compromising the property they enforce. This mirrors the pattern in formal methods where the prover and the checker run separately and the checker is allowed to be much smaller.

**Why mandatory, not "judge whether needed"**: any "skip if obvious" rule that puts the main agent in charge of detecting non-obvious-ness recreates the failure mode. The whole point of fresh-context Agents was that the main agent is *not* trustworthy as the alignment authority. Letting it decide whether to spawn the alignment-check Agent gives back exactly the authority the protocol was designed to remove.

---

## Appendix E: 5th iteration — validation must run on artifacts, not on hunches

The 4th iteration closed the design-time alignment gap with a mandatory async-sonnet reaction Agent. But in the **same** session `7c661804`, after the design docs were settled and the implementation was built, a different hole opened up: the user said "开启评价修复循环直到打分90分以上" (run the eval-fix loop until score ≥ 90). The main agent obliged — verbally. It declared the artifact "scoring high" in conversation. But the real layout bug the user was actually staring at — "现在的问题是 canvas 位置左偏了" (the canvas is shifted left of where it should be) — was never fixed, because nobody ever opened the browser. The score was hallucinated.

Same failure shape as Appendix C / D, just one phase later:

- App. C: alignment was a label, not a participant.
- App. D: round 2 was a judgment call by the main agent, not a check by an Agent.
- App. E: validation was a self-rating in conversation, not a tool-grounded inspection by an Agent.

The pattern is consistent: any time we let the main agent be its own judge, "alignment" / "score" / "quality" silently collapses to whatever the main agent feels like saying.

**What was added**:

1. **Step 3 — Validation-fix loop** as a top-level mandatory phase after the artifact is built. Fresh Agent generates a plan; fresh Agent runs it with full tool latitude; fresh Agent fixes; loop ≤ 3 times; surface to user otherwise.
2. **Plan structure** — every check has `severity` (critical | nice-to-have), `trace` (back to persona/design doc), and `pass_criteria`. No untraceable checks. No tool/method field — the validation Agent picks tools at runtime per check.
3. **Fix Agent contract** — full edit access, but must produce `92-fix-attempt-N.md` recording what changed, why, and which other check IDs the change might affect. This is what lets the next validation iteration know what to re-check.
4. **Loop bounds** — max 3 iterations on critical checks. Past 3 means structural failure, surface to user with the running set of failed checks and the last fix-attempt notes — don't burn budget.
5. **Anti-patterns** — main agent self-scoring; plan with untraceable checks; fix without 92-fix-attempt-N.md.
6. **Self-test #11–12** — does `90-validation-plan.md` + at least one `91-validation-run-N.md` exist? Does every check have severity + trace?

**Why validation Agent picks tools at runtime, even though earlier-iteration Agents had constrained inputs**: the persona doc and design doc had to be statically specifiable so any fresh Agent reproduces a consistent voice. Validation is different — the right tool depends on the check. "Canvas centered" needs a screenshot; "JSON valid" needs `jq`; "page loads in <1s" needs lighthouse. Constraining tool choice at plan-time would either over-restrict ("I only listed chrome-devtools but this check needs bash") or grow into a maintenance burden. Trust the validation Agent to pick — and audit via the evidence it records in `91-validation-run-N.md`.

**Why 3 iterations max**: the loop terminating is what makes "evaluate-fix" different from "while True". Three is a heuristic — empirically enough for fixes that are plausibly automatable, while small enough that structural problems get surfaced before they become time sinks. If the user wants more iterations they can ask explicitly; the default refuses to confidently fail in private.

---

## Appendix F: 6th iteration — iteration mode (working with existing goal-docs/)

After the 5th iteration locked down validation, the next gap appeared as soon as the user wanted to *come back* to a project: the protocol was cold-start only. There was no defined behavior for "tranfu-site, 加用户登录" or "tranfu-site, canvas 偏左了 改一下". The naive thing the LLM might do is run cold-start again — re-derive the persona, re-run all dimensions — duplicating work and introducing inconsistency with prior decisions.

**What was added**:

1. **Step 0 — mode detection**. Before any prior weighting, look for `goal-docs/` + `00-用户画像-r{N}.md`. If present, enter iteration mode.
2. **Three iteration types** distinguished by linguistic cues — 新增 (additive), 修正 (corrective), 画像变更 (foundational). Each routes through a different downstream path.
3. **Scope Agent** as the iteration-mode equivalent of "prior weighting": fresh Agent reads existing state + user's request and produces `UPDATE-r{N}-scope.md` declaring affected dims and request type. Main agent acts on its output, doesn't pre-judge scope itself.
4. **修正 short-circuits Step 2** — bug fixes don't need new design dialogue; they add a check to the round's plan with `trace = user's verbatim request`, then run the fix loop.
5. **画像变更 surfaces to user** rather than auto-execute — persona changes invalidate every dependent dimension; the user must decide redo-all vs. selective vs. abandon.
6. **Filename convention formalized** as `{模块号}-{模块名称}-{用户级轮次}-{对话/iter轮次}-{角色}.md` (with-name shape) and `{模块号}-{模块名称}-{用户级轮次}-[{iter}-]{角色}.md` (validation/persona shape). Module + round are adjacent leading numerals; name and role come after.
7. **Validation in iteration mode**: delta plan with Inherited / New / Overrides / Deprecated sections, ID-stable check naming (`VAL-r{birth}-NNN`), inheritance-aware run reports (one-liner per still-pass, full evidence on regression / new fail), and a `90-validation-plan-r{N}-resolved.md` flat cache the validation Agent reads.
8. **CHANGELOG.md** at goal level rolls up every round (trigger / type / scope / outcome) so future iterations can read the project's history.
9. **Anti-patterns**: cold-start-on-existing, persona auto-rewrite, claiming-inherited-pass-without-running-tools, 修正-triggering-Step-2.
10. **Self-tests #13–16** check Step 0 fired, scope Agent ran first, inherited checks were actually re-verified, CHANGELOG was updated.

**Why "delta plan + resolved cache" instead of one or the other**: the delta is what's *legible* (a human reading r2's plan instantly sees what r2 changed); the resolved is what's *operational* (validation Agent runs against a single flat list). Producing both is cheap, and they serve different readers.

**Why 修正 short-circuits Step 2**: design intent didn't change — only implementation needs to catch up. Running persona ↔ design dialogue for a CSS bug fix wastes Agents and risks the dialogue inventing changes the user didn't ask for. Treating 修正 as "validation gap, not design gap" keeps the work scoped to what it actually is.

**Why 画像变更 surfaces**: persona is the protocol's foundation — every dimension's design conditions on it. Auto-rewriting it without confirmation would silently invalidate decisions the user already approved. The user has to weigh in: do all rounds get redone, or scope to a few?

---

## Appendix G: 7th iteration — enumerate-track vs sample-track (the protocol's medium must match the spec's medium)

**Trigger** (2026-05-08): user reported on `tranfu-site` that round 2 and round 3 had been chasing essentially the same goal — "make UI not look 1999" — and the result was still bad. r3 had:
- 256-line `UPDATE-r3-scope.md` with thorough hard-no analysis
- 51 atomic validation checks (49 pass, 2 partial, 0 critical fail)
- exit success per the validation Agent

…and the rendered home page still showed `[全部] [踩坑] [养成]` plain bracket text as tag filters, no icons, plain serif Smiley Sans for headings, content lists with hairline borders, overall gestalt indistinguishable from "未设计的 1999 站" to a glance.

User's framing: *"我发现一个很大的问题就是我们这个skill似乎在解决UI的问题上很棘手，比如tranfu site里，r2和r3其实都是提的差不多的目标，但是最终效果很差……分析一下，我的目标是为了提升我们这个SKILL的具体在UI方面的能力，不是具体的那种设计能力，而是迭代、思考、执行能力"*.

### Diagnosis: not 5 surface bugs, 1 deep epistemic miscompile

Initial pass surfaced 5 candidate issues (closed-loop validation, blind-signing reactions, default-inherit, fake felt-sense gates, missing mock-iterate subloop). All real, all symptoms.

The user pushed: *"有没有可能有更本质的问题？"*

Deeper diagnosis: the protocol assumes every dim's spec is **a finite enumerable set of discrete text decisions whose verification can be decomposed into atomic local propositions**. This holds for 功能 (feature list), 技术 (stack choices), 部署 (config), 数据 (schemas), 调度 (cron). It silently fails for UI / 视觉 / 文案 tone / 品牌调性 / 节奏感 — these specs are continuous, globally-experiential, and *cannot* be losslessly encoded in text. Atomic property checks on these dims (`borderRadius == 6px ∧ surface tier ≥ 2 ∧ font !== Inter ∧ ...`) are *consequences* of "looks shadcn", never tests of it.

The skill, prior to this iteration, had no awareness of this distinction — it routed all dims through the same text-only doc-relay (persona brief in text, design draft in text, reaction reading text, validation = atomic check list). That works perfectly for the half of dims that are text-compressible, and silently fails for the half that aren't.

### What's striking: every prior iteration of this SKILL embeds the same enumerate assumption

Going backward through the trace:

| Pre-G location | What it embeds |
|---|---|
| Step 1 prior table (`Shape` column) | Modal shape compresses to a discrete label. |
| Step 1.5 persona `审美参考` | Aesthetic taste encoded as bullet list of product names — references *to* samples, not samples themselves. |
| Step 2 stable dims list | Lists 4 dims per entity but doesn't differentiate spec form. |
| Step 2 worked contrast table (UI 风格 row) | Cells described as text attributes ("解释优先、可视化主导、配色友好"). The example *itself demonstrates the wrong shape* for a sample-track dim. |
| Step 2 canonical example | Whole 02-stakeholder/design/reaction round in text, no rendered samples. |
| Step 3 plan `pass_criteria` example | Atomic numeric/string assertions only. |
| Step 3 `trace` field rule | Must point to text in persona/design doc. |
| Step 6 inherit semantics | check ID → text decision diff. |
| 14 anti-patterns / 16 self-test items | All trace to enumerate-style failure modes; zero sample-style. |
| "Why this works" §reference | Cites decomposition cost + LLM-prior tractability — both arguments live entirely in enumerate-medium epistemology. |

Iterations A → F all patched within enumerate-medium: A added priors, B added intent-flow, C added persona-as-coauthor, D made reaction mandatory, E added validation loop, F added iteration mode. None of A–F questioned whether the medium itself was correct for visual specs. tranfu r1 → r3 was the first goal where enumerate-medium failure became externally visible (49/51 atomic pass + felt-1999 = obvious mismatch).

### What was added in this iteration

**Concept layer**:

1. New § "Tracks: enumerate vs sample" between "What this skill exists for" and "The core algorithm". Defines the two tracks epistemically (compressibility of spec) and gives the default classification.
2. Algorithm box gets Step 3.5 ("Label each stable dim's TRACK") and Step 4 forks into 2-E / 2-S branches.

**Persona layer (Step 1.5)**:

3. `审美参考` schema rewritten: must split into **hero-refs** ("成品要往这一档靠") and **anti-refs** ("绝不能像这一档"), each requiring `name + URL + 本地截图路径 + 一句"我具体喜欢/讨厌什么"`. Product names alone are insufficient — they fail the audit. Local screenshots in `goal-docs/_refs/` become the canonical source for sample-track design Agent's reference cluster and validation Agent's blind-compare inputs.

**Track classification (Step 1.6, new)**:

4. Per-dim track labels with default tables (enumerate: 功能/技术/部署/数据/调度/CLI/IO/平台/上架/数据源/转换/监控; sample: UI/视觉/排版/交互体感/文案 tone/节奏感/品牌调性/配色/字体气质/插画风格).
5. Recording mechanics: `STATE.md §Tracks` (cold-start) or `UPDATE-r{N}-scope.md` (iteration). Track-change between rounds = major redesign.

**Step 2 protocol (split)**:

6. Step 2-E (enumerate-track): the existing protocol, relabeled. Text-only doc-relay. No structural change.
7. Step 2-S (sample-track, NEW): persona brief MUST cite hero/anti refs by screenshot path with anchored "我看到 X 后想要的具体感觉是 Y" clauses. Design draft outputs 1–3 candidate PNGs (HTML+CSS single-file prototype rendered via headless Chrome) FIRST, then writes ≤200-word design.md anchored to specific elements in the chosen PNG and to ref paths. Persona-reaction MUST Read the chosen PNG (Read returns image content for `.png`) and MUST include a "看了样本之后：" section anchored to specific visual elements. Design-final MUST re-render a new PNG; text-only patch is a protocol violation.
8. Two concrete examples added: 04-部署 (2-E, text-only "OK" reaction) and 02-UI (2-S, "看了样本之后" reaction naming specific colors and ref paths). The shape difference is the lesson.

**Step 3 validation (split)**:

9. Phase 3a-S: sample-track plans MUST contain ≥ 1 critical `type: blind-compare` check. Schema includes `inputs.ours / hero-refs / anti-refs` and a `pass_criteria` that spawns a fresh sonnet judge to pick "most-like-anti-ref" from a shuffled letter-mapped set of screenshots. Ours-not-picked over majority of 3 runs = pass.
10. Atomic property checks on sample-track dims demoted to **guardrails** — necessary, not sufficient. Exit per dim: blind-compare pass AND guardrails pass.
11. Phase 3b-S: validation Agent spawns the sonnet judge as fresh Agent (same epistemic property as Step 3 in general — orchestrator does not judge); judge sees only screenshots, not design docs / persona text.
12. Iteration mode track-aware: enumerate-track inherits text decisions verbatim; sample-track inherits the chosen sample PNG (re-rendered against new build) and the blind-compare check inherits its `id` if hero/anti refs are unchanged.

**Anti-patterns (4 added)**:

13. Running enumerate Step 2-E protocol on a sample-track dim (the tranfu r1 trace).
14. Persona-reaction signing without viewing rendered PNGs.
15. Declaring sample-track dim done on atomic-check pass alone (no blind-compare) — the tranfu r3 trace.
16. Persona's `审美参考` storing only product names without local screenshot paths.

**Self-test (5 added — items 17–21)**:

17. Did Step 1.6 fire? Each dim labeled?
18. For every sample-track dim, does `0X-{dim}-r{N}-1-design-samples/` exist with ≥ 1 candidate `.html` + rendered `.png`?
19. Does each sample-track reaction doc contain "看了样本之后：" anchored to pixels?
20. Does the validation plan have ≥ 1 critical `type: blind-compare` per sample-track dim?
21. Did the validation Agent spawn a fresh sonnet judge for each blind-compare (not score it itself), and did the judge see only screenshots?

**Why this works (new paragraph)**:

22. Sample-track epistemology: visual specs don't compress losslessly into text; the fix is keeping the artifact in its native medium (pixels) at every step where loss matters. Skill operates in the medium of the spec — text where text suffices, pixels where pixels are the spec. Prior iterations applied text-medium epistemology uniformly; tranfu r1→r3 made the half-failure externally visible.

### Why this is a 7th iteration, not a refactor

Each prior iteration (A–F) closed a specific in-conversation gap: over-engineering, generic answers, fake alignment, skipped reaction, hallucinated score, missing iteration mode. Each was about main-agent honesty within the text relay. G is structurally different — it widens the relay itself: the medium is no longer text-only because the spec is no longer text-only. This is the first iteration where the failure mode wasn't "main agent lying" but "protocol unable to represent the truth in either direction."

Caveat: this iteration only handles UI as the canonical sample-track example. The sample-track protocol generalizes to any continuous-globally-experiential spec (文案 tone, 节奏感, 品牌调性, 插画风格, music feel for audio products) but those will need their own HISTORY appendices when they trigger external failures, because each medium has its own "the render must produce a real X file on disk" plumbing problem.

**Boundary**: enumerate-track is still the right default for almost every dim that isn't explicitly visual / experiential. Don't route 功能 / 技术 / 部署 through Step 2-S because "samples might help" — it would slow the protocol and produce no information gain (the spec is already losslessly text-encoded). Track classification is a routing decision, not an upgrade.

---

## Appendix H: 8th iteration — execution-layer review, vertical decomposition, and goal interpretation

**Trigger** (2026-05-08, same-day discussion after G landed): user pushed back that even with track split (A–G fixes), the protocol still felt "复杂还效果不好" — particularly UI quality remained shaky. The discussion surfaced four distinct gaps at four different layers, each invisible from the perspective of any single prior iteration. The reference doc rendered during this discussion lives at `goal-docs/methodology-flow-r1.md`.

### Diagnosis: four gaps, four layers

The discussion walked through the protocol top-down and found one structural hole per layer:

1. **Intake layer** — `user_goal原话` was treated as immutable ground truth. But AI often pattern-matches the underlying goal more accurately than the user articulates it (canonical case: "做蒙特卡洛案例演示网站" surface vs "学懂蒙卡" underlying → 2 contrasting cases beats 1 polished case). G had no mechanism for AI to propose a 1-layer-deeper interpretation, only to transcribe.
2. **Planning layer** — the protocol had a WHAT axis (dim 横切) but no WHEN axis (vertical decomposition into goal tree + slices). All dims were pursued in parallel; nothing forced "finish a thin end-to-end slice and re-anchor" before going wider. Drift compounded across rounds invisibly.
3. **Execution layer** — between `design-r{N}-final.md` (WHAT) and the built artifact, the protocol jumped directly. But spec → code is a lossy translation full of judgment calls (specific tokens, primitives, spacing scale, layout grid for UI; API contracts and state machines for 功能). Each unspecified judgment was an entry point for the model's untouched prior — which for UI defaults to the user's saved memory'd "1999 PG-essays 裸 HTML" anti-pattern. G's persona-reaction agent operated on `design.md` text + PNG mocks, not on the build plan itself.
4. **Project layer** — every project ran cold. No retro, no learning back into persona / anti-refs. Each new run rediscovered the same biases.

### What's striking: prior iterations all assumed a single-shot WHAT-axis flow

| Pre-H location | What it embeds |
|---|---|
| Step 1 prior weighting | Surface goal = ground truth; AI commits to a shape but doesn't reinterpret the goal itself. |
| Step 1.5 persona | Built around target user, but `审美参考` is built once, never updated by retro evidence. |
| Step 2 doc-relay (E or S) | Per-dim parallel; no notion of "finish slice 1 first then slice 2." |
| Step 3 validation | Runs on the full built artifact, not on per-slice milestones; not on the build plan itself. |
| Iteration mode (App. F) | Triggered by user pushback on built artifact — not by milestone gating during the build. |
| Anti-patterns / self-tests | Zero items mention WHEN-axis / build-plan / milestone gate / retro. |

A–G all patched within the assumption "one project = one cold-start → one cold-design → one cold-build → one cold-validate." H is the first iteration that questions whether that single-pass frame is the right unit at all.

### What was added in this iteration

**Concept layer**:

1. New § "true_goal vs surface" between "What this skill exists for" and "Tracks". Defines the dual-track at intake and the 1-layer-only rule.
2. New § "Goal tree and slice loop" introducing the WHEN axis. Slice = (subset of goal tree) × (all dims), not (one dim) × (full goal tree).
3. The "core algorithm" pseudocode is rewritten to wrap Step 2 + Step 6 (validation) into a per-slice loop, with Step 3.5 (build-plan) inserted between design and build.

**Intake layer (modifies Step 1)**:

4. Step 1 expanded to a two-substep sequence: (1.a) prior-weight as before; (1.b) **propose 1-layer-deeper interpretation under USER GATE**. Output: `user_goal_surface.md` (字面, 只读) + `00-true-goal-r{N}.md` (the new ground truth).
5. **HARD CAP = 1 layer.** Don't recurse "学蒙卡 → 学概率 → 提升数理能力 → ..."; only one step deeper, and only if the deeper layer produces a *concrete executable adjustment*. Otherwise skip the proposal and use surface verbatim.
6. **Special case**: if AI has no signal for what the underlying goal might be, do NOT fabricate one. Skip (b)(c), use surface. Avoiding hallucinated reinterpretation matters more than always producing one.

**Planning layer (new Step 1.7)**:

7. Step 1.7 (new): write `10-DoD-r{N}.md` (跟 persona 一起约定可观测成功标准) and `20-goal-tree-r{N}.md` (北极星 → Phase → slice; each slice挂可验证 milestone artifact).
8. **Thin-slice rule**: first slice MUST be the thinnest path that touches all dims end-to-end. Not "all of dim A first, then dim B." This forces the build plan, render plan, and validation to all exercise once before anything is widened.

**Execution layer (new Step 2.5)**:

9. Step 2.5 (new): **role-anchored build-plan**, per dim, before any code is written. Four sub-steps:
   - **(a) align-check** — fresh role Agent (sync, sonnet) holds {user_goal_surface, true_goal, persona, design-final, refs}; first answers ONLY "design.md serves true_goal? ≤3 misalignment OR OK." Misalign → bounce back to Step 2.
   - **(b) translate** — same role Agent writes `40-build-plan-{dim}-r{N}.md`. Hard constraints: explicit tokens / primitives / scale; every decision traced to a specific sentence in design or true_goal; vibes words ("现代/简洁/专业") banned; **§implicit-decisions section** mandatory — surfaces every judgment design.md left underspecified, with 2 candidates + which chosen + why.
   - **(c) plan-react** (sample-track only, async sonnet) — persona reads the plan and judges per-token "more like hero-ref or anti-ref?" Pushback → return to (b).
   - **(d) hero-only early render** (recommended for sample-track) — render the most prominent component (hero / 首屏 card) per the plan, run a subset of Step 3's blind-compare against hero/anti refs. Fail → return to (b). This pulls the cheapest slice of validation forward of the build.
10. **Role prompt MUST name reverse priors.** Saying "10年 shadcn/Vercel 学派 UI 设计师，反 1999 PG-essays 裸 HTML" shifts decoding distribution; saying just "UI designer" rolls back to the same prior the design Agent already had. Other dims: "tech lead, API 契约/状态机/调用顺序"; "staff engineer, 边界/失败模式/可观测"; "infra/SRE, 环境差异/回滚/secret".

**Per-slice gating (new Step 3.5 and Step 3.7)**:

11. Step 3.5 (new): **milestone gate** after each slice's validation passes. Three mandatory回拨questions: (i) milestone artifact really done per `20-goal-tree`? (ii) still serves true_goal? (iii) does this finding require re-pruning subsequent slices? Plus a **surface mirror check**: would a literal reader of `user_goal_surface.md` recognize what was built as "what they asked for"? Mirror failure = AI overreach signal; bounce to Step 0/1 to surface the divergence.
12. Step 3.7 (new): **acceptance walkthrough** — persona Agent walks through the *real* built artifact (live UI, real CLI, not mock / not screenshot). Subjective feedback flows back into persona / anti-refs as they're encountered, not deferred to project end.

**Project layer (new Step 7)**:

13. Step 7 (new): **retro** at project completion. `99-retro-r{N}.md` records: where did we drift, why did we drift, what should the prior have been? Diffs flow back into `00-用户画像-r{N+1}.md` `审美参考` (especially `anti-refs`). Closes the only feedback loop in the protocol that runs project-to-project rather than within a single project.

**Sidecars (new concept)**:

14. Two read-only-from-everywhere docs introduced: `user_goal_surface.md` (字面镜) and `91-open-questions.md` (悬而未决池, each with owner + deadline; expired items auto-promote to critical, blocking the next milestone gate).

**Anti-patterns (5 added)**:

15. Treating user_goal原话 as immutable ground truth without considering 1-layer underlying interpretation.
16. Reinterpreting the goal silently — i.e., AI rewrites without USER GATE.
17. Reinterpreting the goal more than 1 layer deep ("学蒙卡 → 提升数理能力 → 实现财务自由").
18. Running per-dim parallel without slice gates — i.e., finishing all of UI's r1 design and all of 功能's r1 design and all of 部署's r1 design before any one slice is built end-to-end.
19. Skipping Step 2.5(b)'s `§implicit-decisions` — i.e., translating design to build silently, letting unstated tokens/primitives default to the model's prior unchallenged.

**Self-test (5 added — items 22–26)**:

22. Did Step 1(b) fire? Either `00-true-goal-r{N}.md` differs from `user_goal_surface.md` (with a USER GATE record), OR a note explains why the proposal was skipped (no signal).
23. Does `20-goal-tree-r{N}.md` exist and identify the slice currently being executed? Is the first slice end-to-end across all dims?
24. For each dim built in this slice, does `40-build-plan-{dim}-r{N}.md` exist with a populated `§implicit-decisions` section?
25. Did Step 3.5's milestone gate fire (with the surface-mirror check answered) before declaring the slice done?
26. Does `99-retro-r{N}.md` exist at project close, and were its findings written back into `00-用户画像-r{N+1}.md`'s `anti-refs` (or marked "no new lessons")?

### Why this works (new paragraph)

The protocol now has feedback loops at six distances from the build, ranked by earliness: Step 2.5(a) align-check (translation begin) < Step 2.5(c) plan-react (build start) < Step 2.5(d) hero render (build first pixel) < Step 3 validate (slice end) < Step 3.5 milestone gate (cross-slice) < Step 7 retro (cross-project). The same "像 anti 吗?" rubric runs at four of these. Drift detected early is cheap; drift detected at Step 3 validate alone (G's terminal point) means the build cost is sunk. Earlier checks cost more Agent calls but less rework — and the rework cost grows superlinearly because later drifts compound through more committed decisions.

The 1-layer-deeper interpretation rule embeds an asymmetry the prior protocol lacked: AI is *better* than humans at pattern-matching "what is this user actually trying to do" (because it has seen thousands of similar requests), but *worse* than humans at deciding "is that actually what I want." So AI proposes, user disposes. Strictly capping at 1 layer prevents the proposal from architecting away the concrete request entirely.

### Why this is an 8th iteration, not a refactor

A–G all assumed one cold-start → one cold-build → one cold-validate, and patched within that frame: A added priors, B added intent-flow, C added persona-as-coauthor, D made reaction mandatory, E added validation loop, F added iteration mode for *user-triggered* re-entry, G added sample-track for visual specs. H is structurally different in two ways: (1) it adds a WHEN axis (goal tree + slice loop) the prior protocol entirely lacked, and (2) it adds two between-layer gates (true_goal vs surface at intake; build-plan between design and code) that the prior protocol elided. The protocol's shape changes from "linear tube of fresh Agents passing docs" to "nested loops with explicit anchors at each layer transition."

Caveat: H only sketches the role-Agent prompts for UI / 功能 / 技术 / 部署. Other dim types (data pipelines, ML training, content authoring) will need their own role-prompt anti-priors in future appendices when external failures surface them. The framework (role-anchored build-plan with §implicit-decisions) generalizes; the specific role descriptions don't.

**Boundary**: H's overhead (true_goal proposal, DoD, goal tree, slicing, build-plan per dim, milestone gate, retro) is real. Skip the WHEN-axis additions for goals with a single dim or goals declared "prototype, throw-away" by the user. Skip the true_goal proposal when AI has no signal for what underlying-goal might be (don't fabricate). Keep the build-plan step (2.5) even on small projects — it's the single highest-leverage check, especially for UI, because §implicit-decisions surfaces the largest source of silent prior-default.
