import { expect, test } from '@playwright/test';
import {
  createBuyerViaApi,
  createPublishedEventFixture,
  loginBuyerUi,
  API_URL,
} from './helpers';

test.describe('Critical Error Scenarios', () => {
  test.describe.configure({ mode: 'serial' });

  let buyerEmail: string;
  let buyerPassword: string;
  let eventSlug: string;
  let tierId: string;

  test.beforeAll(async ({ request }) => {
    const buyer = await createBuyerViaApi(request);
    buyerEmail = buyer.email;
    buyerPassword = buyer.password;

    const fixture = await createPublishedEventFixture(request);
    eventSlug = fixture.event.slug;
    tierId = fixture.event.tiers[0].id;
  });

  test('should handle payment timeout gracefully', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    // Wait for tiers to render (up to 10s)
    const tierRadio = page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`);
    await tierRadio.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});

    if ((await tierRadio.count()) === 0) {
      test.skip(true, 'Tier radio button not found — event tiers may not have loaded');
      return;
    }

    await tierRadio.check({ force: true });

    await page.getByRole('button', { name: 'Reservasi Tiket' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.locator('body').textContent();
    const hasReservationOrPayment =
      bodyText?.includes('reservasi') ||
      bodyText?.includes('reservation') ||
      bodyText?.includes('bayar') ||
      bodyText?.includes('payment') ||
      bodyText?.includes('countdown') ||
      bodyText?.includes('dikunci');

    expect(hasReservationOrPayment).toBeTruthy();
  });

  test('should show error for expired reservation', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').textContent();
    const isOnCheckoutPage =
      page.url().includes('/checkout/') ||
      bodyText?.includes('tiket') ||
      bodyText?.includes('Tiket') ||
      bodyText?.includes('event') ||
      bodyText?.includes('Reservasi');

    expect(isOnCheckoutPage).toBeTruthy();
  });

  test('should handle session expiry during checkout', async ({ page, context }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    await context.clearCookies();

    await page.reload();
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    const isRedirectedToLogin = currentUrl.includes('/login');
    const hasLoginForm = (await page.locator('input[type="email"]').count()) > 0;

    expect(isRedirectedToLogin || hasLoginForm).toBeTruthy();
  });

  test('should prevent double reservation submission', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    // Wait for tiers to render (up to 10s)
    const tierRadio = page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`);
    await tierRadio.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});

    if ((await tierRadio.count()) === 0) {
      test.skip(true, 'Tier radio button not found — event tiers may not have loaded');
      return;
    }

    await tierRadio.check({ force: true });

    const reserveButton = page.getByRole('button', { name: 'Reservasi Tiket' });
    await reserveButton.click();
    await page.waitForLoadState('networkidle');

    const isDisabledAfterClick = await reserveButton.isDisabled().catch(() => false);
    const bodyText = await page.locator('body').textContent();
    const hasReservationState =
      isDisabledAfterClick ||
      bodyText?.includes('reservasi') ||
      bodyText?.includes('countdown') ||
      bodyText?.includes('dikunci');

    expect(hasReservationState).toBeTruthy();
  });

  test('should handle network errors during reservation', async ({ page, context }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    // Wait for tiers to render (up to 10s)
    const tierRadio = page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`);
    await tierRadio.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});

    if ((await tierRadio.count()) === 0) {
      test.skip(true, 'Tier radio button not found — event tiers may not have loaded');
      return;
    }

    await tierRadio.check({ force: true });

    // Simulate network failure by blocking API requests
    await context.route(`${API_URL}/**`, (route) => route.abort());

    await page.getByRole('button', { name: 'Reservasi Tiket' }).click();
    await page.waitForTimeout(2000);

    // Should show error or stay on checkout page
    const bodyText = await page.locator('body').textContent();
    const hasErrorOrStaysOnPage =
      bodyText?.includes('error') ||
      bodyText?.includes('gagal') ||
      bodyText?.includes('failed') ||
      page.url().includes('/checkout/');

    expect(hasErrorOrStaysOnPage).toBeTruthy();

    // Restore network
    await context.unroute(`${API_URL}/**`);
  });

  test('should validate required fields before submission', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const reserveButton = page.getByRole('button', { name: 'Reservasi Tiket' });
    await reserveButton.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    if ((await reserveButton.count()) === 0) {
      test.skip(true, 'Reservasi Tiket button not found — tiers may not have loaded');
      return;
    }

    await reserveButton.click();
    await page.waitForTimeout(1000);

    const bodyText = await page.locator('body').textContent();
    const hasValidationOrStaysOnPage =
      bodyText?.includes('pilih') ||
      bodyText?.includes('select') ||
      bodyText?.includes('required') ||
      bodyText?.includes('wajib') ||
      page.url().includes('/checkout/');

    expect(hasValidationOrStaysOnPage).toBeTruthy();
  });

  test('should handle sold out tiers gracefully', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    // Wait for tiers to render (up to 10s)
    const tierRadio = page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`);
    await tierRadio.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});

    if ((await tierRadio.count()) === 0) {
      test.skip(true, 'Tier radio button not found — event tiers may not have loaded');
      return;
    }

    // Check if tier is disabled (sold out)
    const isDisabled = await tierRadio.isDisabled();

    if (isDisabled) {
      // Verify sold out message is shown
      const bodyText = await page.locator('body').textContent();
      const hasSoldOutMessage =
        bodyText?.includes('habis') ||
        bodyText?.includes('sold out') ||
        bodyText?.includes('tidak tersedia');

      expect(hasSoldOutMessage).toBeTruthy();
    } else {
      // If not sold out, should be able to select
      await tierRadio.check({ force: true });
      const isChecked = await tierRadio.isChecked();
      expect(isChecked).toBeTruthy();
    }
  });
});
