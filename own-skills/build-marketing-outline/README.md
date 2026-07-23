---
description: "Turn a product URL or source project into an evidence-bound TranFu launch strategy and six-channel editorial outline pack."
prompt_examples:
  - prompt: "Use $build-marketing-outline to analyze https://example.com and create a formal launch outline pack."
    scene: Analyze a live product
  - prompt: "Use $build-marketing-outline on /absolute/project/path and identify the release blockers."
    scene: Analyze an unpublished project
  - prompt: "Analyze this product URL together with /absolute/project/path and reconcile runtime and source evidence."
    scene: Combine runtime and source
---

# TranFu Product Marketing Outline Skill

[中文](./README.zh.md)

`build-marketing-outline` is a TranFu-specific Codex Skill. It inspects a product URL, an unpublished product repository, or both, then turns product evidence into a formal launch-marketing strategy and editor-level outlines for six channels.

It produces strategy and outlines only. It does not create finished copy, images, platform drafts, or publishing actions.

> This version includes the `tranfu.com` and `Agent 公司养成记` narrative, uses Chinese output, the Asia/Shanghai time zone, and six Chinese content channels, and defaults to `~/Documents/product-marketing` as its output root. It is not a general-purpose marketing Skill.

## Core Capabilities

- Supports a public product URL, an absolute project directory, the current project directory, or a URL and source repository together.
- Separates page evidence, existing results, end-to-end tests, source implementation, inference, hypothesis, and conflict.
- Keeps formal launch marketing as the target for unpublished products while naming every release blocker.
- Produces channel-specific outlines for Xiaohongshu, WeChat Official Accounts, Zhihu, Toutiao, Weibo, and the product website.
- Produces a nine-section, platform-neutral master outline for a downstream content-production workflow.
- Keeps the product read-only and does not install dependencies, change source files, or trigger product-side writes.

## Installation

Install from the company Skill catalog (recommended):

```bash
tfs install build-marketing-outline --scope user
```

Install from the standalone GitHub repository:

```bash
mkdir -p ~/.codex/skills
git clone https://github.com/BruceL017/build-marketing-outline.git \
  ~/.codex/skills/build-marketing-outline
```

Update:

```bash
git -C ~/.codex/skills/build-marketing-outline pull
```

After installation, start a new Codex task or let Codex refresh its available Skills.

## Runtime Requirements

- A Codex environment with Skills support.
- URL mode requires network access. With browser capabilities it can inspect runtime behavior; otherwise it falls back to HTML evidence and lowers the release verdict.
- Project mode requires source-read access. Git is used to compare repository state, and local runtime inspection uses only already-installed dependencies and documented commands.
- Enable local runtime inspection only for trusted projects. It may execute the project's own development command and is not an independent code sandbox.

## Usage

Analyze a product URL:

```text
$build-marketing-outline https://example.com
```

Analyze an unpublished product project:

```text
$build-marketing-outline /absolute/project/path
```

Run from the product-project root:

```text
$build-marketing-outline
```

Combine runtime and source evidence:

```text
$build-marketing-outline https://example.com /absolute/project/path
```

You may also specify an output root in the request. The output location must remain outside the inspected product project.

Provide only credential-free public URLs. A URL containing userinfo, a token, API key, signature, authorization value, or login code is rejected and is not fetched or written to the output.

## Output

Each run creates a new timestamped directory:

```text
{product-name}_营销内容大纲执行包_{YYYYMMDD-HHmm}/
```

A normal run contains exactly six documents:

1. `00_执行摘要与发布判定.md`
2. `01_产品证据与用户路径.md`
3. `02_营销策略与内容矩阵.md`
4. `03_六渠道编辑大纲.md`
5. `04_通用母大纲.md`
6. `05_素材清单与发布门禁.md`

The Skill produces only a diagnostic document when the input is completely inaccessible or contains no identifiable product evidence.

## Evidence Levels

| Level | Meaning |
|---|---|
| `E0-P` | Something currently visible or explicitly stated on a page |
| `E0-R` | An existing result, example, or artifact |
| `E0-T` | A complete path from input to product result observed during the current run |
| `E0-S` | A capability directly implemented by source, routes, tests, or schemas |
| `E1` | A strong inference supported by multiple direct signals |
| `E2` | An audience, demand, benefit, or positioning hypothesis awaiting validation |
| `E3` | An unsupported, conflicting, or unverifiable claim |

An HTTP 200 response, page load, rendered shell, or navigation-only check is `E0-P`, not `E0-T`. `E0-S` proves that a project implements something; by itself, it does not prove that users can use it now.

## Read-Only And Safety Boundaries

The Skill does not automatically:

- Install or upgrade dependencies.
- Modify product files, configuration, or databases.
- Submit forms, upload files, save settings, or clear data.
- Invoke AI generation, grading, payment, email, messaging, or publishing APIs.
- Log into user or administrator accounts.
- Read `.env*`, secrets, real user data, database content, or production logs.
- Perform external competitor, keyword, trend, pricing, or market-size research.

In project mode, it compares the complete Git status before and after inspection and stops any local server it started.

Generated documents preserve credential-free input URLs and local absolute evidence paths. Before sharing an execution pack externally, review and redact local usernames, directory structure, and other internal paths.

## Release Verdicts

The Skill uses four verdicts:

- `可进入发布制作` - ready to enter copy and asset production
- `待补证据或产品条件` - waiting for evidence or product conditions
- `仅内部使用` - internal use only
- `无法形成可信大纲` - unable to form a credible outline

The first three verdicts retain a formal-launch target. The Skill does not silently replace the campaign with prelaunch content or a build log.

## Repository Structure

```text
.
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── evidence-and-readiness.md
│   ├── output-contract.md
│   └── tranfu-marketing-framework.md
├── README.md
└── README.zh.md
```

## Validation Status

- The core Skill content passed Codex `quick_validate.py` in the standalone source repository. This directory uses company catalog frontmatter and is checked by the `tranfu-skills` validators.
- Passed isolated forward tests for both URL and project-directory modes.
- Verified the six-document contract, six channel outlines, evidence IDs, TranFu return path, and release gates.
- Verified that project-mode testing leaves the product repository and local services unchanged.

## License

The governing license is the `LICENSE` file at the root of the repository containing this Skill. If that repository has no `LICENSE`, public visibility alone does not grant permission to copy, modify, or distribute it.
