---
name: daily-report
display_name: AI Daily Report
display_name_zh: AI 日报图生成
description: >-
  当用户要把 AI 新闻、日报素材或结构化 JSON 渲染成 TranFu 公开发布图片时使用。
  Do NOT trigger when: 用户只要纯文本日报、文章改写、通用图片生成或非 AI 主题海报。
version: 0.1.0
author: griffithkk3-del
updated_at: 2026-07-10
origin: own
license: internal
---

# Daily Report

Use this skill to generate a public-facing TranFu AI daily report image from structured AI news material.

The selected default style is `research + iceblue`: a light research-note layout
with pale blue accents. It is optimized for public daily publishing, mobile
reading, WeChat Moments, community posts, and article body images.

## When To Use

Use this skill when the user asks to:
- generate a TranFu AI daily report image from AI news material
- turn structured daily-report JSON into a public HTML screenshot
- create shareable daily-report images for WeChat Moments, official accounts, X, or community posts
- render and verify example report images from the bundled script

Do NOT trigger when:
- the user only wants a pure text daily report
- the user wants a generic image model prompt or unrelated poster
- the task is article writing, copy editing, or web publishing without a daily-report image output
- the material is mainly Crypto or non-AI unless the user explicitly asks to extend the schema

## 同类 Skill 对比

### 公司库内
- [structured-thinking-advisor](../structured-thinking-advisor/SKILL.md) — 优化内容结构和表达；**本 skill 区别**: 不只改文案，还用 HTML/CSS 固定渲染成图片。
- [project-scoring](../project-scoring/SKILL.md) — 评估 AI 项目并输出决策 memo；**本 skill 区别**: 不做项目评分，专注每日 AI 信息图片化。
- [write-spec](../write-spec/SKILL.md) — 从模糊需求生成 PRD/spec；**本 skill 区别**: 面向每日内容生产，不输出产品需求文档。

### 外部世界
- Canva / Figma 模板 — 适合人工设计海报；**本 skill 区别**: 输入结构化新闻，脚本稳定批量渲染。
- Newsletter screenshot workflows — 适合网页转截图；**本 skill 区别**: 内置公开图片展示规则，主动去掉点击、URL、QR 和低语境项目名。
- Generic image generators — 适合视觉概念图；**本 skill 区别**: 中文正文、日期和 logo 都由 HTML/CSS 渲染，避免乱码和文字失真。

### 本 skill 独特价值
- TranFu 品牌日报图一键渲染。
- 默认公开读者版，少噪音。
- HTML 可追溯，PNG 可分享。

## 使用技巧

### 材料方案
- 用 JSON 存归档字段，用图片只展示公开内容。
- logo 只用 bundled `tranfu.png`。
- QR 默认关闭，平台允许时再开。

### 推荐用法
- 先把日报素材整理成 `references/report-schema.md`。
- 默认跑 `research + iceblue`。
- 上传前跑 `--all-variants` 检查备用样式。

### 已知限制
- 需要 Chrome/Chromium 才能自动截图。
- 默认只做 AI 日报，不展示 Crypto。
- 过长新闻需先压缩成手机可读短句。

## Workflow

1. Create or update a report JSON file with the schema in
   `references/report-schema.md`.
2. Run the display review before rendering:
   - remove click-only labels such as `查看原文`
   - remove internal workflow, traceability, prompt, file path, and render notes
   - remove empty non-AI sections
   - keep only public-facing source names when they improve credibility
   - keep the TranFu brand mark, date, title, and numbered stories easy to scan
   - do not show low-context project/company badges such as niche tool names; rewrite them into public-facing category descriptions
   - do not create standalone keyword or company badge blocks
   - keep QR hidden by default because some platforms restrict QR images
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
   - no standalone keyword block or low-context project/company badges
   - no QR unless the input explicitly sets `show_qr: true`
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
      "source": "Hacker News",
      "category": "workflow"
    }
  ],
  "show_qr": false
}
```

If the user's source text is unstructured, first convert it to this JSON. Keep
`importance` short enough for a mobile screenshot.

## Editorial Rules

Treat the image as a static public artifact, not a webpage.

- Do not display instructions that imply clicking.
- Do not show raw source URLs in the image.
- Do not show empty categories.
- Do not show a QR code unless the destination platform allows it and the user explicitly requests it.
- Do not render a separate keyword panel.
- Default research output goes directly from the title block into numbered story summaries; do not show top summary blocks, standalone judgement boxes, per-story labels, or tags.
- Do not show niche project names or low-context company names as visual badges. If a name is not meaningful to a general public reader, rewrite the sentence into a descriptive category such as `低代码工具`, `企业身份与权限管理`, `安全监控工具`, `开源评测工具`, or `开源可观测工具`.
- Use real brand assets only for TranFu and for explicitly requested, high-context variants. Do not add invented logos, noisy badges, or low-context labels.
- Do not include Crypto unless the user explicitly asks for a Crypto report and
  provides valid Crypto source material.
- Do not describe collection failure as the main summary unless that is the
  public story. Prefer a concise interpretation of the strongest available AI
  signal.
- Keep source names such as `Hacker News` only as credibility context.
- Use exact HTML text for all Chinese, dates, brand names, and QR placeholders.
  Do not ask an image model to render text.

## Visual Pattern

Learn from high-performing Xiaohongshu and X information cards without copying any specific creator:

- strong first-screen hierarchy: brand/date first, then a concise headline
- blue editorial dividers and numbered modules for scan speed
- default research layout shows numbered items only; no per-story tags, category labels, or low-context project/company badges
- bottom conclusion and risk note instead of click prompts
- no decorative QR by default; platform-specific QR should be an explicit opt-in

## Outputs

The script writes:

- `render-<style>-<palette>.html`
- `tranfu-daily-<style>-<palette>-1080x1440.png` for bundled `research` and `dark` styles when Chrome/Chromium is available
- `examples/verge-iceblue/tranfu-daily-verge-iceblue-1080x1350.png` as the latest bundled Verge reference image
- `manifest.json`

If screenshotting fails because Chrome is unavailable, still deliver the HTML
and explain the missing screenshot dependency.

## Styles And Palettes

Styles:

- `research`: default, light research-note layout
- `dark`: dark intelligence-dashboard layout
- `verge`: compact technology-media information card layout; latest example output is bundled under `examples/verge-iceblue/` at `1080x1350`

Palettes:

- `iceblue`: default, pale blue and soft document background
- `skyblue`: brighter, more technology-media feel
- `steelblue`: more formal and B2B
- `mist`: light, airy blue
- `slate`: restrained gray-blue
- `aqua`: cyan-blue with a fresher tone
