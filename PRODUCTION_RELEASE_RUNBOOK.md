# Production Release Runbook

Date: 2026-05-26
Status: active
Scope: production deploy execution checklist (CI workflow `deploy-production.yml`)

## Release Position

- Release posture: `conditional go`. Staging stack fully operational with Hyperdrive, INTERNAL_API_URL env-var-configurable, and post-deploy SSR canary providing real coverage.
- Stack reality at this runbook revision:
  - Cloudflare Hyperdrive provisioned via SST for `staging` and `production` stages (commit `1b0dfbe`). Production deploy will create a fresh Hyperdrive config the first time.
  - Portal Workers (buyer/admin/seller) read `INTERNAL_API_URL` from `process.env` at runtime, with a hardcoded fallback to the staging workers.dev URL (commit `67abf7b`). Production MUST set `PRODUCTION_INTERNAL_API_URL` before first deploy or SSR traffic will silently call the staging API.
  - Post-deploy SSR canary lives in `.github/workflows/deploy-production.yml` (commit `5bfcb40`). It hits workers.dev URLs to bypass Cloudflare's IP-based block of GitHub Actions runners. Canary gracefully skips on the first production deploy because workers.dev URLs are not yet known.
- Three deploy inputs still pending user decision (treat as inputs, not decisions inside this runbook): domain choice, production DB host, launch strategy. Recommended defaults captured in `handoff.md` Step 2.
- Remaining performance warning: checkout latency concentrated on the reservation path (`http_req_duration p95 ~2.18s` on staging 5-user slice). Engineering backlog, not a release blocker.

## Release Preconditions

All items below should be true before triggering production deploy:

