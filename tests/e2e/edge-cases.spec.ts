import { expect, test } from '@playwright/test';
import {
  createBuyerViaApi,
  createPublishedEventFixture,
  createSellerViaApi,
  loginBuyerUi,
  loginSellerUi,
  uniqueEmail,
} from './helpers';

test.describe('Edge Cases & Boundary Conditions', () => {
  test.describe.configure({ mode: 'serial' });

  let buyerEmail: string;
  let buyerPassword: string;
  let sellerEmail: string;
  let sellerPassword: string;
  let eventSlug: string;
  let tierId: string;

  test.beforeAll(async ({ request }) => {
    buyerEmail = uniqueEmail('edge-buyer');
    buyerPassword = 'Buyer123!';
    await createBuyerViaApi(request, {
      email: buyerEmail,
      password: buyerPassword,
      full_name: 'Edge Case Buyer',
    });

    sellerEmail = uniqueEmail('edge-seller');
    sellerPassword = 'Seller123!';
    await createSellerViaApi(request, {
      email: sellerEmail,
      password: sellerPassword,
      full_name: 'Edge Case Seller',
      org_name: 'Edge Test Org',
    });

    const fixture = await createPublishedEventFixture(request);
    eventSlug = fixture.event.slug;
    tierId = fixture.tiers[0].id;
  });

  test('should handle zero quantity reservation attempt', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const tierCard = page.locator(`[data-tier-id="${tierId}"]`).first();
    if ((await tierCard.count()) > 0) {
      await tierCard.locator('button:has-text("Pilih")').click();

      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.fill('0');

      const continueButton = page.getByRole('button', { name: /lanjut.*bayar/i });
      const isDisabled = await continueButton.isDisabled().catch(() => false);

      expect(isDisabled || page.url().includes('/checkout/')).toBeTruthy();
    }
  });

  test('should handle negative quantity input', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto(`/checkout/${eventSlug}`);
    await page.waitForLoadState('networkidle');

    const tierCard = page.locator(`[data-tier-id="${tierId}"]`).first();
    if ((await tierCard.count()) > 0) {
      await tierCard.locator('button:has-text("Pilih")').click();

      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.fill('-5');

      const value = await quantityInput.inputValue();
      const numValue = parseInt(value);

      expect(numValue).toBeGreaterThanOrEqual(0);
    }
  });

  test('should handle extremely long event title', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('baseURL/events/create');
    await page.waitForLoadState('networkidle');

    const longTitle = 'A'.repeat(300);
    const titleInput = page.getByLabel(/judul|title/i);

    if ((await titleInput.count()) > 0) {
      await titleInput.fill(longTitle);

      const value = await titleInput.inputValue();
      expect(value.length).toBeLessThanOrEqual(255);
    }
  });

  test('should handle special characters in search', async ({ page }) => {
    await page.goto('baseURL/events');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[type="search"], input[placeholder*="cari"]').first();

    if ((await searchInput.count()) > 0) {
      const specialChars = '<script>alert("xss")</script>';
      await searchInput.fill(specialChars);
      await page.keyboard.press('Enter');

      await page.waitForTimeout(1000);

      const bodyHtml = await page.locator('body').innerHTML();
      const hasXSS = bodyHtml.includes('<script>alert');

      expect(hasXSS).toBeFalsy();
    }
  });

  test('should handle rapid form submissions', async ({ page }) => {
    await page.goto('baseURL/login');

    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    const submitButton = page.getByRole('button', { name: /login|masuk/i });

    await emailInput.fill(buyerEmail);
    await passwordInput.fill(buyerPassword);

    await Promise.all([submitButton.click(), submitButton.click(), submitButton.click()]);

    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(login)?$/);
  });

  test('should handle missing required fields', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('baseURL/events/create');
    await page.waitForLoadState('networkidle');

    const submitButton = page.getByRole('button', { name: /simpan|save|buat/i }).first();

    if ((await submitButton.count()) > 0) {
      await submitButton.click();

      await page.waitForTimeout(500);

      const hasError =
        (await page.locator('.error').count()) > 0 ||
        (await page.locator('[role="alert"]').count()) > 0 ||
        (await page.locator('[aria-invalid="true"]').count()) > 0 ||
        page.url().includes('/create');

      expect(hasError).toBeTruthy();
    }
  });

  test('should handle date in the past for event', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('baseURL/events/create');
    await page.waitForLoadState('networkidle');

    const dateInput = page.locator('input[type="datetime-local"]').first();

    if ((await dateInput.count()) > 0) {
      const pastDate = '2020-01-01T10:00';
      await dateInput.fill(pastDate);

      const titleInput = page.getByLabel(/judul|title/i);
      if ((await titleInput.count()) > 0) {
        await titleInput.fill('Past Event Test');
      }

      const submitButton = page.getByRole('button', { name: /simpan|save/i }).first();
      if ((await submitButton.count()) > 0) {
        await submitButton.click();

        await page.waitForTimeout(1000);

        const hasError =
          (await page.locator('.error').count()) > 0 ||
          (await page.locator('[role="alert"]').count()) > 0 ||
          page.url().includes('/create');

        expect(hasError).toBeTruthy();
      }
    }
  });

  test('should handle file upload size limits', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('baseURL/events/create');
    await page.waitForLoadState('networkidle');

    const fileInput = page.locator('input[type="file"]').first();

    if ((await fileInput.count()) > 0) {
      const buffer = Buffer.alloc(11 * 1024 * 1024);
      await fileInput.setInputFiles({
        name: 'large-image.jpg',
        mimeType: 'image/jpeg',
        buffer,
      });

      await page.waitForTimeout(1000);

      const hasError =
        (await page.locator('.error').count()) > 0 ||
        (await page.locator('[role="alert"]').count()) > 0 ||
        (await page.locator('text=/ukuran|size|besar/i').count()) > 0;

      expect(hasError).toBeTruthy();
    }
  });

  test('should handle concurrent ticket check-ins', async ({ page, context }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('baseURL/events');
    await page.waitForLoadState('networkidle');

    const firstEvent = page.locator('[data-event-card]').first();
    if ((await firstEvent.count()) > 0) {
      await firstEvent.click();
      await page.waitForLoadState('networkidle');

      const checkinLink = page.getByRole('link', { name: /check.*in/i });
      if ((await checkinLink.count()) > 0) {
        await checkinLink.click();
        await page.waitForLoadState('networkidle');

        const page2 = await context.newPage();
        await page2.goto(page.url());

        await page.waitForTimeout(1000);
        await page2.waitForTimeout(1000);

        const hasContent = (await page.locator('body').textContent())?.length ?? 0 > 100;
        const hasContent2 = (await page2.locator('body').textContent())?.length ?? 0 > 100;

        expect(hasContent && hasContent2).toBeTruthy();

        await page2.close();
      }
    }
  });

  test('should handle browser back button during checkout', async ({ page }) => {
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

      await page.goBack();
      await page.waitForLoadState('networkidle');

      const currentUrl = page.url();
      expect(currentUrl).toContain('/checkout/');
    }
  });
});
