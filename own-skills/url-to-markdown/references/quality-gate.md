# Quality Gate & Failure Handling

Read after every capture. A successful exit is provisional until the saved Markdown or JSON `markdown` field contains the target page rather than a shell, access wall, or framework payload.

## Checks the Agent Must Run

1. Confirm the title matches the target page, not a generic site shell.
2. Confirm the body contains the expected article or page content, not only navigation, footer, or an error.
3. Reject obvious failure signs:
   - `Application error`
   - `This page could not be found`
   - Login, signup, subscribe, CAPTCHA, Cloudflare, or verification shells
   - Extremely short Markdown for an expected long-form page
   - Raw framework payloads or mostly boilerplate content
4. NEVER accept a run as successful only because the CLI exited `0`.

## Failure Workflow

Treat this workflow as the quality-gate portion of stage 5 in the parent `SKILL.md` TODO and update that stage instead of creating a second TODO list.

1. Run the normal non-interactive capture.
2. If the CLI exits non-zero, preserve its stderr, confirm no output file was created, report the failure, and stop.
3. If the CLI exits `0`, inspect the saved content immediately.
4. If the content is an access wall or unusable shell, delete that unusable output, report that the page is unsupported, and stop.
5. If a public page only timed out, retry once with `--timeout 60000`; if the retry fails, report the timeout and stop.

NEVER ask the user to log in, solve a CAPTCHA, complete Cloudflare verification, press Enter, or operate a browser window.

## Browser Reuse Boundary

`--cdp-url`, `--chrome-profile-dir`, and `URL_TO_MARKDOWN_CHROME_PROFILE_DIR` remain available for general Chrome reuse. Existing browser state may already contain cookies, but the Skill MUST NOT initiate login or export, restore, inspect, or manage authentication cookies or session state.
