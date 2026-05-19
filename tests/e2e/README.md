# E2E Tests - Setup & Usage Guide

## Overview

E2E tests untuk Jeevatix menggunakan Playwright dan real database (PostgreSQL) untuk testing yang lebih reliable dibanding mock API.

---

## Quick Start

### Local Development (real DB, one-shot)

Mode `local` menjalankan API via Node runner (`scripts/run-api-local.ts` — punya
in-process Durable Object emulation), tiga portal SvelteKit dengan adapter
di-bypass (`PLAYWRIGHT_E2E=1`), dan PostgreSQL via Docker Compose.

```bash
# 1. Salin env override (sekali saja)
cp .env.e2e.local.example .env.e2e.local

# 2. Bootstrap stack: docker postgres + healthcheck + db push + seed
pnpm run e2e:local:setup

# 3. Jalankan suite Playwright lokal (start API + 3 portal otomatis)
pnpm run test:e2e:local
```

Reset DB lokal saat data jadi kotor:

```bash
pnpm run db:reset:e2e
```

### Manual / iteratif

```bash
# Push schema saja
pnpm --filter @jeevatix/core run db:push

# Seed ulang
pnpm run seed:e2e

# Jalankan project tertentu
pnpm exec playwright test --project=auth
pnpm exec playwright test --project=events
pnpm exec playwright test --project=critical
```

### Mode lain

| Mode | Command | Catatan |
|---|---|---|
| `local` (default) | `pnpm run test:e2e:local` | Real DB lokal, butuh `pnpm run e2e:local:setup` dulu |
| `staging` | `E2E_TARGET=staging pnpm run test:e2e` | Hit Cloudflare staging Workers |
| Default `test:e2e` | `pnpm run test:e2e` | Mengikuti `E2E_TARGET`; jatuh ke `local` di mesin dev, `staging` di CI |

URL portal/API bisa di-override per-mode lewat env: `E2E_API_URL`,
`E2E_BUYER_URL`, `E2E_ADMIN_URL`, `E2E_SELLER_URL`.

### Run with UI Mode

```bash
pnpm exec playwright test --ui
```

### Run Specific Test File

```bash
pnpm exec playwright test tests/e2e/auth/buyer-auth.spec.ts
```

---

## Test Data

Script `seed-e2e.ts` membuat test data minimal:

### Users Created:
- **Admin**: `admin@jeevatix.id` / `Admin123!`
- **Buyer**: `buyer-e2e@jeevatix.id` / `Buyer123!`
- **Seller**: `seller-e2e@jeevatix.id` / `Seller123!`
  - Organization: "E2E Test Org"

### Events Created:
- **E2E Test Event** (published)
  - 3 tiers: Early Bird (Rp 150k), Regular (Rp 250k), VIP (Rp 500k)
  - Categories: Musik, Konser

### Categories:
- Musik, Olahraga, Workshop, Konser, Festival

---

## Test Structure

```
tests/e2e/
├── auth/                    # Authentication tests
│   ├── buyer-auth.spec.ts
│   ├── seller-auth.spec.ts
│   └── admin-auth.spec.ts
├── events/                  # Event management tests
│   ├── event-crud.spec.ts
│   └── event-tiers.spec.ts
├── checkout/                # Checkout & payment tests
│   ├── reservation-flow.spec.ts
│   └── payment-methods.spec.ts
├── checkin/                 # Check-in system tests
│   └── qr-scan.spec.ts
├── pages/                   # Page Object Model
│   ├── buyer/
│   ├── seller/
│   ├── admin/
│   └── common/
├── visual-regression.spec.ts    # Percy visual tests
├── accessibility.spec.ts        # axe-core a11y tests
├── helpers.ts                   # Test utilities
├── mock-api-server.mjs         # Mock API (deprecated)
├── README.md                    # This file
└── E2E_COVERAGE_GAP_PLAN.md    # Coverage gap analysis & implementation status
```

### Test Documentation

- **[E2E_COVERAGE_GAP_PLAN.md](./E2E_COVERAGE_GAP_PLAN.md)** — Coverage gap analysis, Tier 1-3 implementation status, test inventory
- Archived: TIER1/2/3 planning docs moved to `docs/archived/2026-05/`

---

## CI/CD

### GitHub Actions Workflow

E2E tests run automatically on:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

**Workflow steps:**
1. Setup PostgreSQL service
2. Install dependencies
3. Install Playwright browsers
4. Push database schema
5. **Seed E2E test data** ← New step
6. Run E2E tests
7. Upload test reports

### Current Status

