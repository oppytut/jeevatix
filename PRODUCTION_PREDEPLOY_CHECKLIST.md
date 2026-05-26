# Production Pre-Deploy Checklist

Date: 2026-05-26
Status: active
Scope: pre-deploy preparation gate (run BEFORE triggering `gh workflow run deploy-production.yml`)

## How To Use This Document

This file is the "did I prep everything?" gate that runs once, immediately before the first production deploy. Walk every section top to bottom and tick each box only when the item is actually verified (file written, secret set in GitHub, DNS record visible in Cloudflare dashboard, etc.). The 3 user decisions in the first section MUST be resolved and recorded before any other section is touched. The actual deploy execution lives in `PRODUCTION_RELEASE_RUNBOOK.md` and starts only after every box here is checked. Authoritative sources cross-referenced when building this checklist: `.github/workflows/deploy-production.yml`, `.github/workflows/deploy.yml`, `sst.config.ts`, `apps/api/src/lib/database-url.ts`, `README.md`, `handoff.md`.

## 1. User Decisions (Gate)

- [ ] Domain decision recorded (recommendation: subdomain on `jeevatix.my.id` for soft launch; alternative is the `jeevatix.com` family already wired as defaults in `sst.config.ts`)
- [ ] Production DB host decision recorded (recommendation: same VPS as staging, `168.144.140.206`, with a separate database + role)
- [ ] Launch strategy decision recorded (recommendation: invite-only / soft launch first, then open access)

All three must be written down (handoff entry, ticket, or release note) before continuing.

## 2. VPS Production Database Setup

- [ ] Connected to VPS (`168.144.140.206` or chosen production host) over SSH
- [ ] `CREATE DATABASE jeevatix_production` executed
- [ ] Production role created and `GRANT ALL PRIVILEGES ON DATABASE jeevatix_production TO <role>` applied
- [ ] Strong password generated for the production role (do NOT reuse staging credentials)
- [ ] `DATABASE_URL` connection string assembled in `postgres://USER:PASS@HOST:5432/jeevatix_production?sslmode=verify-ca` shape (sslmode aligned with the chosen `HYPERDRIVE_SSLMODE` value)
- [ ] `psql` smoke connection from the VPS itself succeeds
- [ ] `psql` smoke connection from a non-VPS host succeeds (confirms remote access for Hyperdrive origin)
- [ ] Schema pushed: `pnpm --filter @jeevatix/core run db:push -- --force` against the production DB
- [ ] No seed data loaded (production must start empty; do NOT run any `db:seed*` script)
- [ ] TLS certificate decision recorded: reuse the existing `db.jeevatix.my.id` cert OR provision a new subdomain cert via Let's Encrypt
- [ ] If a new subdomain cert is needed: subdomain DNS pointed at the VPS, certbot run, postgres `ssl_cert_file`/`ssl_key_file` updated, postgres reloaded
- [ ] CA certificate uploaded to Cloudflare Hyperdrive certificates UI; certificate ID captured for `PRODUCTION_HYPERDRIVE_CA_CERT_ID`

## 3. Cloudflare Setup

- [ ] DNS records exist for `PRODUCTION_API_DOMAIN`, `PRODUCTION_BUYER_DOMAIN`, `PRODUCTION_ADMIN_DOMAIN`, `PRODUCTION_SELLER_DOMAIN` (proxied / orange cloud)
- [ ] Worker route bindings created in the Cloudflare dashboard for each of the 4 production domains (or confirmed that SST `domain:` will create them on first deploy)
- [ ] Zone settings reviewed: SSL/TLS mode `Full (strict)`, Always Use HTTPS enabled, Bot Fight Mode setting reviewed for impact on legitimate traffic
- [ ] R2 bucket name decided and recorded for `PRODUCTION_R2_BUCKET_NAME` (e.g., `jeevatix-uploads`); will be auto-created by SST on first deploy if it does not exist
- [ ] Reservation cleanup queue name decided and recorded for `PRODUCTION_RESERVATION_CLEANUP_QUEUE_NAME` (e.g., `jeevatix-production-reservation-cleanup`)
- [ ] Hyperdrive provisioning verified: `sst.config.ts` already auto-creates `jeevatix-production-hyperdrive` for stage `production`; confirm the VPS DB host is reachable from Cloudflare egress
- [ ] PartyKit deployment status confirmed (separate from SST; `PARTYKIT_HOST` must point at a live PartyKit project if live availability is required)

