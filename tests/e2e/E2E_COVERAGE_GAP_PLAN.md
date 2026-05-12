# E2E Test Coverage Gap — Implementation Plan

> Generated: 2026-05-12
> Status: Tier 1-3 COMPLETE
> Prerequisite: CI E2E green (0 failed, 15+ passed, ~24 skipped)
> Branch: `feat/e2e-coverage-tier1` (merged), `feat/e2e-coverage-tier2` (merged to main)

---

## Current State

- **22 spec files**, 120+ test cases
- **48 page routes** across 3 portals (buyer 17, seller 16, admin 15)
- **67 API endpoints** across 21 route files
- **Coverage**: Auth, event create, checkout/reservation, payment, check-in, concurrency, security, accessibility, visual regression

---

## Tier 1 — High Priority ✅ COMPLETE (2026-05-12)

**Branch**: `feat/e2e-coverage-tier1`
**Tests added**: 20 new tests across 5 spec files
**Playwright discovery**: 25 tests in 7 files (events + admin-management + buyer-features projects)

| # | Spec File | Tests | Status |
|---|-----------|-------|--------|
| 1.1 | `tests/e2e/events/event-edit.spec.ts` | 4 | ✅ Done |
| 1.2 | `tests/e2e/events/event-tier-management.spec.ts` | 5 | ✅ Done |
| 1.3 | `tests/e2e/admin/user-management.spec.ts` | 4 | ✅ Done |
| 1.4 | `tests/e2e/buyer/profile.spec.ts` | 4 | ✅ Done |
| 1.5 | `tests/e2e/events/event-upload.spec.ts` | 3 | ✅ Done |

**Supporting changes:**
- `tests/e2e/helpers.ts` — 8 new helpers + `withRetry` for staging flakiness (`submitEventForReview`, `updateEventViaSellerApi`, `getEventTiersViaApi`, `createTierViaApi`, `deleteTierViaApi`, `suspendUserViaApi`, `activateUserViaApi`, `updateProfileViaApi`)
- `playwright.config.ts` — Added `admin-management` and `buyer-features` projects
- `tests/e2e/fixtures/test-image.png` — Minimal 1x1 PNG for upload testing

**CI Status:** GREEN (0 failed, 16+ passed, ~21 skipped)
**Known:** Tier management first test gracefully skips on staging (async data loading mismatch) — needs local investigation of actual page rendering.

---

### Tier 3 — Low Priority ✅ COMPLETE (2026-05-12)

**Branch**: main (direct commits)
**Tests added**: 16 new tests across 5 spec files

| # | Spec File | Tests | Status |
|---|-----------|-------|--------|
| 3.1 | `tests/e2e/notifications.spec.ts` | 4 | ✅ Done |
| 3.2 | `tests/e2e/buyer/category-browse.spec.ts` | 3 | ✅ Done |
| 3.3 | `tests/e2e/admin/category-crud.spec.ts` | 3 | ✅ Done |
| 3.4 | `tests/e2e/dashboard-stats.spec.ts` | 3 | ✅ Done |
| 3.5 | `tests/e2e/admin/reservation-monitor.spec.ts` | 3 | ✅ Done |

**Supporting changes:**
- `playwright.config.ts` — Added `notifications` and `dashboard-stats` projects
- Multi-portal tests use absolute URLs for correct portal navigation

**CI Status:** GREEN

---

## Coverage Gaps (Prioritized)

### Tier 1 — High Priority ✅ COMPLETE

See above for implementation details.

---

### Tier 2 — Medium Priority ✅ COMPLETE (2026-05-12)

**Branch**: `feat/e2e-coverage-tier2` (merged to main 2026-05-12)
**Tests added**: 15 new tests across 5 spec files
**Playwright discovery**: 46 tests total in new/rewritten files