⚠️ **E2E tests in CI currently failing** - Tests require full application stack (API + frontend servers) running, not just database.

**Recommended Solutions:**

**Option A**: Run E2E tests against staging environment
```yaml
- name: Run E2E tests against staging
  run: pnpm exec playwright test --project=staging
  env:
    BASE_URL: https://jeevatix-staging-buyer.ariefna95.workers.dev
```

**Option B**: Start all servers in CI (slower, more complex)
```yaml
- name: Start API server
  run: pnpm --filter @jeevatix/api run dev &
  
- name: Start frontend servers
  run: |
    pnpm --filter buyer run dev &
    pnpm --filter admin run dev &
    pnpm --filter seller run dev &
```

**Option C**: Use Docker Compose for full stack
```yaml
- name: Start full stack
  run: docker-compose up -d
```

---

## Tier 3 Tests

### Visual Regression (Percy)

```bash
# Setup Percy token
export PERCY_TOKEN=your_token_here

# Run visual tests
npx percy exec -- playwright test visual-regression.spec.ts
```

**Percy captures:**
- Homepage (desktop, mobile, tablet)
- Event listing & detail pages
- Login/register forms
- Checkout flow
- Form validation states

### Accessibility (axe-core)

```bash
# Run accessibility tests
pnpm exec playwright test accessibility.spec.ts

# Run specific WCAG level
pnpm exec playwright test accessibility.spec.ts --grep "Level AA"
```

**Coverage:**
- WCAG 2.1 Level A & AA compliance
- Keyboard navigation
- Screen reader compatibility
- Color contrast
- Form labels & ARIA attributes

---

## Performance Optimization

### Parallel Execution

Tests run in parallel by default:
- 2 workers in CI
- Unlimited workers locally

### Authenticated Sessions

Use fixtures untuk reuse authenticated sessions:

```typescript
import { test } from '../../fixtures';

test('my test', async ({ authenticatedBuyerPage }) => {
  // Already logged in as buyer
  await authenticatedBuyerPage.goto('/profile');
});
```

### Global Setup

`tests/global-setup.ts` runs once before all tests:
- API health check
- Environment validation

---

## Debugging

### Run in Headed Mode

```bash
pnpm exec playwright test --headed
```

### Debug Mode

```bash
pnpm exec playwright test --debug
```

### View Test Report

```bash
pnpm exec playwright show-report
```

### Trace Viewer

```bash
# Traces are captured on first retry
pnpm exec playwright show-trace test-results/path-to-trace.zip
```

---

## Best Practices

### 1. Use Page Object Model

```typescript
import { HomePage } from '../pages/buyer';

test('example', async ({ page }) => {
  const homePage = new HomePage(page);
  await homePage.goto();
  await homePage.searchEvents('music');
});
```

### 2. Use Test Helpers

```typescript
import { loginBuyerUi, createEventViaApi } from '../helpers';

test('example', async ({ page, request }) => {
  await loginBuyerUi(page, 'buyer@example.com', 'password');
  await createEventViaApi(request, { title: 'Test Event' });
});
```

### 3. Clean Test Data

```typescript
test.afterEach(async ({ request }) => {
  // Cleanup test data
  await request.delete('/api/test-data');
});
```

### 4. Use Unique Identifiers

```typescript
const uniqueEmail = `test-${Date.now()}@example.com`;
```

---

## Troubleshooting

### Tests Timeout

Increase timeout in `playwright.config.ts`:
```typescript
timeout: 60 * 1000, // 60 seconds
```

### Database Connection Issues

Check `DATABASE_URL` environment variable:
```bash
echo $DATABASE_URL
```

### Playwright Browsers Not Installed

```bash
pnpm exec playwright install --with-deps chromium
```

### Port Already in Use

Kill processes using test ports:
```bash
lsof -ti:4301,4302,4303,8787 | xargs kill -9
```

---

## Migration from Mock API

**Old approach** (deprecated):
- In-memory mock API server
- Mock state management
- Unreliable in CI

**New approach** (current):
- Real PostgreSQL database
- Seed script for test data
- Actual API endpoints
- More reliable, easier to debug

**Migration steps:**
1. ✅ Created `seed-e2e.ts`
2. ✅ Added `seed:e2e` script
3. ✅ Updated E2E workflow
4. ⏳ Fix CI environment (need full stack)

---

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Percy Visual Testing](https://percy.io/)
- [axe-core Accessibility](https://github.com/dequelabs/axe-core)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## Support

For issues or questions:
1. Check this README
2. Review test examples in `tests/e2e/`
3. Check Playwright documentation
4. Ask in team chat
