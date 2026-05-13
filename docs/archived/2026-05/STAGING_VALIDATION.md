# Staging Validation Report
Date: 2026-04-16
Scope: Task F + Task H — staging validation, safe multi-user rerun, and go/no-go review before public production deploy.

## Outcome

Recommendation: conditional go for public production deploy against the current release gates.

Why:

1. The staging stack now deploys successfully and core remote smoke checks pass.
2. The local representative checkout benchmark still misses its historical `T-10.3` latency targets, but after the approved Option B decision this is treated as an engineering signal, not the final release blocker by itself.
3. Staging now validates non-empty public browsing, a single end-to-end checkout smoke flow, and one approved 5-user remote checkout slice with `5/5` successful flows and passing DB consistency checks.
4. The remaining concern is now a performance warning rather than a missing gate: the staging slice missed `http_req_duration p95 < 2.00s` slightly at `2.18s`, with reservation latency still the dominant contributor.

## Evidence Classification

- `pnpm run test:e2e` is currently a local mock-backed supporting gate, not direct staging runtime evidence.
- `pnpm run test:load:checkout:local` is currently a local supporting gate for correctness and latency, not direct staging runtime evidence.
- Direct staging/runtime evidence in this report comes from staging deploy, remote smoke, non-empty public browse checks, single checkout smoke, and the approved small remote checkout slice.

## Environment Validated

- Target stage: `staging`
- Deploy tool: `sst 4.5.12`
- Staging URLs:
	- buyer: `https://jeevatix.my.id`
	- admin: `https://admin.jeevatix.my.id`
	- seller: `https://seller.jeevatix.my.id`
	- api: `https://api.jeevatix.my.id`
- Upload bucket: `jeevatix-stg`

## Validation Gates

### 1. Production Build Gate

Command:

```bash
pnpm run build
```

Result: pass.

Evidence:

- buyer, admin, seller, and api build tasks completed successfully
- Cloudflare adapter output was produced for the SvelteKit portals

### 2. Local Browser E2E Supporting Gate

Command:

```bash
pnpm run test:e2e
```

Result: pass.

Evidence:

- `51` Playwright tests passed
- runtime warnings about eager SSR `fetch` appeared in web server logs, but they did not fail the suite

Interpretation:

- this gate is still useful for regression coverage
- however, it currently runs in local mock-backed mode and should not be treated as direct staging-runtime evidence

### 3. Local Representative Checkout Load Gate

Command:

```bash
pnpm run test:load:checkout:local
```

Result: correctness pass, threshold fail.

Correctness evidence:

- `checkout_flow_success=500`
- `checkout_flow_failed=0`
- `checkout_flow_reservation_sold_out=0`
- post-run DB validation passed
- `confirmed_orders=500`
- `confirmed_tickets=500`
- `issued_tickets=500`

Latency evidence:

- `full_flow_duration p95 = 5.85s` against threshold `< 3.00s`
- `http_req_duration p95 = 3.37s` against threshold `< 2.00s`
- `step_reservation_duration p95 = 3.68s`
- `step_order_duration p95 = 1.29s`
- `step_payment_duration p95 = 1.93s`
- `step_webhook_duration p95 = 1.18s`

Interpretation:

- correctness under the representative local flow remains good
- the stated latency gate for checkout is still red
- this gate is still local-only, so it should be treated as a supporting performance signal rather than proof of staging-runtime readiness
- after the approved Option B decision, this gate remains an engineering benchmark and regression signal rather than the final release blocker on its own

### 4. Staging Deploy Gate

Command pattern used:

```bash
set -a && source .env.staging && set +a
export SST_STAGE=staging
export SKIP_DURABLE_OBJECT_MIGRATIONS=1
pnpm exec sst deploy --stage staging
```

Result: pass.

Evidence:

- staging deployment completed successfully to the target custom domains
- buyer, admin, seller, and api workers are all reachable on staging domains

### 5. Remote Smoke Gate

