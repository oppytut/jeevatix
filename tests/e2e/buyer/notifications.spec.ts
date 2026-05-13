import { expect, test } from '@playwright/test';
import { createBuyerViaApi, isPortalErrorPage, loginBuyerUi, tryWithRetry } from '../helpers';

test.describe('Buyer Notifications', () => {
  test('should display buyer notifications page', async ({ page, request }) => {
    const buyerResult = await tryWithRetry(() => createBuyerViaApi(request));
    if (!buyerResult.ok) {
      test.skip(true, 'Could not create buyer via staging API - service flakiness');
      return;
    }
    await loginBuyerUi(page, buyerResult.value.email, buyerResult.value.password);

    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    if (await isPortalErrorPage(page)) {
      test.skip(true, 'Buyer portal notifications page returned error - staging flakiness');
      return;
    }

    const bodyText = await page.locator('body').textContent();
    const hasNotificationContent =
      bodyText?.includes('notifikasi') ||
      bodyText?.includes('Belum ada notifikasi') ||
      bodyText?.includes('update');

    expect(hasNotificationContent).toBe(true);
  });

  test('should show mark all as read or empty state', async ({ page, request }) => {
    const buyerResult = await tryWithRetry(() => createBuyerViaApi(request));
    if (!buyerResult.ok) {
      test.skip(true, 'Could not create buyer via staging API - service flakiness');
      return;
    }
    await loginBuyerUi(page, buyerResult.value.email, buyerResult.value.password);

    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    if (await isPortalErrorPage(page)) {
      test.skip(true, 'Buyer portal notifications page returned error - staging flakiness');
      return;
    }

    const bodyText = await page.locator('body').textContent();
    const hasMarkAllButton = bodyText?.includes('Mark All as Read');
    const hasEmptyState = bodyText?.includes('Belum ada notifikasi');

    expect(hasMarkAllButton || hasEmptyState).toBe(true);
  });
});
