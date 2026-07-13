---
name: ui-ecosystem
description: Use after frontend technical/design choices are complete and Codex is about to build, redesign, polish, or evaluate a UI. Trigger when the user asks UI work to recommend or use stack-matched MCPs, plugins, skills, component libraries, design systems, templates, official examples, or ecosystem tooling to improve frontend beauty and avoid hand-rolled UI. Also match Chinese requests like "ui 根据前端选型推荐 mcp/插件/skill", "前端选型完成后不要手搓", "提升前端设计效果/美观", "根据技术栈选 UI 生态". Do NOT trigger before frontend direction exists, for backend-only work, generic docs lookup, pure bug fixes, or UI review that only needs web-design-guidelines.
version: 0.1.0
author: griffithkk3-del
updated_at: 2026-07-10
origin: own
---

# UI Ecosystem

## Purpose

Use this skill to make UI implementation borrow the right frontend ecosystem instead of inventing every visual and interaction detail from scratch.

The protected result is: after frontend technical/design selection is complete, Codex must actively recommend, install when authorized, and use compatible MCPs, plugins, skills, component libraries, design systems, templates, icon sets, motion libraries, and official examples that improve UI beauty, polish, and implementation reliability.

This skill complements strategy and reference-project workflows. It does not choose the whole product strategy. It runs after enough frontend direction exists to map tools to the selected ecosystem.

For creation rationale and naming evidence, see `references/creation-rationale.md` only when auditing or evolving this skill.

## Run Modes

Choose one mode before acting:

- `recommend-only`: inspect frontend choices and produce a `UI_ECOSYSTEM_PACKET`; do not edit files or install dependencies.
- `implement-with-ecosystem`: recommend, install when authorized, and use selected ecosystem tools during frontend implementation.
- `audit-existing-ui`: inspect an existing UI and identify missing ecosystem leverage; only edit when the user asks for fixes.

If the user asks to "完善", "实现", "做页面", "改 UI", "提升美观", "不要手搓", or equivalent after frontend selection is known, default to `implement-with-ecosystem`. If the user only asks "推荐", "分析", "看看可用工具", or equivalent, default to `recommend-only`.

## Hard Rules

- MUST produce a `UI_ECOSYSTEM_PACKET` before frontend code edits or dependency installation.
- MUST inspect the current project stack before recommending tools; do not recommend from memory alone.
- MUST use `tool_search` before claiming MCP/plugin/skill availability or absence.
- MUST use current official documentation for any selected framework, UI kit, component registry, MCP, plugin, CLI, or SDK when implementation depends on its API.
- MUST prefer already installed project libraries and existing design-system primitives before adding new dependencies.
- MUST install and use selected tools only when the user requested implementation/tool use or the task clearly authorizes dependency installation.
- MUST report what was adopted, activated, absorbed, spiked, rejected, and what remains hand-rolled.
- NEVER invent MCP, plugin, or skill names.
- NEVER copy code from reference projects or templates unless license compatibility and adoption scope are checked.
- NEVER let ecosystem tooling override project rules, design constraints, accessibility requirements, or existing component ownership.
- NEVER stop at a raw recommendation list when the user asked to implement; use the selected ecosystem in the actual UI work and verify the rendered result.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW before acting. Update the list as each gate completes.

1. Read the request, choose a run mode, and classify the frontend stage.
   If no frontend stack, design direction, page type, or existing UI context is known, ask one focused question or route to strategy/reference work and stop.

2. Inspect local context before recommending tools.
   Read project rules, package manifests, frontend framework files, design-system files, existing UI components, styling config, and relevant docs. Prefer `rg --files` and targeted reads.

3. Identify the selected or implied frontend choices.
   Record framework, router/meta-framework, styling system, component library, icon library, animation library, chart/table/form needs, accessibility constraints, target page type, and design tone.

4. Discover available tool surfaces.
   Use `tool_search` for MCPs, plugins, and skills when available. Use official documentation lookup for framework/library APIs. Read `references/ecosystem-map.md` only when stack-to-tool mapping is needed.

5. Build an ecosystem enablement matrix.
   For each candidate, decide:
   - `adopt`: install/use directly as dependency, MCP, plugin, or skill.
   - `activate`: use an already installed skill/plugin/tool.
   - `absorb`: learn pattern/example without copying code.
   - `spike`: test quickly before deciding.
   - `reject`: avoid and record why.

6. Produce `UI_ECOSYSTEM_PACKET`.
   Include selected frontend choices, candidates, decisions, planned installs/activations, what remains custom, verification plan, and unverified items. In `recommend-only` mode, stop after the packet unless the user asks to proceed.

7. Check constraints before installing or using anything.
   Confirm license risk, framework compatibility, bundle/runtime impact, accessibility impact, project rules, dirty-worktree boundaries, and whether the user authorized dependency installation. If installation is not clearly authorized, propose the install command and continue with non-install usage where possible.

8. Use the selected ecosystem during implementation.
   Prefer mature components, official examples, design-system primitives, icon libraries, motion utilities, form/table/chart/search libraries, theme tokens, and relevant frontend skills over bespoke UI code.

