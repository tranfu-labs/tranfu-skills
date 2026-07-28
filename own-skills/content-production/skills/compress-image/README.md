---
description: Compresses static PNG, JPEG, or WebP images into smaller WebP or lossless PNG files.
prompt_examples:
  - prompt: Compress this PNG into a smaller WebP file.
    scene: Compress PNG
  - prompt: Optimize these article images without changing their size.
    scene: Optimize images
  - prompt: Convert this JPEG to WebP and keep a smaller output.
    scene: Convert to WebP
---

# Image Compression

Reduce static image file size while keeping the workflow limited to supported local image formats.

## When to use it

**Compress PNG**

When I have a PNG, JPEG, or WebP file that needs a smaller delivery copy, I want a deterministic compression pass.

**Optimize images**

When article assets are too large, I want smaller files without resizing, cropping, or retouching.

**Convert to WebP**

When a supported image should become WebP or lossless PNG, I want the output written locally and checked.

**Not for**

Do not use it for animated images, remote URLs, resizing, cropping, retouching, or unsupported formats.

## What it produces

**The skill keeps its scope narrow: it prepares local deliverables and never performs platform publishing.**

- **Compressed file**: Writes a local WebP or lossless PNG candidate.
- **Validation**: Checks that the input format is supported and that the output is usable.
- **No design edits**: It does not crop, resize, retouch, or make creative changes.
- **Never does**: It does not merge workflow stages, publish content, or invent missing user approvals.

## Prerequisites & boundaries

**Prerequisites**

Provide readable local PNG, JPEG, or WebP files. The runtime may need its bundled image-compression dependency available.

**Neighboring skills**

| Action | Use |
|---|---|
| Generate article images | **post-illustration-images** |
| Create WeChat cover | **wechat-sketch-cover** |
| Package full content | **content-production** |

**Out of scope**

- Requests that belong to another named skill should be routed there instead.
- Missing or unreadable inputs should stop the workflow rather than produce guessed content.
- Platform publishing, account login, scheduling, and post-publication analytics stay outside this skill.

**Subtle boundaries**

- A complete content-production run may call this skill as a provider, but this skill still owns only its own contracted output.
- Standalone use should leave unrelated project files untouched and report only the files or findings it actually produced.
