---
name: product-title-generation
description: Generate concise Chinese product, feature, module, entry, or brand-short titles. Use when the user asks for 产品标题、模块命名、功能入口名、品牌化短标题、中文命名、name this feature, or product title, especially 4-6 character product-like titles from product names, feature descriptions, technical capabilities, learning services, launch platforms, observability, or mixed Chinese-English concepts. Do NOT trigger for slogans or long marketing copy -> use copywriting; SEO headlines -> use SEO/content; trademark/legal availability -> use legal review; code identifiers or variable names -> use code naming/refactor; full brand strategy -> use brand strategy.
version: "0.1.1"
author: tranfu
updated_at: "2026-06-24"
origin: own
---

# Product Title Generation

Use this skill to turn a product name, feature description, technical capability, platform module, learning service, activity theme, or mixed Chinese-English concept into compact Chinese product titles.

The output is a recommendation plus six alternatives, designed for UI entry names, module names, product cards, page section titles, or brand-like short names.

## Ownership

MUST generate short product, feature, module, entry, or brand-short titles only. MUST NOT edit files, create brand strategy, check trademark availability, write long marketing copy, or rename code identifiers. For those adjacent requests, MUST stop title generation and route using the "Do Not Use" mapping.

## Do Not Use

Route adjacent requests before generating titles:

- Slogans, taglines, ad copy, landing-page copy, or long marketing copy -> use a copywriting workflow.
- SEO page titles, keyword headlines, or search-snippet optimization -> use an SEO/content workflow.
- Trademark availability, legal clearance, naming conflicts, or registration advice -> tell the user this needs legal review.
- Code identifiers, variable names, package names, class names, or refactor naming -> use a code naming/refactor workflow.
- Full brand strategy, positioning, naming architecture, tone system, or brand book work -> use a brand strategy workflow.

## Execution

CREATE A TODO LIST FOR THE TASKS BELOW when the request is complex, contains multiple products, or requires comparing several title directions. Keep the list internal unless the user asks to see process.

1. Read the user's input. If no product, feature, concept, or direction is provided, ask one concise question for the missing target and stop.
2. Normalize the input into four fields: product object, core capability, use scenario, and desired tone. If a field is missing, infer it from the provided text without inventing unrelated positioning.
3. If the input contains multiple unrelated products, generate one "Multi-Product Output Format" block per product when each product is clear; otherwise ask the user to choose the target and stop.
4. Route the title style:
   - Learning products -> companionship, sprint, rescue, training, improvement.
   - Technical platforms -> base, platform, hub, engine, cockpit, infrastructure.
   - Data or observability products -> observation, insight, monitoring, tracing, visibility.
   - Launch or incubation products -> launch, incubation, startup, publishing, product desk.
   - Code or development products -> repository, code, understanding, navigation, insight.
   - Otherwise -> use a neutral product-entry style.
5. Generate at least eight candidate titles before choosing. Each candidate MUST preserve the core object or core capability.
6. Filter candidates with the title rules below. Remove titles that are too long, too generic, too marketing-heavy, awkwardly translated, or semantically off-target.
7. Select the recommendation using this priority order: semantic fit, product-entry feel, compactness, distinctiveness, and natural Chinese phrasing.
8. Output the exact format in "Output Format" or "Multi-Product Output Format" and end.

Failure exits:

- Empty or missing target -> ask for the product, feature, or concept and stop.
- Trademark, legal, SEO, slogan, or full-copy request -> state that this skill only generates short product titles and route it using the "Do Not Use" mapping.
- Conflict between user-requested length and this skill's 4-6 unit rule -> follow the user's explicit length requirement and mention it in the reason.

## Title Rules

- Each title MUST be compact: 4-6 Chinese characters or 4-6 display units.
- Count `AI`, `Agent`, `GitHub`, `Lab`, and meaningful numbers as one display unit each when they are necessary to preserve the source meaning.
- Prefer Chinese titles. Keep English tokens only when they are the product object, established industry wording, or explicitly requested by the user.
- The recommendation MUST NOT appear again in the alternatives.
- The alternatives list MUST contain exactly six titles.
- All titles MUST feel like real product, module, or navigation-entry names, not explanatory phrases.
- All titles MUST keep the source direction. Do not make a title sound better by changing the product category or core capability.

