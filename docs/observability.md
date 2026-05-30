# Observability — Sentry tags & breadcrumbs

This document describes the per-request Sentry context produced by the
Jeevatix services. Errors and traces in Sentry can be filtered by these
tags; breadcrumbs explain the lead-up to an event without leaking PII.

Sentry is gated on `SENTRY_DSN` — every helper documented here is a
no-op when no DSN is set.

## Tags (set per request)

| Tag           | Source                        | Values                                                       |
| ------------- | ----------------------------- | ------------------------------------------------------------ |
| `portal`      | API + portal hooks            | `api` \| `buyer` \| `seller` \| `admin`                      |
| `route`       | Hono `routePath` / SvelteKit `event.route.id` | matched route pattern; pathname fallback     |
| `feature_area`| derived from path / route id  | `auth`, `orders`, `payments`, `reservations`, `tickets`, `events`, `notifications`, `admin`, `sellers`, `uploads`, `health`, `docs`, `infra`, `home`, `unknown` |
| `app_version` | `APP_VERSION` env             | git SHA or release tag                                       |
| `user.role`   | auth middleware / portal hook | `buyer` \| `seller` \| `admin` (when authenticated)          |

## User context

`Sentry.setUser({ id })` is set per request when the caller is
authenticated. **ID only** — never email, name, phone, or IP. Context is
cleared on the response so it cannot leak across requests on a single
Worker isolate.

## Breadcrumbs (category `business`)

Emitted via `recordBusinessEvent(name, data)` from
`apps/api/src/lib/sentry-breadcrumbs.ts`. Each call sanitizes
PII-shaped keys (`email`, `phone`, `password`, `full_name`, `name`,
`ip`, `address`, `*_token`, `cookie`, `authorization`).

| Event                            | When                                        | Sample data fields                                            |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| `order.created`                  | Buyer creates an order                      | `order_id`, `order_number`, `reservation_id`, `event_id`, `quantity`, `total_amount`, `payment_method` |
| `payment.initiated`              | Buyer initiates payment                     | `order_id`, `payment_id`, `method`, `external_ref`            |
| `payment.succeeded`              | Webhook confirms payment                    | `order_id`, `payment_id`, `external_ref`, `reservation_id`    |
| `payment.failed`                 | Webhook reports failure                     | `order_id`, `payment_id`, `external_ref`                      |
| `reservation.created`            | Buyer reserves seats                        | `reservation_id`, `ticket_tier_id`, `quantity`, `expires_at`  |
| `reservation.expired`            | Cleanup queue expires reservation           | `reservation_id`, `event_id`, `expires_at`                    |
| `reservation.cancelled`          | Buyer cancels                               | `reservation_id`, `status`                                    |
| `reservation.cleanup_processed`  | Cleanup queue batch finishes                | `payment_reminders`, `event_reminders`, `processed`, `skipped`|
| `auth.login`                     | Login succeeds                              | `user_id`, `role`                                             |
| `auth.refresh`                   | Refresh token rotated                       | `user_id`, `role`                                             |
| `auth.logout`                    | Logout request handled                      | `user_id`                                                     |

## Trace sampling

`apps/api/src/lib/sentry.ts` configures `tracesSampler` per route:

- **Payment routes** (`/payments`, `/webhooks/payment`) — 100% sampling.
  Rare and high-value to debug.
- **Health and static routes** (`/health`, `/favicon.ico`, `/robots.txt`,
  `/_app/*`) — 1% sampling. High volume, low debug value.
- **Default** — `SENTRY_TRACES_SAMPLE_RATE` env value, falling back to
  10% in production / 100% elsewhere.

## /health response

`GET /health` returns the existing fields (`status`, `timestamp`,
`version`, `environment`, `service`) plus:

- `uptime_ms` — Worker isolate uptime since first request
- `db_latency_ms` — `SELECT 1` round trip; `null` when DB is unavailable
- `sentry_status` — `enabled` if `SENTRY_DSN` is set, else `disabled`

The response is `Cache-Control: no-store` and the existing health
contract (status/timestamp/version/environment/service) is preserved.

## Sample event payload (production)

```json
{
  "event_id": "abc...",
  "level": "error",
  "tags": {
    "portal": "api",
    "route": "/payments/:order_id",
    "feature_area": "payments",
    "app_version": "git-abc1234",
    "user.role": "buyer"
  },
  "user": { "id": "u_01HZ..." },
  "breadcrumbs": [
    { "category": "business", "message": "reservation.created", "data": { "reservation_id": "r_...", "quantity": 2 } },
    { "category": "business", "message": "order.created", "data": { "order_id": "o_...", "total_amount": "250000" } },
    { "category": "business", "message": "payment.initiated", "data": { "order_id": "o_...", "method": "bank_transfer" } }
  ]
}
```

## Deferred items

- **Reservation queue depth in /health** — Cloudflare Queues binding
  does not expose a runtime metric API. Skipped per the original task
  guidance ("only if cheap; estimate if not").
- **Session replay** — explicitly out of scope (browser bundle impact).
- **Profiling** — explicitly out of scope (compute overhead).