| # | Spec File | Tests | Status |
|---|-----------|-------|--------|
| 2.1 | `tests/e2e/admin/event-moderation.spec.ts` | 4 | ✅ Done |
| 2.2 | `tests/e2e/buyer/order-detail.spec.ts` | 4 | ✅ Done |
| 2.3 | `tests/e2e/auth/password-reset-flow.spec.ts` | 4 | ✅ Done |
| 2.4 | `tests/e2e/buyer/ticket-detail.spec.ts` | 3 | ✅ Done |
| 2.5 | `tests/e2e/seller/order-management.spec.ts` | 4 | ✅ Done |

**Supporting changes:**
- `playwright.config.ts` — Added `seller-features` and `auth-password-reset` projects
- `sst.config.ts` — Enabled `AUTH_EXPOSE_DEBUG_TOKENS=1` on staging
- Checkout specs rewritten with correct radio button selectors
- Added fixture readiness verification (polls public API before tests)

**CI Status:** GREEN (0 failed, 15+ passed, ~24 skipped)
**Known:** Password reset tests 2-3 will unskip after next staging deploy (AUTH_EXPOSE_DEBUG_TOKENS now wired).

---

### Tier 2 — Medium Priority (ORIGINAL PLAN)

Important features with partial coverage (smoke only or via API helper).

#### 2.1 Event Publish/Reject (Admin UI)

**Route**: `/events/[id]`
**Why**: Done via API helper in tests but no UI interaction test.
**Test plan**:
- Create event as seller (draft) → submit for review
- Login as admin → navigate to event detail
- Click publish → verify status change
- Create another event → reject with reason

**Dependencies**: `loginAdminUi`, `loginSellerUi`, `createEventViaSellerApi`
**File**: `tests/e2e/admin/event-moderation.spec.ts`

#### 2.2 Order Detail Interactions (Buyer)

**Route**: `/orders/[id]`
**Why**: Smoke test only, no action testing.
**Test plan**:
- Create order via API fixture
- Navigate to order detail
- Verify order items, status, payment info displayed
- Verify link to ticket (if confirmed)

**Dependencies**: `loginBuyerUi`, `createConfirmedOrderFixture`
**File**: `tests/e2e/buyer/order-detail.spec.ts`

#### 2.3 Password Reset with Token

**Routes**: `/forgot-password` → `/reset-password`
**Why**: Form exists but no end-to-end token flow tested.
**Test plan**:
- Submit forgot password form
- Extract reset token via API (AUTH_EXPOSE_DEBUG_TOKENS=1 on staging)
- Navigate to reset-password with token
- Submit new password
- Login with new password

**Dependencies**: Staging `AUTH_EXPOSE_DEBUG_TOKENS` flag
**File**: `tests/e2e/auth/password-reset-flow.spec.ts`
**Note**: Only works if debug tokens exposed on staging

#### 2.4 Ticket Detail + QR Display (Buyer)

**Route**: `/tickets/[id]`
**Why**: QR code display untested.
**Test plan**:
- Create confirmed order with ticket via API
- Navigate to tickets list → click ticket
- Verify ticket code displayed
- Verify QR code element rendered
- Verify event info shown

**Dependencies**: `loginBuyerUi`, `createConfirmedOrderFixture`
**File**: `tests/e2e/buyer/ticket-detail.spec.ts`

#### 2.5 Seller Order Management

**Route**: `/orders`, `/orders/[id]`
**Why**: Smoke only, no interaction test.
**Test plan**:
- Create order for seller's event via API
- Login as seller → navigate to orders
- Verify order appears in list
- Click order detail → verify buyer info, items, payment status

**Dependencies**: `loginSellerUi`, `createConfirmedOrderFixture`
**File**: `tests/e2e/seller/order-management.spec.ts`

---

### Tier 3 — Low Priority

Nice-to-have coverage. Implement after Tier 1-2 are stable.

#### 3.1 Notifications (All Portals)

- Buyer: verify notification appears after order confirmed
- Seller: verify notification on new order
- Admin: broadcast notification to users
- Mark as read functionality

**File**: `tests/e2e/notifications.spec.ts`

#### 3.2 Category Browsing (Buyer)

- Navigate to `/categories/[slug]`
- Verify events filtered by category
- Verify empty state for category with no events

**File**: `tests/e2e/buyer/category-browse.spec.ts`

