---
name: goal-driven-decomposition
display_name: Goal-Driven Decomposition
display_name_zh: 目标驱动分解
description: >-
  Solve "build/make/design X" goals AND follow-up edits ("做一个网站", "build a tool", "加用户登录", "X 偏了改一下"). State in goal-docs/*.md. Cold-start: prior-weight modal shape+intent, propose 1-layer-deeper true_goal under USER GATE, write roleplay persona with hero/anti-ref screenshots, label each dim's track (enumerate=功能/技术/部署 vs sample=UI/视觉/文案), run track-aware doc-relay (persona-brief → design-draft → persona-reaction Agent MANDATORY → final; sample track MUST render PNGs before sign), then ≤3-iter validation-fix loop with critical blind-compare on sample dims. Iteration mode: scope Agent classifies 新增/修正/画像变更. Fresh Agents + @mention'd docs, no SendMessage. Surface after 3 failed iter. Do NOT trigger when: (a) pure one-shot 零设计维度; (b) goal-docs/ exists but user just asking question, not 改/加/偏; (c) scope of another skill (商业评估→business-analysis-pipeline; 审稿→credibility-review; 发布→tranfu-publish).
version: 0.2.0
author: aquarius-wing
updated_at: 2026-07-10
origin: own
---

# Goal-Driven Decomposition

> **Citation convention used in this skill**
> Inline references look like `[Author Year, §section]` or `[Source]`. They sit next to the specific claim they support, not at the end. The full reference list is in the **References** section at the bottom. Claims without a citation are either common knowledge or distilled from this skill's own iteration history (a real conversation in which an LLM repeatedly over-engineered a "Monte Carlo simulation website" request before being corrected — that conversation is the seed case for this skill, recorded in the Appendix).

## What this skill exists for

LLMs systematically over-engineer when given short goals. Given "build a Monte Carlo simulation website" the default failure mode is to immediately produce a Kubernetes-grade architecture (Redis Streams, worker pools, Rust modules) instead of recognizing that "website" + "simulation" + casual phrasing implies a teaching demo that should run entirely in the browser. *(This is the seed case — see the Appendix at the end for the full failure trace.)*

This is a known failure pattern in the literature, called **premature decomposition** or **overengineering**:

- **Decomposition has a hidden coordination cost.** Amazon Science formalized this as `O(n) + O(k^m)` where `k` is the number of subtasks and `1 < m ≤ 2`. For small `k` the overhead is negligible; as `k` grows, coordination cost dominates and destroys the gains from decomposition. They also note that excessive decomposition causes the system to *"fail to capture the serendipitous connections and novel insights that can emerge from a more holistic approach."* `[Gozluklu 2024, Amazon Science]`
- **Eager planning fails when subtasks turn out to be unexecutable.** Plan-and-execute approaches commit to a full decomposition up front; if any subtask fails, the whole plan fails. `[Prasad et al. 2024, ADaPT §1]`
- **The fix is to decompose only on failure.** ADaPT *"explicitly plans and decomposes complex sub-tasks as-needed, i.e., when the LLM is unable to execute them"* — outperforming ReAct and Plan-and-Solve by up to 28–33 percentage points on ALFWorld, WebShop, and TextCraft. `[Prasad et al. 2024, ADaPT §5]`

This skill operationalizes that fix for *design* tasks (where "failure" is user pushback) in addition to execution tasks.

## 同类 Skill 对比

> 由 tranfu-publish 起草, 作者签字. 帮助阅读者横向决定要装哪个 / 跳到更合适的同类.

### 公司库内
- [write-spec](../write-spec/SKILL.md) — 从模糊想法一次性出 PRD/feature spec (目标 / 用户故事 / 验收标准). **本 skill 区别**: write-spec 是单轮 spec 生成, 输出即结束; 本 skill 是多轮 doc-relay (persona-brief → design-draft → persona-reaction → final) + ≤3 iter validation-fix 闭环, 跑到真产物为止.
- [structured-thinking-advisor](../structured-thinking-advisor/SKILL.md) — 对已有文档/思路给 2-3 个维度的优化版本. **本 skill 区别**: STA 是横向审视已有产物; 本 skill 是从 "做一个 X" 的空白 goal 起, 跑完整 cold-start → 拆维 → 建产物.
- [business-analysis-pipeline](../business-analysis-pipeline/SKILL.md) — 7 步评估 AI 产品商业可行性. **本 skill 区别**: BAP 评估"该不该做"; 本 skill 在"决定要做"后驱动"怎么做到产物".

### 外部世界
- [openspec](https://github.com/Fission-AI/OpenSpec) — propose/apply/archive 三阶段把 change 沉淀成 specs. **本 skill 区别**: OpenSpec 围绕已有项目的 spec 演进; 本 skill 在 spec 之前先 gate true_goal (1-layer-deeper proposal under USER GATE) + persona reaction, 防止 spec 跑偏.
- [superpowers](https://github.com/obra/superpowers) — 通用 agent workflow 工具集 (复杂编码任务). **本 skill 区别**: superpowers 是横向工具库; 本 skill 是纵向单一协议 — "build X" goal 到 artifact 的端到端 pipeline, 强制 sample-track blind-compare.

### 本 skill 独特价值
- enumerate vs sample 双轨, 视觉/排版/文案 走必 render PNG + 盲选 anti-ref 校验.
- persona 是协同设计者, 非纯反馈者; 借 fresh Agent + @mention'd .md 防 SendMessage 漂移.
- 维度级 ≤3 iter validation-fix 闭环, 跑不通强制 surface 给用户, 不静默放过.

## 使用技巧

> 由 tranfu-publish 引导起草. 帮助阅读者纵向上手 — tacit knowledge 在此.

### 材料方案
- 干净 goal-docs/ 空目录起步; 已有目录会走 iteration mode, 不要混.
- persona "审美参考" 必须配 goal-docs/_refs/ 下的本地截图, 不能只给产品名.
- sample-track 维度准备 1-3 张 hero-ref + 1-3 张 anti-ref 截图 (用于 blind-compare).

### 推荐用法
- 第一次跑: 一句 "做一个 X" 直接触发, 不要预先列需求, 让 skill 先 prior-weight.
- 改已有项目: 说 "X 偏了改一下" / "加 Y", 走 iteration mode, scope Agent 会分类.
- sample-track 维度卡住: 看 90-validation-plan-r{N}.md 的 critical blind-compare 是否覆盖.

### 已知限制
- 大: SKILL.md 121K + HISTORY.md 40K, context 占用高, 短任务不要装.
- 不接 pure one-shot (零设计维度, e.g. "改个 typo"), 自带跳出条款.
- ≤3 iter 后必须 surface 给用户, 不会无限自循环, 适合人在环里.

## Tracks: enumerate vs sample

Dimensions are not uniform. They split into two tracks based on the *compressibility* of their spec:

- **enumerate-track** — spec compresses losslessly into a finite set of discrete text decisions. Verifying compliance = checking each decision is in place. Examples: feature lists, stack choices, deployment config, data schemas, scheduling.
- **sample-track** — spec is continuous, globally-experiential, and *cannot* be losslessly encoded in text. Atomic property checks (`borderRadius == 6px ∧ surface tier ≥ 2 ∧ font !== Inter ∧ ...`) are *consequences* of "looks shadcn" — they never test the gestalt itself. Examples: UI 风格, 视觉, 排版, 文案 tone, 品牌调性, 节奏感.

This is an **epistemic** distinction, not a stylistic one. Functional/technical specs survive a text relay (brief → design → impl → check) intact, because each step's text faithfully encodes its predecessor's decisions. Visual/experiential specs do not survive — every text encoding step strips holistic information that the next decoder cannot reconstruct, and atomic property checks measure the *projections* of the spec, never the spec itself.

**Failure mode that motivated this split** (tranfu-site r1→r3): three full doc-relay rounds ran enumerate-track protocol on the UI dim. r3's plan had 51 atomic checks (49/51 pass) — yet the rendered home page kept `[全部][踩坑][养成]` plain bracket text and felt 1999, because no round ever produced a visual sample for the persona to react to. The text relay was internally consistent and visually wrong. *(See HISTORY.md Appendix G.)*

**Default classification by spec form**:

| If the dim's spec is mostly… | Track |
|---|---|
| feature presence/absence, branching/loops, scheduling, data shape, infra config | enumerate |
| visual gestalt, typography rhythm, copy tone, pacing, brand feel | sample |

The protocol below routes each dim through the matching track. Sections marked **2-E / 2-S** or **3-E / 3-S** are track-specific and you MUST take the right branch — operational details on labeling are in **Step 1.6**.

## The core algorithm

```
NOTE: pseudocode numbers are sequential for readability; section headings below are
non-sequential (Step 6 missing is 7th-iter legacy). Each pseudo step carries a
[→ §Step X] marker mapping to its section heading below.

0. [→ §Step 0] Detect mode: cold-start (no goal-docs/) vs iteration (goal-docs/ + persona exists)
   — if iteration → Step 0a (read state + classify request + scope Agent — now also
     identifies which goal-tree slice the request affects AND whether true_goal
     interpretation should be re-proposed); jump to the right downstream step
     (新增 → Step 2 on affected dims of affected slice; 修正 → Step 3; 画像变更 → surface;
      true_goal shift → Step 1.b under USER GATE)
1. [→ §Step 1] Receive goal. Two substeps:
   1.a) Prior-weight: pick modal shape, intent, AND target user — DO NOT ASK.
   1.b) [→ §Step 1.b] Propose 1-layer-deeper interpretation under USER GATE.
        Format: "字面 X / 底层 Y / 建议调整为 Z / why". HARD CAP = 1 layer.
        Skip if no signal (don't fabricate). Output:
          - user_goal_surface.md  (★ 字面原话, 只读, 审计镜)
          - 00-true-goal-r{N}.md  (★ ground truth — surface verbatim if user rejected
                                     proposal or it was skipped; the proposed underlying
                                     reinterpretation if user accepted)
   All downstream steps anchor on 00-true-goal, NOT user_goal_surface.
2. [→ §Step 1.5] Instantiate the target user as a concrete, roleplay-able persona
   (00-用户画像-r{N}.md — must be specifiable in writing, not just labels;
    审美参考 split into hero-refs / anti-refs, each with a local screenshot path
    under goal-docs/_refs/)
2.5. [→ §Step 1.6] Label each stable dim's TRACK (see § Tracks above):
     - enumerate-track: spec is text-decomposable (功能 / 技术 / 部署 / 数据模型 / 调度)
     - sample-track:    spec is continuous-holistic (UI / 视觉 / 排版 / 文案 tone / 品牌调性)
     Track choice routes the dim through Step 2-E vs Step 2-S, and Phase 3a-E vs 3a-S.
2.7. [→ §Step 1.7] Spawn fresh Agents for DoD + Goal Tree:
     - DoD-Agent      → 10-DoD-r{N}.md      (observable success criteria, agreed with persona Agent)
     - GoalTree-Agent → 20-goal-tree-r{N}.md (北极星 → Phase → slice; each slice carries
                                              a verifiable milestone artifact + DoD subset)
     - First slice MUST be thinnest end-to-end path that touches all dims (not all of
       dim A first → all of dim B). Slice 1 = end-to-end thin slice always.
     Main agent does NOT write these docs itself; spawn fresh Agents per Step 1.7.a/b.

----- per-slice loop (repeats per slice from goal tree) -----
3. [→ §Step 2] For each dim in slice, run track-appropriate doc-relay:
   • Step 2-E (enumerate): persona brief → design draft (text) → persona-reaction
     (async, sonnet, MANDATORY) → [if pushback] design final
   • Step 2-S (sample): persona brief → design draft outputs 1-3 candidate PNGs FIRST
     → design.md → persona-reaction MUST view PNGs → [if pushback] design final
     re-renders a PNG (text-only patch forbidden)
   All Agents are fresh; persistence lives in @mention'd docs (and PNGs), not chat.

4. [→ §Step 2.5] Role-anchored build-plan Agent, per dim. Same role across (a)-(d).
   Role prompt MUST name reverse priors (e.g. "10年 shadcn/Vercel 学派 UI 设计师,
   反 1999 PG-essays 裸 HTML"). Holds {user_goal_surface, true_goal, persona,
   design-final, hero/anti-refs, repo_state}.
   (a) align-check (sync, sonnet) — answer ONLY "design 服务 true_goal? ≤3
       misalignment OR OK". Misalign → bounce to Step 3 (regenerate design).
   (b) translate (sync, sonnet) → 40-build-plan-{dim}-r{N}.md with hard constraints:
         - explicit tokens / primitives / scale (no vibes words)
         - every decision traced to a sentence in design.md / true_goal
         - §implicit-decisions section MANDATORY: every judgment design.md left
           underspecified, with 2 candidates + which chosen + why
   (c) plan-react (sample-track only, async sonnet, run_in_background=true) —
       persona reads plan, judges per-token "more like hero-ref or anti-ref?".
       Pushback → return to (b).
   (d) hero-only early render (recommended for sample-track) — render most prominent
       component (hero / 首屏 card) per the plan; run a subset of Step 5
       blind-compare. Fail → return to (b). Pulls cheapest validation forward of build.

5. Build the slice (code/site/etc.) according to design docs + build-plan.

6. [→ §Step 3] Validation-fix loop on the slice's built artifact (same as before):
   plan Agent → 90-validation-plan-r{N}.md (every check traced; severity = critical|nice;
                sample-track dims MUST contain ≥1 critical blind-compare; atomic checks
                on sample-track = anti-trope guardrails, necessary not sufficient)
   for iter in 1..3:
     validation Agent → 91-validation-run-r{N}-{iter}.md (any tools)
     if all CRITICAL pass → exit success
     fix Agent → modifies code + writes 92-fix-attempt-r{N}-{iter}.md
   if iter == 3 and still failing → surface to user.

7. [→ §Step 3.5] Milestone gate (after slice's validation passes). Three questions
   plus a surface-mirror check, written to a short doc in goal-docs/ (or appended to
   the round's STATE.md):
     ① slice's milestone artifact really done per 20-goal-tree?
     ② still serves true_goal?
     ③ does this finding require re-pruning subsequent slices?
   Plus a SURFACE-MIRROR CHECK: would a literal reader of user_goal_surface.md
   recognize what was built as "what they asked for"? Mirror failure = AI overreach;
   bounce to Step 1.b to surface the divergence to user.
   NO → update 20-goal-tree-r{N+1}, restart the slice (or change slice plan).
   YES → continue.

8. [→ §Step 3.7] Acceptance walkthrough. Persona Agent walks through the REAL built
   artifact (live UI, real CLI — NOT mocks, NOT screenshots). Subjective feedback
   flows back into 00-用户画像-r{N+1}.md hero/anti-refs immediately, not deferred
   to project end.

9. More slices in goal tree? → return to Step 3 with next slice.
   All slices done? → continue to Step 7 (retro).
----- end per-slice loop -----

10. [→ §Step 7] Project-end retro → 99-retro-r{N}.md.
    Capture: where did we drift, why did we drift, what should the prior have been?
    Diffs flow back into 00-用户画像-r{N+1}.md §审美参考 (especially anti-refs).
    Closes the only project-to-project feedback loop the protocol has.

11. [→ §Step 5] If user pushes back on docs or final artifact → update posterior,
    regenerate.

12. [→ §Step 4] Decompose deeper only when a dimension cannot settle, or user
    explicitly asks.
```

The key inversion vs. naive planning: **don't expand the goal tree until forced to**. The first response is a committed answer at the leaf, not a survey of branches. *(This is the same recursion-on-failure structure as ADaPT, but applied at the design level rather than the action level. `[Prasad et al. 2024, §3]`)*

But "leaf" doesn't mean "one sentence." For most build-something goals, the leaf is a small set of **stable dimensions** of that entity type (a website has 功能/UI/技术选型/部署; a CLI tool has 命令/IO/配置/分发). And each cell of that leaf isn't filled by the main agent in one stroke — it's filled by a **persona ↔ design dialogue mediated by docs**, because in-conversation alignment is too easy to fake. Fresh-context Agents communicating through artifacts is what makes "反复对齐" a physical process, not a stylistic claim.

## Step 0 — Cold-start vs iteration mode

Before any prior weighting, check whether `goal-docs/` already exists in the user-mentioned project (or in cwd if no project named) AND contains at least `00-用户画像-r{N}.md` for some N.

**Cold-start** (no `goal-docs/` or no persona doc): proceed to Step 1.

**Iteration mode** (existing `goal-docs/` with persona): the work has been started before; do NOT re-derive prior weighting, do NOT regenerate the persona, do NOT re-run all dimensions. Instead:

1. **Read state** — main agent reads `00-r{latest}-用户画像.md` + `STATE.md` (if it exists, gives current per-dim latest round) + `CHANGELOG.md` + the latest design doc per dimension.
2. **Classify the user's request** silently from cues:
   - **新增 (additive)** — "加 X / 也支持 Y / 还要做 Z / 增加 W". Extends scope without contradicting prior decisions.
   - **修正 (corrective)** — "X 不对 / 改成 Y / X 偏了 / Z 应该是 W / 现在的问题是…". Reports a mismatch between built artifact and design intent (or design vs persona).
   - **画像变更 (foundational)** — "目标用户改成 X / 受众增加 Y / 这次面向 Z". Invalidates the persona's premises. **Do NOT auto-execute this branch — surface to user (see below).**
3. **Spawn scope Agent** (sync, default model, fresh context). Inputs: persona + latest design docs + `CHANGELOG.md` + the user's verbatim request. Output: `goal-docs/UPDATE-r{N+1}-scope.md` listing:
   - request type (新增 / 修正 / 画像变更)
   - affected dimensions (module IDs) + rationale per
   - **track per affected dim** (enumerate / sample); flag any **track-change** vs prev round
     (enumerate↔sample switch = major redesign — text tokens largely deprecated, samples
     must be drawn or redrawn from scratch)
   - **affected slice(s)** in `20-goal-tree-r{N}.md` *(8th iter / Appendix H)* — milestone
     artifact's owner. E.g. "修正 [全部][踩坑][养成] brackets" is "slice = 首页, dim = UI";
     without the slice tag, the fix loop patches in isolation without re-checking the slice's
     milestone artifact. If the request affects a future slice not yet built, mark `slice = pending`
     and queue the change against that slice's eventual `40-build-plan` rather than running fix loop now.
   - **true_goal recheck** *(8th iter / Appendix H)* — does the user's request imply the underlying
     goal has shifted? If yes, surface a new Step 1.b proposal under USER GATE (write
     `00-true-goal-r{N+1}.md` only after user approves) before executing 新增 / 修正. If no,
     all downstream steps continue anchoring on the existing `00-true-goal-r{N}.md`. The scope
     Agent does NOT auto-rewrite true_goal — same authority rule as 画像变更.
   - whether validation needs new checks (and what they roughly are; sample-track dims
     must list at least one new blind-compare check if hero/anti refs have changed)
   - which prior `0X-r*-design-*.md` files (and any `_samples/*.png`) are superseded vs extended

   The scope Agent does NOT design solutions; it scopes the work. Main agent reads its output and proceeds.
4. **Append to CHANGELOG.md** — one entry per round with: trigger (user's exact request), type, scope (affected modules), eventual outcome (filled in after validation closes).
5. **Execute by type**:
   - **新增**: for each affected dim D, run Step 2 doc-relay producing new `D-r{N+1}-1-{name}-stakeholder.md` etc. Other dims do NOT get re-run. If D is a brand-new capability with no existing 模块号 (not in r1's goal-tree — e.g. `logo` showing up at r4), allocate the next free integer per §Filename convention §Cross-round new modules, and append the new dim to `20-goal-tree-r{N+1}.md`.
   - **修正**: SKIP Step 2 entirely. The design intent didn't change — only the implementation needs to catch up. Jump to Step 6 (validation): the plan Agent adds a new check entry whose `trace` quotes the user's verbatim request (e.g., `trace: "user request 2026-05-08: 现在的问题是 canvas 位置左偏了"`). Then the normal fix loop runs.
   - **画像变更**: scope Agent surfaces the analysis to the user — "this changes premises in dimensions {A, B, C}; want to redo all? selective? abandon iteration and start fresh as a new project?" Wait for user direction. Then write `00-用户画像-r{N+1}.md` and run Step 2 only on user-confirmed dimensions.
6. After Step 2 (if any) or directly: run Step 6 (validation) in iteration mode — see Step 6 §"Iteration mode" for delta plan / inheritance-aware run.

### Filename convention

Two shapes — depending on whether the file has a separate "name" slot (the dimension's human-readable label) or not.

- **With name slot** (dimensions): `{模块号}-{用户级轮次}-{名称}-{对话/iter轮次}-{角色}.md`
  - e.g. `02-UI-r1-1-stakeholder.md` (dim 02 / user-round 1 / dialogue **turn 1** — persona's brief)
  - e.g. `02-UI-r1-2-design.md` (**turn 2** — design draft replying to turn 1)
  - e.g. `02-UI-r1-3-stakeholder-reaction.md` (**turn 3** — persona's reaction to the draft)
  - e.g. `02-UI-r1-4-design.md` (**turn 4** — final design after reaction; **SKIP** if turn 3 said "looks good, ship it")

  **Iter is a SHARED counter across the whole doc-relay**, NOT per-role. Each file gets the *next* turn number. **Two files in the same round must NEVER share an iter** — `02-UI-r1-1-stakeholder.md` + `02-UI-r1-1-design.md` is wrong (two "turns" at the same dialogue position is meaningless). The design replying to a stakeholder brief at turn 1 must be turn 2: `02-UI-r1-2-design.md`. Odd turns are stakeholder voice (brief / reaction); even turns are design voice (draft / final). Turn N+1 always replies to turn N.

- **Without name slot** (validation files / persona / scope / changelog): `{模块号}-{用户级轮次}-[{iter}-]{角色}.md` (or unprefixed for goal-level meta)
  - e.g. `90-validation-plan-r1.md` (no iter — single doc per round)
  - e.g. `91-validation-run-r1-1.md` (iter = fix-loop iteration)
  - e.g. `00-用户画像-r1.md` (no iter, no role — name only)
  - e.g. `UPDATE-r2-scope.md`, `CHANGELOG.md`, `STATE.md` (goal-level, unprefixed)

| Role | iter slot | meaning |
|------|-----------|---------|
| persona / scope / plan / changelog | none | one per round (or rolling) |
| stakeholder / design / stakeholder-reaction | required | shared dialogue turn across all three roles (NOT per-role); turn N+1 replies to turn N. Typical sequence: 1 stakeholder → 2 design → 3 stakeholder-reaction → 4 design (final, only if reaction triggered re-design) |
| validation-run / fix-attempt | required | fix-loop iter (1..3) |

**Find current state of a dimension**: per Step 7.5 root invariant, root contains at most ONE `0X-{dim}-r{N}-{iter}-design.md` per dim — just read it. (Pre-archive fallback if Step 7.5 hasn't run yet: largest `r{N}` for that dim's `design` files; within that round, the largest dialogue-turn — typically iter 4 if reaction triggered re-design, else iter 2.) Optionally maintain `STATE.md` as a snapshot table.

**Check IDs preserve their birth round**: a check introduced in r1 stays `VAL-r1-005` forever, even when r3 inherits it. New checks in r2 are `VAL-r2-001`, etc. This makes archeology trivial.

**Cross-round new modules** *(9th iter)*: when r{N+1}'s scope Agent classifies the request as 新增 and the new capability does not map to any existing 模块号 (true gap in r1's goal-tree — e.g. logo asset matrix appearing at r4 of a site project that had only enumerated content/UI/functional dims 01–16), allocate the **next free integer in the same band** (product dims 01–19; goal-tree / scope meta 20–29; gate / acceptance 30–39; build-plan / fix-brief 40–59; retro / validation / meta 90–99; persona / true-goal / DoD / unprefixed goal-level docs use 00 or no prefix). If the product-dim band 01–19 is exhausted, surface to user — do NOT silently spill into 20–29 (reserved). The round slot stays at the user-level round, NOT a module-local round. E.g.: r1=01–16, r4 introduces logo → `17-logo-r4-1-stakeholder.md`, not `logo-r1-...`. Module-local rounds (`logo-r2-implementation-brief.md` style) are **out-of-convention orphans** — they don't merge into the inheritance graph, scope Agent can't find them via `0X-{dim}-r{*}-design.md` glob, and check archeology breaks. If you find such orphans in an existing `goal-docs/`, rename them into convention before the next round starts.

## Step 1 — Prior weighting (the step LLMs skip)

Before producing any answer, list 2–5 plausible interpretations of the goal and assign rough probabilities using world knowledge. This happens silently in your reasoning, not in the visible response.

> **Why this step matters.** Naive LLM planners *"select among all possible state-action queries"* and condition on the entire history, which becomes intractable. Using the LLM as a *prior* — a way to identify promising states early — is what makes planning tractable. `[Gonzalez-Pumariega et al. 2024, "Query-Efficient Planning with Language Models" §1]` In practical terms: a 1-sentence goal already contains strong evidence about what kind of solution fits; ignoring that evidence forces you to plan for the long tail.

The prior comes from cues already in the message:
- **Word choice**: "网站/website" → consumer-facing, lightweight default. "platform/system" → heavier. "tool/script" → single-purpose. *(This is a sociolinguistic register prior, not a technical one — people use heavier words when they mean heavier things.)*
- **Domain conventions**: What does this thing usually look like in the wild? A "Monte Carlo website" in 2025 is overwhelmingly a teaching demo (π estimation, random walks), not a quant platform.
- **User register**: Casual phrasing ("我打算做一个", "thinking of building") → personal project. Formal spec language → production system.
- **Stated context**: Solo developer? Team? Mentioned budget? Mentioned scale?
- **What's NOT said**: Production users, SLAs, compliance, scale numbers, team size — absence of these is itself strong evidence of a small project.

Worked example for "我打算做一个蒙特卡洛模拟网站":

| Shape | Prior | Evidence |
|-------|-------|----------|
| Teaching/visualization demo | ~70% | "网站" + Monte Carlo's most common public form is intuition demos |
| Personal portfolio project | ~20% | Casual "我打算" register, asking AI for design help |
| Commercial quant platform | <5% | Such requesters say "平台/系统", mention compliance/scale |
| General-purpose DSL tool | <5% | Niche; would require explicit cues |

Pick the modal shape. Commit to it. **Cost of being wrong is low** — the user corrects in one sentence and you regenerate. Cost of asking them to choose is high — it offloads judgment they came to you to provide. *(The asymmetry comes from conversational economics: clarification questions cost a full round-trip and shift cognitive load onto the user; a wrong commitment costs only the correction itself, which the user produces faster than answering an abstract question about requirements they haven't articulated.)*

Crucially, the prior should also produce a **target user** — not as a label ("beginners", "developers") but as the specific population the modal shape implies. "Teaching Monte Carlo website" → "people who don't yet understand Monte Carlo and want to build intuition", which is concrete enough to seed Step 1.5.

### Step 1.b — Propose 1-layer-deeper interpretation under USER GATE *(8th iter / Appendix H)*

Prior iterations of this skill treated `user_goal原话` as immutable ground truth. That's wrong: AI is *better* than humans at pattern-matching "what is this user actually trying to do" (because it has seen thousands of similar requests) — but *worse* than humans at deciding "is that actually what I want." So **AI proposes a deeper interpretation; user disposes**.

**Mechanism**:

1. Write `goal-docs/user_goal_surface.md` — the user's request **verbatim**. ★ read-only thereafter, used as audit mirror in Step 3.5 and Step 7.
2. AI silently considers: is there a 1-layer-deeper underlying goal that, if true, would imply a different/better executable adjustment? Canonical example:
   - surface: "做一个蒙特卡洛案例演示网站"
   - underlying (AI's read): "想搞懂蒙特卡洛"
   - executable adjustment: 2–3 contrasting cases + 公式可视化 instead of one polished case
3. **HARD CAP = 1 layer.** Don't recurse "学蒙卡 → 学概率 → 提升数理能力 → 实现财务自由" — at some point the deeper layer architects away the concrete request entirely. The rule: only count a layer as "deeper" if it produces a *concrete executable adjustment*. If the next layer down doesn't change what gets built, you've passed the useful depth — stop.
4. **Special case — no signal**: if AI has no concrete reason to suspect a deeper goal differs from surface, do NOT fabricate one. Skip the proposal entirely; `00-true-goal-r{N}.md = user_goal_surface.md verbatim`. **Avoiding hallucinated reinterpretation matters more than always producing one.** Anti-pattern check: if the proposal is a vague "maybe you really want elegance / quality / a complete experience", that's no signal — skip.
5. **USER GATE — strict** (cannot be silent). When a proposal exists, surface to user in this format:
   ```
   字面读到的: "<verbatim from user_goal_surface.md>"
   我猜你底层想要的: "<1 layer deeper>"
   因此建议调整为: "<concrete executable adjustment>"
   why: "<one-line reasoning>"

   选: ① 同意调整  ② 拒绝, 按字面做  ③ 自己改成: ___
   ```
   Wait for user input. Record the choice + final goal in `00-true-goal-r{N}.md`.
6. Output `goal-docs/00-true-goal-r{N}.md` containing:
   - whether the proposal fired (and was accepted/rejected/overridden) OR was skipped (no-signal)
   - the **final goal** every downstream step anchors on
   - a short note on what surface-vs-true differences exist (used by Step 3.5 surface-mirror check)

**All downstream steps anchor on `00-true-goal-r{N}.md`, not `user_goal_surface.md`.** The surface file is a fail-safe audit mirror — if drift is severe enough that what we built no longer resembles the literal request, the surface mirror catches it at Step 3.5 milestone gate.

**Anti-pattern**: silently rewriting the goal without surfacing to user (no USER GATE). The asymmetry of the rule — "AI proposes, user disposes" — is the entire point. Silent reinterpretation regresses to the failure mode this step exists to prevent.

## Step 1.5 — Instantiate the persona as a roleplay-able profile

The recognized intent and target user must now be turned into something an Agent can **roleplay as**. Abstract intent ("teaching") and abstract user ("beginner") cannot be roleplayed — a fresh Agent reading "user is a beginner" produces generic platitudes. A fresh Agent reading "大二学生，刚学完概率，没碰过 JS，看 3blue1brown 视频，喜欢直观可视化，看到一堆 slider 会先 confused" produces a specific voice.

Persist the persona as `goal-docs/00-用户画像.md` using this structure (extend as needed, but don't omit fields):

```markdown
# 用户画像 — [一句话标签，e.g. 想弄懂蒙卡的概率论新手]

## 背景
- 学历/职业/年龄
- 相关领域基础（懂什么，不懂什么）

## 动机
- 来这里想做什么、想解决的困惑是什么

## 审美参考（必填；用于 sample-track dim 的 reference cluster）

> 没有本地截图就不算审美参考——product name 是 sample 的引用，不是 sample 本身；下游 Agent 读到 "desmos" 走的是 "文字→想象→文字生成" 的双重 lossy decode，sample 信号已丢两层。截图必须落到磁盘 (`goal-docs/_refs/`)，后续 sample-track 的 design Agent 会拿这些做候选样张的视觉锚，validation 的 blind-compare check 会直接喂给独立 sonnet 评委。

### Hero refs ("成品要往这一档靠"，≥ 3 项)
schema：`name · URL · 本地截图路径 · 一句"这一张里我具体喜欢什么"`
- e.g. shadcn/ui docs · https://ui.shadcn.com/ · `goal-docs/_refs/shadcn-docs-1440.png` · "克制的边框 + 1px hairline + 留白节奏"
- e.g. 3blue1brown 视频帧 · https://youtu.be/... · `goal-docs/_refs/3b1b-pi-frame.png` · "暗背景 + 高饱和强调色 + 几何感"

### Anti refs ("绝不能像这一档"，≥ 2 项)
同 schema：
- e.g. PG essays · http://paulgraham.com/... · `goal-docs/_refs/pg-essay-1440.png` · "未设计的 1999 裸 HTML"
- e.g. antd 中后台 demo · https://demo.youzan.com/... · `goal-docs/_refs/antd-dashboard.png` · "卡片+阴影+渐变堆出来的现代感"

**审计**：每个 ref 的截图路径必须真实可打开。仅写 product name 等于没填——validation Agent 在跑 blind-compare 时会直接 fail（找不到比较对象）。

## 沟通风格
- 主动 vs. 被动？爱举例 vs. 偏抽象？

## 认知边界
- 看到 __ 会直接跳过
- 需要先看到 __ 才能进入下一步
```

**Self-test for the persona doc**: would a fresh Agent reading only this file (and the screenshots referenced from `goal-docs/_refs/`) reproduce the persona's voice consistently? If you can imagine multiple wildly different personas matching this profile, the profile is too thin. The 审美参考 schema (hero/anti split + local screenshot path + per-ref "what specifically do I like/hate") exists because without it, downstream design Agents in sample-track Step 2-S cannot ground their PNG candidates in concrete visual targets — they fall back to "现代克制" generic language and the relay collapses to text-only. **Audit**: every ref in 审美参考 must have a file at the screenshot path that actually opens in an image viewer; product names alone fail the audit.

## Step 1.6 — Track classification (per dim)

Once persona is set and the entity's stable dimensions are known (website → 功能/UI/技术/部署 etc.; see § Step 2 for the entity-table), the main agent labels each dim's **track**. The label routes the dim through Step 2-E vs Step 2-S, and Phase 3a-E vs 3a-S.

**Default classification by spec form**:

- **enumerate-track** — the dim's spec is a finite set of discrete decisions, each text-decomposable. Verifying compliance = checking each decision is in place.
  - 功能模块, 技术选型, 部署, 数据模型, 调度策略, CLI 命令结构, 输入输出格式, 平台差异, 上架渠道, 数据源, 转换步骤, 监控.
- **sample-track** — the dim's spec is continuous, globally-experiential, and *cannot* be losslessly encoded in text. Atomic decisions ("12px radius", "shadcn spacing") are projections of the spec, not the spec itself. Verifying compliance = the rendered artifact's gestalt matches the persona's hero-ref cluster (and is distinguishable from anti-refs).
  - UI 风格, 视觉, 排版, 交互体感, 文案 tone, 节奏感, 品牌调性, 配色, 字体气质, 插画风格.

**When in doubt**, ask: *"If I described every decision in this dim as text, sent the text to a fresh Agent, and asked it to reconstruct the artifact — would the result match my intent?"* If yes (functional / config / schema), enumerate-track. If the reconstructed result could pass every text check and still feel wrong, sample-track.

**Mixed dims** — if "首页" mixes feature list (enumerate) and visual gestalt (sample), split it: `01-功能` = enumerate, `02-UI` = sample. Don't run a single dim doc-relay across both tracks; the protocol diverges and you'd be papering over the mismatch.

**Recording the labels**:

- **Cold-start** — main agent writes `goal-docs/STATE.md` with a `## Tracks` section listing each dim's label (or extends the existing STATE.md if one is being maintained).
- **Iteration** — scope Agent (Step 0a) records track per affected dim in `UPDATE-r{N}-scope.md`. If a dim's track has flipped vs the prev round (enumerate ↔ sample), flag it as **track-change** — treated as major redesign: prior text decisions largely deprecated, samples must be drawn or redrawn from scratch, prior atomic checks downgrade to guardrails.

**Why this step exists**: without it, the protocol below treats every dim uniformly via text-only doc-relay. That is correct for enumerate-track dims and **catastrophic for sample-track dims** — see HISTORY.md Appendix G (tranfu-site r1→r3), where 3 rounds of text-only UI doc-relay produced 51-check validation plans (49/51 pass) but the rendered home page kept `[全部][踩坑][养成]` plain bracket text and felt 1999. Track classification is the gate that routes each dim to a protocol that can actually verify its spec.

## Step 1.7 — DoD + Goal Tree + thin-slice picking *(8th iter / Appendix H)*

Prior iterations of this skill had a WHAT axis (dim 横切: 功能/UI/技术/部署) but no WHEN axis. All dims were pursued in parallel; nothing forced "finish a thin end-to-end slice and re-anchor" before going wider. Drift compounded across rounds invisibly. This step adds the WHEN axis.

### 1.7.a — Definition of Done

Spawn a fresh Agent (sync, default model). Inputs: `00-true-goal-r{N}.md` + `00-用户画像-r{N}.md` + the entity dim list. Output: `goal-docs/10-DoD-r{N}.md` listing observable, ideally tool-checkable success criteria the eventual artifact must satisfy. Tied to true_goal, not to surface.

Each criterion is a one-liner with: subject (what is checked), pass condition (concrete and observable), trace (which sentence in true_goal or persona it derives from).

Examples (teaching Monte Carlo site, true_goal = "学懂蒙卡"):
- `[DoD-001] 首屏在 5 秒内能让没碰过蒙卡的访客理解 'random sampling 估 π'`. trace: true_goal "想搞懂蒙卡". observable: persona walkthrough at Step 3.7 reports "懂了" (binary).
- `[DoD-002] 至少 2 个对比案例，每案例显示分布如何随 N 收敛`. trace: 1.b proposed adjustment. observable: count of cases ≥ 2 AND each has visible convergence chart.

DoD is the contract. Validation plan in Step 3 derives `severity: critical` checks from DoD entries. Don't skip DoD and try to derive validation checks ad-hoc — that's how `[全部][踩坑][养成]` brackets pass 49/51 atomic checks.

### 1.7.b — Goal Tree

Spawn a fresh Agent (sync, default model). Inputs: `00-true-goal-r{N}.md` + `10-DoD-r{N}.md` + dim list (Step 2's stable dims for the entity type) + track labels (Step 1.6). Output: `goal-docs/20-goal-tree-r{N}.md` with this shape:

```markdown
# Goal Tree — r{N}

## 北极星
<verbatim from 00-true-goal-r{N}.md>

## Phase A — <name>
DoD subset satisfied: [DoD-001, DoD-003]
- ### slice-1 — <name> ◀ thin slice (end-to-end, all dims)
  milestone artifact: <verifiable thing, e.g. "可访问的 demo URL with π estimation page">
  DoD subset: [DoD-001]
  dims touched: 功能 (E) / UI (S) / 技术 (E) / 部署 (E)
- ### slice-2 — <name>
  milestone artifact: ...
  DoD subset: [DoD-003]
  dims touched: 功能 (E) / UI (S)

## Phase B — <name>
- ### slice-3 — ...
```

**Hard rule — first slice is thinnest end-to-end**. Slice 1 MUST touch all dims of the entity (功能 + UI + 技术 + 部署 for a website). Not "all of 功能 across all phases first." End-to-end first means: from intake to deployed, vertically through all dims, but horizontally narrow (one feature, one screen). This forces design / build-plan / validation to all exercise once before anything is widened.

**Why thinnest-first**: catches integration issues + UI feel issues + deployment issues at minimum cost. `[全部][踩坑][养成]` plain-text brackets surviving 51-check validation is the canonical case of horizontal-first failure: 4 dims of design were "fine in isolation" because the rendered slice was never end-to-end exercised.

### 1.7.c — Slice tracking

Maintain `STATE.md §Goal-Tree` (or extend existing STATE.md) with `current_slice: <slice-id>`. After Step 3.5 milestone gate passes a slice, advance `current_slice` to the next slice in goal tree order; update `20-goal-tree-r{N+1}.md` if the gate's question-③ surfaced re-pruning needs.

In iteration mode, the scope Agent (Step 0a) ALSO records which slice(s) the user request affects, in addition to which dims. A 修正 against `[全部][踩坑][养成]` brackets in tranfu-site, for instance, is "slice = 首页, dim = UI"; without the slice tag, the fix loop applies the patch in isolation without re-checking the slice's milestone artifact.

**Why this matters**: prior iterations let the scope Agent tag "affected dims" alone. After H, "affected dims of which slice" is the right unit, because milestone artifacts are slice-scoped, not dim-scoped.

## Step 2 — Per-dimension doc-relay co-design (MANDATORY multi-Agent protocol)

> **STOP. This step uses the Agent tool. Do not inline-answer in this conversation.**
>
> If you are about to write "Here's the architecture: ..." or "I propose the following design: ..." or any committed design content directly in this chat — **you have skipped the protocol**. Re-read this section and start by spawning the first persona Agent.
>
> **Self-check before continuing**: have you made at least one Agent() tool call for this goal yet? If no and the goal involves a user-facing artifact (website / app / tool with UI / doc site / dashboard / anything a person uses), you MUST switch to the protocol below. Trust the self-check over your instinct to "just answer" — that instinct is exactly what this skill exists to override.

The committed leaf answer is **not a block of prose in this conversation**. It is a set of files in `goal-docs/`, produced by fresh Agent() calls running a doc-relay dialogue between a persona Agent and a design Agent. Every dimension of the entity (a website's 功能/UI/技术/部署) becomes a 2–4 turn dialogue persisted as @mention'd .md files.

The *shape* of the answer follows the stable dimensions of the entity type. The *contents* of every dimension are produced by Agent(), not by you.

**Stable dimensions per entity type** (rough, not a closed taxonomy — extend as needed; **(E)** = enumerate-track / **(S)** = sample-track, see § Step 1.6):

- **Website** → 功能模块 (E) / UI 风格 (S) / 技术选型 (E) / 部署 (E)
- **CLI tool** → 命令结构 (E) / 输入输出格式 (E) / 配置 (E) / 分发方式 (E)
- **Mobile app** → 页面流 (E) / 交互模式 (mostly S) / 平台差异 (E) / 上架渠道 (E)
- **Data pipeline** → 数据源 (E) / 转换步骤 (E) / 调度 (E) / 监控 (E)

These dimensions are stable across the category — they're what makes someone "think like a website designer" vs. "think like a CLI designer." Don't enumerate them defensively; just let them be the columns of your answer. The track label per dim routes the doc-relay through Step 2-E or Step 2-S below.

**The critical move: intent propagates through every dimension.** Don't treat "what is it" and "what is it for" as separate questions. The intent recognized in Step 1 (teaching, content, internal tooling, …) is what makes each dimension's answer specific instead of generic. A "website UI" answer that doesn't change based on whether the intent is teaching vs. internal tooling is a generic answer — i.e., wrong.

Worked contrast — **same dimensions, different intents, very different answers** (these are *examples of what each design Agent eventually distills into its `0X-design-<dim>.md` doc — they are NOT a template you fill in inline*):

| Dimension | 教学网站（蒙卡 demo） | 个人博客 | 公司内部工具 |
|-----------|----------------------|----------|--------------|
| 功能模块 (E) | π / 随机游走 / Buffon — 每模块一课 | 文章列表 / 详情 / 标签 / RSS | 表单 / 列表 / 导出 |
| UI 风格 (S) | hero-refs: 3b1b 视频帧 + desmos · anti-refs: SaaS 营销页 · 意图："扫一眼是科普讲解" | hero-refs: idle.run + read.cv · anti-refs: WordPress 主题市场默认 · 意图："文字优先，装饰留给段落空白" | hero-refs: Linear app 内页 + airtable grid · anti-refs: 任意 marketing site · 意图："信息密度优先，装饰为零" |
| 技术选型 (E) | 纯前端 + Canvas（无账号、好部署） | Astro/Hugo 静态生成（更新稀疏） | React + 简单后端 |
| 部署 (E) | 静态托管 *(intent 已锁死答案，一句话带过)* | GitHub Pages *(同上)* | 内部自托管 |

**Notice the shape difference**: enumerate-track cells (功能/技术/部署) compress into text decisions ("Astro/Hugo 静态生成") that fully encode the spec. The sample-track UI row does NOT compress into a text attribute list ("解释优先、可视化主导、配色友好" — the OLD shape — was wrong; it described UI as if it were enumerate). Instead, the sample-track cell is a **reference cluster** (hero-refs + anti-refs from `00-用户画像.md`) plus a one-line intent sentence. The actual UI design output is PNG samples produced in Step 2-S, not text in this table.

Notice: the *dimensions* are identical across the three columns. The *answers* differ entirely — and they differ because intent flowed through each cell. **But again: the cell values shown above are the *output* of running the doc-relay protocol below for each dimension, not something the main agent writes directly.** If you read this table and felt "OK I'll just produce a similar table for the user's request," you skipped the protocol — go back.

**Coverage rule (depth from intent + persona)**: every dimension gets walked, but **depth is set by how much intent and persona have to say**, not by the dimension itself.

- When intent makes a dimension's answer obvious (教学 demo 的部署 = 静态托管), it's a one-liner. Don't pad.
- When intent makes a dimension high-stakes (教学 demo 的 UI = 决定教学效果), expand it.
- When the persona genuinely doesn't care about a dimension (most users don't have opinions on tech selection), the persona's brief is short or "无意见" — that's fine, design proceeds without it.
- Skipping a dimension is wrong — even if the answer is "n/a", state that.

### Step 2 protocol: doc-relay co-design (per dimension, track-aware)

Each cell in the table above is **not filled by the main agent in one stroke**. It's filled by a short dialogue between two roles, both implemented as fresh Agent() calls communicating through @mention'd docs (and PNGs for sample-track) in `goal-docs/`. This is what makes "反复对齐目标" a structural property instead of a stylistic claim.

**The protocol forks by track**. Both forks share these invariants — persona speaks first; all Agents are fresh (no SendMessage); persistence in @mention'd artifacts. They differ in **what the design Agent's output is** and **what persona-reaction sees before signing**.

#### Step 2-E — enumerate-track protocol (text-only doc-relay)

Use for: 功能模块 / 技术选型 / 部署 / 数据模型 / 调度策略 / 命令结构 / 输入输出格式 / 平台差异 / 上架渠道 / 数据源 / 转换步骤 / 监控.

**Roles**:
- **persona Agent** — roleplays the user from `00-用户画像.md`. Speaks first per dimension. Does not design solutions; brings references, wishes, concerns, questions.
- **design Agent** — produces the design (text), addressing persona's brief explicitly.

**Per-dimension turn order** (steps 1–3 mandatory; step 4 conditional):

1. **persona brief** (sync, default model) → `0X-{dim}-r{N}-1-stakeholder.md`. Agent reads `00-用户画像.md` + all prior dimension docs, then writes 3–8 short bullets in user voice: references, wishes, concerns, questions. Tagged `@design`.
2. **design draft** (sync, default model) → `0X-{dim}-r{N}-1-design.md`. Agent reads the same prior context **plus** the brief, produces the design (text). Must explicitly address each `@design`-tagged item from the brief; if a wish is rejected or compromised, say so to `@stakeholder` with a one-line reason.
3. **persona reaction** (**MANDATORY, async, model = sonnet, run_in_background=true**) → `0X-{dim}-r{N}-2-stakeholder-reaction.md`. Spawn immediately after the design draft is written, then **proceed to the next dimension's step 1 without waiting**. The Agent reads the draft (and prior context) and writes a reaction in user voice. "@design 没意见，OK" is a valid output and the most common one — but the *decision* whether the draft is OK MUST come from this Agent reading the draft, not from the main agent's hunch.
4. **design final** (sync, default model, conditional) → `0X-{dim}-r{N}-2-design.md`. Fired only after the corresponding reaction doc exists AND contains substantive pushback (concrete asks, not just "OK"). For dimensions where the reaction is "no notes," step 4 is skipped — but the reaction Agent must still have run.

#### Step 2-S — sample-track protocol (samples-first doc-relay)

Use for: UI 风格 / 视觉 / 排版 / 交互体感 / 文案 tone / 节奏感 / 品牌调性 / 配色 / 字体气质 / 插画风格.

**Why a different protocol**: in sample-track dims, the design's spec lives in pixels, not text. A text-only doc-relay (brief in text → design in text → reaction reading text → final in text) makes the persona react to a *description* of a design, not the design itself. Persona's signature on a textual description is worthless if the rendered artifact looks different from what the textual description encoded. The fix: **design Agent's primary output is a rendered sample (PNG); the design.md is annotation on the sample, not a substitute for it**. Persona-reaction Agent receives the sample as image input (Read on `.png` returns image content) and is required to react to specific visual elements.

**Roles**:
- **persona Agent** — same shape as 2-E. Brief MUST cite hero-refs / anti-refs from `00-用户画像.md` by screenshot path.
- **design Agent** — produces 1–3 candidate samples FIRST, then writes design.md noting which sample is chosen and why. A sample = single-file HTML+CSS prototype rendered to PNG via headless Chrome. Renders should be 5-minute productions, **decoupled from the project's build pipeline** (no Astro/Vite/React/etc.) — the point is fast iteration on visual hypotheses, not production-fidelity output.

**Per-dimension turn order** (steps 1–3 mandatory; step 4 conditional):

1. **persona brief (ref-anchored)** (sync, default model) → `0X-{dim}-r{N}-1-stakeholder.md`. Same as 2-E plus: brief MUST cite hero-refs and anti-refs from `00-用户画像.md` by screenshot path, with per-ref clauses like "我看到 hero-ref `_refs/shadcn-docs.png` 后想要的具体感觉是 …" or "我看到 anti-ref `_refs/antd-dashboard.png` 后绝不要的具体特征是 …". Generic UX wishes ("现代克制") without ref-anchored clauses indicate the persona doc didn't seed enough — re-audit `00-用户画像.md §审美参考` before proceeding.

2. **design draft (sample-first)** (sync, default model). Outputs:
   - `0X-{dim}-r{N}-1-design-samples/` directory containing:
     - `candidate-A.html` + `candidate-A.png` (rendered)
     - `candidate-B.html` + `candidate-B.png` (rendered, **different visual hypothesis**)
     - optional `candidate-C.html` + `candidate-C.png`
     Each candidate must materially differ from the others on at least one axis the persona's brief flagged (color / layout / typography / spacing / elevation / etc.) — three near-identical candidates collapse to one and waste the protocol.
   - `0X-{dim}-r{N}-1-design.md` (≤ 200 words): which candidate is chosen and why, **anchored to specific elements in the chosen PNG and to specific hero/anti-refs**. A design.md that cannot cite a PNG path and a ref path in the same sentence is too abstract — regenerate.

   Design Agent renders each candidate via one of:
   - chrome-devtools mcp: write `candidate-A.html` to a temp dir, `navigate_page` to `file://...`, `take_screenshot` → save to `goal-docs/0X-{dim}-r{N}-1-design-samples/candidate-A.png`.
   - Playwright headless: scripted `page.goto` + `page.screenshot` against the HTML file.
   - Any equivalent local renderer. **The render must produce a real PNG file on disk**; descriptions of what a render would look like are forbidden.

   **Text-only design output on a sample-track dim is forbidden** — it collapses the protocol back to 2-E and is the failure mode HISTORY.md Appendix G traces (tranfu r1→r3).

3. **persona reaction (sample-aware)** (**MANDATORY, async, model = sonnet, run_in_background=true**) → `0X-{dim}-r{N}-2-stakeholder-reaction.md`. Spawn with the candidate PNG paths embedded in the Agent prompt. The Agent must use Read on the chosen PNG path (Read returns image content for `.png`) and must include a section starting with **"看了样本之后："** that anchors the reaction to specific visual elements (e.g., "第一眼看到列表项是裸文字 + 1px 线，跟 hero-ref `_refs/shadcn-docs.png` 比缺了 surface tier"). A reaction that does NOT include a "看了样本之后" section, OR that paraphrases design.md without referencing pixels, fails the audit — main agent re-spawns the reaction Agent with a stricter prompt before proceeding.

4. **design final (sample re-rendered)** (sync, default model, conditional) → `0X-{dim}-r{N}-2-design-samples/{candidate-final}.html + .png` AND `0X-{dim}-r{N}-2-design.md`. Fired only after reaction exists AND contains substantive pushback. The final **MUST re-render a PNG**; a text-only patch on `design.md` without a new PNG is a protocol violation (the "看了样本之后" reaction was based on the old PNG; persona has not seen the patched intent).

#### Async orchestration shape (both tracks)

```
for dim in [01-功能, 02-UI, 03-技术, 04-部署]:
    track = STATE.md tracks[dim]   # set in Step 1.6 / scope Agent
    spawn persona-brief Agent (sync) → wait for 0X-{dim}-r{N}-1-stakeholder.md
    if track == enumerate:
        spawn design-draft Agent (sync, text-only) →
            wait for 0X-{dim}-r{N}-1-design.md
    else:  # sample
        spawn design-draft Agent (sync, sample-first) →
            wait for 0X-{dim}-r{N}-1-design-samples/*.png + 0X-{dim}-r{N}-1-design.md
    spawn persona-reaction Agent (async, sonnet, run_in_background=true)
    # do NOT wait — move on
    continue

# After all dims' drafts are done, reactions trickle in via background notifications.
for each reaction doc that contains substantive pushback:
    spawn design-final Agent (sync) →
        enumerate: 0X-{dim}-r{N}-2-design.md
        sample:    0X-{dim}-r{N}-2-design-samples/*.png + 0X-{dim}-r{N}-2-design.md
```

**Why async + sonnet for the reaction step (both tracks)**: the reaction is mostly a *check pass* — most outputs are "@design 没意见" (or "看了样本之后没意见"). Running it sync would block the next dimension for a check that 80% of the time is a no-op. Running it on opus is overkill for a check that doesn't produce new design content. async + sonnet keeps the alignment property (reaction doc audit trail, no main-agent pre-judgment) without paying for it on the critical path.

#### Concrete examples (one per track)

**2-E example (enumerate-track 04-部署 dim of teaching Monte Carlo site)**:

```markdown
--- 04-部署-r1-1-stakeholder.md ---
@design 关于部署，没什么强诉求：
- 希望 GitHub Pages 或类似免费托管够了
- 不想自己管服务器
- 问题：自定义域名好不好接？

--- 04-部署-r1-1-design.md ---
基于 @stakeholder 的诉求：
- Cloudflare Pages（比 GitHub Pages 多 image cdn / preview deploys / 免费域名 SSL）
- GitHub Actions 触发 build → wrangler pages deploy
- 自定义域名：在 Cloudflare 后台一行配置就接上
@stakeholder：接受这个还是非要 GH Pages？

--- 04-部署-r1-2-stakeholder-reaction.md ---
@design 没意见，Cloudflare Pages 接受。OK。
```

The reaction is text-only, single sentence — that's correct because the spec ("Cloudflare Pages, GH Actions, custom domain via dashboard") fully encodes the design. There's nothing visual for persona to react to.

**2-S example (sample-track 02-UI 视觉 dim of teaching Monte Carlo site)**:

```markdown
--- 02-UI-r1-1-stakeholder.md ---
@design 关于 UI 视觉先抛：
- hero-ref：`goal-docs/_refs/3b1b-pi-frame.png`（暗背景 + 高饱和强调色 + 几何感；
  我看到这一帧后想要的感觉是"扫一眼觉得是科普讲解"）
- hero-ref：`goal-docs/_refs/desmos-1440.png`（亮背景 + 极克制 chrome + 主区域占满；
  想要的感觉是"工具就是工具，没多余装饰"）
- anti-ref：`goal-docs/_refs/antd-dashboard.png`（绝不要的特征是"3 列 grid + 圆角 +
  阴影 + 渐变标题"）
- 问题：暗 vs 亮，候选样张里我想都看一下再选。

--- 02-UI-r1-1-design-samples/ ---
candidate-A.html + candidate-A.png — 暗主题 / 中央大 Canvas / 控制条贴底 / accent #00d2ff
candidate-B.html + candidate-B.png — 亮主题 / 顶部一行白话标题 / Canvas 居中 / accent #ff6b35
candidate-C.html + candidate-C.png — 亮主题 / 左侧极简 nav / 大 Canvas / accent #ffd166

--- 02-UI-r1-1-design.md (≤ 200 words) ---
推荐 **candidate-B**（`02-UI-r1-1-design-samples/candidate-B.png`）。理由：
- 与 hero-ref `_refs/desmos-1440.png` 的留白节奏 + 顶部标题同档；@stakeholder 说的
  "工具就是工具" 在 candidate-B 上扫读确认。
- candidate-A 的暗 + 高饱和 #00d2ff 在 1440px 下读出来像产品发布页，跑偏 anti-ref
  `_refs/antd-dashboard.png` 的"装饰过度"。
- candidate-C 加左侧 nav 在教学场景里冗余。
@stakeholder 取舍：放弃了 hero-ref `3b1b-pi-frame.png` 的"暗 + 高饱和"，倾向 hero-ref
`desmos-1440.png` 的"留白主导"。两根锚不能同时全要，本轮先押 desmos。接受吗？

--- 02-UI-r1-2-stakeholder-reaction.md (async sonnet, viewed PNGs) ---
看了样本之后：
- candidate-B 的"标题一行白话 + 留白"确实是"扫一眼是讲解工具"的体感，主体方向 OK。
- 但 candidate-B 的 accent #ff6b35 在白底有点"营销橙"——和 anti-ref
  `_refs/antd-dashboard.png` 的暖色标题视觉接近。candidate-A 的冷色 #00d2ff 我反而
  觉得更"科普"。
- 能否 candidate-B 布局 + candidate-A accent？
- 其他 OK。

--- 02-UI-r1-2-design-samples/candidate-B-v2.png ---
（B 布局 + #00d2ff accent，重新渲染）

--- 02-UI-r1-2-design.md ---
final = `candidate-B-v2.png`。仅替换 accent 色 #ff6b35 → #00d2ff，其余 inherit
candidate-B。新 PNG 已渲染保存；@stakeholder 可再确认。
```

Notice the **shape difference between the two reactions**: 2-E is "OK" in one line — sufficient because the spec is fully text-encoded. 2-S has a "看了样本之后" section that names specific colors (#ff6b35 vs #00d2ff) and ref paths — the persona literally cannot give that reaction without seeing the PNG. In 2-E the text-only reaction is sufficient because the spec was always text-decomposable; in 2-S a text-only reaction would prove only that the persona signed off on the *description*, not on the rendered artifact.

#### Common to both tracks

**Why fresh Agent() instead of SendMessage**: SendMessage keeps an agent's own conversation alive across turns, which lets it accumulate exactly the kind of drift we're trying to escape. With fresh Agent + docs (and PNGs), persona's "consistent voice" comes from the persona doc being specifiable — not from the agent remembering itself. Persistent state lives in artifacts (auditable, version-controlled), not chat.

**Why persona speaks first**: if design speaks first, persona degenerates into a reactive critic and design's frame is set by the designer, not the user. Persona-first reverses the burden of proof: the design has to incorporate the user's references and wishes, not the other way around.

**When to skip the protocol** (narrow exception, default is "do not skip"): only skip when the goal has **zero user-facing design dimensions**. Concretely: pure utility scripts ("rename these files"), one-shot bash commands, code refactors with no UX surface, single-fact lookups. Anything involving a website, app, tool with UI, doc site, dashboard, CLI users will see, or any artifact with a "user" goes through the protocol regardless of how small it looks.

The seed case "做一个蒙卡模拟网站" is the canonical trap: it superficially looks like a weekend script ("just a few HTML files"), but it has UI/teaching/interaction dimensions where the user perspective shapes the answer — so it MUST run the protocol. If you're tempted to skip because "the answer is obvious," that's the exact failure mode this skill exists to prevent. **In ambiguous cases, run the protocol.** The cost of running it on a small goal is one extra Agent round; the cost of skipping it on a goal that needed it is generic output that wastes the user's time.

If you find yourself writing "depending on your needs..." or "you could go with X, Y, or Z" — stop. That's the failure mode. Pick one. *(This connects to the broader observation that LLMs, lacking skin in the game, default to maximum-coverage answers; YAGNI applies harder to AI-generated designs than to human ones for exactly this reason.)*

## Step 2.5 — Role-anchored build-plan (per dim, before code is written) *(8th iter / Appendix H)*

Step 2 produces `0X-{dim}-r{N}-2-design.md` (the WHAT). Step 2.5 sits between WHAT and code, producing `40-build-plan-{dim}-r{N}.md` (the HOW). Without this step, spec → code is a lossy translation full of unstated judgment calls — specific tokens, primitives, spacing scale, layout grid for UI; API contracts and state machines for 功能. Each unspecified judgment is an entry point for the model's untouched prior, which for UI defaults to "1999 PG-essays 裸 HTML" (a known anti-pattern in saved memory). Step 2.5 closes that gap.

### 2.5.0 — Why role-anchored (not generic review)

A "generic review" Agent shares the same prior as the design Agent — same blind spots, same default. The fix is **angle of attack via roleplay**: prompt the Agent into a specific senior-role identity, with explicit reverse-priors. This is the same trick Step 1.5 persona uses (specifiable-in-writing → consistent voice), now applied at the execution layer.

**ROLE_BY_DIM** (canonical entries; extend as new dim types appear):

| dim | role identity (must NAME the reverse prior) |
|---|---|
| UI / 视觉 / 排版 (sample) | "10年 shadcn/Vercel 学派 UI 设计师，反 1999 PG-essays 裸 HTML倾向" |
| 文案 tone / 品牌调性 (sample) | "经验丰富的内容编辑，反 SEO-bait 套话堆叠" |
| 功能模块 (enumerate) | "tech lead / staff PM. 关心 API 契约、状态机、调用顺序、错误路径" |
| 技术选型 (enumerate) | "staff engineer. 关心边界、失败模式、可观测、依赖卫生" |
| 部署 (enumerate) | "infra/SRE. 关心环境差异、回滚、secret 管理、CI 时长" |

**Anti-pattern**: role described only by title ("UI designer", "tech lead") without naming reverse prior. Title alone gives the same prior the design Agent had; the named reverse-prior is what shifts decoding distribution. If your role prompt doesn't contain "反 X" or "not Y" or "specifically NOT Z", regenerate the prompt before spawning.

### 2.5.a — Align-check Agent

Spawn role Agent (sync, sonnet, fresh context). Inputs:
- `user_goal_surface.md`
- `00-true-goal-r{N}.md`
- `00-用户画像-r{N}.md` (full, including hero/anti refs)
- `0X-{dim}-r{N}-2-design.md` (final design after Step 2)
- For sample-track: chosen sample PNG path + hero/anti-refs from `goal-docs/_refs/`
- repo_state (if iteration mode: existing tokens / primitives / package list)

Prompt the Agent to answer ONLY this question:
> Does `0X-{dim}-r{N}-2-design.md` actually serve `00-true-goal-r{N}.md`?
> List ≤ 3 misalignments ("design says X, but true_goal really wants Y"), OR write "OK, proceed to translate."
> Do NOT propose solutions yet.

If output has misalignments → bounce back to Step 2 with these misalignments as inputs to the next round's persona brief. Do NOT translate-anyway. The whole point of running this *before* (b) is that translating a misaligned design just bakes the misalignment deeper into specific tokens.

### 2.5.b — Translate Agent

Same role Agent (sync, sonnet, fresh context). Inputs: same as (a) plus the (a) output ("OK, proceed"). Output: `goal-docs/40-build-plan-{dim}-r{N}.md`.

**Hard structural constraints on the output**:

1. Every decision is **concrete and traceable**. Format per decision:
   ```
   - <decision>: <specific value/choice>
     trace: <which sentence in design.md / true_goal / persona this derives from>
   ```
   Example (UI):
   ```
   - primary surface bg: `#0a0a0a` (true black, not zinc-950)
     trace: design.md "暗主题, hero-ref desmos-1440.png 的留白节奏" + persona anti-ref antd-dashboard "渐变标题"
   - card border: 1px solid hsl(0 0% 14.9%)
     trace: design.md "克制边框, 1px hairline"
   ```
2. **No vibes words**. Banned in build-plan: "现代", "简洁", "专业", "克制感", "高级感", "elegant", "modern", "polished". Decisions must be concrete enough that a junior engineer with no taste could implement them deterministically. If you wrote a vibes word, replace with a concrete spec or delete.
3. **§implicit-decisions section MANDATORY**. Lists every judgment design.md left underspecified, that the build-plan Agent had to decide on. Per entry:
   ```
   - <implicit decision name>: <which option chosen>
     candidates considered: [A, B, C]
     why this one: <one-line reason anchored to true_goal / persona>
   ```
   Examples:
   - "spacing scale": "shadcn default 4px multiples". candidates: [4px multiples, 8px multiples, golden ratio]. why: "design.md says shadcn-flavored, default scale is the flavor."
   - "border-radius for buttons": "0.375rem (6px)". candidates: [4px, 6px, 8px]. why: "hero-ref shadcn-docs.png shows 6px on primary buttons; persona anti-ref antd cards have 8px+ which feels heavier."
   - "loading skeleton: animate or static": "static". candidates: [animate, static]. why: "true_goal '学懂蒙卡' — animation distracts from convergence visualization, persona is here to learn not to be entertained."
4. Per-dim required content sections (track-aware):
   - **UI / 视觉 / 排版 (sample)**: `§color-tokens` + `§spacing-scale` + `§typography-scale` + `§shadcn-primitives-used` + `§layout-grid` + `§hero-component-breakdown` (down to leaf JSX) + `§implicit-decisions`.
   - **文案 tone / 品牌调性 (sample)**: `§tone-axes` (具体定位: 严肃 ↔ 俏皮 / 教师 ↔ 朋友 / 中文 ↔ 英文混排比 — 每条给一个具体落点位置, 不写"中等") + `§banned-phrases` (避免的套话/惯用语, ≥ 5 条具体例句) + `§sentence-rhythm` (短句/长句/段落长度的目标范围, 用真实示例锚定) + `§voice-anchors` (从 hero-refs 取 ≥ 2 段已发布的范本文段作为参考) + `§implicit-decisions`.
   - **功能 (enumerate)**: `§api-contracts` (input/output/error per endpoint) + `§state-machines` + `§call-sequence` + `§error-paths` + `§implicit-decisions`.
   - **技术 (enumerate)**: `§dependencies` (with versions) + `§boundaries` (what's in vs out) + `§failure-modes` + `§observability-hooks` + `§implicit-decisions`.
   - **部署 (enumerate)**: `§environments` + `§secrets-strategy` + `§rollback-plan` + `§ci-stages` + `§implicit-decisions`.

### 2.5.c — Plan-react Agent (sample-track only)

Sample-track build-plans need a second voice — the §implicit-decisions in particular are entry points for prior-default that look reasonable in isolation but rolled together produce the anti-pattern. Spawn persona Agent (async, sonnet, run_in_background=true). Inputs: persona doc + hero/anti-refs + the build-plan from (b).

Prompt: "For each color token / primitive / spacing decision in `40-build-plan-{dim}-r{N}.md`, judge: does this lean toward hero-refs or anti-refs? Output `§pushback` listing decisions that lean anti, with replacement suggestions."

If `§pushback` has substantive items → bounce to (b) for `40-build-plan-{dim}-r{N+1}.md` revision. If empty / "OK" → proceed.

Enumerate-track dims skip (c) — text decisions are auditable in (b)'s trace fields directly. (For high-stakes enumerate dims, optionally spawn a second role Agent with a different reverse prior to peer-review — but this is escalation, not default.)

### 2.5.d — Hero-only early render (sample-track, recommended)

Most cost-effective check in the entire protocol for sample-track dims. Before building the full slice, render just the most prominent component (hero / 首屏 card) per `40-build-plan-{dim}-r{N}.md`. Use real components (not single-file HTML+CSS prototype — that was Step 2-S's job; this is a real component render).

Then run a subset of Step 3's blind-compare against hero/anti-refs (just the one rendered component vs the corresponding hero/anti regions). Pull the cheapest validation slice forward of the build.

If blind-compare picks "most-like-anti-ref" on the hero render → bounce to (b) for `40-build-plan-{dim}-r{N+1}.md`. Saves you from building the full slice on a build-plan that will fail Step 3 validation anyway.

Skippable on tiny sample-track dims (e.g. a single-page dashboard where "hero" *is* the whole thing). Strongly recommended when sample-track dim has multiple distinct surfaces.

## Step 3 — Validation-fix loop (MANDATORY for any built artifact)

After all dimension docs are settled and the artifact is built (code, site, etc.), the work is NOT done. Run a closed-loop validation phase. Without this step, the LLM self-scores its own output — which produces "score 95/100" without ever opening a browser. The cure is, again, fresh Agent + artifacts: validation lives in docs and tool calls, not in the main agent's hunches.

This step is what closes the design ↔ reality gap. It is mandatory whenever Step 5 of the algorithm produced a real artifact (anything you could open, run, or look at).

### Phase 3a — Generate the validation plan (track-aware)

Spawn a fresh Agent (sync, default model) that reads `00-用户画像-r{N}.md` + every latest `{mod}-r{*}-{name}-{turn}-design.md` (and `0X-{dim}-r{*}-2-design-samples/*.png` for sample-track dims) + the actual built artifacts, and produces `goal-docs/90-validation-plan-r{N}.md`. Each check entry has the shape:

```markdown
- id: VAL-001
  description: "首屏 canvas 在容器内水平居中"
  severity: critical          # critical | nice-to-have
  trace: "02-design-UI.md §3 + 00-用户画像.md (审美参考: desmos 整齐布局)"
  pass_criteria: "canvas.left == (container.width - canvas.width) / 2 ± 4px"
```

Required properties:

- **`severity`** — `critical` checks must ALL pass before exiting; `nice-to-have` are recorded but don't block exit. Most user-visible behaviors and persona's stated wishes are critical; aesthetic polish and edge-case perf are usually nice-to-have. The plan Agent decides per check, but every check declares one.
- **`trace`** — every check must point to the persona doc bullet OR the design doc paragraph it derives from. **For sample-track dims, `trace` MAY also point to a hero-ref or anti-ref by screenshot path (e.g., `00-用户画像.md §审美参考·hero-refs · _refs/shadcn-docs.png`)** — these are the visual ground truth, valid trace targets. Plans whose checks can't be traced are inventing requirements that nobody signed up for. A plan with untraced checks fails its own self-review and must be regenerated.
- **No `tool` / `method` field**: the validation Agent in 3b chooses tools at runtime per check (chrome-devtools mcp, bash, lighthouse, file inspection). The plan specifies *what counts as pass*, not *how to verify*.

#### Track-specific schema additions

**For enumerate-track dims (3a-E)**: standard atomic `pass_criteria` (numeric / string / boolean assertion verifiable by tool output). Example shown above.

**For sample-track dims (3a-S)**: the plan **MUST contain at least one `critical` check of type `blind-compare`**. Schema:

```markdown
- id: VAL-r{N}-S001
  description: "首页 1440px 渲染气质属于 hero-ref 一档，不属 anti-ref"
  severity: critical
  trace: "00-用户画像.md §审美参考·hero-refs / anti-refs"
  type: blind-compare
  inputs:
    ours: <screenshot path of our render, e.g. goal-docs/91-r{N}-1-screenshot-home-1440.png>
    hero-refs:
      - goal-docs/_refs/shadcn-docs-1440.png
      - goal-docs/_refs/anthropic-news-1440.png
    anti-refs:
      - goal-docs/_refs/pg-essay-1440.png
      - goal-docs/_refs/antd-dashboard-1440.png
  pass_criteria: |
    Spawn a fresh sonnet Agent (sync, run_in_background=false — validation blocks on this).
    Prompt the Agent with all 5 screenshots labeled A/B/C/D/E (assignment shuffled
    per run; record the mapping). Ask:
        "其中一张来自一个我们正在评估的网站，其余来自参考组（一半属于该项目设计的
         hero 锚，一半属于明确不要的 anti 锚）。请挑出'最像 anti-ref 一档'的那一张，
         只回字母。"
    Pass if: ours's letter is NOT in the answer.
    Run 3 times with shuffled letter assignment; majority vote (≥ 2/3 not-ours = pass).
    Output: blind-compare-r{N}-{iter}-S001.md recording the mapping, the Agent's
    answers per run, and the verdict.
```

**Atomic property checks on sample-track dims** are demoted to **guardrails** — they enforce the persona's hard reactions (anti-antd: `border-radius <= 8px AND box-shadow blur <= 16px AND no gradient fills`; anti-marketing: `no hero / no logo grid / no fake stats`), but they do **not** prove the gestalt is right.

**Exit criteria per dim**:
- enumerate-track dim: all critical atomic checks pass.
- sample-track dim: blind-compare pass **AND** all guardrails pass. A sample-track dim with all guardrails passing and the blind-compare failing is **not done** (the case tranfu r3 hit: 49/51 atomic pass + felt-1999 = fail). A sample-track dim with the blind-compare passing and a guardrail failing is also not done (passes the gestalt but slid into a banned trope).

**Audit rule for the plan**: for each sample-track dim listed in `STATE.md §Tracks` or `UPDATE-r{N}-scope.md`, count the number of `type: blind-compare` checks with `severity: critical`. If zero, the plan is incomplete — regenerate.

### Phase 3b — Run validation (iteration N)

Spawn a fresh Agent (sync, default model). Inputs:

- `90-validation-plan.md`
- access to artifacts (running site URL, code paths, build outputs, logs)
- full tool latitude — chrome-devtools mcp for visual/DOM/perf, bash for CLI runs, Read for code/config inspection, etc.

Output: `goal-docs/91-validation-run-N.md`. One entry per check:

```markdown
- id: VAL-001
  result: fail              # pass | partial | fail
  evidence: |
    take_screenshot → canvas.left = 12px, container.width = 800px,
    canvas.width = 500px → expected 150px, off by 138px (left-skewed).
  notes: "看起来是 main.css §canvas 块少了 margin: 0 auto"
```

The validation Agent picks tools per check; do not constrain it from the orchestrator side.

**Sample-track specifics (3b-S)**: when the validation Agent encounters a `type: blind-compare` check, it MUST spawn a fresh Agent (sync, model = sonnet) — NOT score the comparison itself. The validation Agent prepares the inputs (mapping screenshots A/B/C/... to file paths, shuffling per run), spawns the judge Agent with the prompt from `pass_criteria`, records the answer, repeats 3 times, applies majority vote. The validation Agent's own role is orchestrator + recorder — not judge. Same epistemic principle as Step 3 in general: the score must come from a fresh Agent reading evidence, not from the orchestrator's introspection. **The fresh judge Agent sees only the screenshots — it does NOT read design.md, persona doc, or any text describing the intended look. That's the point of "blind"**.

### Phase 3c — Fix attempt (iteration N)

If iteration N has any `fail` on a `critical` check, spawn a fix Agent (sync, default model). Inputs:

- the failing check entries (subset of 91-validation-run-N.md)
- the relevant `0X-design-*.md` doc(s)
- full edit access to the codebase

The fix Agent has authority to edit any file. In return, it MUST produce `goal-docs/92-fix-attempt-N.md` documenting:
1. Which files were changed and why (one line each)
2. Which other check IDs from the plan might now be affected (so the next validation run knows what to re-check)
3. Any design-doc commitments the fix knowingly violates (rare, but if it happens it must be surfaced — preferably the fix Agent flags it and the design doc gets updated rather than silently bypassed)

### Loop control

```
N = 1
loop:
  validation Agent → 91-validation-run-N.md
  if all CRITICAL checks pass: BREAK (success — report nice-to-have failures separately)
  if N >= 3: BREAK (surface to user with what's still failing — DO NOT loop forever)
  fix Agent → modifies code + writes 92-fix-attempt-N.md
  N += 1
```

**Why max 3 iterations**: empirically, if 3 attempts haven't fixed a critical check, the failure is structural (wrong design, wrong tool, wrong assumption) — not a bug. Continuing burns budget on a problem the user needs to weigh in on. Surface with: "here's what passed, here's what's still failing after 3 attempts, here's the last fix attempt's notes — what do you want?"

**Why fresh Agent for validation, not main agent**: same reason as everywhere else. The main agent has accumulated context that includes its own prior commitments — it cannot honestly evaluate them. Fresh Agent + plan + artifacts has no loyalty to those commitments and will report what it actually sees.

**Why validation chooses tools at runtime**: unlike the persona doc (which must be statically specifiable so any fresh Agent reproduces the same voice), the right tool for a given check depends on the artifact. A "canvas centered" check needs chrome-devtools; a "JSON schema valid" check needs `jq`; a "file size < 1MB" check needs `ls -la`. Pinning tools in the plan would either over-constrain or grow ad infinitum. Better to trust the validation Agent and audit via the evidence it records.

### Iteration mode (Step 6 when called from Step 0a iteration branch)

When the round being run is r{N} for N > 1 (i.e., this is an update to a project that already has an r{N-1} validation history), the three docs change shape from "full snapshot" to "delta + reference":

**Inheritance reads** *(10th iter)* — per Step 7.5 root invariant, prior-round validation plans/runs live in `_archive-r{N-1}/`, not at root. The plan Agent reads `_archive-r{N-1}/90-validation-plan-r{N-1}-resolved.md` to inherit checks; paths are deterministic from round number, so no glob walking needed. If the prior round was never archived (pre–Step 7.5 backfill state), read from root as fallback.

**`90-validation-plan-r{N}.md`** — delta plan with four sections:

```markdown
# Validation Plan — r{N}

## Inherited
继承 90-r{N-1}-validation-plan.md 全部 active check（默认仍 active）。覆盖见下。

## New (r{N})
- id: VAL-r{N}-001                # ID encodes birth round; never renumber when later rounds inherit
  description: ...
  severity: critical
  trace: "01-功能-r{N}-1-design.md §X" or "user request 2026-05-08: ..."
  pass_criteria: ...

## Overrides (r{N})
- VAL-r{prev}-XXX: severity nice → critical (reason: ...)
- VAL-r{prev}-YYY: pass_criteria 改成 "..." (reason: ...)

## Deprecated (r{N})
- VAL-r{prev}-ZZZ: 因 ... 取代该路径，本轮起不再 active
```

After writing the delta plan, the plan Agent ALSO writes `90-validation-plan-r{N}-resolved.md` — a flat snapshot of all-currently-active checks after applying the chain `r1 → r2 → ... → r{N}`. This is the cache validation Agent reads in Phase 3b. The Agent that produces it walks the inheritance chain so the validation Agent doesn't have to.

**`91-validation-run-r{N}-{iter}.md`** — inheritance-aware run:

```markdown
# Run — r{N} iter {iter}

## Inherited checks (re-verified)
全部 K 项 r1..r{N-1} active check 已重测，全部 pass，除：
- VAL-r{prev}-XXX: REGRESSION — was pass in r{prev} run, now fail
  evidence: <full evidence here>

## New checks (r{N})
- VAL-r{N}-001: pass | partial | fail
  evidence: <full evidence>
- ...
```

The Agent MUST actually re-run inherited checks (not just claim "should still pass"); it just compresses the output to a one-liner per still-passing check. Regressions and new failures get full evidence. *(Anti-pattern: claiming inherited pass without running tools — that's the same self-reporting collapse Step 3 was designed to prevent. See Appendix F.)*

**`92-fix-attempt-r{N}-{iter}.md`** — same shape as cold-start, with one extra section:

```markdown
## Targets
- VAL-r{prev}-XXX (regression)
- VAL-r{N}-002 (new fail)

## Changes
- src/...: ...
  - addresses VAL-r{N}-002

## Affected checks (next run focus)
- 上述 + VAL-r{prev}-YYY (likely regressed by this change)
```

**Why delta + resolved cache (rather than rewriting full plan each round)**: the delta is what's *legible* — a human (or the next Agent) reading r{N} plan instantly sees what changed this round. The resolved file is what's *operational* — a single flat list the validation Agent runs against without having to walk the chain. They serve different readers, both cheap to produce.

#### Track-aware iteration semantics

**Inherit semantics differ by track**:

- **enumerate-track inheritance** — text decisions (config values, feature presence, schema fields) inherit verbatim. r{N} can override by listing the prev-round check ID in `Overrides`. Standard delta plan logic.
- **sample-track inheritance** — the inherited unit is the **chosen sample PNG** (`0X-{dim}-r{N-1}-2-design-samples/{candidate-final}.png`), NOT the design.md text or the atomic guardrails. r{N} either:
  - **keeps the sample**: re-render the same HTML in the new build, blind-compare uses the same hero/anti-refs, blind-compare check inherits its `id`. r{N} screenshot is taken from the new build but compared against the same ref set.
  - **replaces the sample**: re-run Step 2-S in r{N} to produce new candidates; old sample's blind-compare check is `Deprecated`; new blind-compare check is `New (r{N})`.

**Track-change between rounds (enumerate ↔ sample)** — flagged in `UPDATE-r{N}-scope.md`. Treated as **major redesign**:

- All prior atomic checks for that dim are downgraded to guardrails (not deleted — they may still be useful as "don't slide into trope" lines).
- The dim's design must restart from Step 2 of the new track. If switching enumerate → sample: scrap the text design.md, run Step 2-S to produce candidate PNGs. If switching sample → enumerate: scrap the candidate samples, run Step 2-E to produce text design.md.
- The blind-compare check (if switching to sample) is fresh, not inherited.

**Blind-compare check inheritance** — even if the sample is unchanged, the blind-compare check can become stale because the **ref set** in `00-用户画像.md` may have changed. Plan Agent in r{N} compares the inherited check's `inputs.hero-refs` and `inputs.anti-refs` against the current persona refs:

- Refs unchanged → check inherits as-is.
- Refs added (new hero/anti) → re-run blind-compare with the new ref set; same check ID.
- Refs removed → mark check as `Overrides` with reduced ref set.
- Refs replaced (e.g., r{N} persona drops "PG essays" anti-ref because user reversed on it) → check is structurally different; mark `Deprecated` and create a new check with a fresh r{N} ID.

## Step 3.5 — Milestone gate (after each slice's validation passes) *(8th iter / Appendix H)*

Step 3 confirms the slice's built artifact passes its validation checks. Step 3.5 confirms passing those checks actually *means* the slice's milestone artifact (per `20-goal-tree-r{N}.md`) is delivered, AND that what was delivered still serves `00-true-goal-r{N}.md`. Without this gate, drift compounds invisibly across slices — each slice individually passes its own validation, but the cumulative artifact diverges from the goal.

**Spawn**: a fresh Agent (sync, default model) — call it the **gate Agent**. Inputs:
- `00-true-goal-r{N}.md` AND `user_goal_surface.md` (both — this gate is the only step that needs both)
- `20-goal-tree-r{N}.md` (which slice we just finished, what its milestone artifact spec is)
- `90-validation-plan-r{N}.md` + `91-validation-run-r{N}-{final-iter}.md` (proof Step 3 passed)
- The actual built artifact (live URL / screenshot / running CLI output)

**Gate Agent output** → `goal-docs/30-milestone-gate-{slice-id}-r{N}.md` answering **three questions plus a surface-mirror check** (4 mandatory items total — all must PASS):

1. **Question ①** — Is the milestone artifact (per goal-tree) actually present and verifiable? The artifact spec was something concrete like "可访问的 demo URL with π estimation page"; check it with tools (open URL, run CLI, etc.). PASS / FAIL with evidence.
2. **Question ②** — Does this slice's delivered artifact still serve `00-true-goal-r{N}.md`? Re-anchor: read the true_goal verbatim, then narrate one paragraph: "the slice delivered X, which addresses true_goal because Y." If you can't write that paragraph without straining, the answer is no.
3. **Question ③** — Does anything we discovered in this slice require re-pruning subsequent slices? Common triggers: discovered the planned slice-2 is now redundant; discovered a slice-3 prerequisite we didn't see; discovered a dim's design needs a structural change to support all subsequent slices.
4. **SURFACE-MIRROR CHECK** — Read `user_goal_surface.md` verbatim. Imagine a literal reader of that file (no other context, no `00-true-goal`, no persona). Would they recognize what was built as "what they asked for", or would it look like a different project? PASS / FAIL with one-line reason.

**Outcomes**:

- All four PASS → advance `STATE.md current_slice` to next slice; return to Step 3 with the new slice.
- Q① or Q② FAIL → restart the slice. Update `20-goal-tree-r{N+1}.md` if the milestone artifact spec needs revision; otherwise re-run Step 3 (or back to Step 2.5 if the issue is in the build-plan).
- Q③ surfaces re-pruning → write `20-goal-tree-r{N+1}.md` with the revised tree; advance to whichever slice the new tree dictates.
- **SURFACE-MIRROR FAIL** → bounce all the way back to Step 1.b. The true_goal interpretation has drifted far enough from surface that the literal reader of the request would no longer recognize the project. **Surface to user**: "what we've built no longer matches your literal request — was the 1-layer-deeper interpretation we agreed to (option ① at intake) actually right? Here's the divergence: …". User decides whether to keep the underlying interpretation, snap back to surface, or revise. Mirror failure is RARE — most projects have a small surface↔true gap and never trigger this. But when it triggers, it catches AI overreach better than any other check.

**Why both true_goal and surface in the same gate**: true_goal is what we anchor on (otherwise we're transcribing without judgment), surface is what catches us if our judgment got too creative. Two anchors with one gate Agent comparing them is the cheapest available "AI overreach" signal. Single-anchor protocols can't detect overreach because the anchor and the work agree by construction.

**Anti-pattern**: skipping the gate "because Step 3 validation passed." Step 3 says the artifact is built correctly per its plan; Step 3.5 says the plan was the right plan to be building. Different question. Step 3 alone produced `[全部][踩坑][养成]` (per HISTORY Appendix G), which passed plan-derived checks while being wildly wrong as a milestone artifact.

## Step 3.7 — Acceptance walkthrough on real artifact *(8th iter / Appendix H)*

After milestone gate (Step 3.5) passes, but before advancing to the next slice, do one more thing: **persona Agent walks through the real artifact** as a real user would. This is *different* from Step 3 validation (which checks against plan) and from Step 3.5 (which checks against goal tree + true_goal): Step 3.7 asks "does the persona, walking through this as an actual user, react like the persona would?"

**Spawn**: persona Agent (async, sonnet, run_in_background=true). Inputs:
- `00-用户画像-r{N}.md` (full persona)
- The slice's milestone artifact — but **the real version, not a mock**:
  - Live URL (open with chrome-devtools mcp `new_page` + `navigate_page`)
  - Real CLI invocation (run via Bash, capture output)
  - Real screenshots taken at runtime, not design-time PNGs
- For UI: walkthrough plan — what 3–5 specific user journeys does the persona's brief imply they'd take? (e.g., "首次访问 → 想试试 π 案例 → 改 N 值 → 看分布")

**Output** → `goal-docs/35-acceptance-{slice-id}-r{N}.md` with:
1. Per user-journey: what the persona felt walking through it — concrete sentences anchored to specific elements ("first impression: 暗背景 + 居中 Canvas, 体感对了"; "改 N 值时滑条 visual feedback 太微弱, 没注意到自己改成功了").
2. Subjective signals (NOT checks against design.md text): "感觉对" / "感觉怪" / "想要 X 但没看到".
3. Any new hero-refs OR anti-refs the persona discovered while walking through (e.g., "走完后才意识到 desmos 的 K-key 弹键盘是我也想要的——加进 hero-refs").
4. A single-line bottom line: "OK, 进下一 slice" / "PUSHBACK on <element>".

**Pushback handling**:
- If pushback is on **build-plan-level** (token / primitive / spacing / specific component): bounce to Step 2.5(b) for build-plan revision. Apply fix, re-render, re-walk.
- If pushback is on **design-level** (the chosen sample direction was wrong): bounce to Step 2 for `0X-{dim}-r{N+1}` doc-relay.
- If pushback surfaces a **persona-update** (new hero-ref discovered): write `00-用户画像-r{N+1}.md` with the new ref **immediately** (don't defer to Step 7 retro). Subsequent slices benefit from the updated persona.

**MANDATORY: re-run Step 3 + Step 3.5 after any pushback fix.** If Step 3.7 bounces back to design (Step 2) or build-plan (Step 2.5b), the slice has been rebuilt — the previous Step 3 validation run AND the previous Step 3.5 milestone gate are STALE and MUST re-fire on the updated artifact before advancing to the next slice. Self-test #25 checks for the *latest* milestone gate doc, not just any gate doc — a gate doc from a pre-pushback state does not count.

**Why a real-artifact walkthrough**: Step 2-S persona-reaction sees PNG mocks (single-file HTML+CSS prototypes); Step 3 validation runs blind-compare on snapshots; neither exercises the artifact as a user would. Real interactions surface things mocks can't — slow loads feel different, hover states matter, keyboard nav exposes layout decisions, the cumulative gestalt of clicking through 3 screens differs from a single screenshot of any one of them. This is also where persona discovers things to add to its own `审美参考` — "I didn't know I wanted X until I saw the rendered Y" is a normal mode for sample-track dims.

**Why immediate persona update (not deferred to retro)**: persona drift fixes need to apply to the *next slice in this same project*, not just to the next project's cold-start. Step 7 retro consolidates project-level lessons; Step 3.7 fixes propagate immediately within the project.

## Step 4 — Decompose only on failure

Sub-goals appear when (and only when):
1. The committed answer doesn't fit something the user reveals after seeing it
2. A step in execution actually fails (test fails, code errors, output wrong)
3. The user explicitly asks "go deeper on X"
4. Validation Step 3 exhausts 3 iterations on a critical check (then the failing dimension's design doc gets revisited, not just the code)

When decomposition does happen, it's **local** — only the failing branch expands. The rest of the tree stays at the leaf level. *(This is ADaPT's recursive-on-failure structure: the algorithm only descends into a sub-tree when the parent task can't be executed directly. `[Prasad et al. 2024, §3, "Recursive Decomposition"]`)*

This is the opposite of "plan-and-execute." It's closer to: try the obvious thing → see what breaks → fix that specific thing.

## Step 5 — Update on correction

When the user pushes back ("you're overcomplicating this" / "that's not what I meant" / "你这就不对"), the right move is **not** to ask clarifying questions. The right move is:

1. Identify which prior was wrong (usually: assumed heavier shape than reality)
2. Shift probability mass toward simpler shapes
3. Regenerate the answer at the new modal shape
4. Don't apologize at length; correction is cheap, that's why this algorithm works

Asking "what did you mean?" after a pushback is a regression to the failure mode. The user already gave the signal; use it. *(In the seed conversation for this skill, the LLM regressed exactly this way — proposing to "ask clarifying questions" — and was correctly told that the information had been there all along. See Appendix, Turn 7.)*

## Step 7 — Project-end retro *(8th iter / Appendix H)*

After all slices in `20-goal-tree-r{N}.md` have passed Step 3.5 milestone gate AND Step 3.7 acceptance walkthrough, the project is technically done. Step 7 is the only step in this skill that runs at project-to-project granularity rather than within a project — it captures lessons that should make the **next** project start with a better prior, not just deliver this project correctly.

**Spawn**: a fresh Agent (sync, default model). Inputs:
- All `0X-{dim}-r{*}-*-design.md` (every doc-relay round, all dims)
- All `40-build-plan-{dim}-r{*}.md` (every build-plan round)
- All `30-milestone-gate-{slice-id}-r{*}.md` (where Q③ surfaced re-pruning)
- All `35-acceptance-{slice-id}-r{*}.md` (where persona discovered new refs)
- `90-validation-plan-r{*}.md` history (which checks repeatedly failed early then passed)
- `00-用户画像-r{*}.md` (current and any prior versions)
- `CHANGELOG.md`

**Output** → `goal-docs/99-retro-r{N}.md` with these required sections:

1. **§drift-incidents** — every time we bounced from Step 3.5 / Step 3.7 / Step 2.5(a) / Step 2.5(c) / Step 2.5(d), capture: where did we drift, why did the prior protocol step not catch it, what should have been different at the upstream step.
2. **§new-anti-refs** — every visual / token / phrasing decision a Step 2.5(c) or Step 3.7 reaction explicitly flagged as anti. Each gets a one-line description + (if applicable) a screenshot path. These will get inserted into next round's `00-用户画像-r{N+1}.md §审美参考 § Anti refs`.
3. **§new-hero-refs** — symmetric. Things the persona discovered they wanted while walking the real artifact.
4. **§persona-doc-revisions** — concrete edits to suggest for `00-用户画像-r{N+1}.md` (not just refs — also wishes,认知边界 entries the project surfaced).
5. **§prior-recalibration** — was the Step 1.a prior-weighting accurate? If we said "70% teaching demo" and the project ended up needing more X than that prior implied, record the recalibration. Generic, applies across projects of this entity type.
6. **§build-plan-§implicit-decisions-frequent** — patterns observed in §implicit-decisions across multiple build-plans: which judgment-calls keep coming up, what's the canonical answer for this project's persona? Future projects' build-plan Agents can be primed with these to skip rediscovery.

**What happens after writing the retro**:

- Main agent applies §new-anti-refs and §new-hero-refs into `00-用户画像-r{N+1}.md` immediately. (If user is going to start a follow-up iteration, the persona is already updated.)
- §persona-doc-revisions surface to user — these are bigger changes, user confirms before applying.
- §prior-recalibration and §build-plan-§implicit-decisions-frequent get logged to a project-level `LESSONS.md` (cross-project) if it exists, otherwise just live in retro.

**Why retro is mandatory, not optional**: the retro is the only project-to-project feedback loop in the protocol. Skipping it means every new project starts from the same priors that produced the drift in this project. Other steps' fixes apply within-project; this one applies across-project, which is the cheapest place to fix the root cause.

**When to skip**: project was a single tiny slice with no drift and no surprises (every Step 3.5 / Step 3.7 PASSED with no bounce). In that case write a 3-line stub retro: "no drift, no new refs, prior was accurate." Don't pad with manufactured lessons. Pattern-only stubs are signal too — they tell the next-project's prior that this entity type's prior is mature and probably trustworthy.

**Anti-pattern**: skipping retro on the grounds that "the user got what they wanted." User satisfaction does not imply the prior was correct — the user might have gotten what they wanted via 4 rounds of bouncing, and the lesson is in those bounces. Project completion ≠ no lessons learned.

## Step 7.5 — Root-as-answer archive gate *(10th iter)*

Triggered after Step 7 retro is written. Enforces the invariant **root = latest converged answer per artifact; everything else (process, receipts, superseded versions) lives in `_archive-r{N}/`**. Without this gate, `goal-docs/` conflates "what does this project look like now" with "how we got here" — design.md from 3 different rounds, every stakeholder brief, every validation run sit at the same level, and "current state" becomes unreadable.

### The root invariant

After the gate runs, root contains exactly:

- `00-用户画像-r{LATEST}.md` (older r{N}s → archive)
- `00-true-goal-r{LATEST}.md`
- `10-DoD-r{LATEST}.md`
- `20-goal-tree-r{LATEST}.md`
- `99-retro-r{LATEST}.md`
- For each dim D: ONE `0X-{dim}-r{N}-{iter}-design.md` — the per-dim latest (max r{N}, max iter within). Different dims may have different "latest rounds" — a dim untouched in r2 keeps its r1 design at root, because r1 IS the latest for that dim. The "round" doesn't own design.md; the *dim* does.
- `CHANGELOG.md` / `STATE.md` / `user_goal_surface.md` / `CLAUDE.md` / `MEMORY.md` — rolling or immutable goal-level meta

Everything else moves to `_archive-r{N}/` keyed by birth-round:

- **Process** — `*-stakeholder.md`, `*-stakeholder-reaction.md`, `40-build-plan-*`, `40-align-check-*`, `40-plan-react-*`, `35-acceptance-*`, `50-fix-brief-*` / `50-build-brief-*`, `92-fix-attempt-*`, `UPDATE-r{N}-*.md`
- **Receipts** — `90-validation-plan-r{N}.md` (+ `-resolved`), `91-validation-run-r{N}-*`, `30-milestone-gate-{slice-id}-r{N}.md` (+ gate PNGs), `91-val-*.png` / `91-r{N}-*.png` / `92-r{N}-*.png`, `blind-compare-r{N}-*.md`, `40-align-check-*` and similar role-anchored audits
- **Candidates** — `0X-{dim}-r{N}-{iter}-design-samples/` directories, `blind-compare-crops-r{N}-*/` directories
- **Superseded answers** — any `0X-{dim}-r{N}-{iter}-design.md` that is NOT the per-dim latest; older `00-用户画像` / `00-true-goal` / `10-DoD` / `20-goal-tree` / `99-retro`

### Why audit trail goes to archive *(change from 9th iter)*

Prior version of this step kept the audit trail (stakeholder / reaction / validation-* / gate / blind-compare) at root on the grounds that r{N+1} iteration mode needs it. That was the wrong cut.

The audit trail is *process* — receipts for how we arrived at the answer. The answer itself is design.md (and persona/DoD/goal-tree). Iteration mode in r{N+1} reads inheritance from `_archive-r{N-1}/` (paths are deterministic from round number, so no glob walking needed). Keeping receipts at root conflates "what we decided" with "how we decided it" and the "what" loses — anyone trying to answer "what does this project look like now?" by reading `goal-docs/` drowns in process.

### Trigger and gate

`99-retro-r{N}.md` exists for the just-completed round. Main agent prompts user verbatim:

```
r{N} 这一轮按预期完成了吗？
① 是, 归档 r{N} 过程产物到 _archive-r{N}/, 根只留最新答案
② 否, 留根 (说明哪里没达预期 — 可能要开 r{N+1} 修正)
```

Wait for user input. Do not act on ① without explicit user choice.

**Why user-gated, not auto-archive on retro write**: archiving is irreversible visual context loss. The user is the only one who can say "this round delivered what I expected" — main agent must NOT infer round-closure from "all checks passed" (user satisfaction ≠ tool-verified completion).

### On ① — archive

Two-commit pattern (per project CLAUDE.md convention so any wrong move is `git revert`-able):

```bash
# 1. snapshot
git add goal-docs/ && git commit -m "docs(goal-docs): snapshot before r{N} archive"

