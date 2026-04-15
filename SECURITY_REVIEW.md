# Security Review

Date: 2026-04-05
Scope: entire Jeevatix workspace, with detailed verification on `apps/api`, `apps/buyer`, `apps/admin`, `apps/seller`, and selected `packages/core` utilities.

## Summary

This review verified the T-10.4 checklist across the current codebase.

- Input validation is in place across API routes via `@hono/zod-openapi` schemas and `c.req.valid(...)`.
- No unsafe `{@html ...}` rendering was found in buyer, seller, or admin frontends.
- No SQL string concatenation was found. The codebase uses Drizzle ORM and tagged `sql` fragments.
- Payment webhook signature verification is implemented correctly with HMAC over the raw request body.
- Authorization checks are present at middleware and service level for buyer, seller, and admin flows.
- Password hashing uses `bcryptjs`, and JWT access/refresh rotation is already implemented.
- During this review, rate limiting was added for login, registration, and reservation creation.
- During this review, a sensitive password log in the load-user seeder was removed.

## Checklist Status

| Item                              | Status | Notes                                                                                                                                                                                                                                                    |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input validation on all endpoints | PASS   | API routes use `createRoute()` and validated request parsing. Multipart upload uses OpenAPI multipart schema plus service-side file validation.                                                                                                          |
| SQL injection prevention          | PASS   | No raw SQL string concatenation found. Tagged `sql` usage is limited to parameterized Drizzle expressions such as `date_trunc(...)`, `for update`, and check constraints.                                                                                |
| XSS prevention                    | PASS   | No `{@html ...}` usage found in frontend apps. User-generated content is rendered as plain text/components.                                                                                                                                              |
| CSRF protection                   | PASS   | API authentication relies on bearer tokens, and refresh uses an explicit JSON body token instead of implicit cookie auth. Buyer, admin, and seller portals now keep their auth cookies `httpOnly`, so token theft risk from a future XSS bug is reduced. |
| Rate limiting                     | FIXED  | Auth and reservation throttling now use a shared Durable Object-backed limiter in production, with in-memory fallback only for local/test contexts where the binding is unavailable.                                                                     |
| Webhook signature verification    | PASS   | `POST /webhooks/payment` validates `x-payment-signature` against HMAC-SHA256 of the raw body and rejects invalid signatures.                                                                                                                             |
| Authorization checks              | PASS   | Buyer ownership checks, seller event ownership checks, and admin-only route guards are present.                                                                                                                                                          |
| Password hashing                  | PASS   | Passwords use `bcryptjs`. No MD5/SHA password hashing found.                                                                                                                                                                                             |
| JWT expiry and refresh strategy   | PASS   | Access token TTL is 15 minutes, refresh token TTL is 7 days, refresh rotation is implemented, and payloads contain only `id`, `email`, `role`, `jti`, `type`, `iat`, `exp`.                                                                              |
| CORS configuration                | FIXED  | Allowed origins are now read from deployment environment (`CORS_ALLOWED_ORIGINS`), with localhost-only fallback for local development.                                                                                                                   |
| Sensitive data in logs            | FIXED  | API runtime logs do not emit passwords or JWTs. Structured Workers Logs events now also redact auth headers, cookies, token-like strings, and email addresses before error details are emitted.                                                          |

## Changes Made During Review

### 1. Rate limiting middleware added

Added `apps/api/src/middleware/rate-limit.ts`.

Implemented a lightweight edge-compatible window counter with:

- client IP extraction from `CF-Connecting-IP` or `X-Forwarded-For`
- shared Durable Object-backed counters in production
- in-memory fallback for local/test runs without the DO binding
- `429 RATE_LIMIT_EXCEEDED` responses
- `Retry-After` response header

Applied to:

- `POST /auth/login` -> max `5` requests per minute per IP
- `POST /auth/register` -> max `3` requests per minute per IP
- `POST /auth/register/seller` -> max `3` requests per minute per IP
- `POST /reservations` -> max `10` requests per minute per authenticated user

OpenAPI route docs were also updated to include `429` responses on affected endpoints.

### 2. Sensitive logging cleanup

Updated `packages/core/src/db/seed-load-users.ts` to stop logging the default load-test password.

## Verification Notes Per Checklist Item

### 1. Input Validation

Verified the route layer under `apps/api/src/routes/`.

Findings:

- Request bodies, params, and query strings are consistently declared in route contracts.
- Route handlers consume validated data via `c.req.valid(...)`, not raw `c.req.json()`.
- Upload flow is the main special case: it uses `multipart/form-data` plus service-level MIME type and file-size checks.

Conclusion: no missing validation gap was found in the reviewed routes.

### 2. SQL Injection

Search results found no string-built SQL queries.

Observed patterns:

