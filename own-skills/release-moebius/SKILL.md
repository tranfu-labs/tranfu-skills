---
name: release-moebius
description: Publish the Moebius repository's current main branch as a versioned GitHub Release with synchronized package versions, CHANGELOG, tests, signed macOS arm64 DMG/ZIP artifacts, tag, hashes, and remote verification. Use when the user says “发布 Moebius”, “把当前 main 发布为 X 版本”, “release version X”, or asks to perform the complete Moebius desktop release. Do not use for feature development, release planning without execution, non-Moebius repositories, website-only deployment, or publishing Windows, Linux, x64, or universal artifacts.
version: 0.1.0
author: aquarius-wing
updated_at: 2026-07-26
origin: own
---

# Release Moebius

Publish one production version of `tranfu-labs/moebius`. The required input is a semantic version without the `v` prefix. The named output is a verified, non-draft GitHub Release `v<VERSION>`.

Ownership is **edit file + external publish**: the user's release request authorizes release-metadata edits, commit, annotated tag, push, and GitHub Release creation. NEVER modify product behavior or unrelated files.

## Workflow

CREATE A TODO LIST FOR THE TASKS BELOW and update it after every step.

1. Validate the input and environment.
   - If the version is missing or invalid → ask for it and exit.
   - If the repository is not Moebius → report the mismatch and exit.
   - Load nvm with `export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && source "$NVM_DIR/nvm.sh"`, then run `nvm use`.
   - Assert Node major `24` and pnpm `9.15.4`; keep this environment for every pnpm command.
   - Assert `gh auth status` has repository write access.
2. Validate Git state.
   - Require branch `main` and no unrelated uncommitted changes.
   - Fetch `origin/main` and tags.
   - If local `main` is behind or diverged → stop and report; NEVER merge automatically.
   - If `v<VERSION>` already exists locally or remotely → stop and report.
   - Read the previous `v*` tag, its GitHub Release, and the real commit diff through current `main`.
   - If `<VERSION>` is not greater than the previous semantic version → stop and report.
3. Prepare release metadata.
   - Set `<VERSION>` in `package.json`, `desktop/package.json`, `packages/console-ui/package.json`, and `prototypes/package.json`.
   - Update `CHANGELOG.md` in Keep a Changelog format using only changes since the previous tag.
   - Keep `[Unreleased]` and update compare links.
4. Run release gates under Node 24.
   - Run `pnpm install --frozen-lockfile`.
   - Run `pnpm test`, `pnpm typecheck`, and `pnpm --filter @moebius/prototypes check`.
   - Run `pnpm --filter @moebius/desktop dist` only after all checks pass.
   - Redirect long output to `/tmp` logs and read only exit codes and relevant tails.
   - If any gate fails → stop before commit, tag, push, or Release creation.
5. Verify local artifacts.
   - Require both target-versioned macOS arm64 DMG and ZIP; upload exactly those two files and no blockmaps or older artifacts.
   - Verify the DMG with `hdiutil verify`.
   - Verify the app with `codesign --verify --deep --strict --verbose=2`.
   - Inspect the signature details and require Developer ID Team `NP667JFK84`.
   - Assert bundle version and build equal `<VERSION>` and the executable is arm64.
   - Record both file sizes and SHA-256 hashes.
   - If electron-builder download traffic has no byte progress for 120 seconds, first confirm no active `codesign`; then terminate only the stalled builder and retry the missing format from `desktop/release/mac-arm64/Moebius.app` with `--prepackaged`.
6. Commit and push.
   - Run `git diff --check` and require only expected release metadata changes.
   - Commit as `chore(release): prepare v<VERSION>`.
   - Fetch again; if remote moved → stop before tagging.
   - Create annotated tag `v<VERSION>` with message `Moebius v<VERSION>`.
   - Atomically push `main` and the tag.
7. Create and publish the GitHub Release.
   - Create a verified-tag Draft Release in `tranfu-labs/moebius`, titled `Moebius v<VERSION>`.
   - Write Chinese notes from the previous-tag diff. Include macOS arm64-only support, Developer ID Team `NP667JFK84`, current lack of notarization, and both SHA-256 hashes.
   - Upload only the DMG and ZIP. Distinct uploads may run in parallel; retry only the missing asset.
   - If either upload fails → keep the Draft and report the resumable state.
   - Compare GitHub asset names, sizes, states, and digests with local artifacts. Publish the Draft only when all match.
8. Verify completion.
   - Require `isDraft=false`, `isPrerelease=false`, tag and `main` at the release commit, two uploaded assets with matching digests, synchronized `main`, and a clean worktree.
   - Output the Release URL, commit/tag, gate results, signing and architecture results, artifact sizes/hashes, notarization status, and remaining risks; then end.

## Failure paths

- Missing tools, credentials, version, files, or signing identity → stop before external mutation and name the missing requirement.
- Dirty worktree with unrelated changes → stop; NEVER stash, overwrite, or delete them.
- Failure after Draft creation → leave the Draft intact, list uploaded/missing assets, and give the exact resume step.
- Unexpected tracked files produced by validation → stop and report. Remove only untracked artifacts proven to be created by this run.

<example>
User: “把当前 main 发布为 0.1.2。”

Result: activate Node 24, derive notes from the previous tag, update versions and CHANGELOG, pass all gates, build and verify signed arm64 DMG/ZIP, atomically push `main` plus `v0.1.2`, publish a digest-verified GitHub Release, and return its URL.
</example>

<bad-example>
WRONG: Tests fail, but create `v0.1.2` and upload the ZIP first so the release is partially available.

Reason: a production release requires every gate and both verified artifacts; failures must stop before tag/publish, or leave an explicitly resumable Draft if upload already started.
</bad-example>