# 2. compute keep set (latest persona/DoD/goal-tree/true-goal/retro + per-dim latest design.md + goal-level meta), then mv everything else born in r{N} into _archive-r{N}/
mkdir -p goal-docs/_archive-r{N}
git mv <enumerated non-keep files born in r{N}> goal-docs/_archive-r{N}/
git commit -m "chore(goal-docs): archive r{N} process; root = latest answer per artifact"
```

The per-dim "find non-latest design.md" step requires per-dim iteration (can't be a single glob):

```
for each dim D appearing in goal-docs/0X-{dim}-r{*}-{iter}-design.md:
  keep = max-r{N}, max-iter within that round  →  STAYS at root
  all others  →  git mv into _archive-r{birth_round}/
```

### Backfill mode

If `_archive-r*/` doesn't exist for any of r1..r{N-1} (existing project with N closed rounds never archived — the typical state when this step is introduced to a long-running project), the gate's first run is a backfill. Iterate rounds in order (r1, r2, …, r{LATEST}), running the same partitioning per round. Latest round retains the per-dim latest design.md + round-anchor docs at root; earlier rounds typically contribute zero files to root (because their everything has been superseded), unless a dim was last touched in that round and never re-touched.

### On ② — don't archive

Treat "没达预期" as a Step 0a iteration trigger. Route through scope Agent — surface is most likely 修正 (build didn't match design) or 画像变更 (persona was off). Do NOT archive a round the user isn't satisfied with, even if every Step 3.5 / 3.7 PASSED.

### Why iteration mode still works post-archive

- **Step 0a "Find current state of a dim"** is now trivial — root has at most ONE design.md per dim, just read it.
- **Step 6 iteration mode** reads inheritance from `_archive-r{N-1}/90-validation-plan-r{N-1}-resolved.md` — paths are deterministic from round number, no glob walking needed.
- **Step 0a 修正 routing** ("why did we decide X for dim D in r{N-2}?"): scope Agent reads `_archive-r{N-2}/0X-{D}-r{N-2}-{iter}-design.md` directly when archeology is needed. Archived files are *queryable when needed, invisible when not*.

### Anti-patterns

- **Auto-archiving on retro write without user gate** — saves a round-trip but loses the only signal distinguishing "delivered" from "delivered the wrong thing." A round where every Step 3.5/3.7 PASSED but the user says "we shipped, but it's not what I wanted" must trigger r{N+1}, not archive.
- **Keeping audit trail at root** *(the 9th-iter mistake)* — root drowns in receipts. "What does this project look like now?" becomes unanswerable by `ls goal-docs/`. Receipts belong in archive.
- **Moving the LATEST design.md of a dim to archive because "the round closed"** — a dim's design.md is the latest converged answer for that dim regardless of which round produced it. A dim untouched since r1 keeps its r1 design.md at root. The "round" doesn't own design.md; the *dim* does.
- **Round-anchor mismatch** — archiving the latest `00-用户画像-r{N}.md` because "we already wrote r{N+1}", but `00-用户画像-r{N+1}.md` doesn't exist yet (Step 0a's 画像变更 branch requires user-approved persona regen). If no r{N+1} persona exists, r{N} persona IS the latest and stays at root.
- **Archiving candidate-sample PNGs into a "kept" assets directory** — candidate PNGs in `0X-{dim}-r{N}-{iter}-design-samples/` are most ephemeral; the final pick is preserved in `*-design.md` + the actual rendered artifact. Elevating them to a persistent `_assets/` confuses them with validation-evidence PNGs (which also go to archive, just under their birth round).

## Anti-patterns to avoid

These are the specific behaviors this skill exists to suppress. Each is annotated with where it comes from.

- **"Let me first ask a few questions to clarify..."** → No. Use priors. Ask only if the modal shape is genuinely <40% likely. *(Seed conversation, Turn 7 failure mode.)*
- **"There are several approaches: A, B, and C..."** → No. Pick one. The user came for a recommendation, not a menu. *(Connects to Amazon Science's finding `[Gozluklu 2024]` that excessive decomposition produces flat, low-insight outputs.)*
- **"For a robust production system you'd want..."** when the user said "网站" casually → No. That's ignoring the prior. *(Seed conversation, Turn 3 — full Kubernetes proposal for a weekend project.)*
- **Listing every technology in a category** ("you could use Redis, RabbitMQ, NATS, Kafka...") → No. Pick the one that fits the modal shape.
- **Enumerating edge cases before the happy path works** → No. Happy path first, edge cases on demand. *(Standard YAGNI, but doubly important for AI-generated designs.)*
- **Adding layers "in case you scale"** → No. YAGNI applies harder to AI-generated designs than to human ones, because AI has no skin in the game and defaults to maximum coverage.
- **Pretending you don't have an opinion** → No. The whole point is that you do, based on priors. Hiding it behind "it depends" is offloading work to the user. *(Scope: this applies to Step 1.a shape/intent prior-weighting where you DO have a strong prior. NOT to Step 1.b true_goal interpretation where the rule is the opposite — fabricating a deeper reading without signal is its own anti-pattern. Step 1.a "have an opinion when priors point clearly" and Step 1.b "skip if no signal" coexist; pick the right one by which step you're in.)*
- **Walking the dimensions but giving generic answers in each cell** → No. If your "UI 风格" answer for a teaching website would read identically on a SaaS dashboard, you forgot to let intent flow through. The dimensions are stable; the answers must be intent-conditioned. *(2nd iteration of this skill — see Appendix B.)*
- **Persona doc that's just demographics, no roleplay-able content** → No. "大二学生，beginner" can't roleplay; it produces generic UX wishes. Persona must include 审美参考 (具体产品/视频/工具) so it can say things like "我希望像 desmos 那样实时". *(3rd iteration — see Appendix C.)*
- **Letting design Agent speak first per dimension** → No. Persona-first is non-negotiable. Design-first reduces persona to a critic and lets design's frame survive uncontested. *(3rd iteration.)*
- **Using SendMessage to keep persona/design Agents alive across dimensions** → No. Long-lived agents accumulate the same drift we're trying to escape. Each Agent call must be fresh; persistence lives in `goal-docs/`, not chat. *(3rd iteration.)*
- **Design doc that pastes persona's brief at the top but doesn't actually respond to it item-by-item** → No. Each `@design`-tagged item in the brief must get an explicit "addressed by …" or "rejected because …" in the design doc. Lip service to persona = no alignment.
- **Main agent skipping the persona reaction step because "the design draft looks fine"** → No. The reaction Agent (step 3, async sonnet) is **not optional and not pre-judgeable**. The whole point is that *persona*, not main agent, decides whether the draft is OK. Skipping it observed in session 7c661804 — main agent ran 4 dimensions × 2 turns and called it done; round 2 reactions never fired, so "反复对齐" silently collapsed. *(See Appendix C addendum.)*
- **Main agent self-scoring the artifact ("I rate this 95/100", "looks good to me") instead of running the validation-fix loop** → No. The score must come from the validation Agent (Step 3b) reading actual artifacts via tools (screenshot, lighthouse, etc.), not from the main agent's introspection. In session 7c661804 the user said "评价修复直到 90 分以上"; main agent declared a high score in conversation but never opened the browser, so the actual layout bug ("canvas 位置左偏") survived intact. *(5th iteration — see Appendix E.)*
- **Generating a validation plan whose checks can't be traced to the persona or design docs** → No. Every check entry has a `trace` field for a reason: it forces the plan Agent to derive checks from what was promised, not invent them from generic QA wisdom. Untraceable checks = the plan Agent papering over weak coverage with plausible-sounding extras.
- **Skipping fix-attempt documentation** → No. `92-fix-attempt-N.md` must record what changed, why, and which other checks the change affects. Without it, the next validation iteration can't re-check the right things, and structural fixes that broke unrelated checks go unnoticed.
- **Iteration mode: running cold-start protocol on a project that already has goal-docs/** → No. Step 0 detection is the first thing — if `goal-docs/00-用户画像-r{N}.md` exists, the persona is already set; running Step 1 prior weighting + Step 1.5 persona regen produces a duplicate persona and wastes Agent calls. Read first, then route through Step 0a. *(6th iteration — see Appendix F.)*
- **Iteration mode: auto-rewriting `00-用户画像-r{N+1}.md` because the user's request implies a different audience** → No. Persona changes invalidate every dimension's premises; the scope Agent must surface this to the user, not act on it. The user decides whether to redo all dims or scope down.
- **Iteration validation: claiming "inherited checks all still pass" without actually running tools** → No. The whole point of Step 3 was to ground "score" in tool output. Re-verifying inherited checks via tools (and writing one-liner per still-pass) is fine; *skipping* the runs and claiming pass collapses back to the same self-reporting failure as Appendix E.
- **Iteration: a 修正 (corrective) request triggering full Step 2 doc-relay** → No. The design didn't change; only the implementation needs to catch up. Add a new check entry to the round's plan with `trace` quoting the user's verbatim words, then run the fix loop. Don't waste persona/design Agents on a bug fix.
- **Running enumerate Step 2-E protocol on a sample-track dim** (UI / 视觉 / 排版 / 文案 tone / 品牌调性) → No. Text-only doc-relay on a sample-track dim is the catastrophic mode HISTORY.md Appendix G traces (tranfu-site r1→r3): 3 rounds × 4 dims of text relay produced a 51-check plan with 49/51 pass and a rendered home page that still felt 1999. Track classification (Step 1.6) is mandatory before Step 2; if a UI dim's protocol is text-only with no PNG candidates in `0X-UI-r{N}-1-design-samples/`, the protocol was wrong. Restart at Step 2-S. *(7th iteration — see Appendix G.)*
- **Persona-reaction signing without viewing rendered PNGs** (sample-track) → No. The reaction Agent MUST Read the chosen candidate PNG and include a "看了样本之后：" section anchored to specific visual elements. A reaction text that paraphrases design.md without referencing pixels has not seen the design — it has seen a description of the design, which is exactly the failure 2-S exists to prevent. Re-spawn the reaction Agent with a stricter prompt before continuing. *(7th iteration.)*
- **Declaring a sample-track dim done on atomic-check pass alone (no blind-compare)** → No. Atomic property checks on sample-track dims are guardrails, not sufficient conditions. tranfu r3 had 49/51 atomic pass and the rendered page kept `[全部][踩坑][养成]` plain bracket text — atomic checks measured projections of the design intent, never the gestalt. The plan MUST contain ≥1 critical `type: blind-compare` check per sample-track dim; absence = plan incomplete = regenerate plan. *(7th iteration.)*
- **Persona's `审美参考` storing only product names without local screenshot paths** → No. Product names are *references to* samples, not samples themselves. Downstream sample-track design Agents reading "shadcn/ui" go through "name → imagined visual → generated visual" — two layers of lossy decode. Without local screenshots in `goal-docs/_refs/`, the validation Agent's blind-compare check has nothing to compare against. The persona doc fails its own Step 1.5 audit and the protocol cannot proceed on sample-track dims. *(7th iteration.)*
- **Treating `user_goal原话` as immutable ground truth without considering 1-layer underlying interpretation** → No. AI is better than humans at pattern-matching "what is this user actually trying to do" — refusing to consider a 1-layer-deeper read regresses to transcription. Run Step 1.b: write `user_goal_surface.md` (字面, 只读), propose underlying interpretation if signal exists, gate on user. The whole point of Step 1.b is that AI proposes a more useful read; not proposing one when signal exists silently underuses the AI's prior. *(8th iteration — see Appendix H.)*
- **Reinterpreting the goal silently — i.e., AI rewrites without USER GATE** → No. The asymmetry of Step 1.b is "AI proposes, user disposes." Silently shifting from `user_goal_surface` to a deeper interpretation without surfacing the proposed adjustment to the user is the failure mode this gate exists to prevent. If you find yourself committing to a reinterpretation without a recorded user choice in `00-true-goal-r{N}.md`, you skipped the gate — bounce back. *(8th iteration.)*
- **Reinterpreting the goal more than 1 layer deeper** → No. "学蒙卡 → 学概率 → 提升数理能力 → 实现财务自由" is the failure mode of recursive depth. The HARD CAP is 1 layer — count a layer as "deeper" only if it produces a *concrete executable adjustment*. If the next layer down doesn't change what gets built, you've passed useful depth — stop. Architecting away the user's concrete request is worse than transcription. *(8th iteration.)*
- **Per-dim parallel without slice gates** → No. Running all dims of one round across all phases ("design 功能 for the whole project, then design UI for the whole project, then 技术, then 部署, then build everything, then validate") is the per-dim-first failure mode. Drift compounds invisibly because each dim individually looks consistent. Step 1.7's thin-slice rule is mandatory: slice 1 = thinnest end-to-end path through ALL dims. The cumulative `[全部][踩坑][养成]` failure of HISTORY Appendix G is the per-dim-first failure mode in disguise. *(8th iteration.)*
- **Skipping `§implicit-decisions` in `40-build-plan-{dim}-r{N}.md`** → No. Every design.md leaves judgment calls underspecified — primitives, spacing scale, layout grid, error paths, default values. If those judgments don't surface in `§implicit-decisions`, they default to the model's untouched prior, which for UI defaults to "1999 PG-essays 裸 HTML" (per the saved-memory anti-pattern). Build-plans without `§implicit-decisions` are translating without surfacing — the entire point of Step 2.5. Regenerate the plan if the section is missing or empty. *(8th iteration.)*

## When the skill does NOT apply

- **User explicitly asks for a survey or comparison** ("compare X vs Y", "what are my options for...") → Then enumerate.
- **High-stakes irreversible decisions** (medical, legal, security architecture for real production) → Then surface the uncertainty explicitly. Priors aren't enough when being wrong is expensive.
- **The modal shape genuinely has <40% probability** (truly ambiguous goal where the top two candidates are close) → Then a single targeted question is cheaper than guessing wrong twice. *(40% is a heuristic threshold, not from a paper; it's the rough point at which expected cost of one clarifying question < expected cost of regenerating after a wrong commitment.)*
- **User has already committed to constraints** that contradict the modal shape → Honor their constraints, don't override with priors.

## A self-test before responding

Before sending any response to a goal-shaped request, check:

1. Did I name (silently, in reasoning) the modal shape and 1–2 alternatives?
2. Is my answer committed to one shape, or am I hedging across all of them?
3. Am I answering at the leaf (concrete solution) or the root (architectural survey)?
4. If I'm about to ask the user a question, is it because the modal shape is genuinely <40% likely — or am I just offloading judgment?
5. Would this answer change meaningfully if the user said "I'm a solo dev doing this for fun"? If yes, my prior was probably wrong — the casual register was already evidence of that.
6. For each dimension I covered, would my answer read identically if the intent were a different one (e.g., internal tool instead of teaching)? If yes, intent didn't actually flow through — the answer is generic and needs to be re-conditioned.
7. Could a fresh Agent reading only `00-用户画像.md` reproduce the persona's voice consistently? If multiple wildly different personas could match the doc, it's too thin — especially if 审美参考 is missing.
8. Did persona Agent speak first per dimension, with at least one *external reference* (a specific product/video/tool) and one *concrete wish*? If the brief reads like generic UX advice, the persona doc didn't seed it well enough.
9. Does each design doc explicitly address the persona's bullets item-by-item (accept / compromise / reject with reason)? If the persona's brief got pasted at the top and ignored in the body, the dialogue was theatrical, not real.
10. Did I spawn the **persona-reaction Agent (async, sonnet, run_in_background=true)** for every dimension that produced a design draft? Count: number of design drafts == number of reaction docs. If I decided to skip a reaction because "this draft looks fine," I made the persona-eats-its-own-words mistake — the reaction Agent's existence is what creates the audit trail of alignment. Skipping it = no reaction = no audit = silent collapse back into in-conversation lip service.
11. After building the artifact, did I run **Step 3 validation-fix loop**? Concretely: do `goal-docs/90-validation-plan.md` and at least one `91-validation-run-N.md` exist? If I told the user "looks good, score X" without these files existing, I fabricated the score. The plan and run docs are the audit trail; without them, the score is hallucinated.
12. Does the validation plan have `severity` and `trace` on every check? Untraced checks are invented requirements; checks without severity can't drive the loop's exit decision.
13. (iteration mode) Did Step 0 fire? I.e., before doing anything, did I check whether `goal-docs/` already exists and route through Step 0a if so? If I just ran cold-start protocol on an existing project, I duplicated the persona and re-ran dimensions that didn't need re-running.
14. (iteration mode) Did the scope Agent run before any dimension Agents? The path is: read state → scope Agent → `UPDATE-r{N}-scope.md` → only then spawn doc-relay or fix Agents. If scope Agent never ran, main agent guessed which dims to touch — that's the failure mode this guard is for.
15. (iteration validation) For inherited checks marked "still pass", was the verification actually run with tools, or did I just write "all pass" without screenshots/bash output? The latter is the same self-reporting failure as Appendix E, just hidden inside an iteration.
16. (iteration mode) Did `CHANGELOG.md` get a new entry for this round? If not, the audit trail of "what triggered this round, what was its scope" is missing — future iterations won't know what came before.
17. (track) Did Step 1.6 fire? I.e., did I label each dim's track (enumerate / sample) in `STATE.md §Tracks` (cold-start) or in `UPDATE-r{N}-scope.md` (iteration)? If a UI / 视觉 / 文案 tone dim is unlabeled, default-to-enumerate is the failure mode HISTORY.md Appendix G traces.
18. (sample-track) For every sample-track dim, does `0X-{dim}-r{N}-1-design-samples/` exist on disk and contain ≥ 1 candidate `.html` + rendered `.png`? If design.md exists alone with no PNGs, the design Agent collapsed to text-only — re-spawn with a stricter prompt that requires PNG outputs.
19. (sample-track) Does each sample-track dim's reaction doc contain a "看了样本之后：" section anchored to specific visual elements (color values / element positions / visible deviations from hero/anti refs)? Reactions that paraphrase design.md without referencing pixels failed to read the PNG — re-spawn the reaction Agent.
20. (sample-track) For every sample-track dim listed in Step 1.6, does the validation plan contain ≥ 1 `type: blind-compare` check with `severity: critical`? Atomic-only plans on sample-track dims are the tranfu r3 failure (49/51 atomic pass + felt-1999); regenerate the plan if missing.
21. (sample-track validation) Did the validation Agent spawn a fresh sonnet judge for each blind-compare check (not score it itself)? Did the judge see only the screenshots, not the design docs / persona text? Self-judging by the validation Agent collapses the "fresh Agent reading evidence" property the same way self-scoring did pre-Step-3.
22. *(8th iter)* Did Step 1.b fire? Concretely: do `goal-docs/user_goal_surface.md` AND `goal-docs/00-true-goal-r{N}.md` both exist? If they're identical content, is there an explicit note in `00-true-goal-r{N}.md` explaining either (a) user rejected the proposal, OR (b) AI had no signal for a deeper interpretation? If `user_goal_surface.md` doesn't exist, Step 1.b was skipped — restart from there.
23. *(8th iter)* Does `20-goal-tree-r{N}.md` exist with at least one slice marked `◀ thin slice (end-to-end, all dims)`? Does `STATE.md` (or equivalent) identify which slice is currently being executed? If the first slice doesn't touch all dims of the entity (功能 + UI + 技术 + 部署 for a website), the thin-slice rule was violated — regenerate the goal tree.
24. *(8th iter)* For each dim built in the current slice, does `40-build-plan-{dim}-r{N}.md` exist with a populated `§implicit-decisions` section listing ≥ 2 entries? Empty `§implicit-decisions` = the build-plan Agent hand-waved through the judgment calls. Re-spawn with a stricter prompt requiring explicit candidates per implicit decision.
25. *(8th iter)* Did Step 3.5 milestone gate fire (with all four answers — Q①②③ + surface-mirror — recorded in `30-milestone-gate-{slice-id}-r{N}.md`) before declaring the slice done? If the gate doc doesn't exist or is missing the surface-mirror check, you skipped the gate — slice cannot advance.
26. *(8th iter)* At project close, does `99-retro-r{N}.md` exist with the required sections (drift-incidents / new-anti-refs / new-hero-refs / persona-doc-revisions / prior-recalibration / build-plan-§implicit-decisions-frequent), AND were §new-anti-refs / §new-hero-refs actually applied to `00-用户画像-r{N+1}.md`'s `审美参考` block? Retro that doesn't update the persona is a journal entry, not a feedback loop.

If any of these fail, regenerate before sending.

## Why this works

**The math** `[Gozluklu 2024]`: decomposition cost grows as `O(n) + O(k^m)`. For small `k` it's free; for large `k` it's catastrophic. Premature decomposition pays the catastrophic cost on every request, regardless of whether decomposition was needed.

**The intuition**: a 1-sentence goal contains far more information than it appears to, because human language carries strong conventions about what kind of thing is being described. "Website" doesn't mean "any web-accessible system" — it means the modal thing that word refers to in the speaker's likely context. LLMs that ignore this convention waste enormous effort planning for the long tail. *(This is the same argument as `[Gonzalez-Pumariega et al. 2024]`'s point about LLM priors being what makes planning tractable, applied at the level of natural language understanding.)*

**The user experience**: people who know what they want feel heard when you commit; they feel interrogated when you ask. People who don't know what they want benefit from seeing a committed answer because it gives them something concrete to react to — which is faster than answering abstract questions about requirements they haven't thought through yet.

**Why two tracks (sample-track epistemology)**: enumerate-track works because functional / technical / config specs **compress losslessly into text** — every step in the doc-relay (brief → design → impl → validation) preserves the spec. Sample-track exists because visual / experiential specs do **not** compress losslessly into text — every text encoding step strips holistic information that the next decoder cannot reconstruct, and atomic property checks (`borderRadius == 6px ∧ surface tier ≥ 2 ∧ ...`) are *consequences* of the gestalt, never tests of it. The fix is to keep the artifact in its native medium (pixels) at every step where loss matters: design Agent's output is a PNG (not text describing a PNG); persona-reaction reads the PNG (not a paraphrase); validation's primary check is a fresh judge comparing pixels against ref pixels (not a property checklist). Skill operates in the medium of the spec — text where text suffices, pixels where pixels are the spec. The 7th iteration (HISTORY Appendix G) is the first to recognize that prior iterations were applying text-medium epistemology uniformly across both spec forms, which works for the half that's text-compressible and silently fails for the half that isn't.

**Why six feedback loops at increasing distance from build** *(8th iter / Appendix H)*: the protocol now has alignment checks at six points, ranked by earliness from cheapest to most expensive: Step 2.5(a) align-check (translation begin) < Step 2.5(c) plan-react (build start) < Step 2.5(d) hero render (first pixel) < Step 3 validate (slice end) < Step 3.5 milestone gate (cross-slice) < Step 7 retro (cross-project). The same "像 anti 吗?" rubric runs at four of these (2.5c, 2.5d, 3, 3.5). Drift detected at 2.5(a) costs one Agent call to fix; drift detected only at Step 3 means the slice's build cost is sunk; drift detected only at Step 7 means the whole project's lessons are encoded as anti-refs for next time but THIS project shipped wrong. Earlier checks cost more Agent calls per project but vastly less rework, because rework grows superlinearly through committed downstream decisions. Pre-H the protocol terminated at Step 3 (validate); H's contribution is the four loops at distances < and > Step 3, each catching what its predecessor mathematically cannot.

**Why "1-layer-deeper interpretation under USER GATE" embeds the right asymmetry** *(8th iter / Appendix H)*: AI is *better* than humans at pattern-matching "what is this user actually trying to do" — it has seen thousands of similar requests and can recognize that "做蒙特卡洛案例演示网站" almost always wants "学懂蒙卡" underneath. AI is *worse* than humans at deciding "is that actually what I want" — only the user can know whether the underlying read serves their actual purpose. So AI proposes, user disposes. Strictly capping at 1 layer prevents the proposal from architecting away the concrete request entirely (the failure mode of unbounded "what do you really really want"). Strictly requiring USER GATE prevents silent reinterpretation (the failure mode of "AI knows best"). The combination — propose freely, decide gated, cap depth — uses each party's strength while bounded by their weakness. Pre-H the protocol treated user_goal原话 as immutable, which silently underused AI's prior; H's contribution is making the prior usable without surrendering user authority.

## One-line summary

**Default to the modal answer. Decompose only when reality forces you to.**

---

## References

**Academic sources**

- **`[Prasad et al. 2024, ADaPT]`** — Archiki Prasad, Alexander Koller, Mareike Hartmann, Peter Clark, Ashish Sabharwal, Mohit Bansal, Tushar Khot. *ADaPT: As-Needed Decomposition and Planning with Language Models.* Findings of NAACL 2024, pp. 4226–4252. UNC Chapel Hill + Allen Institute for AI + Saarland University.
  - Paper: https://aclanthology.org/2024.findings-naacl.264/
  - arXiv: https://arxiv.org/abs/2311.05772
  - Code: https://github.com/archiki/ADaPT
  - **Why cited here**: Closest direct precedent for the algorithm. Their key result — recursive decomposition only when execution fails beats plan-and-execute by 27–33 points on three benchmarks — is the empirical evidence that "as-needed" beats "eager." This skill extends their idea from action-level execution to design-level conversation.

- **`[Gonzalez-Pumariega et al. 2024]`** — *Query-Efficient Planning with Language Models.*
  - arXiv: https://arxiv.org/abs/2412.06162
  - **Why cited here**: Establishes that the value of LLMs in planning comes from their *prior* — their ability to identify promising states without exhaustive search. This is the theoretical foundation for Step 1 (prior weighting).

**Industry sources**

- **`[Gozluklu 2024, Amazon Science]`** — Burak Gozluklu, *How task decomposition and smaller LLMs can make AI more affordable.* Amazon Science Blog, September 2024.
  - URL: https://www.amazon.science/blog/how-task-decomposition-and-smaller-llms-can-make-ai-more-affordable
  - **Why cited here**: Provides the cost model `O(n) + O(k^m)` showing why over-decomposition catastrophically fails, and explicitly names "the trap of overengineering" — including the warning that excessive decomposition loses holistic insight. Most accessible single source for the core failure mode this skill addresses.

**Adjacent reading (not directly cited but useful context)**

- ReAcTree (2025): Hierarchical agent trees that grow dynamically — https://arxiv.org/pdf/2511.02424
- SelfGoal (2024): GoalTree that updates as the agent interacts with the environment — https://arxiv.org/pdf/2406.04784
- HiPlan (2025): Combines high-level planning with step-wise adaptation — https://arxiv.org/pdf/2508.19076
- LangChain, *The Anatomy of an Agent Harness* — https://blog.langchain.com/the-anatomy-of-an-agent-harness/

---

## Iteration history

See [HISTORY.md](HISTORY.md) for the failure traces (Appendices A–H) behind each rule. Load only when proposing a change to a rule or debugging why a rule exists — not needed at execution time. Most recent: **Appendix H** (8th iteration, 2026-05-08, same-day continuation of G's discussion) adds the WHEN axis (Step 1.7 goal tree + slice loop), execution-layer review (Step 2.5 role-anchored build-plan with `§implicit-decisions`), per-slice gates (Step 3.5 milestone gate + Step 3.7 acceptance walkthrough on real artifact), goal-interpretation gate (Step 1.b 1-layer-deeper proposal under USER GATE), and project-to-project learning loop (Step 7 retro). Reference flow diagram lives at `goal-docs/methodology-flow-r1.md` (in the project this skill was iterated against).
