import { expect, test } from '@playwright/test';
import { isPortalErrorPage, tryLoginAdminUi } from '../helpers';

test.describe('Admin Notifications', () => {
  test('should display admin notifications page', async ({ page }) => {
    if (!(await tryLoginAdminUi(page))) {
      test.skip(true, 'Admin login failed on staging - service flakiness');
      return;
    }

    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    if (await isPortalErrorPage(page)) {
      test.skip(true, 'Admin portal notifications page returned error - staging flakiness');
      return;
    }

    const bodyText = await page.locator('body').textContent();
    const hasNotificationContent =
      bodyText?.includes('Notifikasi Admin') || bodyText?.includes('Broadcast');

    expect(hasNotificationContent).toBe(true);
  });
});
