# Session note: Coolify deployment `finished` but Application `exited:unhealthy`

Context: `tranfu-labs/college-fit-app` was pushed to `main` and GitHub Actions `Build, Publish, and Deploy` succeeded. The workflow pushed an immutable GHCR image tag and POSTed Coolify deploy. Coolify deployment record was `finished`, but the Application ended as `exited:unhealthy` and public routes returned `503 no available server`.

## Durable lesson

For Tranfu Coolify app updates, **GHA success + Coolify deployment `finished` is not sufficient proof of a working deployment**. Treat those as delivery/build signals only. The final acceptance gate remains:

1. `coolify app get <app_uuid> --context local-coolify --format json` shows `status` running/healthy (or equivalent healthy state).
2. Public URL / health endpoint returns 2xx/3xx.
3. If the app is `restarting:unknown`, keep polling briefly; it may settle to `exited:unhealthy` after Coolify has already marked the deployment record `finished`.

## Useful read-only evidence sequence

```bash
APP=<application_uuid>
REPO=tranfu-labs/<repo>-app
RUN=<gha_run_id>
DEPLOYMENT=<coolify_deployment_uuid>

# GitHub: confirm latest commit, workflow status, and IMAGE_REF/deploy POST evidence
gh run view -R "$REPO" "$RUN" --json status,conclusion,createdAt,updatedAt,headSha,url,jobs \
  | jq '{status,conclusion,createdAt,updatedAt,headSha,url,jobs:[.jobs[]|{name,conclusion,status,startedAt,completedAt}]}'

gh run view -R "$REPO" "$RUN" --log \
  | grep -E 'IMAGE_REF|deploy|Coolify|error|failed|success|sha-' \
  | tail -120

# Coolify: deployment record and app runtime status are separate signals
coolify app deployments list "$APP" --context local-coolify --format json \
  | jq -r '.[0:8][]? | [.id,.deployment_uuid,.status,.commit,.created_at,.updated_at] | @tsv'

coolify app deployments logs "$APP" "$DEPLOYMENT" --context local-coolify --lines 240

coolify app get "$APP" --context local-coolify --format json \
  | jq '{uuid,name,status,git_repository,git_branch,fqdn,docker_compose_domains,ports_exposes}'

curl -sS -I --max-time 20 https://<public-domain>/ | sed -n '1,12p'
curl -sS -i --max-time 20 https://<public-domain>/healthz | sed -n '1,30p'
```

## Pitfalls

- Deployment logs may end with `New container started` and still later settle to `exited:unhealthy`.
- `coolify app logs <app_uuid>` can fail with `Application is not running` when the runtime container exited; do not stop there. Use deployment logs first, then collect one-shot Docker/container logs under the `reversible-ops` read-only rules if container identity is available.
- Public root `/` may briefly return an old 200 during a rollout window. Verify the intended health or feature route after the new deployment settles.
- If the latest change introduced runtime data bootstrap (volumes, mounted data packages, DB initialization, health checks), prioritize startup/runtime logs over re-running GHA: the image may already be built and deployed correctly while the process exits at runtime.
