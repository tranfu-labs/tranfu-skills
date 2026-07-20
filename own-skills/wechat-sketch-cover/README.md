---
description: "Create one fixed warm hand-drawn WeChat cover with an exact Chinese title and a verified 1923 × 818 PNG output."
prompt_examples:
  - prompt: "Create a WeChat cover for the title 为什么 AI 工作流总是难以复用？"
    scene: Use an exact title
  - prompt: "Create the fixed sketch cover from this Markdown article."
    scene: Use a Markdown article
---

# WeChat Sketch Cover

Create one verified fixed-format WeChat article cover.

## When to use it

**Use an exact title**

I have one Chinese or Chinese-mixed article title and want a warm hand-drawn WeChat cover with that title on the left.

**Use a Markdown article**

I have one Markdown article whose frontmatter title or first H1 should drive the cover concept and exact visible title.

**Fixed style needed**

I want the standard warm paper, red-accent, hand-drawn composition and exactly one `1923 × 818` PNG, without choosing visual options.

**Won't take**

This is not for other platforms, custom styles, sizes, palettes, branding, photo editing, body illustrations, prompt-only output, URL fetching, or publishing.

## What it produces

**Style, layout, dimensions, and text policy are fixed; only the content concept changes.**

- **Source record**: Saves the exact title and supplied article text or summary in a new output directory
- **Reproducible attempts**: Saves every prompt or build specification before creating its candidate
- **Candidate images**: Normalizes up to three attempted covers and visually checks each result
- **Final cover**: Copies the selected result to `cover.png` only after verifying PNG format and `1923 × 818` dimensions
- **Delivery record**: Reports status, title accuracy, backend, prompts, candidates, and diagnostics in a fixed order
- **External activity**: May use an available image backend or local renderer to create candidates
- **Never**: Modifies the source article, overwrites an existing output, or publishes the cover

## Prerequisites & boundaries

**Prerequisites**

Provide one exact Chinese or Chinese-mixed title of 2–35 non-whitespace characters, optionally with article text, or one readable Markdown file. Pillow and the bundled style resources must be available.

**Neighbor skill split**

- One fixed WeChat cover → **wechat-sketch-cover**
- A set of article illustrations → **post-illustration-images**

**Scenarios it declines**

- Conflicting title sources until one exact title is selected
- Titles without a Han character, URLs, and non-Markdown local documents
- Any request to change the fixed visual contract or add extra readable text

**Subtle edges**

- A candidate may be best-effort only when title accuracy is its sole remaining defect after three attempts
- Branding, extra text, unreadable output, or any other visual failure can never be accepted as best-effort
- Every retained artifact stays inside a newly created output directory
