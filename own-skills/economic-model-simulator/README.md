---
description: Build interactive economic model pages that connect fund flows, account changes, user choices, and simulation assumptions.
prompt_examples:
  - scene: Build a simulation
    prompt: Use $economic-model-simulator to turn these allocation and reinvestment rules into an interactive page with a fund-flow diagram, account log, user roadmap, and assumptions.
  - scene: Update an existing page
    prompt: Use $economic-model-simulator to fix branch switching in this simulation so the fund flows, account log, and results follow the selected path.
---

# Economic Model Simulator

Create or modify an interactive page that explains where money goes, who owns each asset, and how distributions and reinvestment change the user's position.

## Provide

Supply the economic rules, input amounts, allocation ratios, ownership relationships, and available user choices. Include the existing code or page requirements when modifying a simulator. Identify which parameters are verified and which are assumptions.

## Use

Ask the agent to apply `$economic-model-simulator` to your materials. The skill organizes four linked modules: a fund-flow diagram, an account log, a user roadmap, and simulation assumptions. Changing a path updates the diagram, log, and results together.

The agent checks allocation arithmetic, compatible choices, branch switching, node and edge activation, and reinvestment destinations. Delivery includes the page or code, verification results, and any unverified items.

## Scope

This skill guides page implementation; it does not contain a standalone application. It does not establish investment value or verify a project's economics. Business rules and parameters come from the task; the franchise example in SKILL.md is hypothetical.
