# Tier 2: Feature-Specific E2E Tests

## Overview

Tier 2 implements comprehensive feature-specific tests covering authentication, event management, checkout/payment, and check-in systems.

## Test Structure

```
tests/e2e/
├── auth/
│   ├── buyer-auth.spec.ts          # Buyer authentication flows
│   ├── seller-auth.spec.ts         # Seller authentication with org
│   └── session-management.spec.ts  # Token refresh, logout, concurrent sessions
├── events/
│   ├── event-crud.spec.ts          # Create, edit, delete, publish
│   └── event-search.spec.ts        # Search, filter, category navigation
├── checkout/
│   ├── reservation-flow.spec.ts    # Reserve → countdown → payment
│   └── order-management.spec.ts    # View, cancel orders
└── checkin/
    └── qr-scan.spec.ts             # Valid QR, invalid QR, duplicate scan
```

## Test Coverage

### 2.1 Authentication & Authorization (3 files, ~15 tests)

**buyer-auth.spec.ts** (6 tests)
- ✅ Register with valid data
- ✅ Login with correct credentials
- ✅ Login fails with wrong password
- ✅ Forgot password flow
- ✅ Reset password with valid token
- ✅ Email verification

**seller-auth.spec.ts** (5 tests)
- ✅ Register seller with organization details
- ✅ Login as seller
- ✅ Seller-specific fields validation
- ✅ Organization profile required
- ✅ Seller dashboard access

**session-management.spec.ts** (4 tests)
- ✅ Token refresh on expiry
- ✅ Logout clears session
- ✅ Concurrent sessions handling
- ✅ Session persistence across page reload

### 2.2 Event Management (2 files, ~10 tests)

**event-crud.spec.ts** (6 tests)
- ✅ Create event with all required fields
- ✅ Edit event details
- ✅ Delete draft event
- ✅ Publish event
- ✅ Unpublish event
- ✅ Event validation errors

**event-search.spec.ts** (4 tests)
- ✅ Search events by title
- ✅ Filter by category
- ✅ Filter by date range
- ✅ Category page navigation

### 2.3 Checkout & Payment (2 files, ~8 tests)

**reservation-flow.spec.ts** (5 tests)
- ✅ Complete reservation flow with countdown
- ✅ Countdown timer warning
- ✅ Reservation expiry
- ✅ Multiple reservations prevention
- ✅ Stock update after reservation

**order-management.spec.ts** (3 tests)
- ✅ View order history
- ✅ View order details
- ✅ Order status display

### 2.4 Check-in System (1 file, ~5 tests)

**qr-scan.spec.ts** (5 tests)
- ✅ Valid QR code check-in
- ✅ Invalid QR code rejection
- ✅ Duplicate scan prevention
- ✅ Check-in status update
- ✅ Check-in statistics

## Running Tests

### Run All Tier 2 Tests
```bash
pnpm exec playwright test --project=tier2
```

### Run Specific Feature Area
```bash
# Authentication tests
pnpm exec playwright test tests/e2e/auth/ --project=tier2

# Event management tests
pnpm exec playwright test tests/e2e/events/ --project=tier2

# Checkout tests
pnpm exec playwright test tests/e2e/checkout/ --project=tier2

# Check-in tests
pnpm exec playwright test tests/e2e/checkin/ --project=tier2
```

### Run Specific Test File
```bash
pnpm exec playwright test tests/e2e/auth/buyer-auth.spec.ts --project=tier2
```

### Run with UI Mode
```bash
pnpm exec playwright test --project=tier2 --ui
```

### Run Specific Test
```bash
pnpm exec playwright test --project=tier2 -g "should register with valid data"
```

## Test Data Management

All tests use helpers from `tests/e2e/helpers.ts`:
- `createBuyerViaApi()` - Create test buyer
- `createSellerViaApi()` - Create test seller
- `createPublishedEventFixture()` - Create event with tiers
- `loginBuyerUi()` - Login via UI
- `loginSellerUi()` - Login seller via UI
- `uniqueEmail()` - Generate unique test emails

## Expected Behaviors

### Authentication
- Registration creates user and sends verification email
- Login sets session cookies
- Forgot password sends reset email
- Token refresh happens automatically
- Logout clears all session data

### Event Management
- Draft events not visible to buyers
- Published events appear in search
- Event slug is unique and URL-safe
- Tier prices must be positive
- Event dates must be in future

### Checkout
- Reservation locks stock for 15 minutes
- Countdown timer shows remaining time
- Multiple concurrent reservations prevented
- Stock updates in real-time
- Expired reservations release stock

### Check-in
- Each ticket can only be checked in once
- Invalid QR codes rejected immediately
- Check-in updates ticket status
- Statistics update in real-time
- Seller can view check-in history

## Troubleshooting

### Tests Failing?

1. **Check if mock API is running**
   ```bash
   curl http://localhost:8787/health
   ```

2. **Check if portals are running**
   ```bash
   curl http://localhost:4301
   curl http://localhost:4303
   ```

3. **Clear test data**
   ```bash
   # Tests use unique emails, but if needed:
   # Restart mock API server
   ```

4. **Check Playwright version**
   ```bash
   pnpm exec playwright --version
   ```

### Common Issues

**Issue**: "Timeout waiting for element"
- **Solution**: Increase timeout or check if element selector is correct

**Issue**: "Port already in use"
- **Solution**: Kill existing processes on ports 8787, 4301, 4302, 4303

**Issue**: "Test data conflicts"
- **Solution**: Tests use `uniqueEmail()` to avoid conflicts

## Test Maintenance

### Adding New Tests

1. Create test file in appropriate directory
2. Import helpers from `../helpers` or `../../helpers`
3. Use `test.describe.configure({ mode: 'serial' })` for dependent tests
4. Use `beforeAll` for shared fixture setup
5. Follow existing naming conventions

### Updating Tests

1. Run affected tests after code changes
2. Update test expectations if behavior changed intentionally
3. Add new test cases for new features
4. Remove obsolete tests

## Next Steps

After Tier 2 completion, consider:
- **Tier 3**: Visual regression, accessibility, Page Object Model
- **Tier 4**: Performance, multi-browser, real-time features

## Summary

**Total Tests**: ~38 tests across 8 files
**Coverage**: Authentication, Events, Checkout, Check-in
**Effort**: 5-7 days implementation
**Status**: ✅ Complete
