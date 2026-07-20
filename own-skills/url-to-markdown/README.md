---
description: "Capture a public webpage through Chrome and save its rendered content as verified Markdown or JSON."
prompt_examples:
  - prompt: "Save this public article as Markdown and download its images."
    scene: Save a public page
  - prompt: "Extract the transcript from this public YouTube video as Markdown."
    scene: Extract a transcript
  - prompt: "Capture this Hacker News discussion as structured JSON."
    scene: Capture a discussion
---

# Public URL Content Capture

Capture and verify a public webpage as Markdown or JSON.

## When to use it

**Save a public page**

I have an HTTP or HTTPS page that opens without a login and want its rendered main content saved locally, with optional media download.

**Extract a transcript**

I need the public transcript from a YouTube video, or the readable content from an anonymously accessible X post or thread.

**Capture a discussion**

I want a Hacker News discussion or another public page captured as Markdown or structured JSON for later use.

**Won't take**

This is not for pages that require login, CAPTCHA, payment, or manual browser action, and it does not summarize, rewrite, translate, or publish the captured content.

## What it produces

**A successful command is still provisional until the saved title and body are inspected.**

- **Content file**: Saves clean Markdown or JSON at a conflict-safe path grouped by domain and page
- **Media files**: Optionally downloads images and videos beside the capture and rewrites local links
- **Capture report**: Returns the output path, selected adapter, media result, and any unverified limitation
- **Preferences**: On first use, asks where to save captures and how to handle media before writing `EXTEND.md`
- **Browser activity**: Uses Chrome through the bundled command and may reuse an explicitly supplied CDP endpoint
- **Never**: Exports authentication state, asks the user to defeat an access wall, or preserves an unusable login page as success

## Prerequisites & boundaries

**Prerequisites**

Provide exactly one public HTTP or HTTPS URL. The environment needs Bun, Chrome or Chromium, writable output storage, and first-use preference choices when no `EXTEND.md` exists.

**Neighbor skill split**

- Saving one public page unchanged → **url-to-markdown**
- Researching and verifying claims across sources → **collect-sources**

**Scenarios it declines**

- Login walls, CAPTCHA, Cloudflare verification, or any manual interaction
- Multiple ambiguous URLs or an unsupported forced adapter
- Requests to summarize, edit, translate, or publish the captured page

**Subtle edges**

- Site adapters cover X, YouTube, Hacker News, and generic public pages
- Media behavior follows explicit arguments first, saved preferences second, and defaults last
- A low-quality capture is removed and reported as unsupported even when the command exits successfully
