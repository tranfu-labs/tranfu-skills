# Session note: legacy Service with `project_uuid=null` can block 0.8 Application onboarding

Date: 2026-07-02
Repo anchor: `tranfu-labs/offerpilot-app`

## What happened

During a `tranfu-coolify-ops` 0.8 reconcile attempt, hard scope and preflight passed for `tranfu-labs/offerpilot-app`.

Read-only discovery found:

- Same-name Project existed: `offerpilot-app`
- No same-name 0.8 Application was found by `name + project_uuid`
- No Application was found by fallback anchors (`git_repository`, domain/fqdn containing `offerpilot-app`)
- A legacy Service existed with:
  - `name = offerpilot-app`
  - `status = running:healthy`
  - `project_uuid = null`

The original Step 1 legacy-service guard only checked `name == APP_NAME and project_uuid == PROJECT_UUID`, which would miss this kind of orphan/legacy Service and could incorrectly continue toward Application initialization.

## Durable lesson

When Application is absent, legacy Service detection must include name-only fallback for `project_uuid == null` or missing `project_uuid`, not just `name + project_uuid`.

Do not create a new 0.8 Application if a same-name legacy Service exists with `project_uuid=null`. Stop and report that skill 0.8 does not接管旧 Service; user must manually decide/handle the legacy Service first.

## Suggested Step 1 check shape

After failing to find an Application, check services as:

```bash
LEGACY_SVC=$(curl -sS -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/services" \
  | jq -r --arg n "$APP_NAME" --arg p "$PROJECT_UUID" '
      [.[] | select(
        .name == $n and (
          .project_uuid == $p or .project_uuid == null or (.project_uuid // "") == ""
        )
      )][0].uuid // ""')
```

If found, stop before clone/create/write actions and explain the boundary.

## Reporting wording

Use wording like:

> Coolify has no 0.8 Application for `<repo>`, but it does have a same-name legacy Service (`<uuid>`, status `<status>`, project_uuid null). Per skill 0.8, I will not接管 or migrate this Service, and I will not create a parallel Application over it. Please manually decide how to handle the legacy Service, then rerun the reconcile flow.
