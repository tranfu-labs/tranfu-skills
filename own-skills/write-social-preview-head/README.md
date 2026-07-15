---
description: "Add the full social-preview head — OG, Twitter, icons, manifest — so Lark, Slack, and WeChat show titles, cards, and icons every time."
prompt_examples:
  - prompt: Add the full social-preview head to this new landing page for Lark and Slack sharing.
    scene: Set up a new page
  - prompt: The link shared to Lark shows no card image — check what's missing in my head.
    scene: Fix a missing preview image
  - prompt: New logo but platforms keep the old cache — how do I rotate by swapping file names?
    scene: Refresh cached images
---

# Social Preview Head Writer

Add the full social-preview head — OG, Twitter, icons, manifest — so Lark, Slack, and WeChat show titles, cards, and icons every time.

## When to use it

**Set up a new page**:

I'm building a new landing or share page and want Lark and Slack link previews to show the title, description, card image, and icon reliably from day one.

**Fix a missing preview image**:

A link shared to Lark or Slack has no card image, or shows the old image or old icon, and I want the head fixed so the preview renders correctly.

**Refresh cached images**:

I swapped the brand logo or OG image, but the platform keeps serving the stale cache. I want to bust it by renaming the actual files, not by tacking on `?v=`.

**Test on a probe page**:

The main page head is too tangled to debug. I want a minimal isolated social-preview probe page to check whether the platform can even recognize the tags.

**Check before launch**:

The head is written and I want to run `curl` header checks plus image encoding checks so the live MIME type, dimensions, and bit depth all pass.

**Replace all icon files**:

The favicon still shows the old logo. I want to swap the whole set — favicon, apple-touch-icon, manifest icons, JSON-LD Organization logo — in one coordinated push with no stragglers.

**Not for**:

- Redesigning the logo or producing brand visual assets — that's design work
- A full SEO / GEO site audit — see the SEO / GEO workflows
- JS-SDK private-channel share (WeChat `wx.share` and friends) — this skill only owns static HTML head and crawlable resources

## What it produces

**Every resource URL in the head is absolute HTTPS with a dated file name — never `?v=` query strings**. That's the most counterintuitive rule.

- **Full head tag set**: title / description / canonical + `og:*` (including `secure_url` / `width` / `height` / `type` / `alt`) + `twitter:*` + link (`image_src` / `icon` / `apple-touch-icon` / `manifest`)
- **Naming and format rules**: OG image at `1200x630` PNG 8-bit; apple-touch-icon `180x180` PNG; favicon 16 / 32; root `.ico` single 32×32 at 32 bits/pixel; manifest served as `application/manifest+json`
- **Coordinated rename checklist**: `og:image` / `og:image:secure_url` / `twitter:image` / `image_src` / every icon link / manifest icons / JSON-LD `logo` / CDN `Content-Type` — miss one and a stale asset lingers
- **Probe page recipe**: an isolated minimal page that skips the full-site layout, holds only the head six-pack plus a first big body image, used to isolate platform recognition issues
- **Verification recipe**: `curl -L -I` for response headers, `file` and `identify` for image encoding and bit depth, plus a real IM client sending the link once end-to-end
- **Will never**: redesign the logo or produce brand visual assets; cover a full SEO / GEO checklist; handle `wx.share` or other JS-SDK private-channel sharing

## Prerequisites & boundaries

**Prerequisites**:

The page must emit the head directly in HTML (SSR or static generation) — CSR JS injection is invisible to crawlers. Every image resource must live at a stable absolute HTTPS URL with server or CDN control over `Content-Type`. You must be able to send a real end-to-end link on the target IM platform for final verification.

**Adjacent skills**:

| Action | Send to |
|---|---|
| Logo redesign / brand asset production | design or branding workflow |
| Full SEO / GEO site audit | **geo** / **geo-audit** |

**Won't handle**:

- WeChat `wx.share` or private-channel JS-SDK share customization
- Actually changing CDN or server config (the skill says what to configure, it doesn't do it for you)
- Image design, cutout, or brand visual work

**Subtle boundaries**:

- "Lark link shared but no image" → triggers head audit + coordinated rename; "Lark link fails to send / permission issue" → doesn't trigger
- "Swap favicon for new logo" → triggers icon-set sync; "redesign the brand logo" → doesn't trigger (that's design)
- Using `?v=YYYYMMDD` to bust cache → the skill actively pushes back and asks for a fresh file name — query parameters aren't stable across all platforms
