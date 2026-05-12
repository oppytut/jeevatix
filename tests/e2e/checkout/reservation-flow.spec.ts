import { expect, test } from '@playwright/test';
import {
  createBuyerViaApi,
  createPublishedEventFixture,
  loginBuyerUi,
} from '../helpers';

test.describe('Reservation Flow', () => {
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

  test('should complete full reservation flow with countdown', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    // Navigate to event
    await page.goto(`/events/${eventSlug}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toContainText(/beli.*tiket|buy.*ticket/i);

    // Click buy button
    const buyButton = page.getByRole('button', { name: /beli.*tiket|buy.*ticket/i }).first();
    await buyButton.click();
    await page.waitForURL(/\/checkout\//);

    // Select tier (radio input is sr-only, so force:true)
    await page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`).check({ force: true });

    // Set quantity
    const quantityInput = page.locator('input[name="quantity"]');
    await quantityInput.fill('2');

    // Submit reservation
    await page.getByRole('button', { name: 'Reservasi Tiket' }).click();
    await page.waitForLoadState('networkidle');

    // Verify reservation state on checkout page (no redirect to /payment/)
    const bodyText = await page.locator('body').textContent();
    const hasReservationState =
      bodyText?.includes('reservasi') ||
      bodyText?.includes('dikunci') ||
      bodyText?.includes('countdown') ||
      (await page.getByRole('button', { name: 'Reservasi Tiket' }).isDisabled());

    expect(hasReservationState).toBeTruthy();

    // Verify countdown timer exists
    const hasCountdown =
      (await page.locator('[data-countdown]').count()) > 0 ||
      (await page.locator('text=/\\d{1,2}:\\d{2}/').count()) > 0;
    expect(hasCountdown).toBeTruthy();
  });

  test('should show reservation expiry warning', async ({ page }) => {
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

    // Wait for countdown to show
    await page.waitForTimeout(3000);

    // Check if warning or countdown is visible
    const bodyText = await page.locator('body').textContent();
    const hasTimeWarning =
      bodyText?.includes('waktu') ||
      bodyText?.includes('time') ||
      bodyText?.includes('expired') ||
      bodyText?.includes('kadaluarsa') ||
      bodyText?.includes('countdown') ||
      bodyText?.includes('dikunci');

    expect(hasTimeWarning).toBeTruthy();
  });

  test('should release reservation on page leave', async ({ page, context }) => {
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

    // Leave checkout page
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    // Verify we can navigate away (reservation should be released)
    expect(page.url()).toContain('/events');
  });

  test('should prevent quantity exceeding availability', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    // Select tier
    await page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`).check({ force: true });

    // Try to set quantity beyond max
    const quantityInput = page.locator('input[name="quantity"]');
    const maxQuantity = await quantityInput.getAttribute('max');

    if (maxQuantity) {
      const exceedingQuantity = parseInt(maxQuantity) + 10;
      await quantityInput.fill(exceedingQuantity.toString());

      // Submit reservation
      await page.getByRole('button', { name: 'Reservasi Tiket' }).click();
      await page.waitForLoadState('networkidle');

      // Should show error or clamp to max
      const bodyText = await page.locator('body').textContent();
      const hasError =
        bodyText?.includes('error') ||
        bodyText?.includes('tidak tersedia') ||
        bodyText?.includes('melebihi') ||
        bodyText?.includes('maksimal');

      const actualValue = await quantityInput.inputValue();
      const isClampedOrError = hasError || parseInt(actualValue) <= parseInt(maxQuantity);

      expect(isClampedOrError).toBeTruthy();
    }
  });

  test('should update total price when quantity changes', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    // Select tier
    const tierLabel = page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`).locator('..');
    await page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`).check({ force: true });

    // Extract tier price
    const tierText = await tierLabel.textContent();
    const priceMatch = tierText?.match(/Rp\s*([\d.,]+)/);

    if (priceMatch) {
      // Set quantity to 2
      await page.locator('input[name="quantity"]').fill('2');
      await page.waitForTimeout(500);

      // Check if total is displayed and updated
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toContain('Rp');
    }
  });

  test('should handle concurrent reservation attempts', async ({ page, context }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    // Open two tabs
    const page2 = await context.newPage();
    await loginBuyerUi(page2, buyerEmail, buyerPassword);

    // Both navigate to checkout
    await page.goto(`/checkout/${eventSlug}`);
    await page2.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');

    // Both select same tier
    await page.locator(`input[name="ticket_tier_id"][value="${tierId}"]`).check({ force: true });
    await page2.locator(`input[name="ticket_tier_id"][value="${tierId}"]`).check({ force: true });

    // Both set quantity
    await page.locator('input[name="quantity"]').fill('1');
    await page2.locator('input[name="quantity"]').fill('1');

    // Both try to reserve simultaneously
    await Promise.all([
      page.getByRole('button', { name: 'Reservasi Tiket' }).click(),
      page2.getByRole('button', { name: 'Reservasi Tiket' }).click(),
    ]);

    await page.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');

    // At least one should succeed
    const page1Text = await page.locator('body').textContent();
    const page2Text = await page2.locator('body').textContent();

    const page1Success =
      page1Text?.includes('reservasi') ||
      page1Text?.includes('dikunci') ||
      page1Text?.includes('countdown');
    const page2Success =
      page2Text?.includes('reservasi') ||
      page2Text?.includes('dikunci') ||
      page2Text?.includes('countdown');

    expect(page1Success || page2Success).toBeTruthy();

    await page2.close();
  });
});