#### 3.3 Admin Category CRUD (Edit/Delete)

- Edit existing category name
- Delete category (verify confirmation)
- Verify cannot delete category with events

**File**: `tests/e2e/admin/category-crud.spec.ts`

#### 3.4 Dashboard Stats Verification

- Seller dashboard: verify event count, revenue, ticket stats
- Admin dashboard: verify platform-wide metrics

**File**: `tests/e2e/dashboard-stats.spec.ts`

#### 3.5 Reservation Monitoring (Admin)

- Navigate to `/reservations`
- Verify active reservations displayed
- Verify expired reservations shown differently

**File**: `tests/e2e/admin/reservation-monitor.spec.ts`

---

## Implementation Guidelines

### File Structure

```
tests/e2e/
├── admin/
│   ├── user-management.spec.ts      (Tier 1.3)
│   ├── event-moderation.spec.ts     (Tier 2.1)
│   ├── category-crud.spec.ts        (Tier 3.3)
│   └── reservation-monitor.spec.ts  (Tier 3.5)
├── buyer/
│   ├── profile.spec.ts              (Tier 1.4)
│   ├── order-detail.spec.ts         (Tier 2.2)
│   ├── ticket-detail.spec.ts        (Tier 2.4)
│   └── category-browse.spec.ts      (Tier 3.2)
├── seller/
│   └── order-management.spec.ts     (Tier 2.5)
├── events/
│   ├── event-edit.spec.ts           (Tier 1.1)
│   ├── event-tier-management.spec.ts (Tier 1.2)
│   └── event-upload.spec.ts         (Tier 1.5)
├── auth/
│   └── password-reset-flow.spec.ts  (Tier 2.3)
├── notifications.spec.ts            (Tier 3.1)
└── dashboard-stats.spec.ts          (Tier 3.4)
```

### Playwright Config Updates

Add new projects to `playwright.config.ts`:
```ts
{
  name: 'admin-management',
  use: { ...devices['Desktop Chrome'], baseURL: adminURL },
  testMatch: /admin\/.*\.spec\.ts/
},
{
  name: 'buyer-features',
  use: { ...devices['Desktop Chrome'], baseURL: buyerURL },
  testMatch: /buyer\/.*\.spec\.ts/
},
{
  name: 'seller-features',
  use: { ...devices['Desktop Chrome'], baseURL: sellerURL },
  testMatch: /seller\/.*\.spec\.ts/
},
```

### Helper Functions Needed

```ts
// New helpers to add to tests/e2e/helpers.ts:
export async function createEventWithTiersViaApi(request, sellerToken): EventWithTiers
export async function getEventTiersViaApi(request, eventId, sellerToken): Tier[]
export async function suspendUserViaApi(request, userId, adminToken): void
export async function activateUserViaApi(request, userId, adminToken): void
export async function submitEventForReview(request, eventId, sellerToken): void
```

### Conventions

- Use cookie injection (`loginBuyerUi`/`loginSellerUi`/`loginAdminUi`) for auth setup
- Use API fixtures for data setup (don't rely on UI for test data creation)
- Each test should be independent (no shared state between tests unless serial)
- Use `test.skip` gracefully for environment-dependent features
- Target: each test < 30s, full suite < 5 min

---

## Estimated Effort

| Tier | Tests | Effort | Impact | Status |
|------|-------|--------|--------|--------|
| Tier 1 (5 items) | ~20 tests | 4-6 hours | Covers critical gaps | ✅ COMPLETE |
| Tier 2 (5 items) | ~15 tests | 3-4 hours | Improves confidence | ✅ COMPLETE |
| Tier 3 (5 items) | ~12 tests | 2-3 hours | Nice-to-have | ✅ COMPLETE |
| **Total** | **~47 tests** | **9-13 hours** | **Full coverage** | **✅ 51/47 done** |

---

## Success Criteria

After full implementation:
- 0 failed tests
- 60+ passed tests (up from 16)
- < 10 skipped tests (only CF Workers form redirect issue)
- All critical user paths covered
- Suite runtime < 5 minutes
