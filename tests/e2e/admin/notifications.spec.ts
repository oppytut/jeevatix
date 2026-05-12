import { expect, test } from '@playwright/test';
import { loginAdminUi } from '../helpers';

test.describe('Admin Notifications', () => {
	test('should display admin notifications page', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto('/notifications');
		await page.waitForLoadState('networkidle');

		const bodyText = await page.locator('body').textContent();
		const hasNotificationContent =
			bodyText?.includes('Notifikasi Admin') || bodyText?.includes('Broadcast');

		expect(hasNotificationContent).toBe(true);
	});
});