9. Verify that the UI result benefited from the ecosystem.
   Run nearest deterministic checks first: typecheck, lint, tests, build. For visual work, start/reuse the local server when needed and inspect with browser screenshots across relevant viewports.

10. Handoff with evidence.
   Report selected frontend choices, tools recommended, tools installed or activated, what was adopted/absorbed/rejected, files changed, commands run, screenshots or manual checks, and unverified risks.

Explicit termination: produce the `UI_ECOSYSTEM_PACKET` plus implementation/verification handoff and end.

Failure exits:
- No frontend choice exists -> ask for stack/page/design direction or route to `strategy-first-development`.
- Tool discovery unavailable -> use local installed skills, official docs, and project dependencies; mark MCP/plugin discovery incomplete.
- Network unavailable -> use local project evidence and installed tools only; do not claim current package/plugin status.
- Dependency install not authorized -> do not install; provide exact proposed command and continue with existing tools.
- License unclear -> do not copy code; absorb patterns only and mark license risk.
- Tool conflicts with project rules or design system -> reject it and explain.

## Nearby Skill Routing

Use this routing before tool selection:

| User intent | Primary workflow |
|---|---|
| Decide product shape, user, roadmap, or frontend stack | `strategy-first-development` |
| Search mature GitHub/product references before design decisions | `similar-project-reference` |
| Apply brand-specific TranFu website rules | `tranfu-website-design` |
| Review accessibility/design compliance after UI exists | `web-design-guidelines` |
| Improve component feel, micro-interactions, or polish within an existing implementation | `make-interfaces-feel-better` or `emil-design-eng` |
| Build UI after frontend choices are known and ecosystem help is desired | `ui-ecosystem` |

If multiple workflows apply, run strategy/reference/design-review first, then run `ui-ecosystem` when the implementation needs stack-matched tools.

## Tool Discovery Rules

- Use `tool_search` before claiming a suitable MCP/plugin/skill does or does not exist.
- When the task mentions a library, framework, SDK, CLI, UI kit, or cloud/frontend service, fetch current official docs through the documentation tool surfaced by `tool_search`.
- Use existing frontend-oriented skills when they fit, especially design taste, interface polish, browser control, web design guidelines, project reference research, and framework documentation skills.
- Prefer official examples and maintained ecosystem packages over unmaintained snippets.
- Never invent MCP/plugin/skill names. If discovery fails, state that it failed and use fallback evidence.

## Expected Tool Surfaces

Search for these classes of support before hand-rolling:

- Documentation: framework/library official docs, component API docs, migration notes, examples.
- Skills: frontend design taste, interface polish, accessibility/design QA, browser control, similar project reference, framework docs.
- MCP/plugins: browser/Chrome control, Figma/design asset access, component registry access, screenshot/visual QA, project-specific design-system lookup.
- Libraries: component primitives, design systems, icons, forms, validation, tables, charts, motion, command menus, date pickers, uploaders.
- Templates/examples: official examples, maintained starter templates, mature open-source UI references.

## Ecosystem Matrix Template

```markdown
UI_ECOSYSTEM_PACKET:
  mode: recommend-only|implement-with-ecosystem|audit-existing-ui
  selected_frontend_choices:
    framework:
    styling:
    component_or_design_system:
    page_or_application_type:
    existing_constraints:
  discovery:
    tool_search_status: complete|incomplete_with_reason
    docs_status: complete|incomplete_with_reason
    local_context_read:
  decisions:
    - candidate:
      kind: MCP|plugin|skill|library|official-example|reference
      decision: adopt|activate|absorb|spike|reject
      why_it_fits:
      risk:
      action:
  planned_installs_or_activations:
    - name:
      command_or_use:
      authorization: authorized|needs_user_confirmation|not_required
  custom_build_surface:
    - only the project-specific pieces that remain custom
  verification:
    - command_or_method:
      expected_evidence:
      result:
  unverified:
    - tool discovery, license, visual QA, mobile, a11y, etc.
```

Human-readable matrix form:

```markdown
## UI Ecosystem Enablement

Selected frontend choices:
- Framework:
- Styling:
- Component/design system:
- Page/application type:
- Existing constraints:

| Candidate | Kind | Decision | Why it fits | Risk | Action |
|---|---|---|---|---|---|
| <name> | MCP/plugin/skill/library/example | adopt/activate/absorb/spike/reject | <fit> | <risk> | <command/use> |

What will be hand-rolled:
- <only the project-specific pieces that remain custom>

Verification:
- <command or browser check> -> <result>

Unverified:
- <tool discovery, license, visual QA, mobile, a11y, etc.>
```

## Definition Of Done

For `recommend-only`, done means:

- `UI_ECOSYSTEM_PACKET` is present.
- Current frontend choices and local files inspected are listed.
- At least one MCP/plugin/skill/tool discovery attempt is reported, or the discovery failure is explicitly marked.
- Every candidate has `adopt`, `activate`, `absorb`, `spike`, or `reject`.
- Unverified items are visible.

For `implement-with-ecosystem`, done means:

