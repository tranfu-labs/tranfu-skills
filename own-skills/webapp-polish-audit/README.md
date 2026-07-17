---
description: "Run a read-only, evidence-based Web UI polish audit with isolated judgement, explicit gaps, and a validated final report."
prompt_examples:
  - prompt: Audit https://practice.example.com and flag anything that reads demo-like, not real product.
    scene: Audit one page
  - prompt: Start from https://app.example.com, sample representative child pages, and run the polish audit.
    scene: Audit several pages
  - prompt: The dashboard looks fine at 1440px but collapses on mobile. Run the viewport comparison audit.
    scene: Check responsive layouts
---

# Webapp Polish Audit

A read-only audit of browser-rendered Web UI. Findings must be backed by screenshots, final DOM/accessibility state, computed styles, layout boxes, or safe interaction states. The skill never reads project source or implements fixes.

## When to use it

- Review one named page, route, component state, or visible UI bug.
- Sample representative child-page families from an entry URL.
- Check responsive continuity, state coverage, interaction feedback, visual trust, accessibility, or “not demo-like / real product” quality.
- Audit before implementation when the user explicitly asks to review first and fix later.

Do not use it for implementation, code changes, diffs, wholesale redesign, backend/API/data/CLI/infrastructure work, product strategy, UX research, information architecture, or copy-only work.

## How it stays reliable

The skill uses one S0–S7 state machine:

1. Resolve audit intent, scope, runtime capabilities, run directory, and TODO ledger.
2. Discover representative child pages only when the request is not explicitly single-page.
3. Select only evidence-supported audit dimensions for each page.
4. Capture screenshots and inventory into `/tmp/webapp-polish-audit/<RUN_ID>/`.
5. Dispatch one isolated Judge per screenshot/comparison unit and an independent Verifier, in batches that respect the harness concurrency limit.
6. Use a separate Aggregator, then let the main Agent anchor only actionable findings in Browser.
7. Run a deterministic JSON validator and an independent Final verifier before claiming completion.

Judge, Verifier, Aggregator, and Final verifier roles cannot be combined. Missing evidence becomes an explicit gap/blocker; it cannot be silently promoted to “already satisfied.”

## Outputs

- `polish-audit-report.json`: canonical machine-readable findings, class coverage, gaps, blockers, and evidence references.
- `audit-state.json`: S0–S7 stage state and screenshot judgement-unit ledger.
- PNG screenshots and inventory JSON under the same run directory.
- A concise user-facing summary with exact viewports and the report path.

The final validator rejects malformed schemas, missing evidence, uncovered judgement units, actionable classes without findings, blocker classes without gaps, and contradictions between gaps and satisfied verdicts.

## Safety boundaries

- No project source inspection or project-directory writes.
- No form submission, data mutation, permission change, upload, or other external side effect.
- No implementation diff or code edit.
- Browser final anchoring covers desktop and narrow viewports; project-specific breakpoint requirements are added or reported as gaps.
