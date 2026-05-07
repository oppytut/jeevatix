import { test as base, Page } from '@playwright/test';

type AuthenticatedUser = {
	email: string;
	password: string;
	token?: string;
};

type TestFixtures = {
	authenticatedBuyerPage: Page;
	authenticatedSellerPage: Page;
	authenticatedAdminPage: Page;
};

export const test = base.extend<TestFixtures>({
	authenticatedBuyerPage: async ({ browser }, use) => {
		const context = await browser.newContext();
		const page = await context.newPage();

		await page.goto('http://localhost:4301/login');
		await page.fill('input[type="email"]', 'test-buyer@example.com');
		await page.fill('input[type="password"]', 'TestPassword123!');
		await page.click('button[type="submit"]');

		await page.waitForURL('**/');

		await use(page);

		await context.close();
	},

	authenticatedSellerPage: async ({ browser }, use) => {
		const context = await browser.newContext();
		const page = await context.newPage();

		await page.goto('http://localhost:4303/login');
		await page.fill('input[type="email"]', 'test-seller@example.com');
		await page.fill('input[type="password"]', 'TestPassword123!');
		await page.click('button[type="submit"]');

		await page.waitForURL('**/');

		await use(page);

		await context.close();
	},

	authenticatedAdminPage: async ({ browser }, use) => {
		const context = await browser.newContext();
		const page = await context.newPage();

		await page.goto('http://localhost:4302/login');
		await page.fill('input[type="email"]', 'admin@example.com');
		await page.fill('input[type="password"]', 'AdminPassword123!');
		await page.click('button[type="submit"]');

		await page.waitForURL('**/');

		await use(page);

		await context.close();
	},
});

export { expect } from '@playwright/test';
