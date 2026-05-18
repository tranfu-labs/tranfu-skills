---
name: daily-report
description: 生成 TranFu AI 日报图片；当用户要把 AI 新闻、日报素材或结构化 JSON 渲染为公开发布的 HTML 截图时使用。不要用于纯文本日报。
version: 0.1.0
author: griffithkk3-del
updated_at: 2026-05-18
origin: own
---

# Daily Report

Use this skill to generate a public-facing TranFu AI daily report image from structured AI news material.

The selected default style is `research + iceblue`: a light research-note layout
with pale blue accents. It is optimized for public daily publishing, mobile
reading, WeChat Moments, community posts, and article body images.

## Workflow

1. Create or update a report JSON file with the schema in
   `references/report-schema.md`.
2. Run the display review before rendering:
   - remove click-only labels such as `查看原文`
   - remove internal workflow, traceability, prompt, file path, and render notes
   - remove empty non-AI sections
   - keep only public-facing source names when they improve credibility
   - rewrite weak summaries into editorial judgement
3. Render with:

```bash
python3 <skill>/scripts/render_daily_report.py \
  --input /path/to/report.json \
  --out-dir /path/to/output/date-folder
```

Default output uses `--style research --palette iceblue`.

To choose another style:

```bash
python3 <skill>/scripts/render_daily_report.py \
  --input /path/to/report.json \
  --out-dir /path/to/output/date-folder \
  --style dark \
  --palette steelblue
```

To render every bundled style and palette:

```bash
python3 <skill>/scripts/render_daily_report.py \
  --input /path/to/report.json \
  --out-dir /path/to/output/date-folder \
  --all-variants
```

4. Verify the generated PNG:
   - expected size: `1080x1440`
   - no garbled Chinese
   - no visible `Crypto`, `查看原文`, raw URLs, file paths, prompt text, or render notes
   - no text overlap or clipped footer
   - date, brand, QR placeholder, charts, and all Chinese text are rendered by HTML/CSS

## Input Requirements

The minimum useful JSON fields are:

```json
{
  "date": "2026-05-18",
  "brand": "TranFu",
  "confidence": "低热度简报",
  "headline": "今天不是热点爆发，而是数据源告警",
  "theme": "Agent 工程化余波",
  "editorial_summary": "有观点的主编判断",
  "main_judgement": "一句话收尾判断",
  "keywords": ["Agent 工程化", "低代码工作流"],
  "ai_items": [
    {
      "title": "新闻标题",
      "importance": "适合放进图片的短摘要",
      "source": "Hacker News"
    }
  ]
}
```

If the user's source text is unstructured, first convert it to this JSON. Keep
`importance` short enough for a mobile screenshot.

## Editorial Rules

Treat the image as a static public artifact, not a webpage.

- Do not display instructions that imply clicking.
- Do not show raw source URLs in the image.
- Do not show empty categories.
- Do not include Crypto unless the user explicitly asks for a Crypto report and
  provides valid Crypto source material.
- Do not describe collection failure as the main summary unless that is the
  public story. Prefer a concise interpretation of the strongest available AI
  signal.
- Keep source names such as `Hacker News` only as credibility context.
- Use exact HTML text for all Chinese, dates, brand names, and QR placeholders.
  Do not ask an image model to render text.

## Outputs

The script writes:

- `render-<style>-<palette>.html`
- `tranfu-daily-<style>-<palette>-1080x1440.png` when Chrome/Chromium is available
- `manifest.json`

If screenshotting fails because Chrome is unavailable, still deliver the HTML
and explain the missing screenshot dependency.

## Styles And Palettes

Styles:

- `research`: default, light research-note layout
- `dark`: dark intelligence-dashboard layout

Palettes:

- `iceblue`: default, pale blue and soft document background
- `skyblue`: brighter, more technology-media feel
- `steelblue`: more formal and B2B
- `mist`: light, airy blue
- `slate`: restrained gray-blue
- `aqua`: cyan-blue with a fresher tone
