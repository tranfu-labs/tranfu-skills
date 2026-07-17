# draft-content

[简体中文](README.md) | English

`draft-content` is a Codex Skill for Chinese content production. It accepts a prepared topic and authorized source material, creates or improves one shared outline, pauses for explicit path-and-SHA-256 approval, then produces two platform-neutral A/B masters and adapts each branch for WeChat Official Accounts, Xiaohongshu, Zhihu, Weibo, and Toutiao.

Its responsibility ends at `READY_FOR_PROOFREAD`. It does not perform research, topic selection, proofreading, image generation, layout, or publishing.

## Core Workflow

```text
Prepared topic and source material
→ Create or improve one shared outline
→ Human approval of the outline path and SHA-256
→ Platform-neutral A/B masters
→ Five platform adaptations per branch
→ READY_FOR_PROOFREAD
```

- Branch A never reads a writing-style document.
- The only additional file input for branch B is the run's style snapshot.
- Both branches share facts, audience, approved outline, platform rules, and runtime settings.
- Every platform draft is adapted directly from its matching branch master.
- The verifier checks input snapshots, outline approval, artifact counts, H1 titles, placeholders, hash bindings, and completion state.

## Platform Outputs

| Platform | Default form |
|---|---|
| WeChat Official Accounts | 1,800–3,000 Chinese characters, 3–6 sections |
| Xiaohongshu | Publishing copy, 6–9 card pages, and 5–8 tags |
| Zhihu | 1,500–3,000-character question-driven answer |
| Weibo | One 200–600-character post, or a 3–6-post thread when needed |
| Toutiao | 1,000–2,000-character news-style analysis |

An upstream `ContentTopicPlan` form takes precedence over these soft defaults. Each platform artifact contains one working H1 that the body fulfills; the Skill does not generate title pools.

## Two Execution Routes

### Independent Workflow

The independent workflow creates a recoverable run and enforces the human outline gate:

```text
WORKDIR/03-内容创作/<run-id>/
├── manifest.json
├── 00-input/
├── 01-outline/
├── 02-masters/
├── 03-platforms/
└── 04-qa/report.json
```

Supported inputs:

- Standard mode: a `ContentTopicPlan(status=PASS)` and a topic-matching `collect-sources` research package.
- Equivalent mode: an explicit topic, target audience, authorized materials, and an optional outline supplied by the user.

### Orchestrated Provider

The Skill also exposes the stateless `content-production-provider: drafting-v1` contract for orchestrated `outline`, `master`, and `adapt` tasks. This route does not create an independent run or its own approval gate. See [`orchestrated-provider.md`](draft-content/references/orchestrated-provider.md).

## Installation

The installable Skill is the nested [`draft-content/`](draft-content/) directory. Copy that directory into a Codex or Claude Skill location when installation is desired. This repository does not install, synchronize, or publish the Skill automatically.

## Runtime Tools

The project includes five dependency-free Node.js CLIs:

```bash
node draft-content/scripts/init-run.mjs --help
node draft-content/scripts/inspect-run.mjs --help
node draft-content/scripts/set-outline-gate.mjs --help
node draft-content/scripts/verify-run.mjs --help
node draft-content/scripts/provider-contract.mjs --help
```

## Development Checks

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/test_scripts.mjs tests/test_provider_contract.mjs
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py draft-content
```

## Verification Boundary

QA verifies current files, hashes, and expected branch bindings. It cannot prove hidden model reads or causal authorship of generated content. This limitation is recorded in the manifest and QA report rather than presented as a strict causal-experiment guarantee.

## License

This project is licensed under the [MIT License](LICENSE). Methodology sources and third-party notices are listed in [NOTICE](NOTICE).
