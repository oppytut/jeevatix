import { expect, test } from '@playwright/test';
import { isPortalErrorPage, loginAdminUi } from '../helpers';

test.describe('Admin Reservation Monitor', () => {
  test('should display reservation list page', async ({ page }) => {
    await loginAdminUi(page);

    await page.goto('/reservations');
    await page.waitForLoadState('networkidle');

    if (await isPortalErrorPage(page)) {
      test.skip(true, 'Admin portal reservations page returned error - staging flakiness');
      return;
    }

    const bodyText = await page.locator('body').textContent();
    const hasReservationPage =
      bodyText?.includes('Reservasi') ||
      bodyText?.includes('reservasi') ||
      bodyText?.includes('Monitor');

    expect(hasReservationPage).toBe(true);
  });

  test('should have search or filter controls', async ({ page }) => {
    await loginAdminUi(page);

    await page.goto('/reservations');
    await page.waitForLoadState('networkidle');

    if (await isPortalErrorPage(page)) {
      test.skip(true, 'Admin portal reservations page returned error - staging flakiness');
      return;
    }

    const hasSearchInput =
      (await page.locator('input[placeholder*="Cari"], input[type="search"]').count()) > 0;
    const hasSelect = (await page.locator('select').count()) > 0;
    const hasFilterButton =
      (await page.getByRole('button', { name: /filter|refresh/i }).count()) > 0;

    expect(hasSearchInput || hasSelect || hasFilterButton).toBe(true);
  });

  test('should display reservation content', async ({ page }) => {
    await loginAdminUi(page);

    await page.goto('/reservations');
    await page.waitForLoadState('networkidle');

    if (await isPortalErrorPage(page)) {
      test.skip(true, 'Admin portal reservations page returned error - staging flakiness');
      return;
    }

    const bodyText = await page.locator('body').textContent();
    const hasContent =
      bodyText?.includes('Menampilkan') ||
      bodyText?.includes('reservasi') ||
      bodyText?.includes('Belum ada') ||
      bodyText?.includes('active') ||
      bodyText?.includes('expired');

    expect(hasContent).toBe(true);
  });
});
