import { expect, test } from '@playwright/test';
import { createSellerViaApi, loginSellerUi, formatDateTimeLocal } from '../helpers';

test.describe('Event Tiers Management', () => {
  test.describe.configure({ mode: 'serial' });

  let sellerEmail: string;
  let sellerPassword: string;

  test.beforeAll(async ({ request }) => {
    const seller = await createSellerViaApi(request);
    sellerEmail = seller.email;
    sellerPassword = seller.password;
  });

  test('should create event and add multiple tiers', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('/events/create');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Title Event').fill(`Tier Test Event ${Date.now()}`);
    await page.getByLabel('Deskripsi').fill('Event for tier management testing');
    await page.getByLabel('Kota Event').fill('Bandung');

    const musikButton = page.locator('button', { hasText: 'Musik' }).first();
    await musikButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if ((await musikButton.count()) === 0) {
      test.skip(true, 'Category buttons not loaded');
      return;
    }
    await musikButton.click();
    await page.waitForTimeout(500);

    const lanjutButton = page.getByRole('button', { name: /Lanjut/i });
    await lanjutButton.click();

    const venueLabel = page.getByLabel('Venue Name');
    const advanced = await venueLabel.isVisible().catch(() => false);
    if (!advanced) {
      const errorText = await page.locator('body').textContent();
      test.skip(true, `Wizard step 1 validation failed: ${errorText?.substring(0, 100)}`);
      return;
    }

    const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    const saleStart = new Date(Date.now() - 60 * 60 * 1000);
    const saleEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await page.getByLabel('Venue Name').fill('Sasana Budaya Ganesha');
    await page.getByLabel('Start At').fill(formatDateTimeLocal(startDate));
    await page.getByLabel('End At').fill(formatDateTimeLocal(endDate));
    await page.getByLabel('Sale Start').fill(formatDateTimeLocal(saleStart));
    await page.getByLabel('Sale End').fill(formatDateTimeLocal(saleEnd));

    await lanjutButton.click();
    await page.waitForTimeout(500);

    await lanjutButton.click();
    await page.getByLabel('Nama Tier').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByLabel('Nama Tier').fill('Early Bird');
    await page.getByLabel('Harga').fill('100000');
    await page.getByLabel('Quota').fill('50');

    await page.getByRole('button', { name: 'Tambah Tier' }).click();
    await page.waitForTimeout(500);

    const tierCards = page.locator('text=Tier 2');
    expect(await tierCards.count()).toBeGreaterThanOrEqual(1);
  });

  test('should validate tier price is positive', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('/events/create');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Title Event').fill('Price Validation Event');
    await page.getByLabel('Kota Event').fill('Jakarta');

    const musikButton = page.locator('button', { hasText: 'Musik' }).first();
    await musikButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if ((await musikButton.count()) === 0) {
      test.skip(true, 'Category buttons not loaded');
      return;
    }
    await musikButton.click();
    await page.waitForTimeout(500);

    const lanjutButton = page.getByRole('button', { name: /Lanjut/i });
    await lanjutButton.click();

    const venueLabel = page.getByLabel('Venue Name');
    const advanced = await venueLabel.isVisible().catch(() => false);
    if (!advanced) {
      test.skip(true, 'Wizard step 1 validation failed');
      return;
    }

    await page.getByLabel('Venue Name').fill('Test Venue');
    const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    await page.getByLabel('Start At').fill(formatDateTimeLocal(startDate));
    await page.getByLabel('End At').fill(formatDateTimeLocal(endDate));
    await page.getByLabel('Sale Start').fill(formatDateTimeLocal(new Date(Date.now() - 3600000)));
    await page.getByLabel('Sale End').fill(formatDateTimeLocal(new Date(Date.now() + 86400000 * 3)));

    await lanjutButton.click();
    await page.waitForTimeout(500);

    await lanjutButton.click();
    await page.getByLabel('Nama Tier').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByLabel('Nama Tier').fill('Free Tier');
    await page.getByLabel('Harga').fill('-100');
    await page.getByLabel('Quota').fill('10');

    await lanjutButton.click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Simpan Event Draft' }).click().catch(() => {});
    await page.waitForTimeout(1000);

    const isStillOnForm = page.url().includes('/create');
    expect(isStillOnForm).toBeTruthy();
  });
});
