---
description: "Compress local PNG, JPEG, and WebP images with predictable output while keeping the originals unless replacement is authorized."
prompt_examples:
  - prompt: "Compress /work/hero.png to WebP and keep the original file."
    scene: Compress one image
  - prompt: "Compress every JPEG in /work/photos without scanning subfolders."
    scene: Compress a folder
  - prompt: "Make /work/chart.png smaller but keep it as a lossless PNG."
    scene: Keep PNG lossless
---

# Image Compression

Compress local images and verify every reported size saving.

## When to use it

**Compress one image**

I have a local PNG, JPEG, or WebP file and want a smaller WebP copy without touching the source.

**Compress a folder**

I need the supported images in one local directory compressed together, with optional subdirectory scanning only when I ask for it.

**Keep PNG lossless**

I need a smaller PNG but cannot accept lossy output. I want the result written separately and verified before it is reported.

**Won't take**

This is not for resizing, cropping, retouching, animation, remote URLs, or image formats other than PNG, JPEG, and WebP.

## What it produces

**The source stays in place by default; replacement happens only with explicit permission.**

- **Output file**: Writes a WebP at quality 80 by default, or a lossless PNG when requested
- **Batch result**: Reports every successful and failed file instead of hiding partial failures
- **Size report**: Returns absolute paths, before and after byte counts, and the saved percentage
- **Verification**: Confirms every reported output exists before declaring success
- **Never**: Overwrites an existing destination, downloads an image, or edits visual content

## Prerequisites & boundaries

**Prerequisites**

Provide exactly one readable local file or directory. The runtime needs Node.js 18.17 or newer and `npm`; the pinned Sharp dependency may be installed into the user cache on first use.

**Scenarios it declines**

- Multiple ambiguous paths or a remote URL
- Animated or corrupt files and unsupported formats
- Requests that combine compression with cropping, resizing, or retouching

**Subtle edges**

- Recursive directory scanning is opt-in
- A custom output path works for one file, not a directory
- Replacing across formats deletes the source only after the new file is complete and verified
