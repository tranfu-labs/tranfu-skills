---
description: Helps choose between a treemap and a fixed-grid heatmap when a request says “heatmap” but really talks about share, distribution, or dominance.
prompt_examples:
  - prompt: Help me make a heatmap for each business line’s revenue share.
    scene: Revenue share chart
  - prompt: Make a GitHub-style heatmap for daily website visits last year.
    scene: Calendar heatmap
  - prompt: Show channel share with tabs for total and last week.
    scene: Metric switching
---

# Share Heatmap Defaults

Choose the right default before building a “heatmap” whose real question may be share, area, or distribution.

## When to use it

**Revenue share chart**

When I ask for a heatmap and the wording includes share, distribution, portion, “who is bigger,” or “who takes the largest part,” I want the model to decide whether block area should carry the meaning.

**Calendar heatmap**

When the grid position is fixed, such as days, hours, matrix cells, or GitHub-style contribution boxes, I want the model to keep the cells the same size and use color only for intensity.

**Metric switching**

When the same dataset has several time windows or statistical views, such as total, 24 hours, week, month, or year, I want the model to design a clear switch instead of mixing unrelated encodings.

**Not for**

This is not for choosing among unrelated chart families like bar charts versus line charts, and not for implementing a treemap layout algorithm or CSS details.

## What it produces

**The key decision is made before implementation: treemap or fixed-grid heatmap.**

- **Encoding choice**: decide whether area represents share or whether every cell stays the same size.
- **Treemap default**: use proportional area when the business question is “who owns how much of the whole.”
- **Grid default**: keep fixed cells when the cell position itself is the structure, such as days or matrix rows and columns.
- **Metric switch**: when several time windows exist, switch both area and color together for the selected metric.
- **Self-check**: ask whether area alone shows who has the larger share; if not, revisit the encoding.
- **Never does**: write the treemap algorithm, CSS layout, data fetching, color palette, or validation script for you.

## Prerequisites & boundaries

**Input needed**

A chart request that includes the word heatmap or a similar visualization request, plus enough wording to tell whether share, portion, or distribution is the core question.

**Neighboring work**

- Choosing between bar, pie, line, and other unrelated chart types stays with ordinary chart-design judgment.
- Implementing treemap layout, coordinates, CSS, or tests stays with the coding model at the moment of implementation.
- Picking colors and scales is separate from the area-versus-color encoding decision.

**Out of scope**

- Heatmaps with no share or portion meaning.
- Calendar heatmaps, correlation matrices, and fixed row-column grids where size has no business meaning.
- Requests where the word “distribution” means density over a dimension rather than parts of a whole.

**Subtle boundary**

If the wording is ambiguous, ask one clarifying question: is the chart about each item’s share of the whole, or each item’s own activity or strength?
