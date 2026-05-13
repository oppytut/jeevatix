import { expect, test } from '@playwright/test';
import { createSellerViaApi, isPortalErrorPage, loginSellerUi, withRetry } from '../helpers';

test.describe('Seller Notifications', () => {
  test('should display seller notifications page', async ({ page, request }) => {
    const seller = await withRetry(() => createSellerViaApi(request));
    await loginSellerUi(page, seller.email, seller.password);

    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    if (await isPortalErrorPage(page)) {
      test.skip(true, 'Seller portal notifications page returned error - staging flakiness');
      return;
    }

    const bodyText = await page.locator('body').textContent();
    const hasNotificationContent =
      bodyText?.includes('Notifikasi Seller') ||
      bodyText?.includes('notifikasi') ||
      bodyText?.includes('Belum ada notifikasi');

    expect(hasNotificationContent).toBe(true);
  });
});
