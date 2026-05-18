# Report Schema

Use this schema for TranFu AI daily report inputs.

Required:

- `date`: ISO date, such as `2026-05-18`
- `brand`: normally `TranFu`
- `confidence`: short status label, such as `低热度简报`
- `headline`: public headline
- `theme`: main daily signal
- `editorial_summary`: public editor judgement, not an internal status note
- `main_judgement`: one-sentence closing judgement
- `keywords`: 4-8 public keywords
- `ai_items`: 3-5 ranked AI items

Each `ai_items` item:

- `title`: public headline
- `importance`: short public explanation
- `source`: source name only, not a URL

Optional:

- `brand_subtitle`: defaults to `AI DAILY INTELLIGENCE`
- `qr_label`: defaults to `关注入口`
- `qr_placeholder`: defaults to `QR`
- `source_status`: archive-only source status
- `display_policy`: archive-only display policy notes

Static image display rules:

- Remove fields named `url`, `url_label`, `raw_url`, `link`, and `href` before rendering.
- Keep URLs in archives only.
- Keep source names only when useful.
- Remove empty non-AI sections.
- Keep summaries short enough to read on a phone.

