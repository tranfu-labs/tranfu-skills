---
name: strategy-first-development
description: >
  复杂开发前的战略/产品形态/技术选型门禁。Always trigger for: 多页面 web app、AI 产品、前后端系统、provider/deployment 选择、架构升级、复杂 MVP 或用户需求模糊但准备开发的任务。Also trigger for: 用户要求先定战略目标、项目形态、产品形态、预期体验/截图、GitHub 成熟项目、技术栈、模块、工作流程, 或要求避免重复造轮子。Do NOT trigger when: 创建/更新/审查 skill 的元任务、单行命令、小文案、翻译、已明确范围的 bug 修复、纯代码 review、仅安装/部署已有项目且无需重选产品技术路线。
version: 0.1.0
author: griffithkk3-del
updated_at: 2026-06-12
origin: own
---

# Strategy First Development

Use this skill to convert a vague or high-impact product/engineering request into a strategy-led implementation plan before coding. The goal is to prevent agents from rushing into arbitrary stacks, one-off UI, duplicate infrastructure, or fragile custom logic when mature projects and frameworks already exist.

This is a development gate, not a general "summarize our experience into a skill" workflow. For skill creation, skill review, or prompt review tasks, route to the relevant skill-specific workflow instead.

## When To Use

Use this skill when the user says or implies:

- 先和 AI 多讨论战略目标、项目形态、产品形态;
- 给 agent 看预期截图, 或让 agent 生成预期页面给用户选择;
- 搜索 GitHub 成熟项目, 确定技术栈;
- 优化架构、模块、工作流程;
- 不要重复造轮子, 最后使用成熟框架;
- 启动一个复杂产品/工程项目, 但目标、体验或技术路线还不清楚。

Do not use this skill for one-line commands, small copy edits, simple translations, or already-scoped bug fixes unless the user asks to rethink strategy or architecture.

## Operating Principle

CRITICAL: This skill creates a go/no-go gate before implementation. The agent MUST NOT start coding, install dependencies, scaffold a repo, or change deployment files until the Implementation Gate is satisfied, unless the user explicitly limits the turn to a trivial already-scoped edit.

The agent MUST have enough evidence to answer:

- What strategic goal are we serving?
- What product shape are we building?
- What should the user experience look like?
- Which mature projects/frameworks already solve most of this?
- What architecture and workflow fit the chosen path?
- What will be verified before the work is called done?

If the user explicitly asks to implement immediately, still do a compressed version of this workflow unless the task is trivial or already fully specified.

## Critical Gates

- MUST keep a visible task plan. Use `update_plan` when available. If no plan tool exists, maintain a checklist in the reply and update it as phases complete.
- MUST inspect the existing repo before proposing architecture for an existing project.
- MUST search for mature projects/frameworks before choosing a stack when network access is available.
- MUST record why chosen libraries/frameworks fit and why major alternatives were rejected.
- MUST NOT hand-roll established engines such as auth, payments, charts, rich text, media processing, scheduling, search, queues, workflow orchestration, parsing, game/physics rules, or model/provider clients without a written reason.
- MUST define verification before editing and report verification results before handoff.
- NEVER claim completion from code edits alone.

## Steps

### 1. Strategy Conversation Gate

Start by discussing the intent with the user. Keep the questions few and high-leverage.

Ask for or infer:

- strategic objective: demo, internal tool, commercial MVP, research probe, automation, migration, or production system;
- target user and repeated use scene;
- success criteria and non-goals;
- acceptable cost, time, risk, and dependency boundaries;
- whether speed, quality, extensibility, compliance, or polish is the dominant constraint.

If the user's idea is blurry, do not code. First return a short strategy summary and ask one focused question or offer 2-3 concrete strategic options.

### 2. Product And Project Shape

Clarify the form before choosing technology:

- product shape: web app, CLI, backend service, plugin, workflow automation, browser extension, agent skill, dashboard, mobile app, game, data pipeline, or content artifact;
- project shape: greenfield repo, existing repo extension, proof-of-concept, production hardening, integration layer, refactor, or deployment repair;
- primary workflow: what the user sees first, what they do repeatedly, and what output they trust.

Write the chosen shape explicitly. If multiple shapes fit, compare them briefly and recommend one.

### 3. Expected Experience Before Code

Make the expected user experience visible before implementation.

Use any of these depending on context:

- ask the user for reference screenshots, design links, examples, or competitor pages;
- generate 2-3 textual UI options for the user to choose from;
- if building frontend and no reference exists, create a lightweight expected page/mockup first and ask the user to choose direction;
- for non-visual products, produce an expected CLI transcript, API contract, workflow diagram, or sample output.

Do not treat a screenshot as decoration. Extract concrete requirements from it: layout density, navigation, controls, information hierarchy, states, data shape, and visual tone.

### 4. Mature Project Search

Before inventing core technology, search for mature existing work.

When network is available:

