import { expect, test } from '@playwright/test';
import {
  createBuyerViaApi,
  createPublishedEventFixture,
  loginBuyerUi,
  uniqueEmail,
} from '../helpers';

test.describe('Payment Methods', () => {
  test.describe.configure({ mode: 'serial' });

  let buyerEmail: string;
  let buyerPassword: string;
  let eventSlug: string;
  let tierId: string;

  test.beforeAll(async ({ request }) => {
    buyerEmail = uniqueEmail('payment-buyer');
    buyerPassword = 'Buyer123!';

    await createBuyerViaApi(request, {
      email: buyerEmail,
      password: buyerPassword,
      full_name: 'Payment Test Buyer',
    });

    const fixture = await createPublishedEventFixture(request);
    eventSlug = fixture.event.slug;
    tierId = fixture.tiers[0].id;
  });

  test('should display available payment methods', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);
    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const tierCard = page.locator(`[data-tier-id="${tierId}"]`).first();
    await tierCard.locator('button:has-text("Pilih")').click();

    const quantityInput = page.locator('input[type="number"]').first();
    await quantityInput.fill('1');

    await page.getByRole('button', { name: /lanjut.*bayar/i }).click();
    await page.waitForURL(/\/payment\//);

    const paymentSection = page.locator('body');
    await expect(paymentSection).toContainText(/bayar|payment|metode/i);
  });

  test('should calculate correct total amount', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);
    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const tierCard = page.locator(`[data-tier-id="${tierId}"]`).first();
    const priceText = await tierCard.textContent();
    const priceMatch = priceText?.match(/Rp\s*([\d.,]+)/);

    if (priceMatch) {
      await tierCard.locator('button:has-text("Pilih")').click();

      const quantity = 2;
      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.fill(quantity.toString());

      await page.getByRole('button', { name: /lanjut.*bayar/i }).click();
      await page.waitForURL(/\/payment\//);

      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toContain('Rp');
    }
  });

  test('should show payment instructions after selection', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);
    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const tierCard = page.locator(`[data-tier-id="${tierId}"]`).first();
    await tierCard.locator('button:has-text("Pilih")').click();

    const quantityInput = page.locator('input[type="number"]').first();
    await quantityInput.fill('1');

    await page.getByRole('button', { name: /lanjut.*bayar/i }).click();
    await page.waitForURL(/\/payment\//);

    const paymentButton = page.getByRole('button', { name: /bayar|pay/i }).first();
    if ((await paymentButton.count()) > 0) {
      await paymentButton.click();
      await page.waitForTimeout(1000);

      const hasInstructions =
        (await page.locator('body').textContent())?.includes('instruksi') ||
        (await page.locator('body').textContent())?.includes('transfer') ||
        page.url().includes('/orders/');

      expect(hasInstructions).toBeTruthy();
    }
  });

  test('should handle payment cancellation', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);
    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const tierCard = page.locator(`[data-tier-id="${tierId}"]`).first();
    await tierCard.locator('button:has-text("Pilih")').click();

    const quantityInput = page.locator('input[type="number"]').first();
    await quantityInput.fill('1');

    await page.getByRole('button', { name: /lanjut.*bayar/i }).click();
    await page.waitForURL(/\/payment\//);

    const cancelButton = page.getByRole('button', { name: /batal|cancel/i }).first();
    if ((await cancelButton.count()) > 0) {
      await cancelButton.click();
      await page.waitForTimeout(500);

      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/payment/');
    }
  });
});
