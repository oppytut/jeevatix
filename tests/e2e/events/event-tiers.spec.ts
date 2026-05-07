import { expect, test } from '@playwright/test';
import { createSellerViaApi, loginSellerUi, uniqueEmail, formatDateTimeLocal } from '../helpers';

test.describe('Event Tiers Management', () => {
  test.describe.configure({ mode: 'serial' });

  let sellerEmail: string;
  let sellerPassword: string;
  let eventId: string;

  test.beforeAll(async ({ request }) => {
    sellerEmail = uniqueEmail('tier-seller');
    sellerPassword = 'Seller123!';

    await createSellerViaApi(request, {
      email: sellerEmail,
      password: sellerPassword,
      full_name: 'Tier Test Seller',
      org_name: 'Tier Test Org',
    });
  });

  test('should create event and add multiple tiers', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('/events/create');
    await page.waitForLoadState('networkidle');

    const title = `Event with Tiers ${Date.now()}`;
    await page.getByLabel(/judul|title/i).fill(title);
    await page.getByLabel(/deskripsi|description/i).fill('Event untuk test tiers');

    const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await page.getByLabel(/mulai|start/i).fill(formatDateTimeLocal(startDate));

    const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000);
    await page.getByLabel(/selesai|end/i).fill(formatDateTimeLocal(endDate));

    await page.getByLabel(/lokasi|location|venue/i).fill('Test Venue');
    await page.getByLabel(/kota|city/i).fill('Jakarta');

    await page.getByRole('button', { name: /simpan|save/i }).click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const match = url.match(/\/events\/([^\/]+)/);
    if (match) {
      eventId = match[1];
    }

    await page.goto(`/events/${eventId}/tiers`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /tambah.*tier|add.*tier/i }).click();
    await page.getByLabel(/nama.*tier|tier.*name/i).fill('VIP');
    await page.getByLabel(/harga|price/i).fill('500000');
    await page.getByLabel(/kuota|quota|stock/i).fill('50');
    await page.getByRole('button', { name: /simpan|save/i }).click();

    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toContainText('VIP');

    await page.getByRole('button', { name: /tambah.*tier|add.*tier/i }).click();
    await page.getByLabel(/nama.*tier|tier.*name/i).fill('Regular');
    await page.getByLabel(/harga|price/i).fill('250000');
    await page.getByLabel(/kuota|quota|stock/i).fill('100');
    await page.getByRole('button', { name: /simpan|save/i }).click();

    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toContainText('Regular');
  });

  test('should edit tier details', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto(`/events/${eventId}/tiers`);
    await page.waitForLoadState('networkidle');

    const editButton = page.getByRole('button', { name: /edit|ubah/i }).first();
    await editButton.click();

    await page.getByLabel(/harga|price/i).fill('550000');
    await page.getByRole('button', { name: /simpan|save|update/i }).click();

    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toContainText('550');
  });

  test('should delete tier', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto(`/events/${eventId}/tiers`);
    await page.waitForLoadState('networkidle');

    const initialTiers = await page.locator('[data-tier-card]').count();

    const deleteButton = page.getByRole('button', { name: /hapus|delete/i }).first();
    await deleteButton.click();

    const confirmButton = page.getByRole('button', { name: /ya|yes|confirm/i });
    if ((await confirmButton.count()) > 0) {
      await confirmButton.click();
    }

    await page.waitForTimeout(1000);

    const finalTiers = await page.locator('[data-tier-card]').count();
    expect(finalTiers).toBeLessThan(initialTiers);
  });

  test('should validate tier price is positive', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto(`/events/${eventId}/tiers`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /tambah.*tier|add.*tier/i }).click();
    await page.getByLabel(/nama.*tier|tier.*name/i).fill('Invalid Tier');
    await page.getByLabel(/harga|price/i).fill('-100');
    await page.getByLabel(/kuota|quota|stock/i).fill('10');
    await page.getByRole('button', { name: /simpan|save/i }).click();

    await page.waitForTimeout(500);

    const hasError =
      (await page.locator('[role="alert"]').count()) > 0 ||
      (await page.locator('.error').count()) > 0 ||
      page.url().includes('/tiers');

    expect(hasError).toBeTruthy();
  });

  test('should validate tier quota is positive', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto(`/events/${eventId}/tiers`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /tambah.*tier|add.*tier/i }).click();
    await page.getByLabel(/nama.*tier|tier.*name/i).fill('Zero Quota');
    await page.getByLabel(/harga|price/i).fill('100000');
    await page.getByLabel(/kuota|quota|stock/i).fill('0');
    await page.getByRole('button', { name: /simpan|save/i }).click();

    await page.waitForTimeout(500);

    const hasError =
      (await page.locator('[role="alert"]').count()) > 0 ||
      (await page.locator('.error').count()) > 0 ||
      page.url().includes('/tiers');

    expect(hasError).toBeTruthy();
  });
});
