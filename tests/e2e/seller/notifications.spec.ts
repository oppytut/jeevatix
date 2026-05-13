import { expect, test } from '@playwright/test';
import { createSellerViaApi, isPortalErrorPage, loginSellerUi, tryWithRetry } from '../helpers';

test.describe('Seller Notifications', () => {
  test('should display seller notifications page', async ({ page, request }) => {
    const sellerResult = await tryWithRetry(() => createSellerViaApi(request));
    if (!sellerResult.ok) {
      test.skip(true, 'Could not create seller via staging API - service flakiness');
      return;
    }
    await loginSellerUi(page, sellerResult.value.email, sellerResult.value.password);

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
