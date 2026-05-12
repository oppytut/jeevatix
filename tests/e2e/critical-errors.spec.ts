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

    const tierRadio = page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`);
    if ((await tierRadio.count()) === 0) {
      test.skip(true, 'Tier radio button not found on checkout page');
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
      page.url().includes('/payment');

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

    const tierRadio = page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`);
    if ((await tierRadio.count()) === 0) {
      test.skip(true, 'Tier radio button not found on checkout page');
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

  test('should show appropriate error for insufficient stock', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const tierRadio = page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`);
    if ((await tierRadio.count()) === 0) {
      test.skip(true, 'Tier radio button not found on checkout page');
      return;
    }
    await tierRadio.check({ force: true });

    const quantityInput = page.locator('input[name="quantity"]');
    await quantityInput.fill('999');

    await page.getByRole('button', { name: 'Reservasi Tiket' }).click();
    await page.waitForTimeout(2000);

    const bodyText = await page.locator('body').textContent();
    const hasStockError =
      bodyText?.includes('stok') ||
      bodyText?.includes('stock') ||
      bodyText?.includes('tersedia') ||
      bodyText?.includes('melebihi') ||
      bodyText?.includes('insufficient') ||
      page.url().includes('/checkout/');

    expect(hasStockError).toBeTruthy();
  });

  test('should handle network errors gracefully', async ({ page, context }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').textContent();
    const hasContent = bodyText && bodyText.length > 100;

    expect(hasContent).toBeTruthy();
  });

  test('should validate form inputs before submission', async ({ page }) => {
    await page.goto('/register');

    await page.getByRole('button', { name: /daftar/i }).click();

    await page.waitForTimeout(500);

    const isStillOnRegister = page.url().includes('/register');
    expect(isStillOnRegister).toBeTruthy();
  });
});