- Drizzle query builder for standard CRUD and filtering.
- Tagged `sql` for safe parameterized expressions in dashboard aggregation and row locking.

Representative safe usages:

- `apps/api/src/services/ticket-generator.ts`
- `apps/api/src/services/admin-dashboard.service.ts`
- `apps/api/src/services/seller-dashboard.service.ts`

Conclusion: no SQL injection issue found.

### 3. XSS Prevention

Searched frontend apps for `{@html ...}` and found no matches.

Conclusion: no direct unsanitized HTML rendering issue found.

Residual note:

- admin and seller now match buyer in storing session cookies as `httpOnly`, which reduces exposure if an XSS bug is introduced later.

### 4. CSRF Protection

Current API authorization pattern is bearer-token based, not cookie-session based:

- protected API calls send `Authorization: Bearer ...`
- refresh flow sends `refresh_token` explicitly in JSON body
- backend auth middleware reads the bearer header, not ambient browser cookies

Conclusion:

- CSRF token is not required for current API behavior.
- Buyer, admin, and seller portals now all use server-managed `httpOnly` cookies.

### 5. Rate Limiting

Before this review, no rate limiting middleware existed.

Current state after fix:

- login limited by IP
- registration limited by IP
- reservation creation limited by authenticated user id

Test coverage added:

- auth registration limit test
- auth login limit test
- reservation create limit test

Important production note:

- production now uses the shared Durable Object binding, so rate-limit counters are no longer isolated per worker instance
- the in-memory path remains only as a fallback for local/test contexts where the Durable Object binding is not available

### 6. Webhook Security

Verified in `apps/api/src/routes/payments.ts` and `apps/api/src/services/payment.service.ts`.

Observed protections:

- raw request body captured before JSON parsing
- signature required from `x-payment-signature`
- expected signature recomputed with HMAC-SHA256
- constant-time comparison helper used
- invalid signatures return `401`

Conclusion: webhook verification is correctly implemented.

### 7. Authorization

Verified the following patterns:

- admin routes use `authMiddleware` plus `roleMiddleware('admin')`
- seller routes use seller role guard and ownership checks in services
- buyer-facing order/reservation/ticket reads validate resource ownership

Conclusion: no confirmed authorization bypass was found in the reviewed routes and services.

### 8. Password Security

Verified in `packages/core/src/password.ts` and related auth flows.

Observed:

- `bcryptjs` used for password hashing and verification
- no MD5, SHA-1, or plain-text password storage found for user passwords

Clarification:

- refresh tokens are stored as deterministic SHA-256 hashes for lookup and revocation; this is separate from password hashing and does not violate the password requirement

### 9. JWT Handling

Verified in `packages/core/src/jwt.ts` and auth services.

Observed:

- access token TTL: 15 minutes
- refresh token TTL: 7 days
- refresh token rotation implemented
- tokens include `jti`
- auth middleware rejects refresh tokens on access-protected routes by checking `payload.type === 'access'`
- payload does not include password hashes or other sensitive attributes

Conclusion: JWT handling is sound for current scope.

### 10. CORS

Verified in `apps/api/src/middleware/cors.ts`.

Observed:

- only `http://localhost:4301`
- only `http://localhost:4302`
- only `http://localhost:4303`

Conclusion:

- local development remains restricted to localhost portal origins by default
- deployed environments can now control production allowlists explicitly through `CORS_ALLOWED_ORIGINS`

### 11. Logging and Sensitive Data Exposure

Observed runtime logs in API services and durable objects are generic performance/error logs and do not print JWTs, refresh tokens, or passwords.

Current production baseline also adds structured API error events with request correlation IDs. Those events redact auth headers, cookies, token-like strings, and email addresses before they reach Workers Logs.

One issue was found and fixed:

- `packages/core/src/db/seed-load-users.ts` logged the default password to stdout

Conclusion: after that fix, no confirmed sensitive logging issue remains in the reviewed runtime and utility paths.

## Tests Run

Executed:

```bash
cd apps/api && pnpm exec vitest run src/routes/__tests__/auth.test.ts src/__tests__/reservation.test.ts
```

Result:

- `24` tests passed
- includes new rate-limiting coverage for auth and reservations

## Residual Hardening Backlog

Post-review hardening update on 2026-04-15 closed the three production backlog items that were still open at review time:

1. Auth and reservation rate limits now use a shared Durable Object-backed limiter in production.
2. Admin and seller token persistence now uses `httpOnly` server-managed cookies instead of JS-readable cookies.
3. CORS allowed origins are now environment-driven through `CORS_ALLOWED_ORIGINS`.

## Final Assessment

T-10.4 review is complete.

The only confirmed checklist gaps found during implementation were:

- missing rate limiting on login, registration, and reservation creation
- sensitive password output in the load-user seeder log

Both were fixed in this change set.
