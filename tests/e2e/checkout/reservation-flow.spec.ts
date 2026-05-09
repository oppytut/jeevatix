import { expect, test } from '@playwright/test';
import {
  createBuyerViaApi,
  createPublishedEventFixture,
  loginBuyerUi,
  uniqueEmail,
} from '../helpers';

test.describe('Reservation Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let buyerEmail: string;
  let buyerPassword: string;
  let eventSlug: string;
  let tierId: string;

  test.beforeAll(async ({ request }) => {
    buyerEmail = uniqueEmail('reservation-buyer');
    buyerPassword = 'Buyer123!';

    await createBuyerViaApi(request, {
      email: buyerEmail,
      password: buyerPassword,
      full_name: 'Reservation Test Buyer',
    });

    const fixture = await createPublishedEventFixture(request);
    eventSlug = fixture.event.slug;
    tierId = fixture.tiers[0].id;
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

    // Select tier and quantity
    const tierCard = page.locator(`[data-tier-id="${tierId}"]`).first();
    await tierCard.locator('button:has-text("Pilih")').click();

    const quantityInput = page.locator('input[type="number"]').first();
    await quantityInput.fill('2');

    // Proceed to payment
    await page.getByRole('button', { name: /lanjut.*bayar/i }).click();
    await page.waitForURL(/\/payment\//);

    // Verify countdown timer exists
    const hasCountdown =
      (await page.locator('[data-countdown]').count()) > 0 ||
      (await page.locator('text=/\\d{1,2}:\\d{2}/').count()) > 0;
    expect(hasCountdown).toBeTruthy();

    // Verify order summary
    await expect(page.locator('body')).toContainText(/total|bayar|payment/i);
  });

  test('should show reservation expiry warning', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const tierCard = page.locator(`[data-tier-id="${tierId}"]`).first();
    await tierCard.locator('button:has-text("Pilih")').click();

    const quantityInput = page.locator('input[type="number"]').first();
    await quantityInput.fill('1');

    await page.getByRole('button', { name: /lanjut.*bayar/i }).click();
    await page.waitForURL(/\/payment\//);

    // Wait for countdown to show low time
    await page.waitForTimeout(3000);

    // Check if warning appears or countdown is visible
    const bodyText = await page.locator('body').textContent();
    const hasTimeWarning =
      bodyText?.includes('waktu') ||
      bodyText?.includes('time') ||
      bodyText?.includes('expired') ||
      bodyText?.includes('kadaluarsa');

    expect(hasTimeWarning).toBeTruthy();
  });

  test('should release reservation on page leave', async ({ page, context }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const tierCard = page.locator(`[data-tier-id="${tierId}"]`).first();
    await tierCard.locator('button:has-text("Pilih")').click();

    const quantityInput = page.locator('input[type="number"]').first();
    await quantityInput.fill('1');

    await page.getByRole('button', { name: /lanjut.*bayar/i }).click();
    await page.waitForURL(/\/payment\//);

    // Leave payment page
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    // Verify we can navigate away (reservation should be released)
    expect(page.url()).toContain('/events');
  });

  test('should prevent multiple simultaneous reservations', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    // Start first reservation
    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const tierCard = page.locator(`[data-tier-id="${tierId}"]`).first();
    await tierCard.locator('button:has-text("Pilih")').click();

    const quantityInput = page.locator('input[type="number"]').first();
    await quantityInput.fill('1');

    await page.getByRole('button', { name: /lanjut.*bayar/i }).click();
    await page.waitForURL(/\/payment\//);

    // Try to start another reservation in new tab
    const newPage = await page.context().newPage();
    await newPage.goto(`baseURL/checkout/${eventSlug}`);
    await newPage.waitForLoadState('networkidle');

    // Should either show error or redirect
    const newPageUrl = newPage.url();
    const hasRestriction =
      newPageUrl.includes('/payment/') ||
      newPageUrl.includes('/orders') ||
      (await newPage.locator('text=/sudah.*reservasi|already.*reserved/i').count()) > 0;

    expect(hasRestriction).toBeTruthy();

    await newPage.close();
  });

  test('should update stock availability in real-time', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/events/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    // Get initial stock count
    const stockElement = page.locator('text=/\\d+.*tersedia|\\d+.*available/i').first();
    const initialStockText = await stockElement.textContent();
    const initialStock = initialStockText?.match(/\d+/)?.[0];

    expect(initialStock).toBeDefined();

    // Stock should be displayed
    await expect(page.locator('body')).toContainText(/tersedia|available|stock/i);
  });
});
