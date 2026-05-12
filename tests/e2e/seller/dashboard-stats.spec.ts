import { expect, test } from '@playwright/test';
import { loginSellerUi, createSellerViaApi } from '../helpers';

test.describe('Seller Dashboard Stats', () => {
	test('should display seller dashboard stats', async ({ page, request }) => {
		const seller = await createSellerViaApi(request);
		await loginSellerUi(page, seller.email, seller.password);

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const hasStats =
			(await page.locator('text=/Total Event|Total Revenue|Tiket Terjual/i').count()) > 0;

		expect(hasStats).toBe(true);
	});
});
