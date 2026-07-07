---
name: tranfu-website-design-system
description: Apply the extracted TranFu official website responsive design system when creating, implementing, refactoring, or reviewing TranFu website UI from Figma screenshots or code. Trigger for TranFu homepage, product center, skill resource, practice article, detail-page, responsive breakpoint, color, typography, spacing, radius, component, layout, visual QA, agent-prompt-guide, and Chinese requests like "按 TranFu 官网风格", "官网设计规范", or "响应式设计". Do NOT trigger for non-TranFu websites, pure copywriting, logo redesign, backend-only changes, or unrelated code review.
version: 0.1.0
author: chuanye312-coder
updated_at: 2026-07-07
origin: own
---

# TranFu Website Design System

Use this skill to preserve the TranFu official website visual system across implementation, review, and Figma-to-code work.

## Required Reference

MUST read `references/design-spec.md` before making any TranFu website UI decision. It contains the extracted rules for:

- visual theme and atmosphere
- color roles
- typography and type scale
- component styling
- layout and spacing
- radius, depth, and elevation
- responsive behavior for `1920`, `1440`, `1280`, `756`, and `375`
- implementation cautions
- agent prompt guide

If `references/design-spec.md` is missing or unreadable, report `BLOCKER: missing TranFu design spec` and stop this skill.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW:

1. Classify the request as `create`, `implement`, `refactor`, `review`, `visual_qa`, or `prompt_guidance`.
2. Verify the target is TranFu website UI. If it is not, state the out-of-scope reason and stop this skill.
3. If the user intent is ambiguous between editing and review-only feedback, ask one concise question and stop until answered.
4. Read `references/design-spec.md`.
5. Inspect the supplied code, Figma node, screenshot, or running page before making decisions.
6. Route by mode:
   - `create` / `implement` / `refactor`: apply the design spec and modify only the relevant UI files.
   - `review`: produce findings first and do not edit files.
   - `visual_qa`: inspect desktop and mobile evidence before claiming visual parity.
   - `prompt_guidance`: output a production prompt using the Agent Prompt Guide section.
7. Validate color, type, spacing, radius, component style, depth, responsive behavior, asset rendering, and text overflow against the spec.
8. Produce the named output for the mode and end.

## Core Rules

- MUST treat Brand Red `#E63A46` as a focused accent for logo, primary action, active state, focus, and key emphasis only.
- MUST keep backgrounds and sections in the neutral system: `#F7F7F7`, `#F0F0F0`, `#F5F5F5`, white, and thin gray borders.
- MUST use `MiSans` for product UI text. Use `Hammersmith One` only for compact English command/badge text such as `AI Agent oS`.
- MUST keep letter spacing at `0`.
- MUST use the observed radius scale: `6`, `8`, `12`, `16`, `24`, and full radius for dots/circular controls.
- MUST keep shadows minimal. Prefer borders, pale surfaces, and layered neutral blocks over heavy elevation.
- MUST preserve the responsive breakpoints and inner widths documented in the spec.
- MUST build dense, product-grounded UI. Avoid generic marketing hero composition, decorative blobs, and oversized empty cards.
- MUST use real product/interface visuals or UI-like captures when visual media is needed.
- NEVER redraw, recolor, stretch, crop, or decorate the TranFu logo.

## Failure Paths

- Missing target UI or screenshot -> ask for the missing target and stop.
- Missing design spec -> report `BLOCKER: missing TranFu design spec` and stop.
- Non-TranFu target -> report out of scope and route to the relevant generic design workflow.
- Figma context unavailable -> continue from local screenshots only if available; mark confidence as partial.
- No mobile or desktop evidence during visual QA -> mark that viewport `not_run:<reason>` and do not claim it passed.
- Existing implementation conflicts with the extracted spec -> cite both the code evidence and spec rule, then apply the smallest scoped correction.

## Output Schemas

For implementation:

```yaml
TRANFU_UI_CHANGE_REPORT:
  mode: create|implement|refactor
  changed_files:
    - <absolute path>
  design_rules_used:
    - <references/design-spec.md section>
  validation:
    desktop_viewport: passed|failed|not_run:<reason>
    mobile_viewport: passed|failed|not_run:<reason>
    commands:
      - command: <command>
        result: passed|failed|not_run:<reason>
  deviations:
    - rule: <rule>
      reason: <why it was necessary>
```

For review:

```yaml
TRANFU_DESIGN_REVIEW:
  mode: review
  findings:
    - id: TDS-1
      severity: HIGH|MEDIUM|LOW
      rule: <references/design-spec.md section or exact rule>
      location: <file:line | screenshot | viewport | UI area>
      evidence: <what is visible or present>
      fix: <specific correction>
      verification: <how to verify>
  validation:
    inspected_targets:
      - <file | screenshot | UI area>
```

For prompt guidance:

```yaml
TRANFU_AGENT_PROMPT:
  target_artifact: <page|component|section|review>
  prompt: |
    <copyable production prompt>
  rules_included:
    - <design-spec section>
```

## Examples

<example>
User: "按 TranFu 官网风格做一个新的 skill 卡片列表页面。"

Action: Read `references/design-spec.md`, inspect existing TranFu UI if present, implement the list with neutral surfaces, 6/8/12/16 radius scale, MiSans typography, Brand Red only for active/action states, and validate desktop/mobile behavior.
</example>

<example>
User: "检查这个页面是否符合 TranFu 官网设计规范。"

Action: Run review mode, produce `TRANFU_DESIGN_REVIEW`, cite exact spec rules, and do not edit files.
</example>

<bad-example>
WRONG: "Use a full red gradient hero with big marketing cards and random decorative orbs."

Reason: TranFu uses restrained neutral surfaces, red as focused accent, product/interface evidence, and no decorative blob/orb background language.
</bad-example>

<bad-example>
WRONG: "It looks mostly fine."

Reason: Review mode requires structured findings with severity, rule, location, evidence, fix, and verification.
</bad-example>
