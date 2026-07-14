# Adapters & Media

Read when choosing an adapter, handling media, or answering adapter-specific questions.

## Built-in Adapters

| Adapter | URLs | Key Features |
|---------|------|-------------|
| `x` | x.com, twitter.com | Anonymously accessible tweets, threads, X Articles, media |
| `youtube` | youtube.com, youtu.be | Transcript/captions, chapters, cover image, metadata |
| `hn` | news.ycombinator.com | Threaded comments, story metadata, nested replies |
| `generic` | Any URL (fallback) | Defuddle extraction, Readability fallback, auto-scroll, network idle detection |

Adapter is auto-selected based on URL. Override with `--adapter <name>`.

### YouTube

- Extracts transcripts/captions when available
- Transcript format: `[MM:SS] Text segment` with chapter headings
- Availability depends on YouTube exposing a caption track; videos with captions disabled or restricted playback may produce description-only output
- Pages that require login or manual verification are unsupported

### X/Twitter

- Extracts single tweets, threads, and X Articles
- Supports only content available without initiating login
- A login or verification wall terminates capture with a non-zero exit

### Hacker News

- Parses threaded comments with proper nesting and reply hierarchy
- Includes story metadata (title, URL, author, score, comment count)
- Shows comment deletion/dead status

## Media Download Workflow

Driven by `download_media` in EXTEND.md:

Treat this workflow as stage 6 of the parent `SKILL.md` TODO and update that stage instead of creating a second TODO list.

| Setting | Behavior |
|---------|----------|
| `1` (always) | Run CLI with `--download-media --output <path> --quiet` |
| `0` (never) | Run CLI with `--output <path> --quiet` (no media download) |
| `ask` (default) | Follow the ask-each-time flow below |

### Ask-Each-Time Flow

1. Run the CLI **without** `--download-media` with `--output <path> --quiet` → markdown saved
2. Check the saved markdown for remote media URLs (`https://` in body image/video links or the Frontmatter `coverImage`)
3. **If no remote media found** → done, no prompt needed
4. **If remote media found** → ask via the user-input tool selected by the parent `SKILL.md`:
   - header: "Media", question: "Download N images/videos to local files?"
   - "Yes" — Download to local directories
   - "No" — Keep remote URLs
5. If the user confirms → run the CLI **again** with `--download-media --output <same-path> --quiet` (overwrites markdown with localized links)

Failure exit: if the media-enabled rerun fails, report the CLI error and do not claim that the remote links were localized.

### Media Layout

When `--download-media` is enabled:

- Images → `imgs/` next to the output file (or `--media-dir`)
- Videos → `videos/` next to the output file (or `--media-dir`)
- Markdown media links are rewritten to local relative paths

## Output Format

Markdown to stdout (or file with `--output`; add `--quiet` to avoid echoing the saved content).

JSON output (`--format json`) returns structured data:

- `adapter` — which adapter handled the URL
- `status` — `"ok"` for successful captures
- `document` — structured content (url, title, author, publishedAt, content blocks, metadata)
- `media` — collected media assets with url, kind, role
- `markdown` — converted markdown text
- `downloads` — media download results (when `--download-media` used)

Login walls, CAPTCHA, Cloudflare, and other manual-verification pages write an error to stderr, exit non-zero, and do not produce Markdown or JSON output files.
