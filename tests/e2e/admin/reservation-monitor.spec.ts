import { expect, test } from '@playwright/test';
import { loginAdminUi, withRetry } from '../helpers';

test.describe('Admin Reservation Monitor', () => {
	test('should display reservation list page', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto('/reservations');
		await page.waitForLoadState('networkidle');

		await expect(page.locator('text=Reservasi Tiket')).toBeVisible();
	});

	test('should have status filter dropdown', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto('/reservations');
		await page.waitForLoadState('networkidle');

		const searchInput = await page.locator('input[placeholder*="Cari"]').count();
		expect(searchInput).toBeGreaterThan(0);

		const filterDropdown =
			(await page.locator('select').count()) > 0 ||
			(await page.locator('[role="combobox"]').count()) > 0;

		expect(filterDropdown).toBe(true);
	});

	test('should display reservation count', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto('/reservations');
		await page.waitForLoadState('networkidle');

		const hasCount =
			(await page.locator('text=/Menampilkan|reservasi/i').count()) > 0;

		expect(hasCount).toBe(true);
	});
});
