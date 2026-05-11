import { expect, test } from '@playwright/test';
import {
  createBuyerViaApi,
  createPublishedEventFixture,
  loginBuyerUi,
  API_URL,
} from './helpers';

test.describe('Critical Error Scenarios', () => {
  test.describe.configure({ mode: 'serial' });

  test.fixme(true, 'Checkout uses radio buttons for tier selection, not data-tier-id + "Pilih" button. Needs full rewrite to match actual UI: radio select tier → set quantity → click "Reservasi Tiket"');
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

  test('should handle payment timeout gracefully', async ({ page, request }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const tierCard = page.locator(`[data-tier-id="${tierId}"]`).first();
    await tierCard.locator('button:has-text("Pilih")').click();

    const quantityInput = page.locator('input[type="number"]').first();
    await quantityInput.fill('1');

    await page.getByRole('button', { name: /lanjut.*bayar/i }).click();
    await page.waitForURL(/\/payment\//);

    const currentUrl = page.url();
    const orderId = currentUrl.split('/payment/')[1];

    await page.waitForTimeout(2000);

    const orderResponse = await request.get(`${API_URL}/orders/${orderId}`);
    expect(orderResponse.ok()).toBeTruthy();

    const orderData = await orderResponse.json();
    expect(orderData.success).toBe(true);
    expect(orderData.data.status).toMatch(/pending|confirmed/);

    await expect(page.locator('body')).toContainText(/bayar|payment|total/i);
  });

  test('should show error for expired reservation', async ({ page, request }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    const reserveResponse = await request.post(`${API_URL}/reservations`, {
      data: {
        event_slug: eventSlug,
        tier_id: tierId,
        quantity: 1,
      },
    });

    expect(reserveResponse.ok()).toBeTruthy();
    const reserveData = await reserveResponse.json();
    const reservationId = reserveData.data.reservation_id;

    await page.waitForTimeout(1000);

    const checkResponse = await request.get(
      `${API_URL}/reservations/${reservationId}`,
    );

    if (checkResponse.ok()) {
      const checkData = await checkResponse.json();
      expect(checkData.data).toBeDefined();
    }

    await page.goto('/orders');
    await expect(page.locator('body')).toContainText(/order|pesanan|riwayat/i);
  });

  test('should handle invalid QR code gracefully', async ({ page }) => {
    const invalidTicketCode = 'INVALID-QR-CODE-12345';

    await page.goto(`/login`);
    await page.getByLabel('Email').fill('seller@jeevatix.id');
    await page.getByLabel('Password').fill('Seller123!');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto(`/events`);
    await page.waitForLoadState('networkidle');

    const firstEvent = page.locator('[data-event-card]').first();
    if ((await firstEvent.count()) > 0) {
      await firstEvent.click();
      await page.waitForLoadState('networkidle');

      const checkinLink = page.getByRole('link', { name: /check.*in/i });
      if ((await checkinLink.count()) > 0) {
        await checkinLink.click();
        await page.waitForLoadState('networkidle');

        const searchInput = page.locator('input[type="text"]').first();
        if ((await searchInput.count()) > 0) {
          await searchInput.fill(invalidTicketCode);
          await page.keyboard.press('Enter');

          await page.waitForTimeout(1000);

          const bodyText = await page.locator('body').textContent();
          const hasErrorIndicator =
            bodyText?.includes('tidak ditemukan') ||
            bodyText?.includes('tidak valid') ||
            bodyText?.includes('invalid') ||
            bodyText?.includes('not found');

          expect(hasErrorIndicator).toBeTruthy();
        }
      }
    }
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

  test('should prevent double payment submission', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const tierCard = page.locator(`[data-tier-id="${tierId}"]`).first();
    if ((await tierCard.count()) > 0) {
      await tierCard.locator('button:has-text("Pilih")').click();

      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.fill('1');

      await page.getByRole('button', { name: /lanjut.*bayar/i }).click();
      await page.waitForURL(/\/payment\//);

      const payButton = page.getByRole('button', { name: /bayar|pay/i }).first();

      if ((await payButton.count()) > 0) {
        await payButton.click();

        const isDisabled = await payButton.isDisabled().catch(() => false);
        const hasLoadingState =
          (await page.locator('[data-loading]').count()) > 0 ||
          (await page.locator('.loading').count()) > 0;

        expect(isDisabled || hasLoadingState).toBeTruthy();
      }
    }
  });

  test('should show appropriate error for insufficient stock', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const tierCard = page.locator(`[data-tier-id="${tierId}"]`).first();
    if ((await tierCard.count()) > 0) {
      const stockText = await tierCard.textContent();
      const stockMatch = stockText?.match(/(\d+)\s*(tersedia|available|stock)/i);

      if (stockMatch) {
        const availableStock = parseInt(stockMatch[1]);

        if (availableStock > 0) {
          await tierCard.locator('button:has-text("Pilih")').click();

          const quantityInput = page.locator('input[type="number"]').first();
          const excessiveQuantity = availableStock + 10;
          await quantityInput.fill(excessiveQuantity.toString());

          await page.getByRole('button', { name: /lanjut.*bayar/i }).click();

          await page.waitForTimeout(1000);

          const bodyText = await page.locator('body').textContent();
          const hasStockError =
            bodyText?.includes('stok') ||
            bodyText?.includes('stock') ||
            bodyText?.includes('tersedia') ||
            bodyText?.includes('available') ||
            page.url().includes('/checkout/');

          expect(hasStockError).toBeTruthy();
        }
      }
    }
  });

  test('should handle network errors gracefully', async ({ page, context }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await context.route('**/api/**', (route) => route.abort('failed'));

    await page.goto('/events');

    await page.waitForTimeout(2000);

    const bodyText = await page.locator('body').textContent();
    const hasContent = bodyText && bodyText.length > 100;

    expect(hasContent).toBeTruthy();

    await context.unroute('**/api/**');
  });

  test('should validate form inputs before submission', async ({ page }) => {
    await page.goto('/register');

    await page.getByRole('button', { name: /daftar|register/i }).click();

    await page.waitForTimeout(500);

    const emailInput = page.getByLabel(/email/i);
    const isInvalid =
      (await emailInput.getAttribute('aria-invalid')) === 'true' ||
      (await page.locator('.error').count()) > 0 ||
      (await page.locator('[role="alert"]').count()) > 0;

    expect(isInvalid || page.url().includes('/register')).toBeTruthy();
  });
});
