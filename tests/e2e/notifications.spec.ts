import { expect, test } from '@playwright/test';
import {
	loginBuyerUi,
	loginSellerUi,
	loginAdminUi,
	createBuyerViaApi,
	createSellerViaApi,
} from './helpers';

const useStaging = process.env.E2E_TARGET === 'staging' || !!process.env.CI;

const BUYER_URL = useStaging
	? 'https://jeevatix-staging-buyer.ariefna95.workers.dev'
	: 'http://localhost:4301';

const SELLER_URL = useStaging
	? 'https://jeevatix-staging-seller.ariefna95.workers.dev'
	: 'http://localhost:4303';

const ADMIN_URL = useStaging
	? 'https://jeevatix-staging-admin.ariefna95.workers.dev'
	: 'http://localhost:4302';

test.describe('Notifications', () => {
	test('should display buyer notifications page', async ({ page, request }) => {
		const buyer = await createBuyerViaApi(request);
		await loginBuyerUi(page, buyer.email, buyer.password);

		await page.goto(`${BUYER_URL}/notifications`);
		await page.waitForLoadState('networkidle');

		const bodyText = await page.locator('body').textContent();
		const hasNotificationContent =
			bodyText?.includes('notifikasi') ||
			bodyText?.includes('Belum ada notifikasi') ||
			bodyText?.includes('update');

		expect(hasNotificationContent).toBe(true);
	});

	test('should display seller notifications page', async ({ page, request }) => {
		const seller = await createSellerViaApi(request);
		await loginSellerUi(page, seller.email, seller.password);

		await page.goto(`${SELLER_URL}/notifications`);
		await page.waitForLoadState('networkidle');

		const bodyText = await page.locator('body').textContent();
		const hasNotificationContent =
			bodyText?.includes('Notifikasi Seller') ||
			bodyText?.includes('notifikasi') ||
			bodyText?.includes('Belum ada notifikasi');

		expect(hasNotificationContent).toBe(true);
	});

	test('should display admin notifications page', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto(`${ADMIN_URL}/notifications`);
		await page.waitForLoadState('networkidle');

		const bodyText = await page.locator('body').textContent();
		const hasNotificationContent =
			bodyText?.includes('Notifikasi Admin') || bodyText?.includes('Broadcast');

		expect(hasNotificationContent).toBe(true);
	});

	test('should show mark all as read or empty state', async ({ page, request }) => {
		const buyer = await createBuyerViaApi(request);
		await loginBuyerUi(page, buyer.email, buyer.password);

		await page.goto(`${BUYER_URL}/notifications`);
		await page.waitForLoadState('networkidle');

		const bodyText = await page.locator('body').textContent();
		const hasMarkAllButton = bodyText?.includes('Mark All as Read');
		const hasEmptyState = bodyText?.includes('Belum ada notifikasi');

		expect(hasMarkAllButton || hasEmptyState).toBe(true);
	});
});
