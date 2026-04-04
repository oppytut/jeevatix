import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: [['html', { open: 'never' }]],
	use: {
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'buyer',
			use: {
				...devices['Desktop Chrome'],
				baseURL: 'http://localhost:4301'
			},
			testMatch: /buyer-flow\.spec\.ts/
		},
		{
			name: 'admin',
			use: {
				...devices['Desktop Chrome'],
				baseURL: 'http://localhost:4302'
			},
			testMatch: /admin-flow\.spec\.ts/
		},
		{
			name: 'seller',
			use: {
				...devices['Desktop Chrome'],
				baseURL: 'http://localhost:4303'
			},
			testMatch: /seller-flow\.spec\.ts/
		}
	],
	webServer: [
		{
			command: 'node tests/e2e/mock-api-server.mjs',
			port: 8787,
			reuseExistingServer: !process.env.CI,
			timeout: 120 * 1000
		},
		{
			command: 'PLAYWRIGHT_E2E=1 pnpm --filter buyer run dev -- --strictPort',
			port: 4301,
			reuseExistingServer: !process.env.CI,
			timeout: 120 * 1000
		},
		{
			command: 'PLAYWRIGHT_E2E=1 pnpm --filter admin run dev -- --strictPort',
			port: 4302,
			reuseExistingServer: !process.env.CI,
			timeout: 120 * 1000
		},
		{
			command: 'PLAYWRIGHT_E2E=1 pnpm --filter seller run dev -- --strictPort',
			port: 4303,
			reuseExistingServer: !process.env.CI,
			timeout: 120 * 1000
		}
	]
});