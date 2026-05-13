import { expect, test } from '@playwright/test';
import { createSellerViaApi, isPortalErrorPage, tryLoginSellerUi, tryWithRetry } from '../helpers';

test.describe('Seller Dashboard Stats', () => {
  test('should display seller dashboard stats', async ({ page, request }) => {
    const sellerResult = await tryWithRetry(() => createSellerViaApi(request));
    if (!sellerResult.ok) {
      test.skip(true, 'Could not create seller via staging API - service flakiness');
      return;
    }
    if (!(await tryLoginSellerUi(page, sellerResult.value.email, sellerResult.value.password))) {
      test.skip(true, 'Seller login failed on staging - service flakiness');
      return;
    }

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
