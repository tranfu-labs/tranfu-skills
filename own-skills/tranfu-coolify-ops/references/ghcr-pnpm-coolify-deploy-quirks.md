# GHCR + pnpm + Coolify deploy quirks

Session-derived deployment notes from `tranfu-labs/agentreach-app` that generalize to other Tranfu `*-app` deployments.

## Private GHCR package pull failures

Symptom pattern:

- GitHub Actions build/push succeeds.
- Coolify deploy record may say `finished` and show container `Started`, but Application later becomes `exited:unhealthy` or no matching app container remains.
- `docker pull ghcr.io/<org>/<repo>:latest` on the deployment host returns `unauthorized`.
- GitHub package visibility is `private`.

Durable lesson:

- Treat GHCR pull credentials as a deployment-host/Coolify runtime prerequisite, not just a GHA prerequisite.
- `docker login ghcr.io` as the Hermes/Linux user proves the token works, but does not necessarily prove Coolify can pull: Coolify helper deployments may mount `/root/.docker/config.json`.
- Under `reversible-ops`, do not silently write `/root/.docker/config.json`. If root/Coolify Docker auth must be changed, give the user a backup-first command to run manually, or have them configure Coolify UI → Sources / Container Registries → `ghcr.io`.

Safe diagnostic commands/patterns:

```bash
# Does the token itself have package read access? Do not print token.
set -a; . /home/hermes/.hermes/profiles/ops/.env; set +a
echo "$GH_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin
docker pull ghcr.io/tranfu-labs/<repo>:latest
```

If the current user pull works but Coolify still cannot pull, suspect the root/Coolify Docker config rather than the token.

## GitHub environment variable cannot be empty

`gh variable set IMAGE_TAG_SHA_PREFIX --env main --body ""` can fail with HTTP 422 (`Variable value cannot be empty`). Prefer a non-empty prefix such as `sha-`, or write workflow logic that defaults an unset variable to an empty string.

## pnpm packageManager vs pnpm/action-setup

If `package.json` has:

```json
"packageManager": "pnpm@9.15.9"
```

then `pnpm/action-setup@v4` should not also specify `with: version: 9`; the action fails with “Multiple versions of pnpm specified”. Let the action read `packageManager`, or omit `packageManager` and specify the workflow version — do not do both.

## pnpm native dependency builds

For apps using native dependencies such as `better-sqlite3`, pnpm’s build-script approval policy can leave bindings unbuilt and tests fail with “Could not locate the bindings file”. This should be treated as a deterministic repo-shape fix, not as an ad-hoc debugging task.

Recognition rules:

- `package.json` dependencies/devDependencies contains one or more native packages, especially:
  - `better-sqlite3`
  - `esbuild`
  - `sharp`
  - `bcrypt`
  - `sqlite3`
- and package manager is pnpm (`pnpm-lock.yaml` exists or `packageManager` starts with `pnpm@`).
- and one of these symptoms appears:
  - `pnpm install` reports `Ignored build scripts`.
  - tests/runtime fail with `Could not locate the bindings file`.
  - native package has no compiled `.node` artifact under `node_modules`.

Modification rule:

1. Ensure `package.json` has one authoritative pnpm version, for example:

   ```json
   "packageManager": "pnpm@9.15.9"
   ```

2. Ensure `pnpm-workspace.yaml` exists and explicitly allows the native build dependencies that are actually present in `package.json` / lockfile:

   ```yaml
   packages:
     - .

   onlyBuiltDependencies:
     - better-sqlite3
     - esbuild
   ```

3. If the repo contains unrelated subpackages such as `site/`, only add them to `packages:` when their package specs are represented in the root lockfile. Otherwise `pnpm install --frozen-lockfile` fails on CI.

4. In GitHub Actions, if `packageManager` is present, use `pnpm/action-setup@v4` without `with.version`; do not specify pnpm twice.

Verification rule:

```bash
pnpm install --frozen-lockfile
pnpm typecheck   # if script exists
pnpm test        # if script exists
```

For `better-sqlite3`, a quick targeted smoke check is:

```bash
node -e "import('better-sqlite3').then(({default: Database}) => { const db = new Database(':memory:'); db.prepare('select 1').get(); db.close(); console.log('better-sqlite3 ok') })"
```

Do not include unrelated workspace packages if their package specs are not represented in the root lockfile; `pnpm install --frozen-lockfile` will fail on CI.

## Coolify API field quirks observed

- Creating Application with `docker_compose_location: "compose.yml"` can 422 as invalid; `"/compose.yml"` was accepted.
- Creating dockercompose Application may default `ports_exposes` to `80` even if a different port was sent; a bootstrap-window PATCH of `ports_exposes` to the real port can be required.
- Some GET fields (`github_app_uuid`, `is_auto_deploy_enabled`) may return `null` even when git binding/build pack work. Do not hard-fail solely on those nulls if `git_repository`, `git_branch`, `build_pack`, deployment import, and GHA trigger are behaving; record the discrepancy and continue with observable deployment checks.
