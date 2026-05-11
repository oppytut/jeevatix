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
    await page.getByRole('button', { name: 'Musik' }).click();

    await page.getByRole('button', { name: 'Lanjut' }).click();
    await page.waitForTimeout(300);

    const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    const saleStart = new Date(Date.now() - 60 * 60 * 1000);
    const saleEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await page.getByLabel('Venue Name').fill('Sasana Budaya Ganesha');
    await page.getByLabel('Start At').fill(formatDateTimeLocal(startDate));
    await page.getByLabel('End At').fill(formatDateTimeLocal(endDate));
    await page.getByLabel('Sale Start').fill(formatDateTimeLocal(saleStart));
    await page.getByLabel('Sale End').fill(formatDateTimeLocal(saleEnd));

    await page.getByRole('button', { name: 'Lanjut' }).click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: 'Lanjut' }).click();
    await page.waitForTimeout(300);

    await page.getByLabel('Nama Tier').fill('Early Bird');
    await page.getByLabel('Harga').fill('100000');
    await page.getByLabel('Quota').fill('50');

    await page.getByRole('button', { name: 'Tambah Tier' }).click();
    await page.waitForTimeout(300);

    const tierSections = page.locator('[class*="rounded"][class*="border"][class*="slate-50"]');
    const tierCount = await tierSections.count();

    expect(tierCount).toBeGreaterThanOrEqual(2);
  });

  test('should validate tier price is positive', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('/events/create');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Title Event').fill('Price Validation Event');
    await page.getByLabel('Kota Event').fill('Jakarta');
    await page.getByRole('button', { name: 'Musik' }).click();

    await page.getByRole('button', { name: 'Lanjut' }).click();
    await page.waitForTimeout(300);

    await page.getByLabel('Venue Name').fill('Test Venue');
    const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    await page.getByLabel('Start At').fill(formatDateTimeLocal(startDate));
    await page.getByLabel('End At').fill(formatDateTimeLocal(endDate));
    await page.getByLabel('Sale Start').fill(formatDateTimeLocal(new Date(Date.now() - 3600000)));
    await page.getByLabel('Sale End').fill(formatDateTimeLocal(new Date(Date.now() + 86400000 * 3)));

    await page.getByRole('button', { name: 'Lanjut' }).click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: 'Lanjut' }).click();
    await page.waitForTimeout(300);

    await page.getByLabel('Nama Tier').fill('Free Tier');
    await page.getByLabel('Harga').fill('-100');
    await page.getByLabel('Quota').fill('10');

    await page.getByRole('button', { name: 'Lanjut' }).click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: 'Simpan Event Draft' }).click();
    await page.waitForTimeout(1000);

    const isStillOnForm = page.url().includes('/create');
    expect(isStillOnForm).toBeTruthy();
  });
});
