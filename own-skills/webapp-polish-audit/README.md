---
description: "Run a read-only, evidence-based Web UI polish audit. Verdicts rest on deterministic DOM/geometry/style comparisons rather than screenshots, and destructive paths are surfaced for your approval instead of silently skipped."
prompt_examples:
  - prompt: Audit https://practice.example.com and flag anything that reads demo-like, not real product.
    scene: Audit one page
  - prompt: Start from https://app.example.com, sample representative child pages, and run the polish audit.
    scene: Audit several pages
  - prompt: The dashboard looks fine at 1440px but collapses on mobile. Run the viewport comparison audit.
    scene: Check responsive layouts
---

# Webapp Polish Audit

A read-only audit of browser-rendered Web UI. It never reads project source, never modifies files, and never implements fixes.

**Verdicts do not rest on pixels.** Every finding is backed by script-collected DOM structure, accessibility state, visible text, computed styles, layout geometry, or interaction state — either a deterministic numeric comparison (contrast 4.5, touch target 44px, last-line ratio 0.6) or a semantic reading of text. That makes conclusions checkable: the report says "container is 60px, content is 99px, 39px clipped" rather than "looks a bit cramped".

## When to use

- Audit a named page, route, or visible UI bug.
- Sample representative child pages from an entry URL and check cross-page consistency.
- Check responsive continuity, input/perception reachability, form confidence, destructive-action protection, or action copy clarity.
- When the user says "audit first, then fix", complete the read-only audit first.

Do not use for implementation, code changes, large redesigns, backend/API/data/CLI/infrastructure work, product strategy, UX research, information architecture, or pure copywriting.

## The five dimensions

| Dimension | Owns |
| --- | --- |
| `03` | Action risk and priority; submit protection for destructive actions |
| `07` | Form input / validation / submission / errors / recovery confidence |
| `10` | Whether keyboard, touch, zoom, or contrast blocks critical tasks |
| `11` | Task continuity across viewports; truncation and cramping when content does not fit |
| `13` | Whether critical CTA and high-impact action copy states the real consequence |

Dimensions are not all selected by default — `page-inventory-probe.mjs` triggers them from what the page actually contains: `03` only with destructive controls, `07` only with a real form task (a standalone search box does not count), and a pure content page may select none. Every selection carries the concrete signal that triggered it.

## Three kinds of "not checked" — keep them apart

A core design point:

| Type | Meaning | What you do |
| --- | --- | --- |
| `blocker` | Technically impossible | Usually nothing |
| `not_applicable` | The page genuinely lacks that surface | Nothing |
| **`pending_authorization`** | **Technically possible, needs your go-ahead** | **Decide** |

Destructive actions, real submissions, and data writes are **never silently skipped**. They are reported with: what was found, how it would be verified, the cost of skipping (which class stays unresolved), and how to authorize. This is not an omission — it is a decision waiting for you. The validator enforces all four fields; writing only "needs authorization" without an actionable instruction fails validation.

## Interaction boundaries

- **Side-effect-free interaction is allowed by default**: opening dialogs, switching tabs, expanding menus, entering invalid values to trigger client-side validation. Before acting it intercepts `fetch` / `XHR` / `sendBeacon` / `WebSocket` / `location` / `beforeunload`; any write request halts the probe and converts it into a pending authorization.
- **Data-writing actions are not performed**: submit, delete, publish, permission changes, uploads — reported, never executed.
- **Destructive-click simulation requires explicit authorization** and only on `staging.` / `.test.` / `localhost` hosts.

## Screenshots

Off by default. None of the five dimensions judge by pixels, so a screenshot is an **escape hatch, not a tool** — this skill's historical failure mode was one screenshot per page per state, then hunting for problems in the images.

When genuinely needed the bar is: the script criteria already ran and produced data, you can name what is specifically missing, the main agent takes it, and the goal is confirming an existing suspicion. Cap is 3 per audit, each must log why the script evidence was insufficient, and **screenshot evidence cannot stand alone** — it must accompany script evidence for the same class. All three are enforced by the validator.

## Outputs

- `polish-audit-report.json` — the single machine-readable source of truth for findings, per-class coverage, pending authorizations, gaps, and blockers.
- `audit-state.json` — stage state and the script invocation ledger.
- Per-class probe JSON (`{page}__{dimension}-{class}__probe.json`).
- A user-facing summary: actionable findings, **pending authorizations as their own section**, gaps/blockers, audited viewports, report path.

Writes only under `/tmp/webapp-polish-audit/<RUN_ID>/`; zero writes to the project directory.

## Reliability mechanisms

- **Two execution paths**: when every selected class is script-decidable it takes the fast path (main agent runs it directly, no subagents); when semantic judgement is needed it dispatches **two parallel judges with a tie-breaker** — two isolated contexts judge the same unit, a third is added on disagreement, and persistent disagreement is recorded as blocked.
- **Judges never open a browser**: they read only the persisted JSON. If they cannot decide they record a blocker and hand it back to the main agent — going to look at the page themselves would bypass every collection and acceptance constraint.
- **Mechanical final check**: `validate-polish-audit-report.mjs` verifies schema, enums, referential integrity, judge isolation, the screenshot cap, and pending-authorization completeness. That script is the executable form of the rules — **where the docs and the script disagree, the script wins**.

## Bundled verification assets

```bash
node scripts/select-references.test.mjs               # dimension selection: evidence-driven, never select-all
node scripts/validate-polish-audit-report.test.mjs    # report contract, 13 cases
node scripts/fit-check.mjs                            # 11.F criteria self-check (7-case reference page)
node scripts/fit-check.mjs <url>                      # scan a real page
node scripts/e2e-selection.mjs                        # dimension selection end to end (4 built-in boundary pages)
```

The last three need playwright available: `PLAYWRIGHT_FROM=<path to a package.json that has playwright>`.

Run these after changing any criteria — they catch regressions immediately. The `11.F` criteria were overturned four times by exactly this loop before settling (Range returning child-box counts instead of line counts, visually-hidden text false positives, inline elements having equal scroll/client width, sub-pixel rounding noise).

## Maturity

- **Empirically calibrated**: dimension selection, `11.F` (content overflow), `10.E` (zoom occlusion), the report contract and validator.
- **Not yet field-tested**: the seven classes of `07`, the criteria for `03` / `13`, and the operation cards for the remaining classes of `10` and `11`. These were written to spec but not verified class-by-class against real pages — going by the `11.F` experience, untested criteria usually need correction. Watch the plausibility of conclusions when those classes fire, and please report deviations.
