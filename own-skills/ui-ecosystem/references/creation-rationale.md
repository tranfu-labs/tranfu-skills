# UI Ecosystem Creation Rationale

Read this file only when auditing, maintaining, or improving `ui-ecosystem`. Normal task execution MUST use `SKILL.md` and `references/ecosystem-map.md`.

## Content Fit

Conclusion: pass

- Repeatable: frontend builds, redesigns, dashboards, landing pages, component work, and visual polish repeatedly need stack-matched ecosystem support.
- Trigger: "ui 根据前端选型推荐 mcp/plugin/skill", "do not hand-roll frontend", "recommend ecosystem tools after frontend selection", "improve frontend beauty", "use the chosen ecosystem".
- Workflow: inspect frontend choices, map stack to tools, install or activate tools, use official examples and mature components, verify rendered UI.
- Executable: use tool discovery, package/docs lookup, repo inspection, official examples, package managers, browser screenshots, and existing skills.
- Verifiable: report selected tools, installed dependencies or activated skills, files changed, screenshots or browser checks, and commands run.
- Boundary: do not run before product/stack direction exists; do not use tools that fight project constraints; do not copy licensed code without review.

## Domain Framing

Candidate scoring:

| Rank | Candidate | Axis | Total | Result Fit | Boundary Clarity | Path Layering | Comment |
|---|---|---|---:|---:|---:|---:|---|
| 1 | ui-ecosystem | user-result axis | 6 | 2 | 2 | 2 | Short memorable UI-prefixed name for the desired result: stack-matched ecosystem support for better UI, with clear include/exclude and author/verify/troubleshoot layers. |
| 2 | frontend-mcp-plugin-recommendation | implementation-object axis | 4 | 1 | 1 | 2 | Useful but too focused on MCP/plugin objects, missing component libraries, official examples, skills, and design systems. |
| 3 | frontend-code-generation-quality-gate | repeat-task axis | 3 | 1 | 1 | 1 | Captures quality control but can trigger too late, after the UI was already hand-rolled. |
| 4 | design-tooling-installation | platform/tool axis | 2 | 0 | 1 | 1 | Over-centers installation rather than using tools to improve user-visible frontend quality. |

Top1: ui-ecosystem
Top1-Top2 分差: 2
用户指定候选: 无

Scope:
- Include: frontend UI creation, redesign, visual polish, component implementation, design-system adoption, stack-matched MCP/plugin/skill/tool selection, dependency adoption, and official example absorption after frontend direction is known.
- Exclude: early strategy/stack selection with no frontend direction, backend-only tasks, one-off package documentation lookup, pure CSS bug fixes, prompt-only UI critique, wholesale template cloning, and license-sensitive code copying.
- Placement: this skill's source lesson belongs in the main workflow, tool-selection checklist, verification checklist, and bad examples.

Path layering:
- Normal path: identify existing frontend choices, discover ecosystem tools, select adopt/absorb/reject actions, install/activate only approved tools, and use them in the implementation.
- Verification path: prove the chosen tools were actually used and the UI renders well through deterministic checks plus browser or screenshot review when applicable.
- Troubleshooting path: if no compatible tool exists or a tool fails, document the failure, fall back to official docs/examples or current project patterns, and mark unverified items.

## Improvement Audit Notes

A company skill improvement audit was performed to check trigger behavior, workflow completeness, output contract, context efficiency, and marketplace readiness.

Changes from the audit:

- Move creation evidence out of `SKILL.md` into this reference to reduce context cost.
- Add nearby skill routing to avoid trigger conflicts.
- Add trigger tests for activation reliability.
- Add Definition Of Done for recommendation and implementation modes.