Result: pass for the currently checked routes.

HTTP smoke evidence:

- `200 https://api.jeevatix.my.id/health`
- `200 https://jeevatix.my.id`
- `200 https://jeevatix.my.id/events`
- `200 https://admin.jeevatix.my.id/login`
- `200 https://seller.jeevatix.my.id/login`

API stability spot-check after the fix:

- repeated probes to `https://api.jeevatix.my.id/events?limit=20&page=1` returned `200` for `6/6` attempts after redeploying the DB-cache fix

### 6. Non-Empty Staging Browse And Checkout Smoke

Result: pass.

Evidence:

- `GET https://api.jeevatix.my.id/categories` returned seeded categories with non-zero `event_count`
- `GET https://api.jeevatix.my.id/events?limit=8&page=1` returned the seeded events `Jakarta Night Festival 2026` and `Creative Growth Workshop 2026`
- buyer homepage and buyer explore page rendered non-empty event cards for those seeded events
- buyer event detail page for `jakarta-night-festival-2026` rendered ticket tiers and pricing correctly
- a single manual buyer checkout smoke against the benchmark event completed successfully through:
	- `POST /auth/login` → `200`
	- `POST /reservations` → `201`
	- `POST /orders` → `201`
	- `POST /payments/:orderId/pay` → `200`
	- `POST /webhooks/payment` → `200`

Post-checkout evidence:

- benchmark tier `a9386320-848d-4ce7-aa20-a3d72560df1b` reported `sold_count: 11` and `remaining: 989` on the public event detail response after the smoke transaction

### 7. Small Remote Checkout Load Slice On Staging

Result: functional pass, threshold warning.

Command pattern used:

```bash
set -a && source .env.staging && set +a
export BASE_URL=https://api.jeevatix.my.id
export CHECKOUT_LOAD_TEST_FRESH_USERS=1
export CHECKOUT_LOAD_TEST_USER_COUNT=5
export TOTAL_USERS=5
export LOGIN_BATCH_SIZE=5
pnpm --filter @jeevatix/core exec tsx scripts/create-checkout-benchmark-target.ts
pnpm --filter @jeevatix/core exec tsx scripts/run-load-scenario.ts checkout-flow
```

Evidence:

- explicit user approval was recorded before the remote run
- benchmark event `checkout-bench-1776329492204` and tier `d9917170-01f0-47d2-a46d-08d30ec19504` were created successfully in staging for this slice
- fresh `checkoutfresh*` buyers were seeded automatically for the run
- K6 setup created `5/5` access tokens without hitting the auth limiter
- `checkout_flow_success=5`
- `checkout_flow_failed=0`
- `checkout_flow_reservation_sold_out=0`
- `full_flow_duration p95 = 2.81s` against threshold `< 3.00s`
- `http_req_duration p95 = 2.18s` against threshold `< 2.00s`
- `step_reservation_duration avg = 2.04s`
- `step_order_duration avg = 226.6ms`
- `step_payment_duration avg = 115.6ms`
- `step_webhook_duration avg = 152.6ms`
- post-run DB validation passed with `confirmed_orders=5`, `confirmed_tickets=5`, and `issued_tickets=5`
- cleanup dry-run showed pre-existing synthetic test artifacts plus the current run (`58` users, `3` events, `3` tiers, `41` orders, `41` tickets, `41` reservations), actual cleanup completed successfully, and the verification dry-run returned zero remaining synthetic rows

Interpretation:

- the auth-limiter blocker for a minimum staging multi-user validation is now closed without bypassing hardening
- functional correctness and post-run data integrity are green for the approved 5-user slice
- the only red signal from this slice is a modest `http_req_duration` p95 overrun, concentrated in reservation latency; this should be treated as a performance warning and follow-up engineering item rather than a missing release gate

## Issues Found And Resolved During Validation

### 1. Empty staging database schema

Symptoms:

- public API endpoints returned `500`
- local reproduction against staging DB showed missing relations such as `categories` and `events`

