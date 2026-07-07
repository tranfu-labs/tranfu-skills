# Hermes Bearer Header Redaction Pitfall

## Context

When preparing Coolify GitHub Actions workflows from inside Hermes ops sessions, writing a literal header line like:

```yaml
-H "Authorization: Bearer $TOKEN" \
```

can be transformed by the session/tool redaction layer into a broken masked string such as `Authorization: Bearer ***`, sometimes even inside files or generated patches. That makes the committed workflow invalid or unauthenticated.

This is not a Coolify or curl bug; it is a safety redaction interaction while generating deployment artifacts.

## Durable workaround

Use curl's option that avoids writing the Authorization header text:

```bash
curl -sSL --fail-with-body -X POST \
  --oauth2-bearer "$TOKEN" \
  "$BASE/api/v1/deploy?uuid=$COOLIFY_APP_UUID&force=false"
```

For JSON PATCH/POST requests:

```bash
curl -sS -o /tmp/coolify-response.json -w "%{http_code}" -X PATCH \
  --oauth2-bearer "$TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "$BASE/api/v1/applications/$COOLIFY_APP_UUID/envs"
```

## Required static checks

Before committing generated workflow files, verify:

```bash
WF=.github/workflows/deploy.yml
! grep -q '\*\*\*' "$WF"
grep -q -- '--oauth2-bearer "$TOKEN"' "$WF"
grep -q 'Update Coolify IMAGE_REF' "$WF"
grep -q 'Trigger Coolify deploy' "$WF"
```

## Scope

Apply this when generating or patching deployment workflows in Hermes conversations. Existing upstream templates may still show explicit `Authorization` headers; prefer `--oauth2-bearer` in final artifacts produced through this environment.
