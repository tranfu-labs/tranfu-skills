# tranfu-agents-app dev branch deployment notes (2026-07-05)

Use this as a pattern when the user asks for a dev/staging environment that must not affect main/production.

## What mattered

- Treat dev as a separate Coolify Application, not a mutation of the production `main` Application.
- Anchor identity by `git_repository + git_branch + expected dev domain`; do not select by repository alone because production and dev share the same repo.
- Create or reuse GitHub Environment `dev` and store deploy values as environment-level vars:
  - `COOLIFY_APP_UUID=<dev application uuid>`
  - `IMAGE_TAG_ROLLING=dev`
  - `IMAGE_TAG_SHA_PREFIX=dev-`
- Workflow must use `jobs.<job>.environment: ${{ github.ref_name }}` and read `${{ vars.COOLIFY_APP_UUID }}`. Do not hardcode the Coolify UUID in workflow `env:` for branch-specific deployments.
- `compose.yml` should use `image: ${IMAGE_REF:-ghcr.io/<org>/<repo>:dev}` plus `pull_policy: always`, so CI can set the exact immutable `IMAGE_REF` before triggering Coolify.
- If a legacy dev workflow only pushes `:dev` and directly POSTs deploy, update it to first PATCH/POST Application env `IMAGE_REF=ghcr.io/<org>/<repo>:dev-<sha>`, then POST `/api/v1/deploy`.

## Verification pattern

1. Confirm `dev` branch exists via GitHub refs.
2. List candidates for the dev branch/domain before creating anything.
3. Verify production candidate remains `main` and healthy.
4. Configure GitHub Environment `dev` vars before running the workflow.
5. Watch the latest `deploy.yml` run on branch `dev` and verify log contains both `Update Coolify IMAGE_REF` and `Trigger Coolify deploy`.
6. For public verification, use GET as well as HEAD; some apps return `405` to HEAD while GET `/` and `/healthz` are healthy.
7. Re-check production `/` and `/healthz` after dev is live.

## Pitfalls observed

- A stale hardcoded Coolify UUID in the dev workflow pointed to no existing Application/Service. Branch-specific deploys must use GitHub Environment vars so recreating the dev Application only requires var updates.
- GitHub HTTPS clone may be flaky from ops hosts. If clone fails but `gh api` works, use the GitHub Contents API to inspect or update small files on the target branch, with static validation before PUT.
- GitHub Actions logs can contain benign `State not set` post-step lines. Do not classify those as missing-variable failures unless the deploy/config validation steps actually failed.
