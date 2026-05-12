import { expect, test } from '@playwright/test';
import { loginBuyerUi, createBuyerViaApi } from '../helpers';

test.describe('Buyer Notifications', () => {
	test('should display buyer notifications page', async ({ page, request }) => {
		const buyer = await createBuyerViaApi(request);
		await loginBuyerUi(page, buyer.email, buyer.password);

		await page.goto('/notifications');
		await page.waitForLoadState('networkidle');

		const bodyText = await page.locator('body').textContent();
		const hasNotificationContent =
			bodyText?.includes('notifikasi') ||
			bodyText?.includes('Belum ada notifikasi') ||
			bodyText?.includes('update');

		expect(hasNotificationContent).toBe(true);
	});

	test('should show mark all as read or empty state', async ({ page, request }) => {
		const buyer = await createBuyerViaApi(request);
		await loginBuyerUi(page, buyer.email, buyer.password);

		await page.goto('/notifications');
		await page.waitForLoadState('networkidle');

		const bodyText = await page.locator('body').textContent();
		const hasMarkAllButton = bodyText?.includes('Mark All as Read');
		const hasEmptyState = bodyText?.includes('Belum ada notifikasi');

		expect(hasMarkAllButton || hasEmptyState).toBe(true);
	});
});
