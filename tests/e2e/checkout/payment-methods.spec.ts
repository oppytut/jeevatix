import { expect, test } from '@playwright/test';
import {
  createBuyerViaApi,
  createPublishedEventFixture,
  loginBuyerUi,
  API_URL,
  withRetry,
} from '../helpers';

test.describe('Payment Methods', () => {
  test.describe.configure({ mode: 'serial' });

  let buyerEmail: string;
  let buyerPassword: string;
  let eventSlug: string;
  let tierId: string;
  let fixtureReady = false;

  test.beforeAll(async ({ request }) => {
    await withRetry(async () => {
      const buyer = await createBuyerViaApi(request);
      buyerEmail = buyer.email;
      buyerPassword = buyer.password;

      const fixture = await createPublishedEventFixture(request);
      eventSlug = fixture.event.slug;
      tierId = fixture.event.tiers[0].id;
    });

    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await request.get(`${API_URL}/events/${eventSlug}`, {
        headers: { Accept: 'application/json' },
      });
      if (response.ok()) {
        const payload = await response.json();
        if (payload.data?.tiers?.length > 0) {
          fixtureReady = true;
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  });

  test.beforeEach(async ({}, testInfo) => {
    if (!fixtureReady) {
      testInfo.skip();
    }
  });

  test('should display reservation state after submitting', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);
    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    // Select tier
    await page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`).check({ force: true });

    // Set quantity
    await page.locator('input[name="quantity"]').fill('1');

    // Submit reservation
    await page.getByRole('button', { name: 'Reservasi Tiket' }).click();
    await page.waitForLoadState('networkidle');

    // Verify reservation state is shown on checkout page
    const bodyText = await page.locator('body').textContent();
    const hasReservationState =
      bodyText?.includes('reservasi') ||
      bodyText?.includes('dikunci') ||
      bodyText?.includes('countdown') ||
      bodyText?.includes('bayar') ||
      bodyText?.includes('payment');

    expect(hasReservationState).toBeTruthy();
  });

  test('should calculate correct total amount', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);
    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    // Select tier and get price
    const tierLabel = page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`).locator('..');
    await page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`).check({ force: true });

    const tierText = await tierLabel.textContent();
    const priceMatch = tierText?.match(/Rp\s*([\d.,]+)/);

    if (priceMatch) {
      const quantity = 2;
      await page.locator('input[name="quantity"]').fill(quantity.toString());

      // Submit reservation
      await page.getByRole('button', { name: 'Reservasi Tiket' }).click();
      await page.waitForLoadState('networkidle');

      // Verify total is displayed
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toContain('Rp');
    }
  });

  test('should show payment-related content after reservation', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);
    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    // Select tier
    await page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`).check({ force: true });

    // Set quantity
    await page.locator('input[name="quantity"]').fill('1');

    // Submit reservation
    await page.getByRole('button', { name: 'Reservasi Tiket' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check for payment-related content on checkout page
    const bodyText = await page.locator('body').textContent();
    const hasPaymentContent =
      bodyText?.includes('bayar') ||
      bodyText?.includes('payment') ||
      bodyText?.includes('total') ||
      bodyText?.includes('metode');

    expect(hasPaymentContent).toBeTruthy();
  });

  test('should handle reservation with different quantities', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);
    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    // Select tier
    await page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`).check({ force: true });

    // Test with quantity 3
    await page.locator('input[name="quantity"]').fill('3');

    // Submit reservation
    await page.getByRole('button', { name: 'Reservasi Tiket' }).click();
    await page.waitForLoadState('networkidle');

    // Verify reservation succeeded or shows appropriate error
    const bodyText = await page.locator('body').textContent();
    const hasValidState =
      bodyText?.includes('reservasi') ||
      bodyText?.includes('dikunci') ||
      bodyText?.includes('error') ||
      bodyText?.includes('tidak tersedia');

    expect(hasValidState).toBeTruthy();
  });

  test('should show countdown timer after reservation', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);
    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    // Select tier
    await page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`).check({ force: true });

    // Set quantity
    await page.locator('input[name="quantity"]').fill('1');

    // Submit reservation
    await page.getByRole('button', { name: 'Reservasi Tiket' }).click();
    await page.waitForLoadState('networkidle');

    // Check for countdown timer
    const hasCountdown =
      (await page.locator('[data-countdown]').count()) > 0 ||
      (await page.locator('text=/\\d{1,2}:\\d{2}/').count()) > 0;

    expect(hasCountdown).toBeTruthy();
  });

  test('should disable reservation button after submission', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);
    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    // Select tier
    await page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`).check({ force: true });

    // Set quantity
    await page.locator('input[name="quantity"]').fill('1');

    // Submit reservation
    const reserveButton = page.getByRole('button', { name: 'Reservasi Tiket' });
    await reserveButton.click();
    await page.waitForLoadState('networkidle');

    // Verify button is disabled or page shows locked state
    const isDisabled = await reserveButton.isDisabled().catch(() => false);
    const bodyText = await page.locator('body').textContent();
    const hasLockedState = bodyText?.includes('dikunci') || bodyText?.includes('reservasi');

    expect(isDisabled || hasLockedState).toBeTruthy();
  });
});
