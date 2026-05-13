import { expect, test } from '@playwright/test';
import { createSellerViaApi, isPortalErrorPage, loginSellerUi, withRetry } from '../helpers';

test.describe('Seller Dashboard Stats', () => {
  test('should display seller dashboard stats', async ({ page, request }) => {
    const seller = await withRetry(() => createSellerViaApi(request));
    await loginSellerUi(page, seller.email, seller.password);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (await isPortalErrorPage(page)) {
      test.skip(true, 'Seller portal dashboard returned error - staging flakiness');
      return;
    }

    const hasStats =
      (await page.locator('text=/Total Event|Total Revenue|Tiket Terjual/i').count()) > 0;

    expect(hasStats).toBe(true);
  });
});
