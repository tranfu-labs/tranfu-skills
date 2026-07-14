---
name: url-to-markdown
description: 抓取无需登录的公开 URL，保存为 Markdown 或 JSON；适用于 X、YouTube 字幕和 Hacker News。Do NOT trigger when 页面需登录、验证码或人工操作。
version: 0.1.0
author: BruceL017
updated_at: 2026-07-14
origin: own
allow_exec: true
---

# URL to Markdown

Fetch a URL through the bundled `url-to-markdown` CLI (Chrome CDP + site-specific adapters) and convert the rendered page to clean Markdown or JSON.

## Scope Guard

- Require one HTTP or HTTPS URL.
- Capture only pages that require no login or manual verification. NEVER ask the user to sign in, solve a CAPTCHA, or operate the browser.
- Preserve the source content; do not summarize, rewrite, translate, or publish it.
- Use the built-in `x`, `youtube`, `hn`, or `generic` adapter. Do not invent site-specific extraction logic outside the bundled CLI.
- Write only the requested capture, optional media, debug artifacts, and the preference file created through the required first-time setup.
- Treat `--cdp-url` and Chrome profile contents as user-supplied browser state. NEVER export, restore, or manage authentication state.

## Guarded Procedure

CREATE A TODO LIST FOR THE TASKS BELOW, with one TODO for each numbered stage, then execute stages 1–7 in order.

1. Resolve `{baseDir}`, the bundled reader path, and the preference-file candidates. If a bundled Skill resource is missing, stop and report its path.
2. Resolve preferences using **Preferences**. If no `EXTEND.md` exists, run the blocking first-time setup, save the selected values, then resume this procedure.
3. Validate the URL and construct a non-conflicting output path using **Output Path Generation**. If the URL is missing or is not HTTP/HTTPS, stop and request a valid URL.
4. Resolve Bun, Chrome, and CLI dependencies as specified in **CLI Setup**. Select the adapter automatically unless the user explicitly requests a supported adapter. Apply explicit CLI arguments before preferences, and preferences before defaults.
5. Run the non-interactive capture with `--quiet` when saving via `--output`, then immediately apply the **Agent Quality Gate**. If the CLI reports a login or verification wall, or the saved content is a login, CAPTCHA, shell, or low-quality result, delete any unusable capture, report that the page is unsupported, and stop. NEVER retry through login or manual browser interaction.
6. Apply the media workflow in [references/adapters.md](references/adapters.md). If preferences say `ask`, prompt only when the saved Markdown contains remote image or video URLs, including a Frontmatter `coverImage`.
7. Confirm that the saved title and body match the target page, then report the output path, selected adapter, media result, and any unverified limitation. Produce that capture report and end.

Failure exits:

- Missing dependency installation or browser launch failure → stop with the failing command and error.
- Timeout after one retry with `--timeout 60000` → stop and report the URL and timeout used.
- Login, CAPTCHA, Cloudflare, or another access block → stop, report the CLI error, and do not claim or preserve a successful capture.
- Unsupported forced adapter → stop and list `x`, `youtube`, `hn`, and `generic`.

## User Input Tools

When this skill prompts the user, follow this tool-selection rule (priority order):

1. **Prefer built-in user-input tools** exposed by the current agent runtime — e.g., `AskUserQuestion`, `request_user_input`, `clarify`, `ask_user`, or any equivalent.
2. **Fallback**: if no such tool exists, emit a numbered plain-text message and ask the user to reply with the chosen number/answer for each question.
3. **Batching**: if the tool supports multiple questions per call, combine all applicable questions into a single call; if only single-question, ask them one at a time in priority order.

Concrete `AskUserQuestion` references below are examples — substitute the local equivalent in other runtimes.

## CLI Setup

**Important**: The CLI source is vendored in `{baseDir}/scripts/lib`. `scripts/package.json` installs only third-party runtime dependencies.

**Agent Execution Instructions**:
1. Determine this SKILL.md file's directory path as `{baseDir}`
2. Resolve `${BUN}` runtime: if `bun` installed → `bun`; else suggest installing Bun
3. If `{baseDir}/scripts/node_modules` does not exist, run `${BUN} install --cwd {baseDir}/scripts`
4. `${READER}` = `{baseDir}/scripts/url-to-markdown`
5. Replace all `${READER}` in this document with the resolved value

## Preferences (EXTEND.md)

Check EXTEND.md in priority order — the first one found wins:

| Priority | Path | Scope |
|----------|------|-------|
| 1 | `.url-to-markdown/EXTEND.md` | Project |
| 2 | `${XDG_CONFIG_HOME:-$HOME/.config}/url-to-markdown/EXTEND.md` | XDG |
| 3 | `$HOME/.url-to-markdown/EXTEND.md` | User home |

| Result | Action |
|--------|--------|
| Found | Read, parse, apply settings |
| Not found | **MUST** run first-time setup (see below) — do NOT silently create defaults |

**EXTEND.md supports**: download media by default, default output directory.

### First-Time Setup ⛔ BLOCKING

When EXTEND.md is not found, you **MUST** use the runtime user-input tool selected under **User Input Tools** to gather preferences before creating EXTEND.md. **NEVER** create EXTEND.md with silent defaults. Capture is BLOCKED until setup completes. Batch all three questions into a single call:

- **Q1 — Media** (header "Media"): "How to handle images and videos in pages?"
  - "Ask each time (Recommended)" — Prompt after each save
  - "Always download" — Download to local `imgs/` and `videos/`
  - "Never download" — Keep remote URLs
