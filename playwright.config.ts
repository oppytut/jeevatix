import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const useStaging = process.env.E2E_TARGET === 'staging';

const buyerURL = useStaging
  ? 'https://jeevatix-staging-buyer.ariefna95.workers.dev'
  : 'http://localhost:4301';
const adminURL = useStaging
  ? 'https://jeevatix-staging-admin.ariefna95.workers.dev'
  : 'http://localhost:4302';
const sellerURL = useStaging
  ? 'https://jeevatix-staging-seller.ariefna95.workers.dev'
  : 'http://localhost:4303';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60 * 1000,
  reporter: [['html', { open: 'never' }], ['list']],
  globalSetup: './tests/global-setup.ts',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
  },
  projects: [
    {
      name: 'buyer',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: buyerURL,
      },
      testMatch: /buyer-(flow|pages)\.spec\.ts/,
    },
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: adminURL,
      },
      testMatch: /admin-(flow|pages)\.spec\.ts/,
    },
    {
      name: 'seller',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: sellerURL,
      },
      testMatch: /seller-(flow|pages)\.spec\.ts/,
    },
    {
      name: 'critical',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: buyerURL,
      },
      testMatch: /critical-.*\.spec\.ts/,
    },
    {
      name: 'auth',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: buyerURL,
      },
      testMatch: /auth\/buyer-auth\.spec\.ts/,
    },
    {
      name: 'auth-password-reset',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: buyerURL,
      },
      testMatch: /auth\/password-reset-flow\.spec\.ts/,
    },
    {
      name: 'auth-seller',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: sellerURL,
      },
      testMatch: /auth\/seller-auth\.spec\.ts/,
    },
    {
      name: 'auth-admin',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: adminURL,
      },
      testMatch: /auth\/admin-auth\.spec\.ts/,
    },
    {
      name: 'events',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: sellerURL,
      },
      testMatch: /events\/.*\.spec\.ts/,
    },
    {
      name: 'checkout',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: buyerURL,
      },
      testMatch: /checkout\/.*\.spec\.ts/,
    },
    {
      name: 'checkin',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: sellerURL,
      },
      testMatch: /checkin\/.*\.spec\.ts/,
    },
    {
      name: 'staging',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /staging-.*\.spec\.ts/,
    },
    {
      name: 'visual-regression',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: buyerURL,
      },
      testMatch: /visual-regression\.spec\.ts/,
    },
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: buyerURL,
      },
      testMatch: /accessibility\.spec\.ts/,
    },
    {
      name: 'admin-management',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: adminURL,
      },
      testMatch: /admin\/.*\.spec\.ts/,
    },
    {
      name: 'buyer-features',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: buyerURL,
      },
      testMatch: /buyer\/.*\.spec\.ts/,
    },
    {
      name: 'seller-features',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: sellerURL,
      },
      testMatch: /seller\/.*\.spec\.ts/,
    },
  ],
  webServer: useStaging
    ? undefined
    : [
        {
          command: 'PLAYWRIGHT_E2E=1 pnpm --filter @jeevatix/api run dev',
          port: 8787,
          reuseExistingServer: !process.env.CI,
          timeout: 180 * 1000,
        },
        {
          command: 'PLAYWRIGHT_E2E=1 pnpm --filter buyer run dev -- --strictPort',
          port: 4301,
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
        {
          command: 'PLAYWRIGHT_E2E=1 pnpm --filter admin run dev -- --strictPort',
          port: 4302,
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
        {
          command: 'PLAYWRIGHT_E2E=1 pnpm --filter seller run dev -- --strictPort',
          port: 4303,
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
      ],
});
