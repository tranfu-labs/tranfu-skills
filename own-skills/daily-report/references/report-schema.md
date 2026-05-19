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
- `show_qr`: optional boolean, defaults to `false`

Each `ai_items` item:

- `title`: public headline
- `importance`: short public explanation
- `source`: source name only, not a URL
- `category`: optional category key: `workflow`, `enterprise`, `security`, `benchmark`, `observability`, or `model`
- `company`: optional archive/source metadata. The default research image does not show company badges.
- `tags`: optional archive metadata. The default research image does not show standalone keyword tags.

Optional:

- `brand_subtitle`: defaults to `AI DAILY INTELLIGENCE`
- `show_qr`: defaults to `false`; set `true` only when the target platform allows QR images
- `qr_label`: used only when `show_qr` is true
- `qr_placeholder`: used only when `show_qr` is true
- `risk_note`: platform-safe risk note shown near the bottom or side panel
- `source_status`: archive-only source status
- `display_policy`: archive-only display policy notes

Static image display rules:

- Remove fields named `url`, `url_label`, `raw_url`, `link`, and `href` before rendering.
- Keep URLs in archives only.
- Keep source names only when useful.
- Remove empty non-AI sections.
- Do not render a standalone keyword section. Keep keywords as archive/search metadata unless a specific style explicitly needs them.
- Do not render QR by default. QR is opt-in through `show_qr: true`.
- Default research output should go directly from the title block into numbered story summaries. Do not show top summary blocks, per-story labels, or standalone tags.
- Do not show low-context project/company badges in the image. Rewrite niche names into public-facing descriptions unless the user explicitly asks to show them.
- Keep summaries short enough to read on a phone.
