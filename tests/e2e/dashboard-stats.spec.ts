import { expect, test } from '@playwright/test';
import { loginSellerUi, loginAdminUi, createSellerViaApi } from './helpers';

const useStaging = process.env.E2E_TARGET === 'staging' || !!process.env.CI;

const SELLER_URL = useStaging
	? 'https://jeevatix-staging-seller.ariefna95.workers.dev'
	: 'http://localhost:4303';

const ADMIN_URL = useStaging
	? 'https://jeevatix-staging-admin.ariefna95.workers.dev'
	: 'http://localhost:4302';

test.describe('Dashboard Stats', () => {
	test('should display seller dashboard stats', async ({ page, request }) => {
		const seller = await createSellerViaApi(request);
		await loginSellerUi(page, seller.email, seller.password);

		await page.goto(`${SELLER_URL}/`);
		await page.waitForLoadState('networkidle');

		const hasStats =
			(await page.locator('text=/Total Event|Total Revenue|Tiket Terjual/i').count()) > 0;

		expect(hasStats).toBe(true);
	});

	test('should display admin dashboard stats', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto(`${ADMIN_URL}/`);
		await page.waitForLoadState('networkidle');

		const hasStats =
			(await page.locator('text=/Total Users|Total Events|Total Revenue/i').count()) > 0;

		expect(hasStats).toBe(true);
	});

	test('should display recent activity on admin dashboard', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto(`${ADMIN_URL}/`);
		await page.waitForLoadState('networkidle');

		const hasActivity =
			(await page.locator('text=/Event Terbaru|Order Terbaru|Transaksi Harian/i').count()) > 0;

		expect(hasActivity).toBe(true);
	});
});
