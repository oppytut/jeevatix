import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
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
			}
		},
		{
			name: 'admin',
			use: {
				...devices['Desktop Chrome'],
				baseURL: 'http://localhost:4302'
			}
		},
		{
			name: 'seller',
			use: {
				...devices['Desktop Chrome'],
				baseURL: 'http://localhost:4303'
			}
		}
	],
	webServer: {
		command: 'pnpm run dev',
		url: 'http://localhost:4301',
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000
	}
});