- run 3-5 targeted searches across GitHub, package registries, official docs, and web search as appropriate;
- analyze at least 3 candidate projects/libraries when enough candidates exist;
- prefer primary sources: official docs, source repositories, release pages, package registry pages, and project issue trackers;
- include at least one "boring default" framework/library from the target ecosystem, not only trendy repos.

Evaluate candidates on:

- maturity: stars, releases, recent commits, issue health, docs quality;
- license and commercial suitability;
- framework fit and integration cost;
- whether the project solves core domain logic, UI shell, deployment, parsing, workflow, or data layer;
- risk of lock-in or abandoned dependencies.

If a mature library or framework handles the core domain well, use it. Do not hand-roll engines for established domains such as auth, payments, charts, rich text, media processing, scraping, scheduling, search, forms, queues, workflow orchestration, or game/physics rules unless there is a clear reason.

Use this comparison format:

| Candidate | Source | Maturity | Fit | Reusable Pieces | Risks | Decision |
|---|---|---|---|---|---|---|
| ... | GitHub/docs/npm/etc. | stars/releases/activity/docs | high/medium/low | modules, APIs, patterns | license, lock-in, abandoned code | adopt/reject/inspect later |

Fallbacks:

- If network is unavailable, say so explicitly and use local repo evidence, installed dependencies, lockfiles, known ecosystem defaults, and user-provided references. Mark the mature-project search as incomplete.
- If relevant repos are private, ask the user for links, screenshots, package names, or extracted file trees. Do not pretend private evidence was inspected.
- If search finds no strong candidate, state the search terms/sources tried and define the smallest custom surface needed.

### 5. Technical Stack Decision

Choose the technical stack after strategy, product shape, expected experience, and mature-project search.

Decision order:

1. follow the existing repo stack when extending a repo;
2. use official SDKs and maintained frameworks;
3. prefer boring infrastructure over bespoke glue;
4. add custom code only where the product's differentiation requires it;
5. name exit conditions for temporary adapters, mocks, or fallbacks.

Produce a short decision note:

```text
Chosen stack:
- Frontend:
- Backend:
- Data/storage:
- AI/model/provider:
- Deployment:
- Key libraries:

Why this stack:
- ...
Rejected options:
- ... because ...
```

### 6. Architecture And Workflow Plan

Design modules around product workflows, not around agent convenience.

Before editing:

- inspect the existing repo structure, scripts, docs, tests, and deployment files;
- identify canonical owners for UI, API, domain logic, provider adapters, persistence, jobs, and config;
- map data flow and error states;
- decide what should be deterministic code, what can be AI-assisted, and what needs human review;
- define verification: unit tests, type checks, build, smoke tests, browser screenshots, API calls, deployment config checks.

For frontend work, define expected screens and states before writing components. For backend work, define API contracts and failure modes before implementation. For AI/provider work, define provider boundaries and fallback behavior before adding integrations.

### 7. Compound Project Orchestration

For projects that cross frontend, backend, AI providers, data, deployment, or multiple pages:

- The main agent MUST own final decisions, the implementation plan, and the handoff.
- Read-only research or critic subagents MAY inspect GitHub projects, architecture options, UI references, or risks.
- Parallel workers MUST NOT edit the same files, config, schema, routes, or generated artifacts at the same time.
- Subagent findings MUST be merged into one recommendation with conflicts and assumptions resolved by the main agent.
- Implementation MUST wait until the main agent has accepted one coherent strategy, stack, architecture, and verification matrix.
- Split implementation into phases when one turn cannot safely cover all layers. Define phase boundaries by user workflow, not by tool convenience.

### 8. Implementation Gate

Only start coding after producing a compact plan with:

- strategic goal;
- chosen product/project shape;
- expected experience artifact or description;
- mature project/library findings;
- chosen stack and rejected alternatives;
- architecture/module plan;
- verification matrix.

The plan MUST be visible in `update_plan` or in a checklist before implementation begins. For urgent tasks, the checklist can be compressed, but it must still include strategy, search/stack, architecture, and verification.

If the task is urgent, make this plan concise, but do not skip it.

### 9. Verification And Handoff

Do not call the work done after code edits alone.

Verify in layers:

1. deterministic checks: tests, typecheck, lint, build, config render;
2. runtime checks: local server, API health, smoke workflow, browser screenshot if UI;
3. deployment checks: compose/rendered config, env template consistency, healthcheck, logs;
4. product checks: compare against expected experience and success criteria.

Final handoff must say:

- what was built or changed;
- which strategic choice it implements;
- what mature projects/frameworks were reused;
- verification commands and results;
- remaining risks, assumptions, or follow-up decisions.

## What NOT to do

Stop and reset if the agent is about to:

- code before understanding the target user or product shape;
- invent a custom framework when mature libraries exist;
- build UI without references, mockups, or expected states;
- add provider/API integrations without reading current docs or local config;
- mix unrelated refactors with product work;
- ignore deployment/runtime requirements until the end;
- claim completion without running checks.
- treat "I know a stack" as a substitute for mature-project search;
- let multiple agents independently choose incompatible stacks or edit overlapping surfaces.

