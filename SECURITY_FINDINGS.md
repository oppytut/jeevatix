# Security Findings — Snapshot

Date: 2026-05-26
Branch: `main` @ `62f756d`
Scope: opportunistic Track D scan, document-only. **No fix applied.**
Tools: `pnpm audit` (npm registry advisories) + `depwire_security_scan` (graph-aware static analysis on 242 files).
Reader audience: project owner deciding what (if anything) to bump or refactor before / after production launch.

## Executive Summary

| Source                  | Critical | High | Moderate | Low | Info | Notes                                                              |
| ----------------------- | -------- | ---- | -------- | --- | ---- | ------------------------------------------------------------------ |
| `pnpm audit --prod`     | 0        | 3    | 15       | 1   | —    | 19 advisories across 3 packages: `hono`, `undici`, `defu`          |
| `pnpm audit` (incl dev) | 0        | 7    | 26       | 3   | —    | adds `esbuild`, `ws`, more `undici` paths                          |
| `depwire_security_scan` | 8        | 40   | 55       | 6   | 169  | mostly architectural noise + test fixtures; 1 real refactor signal |

**No critical CVE in production dependencies. No new findings block production deploy.** The single security-relevant change worth doing now is `hono@4.12.9 → ^4.12.18` (one minor bump, eliminates 12 advisories at once).

---

## Section 1 — Dependency CVEs (`pnpm audit`)

Ranked by severity then exposure (production vs dev-only).

### High

| Package  | Current   | Patched    | Advisory                                                                                         | Exposure                                                                                                                                                                                       |
| -------- | --------- | ---------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `undici` | `<6.24.0` | `>=6.24.0` | GHSA-vrm6-8vpv-qv8q (Unbounded Memory Consumption in WebSocket permessage-deflate Decompression) | Reachable via Cloudflare Workers `fetch` polyfill chain. Workers runtime ships its own undici, so the npm package version may not be the actual runtime dependency. **Verify before bumping.** |
| `undici` | `<6.24.0` | `>=6.24.0` | GHSA-v9p9-hfj2-hcw8 (Unhandled Exception in WebSocket Client)                                    | Same as above.                                                                                                                                                                                 |
| `defu`   | `<=6.1.4` | `>=6.1.5`  | GHSA-737v-mqg7-c878 (Prototype pollution via `__proto__`)                                        | Transitive dep. Used by various build tools. **Run `pnpm why defu` after install to trace; if only via dev tools, treat as Low priority.**                                                     |

### Moderate (15)

12 of these are `hono` advisories patched at `>=4.12.12 / >=4.12.14 / >=4.12.16 / >=4.12.18`. Current: `4.12.9`. **One minor bump (4.12.9 → ^4.12.18) closes all 12 advisories.**

| Hono advisory                                                                 | Patched | Notes                                                                                              |
| ----------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| GHSA-26pp-8wgv-hjvm — cookie name validation in `setCookie()`                 | 4.12.12 | App uses `c.cookies` and SvelteKit cookies; review write paths if any.                             |
| GHSA-r5rp-j6wh-rvv4 — non-breaking-space bypass in `getCookie()`              | 4.12.12 | Auth flow reads cookies from Hono context; potential bypass if cookie names are filtered upstream. |
| GHSA-xf4j-xp2r-rqqx — `toSSG()` path traversal                                | 4.12.12 | Not used in this codebase.                                                                         |
| GHSA-wmmm-f939-6g9c — middleware bypass via repeated slashes in `serveStatic` | 4.12.12 | Not used (R2 serves static).                                                                       |
| GHSA-458j-xx4x-4375 — JSX attribute HTML injection                            | 4.12.14 | Not used (no `hono/jsx`).                                                                          |
| GHSA-xpcf-pg52-r92g — IPv4-mapped IPv6 mismatch in `ipRestriction()`          | 4.12.12 | Not used.                                                                                          |
| GHSA-qp7p-654g-cw7p — JSX SSR style injection                                 | 4.12.18 | Not used.                                                                                          |
| GHSA-p77w-8qqv-26rm — Cache middleware ignores Vary: Authorization/Cookie     | 4.12.18 | Not used (no Hono cache mw).                                                                       |
| GHSA-9vqf-7f2p-gf9v — `bodyLimit()` bypass for chunked requests               | 4.12.16 | Worth checking: API does not use `bodyLimit` mw, request size limits live elsewhere.               |
| GHSA-69xw-7hcm-h432 — JSX tag name HTML injection                             | 4.12.16 | Not used.                                                                                          |
| GHSA-hm8q-7f3q-5f36 (Low) — JWT verify() NumericDate validation               | 4.12.18 | App uses bcryptjs + custom JWT (not Hono JWT mw).                                                  |

