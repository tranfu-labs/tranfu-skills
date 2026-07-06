# Session notes: alphaos-app 0.8 URL verification and workflow watch quirks (2026-07-01)

Scope: `tranfu-labs/alphaos-app` deployed as a Coolify Application (`private-github-app` + `dockercompose`) using the `web` service as the public surface.

## Public URL derivation pitfall

For dockercompose Applications, do not rely on top-level `fqdn` or `.applications[0].fqdn` as the only source for Step 10 public checks.

Observed on current Tranfu Coolify:

- Application GET returned top-level `fqdn` as an auto-generated fallback:
  `http://<app_uuid>.120.77.223.183.sslip.io`
- `.applications` was `null`
- The real product domain was stored in `docker_compose_domains` as a JSON-encoded string:
  `{"web":{"domain":"https://alphaos-app.tranfu.com:3300"}}`
- The real public check was `https://alphaos-app.tranfu.com` (strip container port for HTTPS), which eventually returned HTTP 200.

Recommended Step 10 order:

1. Parse `docker_compose_domains` first. Accept both native array/object and JSON-encoded string forms.
2. For object form, use the intended public service entry (for alphaos-app: `web`) or first entry if there is only one.
3. Strip the container port suffix before external HTTPS curl.
4. Fall back to `.applications[0].fqdn` / top-level `.fqdn` only if `docker_compose_domains` has no usable domain.

Example jq shape:

```bash
PUBLIC_URL=$(echo "$APP_JSON" | jq -r '
  def parse_domains:
    if (.docker_compose_domains | type) == "string" then
      (.docker_compose_domains | fromjson?)
    else
      .docker_compose_domains
    end;
  (parse_domains
    | if type == "array" then .[0].domain
      elif type == "object" then (to_entries[0].value.domain // to_entries[0].value.url)
      else empty end)
  // (.applications[0].fqdn? // .fqdn // empty)
' | sed -E 's#:[0-9]+/?$##')
```

## GitHub Actions watch verification pitfall

A background `gh run watch --exit-status` notification can surface an intermediate-looking failure while the run is still finalizing. Before reporting failure or starting a fix, verify the terminal state with:

```bash
gh run view <run-id> --json status,conclusion,url --jq .
```

Only read `--log-failed` once `status == completed`; otherwise logs may be unavailable or stale. In this session, `gh run watch` reported a build failure notification, but a subsequent `gh run view` showed the run still `in_progress` and then `completed:success`.

## Noise filter for silent-fail log scan

The generic Step 8 grep for `missing|undefined|not set|...` can catch benign GitHub action post-step lines such as `State not set`. Treat those as noise when the workflow conclusion is success and required deploy steps completed.
