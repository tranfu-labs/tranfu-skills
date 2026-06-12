---
name: strategy-first-development
description: "Use when starting or rescuing an AI/software product build where the user wants development experience captured as a repeatable agent workflow: discuss strategy before coding, define product/project shape, create or compare expected UI screenshots, search GitHub for mature projects, choose proven frameworks and technical stack, optimize architecture/modules/workflow, avoid reinventing wheels, and only then implement. Trigger on requests like 总结开发经验的skill, 先确定战略目标, 产品形态, 给agent看预期截图, 生成预期页面, 搜索github成熟项目, 确定技术栈, 优化架构, 不要重复造轮子, 使用成熟框架."
version: 0.1.0
author: griffithkk3-del
updated_at: 2026-06-12
origin: own
---

# Strategy First Development

Use this skill to convert a vague product or engineering request into a strategy-led implementation plan before coding. The goal is to prevent agents from rushing into arbitrary stacks, one-off UI, duplicate infrastructure, or fragile custom logic when mature projects and frameworks already exist.

## Operating Principle

Do not start implementation until the agent has enough evidence to answer:

- What strategic goal are we serving?
- What product shape are we building?
- What should the user experience look like?
- Which mature projects/frameworks already solve most of this?
- What architecture and workflow fit the chosen path?
- What will be verified before the work is called done?

If the user explicitly asks to implement immediately, still do a compressed version of this workflow unless the task is trivial or already fully specified.

## Workflow

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

Use GitHub search, web search, package registries, official docs, or known ecosystem references as appropriate. Prefer primary sources and maintained repositories.

Evaluate candidates on:

- maturity: stars, releases, recent commits, issue health, docs quality;
- license and commercial suitability;
- framework fit and integration cost;
- whether the project solves core domain logic, UI shell, deployment, parsing, workflow, or data layer;
- risk of lock-in or abandoned dependencies.

If a mature library or framework handles the core domain well, use it. Do not hand-roll engines for established domains such as auth, payments, charts, rich text, media processing, scraping, scheduling, search, forms, queues, workflow orchestration, or game/physics rules unless there is a clear reason.

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

### 7. Implementation Gate

Only start coding after producing a compact plan with:

- strategic goal;
- chosen product/project shape;
- expected experience artifact or description;
- mature project/library findings;
- chosen stack and rejected alternatives;
- architecture/module plan;
- verification matrix.

If the task is urgent, make this plan concise, but do not skip it.

### 8. Verification And Handoff

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

## Anti-Patterns To Stop

Stop and reset if the agent is about to:

- code before understanding the target user or product shape;
- invent a custom framework when mature libraries exist;
- build UI without references, mockups, or expected states;
- add provider/API integrations without reading current docs or local config;
- mix unrelated refactors with product work;
- ignore deployment/runtime requirements until the end;
- claim completion without running checks.

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

## 同类 Skill 对比

### 公司库内
- [write-spec](../write-spec/SKILL.md) — 生成 PRD/feature spec; **本 skill 区别**: 覆盖从战略对齐、参考体验、GitHub 成熟方案调研到技术栈和架构选择的开发前置流程。
- [project-scoring](../project-scoring/SKILL.md) — 评估 AI workflow 是否值得投入; **本 skill 区别**: 项目已决定推进时，用来约束 agent 如何选形态、选框架、选实现路径。
- architecture-hygiene — 审计和清理现有架构漂移; **本 skill 区别**: 在开发前防止方向和架构漂移，而不是事后清理。

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