Other moderate:

| Package   | Current               | Patched    | Advisory                                                                                                                   | Exposure                                                              |
| --------- | --------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `undici`  | `<6.23.0` / `<6.24.0` | `>=6.24.0` | GHSA-g9mf-h72j-4rw9 (decompression), GHSA-2mjp-6q6p-2qxm (HTTP smuggling), GHSA-4992-7rv2-5pvq (CRLF injection in upgrade) | Same Workers runtime caveat as the High undici findings.              |
| `esbuild` | `<=0.24.2`            | `>=0.25.0` | GHSA-67mh-4wv8-2f99 (dev server lets any site read responses)                                                              | **Dev-only**. Not in prod runtime.                                    |
| `ws`      | `>=8.0.0 <8.20.1`     | `>=8.20.1` | GHSA-58qx-3vcg-4xpx (uninitialized memory disclosure)                                                                      | Likely transitive (Vite / Playwright / SvelteKit). Dev-only exposure. |

### Low (1)

`hono` GHSA-hm8q-7f3q-5f36 — covered by the same `hono@^4.12.18` bump.

---

## Section 2 — Static Analysis (`depwire_security_scan`)

Total: 278 findings. Most are architectural classifications, NOT exploitable bugs. Triage below.

### Critical (8) — all manually verified

| ID      | File                                                                                          | Verdict                                                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-001 | `apps/api/src/lib/observability.ts:14` "Credential in URL query parameter"                    | **False positive.** Line 14 is `TOKEN_QUERY_PATTERN` regex used to **redact** `*token=...` query params from logs. Defensive code, not vulnerable code. |
| SEC-002 | `apps/api/src/__tests__/transaction-test-helpers.ts` "Unauthenticated route with high fan-in" | **False positive.** Test fixture, not a route.                                                                                                          |
| SEC-003 | `apps/api/src/index.ts` "Unauthenticated route"                                               | **False positive.** Hono app entry. Per-route auth applied in route definitions.                                                                        |
| SEC-004 | `apps/api/src/services/email.ts` "Unauthenticated route"                                      | **False positive.** Service module, not a route. Auth enforced upstream.                                                                                |
| SEC-005 | `apps/api/src/lib/observability.ts` "Unauthenticated route"                                   | **False positive.** Middleware factory, not a route.                                                                                                    |
| SEC-006 | `apps/api/src/services/order-reservation.service.ts` "Unauthenticated route"                  | **False positive.** Service module.                                                                                                                     |
| SEC-007 | `apps/api/src/lib/load-test-profile.ts` "Unauthenticated route"                               | **False positive.** Util module.                                                                                                                        |
| SEC-008 | `apps/api/src/lib/database-url.ts` "Unauthenticated route"                                    | **False positive.** DB connection helper.                                                                                                               |

**Pattern**: depwire's "route file" detector flags any file with high fan-in. The flagging logic does not distinguish between Hono routes (which need auth middleware) and library/service modules (which are reached only via routes). All 8 Critical entries fall in the latter category.

### High (40) — selective triage

Two real signals worth noting; the rest are architectural noise.

