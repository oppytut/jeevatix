import { expect, test } from '@playwright/test';
import { loginSellerUi, createSellerViaApi } from '../helpers';

test.describe('Seller Notifications', () => {
	test('should display seller notifications page', async ({ page, request }) => {
		const seller = await createSellerViaApi(request);
		await loginSellerUi(page, seller.email, seller.password);

		await page.goto('/notifications');
		await page.waitForLoadState('networkidle');

		const bodyText = await page.locator('body').textContent();
		const hasNotificationContent =
			bodyText?.includes('Notifikasi Seller') ||
			bodyText?.includes('notifikasi') ||
			bodyText?.includes('Belum ada notifikasi');

		expect(hasNotificationContent).toBe(true);
	});
});
