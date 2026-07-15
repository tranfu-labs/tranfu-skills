---
description: "Evaluate an AI product or startup idea with a structured report covering the market, competition, business model, and risks."
prompt_examples:
  - prompt: "Evaluate the commercial viability of this AI product: <product description>."
    scene: Evaluate a new idea
  - prompt: Give me a full business analysis report on this idea.
    scene: Request a full report
  - prompt: Score these two AI startup directions side by side using the same rubric.
    scene: Compare several directions
---

# business-analysis-pipeline

A skill that puts an AI product or startup direction through a **7-step pipeline + 120-point rubric + KF-numbered cross-references** and produces a structured business analysis report — built for PMs, founders, and investment analysts sizing up a new direction.

## When to use it

- You want a **systematic commercial-viability read** on an AI product concept, not a gut-feel score
- You need **PEST + Porter's Five Forces + SWOT + Business Model Canvas + opportunity matrix** run in one pass, with findings cited across modules by number
- You want a structured markdown report you can drop straight into a **review / decision memo / pitch** — S/A/B/C/D grade attached
- You need to compare **several product concepts** head-to-head under a single scoring system

## How to trigger it

Say things like:

- "Evaluate the commercial viability of this AI product: <description>"
- "Give me a full business analysis report"
- "Score this AI startup direction end to end"
- "Do an investment due-diligence pass on this project"

Handy things to include up front: **product name / concept description / core features** (required); target users, business model, known competitors, team strengths, target market, analysis depth (optional — the skill will fill sensible defaults).

## What you'll see

- **Seven pipeline steps, produced module by module**, each tagged 🟢🟡🔴 plus three numbered key findings — **P-KF** for PEST, **F-KF** for Five Forces, **S-KF** for SWOT, **B-KF** for the Business Model Canvas — so later modules can cite earlier findings by ID instead of restating them
- **120-point composite score** rolling up to an S/A/B/C/D grade with a one-line go / hold / kill call
- **Executive summary** of 400–600 words, ready to lift straight into a review deck
- Chinese output by default, markdown tables and tags throughout, no filler "next-step suggestions" section tacked onto the end

## Adjacent skills

| Task | Go with |
|---|---|
| Market sizing, TAM/SAM/SOM, competitive landscape only | **market-analysis** / **elite-market-researcher** |
| Quick feasibility read on an AI startup direction (no full pipeline) | **ai-startup-feasibility-check** |
| Spotting or ranking AI opportunities across a space | **opportunity-hunter** / **ai-opportunity-evaluation** |
| Scoring a single project on execution readiness (not commercial viability) | **project-scoring** |

**Not this skill**: writing the actual pitch deck or business plan document (that's downstream authoring); running a single framework in isolation with no cross-references (use a lighter market-analysis pass); tracking KPIs for a shipped product (that's operational analytics, not a viability read).
