# Production Release Runbook

Date: 2026-04-16
Status: active
Scope: release execution checklist after staging reached `conditional go`

## Release Position

- Current release posture is `conditional go`.
- The missing non-local staging gate is closed by the approved 5-user staging slice.
- The main remaining warning is checkout latency concentrated on the reservation path:
  - staging `http_req_duration p95 ~2.18s` on the approved 5-user slice
  - local checkout benchmark `T-10.3` still above historical target and remains engineering backlog, not the final release blocker by itself

## Release Preconditions

All items below should be true before production deploy starts:

1. `STAGING_VALIDATION.md` still reflects `conditional go` and no new blocker has appeared.
2. CI baseline remains green for build, lint, format, typecheck, and the current local regression suite.
3. Production secrets and public build-time env are available as documented in `README.md`.
4. Release owner accepts the remaining reservation-latency warning and is prepared to monitor it closely after deploy.
5. External uptime monitor for `https://api.jeevatix.com/health` is already enabled or will be enabled immediately after deploy.

## Pre-Deploy Checklist

1. Confirm the intended commit SHA for release.
2. Export `APP_VERSION` to that exact SHA for manual deploy flows.
3. Confirm `PUBLIC_API_BASE_URL` and `PUBLIC_PARTYKIT_HOST` are set for the production build.
4. Confirm `DATABASE_URL`, `JWT_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `EMAIL_API_KEY`, `EMAIL_FROM`, and `UPLOAD_PUBLIC_URL` are present.
5. Confirm production domains resolve to the intended target values for buyer, admin, seller, and API.
6. Confirm no pending remote load test or synthetic cleanup task is still touching staging or production.

## Deploy Sequence

Example manual release sequence:

```bash
pnpm run build
export APP_VERSION="$(git rev-parse HEAD)"
pnpm run deploy --stage production
```

If deploy runs through CI instead of a local shell, verify the same env contract is provided by the workflow.

## Immediate Post-Deploy Smoke

Run these checks as close to deploy completion as possible:

1. `curl -fsS https://api.jeevatix.com/health`
2. Open buyer homepage and buyer events listing.
3. Open admin login page.
4. Open seller login page.
5. Hit one public browse API call such as `https://api.jeevatix.com/events?limit=8&page=1`.

Expected minimum result:

- API health returns `status`, `timestamp`, `version`, `environment`, and `service`
- buyer/admin/seller public entry routes respond successfully
- public events listing responds without `500`

## First 30-Minute Monitoring Window

During the initial release window, focus on these watchpoints:

1. Tail Cloudflare error logs for the production API worker and watch for bursts of `http.server_error` or `http.unhandled_exception`.
2. Record at least one `X-Request-Id` from a successful smoke request and keep it ready for correlation if an incident appears.
3. Watch reservation-heavy buyer traffic most closely because reservation latency is the known warning area.
4. Watch for repeated checkout complaints, spikes in failed reservation attempts, or abnormal payment-confirmation lag.
5. Confirm the external uptime monitor stays green with no consecutive failures.

## Escalation Triggers

Treat release as degraded and investigate immediately if any of the following occurs:

1. Repeated `5xx` responses on buyer public pages or `/events`.
2. Production `/health` fails two checks in a row or exceeds the configured timeout.
3. Error logs show recurring DB client lifecycle failures, request-scope I/O errors, or reservation-related unhandled exceptions.
4. Buyer checkout smoke fails on reservation, order, payment initiation, or webhook confirmation.
5. Reservation latency visibly degrades user flows beyond the current staging warning profile.

## Rollback Guidance

Rollback should be considered if the system shows a user-visible regression that cannot be stabilized quickly.

Rollback candidates:

1. Immediate recurring `500` on public buyer browsing or core API routes.
2. Broken checkout correctness, oversell symptoms, or persistent order/payment inconsistencies.
3. Production logs indicating the DB lifecycle fix is not holding under live traffic.

Minimum rollback actions:

1. Stop further release verification activity and mark the release as degraded.
2. Preserve failing request timestamps and any `X-Request-Id` values already collected.
3. Revert to the last known good deployment path using the existing SST/GitHub Actions process.
4. Re-run smoke checks on the rolled-back version.
5. Document the incident and attach the correlated request IDs plus the main error signatures.

## Follow-Up After A Stable Release

If the first monitoring window stays clean, continue with these follow-ups:

1. Keep Task I focused on reservation-path checkout latency improvements.
2. Revisit a broader non-local staging slice later only if more confidence is needed and only with separate explicit approval.
3. Keep monitoring the Worker DB lifecycle behavior because the no-cache client strategy is correct but still operationally important.