## Output Template

For a new project or major feature, use this concise structure:

```markdown
**Strategic Goal**
...

**Product Shape**
...

**Expected Experience**
...

**Mature Project Findings**
- ...

**Chosen Stack**
- ...

**Architecture Plan**
- ...

**Verification Matrix**
- ...

**Next Action**
...
```

## Examples

<example>
User: 做一个高考生知道分数后准备选学校和专业的网页。

Good response shape:

```markdown
**Strategic Goal**
帮高考生和家长在出分后把"能上什么学校/专业"变成可比较、可解释、可收藏的决策流程。先做省份+分数+科类+位次驱动的选校 MVP, 不做泛教育资讯站。

**Product Shape**
多页面 web app: 输入页 → 推荐列表 → 学校/专业对比 → 志愿方案草稿。目标用户是高考生/家长, 高频动作是筛选、比较、收藏和导出。

**Expected Experience**
先给用户 2-3 个页面方向选择: 数据密集表格型、顾问问答型、志愿方案看板型。确定后再实现。

**Mature Project Findings**
| Candidate | Source | Maturity | Fit | Reusable Pieces | Risks | Decision |
|---|---|---|---|---|---|---|
| TanStack Table | official/docs/GitHub | mature | high | sortable/filterable tables | table logic only | adopt |
| Next.js | official/docs/GitHub | mature | high | routing/API/rendering | deployment choice | adopt if repo permits |
| ECharts/Recharts | docs/GitHub | mature | medium | score/rank charts | chart overload | inspect |

**Chosen Stack**
Follow existing repo if present. For greenfield: Next.js + TypeScript + TanStack Table + Postgres/Supabase if persistent accounts are needed.

**Architecture Plan**
Separate admissions data ingestion, recommendation rules, UI filters, saved plans, and export. Do not mix LLM explanation with deterministic eligibility calculations.

**Verification Matrix**
Typecheck/build, data fixture tests, recommendation rule tests, browser smoke for input→filter→save/export.

**Next Action**
Ask for target province/year/data source or proceed with mock fixture if this is only a demo.
```
</example>

<bad-example>
User: 做一个高考生知道分数后准备选学校和专业的网页。

Bad response:

```markdown
我直接用 Next.js + Tailwind 开始写。页面包括首页、推荐页、详情页。现在创建项目并实现。
```

Why bad: it skips target user/strategy, expected experience, admissions data source, mature-project search, deterministic recommendation boundary, architecture, and verification matrix.
</bad-example>

## 同类 Skill 对比

### 公司库内
- [write-spec](../write-spec/SKILL.md) — 生成 PRD/feature spec; **本 skill 区别**: 覆盖从战略对齐、参考体验、GitHub 成熟方案调研到技术栈和架构选择的开发前置流程。
- [project-scoring](../project-scoring/SKILL.md) — 评估 AI workflow 是否值得投入; **本 skill 区别**: 项目已决定推进时，用来约束 agent 如何选形态、选框架、选实现路径。
- architecture-hygiene — 审计和清理现有架构漂移; **本 skill 区别**: 在开发前防止方向和架构漂移，而不是事后清理。
- skill-create-workflow / skill-domain-framing / skill-content-fit — 创建或框定 skill; **本 skill 区别**: 不处理 skill 元任务, 只处理复杂开发前的战略/产品/技术门禁。

### 外部世界
- OpenSpec — 用规范变更管理复杂项目; **本 skill 区别**: 更偏产品/技术选型前置决策，可在进入 OpenSpec 前使用。
- Product discovery / design sprint playbooks — 帮助探索用户和方案; **本 skill 区别**: 明确要求 agent 搜索成熟 GitHub 项目并落到技术栈、模块和验证矩阵。

### 本 skill 独特价值
- 先战略, 后代码。
- 先看预期体验, 后写 UI。
- 先找成熟项目, 后定技术栈。

## 使用技巧

### 材料方案
- 最好给 1-3 张参考截图、竞品链接或期望页面描述。
- 如果没有截图, 让 agent 先生成 2-3 个预期页面方向供选择。
- 对工程项目, 同时给目标仓库、部署环境、预算和不可接受的依赖。

### 推荐用法
- 第一次交流只要求 agent 给战略选项和产品形态, 不要马上写代码。
- 技术栈选择前要求 agent 搜 GitHub 成熟项目和官方文档。
- 进入实现前要求输出验证矩阵, 并把部署检查列进去。

### 已知限制
- 不适合一行命令、小修文案、纯翻译等低风险任务。
- GitHub 调研质量依赖网络和可访问仓库, 私有领域仍需用户补充资料。
- 该 skill 不能替代用户的最终战略判断, 它负责把判断显性化。
