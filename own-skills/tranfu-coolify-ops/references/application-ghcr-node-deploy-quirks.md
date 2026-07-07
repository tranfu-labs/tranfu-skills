# Application + GHCR + Node deploy quirks

Session-derived notes for `tranfu-coolify-ops` deployments of Node/TypeScript apps via Coolify Application + dockercompose + GHCR.

## Coolify Application API quirks

- On the current Tranfu Coolify instance, `POST /api/v1/applications/private-github-app` rejected `docker_compose_location: "compose.yml"` with `422 docker compose location field format is invalid`; `"/compose.yml"` succeeded. Treat the repo file as `compose.yml`, but send `/compose.yml` in the Application API body unless a newer Coolify version proves otherwise.
- The `GET /api/v1/applications/{uuid}` response may echo `github_app_uuid` / `is_auto_deploy_enabled` as `null` even for an Application created through `private-github-app`. Do not PATCH `github_app_uuid` afterward; this endpoint can reject it as `This field is not allowed`. Validate the binding by `git_repository`, `git_branch`, `build_pack`, deployment logs, and successful deploy rather than hard-failing solely on those echoed null fields.
- `ports_exposes` can default to `80` even for dockercompose; patch it to the main container port (e.g. `3000`) while still in bootstrap if needed, after saving a before snapshot.
- For Application env writes, current Coolify accepts payloads like `{key,value,is_literal}`. Extra fields such as `is_build_time` or `is_preview` can fail with `422 This field is not allowed`; keep the GHA `IMAGE_REF` write payload minimal.
- **GitHub Actions may show secrets as present but pass an empty/wrong value to the job if they were set from a masked or malformed local env. After any GHA `COOLIFY_API_TOKEN` 401, verify the local token against `/api/v1/version` without printing it, then re-run `gh secret set COOLIFY_API_TOKEN --body "$COOLIFY_API_TOKEN"` and rerun the failed workflow. Do not change the repo workflow first unless the log proves a header/payload bug.
- **Subagent-generated workflow files need a final readback before commit.** Check that authorization headers still contain `Bearer $TOKEN` (not a masked literal / malformed quote) and that the IMAGE_REF PATCH step captures HTTP 404 without `--fail-with-body` exiting before the POST fallback. A good pattern is `curl -sS -o /tmp/response.json -w "%{http_code}" -X PATCH ... || true`, then if code is `404`, run POST and check its HTTP status explicitly.

## GitHub variables / workflow quirks

- GitHub environment variables cannot be set to an empty string. `gh variable set IMAGE_TAG_SHA_PREFIX --body ""` / REST create with empty `value` returns 422. For production, either omit `IMAGE_TAG_SHA_PREFIX` and use `${{ vars.IMAGE_TAG_SHA_PREFIX || '' }}` in workflow env, or set a non-empty prefix such as `sha-`.
- If `package.json` contains `"packageManager": "pnpm@..."`, do not also set `with: version:` on `pnpm/action-setup@v4`; the action fails with “Multiple versions of pnpm specified”. Let the action read `packageManager`.

## pnpm native module builds

- pnpm 10/11 style build approval can block native modules such as `better-sqlite3`, producing runtime/test errors like “Could not locate the bindings file”. For deployable Node apps using native modules, pin a pnpm version compatible with the lockfile (e.g. `packageManager: pnpm@9.15.9`) and include a workspace policy such as:

```yaml
packages:
  - .

onlyBuiltDependencies:
  - better-sqlite3
  - esbuild
```

- Do not blindly add workspace packages such as `site` unless the root lockfile is current for them; `pnpm install --frozen-lockfile` can then fail because subpackage specs are not represented in the root lockfile.

## GHCR private package gate

- A successful GHA push to GHCR does not prove Coolify can pull the image. If the GHCR container package is private and Coolify lacks a `ghcr.io` registry credential, deployment may appear to finish but the app will not remain running. Probe with `docker pull ghcr.io/<org>/<repo>:latest` or require explicit registry credential confirmation before proceeding.

## Docker Compose image pull freshness

- For Application + dockercompose where the main service uses a mutable tag such as `image: ghcr.io/<org>/<repo>:latest`, Coolify may clone the new commit and run `docker compose up -d` but still reuse an already-present local `latest` image if Compose does not pull it. Symptom: deployment record is `finished` at the new commit and starts a new container, while `docker inspect <container>` shows `Config.Image=...:latest` but the image `RepoDigest`/created time is from an older build and differs from GHCR `latest`.
- Prevent this by making the main service `image: ${IMAGE_REF:-ghcr.io/<org>/<repo>:latest}` plus `pull_policy: always`, and by having deploy workflow PATCH Coolify app env `IMAGE_REF=ghcr.io/<org>/<repo>:sha-<commit>` after GHCR push and before POST `/deploy`. `latest` remains only a fallback/rolling convenience tag, not the production source of truth.
- For one-off recovery on an old app that still uses bare `latest`, first tag the currently local image as a timestamped backup, then `docker pull ghcr.io/<org>/<repo>:latest`, then trigger/recreate the Coolify deployment. Prefer migrating the repo to the `IMAGE_REF` template afterward.
