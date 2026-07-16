# collect-sources

[中文](README.md) | [English](README_EN.md)

`collect-sources` is a pre-writing research skill for Chinese-language AI and technology media. Before drafting begins, it searches public sources, records evidence, separates and verifies claims, and hands a traceable editorial brief to the downstream writing workflow.

## Scope

- AI models, products, companies, and industry events
- Developer tools, open-source projects, and software platforms
- Chips, computing infrastructure, robotics, and adjacent internet technology
- Public URLs, Markdown, TXT, and PDF materials supplied by the user

It does not handle non-technology topics, isolated lookups without a content-creation goal, post-draft fact-checking, title or outline generation, article writing, or publishing.

## Core Behavior

- Triggers when the user asks to "start research," "collect sources," or create AI technology content.
- Uses Codex native search and page reading by default; public webpages, RSS/Atom, Jina Reader, public JSON APIs, and an existing `curl` installation are anonymous fallbacks.
- Never requests API keys, accounts, cookies, or QR-code login, and never installs missing tools.
- Searches the latest 30 days by default and follows dated historical context when needed.
- Treats English primary sources, independent technology media, Chinese-language context, public community signals, and challenge searches as distinct source layers.
- Search summaries remain leads; usable facts must be traced back to inspectable original pages.
- Records original pages, rights clues, and suggested uses for visual materials without downloading files.

## Installation

```bash
npx skills add https://github.com/BruceL017/collect-sources
```

The installable skill is located in the repository's `collect-sources/` subdirectory.

## Usage

Explicit invocation:

```text
Use $collect-sources to collect sources about a recently released AI model.
```

You can also make an AI technology writing request directly. The skill first produces a research package, then hands only `ready` claims to the downstream writing stage:

```text
Write an article for general readers explaining the new product that an AI company just released.
```

If no topic is provided, the skill scans AI technology developments from the last 30 days, returns three to five evidence-backed candidates, and waits for topic selection before starting full research.

## Output Contract

Each project maintains three Markdown files:

```text
reference/collect-sources/
|-- 00-research-brief.md
|-- 01-source-notes.md
`-- 02-editorial-brief.md
```

Each run appends a distinct `RUN-YYYYMMDD-HHmmss` section and uses complete `SRC-<run>-###` and `CLM-<run>-###` identifiers to preserve traceability from claims to sources. Previous runs are never overwritten.

Evidence levels range from `L0` to `L3`. Downstream use gates are:

- `ready`: may be asserted within the recorded scope and as-of date.
- `caveat`: may only be used as attributed uncertainty or a limitation.
- `do_not_use`: must not be passed to the writing stage.

Run status is `complete`, `partial`, or `blocked`. A compound writing request may continue from a `partial` result when at least one `ready` claim exists, but all recorded limitations must be preserved.

When called by the `content-production` orchestrator, the skill switches to the `source-research-v1` provider mode. It does not create the standalone run described above; instead, it writes a research brief, source log, structured claims, and evidence map into the orchestrator-authorized `02-research/` directory. Both modes use the same evidence levels and fact gates.

## Validation

Repository tests check the installable layout, standalone behavior contract, orchestrated request/result contract, and research package structure. They do not access the network or assess the truth of research findings:

```bash
python3 -m unittest discover -s tests -v
```

You can also run the Codex skill structure validator:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/quick_validate.py" collect-sources
```

`scripts/provider-contract.mjs` only performs deterministic validation of orchestrated requests, results, paths, hashes, and research-package structure. It does not collect online sources or install tools. Standalone mode remains prompt-driven.

## Sources and License

The project is licensed under the MIT License. `NOTICE` lists the public or local skills that informed the research-process design. All rules in this implementation were rewritten without copying their code or workflow text.
