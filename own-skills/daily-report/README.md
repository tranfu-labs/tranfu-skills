---
prompt_examples:
  - scene: One-shot render from JSON
    prompt: Render report.json into a TranFu daily image using the default research + iceblue style
  - scene: Batch style comparison
    prompt: Run --all-variants once to preview every bundled style and palette side by side
  - scene: Dark intelligence dashboard
    prompt: Switch to dark + steelblue for an intelligence-dashboard feel
  - scene: Tech-media info card
    prompt: Produce a verge + iceblue variant that reads like a tech-media info card
  - scene: Public-safe cleanup
    prompt: Strip the QR, URLs, and low-context project badges so the image is safe to share on WeChat Moments
---

[English](./README.md) | [中文](./README.zh.md)

# AI Daily Report

Render structured AI news material into TranFu-branded daily-report images. The default output is a `1080x1440` HTML screenshot tuned for WeChat Moments, public accounts, and open community feeds.

## Purpose

- Convert a curated AI news JSON into a ready-to-publish daily image
- Keep the TranFu intelligence community on a consistent daily card format
- Generate several style and palette variants in one run so you can pick the one that fits the day
- Reuse a single layout to avoid the font, spacing, and color drift that manual design introduces

Not a fit for: plain-text digests, article rewriting, generic image generation, non-AI posters, or cover art that needs custom illustration.

## Install

The skill lives at `own-skills/daily-report/` in the company repository. Install, search, and upgrade go through the company `tfs` workflow, so there is no need to copy the directory by hand. A natural-language request is enough, for example "search company skills about daily report images" or "install daily-report at user level".

Runtime requirements: Python 3.10 or newer, plus Google Chrome or Chromium for automated PNG screenshots. If only Python is available the script still writes HTML and manifest files and simply skips the screenshot step.

## Usage

The daily loop has three stages. First, shape the news material into a JSON that matches `references/report-schema.md`, keeping each `importance` short enough to read at a glance on mobile. Second, invoke `scripts/render_daily_report.py` with `--input` pointing at the JSON and `--out-dir` pointing at the day's output folder. Third, sanity-check the result against the publishing rules below.

The default pairing is `research + iceblue`: a light research-note layout with pale blue accents, tuned for public reading. Switch to `dark` when the story deserves a stronger intelligence tone, or to `verge + iceblue` when you want a tech-media info card. When in doubt, add `--all-variants` to render every bundled style and palette in one pass and choose the strongest one.

## Output

Each run writes a rendered HTML file, a `tranfu-daily-<style>-<palette>-1080x1440.png` screenshot, and a `manifest.json` that records the inputs and file paths. The latest `verge` example sits under `examples/verge-iceblue/` at `1080x1350`, while `research` and `dark` references are available as `examples/research-*.png` and `examples/dark-*.png` for direct preview.

## Publishing rules

Treat the image as a static public artifact rather than a webpage. By default it must not display the QR, raw source URLs, internal workflow notes, traceability strings, prompt text, file paths, or render commentary. Low-context project and company badges are also excluded and should be rewritten as public-readable categories such as "low-code tooling" or "enterprise identity and access". Crypto content is off by default and only appears when the user explicitly requests it and supplies verifiable material. The QR is opt-in and should only be enabled when the target platform actually allows it.
