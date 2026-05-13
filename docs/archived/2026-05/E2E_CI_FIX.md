# E2E CI Workflow Fix - Summary

## Problem Analysis

CI workflow E2E test gagal dengan error:
- ❌ Config menggunakan staging URL saat `CI=1` tapi staging belum ready
- ❌ Tidak ada database setup di CI
- ❌ Tidak ada seed data untuk test
- ❌ Test files hardcode URL `localhost:4301/4302/4303`

## Changes Made

### 1. Playwright Config (`playwright.config.ts`)
**Before:**
```typescript
const useStaging = isCI;
```

**After:**
```typescript
const useStaging = process.env.E2E_TARGET === 'staging';
```

**Impact:** CI sekarang run test lokal kecuali explicitly set `E2E_TARGET=staging`

---

### 2. CI Workflow (`.github/workflows/e2e-tests.yml`)

**Added:**
- Docker Compose untuk PostgreSQL
- Database migration (`db:push`)
- Database seeding (`db:seed:e2e`)
- Environment variables untuk API runtime

**Before:**
```yaml
- name: Run E2E tests against staging
  run: |
    export CI=1
    pnpm exec playwright test --project=critical --project=auth --project=events
```

**After:**
```yaml
- name: Setup test database
  run: |
    docker compose up -d
    sleep 5
    
- name: Run database migrations
  run: pnpm --filter @jeevatix/core run db:push
  env:
    DATABASE_URL: postgresql://jeevatix:jeevatix@localhost:5432/jeevatix
    
- name: Seed test data
  run: pnpm --filter @jeevatix/core run db:seed:e2e
  env:
    DATABASE_URL: postgresql://jeevatix:jeevatix@localhost:5432/jeevatix
    
- name: Run E2E tests locally
  run: pnpm exec playwright test --project=critical --project=auth --project=events
  env:
    DATABASE_URL: postgresql://jeevatix:jeevatix@localhost:5432/jeevatix
    JWT_SECRET: test-secret-key-for-ci-only
    PAYMENT_WEBHOOK_SECRET: test-webhook-secret
    EMAIL_API_KEY: test-email-key
    EMAIL_FROM: test@jeevatix.com
    UPLOAD_PUBLIC_URL: http://localhost:8787/uploads
```

---

### 3. Package Scripts (`packages/core/package.json`)

**Added:**
```json
"db:seed:e2e": "tsx src/db/seed-e2e.ts"
```

---

### 4. Global Setup (`tests/global-setup.ts`)

**Before:**
```typescript
const isCI = !!process.env.CI;
const apiBaseURL = isCI 
  ? 'https://jeevatix-staging-api.ariefna95.workers.dev' 
  : 'http://localhost:8787';

try {
  const healthResponse = await page.request.get(`${apiBaseURL}/health`);
  if (!healthResponse.ok()) {
    console.warn('⚠️  API not responding. Tests may fail.');
  }
} catch (error) {
  console.warn('⚠️  Could not connect to API:', error);
}
```

**After:**
```typescript
const useStaging = process.env.E2E_TARGET === 'staging';
const apiBaseURL = useStaging 
  ? 'https://jeevatix-staging-api.ariefna95.workers.dev' 
  : 'http://localhost:8787';

// Retry health check with exponential backoff
const maxRetries = 10;
const initialDelay = 1000;
let lastError: Error | null = null;

for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    console.log(`🔍 Health check attempt ${attempt}/${maxRetries}...`);
    const healthResponse = await page.request.get(`${apiBaseURL}/health`, {
      timeout: 5000
    });
    
    if (healthResponse.ok()) {
      console.log('✅ API health check passed');
      break;
    } else {
      throw new Error(`API returned status ${healthResponse.status()}`);
    }
  } catch (error) {
    lastError = error as Error;
    console.warn(`⚠️  Attempt ${attempt} failed: ${lastError.message}`);
    
    if (attempt < maxRetries) {
      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await page.waitForTimeout(delay);
    }
  }
}
```

**Impact:** API health check sekarang retry dengan exponential backoff (max 10 attempts)

---

### 5. Test Files - Hardcoded URLs Fixed

**Files Changed (11 files):**
- `tests/e2e/auth/buyer-auth.spec.ts`
- `tests/e2e/auth/seller-auth.spec.ts`
- `tests/e2e/auth/admin-auth.spec.ts`
- `tests/e2e/buyer-flow.spec.ts`
- `tests/e2e/seller-flow.spec.ts`
- `tests/e2e/admin-flow.spec.ts`
- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/critical-errors.spec.ts`
- `tests/e2e/edge-cases.spec.ts`
- `tests/e2e/visual-regression.spec.ts`
- `tests/e2e/checkout/reservation-flow.spec.ts`

**Before:**
```typescript
await page.goto('http://localhost:4301/register');
await expect(page).toHaveURL(/localhost:4301\/$/);
```

**After:**
```typescript
await page.goto('/register');
await expect(page).toHaveURL(/\/$/);
```

**Impact:** Test sekarang menggunakan `baseURL` dari Playwright config, mendukung local dan staging

---

## Test Accounts (from seed-e2e.ts)

```
Admin:  admin@jeevatix.id  / Admin123!
Buyer:  buyer@jeevatix.id  / TestPassword123!
Seller: seller@jeevatix.id / Seller123!
```

---

## How to Run

### Local Development
```bash
# 1. Start database
docker compose up -d

# 2. Push schema
pnpm --filter @jeevatix/core run db:push

# 3. Seed test data
pnpm --filter @jeevatix/core run db:seed:e2e

# 4. Run tests
pnpm exec playwright test
```

### CI (Automatic)
```bash
# Push to main/develop or create PR
git push origin main
```

### Test Against Staging (Optional)
```bash
E2E_TARGET=staging pnpm exec playwright test
```

---

## Verification Checklist

- [x] Playwright config uses `E2E_TARGET` instead of `CI`
- [x] CI workflow sets up PostgreSQL
- [x] CI workflow runs migrations
- [x] CI workflow seeds test data
- [x] CI workflow provides all required env vars
- [x] Global setup has retry logic with exponential backoff
- [x] All test files use relative URLs (no hardcoded localhost)
- [x] Package.json has `db:seed:e2e` script
- [x] TypeScript compilation passes

---

## Next Steps

1. **Push changes and monitor CI**
   ```bash
   git add .
   git commit -m "fix(ci): fix E2E test workflow with local database setup"
   git push
   ```

2. **Monitor GitHub Actions**
   - Check if PostgreSQL starts successfully
   - Check if migrations run without errors
   - Check if seed data is created
   - Check if tests pass

3. **If CI still fails:**
   - Check GitHub Actions logs for specific errors
   - Verify all environment variables are set
   - Check if ports are available (8787, 4301, 4302, 4303)
   - Verify Playwright browsers are installed

---

## Rollback Plan

If changes cause issues:

```bash
git revert HEAD
git push
```

Or restore specific files:
```bash
git checkout HEAD~1 -- playwright.config.ts
git checkout HEAD~1 -- .github/workflows/e2e-tests.yml
git checkout HEAD~1 -- tests/global-setup.ts
```