- **Q2 — Output** (header "Output"): "Default output directory?"
  - "url-to-markdown (Recommended)" — Save to `./url-to-markdown/{domain}/{slug}.md`
  - User may pick "Other" and type a custom path
- **Q3 — Save** (header "Save"): "Where to save preferences?"
  - "User (Recommended)" — `~/.url-to-markdown/` (all projects)
  - "Project" — `.url-to-markdown/` (this project only)

After answers, write EXTEND.md, confirm "Preferences saved to [path]", then continue.

Full template: [references/config/first-time-setup.md](references/config/first-time-setup.md).

### Supported Keys

| Key | Default | Values | Description |
|-----|---------|--------|-------------|
| `download_media` | `ask` | `ask` / `1` / `0` | `ask` = prompt each time, `1` = always, `0` = never |
| `default_output_dir` | empty | path or empty | Default output directory (empty = `./url-to-markdown/`) |

**EXTEND.md → CLI mapping**:

| EXTEND.md key | CLI argument | Notes |
|---------------|-------------|-------|
| `download_media: 1` | `--download-media` | Requires `--output` to be set |
| `default_output_dir: ./posts/` | Agent constructs `--output ./posts/{domain}/{slug}.md` | Agent generates path, not a direct flag |

**Value priority**: CLI arguments → EXTEND.md → skill defaults.

## Usage

```bash
# Default: non-interactive capture, markdown to stdout
${READER} <url>

# Save to file
${READER} <url> --output article.md --quiet

# Save with media download
${READER} <url> --output article.md --quiet --download-media

# JSON output
${READER} <url> --format json --output article.json --quiet

# Force specific adapter
${READER} <url> --adapter youtube --output transcript.md --quiet
```

<example>
User: "Save https://example.com/article as Markdown and download its images."

Agent behavior: resolve saved preferences, construct `./url-to-markdown/example.com/article/article.md`, run the bundled reader with `--output` and `--download-media`, inspect the Markdown title and body, then report the Markdown and media paths.
</example>

<bad-example>
WRONG: Run the CLI, see exit code `0`, and report success without opening the saved Markdown.

Reason: headless sites can return a login shell or boilerplate with a successful exit code; the quality gate is mandatory.
</bad-example>

<bad-example>
WRONG: Create `EXTEND.md` with silent defaults when no preference file exists.

Reason: first-time preference setup is blocking and requires the user's media, output, and save-location choices.
</bad-example>

<bad-example>
WRONG: When capture reaches a login or verification wall, open a visible browser and ask the user to complete it.

Reason: this Skill supports only non-interactive public-page capture; access blocks are terminal failures.
</bad-example>

## Options

| Option | Description |
|--------|-------------|
| `<url>` | URL to fetch |
| `--output <path>` | Output file path (default: stdout) |
| `--quiet` | Do not echo captured content to stdout; requires `--output` |
| `--format <type>` | Output format: `markdown` (default) or `json` |
| `--json` | Shorthand for `--format json` |
| `--adapter <name>` | Force adapter: `x`, `youtube`, `hn`, or `generic` (default: auto-detect) |
| `--headless` | Force headless Chrome (no visible window) |
| `--timeout <ms>` | Page load timeout (default: 30000) |
| `--download-media` | Download images/videos to local `imgs/` and `videos/`, rewrite markdown links. Requires `--output` |
| `--media-dir <dir>` | Base directory for downloaded media (default: same as `--output` directory) |
| `--cdp-url <url>` | Reuse existing Chrome DevTools Protocol endpoint |
| `--browser-path <path>` | Custom Chrome/Chromium binary path |
| `--chrome-profile-dir <path>` | Chrome user data directory (default: `URL_TO_MARKDOWN_CHROME_PROFILE_DIR` or the platform data directory under `url-to-markdown/chrome-profile`) |
| `--debug-dir <dir>` | Write debug artifacts (document.json, markdown.md, page.html, network.json) |

## Agent Quality Gate

**CRITICAL**: treat every capture as provisional. Some sites can silently return low-quality content without failing the CLI.

After every run, inspect the saved Markdown or the JSON `markdown` field. See [references/quality-gate.md](references/quality-gate.md) for the full checklist and failure workflow. Read it whenever a run looks suspicious or an access block appears.

## Output Path Generation

The agent must construct the output file path — `url-to-markdown` does not auto-generate paths.

**Algorithm**:
1. Determine base directory from EXTEND.md `default_output_dir` or default `./url-to-markdown/`
2. Extract domain from URL (e.g., `example.com`)
3. Generate slug from URL path or page title (kebab-case, 2-6 words)
4. Construct: `{base_dir}/{domain}/{slug}/{slug}.md` — each URL gets its own directory so media files stay isolated
5. Conflict resolution: append timestamp `{slug}-YYYYMMDD-HHMMSS/{slug}-YYYYMMDD-HHMMSS.md`

Pass the constructed path to `--output`. Media files (`--download-media`) are saved into subdirectories next to the markdown file, keeping each URL's assets self-contained.

## Adapters & Media

See [references/adapters.md](references/adapters.md) for the adapter catalog (X, YouTube, Hacker News, generic), per-adapter notes, the media download flow (`ask` / always / never), and the JSON output schema. Read it before answering adapter-specific questions or handling media prompts.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `URL_TO_MARKDOWN_CHROME_PROFILE_DIR` | Chrome user data directory (can also use `--chrome-profile-dir`) |

**Troubleshooting**: Chrome not found → use `--browser-path`. Timeout on a public page → increase `--timeout`. Login/CAPTCHA → report unsupported and stop. Debug → `--debug-dir` to inspect successful captures.

## Extension Support

Custom configurations via EXTEND.md. See **Preferences** section above for paths and supported keys.