## 4. GitHub Secrets (production environment scope)

Use `gh secret set <NAME> --env production` for each item. All names below are taken verbatim from `.github/workflows/deploy-production.yml`.

- [ ] `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Workers, Workers Routes, R2, Queues, Hyperdrive, DNS, and Cert Management edit permissions
- [ ] `PRODUCTION_DATABASE_URL` — full connection string from section 2 (also reused as `TICKET_RESERVER_DATABASE_URL` by the workflow)
- [ ] `PRODUCTION_JWT_SECRET` — `openssl rand -hex 32`
- [ ] `PRODUCTION_PAYMENT_WEBHOOK_SECRET` — `openssl rand -hex 32`
- [ ] `EMAIL_API_KEY` — Resend (or chosen provider) production API key
- [ ] `PARTY_SECRET` — PartyKit shared secret (only if PartyKit is enabled)
- [ ] `PRODUCTION_HYPERDRIVE_CA_CERT_ID` — Cloudflare cert ID from section 2 (only if mTLS is required for the production DB origin)

Verify after setting: `gh secret list --env production` shows all expected entries.

## 5. GitHub Variables (production environment scope)

Use `gh variable set <NAME> --env production --body "<VALUE>"` for each item. All names below are taken verbatim from `.github/workflows/deploy-production.yml`.

Mandatory before first deploy:

- [ ] `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID (also injected as `CLOUDFLARE_DEFAULT_ACCOUNT_ID` by the workflow)
- [ ] `EMAIL_FROM` — production sender address (e.g., `no-reply@jeevatix.com`)
- [ ] `PRODUCTION_UPLOAD_PUBLIC_URL` — public R2 URL prefix for upload assets
- [ ] `PRODUCTION_API_DOMAIN` — e.g., `api.jeevatix.com`
- [ ] `PRODUCTION_BUYER_DOMAIN` — e.g., `jeevatix.com`
- [ ] `PRODUCTION_ADMIN_DOMAIN` — e.g., `admin.jeevatix.com`
- [ ] `PRODUCTION_SELLER_DOMAIN` — e.g., `seller.jeevatix.com`
- [ ] `PRODUCTION_CORS_ALLOWED_ORIGINS` — comma-separated list (leave unset to let SST auto-build from production domains)
- [ ] `PRODUCTION_HYPERDRIVE_SSLMODE` — `verify-ca` or `verify-full` (must match the cert chain uploaded in section 2)
- [ ] `PRODUCTION_INTERNAL_API_URL` — production workers.dev API URL or production custom-domain URL used for SSR W2W subrequests; if left empty, portal SSR will silently fall back to the staging workers.dev URL hardcoded in `apps/{buyer,seller,admin}/src/lib/{auth,http}.ts`
- [ ] `PRODUCTION_R2_BUCKET_NAME` — value chosen in section 3
- [ ] `PRODUCTION_RESERVATION_CLEANUP_QUEUE_NAME` — value chosen in section 3
- [ ] `PRODUCTION_API_URL` — `https://<PRODUCTION_API_DOMAIN>` (used as `PUBLIC_API_BASE_URL` at build time AND as the post-deploy smoke target)
- [ ] `TICKET_RESERVER_DB_MAX_CONNECTIONS` — connection pool ceiling for the reserver path (numeric string)
- [ ] `PUBLIC_PARTYKIT_HOST` — public PartyKit host string consumed at frontend build time (only if PartyKit is enabled)
- [ ] `PARTYKIT_HOST` — server-side PartyKit host (only if PartyKit is enabled)

Skipped intentionally on first deploy (canary gracefully skips when these are unset; set them AFTER first deploy from the deploy output, then re-run deploy-production for full canary coverage):

- [ ] `PRODUCTION_API_WORKERS_DEV_URL` — captured from first deploy output
- [ ] `PRODUCTION_BUYER_WORKERS_DEV_URL` — captured from first deploy output
- [ ] `PRODUCTION_SELLER_WORKERS_DEV_URL` — captured from first deploy output
- [ ] `PRODUCTION_ADMIN_WORKERS_DEV_URL` — captured from first deploy output

`APP_VERSION` is set automatically by the workflow from `github.sha`; no manual step required.

Verify after setting: `gh variable list --env production` shows all expected entries (minus the 4 workers.dev URLs on the first run).