Resolution:

- schema was pushed into the staging database using Drizzle schema push
- representative category, seller, event, image, and ticket-tier data was then seeded into staging

### 2. Portal builds baked the production API URL

Symptoms:

- buyer staging pages still failed after API recovery
- generated portal artifacts still contained `https://api.jeevatix.com`

Resolution:

- buyer, admin, and seller were changed to read `PUBLIC_API_BASE_URL` from SvelteKit's supported `$env/static/public` module instead of `import.meta.env.PUBLIC_API_BASE_URL`
- portals were rebuilt and redeployed

### 3. Intermittent API `500` on public events after deploy

Symptoms:

- `/events` intermittently returned `500`
- buyer homepage and buyer events page intermittently rendered internal errors

Root cause:

- `postgres` database clients were cached in global scope and reused across Cloudflare Worker requests
- Cloudflare Workers rejected that reuse with `Cannot perform I/O on behalf of a different request`

Resolution:

- structured error logging was improved to preserve `Error.cause`
- `@jeevatix/core` DB access was updated to disable global DB client caching when `DB_DISABLE_CACHE=1`
- staging API worker environment now sets `DB_DISABLE_CACHE=1`
- updated API worker and queue/cron workers were redeployed

## Targeted Code Validation

Command:

```bash
pnpm --filter @jeevatix/core typecheck
pnpm --filter @jeevatix/api typecheck
```

Result: pass.

## Gate Summary

| Gate                         | Status | Notes                                                  |
| ---------------------------- | ------ | ------------------------------------------------------ |
| Build                        | PASS   | `pnpm run build` completed successfully                |
| E2E                          | PASS   | `51` Playwright tests passed in local mock-backed mode |
| Representative load          | WARN   | local correctness green, latency thresholds still red; engineering benchmark only |
| Staging deploy               | PASS   | staging stack deployed successfully                    |
| Remote smoke on staging URLs | PASS   | buyer/admin/seller/API key routes returned `200`       |
| Non-empty browse + checkout smoke | PASS   | seeded catalog rendered and single checkout smoke passed |
| Small remote checkout slice  | WARN   | approved 5-user staging slice passed functionally; `http_req_duration p95` was `2.18s` vs threshold `< 2.00s` |
| Targeted backend typecheck   | PASS   | `@jeevatix/core` and `@jeevatix/api` typechecks passed |

## Residual Risks

1. The approved 5-user staging slice closed the missing multi-user validation gate, but reservation-heavy latency still pushed `http_req_duration p95` slightly above target on staging, so checkout performance work remains open engineering follow-up.
2. The local representative checkout benchmark is still above its historical `T-10.3` targets, so checkout performance optimization remains open engineering work even though it is no longer treated as the sole final release blocker.
3. The new DB caching behavior is correct for Workers correctness, but it should still be monitored under real staging traffic because it changes connection lifecycle behavior in the API, queue subscriber, and cron worker.

## Required Next Actions

1. Owner: shared — Keep the local checkout benchmark as an engineering/regression signal and continue tuning it outside the final go/no-go path.
2. Owner: shared — Monitor reservation latency closely if release proceeds, because that step remains the dominant contributor to the staging warning profile.
3. Owner: shared — If higher non-local confidence is needed later, plan a broader staging slice with paced token prefetch under separate explicit user approval.

## Final Decision

Conditional go for public production deploy at this time.

Rationale:

- staging deployment and smoke validation are now functioning and no longer the blocker
- non-empty browse validation, single checkout smoke, and one approved 5-user remote checkout slice now pass functionally on staging
- the prior non-local release blocker is closed without relaxing auth hardening or skipping cleanup
- the local checkout benchmark still needs engineering follow-up, but it is no longer treated as the sole final release blocker after the approved Option B decision
- the remaining concern is a performance warning: `http_req_duration p95` on the approved staging slice was `2.18s` against a script threshold of `< 2.00s`, driven mainly by reservation latency