## Style Patterns

Use these structures first:

- Noun + noun: `代码驾驶舱`, `智能底座`
- Verb + noun: `读懂仓库`, `洞察团队`
- Adjective + noun: `智能观测层`, `极速陪练`
- Scenario + capability: `仓库洞察`, `日语冲刺`

## Avoid

WRONG: `未来之眼`, `超级平台`
Reason: too abstract; the user cannot infer product function.
GOOD: `仓库洞察`, `智能底座`

WRONG: `爆款神器`, `效率王者`
Reason: marketing-heavy and not suitable for product UI.
GOOD: `智能发布台`, `考前陪练`

WRONG: `智能基础设施给 AI Agent`
Reason: awkward translation and too long.
GOOD: `智能基建`, `智能AI底座`

WRONG: `团队异构智能体可观测平台`
Reason: explanatory phrase, not a compact product title.
GOOD: `智能观测层`, `团队观测台`

WRONG: turning "observability layer" into `协作平台`
Reason: semantic drift from observability to collaboration.
GOOD: `观测中枢`, `异构观测`

## Output Format

```markdown
推荐标题：XXXX

备选标题：
1. XXXX
2. XXXX
3. XXXX
4. XXXX
5. XXXX
6. XXXX

推荐理由：
一句话说明为什么推荐该标题，重点解释它如何贴合产品定位、核心能力或使用场景。
```

Output only this block unless the user explicitly asks for analysis, more options, or a different format.

## Multi-Product Output Format

When the input contains multiple clear products, output one repeated block per product using this exact format:

```markdown
## <product object>

推荐标题：XXXX

备选标题：
1. XXXX
2. XXXX
3. XXXX
4. XXXX
5. XXXX
6. XXXX

推荐理由：
一句话说明为什么推荐该标题，重点解释它如何贴合该产品的定位、核心能力或使用场景。
```

Output only these repeated blocks unless the user explicitly asks for analysis, more options, or a different format.

## Examples

### Example 1

Input:

```text
GitHub Learning Lab · 代码库理解驾驶舱
```

Output:

```markdown
推荐标题：代码驾驶舱

备选标题：
1. 仓库洞察
2. 读懂仓库
3. 代码领航台
4. 项目透视
5. 仓库导航
6. 代码洞察

推荐理由：
代码驾驶舱最贴合代码库理解与全局掌控的产品定位，既有开发场景感，也有平台化入口感。
```

### Example 2

Input:

```text
深大日语 · 30 日抢救陪练
```

Output:

```markdown
推荐标题：日语抢救营

备选标题：
1. 30日陪练
2. 日语冲刺
3. 考前陪练
4. 日语急救课
5. 深大日语练
6. 冲刺陪练

推荐理由：
日语抢救营更有紧迫感和陪伴感，适合短周期、强目标的学习陪练产品。
```

### Example 3

Input:

```text
Intelligence Infrastructure for AI Agent
```

Output:

```markdown
推荐标题：智能基建

备选标题：
1. AI基础台
2. 智能底座
3. 智能AI底座
4. 智能中枢
5. 智能引擎
6. Agent智能底座

推荐理由：
智能基建准确承接 Intelligence Infrastructure 的含义，简洁、有平台感，适合作为 AI Agent 底层能力标题。
```

### Example 4

Input:

```text
AI 产品发布平台 + Agent 平台
```

Output:

```markdown
推荐标题：智能发布台

备选标题：
1. AI发布台
2. Agent产品台
3. 产品孵化台
4. 智能产品台
5. 发布智能体
6. 产品启动台

推荐理由：
智能发布台同时覆盖 AI 产品发布和 Agent 平台能力，适合作为产品入口或平台模块标题。
```

### Example 5

Input:

```text
团队异构 Agent 的可观测性层
```

Output:

```markdown
推荐标题：智能观测层

备选标题：
1. Agent观测台
2. 团队观测台
3. 异构观测层
4. 协同观测
5. 智能监控台
6. 观测中枢

推荐理由：
智能观测层保留了可观测性的技术含义，同时具备更自然的产品化表达。
```