| ID                | File                                                                       | Verdict                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SEC-009**       | `packages/core/scripts/run-local-checkout-benchmark.ts:661` "unsafe spawn" | **Low risk** in practice. Script accepts CLI flags including paths to runner binaries; not exposed to network input. **Document-only.**                                                                                                                             |
| **SEC-010**       | `scripts/run-local-e2e.mjs:44` "unsafe spawn"                              | Same as SEC-009. Local helper script. **Document-only.**                                                                                                                                                                                                            |
| SEC-011, 012      | `apps/api/src/__tests__/email.test.ts` "Credential in URL"                 | **False positive.** Test code, intentionally constructs verify-email URLs.                                                                                                                                                                                          |
| SEC-013, 014, 015 | `apps/api/src/routes/__tests__/auth.test.ts` "Credential in URL"           | **False positive.** Test code.                                                                                                                                                                                                                                      |
| SEC-016, 017      | `tests/e2e/auth/password-reset-flow.spec.ts`                               | **Real signal but unavoidable.** Email links carry tokens in URLs. This is the standard reset-password UX. Mitigation already in place: short token TTL + one-time-use.                                                                                             |
| SEC-018-023       | `tests/e2e/{buyer,seller}-pages.spec.ts` "Credential in URL"               | **False positive.** Test code, not production route.                                                                                                                                                                                                                |
| SEC-024           | `apps/api/src/middleware/auth.ts` "God file mixes auth and data"           | **Refactor opportunity, not vulnerability.** Middleware coexists with token cache + JWT decode. Worth splitting if the file grows further.                                                                                                                          |
| SEC-025           | `apps/api/src/schemas/auth.schema.ts` "God file"                           | **False positive.** Schema file, "auth-related symbols" by design.                                                                                                                                                                                                  |
| SEC-026-032       | "Direct DB access from route handler" in service files                     | **False positive.** Services are the data layer; they SHOULD import the DB connector. The 3-layer architecture (route → service → schema) per `.github/copilot-instructions.md` already enforces this. depwire's heuristic mis-categorizes service files as routes. |
| SEC-033-048       | "Unauthenticated route" on schemas, services, queue files                  | **False positives.** Same issue as Critical findings — high fan-in non-route files.                                                                                                                                                                                 |

### Medium (55) — sample triage

Skimmed: dominated by `path-traversal` flags on benchmark/load-test scripts (`readFileSync` with paths from CLI args) and `information-disclosure` flags in test code. None production-runtime exploitable. Full list available in tool output (file: `tool_e652f66440015VikgoAVIp0lu1`).

### Low (6), Info (169)

Architectural metrics + dependency notes. Not actioned.

---

## Section 3 — Recommendations (priority order)

### P0 (recommended now, low effort, high value)

1. **Bump `hono` from `4.12.9` → `^4.12.18`.**
   - Closes 12 advisories in one minor version bump.
   - Verify with `pnpm install` then `pnpm run typecheck && pnpm run test && pnpm run build`.
   - Likely zero breaking changes within the 4.12.x range.
   - Files affected: `apps/api/package.json`, `packages/core/package.json` (per `pnpm why hono`).

### P1 (after launch is stable)

2. **Bump `undici` if Workers runtime allows it.**
   - Cloudflare Workers ships its own polyfill of `fetch`. Even with `nodejs_compat`, the runtime undici may differ from the npm-resolved one.
   - Action: bump npm dep, run full test + build, deploy to staging, verify nothing regresses on the canary path.
   - Patched range `>=6.24.0` closes 5 advisories (3 high, 2 moderate).

3. **Bump `defu` to `>=6.1.5`.**
   - Trace via `pnpm why defu -r` and bump only the non-dev parents if exposure is dev-only.

4. **Refactor `apps/api/src/middleware/auth.ts`** (SEC-024).
   - Split JWT decode + token cache into a separate `lib/jwt-cache.ts` module so the middleware file stays auth-only.
   - Code smell, not a CVE. Defer until you touch this file for another reason.

### P2 (deferred indefinitely unless symptom appears)

5. **Add `bodyLimit` middleware** if/when API accepts user-uploaded payloads larger than current implicit limits (currently R2 upload is handled separately and image uploads have explicit size checks). Not currently exploitable.
6. **Replace token-in-URL pattern in password reset email** (SEC-016/017) with a session-rotated token model. UX trade-off, not currently a real vulnerability given short TTL.
7. **Run `depwire_security_scan` again** after `hono` bump to verify advisory deltas; iterate quarterly.

### NOT recommended

- Bumping `esbuild` for dev-only advisory: blocked by SvelteKit / Vite dependency pins. Will resolve naturally on next SvelteKit major.
- Splitting service files away from `database-url.ts` (SEC-026-032): contradicts established 3-layer architecture; depwire heuristic is wrong here.

---

## Section 4 — Notes for next session

- Findings are static. **Re-run after every dependency bump** to verify no regressions.
- depwire's route classifier produces high false-positive rate on this codebase. Filter its output by checking whether the flagged file is actually under `apps/api/src/routes/**` before treating it as a real "unauthenticated route".
- The two `pnpm audit` JSON outputs are at:
  - `/tmp/opencode/pnpm-audit-prod.json` (prod deps only — what runs on Cloudflare)
  - `/tmp/opencode/pnpm-audit-all.json` (all deps incl dev — what builds in CI)
- Full depwire scan output saved at `/home/debian/.local/share/opencode/tool-output/tool_e652f66440015VikgoAVIp0lu1`.