## 6. Build-Time Public Env (frontend bundle)

These are referenced at the top-level `env:` block of `deploy-production.yml` and consumed by `pnpm run build` inside the workflow.

- [ ] `PUBLIC_API_BASE_URL` will resolve correctly: workflow uses `vars.PRODUCTION_API_URL || 'https://api.jeevatix.com'`; if the chosen API domain is NOT `api.jeevatix.com`, `PRODUCTION_API_URL` MUST be set in section 5
- [ ] `PUBLIC_PARTYKIT_HOST` set if live availability / queue UI features are needed in production (skip if PartyKit is not part of the launch scope)
- [ ] Local sanity check completed: after `pnpm run build`, no occurrence of `http://localhost:8787` in `apps/{buyer,admin,seller}/.svelte-kit/` (workflow asserts this; failing here aborts deploy)

## 7. External Uptime Monitor

- [ ] Better Stack / UptimeRobot / Pingdom account ready
- [ ] Monitor configured: `GET https://<PRODUCTION_API_DOMAIN>/health` — interval 1 minute
- [ ] Monitor configured: `GET https://<PRODUCTION_BUYER_DOMAIN>/events` — interval 5 minutes
- [ ] Monitor configured: `GET https://<PRODUCTION_SELLER_DOMAIN>/login` — interval 5 minutes
- [ ] Monitor configured: `GET https://<PRODUCTION_ADMIN_DOMAIN>/login` — interval 5 minutes
- [ ] Alert rule set: incident after 2 consecutive failures OR response timeout exceeding 10 seconds
- [ ] Notification channel attached: at least operations email (Slack / PagerDuty optional)
- [ ] Monitors are paused / pre-staged so they do not page on the first cold-start window; ready to be enabled the moment deploy completes

## 8. Pre-Deploy Smoke (state of staging right now)

- [ ] Latest staging deploy on `main` is green end-to-end (lint, format, typecheck, test, build, deploy, smoke, canary)
- [ ] Staging post-deploy SSR canary 5/5 PASS on the most recent run (real coverage via workers.dev URLs + Origin header)
- [ ] `curl -fsS https://api.jeevatix.my.id/health` returns `status: ok` and a recent `version`
- [ ] No in-flight database migration is running on the production VPS (schema push from section 2 has fully completed)
- [ ] No load test, bulk seed, or synthetic cleanup task is currently touching staging or production
- [ ] Working tree on the deploy branch matches the intended release SHA (`git rev-parse HEAD` recorded for the release log)

## 9. First Deploy Caveats

- [ ] Acknowledged: post-deploy SSR canary will SKIP on this first run because `PRODUCTION_*_WORKERS_DEV_URL` vars are intentionally unset (`5bfcb40` graceful-skip behaviour)
- [ ] Acknowledged: the `Smoke Test` step in `deploy-production.yml` still runs and validates `/health` against `PRODUCTION_API_URL`, so first-deploy coverage is non-zero
- [ ] Plan in place to capture the 4 workers.dev URLs from the deploy output (`https://jeevatix-production-{api,buyer,seller,admin}.<account>.workers.dev`) immediately after deploy
- [ ] Plan in place to set the 4 `PRODUCTION_*_WORKERS_DEV_URL` GitHub vars after first deploy and re-run `deploy-production.yml` (or wait for next merge to `main`-driven deploy if applicable) so the canary runs in full coverage from the second deploy onward
- [ ] Acknowledged: SST auto-creates the production Hyperdrive config (`jeevatix-production-hyperdrive`) and the R2 bucket on first deploy; no pre-creation needed but failures here will surface during deploy and may require manual cleanup before retry
- [ ] Acknowledged: the production stage is `protect: true` and `removal: 'retain'` in `sst.config.ts`; resources cannot be torn down by `sst remove` without explicit override

## 10. Final Sign-Off

- [ ] All boxes above are checked
- [ ] Release owner has read `PRODUCTION_RELEASE_RUNBOOK.md` end-to-end
- [ ] Release owner is ready to monitor reservation latency (known warning, ~p95 2.18s on staging 5-user slice)
- [ ] Rollback path acknowledged (see runbook section "Rollback Guidance")

When this section is fully checked, proceed to `PRODUCTION_RELEASE_RUNBOOK.md` for the actual deploy execution and post-deploy monitoring playbook.