- `UI_ECOSYSTEM_PACKET` was produced before edits/installations.
- Approved tools were actually used in the implementation, not merely recommended.
- Files changed and dependency changes are reported.
- Deterministic checks ran where available.
- UI work was visually inspected when a browser-rendered surface changed.
- The final handoff states which parts remain hand-rolled and why.

## Adoption Heuristics

- Component primitives: adopt when the project needs common UI controls and the library matches the current framework and accessibility bar.
- Design system: adopt or activate when the project already uses one, or when the task spans multiple screens/components.
- Icons: adopt a maintained icon set instead of drawing icons manually.
- Motion: adopt a framework-compatible animation library for non-trivial transitions; keep motion subtle and purposeful.
- Forms: adopt proven form and validation tools for multi-field forms.
- Tables/data grids: adopt mature table/grid tooling for sorting, filtering, pagination, virtualization, or column configuration.
- Charts: adopt charting libraries when data visualization is central.
- Templates/examples: absorb official examples for layout, routing, data loading, theming, and accessibility patterns; do not copy wholesale.
- MCP/plugins/skills: activate when they provide browser inspection, design-system lookup, docs lookup, component generation, visual QA, screenshot review, or Figma/design asset access.

## Non-Triggers

Do NOT use this skill when:

- The user is still deciding the product shape, target user, or frontend stack. Use strategy-first or similar-project-reference first.
- The request is only to review UI code for accessibility or design compliance. Use web-design-guidelines or a dedicated design review skill.
- The request is a backend/API/data/auth bug with no frontend design surface.
- The user explicitly asks to hand-code a component from scratch for learning or interview purposes.
- The change is a tiny text, color, spacing, or CSS bug fix where tool discovery would be overhead.
- The task is to install a specific known package only; use package docs and project commands directly.

## Trigger Tests

Should trigger:

- "Next.js + Tailwind 定了，做 dashboard，不要手搓 UI，先找 MCP/插件/skill。"
- "ui 根据前端选型推荐合适的组件生态并安装使用。"
- "React 项目已经用了 shadcn，帮设置页提升美观，看看还有哪些生态工具能用。"
- "Vue + Naive UI 的后台页面，帮我基于生态组件改得专业一点。"
- "前端选型完成了，先别裸写代码，列出可用 UI 工具再实现。"

Should not trigger:

- "我们要做什么产品，帮我定技术栈和路线图。" -> strategy first.
- "审一下这个页面的 accessibility 问题。" -> design/a11y review.
- "修一个后端接口 500。" -> backend bug workflow.
- "只安装 lucide-react。" -> package docs/install workflow.
- "我想从零练习手写 dropdown。" -> learning/from-scratch exception.

Ambiguous:

- "让 UI 更好看。" Trigger only if frontend context exists; otherwise ask for stack/page context.
- "参考几个竞品页面。" Use reference workflow first, then this skill if implementation follows.
- "帮我做首页。" If no stack/design direction exists, ask or route to strategy/reference first.

## Examples

<example>
User: "Next.js + Tailwind 已经定了，帮我做一个 SaaS dashboard，不要手搓太多 UI，先推荐能用的 MCP/插件/skill。"

Behavior:
1. Inspect `package.json`, Tailwind config, app router structure, and existing components.
2. Use tool discovery for frontend/design/browser/docs skills and available MCP/plugins.
3. Fetch current official docs for Next.js, Tailwind, shadcn/ui, Radix, or other selected libraries as needed.
4. Produce `UI_ECOSYSTEM_PACKET`: activate browser/design skills, adopt shadcn/Radix/lucide if compatible, absorb official dashboard examples, reject heavy UI kits that fight the existing style.
5. Because implementation is requested, install or use selected tools and verify with typecheck/build/browser screenshots.
</example>

<example>
User: "我们选 Vue + Naive UI，帮这个设置页做得更专业。"

Behavior:
1. Confirm Vue and Naive UI are present in project dependencies.
2. Read Naive UI official docs or examples for forms, descriptions, tabs, modals, and layout.
3. Prefer Naive UI primitives and project theme tokens over custom controls.
4. Use icon and motion libraries already present before adding new ones.
5. Verify rendered settings page and report which primitives were adopted.
</example>

<bad-example>
WRONG: "我直接写一个漂亮的 React card grid，用自定义 SVG 图标和手写 dropdown。"

Reason: The skill exists to prevent unaided hand-rolled frontend after stack selection. It must first discover and use compatible component, icon, design-system, plugin, MCP, or skill support.
</bad-example>

<bad-example>
WRONG: "这个项目还没定是移动端还是网页，我先装 shadcn/ui。"

Reason: This skill runs after enough frontend direction exists. If product shape or stack is still open, route to strategy or reference research instead of installing UI tooling.
</bad-example>

<bad-example>
WRONG: "推荐使用某某 Figma MCP、某某组件 MCP、某某 UI skill" without running tool discovery or checking whether those tools exist in the current runtime.

Reason: The skill must use `tool_search` or equivalent discovery before naming MCPs/plugins/skills. If discovery is unavailable, it must mark the gap and fall back to official docs and installed tools.
</bad-example>
