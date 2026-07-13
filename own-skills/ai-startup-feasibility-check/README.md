---
prompt_examples:
  - prompt: "Check whether 'AI agents for SMB customer support' is worth pursuing"
    scene: Evaluate a startup idea
  - prompt: "Run a feasibility check on the AI video generation space"
    scene: Assess an AI market
  - prompt: "Score my project against the 13-item AI startup prohibition list"
    scene: Check major red flags
  - prompt: "Analyze the structural death risk of AI writing tools like Jasper"
    scene: Review an existing company
  - prompt: "Do a market report on the AI coding space and attach a feasibility appendix"
    scene: Add to market research
  - prompt: "Score this AI project on substitution risk, leverage direction, and unit economics"
    scene: Score the key risks
---

[English](./README.md) | [中文](./README.zh.md)

# ai-startup-feasibility-check

Structural feasibility screening for AI startup directions: 13-item AI startup prohibition list, three-axis scoring (substitution risk / leverage direction / unit economics), and a 10-question self-check. Delivers a red / yellow / green diagnostic report.

## When to use it

- Deciding whether a specific AI startup direction is worth pursuing
- Judging the structural death risk of an AI project
- Adding a "feasibility self-check" appendix to reports produced by elite-market-researcher / market-analysis

## What you get

A four-module structured diagnostic report: prohibition-list hit check (13 items, line by line) → three-axis scoring (substitution risk / leverage direction / unit economics, scored on ±2) → 10-question self-check → verdict and recommendations (with a pre-mortem). Comes with a red / yellow / green traffic light and concrete next actions.

## Compared to similar skills

> Drafted via tranfu-publish, signed off by the author. Helps readers pick horizontally between similar skills.

### Inside the company library

- [elite-market-researcher](../own-skills/elite-market-researcher/SKILL.md) — deep sector research through a composite-analyst persona; **difference**: ai-startup-feasibility-check focuses on structural death-risk screening for AI startups (prohibition list + three-axis scoring), does no panoramic market research, and is designed to pair with the researcher rather than replace it
- [business-analysis-pipeline](../own-skills/business-analysis-pipeline/SKILL.md) — 7-step pipeline yielding a 120-point business feasibility report; **difference**: this skill zeroes in on AI-specific platform risks (foundation-model substitution / leverage direction / single-API dependency), whereas business-analysis-pipeline handles generic business analysis
- [market-analysis](../own-skills/market-analysis/SKILL.md) — 12-dimension parallel search producing panoramic market analysis; **difference**: market-analysis owns the search and report structure, this skill turns those findings into an AI-startup feasibility verdict

### Outside the company library

- [/validate (e2larsen)](https://medium.com/@e2larsen/i-built-a-claude-skill-to-validate-startup-ideas-then-i-used-it-on-my-own-project-53d79656b738) — validates startup ideas by searching Reddit / App Store / Google Trends; **difference**: this skill does no data-driven search validation, instead applying the AI startup prohibition list as a structural death-risk screen

### What makes this skill unique

- 13-item AI startup prohibition list (tiered 1/2/3) plus a three-axis scoring system
- Six built-in reference cases (negative: UUMit / Jasper / You.com, positive: Cursor / Mercor / LangSmith)
- Forms the AI-sector research trio together with elite-market-researcher / market-analysis

## Working with it

> Drafted with tranfu-publish guidance. Helps readers ramp up vertically.

### What to prepare

- A concrete description of the AI project / direction under review (the more specific the better: what it does, who buys it, how it charges)
- Install elite-market-researcher and market-analysis alongside if you plan to combine them
- Best results come from running market-analysis first for search, then this skill for the feasibility verdict

### Recommended use

- Feed in a concrete project description (e.g. "AI agents for SMB customer support"), not just a category label
- The two modules to focus on are "prohibition-list hits" and "three-axis scoring"
- Cross-check against the case library under references/ for the closest negative / positive analog

### Known limits

- The prohibition list is scoped to AI startup directions and does not apply to non-AI projects
- No real-time data search; the skill relies on inputs from the user or on results piped in from other skills
- The case library is anchored in 2024-2026 examples and needs periodic refresh
