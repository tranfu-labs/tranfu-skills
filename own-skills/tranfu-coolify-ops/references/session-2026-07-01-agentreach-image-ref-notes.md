# Session note: agentreach-app IMAGE_REF immutable GHCR flow

Context: `tranfu-labs/agentreach-app` had a 0.8 Application deployment but `compose.yml` still used a mutable runtime tag:

```yaml
image: ghcr.io/tranfu-labs/agentreach-app:${IMAGE_TAG:-latest}
```

The repository workflow pushed both `latest` and a sha tag, then POSTed Coolify deploy directly. Coolify therefore could redeploy a mutable tag or cached image rather than a traceable immutable image.

## Fix pattern that worked

1. In `compose.yml`, make the app service read the exact runtime image from Coolify env and force pulling:

```yaml
image: ${IMAGE_REF:-ghcr.io/tranfu-labs/agentreach-app:latest}
pull_policy: always
```

2. In `.github/workflows/deploy.yml`, compute a sha tag after GHCR login and before `docker/build-push-action`:

```bash
if [ -n "$IMAGE_TAG_SHA_PREFIX" ]; then
  SHA_TAG="${IMAGE_TAG_SHA_PREFIX}${GITHUB_SHA}"
else
  SHA_TAG="sha-${GITHUB_SHA}"
fi
IMAGE_REF="${REGISTRY}/${IMAGE_NAME}:${SHA_TAG}"
echo "sha_tag=$SHA_TAG" >> "$GITHUB_OUTPUT"
echo "image_ref=$IMAGE_REF" >> "$GITHUB_OUTPUT"
echo "SHA_TAG=$SHA_TAG" >> "$GITHUB_ENV"
echo "IMAGE_REF=$IMAGE_REF" >> "$GITHUB_ENV"
```

3. Push both tags:

```yaml
tags: |
  ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ env.IMAGE_TAG_ROLLING }}
  ${{ steps.image.outputs.image_ref }}
```

4. Before `POST /api/v1/deploy`, write Coolify Application env `IMAGE_REF=<immutable image ref>` with `is_literal=true`.

## Pitfalls observed

- `GET /api/v1/applications` filtered by `name + project_uuid` may fail to locate an already-onboarded Application even when the GitHub environment var `COOLIFY_APP_UUID` points to the right Application. For update/repair flows, if Step 1 cannot find an Application but repo `main` environment has `COOLIFY_APP_UUID`, treat it as a scoped candidate and validate by `GET /api/v1/applications/$COOLIFY_APP_UUID` (`git_repository`, `git_branch`, `build_pack`, `docker_compose_location`) before proceeding.
- After the first workflow run, Coolify showed two `IMAGE_REF` env records with the same value hash. Do not auto-delete duplicates. Deleting envs is a reversible-ops-sensitive write. Prefer making the workflow writer deterministic: list envs for key `IMAGE_REF` first, then PATCH a single known record or fail loudly if duplicates exist, and give the user a separate cleanup command/template.
- Tool/log renderers may mask `Authorization: Bearer $TOKEN` as `Authorization: Bearer ***`. Before assuming the file was corrupted, verify the actual file content locally (e.g. assert it contains `Bearer $TOKEN` and not the literal masked header).

## Verification used

- Local checks: `compose.yml` uses `IMAGE_REF`, contains `pull_policy: always`, has no `build:`, workflow writes `IMAGE_REF` before deploy, YAML parses, `git diff --check` passes.
- GitHub: `gh variable list --env main` should show `COOLIFY_APP_UUID`, `IMAGE_TAG_ROLLING`, `IMAGE_TAG_SHA_PREFIX` (usually `sha-`).
- Coolify: Application status `running:healthy`; `IMAGE_REF` value shape `ghcr.io/tranfu-labs/<repo>:sha-<sha>` (hash/shape only, do not print full value).
- Public: project domain returns 2xx/3xx.
