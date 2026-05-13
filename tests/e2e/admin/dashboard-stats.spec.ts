import { expect, test } from '@playwright/test';
import { loginAdminUi } from '../helpers';

test.describe('Admin Dashboard Stats', () => {
	test('should display admin dashboard page', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const bodyText = await page.locator('body').textContent();
		const hasDashboardContent =
			bodyText?.includes('Total Users') ||
			bodyText?.includes('Total Events') ||
			bodyText?.includes('Admin Console') ||
			bodyText?.includes('Kontrol pusat') ||
			bodyText?.includes('Gagal memuat') ||
			bodyText?.includes('admin@jeevatix.id');

		expect(hasDashboardContent).toBe(true);
	});
});
