---
name: compress-image
display_name: Image Compression
display_name_zh: 图片压缩
description: "Compress static PNG, JPEG, or WebP files to WebP or lossless PNG. Use when the user asks to compress or optimize an image, reduce image file size, convert an image to WebP or PNG, or says 图片压缩、压缩图片、减小图片体积、转 WebP、转 PNG. Do NOT trigger when the request involves resizing, cropping, retouching, general image editing, animated images, remote URLs, or formats other than PNG, JPEG, and WebP."
version: 0.1.0
author: BruceL017
updated_at: 2026-07-14
origin: own
allow_exec: true
---

# Compress Image

Compress one local image or a local directory with the bundled deterministic CLI. MUST keep source files by default. NEVER replace or delete a source unless the user explicitly authorizes replacement.

## Runtime contract

- MUST require Node.js 18.17 or newer and `npm` on `PATH`.
- MUST treat the directory containing this file as `SKILL_ROOT`.
- MUST run `<SKILL_ROOT>/scripts/main.mjs`; NEVER recreate the compression logic in an ad hoc command.
- MUST allow the script to install the pinned Sharp runtime into the user's cache on first use. Installation diagnostics go to stderr; JSON results remain on stdout.
- MUST accept only static `.png`, `.jpg`, `.jpeg`, and `.webp` inputs. NEVER download remote URLs or convert unsupported formats on the user's behalf.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW, then execute the steps in order.

1. Resolve exactly one local input path. If the request has no path, has multiple ambiguous paths, points to a URL, or requests an unsupported format or editing operation, stop and request a supported local file or directory.
2. Choose CLI options from the user's request:
   - Default to WebP at quality 80 and keep the source.
   - Use `--format png` for PNG output and do not pass `--quality`; PNG output is lossless.
   - Add `--recursive` only when the user explicitly asks to include subdirectories.
   - Add `--replace` only when the user explicitly authorizes replacing the source files.
   - Use `--output` only for one file, never for a directory, and never together with `--replace`.
3. Run the CLI with an absolute input path and `--json`:

   ```bash
   node "<SKILL_ROOT>/scripts/main.mjs" "/absolute/input" --format webp --quality 80 --json
   ```

4. Inspect the exit status and JSON. If the exit status is nonzero or `failures` is non-empty, report both successful and failed files and do not claim complete success.
5. Verify every reported output path exists. For cross-format `--replace`, also verify that the original path no longer exists. If either verification fails, report the missing or unexpected path and stop with failure. Otherwise report the absolute output paths, before/after byte counts, and `savedPercent`, then end.

Completion requires an exit status of zero, at least one item in `files`, an empty `failures` array, and every reported output file present.

## CLI

```text
node <SKILL_ROOT>/scripts/main.mjs <input>
  [--output <path>]
  [--format webp|png]
  [--quality 1-100]
  [--recursive]
  [--replace]
  [--json]
```

Default output is `{stem}-compressed.{format}` beside the source. The script NEVER overwrites an existing destination. With `--replace`, same-format compression atomically replaces the source; cross-format compression writes `{stem}.{format}` and deletes the source only after the new file is complete.

With `--json`, stdout MUST contain one report with this field structure:

```json
{
  "files": [
    {
      "input": "/absolute/input.png",
      "output": "/absolute/input-compressed.webp",
      "inputBytes": 1000,
      "outputBytes": 600,
      "savedBytes": 400,
      "savedPercent": 40,
      "format": "webp"
    }
  ],
  "failures": [],
  "summary": {
    "succeeded": 1,
    "failed": 0,
    "inputBytes": 1000,
    "outputBytes": 600
  }
}
```

## Failure exits

| Condition | Required handling |
|---|---|
| Input missing, unreadable, ambiguous, or unsupported | Stop before compression and request a valid local PNG, JPEG, or WebP path. |
| Node.js or npm unavailable | Report the missing runtime; create no output. |
| Sharp installation fails | Report the stderr diagnostic and retry command; create no output. |
| Animated WebP or corrupt image | Leave the source unchanged and report the file-level failure. |
| Destination already exists | Refuse to overwrite it; ask the user to move it or choose another output. |
| Directory contains mixed successes and failures | Preserve successful outputs, report every failure, and treat the overall run as failed. |

<example>
User: “把 `/work/hero.png` 压成 WebP，原图保留。”

Run `node "<SKILL_ROOT>/scripts/main.mjs" "/work/hero.png" --format webp --quality 80 --json`, verify `/work/hero-compressed.webp`, and report its size change. Leave `/work/hero.png` untouched.
</example>

<bad-example>
WRONG: The user asks “把 `/work/hero.png` 裁成 16:9 再压缩”, and the agent silently crops and compresses it.

Reason: cropping is an image-editing operation outside this Skill. Ask the user to complete the crop separately or provide the already-cropped image.
</bad-example>
