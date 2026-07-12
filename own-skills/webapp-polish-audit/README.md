---
prompt_examples:
  - prompt: Audit https://practice.example.com and flag anything that reads demo-like, not real product.
    scene: single-page taste
  - prompt: Start from https://app.example.com, walk the child-page tree, then run the polish audit on each representative page.
    scene: multi-page from seed
  - prompt: The dashboard looks fine at 1440px but collapses on mobile. Run the viewport comparison audit.
    scene: responsive comparison
  - prompt: A new form modal shipped at /settings/team. Audit empty, loading, error and success states.
    scene: state audit
  - prompt: Does this landing page read like a real product or still like a demo? Judge it.
    scene: real-product feel
  - prompt: Pricing page just went live. Give it a completion-quality check before we announce.
    scene: pre-launch polish
---

[English](./README.md) | [中文](./README.zh.md)

# Webapp Polish Audit

Read-only audit of user-visible, browser-rendered web UI. Each judge looks at one screenshot with a filtered slice of rubric; the main agent only orchestrates and never judges from screenshots itself; one screenshot, one TODO, one judge.

## When to use it

**Single-page taste**: I hand over a page URL and want the skill to flag whatever reads demo-like versus real-product — whitespace, type scale, state coverage, edge cases, copy-paste smell.

**Multi-page from seed**: I hand over an entry URL and want the skill to discover the child-page tree first, then audit one representative per page type, then roll up a cross-page report.

**Responsive comparison**: Desktop looks fine, mobile or tablet collapses. I want the skill to walk the viewport comparison group (rubric 11) and catch what breaks.

**State audit**: Forms, modals, flows have empty, loading, error, success, disabled states that need a sweep. I want the skill to use the state-before/after comparison group (rubric 04) to capture and judge each state.

**Real-product feel**: I explicitly worry the page reads demo-like and want the skill to trigger on "not demo-like / real product / completion quality / refined / good taste" cues for an overall taste pass.

**Pre-launch polish**: A page is about to ship or just shipped. I want a completion-quality checkup before we announce, catching visible bugs and polish gaps.

**Not for**: Pure backend / CLI / database / API-only tasks. Product strategy, user research, information architecture or copy-only tasks without a UI surface. Wholesale redesign (only audit the proposed / current design). Code-level polish or any task that requires an implementation diff.

## What it produces

**Diagnose only, never change — the strictest lock**:

- **Four-stage pipeline**: Stage 1 child-page discovery (multi-page only); Stage 2 per-page rubric selection with evidence; Stage 3 exploration + screenshot capture; Stage 4 per-screenshot judgement + page-level `class_coverage` aggregation. Single-page tasks skip Stage 1 and run the rest.
- **All artifacts land in /tmp**: All screenshots, inventory JSON, manifests, `raw-urls.txt`, progress files write to `/tmp/webapp-polish-audit/{YYYYMMDD-HHMMSS}-{run-name}/`. Not a single byte lands in the project directory.
- **Judges stay out of the main session**: The main agent only dispatches. Each screenshot goes to one read-only judge SubAgent that first does a rubric-free fresh-eye pass, then compares against the filtered rubric slice. Findings the catalog cannot cover go into `uncatalogued`, never dropped.
- **Multi-image comparisons use comparison groups**: Theme pair (rubric 02), viewport pair (rubric 11), state before/after pair (rubric 04). What a single image cannot judge is never force-judged.
- **Gaps are honest**: What was not captured, not clicked, or blocked by side effects lands in `gaps`. Nothing is silently declared clean. The final report is findings plus gaps together.
- **Will never**: Read project source, edit files, submit forms, trigger external side effects, produce an implementation diff, or perform pixel-level redesign.

## Prerequisites & boundaries

**Prerequisites**: The target must be a browser-reachable rendered web UI (public or local dev server). The runtime must expose a Browser tool and a SubAgent / Task mechanism (without SubAgents, fall back to `local sequential fallback`, but still capture first and judge second). `/tmp/webapp-polish-audit/` must be writable.

**Won't handle**: Code-level review (use code-review). Pure API / data / backend / CLI / infrastructure tasks. Wholesale redesign (only audit existing or proposed designs). Any task that requires shipping an implementation diff.

**Subtle boundaries**:

- If the user says "optimize / fix / improve / polish / make it real", interpret it as an audit request: emit findings and recommended fixes only, never implement.
- Browser interaction is inspection-only: no form submissions, no create / update / delete on data, no permission changes, no file uploads, no external side effects.
- Single-page tasks still walk the full pipeline (skipping Stage 1); judgement never stays in the main session.
