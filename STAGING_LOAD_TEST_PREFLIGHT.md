# Staging Load Test Preflight

Status: executed after explicit user approval
Last updated: 2026-04-16
Scope: Task H — safe staging multi-user validation

Execution note: the approved 5-user staging slice was executed successfully end-to-end without limiter bypass. See `STAGING_VALIDATION.md` for metrics, database validation, and cleanup results.

## Original Blocker

- Existing K6 checkout setup logs seeded buyers through `/auth/login` in a burst.
- Staging keeps the current auth hardening unchanged: `/auth/login` is limited to 5 POST requests per 60 seconds per source IP.
- The earlier 10-user remote slice failed with `429` during login setup for that reason.
- Repository policy also forbids any remote load execution before explicit user approval in the current conversation.

## Recommended Strategy

- Run one minimum but representative non-local checkout slice on staging without changing limiter behavior.
- Keep the first remote run at 5 total buyers so the login burst stays inside the existing `5 requests / 60 seconds / IP` cap.
- Use fresh synthetic users and a fresh synthetic checkout target so the run is isolated from existing staging data.
- Do not add staging allowlists, do not relax the limiter, and do not mint JWTs from secrets for the test.
- If the 5-user slice passes but wider coverage is still needed, treat any follow-up run as a separate approved step with a paced token prefetch strategy. That broader path is intentionally out of scope for the first run.

## Target Environment

- Stage: `staging`
- API base URL: `https://api.jeevatix.my.id`
- Data plane: staging PostgreSQL via the current staging environment variables
- Synthetic artifact footprint:
  - 1 synthetic `checkout-bench-*` event
  - 1 synthetic ticket tier under that event
  - 5 synthetic `checkoutfresh*` buyer accounts

## Planned Scale

- Total virtual users: 5
- Login attempts: 5 total from one source IP inside one 60-second window
- Per-user flow: login -> reservation -> order -> payment initiation -> internal payment webhook confirmation
- Expected application request volume: roughly 25 primary API requests, plus target creation and post-run validation queries
- Stop conditions:
  - unexpected `429` on `/auth/login`
  - repeated `5xx` responses
  - post-run data integrity mismatch from the load runner validation

## Billing Surfaces

- Cloudflare Workers requests and CPU for auth, reservation, order, payment, and webhook endpoints
- Durable Objects:
  - `RateLimiter` for login requests
  - `TicketReserver` during reservation and confirmation flow
- Hyperdrive and origin PostgreSQL usage for synthetic user creation, checkout writes, ticket issuance, and post-run validation queries
- Notification and email side effects after successful payment confirmation if staging email delivery is active
- Not expected in this slice:
  - real external payment gateway traffic
  - R2 writes
  - PartyKit traffic
  - broad portal/browser traffic outside the K6 scenario itself

## Potential Side Effects

- Synthetic users, refresh tokens, reservations, orders, payments, tickets, and notifications will be written to staging.
- The synthetic benchmark event and tier will temporarily consume staging inventory counters until cleanup runs.
- If staging email delivery is enabled, synthetic inboxes such as `checkoutfresh...@jeevatix.com` may receive order confirmation or e-ticket emails.
- Observability and log streams will contain test traffic for this window.

## Cleanup Plan

1. Run a dry-run cleanup first:

```bash
pnpm --filter @jeevatix/core exec tsx src/db/cleanup-load-test-data.ts --dry-run
```

2. If the dry-run summary matches the synthetic footprint, run the actual cleanup:

```bash
pnpm --filter @jeevatix/core exec tsx src/db/cleanup-load-test-data.ts
```

3. Verify that synthetic `checkout-bench-*`, `checkout+*`, and `checkoutfresh*` artifacts are gone while representative staging seed data remains intact.
4. If email or notification side effects were emitted, record them in the staging validation report. No recall step will be attempted for already-sent emails.

## Proposed Command Sequence

These commands assume the staging environment variables are already loaded and point to staging resources only.

```bash
export BASE_URL=https://api.jeevatix.my.id
export CHECKOUT_LOAD_TEST_FRESH_USERS=1
export CHECKOUT_LOAD_TEST_USER_COUNT=5
export TOTAL_USERS=5
export LOGIN_BATCH_SIZE=5

pnpm --filter @jeevatix/core exec tsx scripts/create-checkout-benchmark-target.ts
# export TARGET_EVENT_SLUG and TARGET_TIER from the JSON output above

pnpm --filter @jeevatix/core exec tsx scripts/run-load-scenario.ts checkout-flow

pnpm --filter @jeevatix/core exec tsx src/db/cleanup-load-test-data.ts --dry-run
pnpm --filter @jeevatix/core exec tsx src/db/cleanup-load-test-data.ts
```

## Explicit Approval Request

Approval requested for one staging-only remote validation run with the exact minimum scale above:

- 5 synthetic buyers
- 1 synthetic checkout target event and tier
- no limiter bypass
- cleanup immediately after the run

If approval is not granted, the task remains blocked and no remote execution should occur.