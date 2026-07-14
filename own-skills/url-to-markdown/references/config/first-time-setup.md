---
name: first-time-setup
description: First-time setup flow for url-to-markdown preferences
---

# First-Time Setup

## Overview

When no EXTEND.md is found, guide user through preference setup.

**BLOCKING OPERATION**: Treat this as stage 2 of the parent `SKILL.md` TODO and mark that stage in progress. This setup MUST complete before dependency installation, URL validation, output-path construction, or capture. Do NOT:
- Start converting URLs
- Ask about URLs or output paths
- Proceed to any conversion

ONLY ask the questions in this setup flow, save EXTEND.md, then continue.

## Setup Flow

```
No EXTEND.md found
        |
        v
+---------------------+
| User-input tool     |
| (all questions)     |
+---------------------+
        |
        v
+---------------------+
| Create EXTEND.md    |
+---------------------+
        |
        v
    Continue conversion
```

## Questions

**Language**: Use the user's input language.

Use the user-input tool selected by the parent `SKILL.md` with ALL questions in ONE call:

### Question 1: Download Media

```yaml
header: "Media"
question: "How to handle images and videos in pages?"
options:
  - label: "Ask each time (Recommended)"
    description: "After saving markdown, ask whether to download media"
  - label: "Always download"
    description: "Always download media to local imgs/ and videos/ directories"
  - label: "Never download"
    description: "Keep original remote URLs in markdown"
```

### Question 2: Default Output Directory

```yaml
header: "Output"
question: "Default output directory?"
options:
  - label: "url-to-markdown (Recommended)"
    description: "Save to ./url-to-markdown/{domain}/{slug}.md"
```

The runtime's free-form "Other" choice accepts a custom path.

### Question 3: Save Location

```yaml
header: "Save"
question: "Where to save preferences?"
options:
  - label: "User (Recommended)"
    description: "~/.url-to-markdown/ (all projects)"
  - label: "Project"
    description: ".url-to-markdown/ (this project only)"
```

## Save Locations

| Choice | Path | Scope |
|--------|------|-------|
| User | `~/.url-to-markdown/EXTEND.md` | All projects |
| Project | `.url-to-markdown/EXTEND.md` | Current project |

## After Setup

1. Create directory if needed
2. Write EXTEND.md
3. Confirm: "Preferences saved to [path]"
4. Continue with conversion using saved preferences

Failure exit: if the selected directory cannot be created or `EXTEND.md` cannot be written, stop and report the exact path and filesystem error. Do not continue with in-memory defaults.

## EXTEND.md Template

```md
download_media: [ask/1/0]
default_output_dir: [path or empty]
```

## Modifying Preferences Later

Users can edit EXTEND.md directly or delete it to trigger setup again.
