import { expect, test } from '@playwright/test';
import { loginAdminUi } from '../helpers';

test.describe('Admin Dashboard Stats', () => {
	test('should display admin dashboard stats', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const hasStats =
			(await page.locator('text=/Total Users|Total Events|Total Revenue/i').count()) > 0;

		expect(hasStats).toBe(true);
	});

	test('should display recent activity on admin dashboard', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const hasActivity =
			(await page.locator('text=/Event Terbaru|Order Terbaru|Transaksi Harian/i').count()) > 0;

		expect(hasActivity).toBe(true);
	});
});
