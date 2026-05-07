# Tier 1: Critical Path E2E Tests

## Overview

Tier 1 tests cover critical error scenarios and edge cases that must work correctly in production. These tests complement the existing happy path flows (buyer-flow, seller-flow, admin-flow).

## Test Coverage

### ✅ Existing Happy Path Tests (Already Implemented)
- **buyer-flow.spec.ts**: Complete buyer journey (register → ticket)
- **seller-flow.spec.ts**: Complete seller journey (register → check-in)
- **admin-flow.spec.ts**: Complete admin journey (login → moderate)

### 🆕 New Critical Error Tests (Tier 1)

#### 1. critical-errors.spec.ts (8 tests)
Tests critical error scenarios that users may encounter:

| Test | Scenario | Expected Behavior |
|------|----------|-------------------|
| Payment timeout | User delays payment | Order remains pending, no data loss |
| Expired reservation | Reservation countdown expires | Clear error message, can retry |
| Invalid QR code | Seller scans invalid code | Error shown, no system crash |
| Session expiry | Session expires during checkout | Redirect to login, preserve cart |
| Double payment | User clicks pay button twice | Button disabled, prevent duplicate |
| Insufficient stock | User requests more than available | Clear stock error message |
| Network errors | API calls fail | Graceful degradation, retry option |
| Form validation | Submit empty form | Client-side validation errors |

#### 2. concurrent-reservations.spec.ts (3 tests)
Tests war ticket scenarios with concurrent users:

| Test | Scenario | Expected Behavior |
|------|----------|-------------------|
| Concurrent reservations | Multiple users reserve same ticket | Only one succeeds, others get error |
| Race condition handling | Simultaneous checkout attempts | Durable Object prevents overselling |
| Stock accuracy | After concurrent attempts | Stock count remains accurate |

#### 3. edge-cases.spec.ts (5 tests)
Tests edge cases and boundary conditions:

| Test | Scenario | Expected Behavior |
|------|----------|-------------------|
| Zero quantity | User tries to buy 0 tickets | Validation error |
| Negative quantity | User enters negative number | Validation error |
| Maximum quantity | User exceeds max per order | Validation error |
| Past event | User tries to buy past event ticket | Clear error message |
| Unpublished event | User accesses unpublished event | 404 or access denied |

## Running Tests

### Run All Tier 1 Tests
```bash
pnpm exec playwright test --project=critical
```

### Run Specific Test File
```bash
pnpm exec playwright test critical-errors.spec.ts --project=critical
pnpm exec playwright test concurrent-reservations.spec.ts --project=critical
pnpm exec playwright test edge-cases.spec.ts --project=critical
```

### Run in Headed Mode (Debug)
```bash
pnpm exec playwright test --project=critical --headed
```

### Run with UI Mode (Interactive)
```bash
pnpm exec playwright test --project=critical --ui
```

## Test Results

### Expected Outcomes
- **Total Tests**: 16 (8 + 3 + 5)
- **Expected Pass Rate**: 100%
- **Execution Time**: ~3-5 minutes

### Current Status
- ✅ critical-errors.spec.ts: 8 tests implemented
- ✅ concurrent-reservations.spec.ts: 3 tests implemented
- ✅ edge-cases.spec.ts: 5 tests implemented

## Test Data Setup

All tests use the existing helper functions from `helpers.ts`:
- `createBuyerViaApi()` - Create test buyer accounts
- `createPublishedEventFixture()` - Create test events with tiers
- `loginBuyerUi()` / `loginSellerUi()` - Login helpers
- `uniqueEmail()` - Generate unique test emails

Tests run in `serial` mode to avoid data conflicts.

## Maintenance

### Adding New Critical Tests
1. Identify critical error scenario
2. Add test to appropriate file (errors/concurrent/edge-cases)
3. Use existing helpers for data setup
4. Ensure test is idempotent (can run multiple times)
5. Add to this documentation

### Debugging Failed Tests
1. Run in headed mode: `--headed`
2. Check screenshots in `test-results/`
3. Review trace: `pnpm exec playwright show-trace <trace-file>`
4. Check mock API logs if using local testing

## Integration with CI/CD

These tests should run:
- ✅ On every PR (required to pass)
- ✅ Before deployment to staging
- ✅ Before deployment to production
- ✅ Nightly regression suite

## Next Steps (Future Tiers)

After Tier 1 is stable, consider:
- **Tier 2**: Feature-specific tests (auth, events, checkout)
- **Tier 3**: Visual regression & accessibility
- **Tier 4**: Performance & multi-browser

## Contact

For questions or issues with these tests, refer to:
- Test helpers: `tests/e2e/helpers.ts`
- Playwright config: `playwright.config.ts`
- Project documentation: `README.md`
