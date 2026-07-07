# OfferPilot ASR unhealthy after multi-service deploy (2026-07-05)

## Symptom

`offerpilot-app` public domain returned `503 no available server`; Coolify Application was `exited:unhealthy`.

Latest deployment logs showed the multi-service compose starting `web`, `agent`, and `asr`, then failing on the ASR dependency:

```text
Container asr-<app_uuid>-<suffix>  Started
Container asr-<app_uuid>-<suffix>  Waiting
Container asr-<app_uuid>-<suffix>  Error
Container agent-<app_uuid>-<suffix>  Healthy
dependency failed to start: container asr-<app_uuid>-<suffix> is unhealthy
exit status 1
```

`coolify app logs <uuid> --lines N` returned `Application is not running`, so the useful evidence was in `coolify app deployments logs <uuid> <deployment_uuid>`.

## Diagnosis pattern

1. Read `compose.yml` from GitHub (use `gh api repos/<org>/<repo>/contents/compose.yml --jq .content | base64 -d` if `git clone` is slow/unavailable).
2. Check the failing service healthcheck. In this case `asr` healthcheck only hit `http://127.0.0.1:8765/health`, which does not contact Qwen; therefore the failure was process startup/import, not ASR network/auth.
3. Inspect ASR service imports and requirements. `services/asr-gateway/app/providers/qwen_realtime.py` and `qwen_omni_realtime.py` imported `websocket`, but `services/asr-gateway/requirements.txt` only had `websockets` and lacked `websocket-client`.

## Fix

Add the missing runtime dependency:

```text
websocket-client==1.8.0
```

to `services/asr-gateway/requirements.txt`, then let GHA build/push the new image and trigger Coolify deploy.

## Verification

After the new image deploys, verify all three:

```bash
coolify app get <app_uuid>   # running:healthy
curl -k -sS -o /tmp/out -w '%{http_code}' https://offerpilot-app.tranfu.com/
curl -k -sS https://offerpilot-app.tranfu.com/asr-healthz
```

Expected ASR health response includes:

```json
{"status":"ok","provider":"qwen_realtime"}
```

## Related pitfall

OfferPilot had duplicate Coolify env keys (including `IMAGE_REF`, `ASR_*`, `LLM_*`). Do not auto-delete duplicates during incident recovery: deletion is a risky cleanup operation. If duplicate values differ, normalize the active key/value needed for deployment and defer duplicate cleanup to an explicit maintenance step.