# Session note: offerpilot-app empty Coolify project onboarding

Date: 2026-07-02
Repo: `tranfu-labs/offerpilot-app`

## Durable deployment observations

- Scope check passes for the supported Tranfu path: owner `tranfu-labs`, repo `offerpilot-app` matches `^[a-z][a-z0-9-]*-app$`.
- Coolify already had a same-name project `offerpilot-app`, but Step 1 found no same-name Application and no same-name legacy Service. Treat this as an **empty-shell project** and run the initialization branch while reusing the existing `PROJECT_UUID`; do not create a second project and do not ask the user to pick from a project list.
- The repository initially had no deployment four-piece (`Dockerfile`, `.dockerignore`, `compose.yml`, `.github/workflows/deploy.yml`). Use the normal Step 3I subagent path to generate them.
- Repo shape at onboarding time:
  - npm workspace root package name `offerpilot-asr-mvp`
  - web app workspace: `apps/web-transcription-demo`
  - root build script: `npm --workspace apps/web-transcription-demo run build`
  - root typecheck script: `npm --workspace apps/web-transcription-demo run typecheck`
  - Vite React static frontend is the deployable web surface for the first Application path.
- Product safety boundary is explicit in `AGENTS.md`: mock interview training / authorized recording / review only; do not implement or promote hidden live-interview assistance, stealth overlays, anti-detection UX, covert recording, or automated answer delivery for bypassing interview rules.

## Workflow reminders

- Keep clone work in `mktemp -d`; never require user cwd.
- For an empty-shell project, Step 4I must skip project creation and reuse the discovered `PROJECT_UUID` when creating the Application.
- If preflight is run non-interactively, GHCR credential acknowledgement may remain a manual warning; report it as an outstanding UI prerequisite rather than treating it as proof GHCR is missing.
