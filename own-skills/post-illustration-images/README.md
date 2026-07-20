---
description: "Create consistent, platform-ready illustration sets from article content with registered styles, verified geometry, and optional branding."
prompt_examples:
  - prompt: "Create a set of WeChat body illustrations for this finished article."
    scene: Illustrate an article
  - prompt: "Turn this Xiaohongshu note into a consistent cover and image carousel."
    scene: Create a carousel
  - prompt: "Add one image to this existing set without regenerating the others."
    scene: Continue an image set
---

# Multiplatform Post Illustrations

Create a traceable illustration set from written content.

## When to use it

**Illustrate an article**

I have finished content for WeChat, Zhihu, Weibo, or Toutiao. I want the strongest ideas selected and illustrated one image at a time.

**Create a carousel**

I have a Xiaohongshu note and need a coordinated cover and content carousel rather than unrelated decorative images.

**Continue an image set**

I need to add, restore, rebrand, or regenerate one image in an existing bundle without rebuilding the accepted images.

**Won't take**

This is not for photo retouching, product mockups, photoreal campaigns, exact long text inside images, or another explicitly named image skill.

## What it produces

**Style is chosen once for the set, while each image carries only one core idea.**

- **Planning files**: Saves content analysis, a mandatory shot list, and one prompt per image
- **Image assets**: Generates and checks each raster separately, preserving accepted native pixels
- **Branding**: Applies the real brand asset deterministically only when the resolved policy enables it
- **Bundle record**: Writes `manifest.md` with backend, geometry, attempts, file paths, QA, and remaining risk
- **File changes**: Creates or updates `post-illustration-output/<content-slug>/` in the user's project
- **External activity**: Uses one verified image backend and may incur generation cost
- **Never**: Lets the model draw logos, stretches accepted output, or writes generated assets into the skill directory

## Prerequisites & boundaries

**Prerequisites**

Provide readable source content and a target platform: WeChat, Xiaohongshu, Zhihu, Weibo, or Toutiao. A registered platform style and a verified image backend must be available.

**Neighbor skill split**

| Need | Hand off to |
|---|---|
| Build a reusable style | **visual-builder** |
| Make one WeChat cover | **wechat-sketch-cover** |
| Run the full pipeline | **content-production** |

**Scenarios it declines**

- Natural photography, portraits, product retouching, or exact campaign recreation
- Images that require long, perfectly rendered copy
- An unknown platform style without user confirmation of a registered fallback

**Subtle edges**

- A requested count is a ceiling, not permission to invent filler images
- Branding follows user override first, then the selected style default
- A failed ratio is retried at the verified request size; accepted images are never resized to force compliance