1. `STAGING_VALIDATION.md` still reflects `conditional go` and no new blocker has appeared.
2. CI baseline remains green for build, lint, format, typecheck, and the local regression suite.
3. All required GitHub secrets and vars are set in the `production` environment per `PRODUCTION_PREDEPLOY_CHECKLIST.md` (or this runbook's `Pre-Deploy Checklist` if checklist file is not yet authored).
4. `PRODUCTION_INTERNAL_API_URL` GitHub var is set. If unset, portal Workers fall back to the staging workers.dev URL — silent wrong behavior, no error.
5. Release owner accepts the remaining reservation-latency warning and is prepared to monitor it after deploy.
6. External uptime monitor for `https://api.jeevatix.com/health` (or chosen production API domain) is enabled, or will be enabled immediately after deploy.

## Pre-Deploy Checklist

Confirm the items below before running the workflow. The full env contract is owned by `.github/workflows/deploy-production.yml`; this list mirrors the secrets/vars that workflow expects.

1. Target commit SHA on `main` is the intended release. Workflow uses `${{ github.sha }}` from the dispatched ref as `APP_VERSION`.
2. GitHub secrets present in environment `production`:
   - `CLOUDFLARE_API_TOKEN`
   - `PRODUCTION_DATABASE_URL`
   - `PRODUCTION_JWT_SECRET`
   - `PRODUCTION_PAYMENT_WEBHOOK_SECRET`
   - `EMAIL_API_KEY`
   - `PARTY_SECRET`
   - `PRODUCTION_HYPERDRIVE_CA_CERT_ID` (only if origin DB uses self-signed/private CA — otherwise leave unset)
3. GitHub vars present in environment `production`:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `EMAIL_FROM`
   - `PARTYKIT_HOST`, `PUBLIC_PARTYKIT_HOST`
   - `PRODUCTION_API_URL` (used by Smoke Test step; defaults to `https://api.jeevatix.com` if unset)
   - `PRODUCTION_API_DOMAIN`, `PRODUCTION_BUYER_DOMAIN`, `PRODUCTION_ADMIN_DOMAIN`, `PRODUCTION_SELLER_DOMAIN`
   - `PRODUCTION_CORS_ALLOWED_ORIGINS` (comma-separated)
   - `PRODUCTION_R2_BUCKET_NAME`
   - `PRODUCTION_RESERVATION_CLEANUP_QUEUE_NAME`
   - `PRODUCTION_UPLOAD_PUBLIC_URL`
   - `PRODUCTION_HYPERDRIVE_SSLMODE` (`verify-ca` or `verify-full`; only relevant if `PRODUCTION_HYPERDRIVE_CA_CERT_ID` set)
   - `PRODUCTION_INTERNAL_API_URL` — REQUIRED. Set to the production API workers.dev URL or production custom-domain API URL. Missing this var silently falls back to staging.
   - `TICKET_RESERVER_DB_MAX_CONNECTIONS`
4. Production DNS for the chosen domain points at Cloudflare and the zone is reachable (validates after first deploy via the Smoke Test step).
5. Production Postgres role + database exist on the chosen host. Schema pushed (`pnpm --filter @jeevatix/core run db:push`) but NOT seeded.
6. No pending remote load test or synthetic-cleanup task is still touching staging or production.

Note on env vars NOT to remove or change:

- `DB_DISABLE_CACHE=1` is hardcoded in `sst.config.ts` (`createApiEnvironment`). Do not remove. Cached postgres-js clients across Worker isolates trigger ~30% 500s on `/categories`.
- `INTERNAL_API_URL` portal env is wired through SST `createPortalEnvironment()` and consumed in `apps/{buyer,admin,seller}/src/lib/{auth,http}.ts`. Do not point it at the custom API domain (`https://api.jeevatix.com`) — same-zone Worker-to-Worker on the custom domain returns 522. Use the workers.dev URL for the production API.

## Deploy Sequence

Production deploy runs through the CI workflow only:

```bash
gh workflow run deploy-production.yml -f confirm=deploy-production
```

The workflow performs: validate → install → format:check → lint → typecheck → load-test-safety validate → test → build → frontend bundle localhost-API guard → `pnpm run deploy --stage production` → Smoke Test → Post-deploy SSR canary.

If a manual deploy from a local shell is ever needed (last resort, after explicit confirmation), the same env contract listed above must be exported in the shell before:

```bash
pnpm run build
export APP_VERSION="$(git rev-parse HEAD)"
pnpm run deploy --stage production
```

## First Production Deploy: workers.dev URLs Unknown

The first production deploy behaves differently from subsequent deploys because the Cloudflare workers.dev URLs are only allocated at deploy time.

1. Workflow run will execute Smoke Test (hits `PRODUCTION_API_URL/health`) — this is the authoritative health gate on first deploy.
2. Post-deploy SSR canary step will detect `PRODUCTION_*_WORKERS_DEV_URL` GH vars are unset and gracefully skip with an informational log. Exit 0. Do not treat the skip as a failure.
3. Workflow finishes green if Smoke Test passes.

Treat first deploy success criteria as: workflow green, Smoke Test green, canary skipped (expected).

## Post-Deploy: Capture workers.dev URLs and Set GH Vars

Run this immediately after the first production deploy succeeds. Until these vars are set, the canary on subsequent deploys will keep skipping and SSR W2W coverage relies only on the API health Smoke Test.

1. Open the deploy workflow run on GitHub Actions and inspect the `pnpm run deploy --stage production` step output. SST prints the deployed Worker URLs.
2. Cross-check via Cloudflare dashboard → Workers & Pages → each script (`jeevatix-production-api`, `jeevatix-production-buyer`, `jeevatix-production-seller`, `jeevatix-production-admin`) → "Triggers" tab. The workers.dev URL is shown there.
3. Capture the four URLs. Pattern: `https://<script-name>.<account-subdomain>.workers.dev`.
4. Set the four GitHub vars in environment `production`:

   ```bash
   gh variable set PRODUCTION_API_WORKERS_DEV_URL --env production --body "https://jeevatix-production-api.<account>.workers.dev"
   gh variable set PRODUCTION_BUYER_WORKERS_DEV_URL --env production --body "https://jeevatix-production-buyer.<account>.workers.dev"
   gh variable set PRODUCTION_SELLER_WORKERS_DEV_URL --env production --body "https://jeevatix-production-seller.<account>.workers.dev"
   gh variable set PRODUCTION_ADMIN_WORKERS_DEV_URL --env production --body "https://jeevatix-production-admin.<account>.workers.dev"
   ```

5. From the second production deploy onward, the canary step will run the full 5-route SSR check (GET `/health`, GET `/login` × 3 portals, POST `/login` against seller with Origin header). 5xx or timeout in any check fails the deploy.

Why workers.dev: GitHub Actions runner egress IPs are on Microsoft Azure ASN, which Cloudflare Free plan blocks at the zone level for custom domains (returns 403 challenge to runners). workers.dev URLs route directly to Workers infrastructure and bypass the zone security layer, so the canary can actually exercise the SSR W2W subrequest path. See `handoff.md` "Canary Real Coverage" section for the diagnostic detail.

## Immediate Post-Deploy Smoke

Run these checks as close to deploy completion as possible, in addition to the workflow's automated Smoke Test + canary:

1. `curl -fsS "$PRODUCTION_API_URL/health"` — expect `status=ok`, `environment=production`, `version=<deployed SHA>`.
2. `curl -fsS -o /dev/null -w "%{http_code}\n" "$PRODUCTION_BUYER_WORKERS_DEV_URL/login"` — expect 200.
3. `curl -fsS -o /dev/null -w "%{http_code}\n" "$PRODUCTION_SELLER_WORKERS_DEV_URL/login"` — expect 200.
4. `curl -fsS -o /dev/null -w "%{http_code}\n" "$PRODUCTION_ADMIN_WORKERS_DEV_URL/login"` — expect 200.
5. POST canary equivalent (exercises SSR W2W path on the seller Worker):

   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" --max-time 30 \
     -X POST "$PRODUCTION_SELLER_WORKERS_DEV_URL/login" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -H "Origin: $PRODUCTION_SELLER_WORKERS_DEV_URL" \
     --data "email=smoke@invalid.test&password=invalid"
   ```

   Expect 200/400/401/403 (SvelteKit form action returning invalid-credential response). 5xx or timeout indicates SSR W2W routing or `INTERNAL_API_URL` misconfiguration.

6. Public buyer browse via custom domain: `curl -fsS "https://<buyer-domain>/events?limit=8&page=1"` (run from a non-Azure IP — laptop, Singapore VPS, or via uptime monitor). Expect non-5xx.

Expected minimum result:

- API health returns `status`, `timestamp`, `version`, `environment`, `service`.
- All 4 portal routes respond non-5xx on workers.dev URLs.
- Public events listing on custom domain responds non-5xx.

## First 30-Minute Monitoring Window

During the initial release window, focus on these watchpoints:

1. Tail Cloudflare error logs for the production API Worker:

   ```bash
   pnpm --filter @jeevatix/api exec wrangler tail jeevatix-production-api --format pretty --status error
   ```

   Watch for bursts of `http.server_error` or `http.unhandled_exception`.

2. Record at least one `X-Request-Id` from a successful smoke request and keep it ready for log correlation.
3. Watch reservation-heavy buyer traffic most closely (known latency warning area).
4. Watch for repeated checkout complaints, spikes in failed reservation attempts, or abnormal payment-confirmation lag.
5. Confirm the external uptime monitor stays green with no consecutive failures.
6. Spot-check Hyperdrive metrics in Cloudflare dashboard → Workers & Pages → Hyperdrive → `jeevatix-production-hyperdrive`. Connection-pool errors here will surface as 5xx in API logs.

## Escalation Triggers

Treat release as degraded and investigate immediately if any of the following occurs:

1. Repeated `5xx` responses on buyer public pages or `/events`.
2. Production `/health` fails two checks in a row or exceeds the configured timeout.
3. Error logs show recurring DB client lifecycle failures, request-scope I/O errors, or reservation-related unhandled exceptions.
4. Buyer checkout smoke fails on reservation, order, payment initiation, or webhook confirmation.
5. Reservation latency visibly degrades user flows beyond the current staging warning profile.
6. Canary on a follow-up deploy fails with 5xx or timeout (indicates same-zone W2W 522 regression or portal `INTERNAL_API_URL` misconfiguration).

## Rollback Guidance

Rollback should be considered if the system shows a user-visible regression that cannot be stabilized quickly.

Rollback candidates:

1. Immediate recurring `500` on public buyer browsing or core API routes.
2. Broken checkout correctness, oversell symptoms, or persistent order/payment inconsistencies.
3. Production logs indicating the DB lifecycle fix is not holding under live traffic.
4. Post-deploy canary fails on a follow-up deploy and 5xx persists in API logs.

Minimum rollback actions:

1. Stop further release verification activity and mark the release as degraded.
2. Preserve failing request timestamps and any `X-Request-Id` values already collected.
3. Re-deploy the last known good SHA via the same CI workflow:

   ```bash
   gh workflow run deploy-production.yml --ref <last-good-sha> -f confirm=deploy-production
   ```

   Workflow dispatches against the ref SHA. SST is configured `protect: true` and `removal: retain` for the production stage, so re-deploying an older SHA replaces the Worker scripts but does not destroy persistent resources (Hyperdrive config, R2 bucket, Queue, Durable Object storage).

4. If a forward-fix is preferred over reverting infrastructure, revert the offending commit on `main` and dispatch the workflow at the new HEAD:

   ```bash
   git revert <bad-sha>
   git push origin main
   gh workflow run deploy-production.yml -f confirm=deploy-production
   ```

5. Re-run the smoke checks (`Immediate Post-Deploy Smoke` above) on the rolled-back version. Confirm `/health` reports the rolled-back `version` SHA.
6. Document the incident with correlated request IDs and the main error signatures.

Rollback NON-actions (do not run without explicit approval):

- Do not delete the Hyperdrive config — it is the only data-plane connection to production Postgres and recreating it changes the binding ID.
- Do not destroy the R2 bucket or Queue — `removal: retain` is set deliberately.
- Do not modify production GH secrets/vars during rollback unless the secret itself is the cause; rotating secrets mid-incident widens the blast radius.

## Follow-Up After A Stable Release

If the first monitoring window stays clean, continue with these follow-ups:

1. Keep reservation-path checkout latency on the engineering backlog (T-10.3 and successors).
2. Revisit a broader non-local staging slice later only if more confidence is needed and only with separate explicit approval.
3. Keep monitoring the Worker DB lifecycle behavior — `DB_DISABLE_CACHE=1` is correct but operationally important under sustained load.
4. After two clean deploys with full canary coverage, consider migrating the canary's POST check to also exercise the buyer Worker SSR W2W path.
