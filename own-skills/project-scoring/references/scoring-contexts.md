# Scoring Contexts and Weight Profiles

The scoring framework must first identify the project context. Do not apply one commercial-product weight table to every idea.

## Supported Contexts

| Context | Use When | Decision Meaning |
|---|---|---|
| `commercial_product` | The project seeks external users, revenue, or market validation. | Should this become a product or MVP? |
| `internal_initiative` | The project is proposed inside a company/team to improve work, create reusable capability, or support internal decision making. | Should the team invest internal time now? |
| `tranfu_skill` | The project is mainly a reusable Codex/agent skill, workflow template, demo asset, or co-creation method asset. | Should this become a Tranfu skill asset? |
| `public_demo` | The project is primarily an external demo, story, or public learning artifact. | Is it worth building as a visible demo or case? |
| `research_probe` | The project is exploratory and evidence is intentionally thin. | Is it worth a small learning experiment? |

Ask for the context when it is unclear. If the user says the project is an internal company initiative, Tranfu skill, demo asset, method asset, or research probe, do not penalize it heavily for unclear payment or business model.

## Weight Profiles

Weights sum to 100. Use the default profile only when the context is unknown.

| Dimension | Default / Commercial | Internal Initiative | Tranfu Skill | Public Demo | Research Probe |
|---|---:|---:|---:|---:|---:|
| Demand reality | 16 | 20 | 18 | 16 | 18 |
| AI workflow fit | 12 | 16 | 16 | 14 | 14 |
| Technical feasibility | 10 | 14 | 12 | 12 | 10 |
| Validation feasibility | 10 | 10 | 10 | 10 | 16 |
| Distribution reachability | 10 | 6 | 6 | 10 | 6 |
| Business/value recovery | 10 | 4 | 4 | 4 | 2 |
| Reuse and retention | 8 | 12 | 14 | 10 | 10 |
| Cost structure | 8 | 6 | 6 | 6 | 8 |
| Risk and responsibility | 8 | 6 | 6 | 8 | 8 |
| Tranfu fit | 8 | 6 | 8 | 10 | 8 |

For internal, Tranfu-skill, public-demo, and research-probe contexts, reinterpret `Business/value recovery` as internal or asset value:

- saved team time
- reusable skill or template value
- method asset value
- colleague/agent enablement
- decision quality improvement
- case value for future co-creation
- learning value from a bounded experiment

## Limited-Information Policy

Internal initiatives, skill ideas, demo assets, and research probes often begin without customer data, payment evidence, or large samples. Lack of data should not automatically mean the project is weak.

Separate three concepts:

1. **Project quality score**: how strong the idea appears from known facts.
2. **Information completeness**: how much of the score is based on known facts rather than assumptions.
3. **Decision confidence**: how far the team can safely go now.

For limited information:

- Missing facts lower confidence and cap the maximum status.
- Missing facts should not be silently scored as 50.
- Strong known facts can support `先验证` or `小步立项` when the context is internal or skill-first and the next step is small.
- Direct `立即立项` still requires high evidence, clear responsibility boundary, and concrete execution path.

## Context-Specific Status Guidance

### Internal Initiative

Use `小步立项` when demand, AI fit, technical feasibility, and reuse value are strong, even if payment evidence is absent, provided the MVP scope is small.

Use `先验证` when the idea is plausible but the first user/source, real samples, or responsibility boundary remains unclear.

### Tranfu Skill

Use `小步立项` when the project can become a reusable skill/workflow with clear trigger conditions, inputs, outputs, boundaries, and examples.

Use `先验证` when the method seems valuable but needs one or two calibrated examples before becoming a shared skill.

### Public Demo

Use `小步立项` when the demo has a concrete user scene, strong narrative value, bounded implementation scope, and clear public case value.

Use `先验证` when the demo idea is visible and shareable but still needs narrower positioning, sample material, or a clearer audience.

### Research Probe

Use `先验证` when the unknown is important and can be tested with a small, time-boxed experiment.

Use `观察入池` when the learning value exists but the first experiment, sample source, or decision use is unclear.

### Commercial Product

Payment, distribution, and market evidence matter more. Do not upgrade a commercial product based only on internal enthusiasm.
