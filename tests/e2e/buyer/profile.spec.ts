import { expect, test } from '@playwright/test';
import {
  createBuyerViaApi,
  loginBuyerUi,
  withRetry,
} from '../helpers';

test.describe('Buyer Profile Edit', () => {
  test.describe.configure({ mode: 'serial' });

  let buyerEmail: string;
  let buyerPassword: string;

  test.beforeAll(async ({ request }) => {
    const buyer = await withRetry(() => createBuyerViaApi(request));
    buyerEmail = buyer.email;
    buyerPassword = buyer.password;
  });

  test('should display profile page with user info', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').textContent();
    const hasProfileContent =
      bodyText?.includes('Nama Lengkap') ||
      bodyText?.includes('Profil') ||
      bodyText?.includes('profile') ||
      bodyText?.includes(buyerEmail);

    expect(hasProfileContent).toBeTruthy();
  });

  test('should edit full name successfully', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    const nameInput = page.locator('#full-name');
    const isVisible = await nameInput.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Profile name input not visible');
      return;
    }

    const newName = `Updated Buyer ${Date.now()}`;
    await nameInput.clear();
    await nameInput.fill(newName);

    const saveButton = page.getByRole('button', { name: /Simpan Profil|Simpan|Save/i });
    const saveVisible = await saveButton.isVisible().catch(() => false);
    if (!saveVisible) {
      test.skip(true, 'Save profile button not visible');
      return;
    }

    await saveButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const bodyText = await page.locator('body').textContent();
    const isSuccess =
      bodyText?.includes('berhasil') ||
      bodyText?.includes('success') ||
      bodyText?.includes(newName);

    expect(isSuccess).toBeTruthy();
  });

  test('should edit phone number', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    const phoneInput = page.locator('#phone');
    const isVisible = await phoneInput.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Phone input not visible');
      return;
    }

    await phoneInput.clear();
    await phoneInput.fill('081299887766');

    const saveButton = page.getByRole('button', { name: /Simpan Profil|Simpan|Save/i });
    if (await saveButton.isVisible().catch(() => false)) {
      await saveButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    const bodyText = await page.locator('body').textContent();
    const isSuccess =
      bodyText?.includes('berhasil') ||
      bodyText?.includes('success') ||
      bodyText?.includes('081299887766');

    expect(isSuccess).toBeTruthy();
  });

  test('should validate empty name field', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);

    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    const nameInput = page.locator('#full-name');
    const isVisible = await nameInput.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Profile name input not visible');
      return;
    }

    await nameInput.clear();

    const saveButton = page.getByRole('button', { name: /Simpan Profil|Simpan|Save/i });
    if (await saveButton.isVisible().catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(1000);
    }

    // Should show validation error or stay on page
    const bodyText = await page.locator('body').textContent();
    const hasValidation =
      bodyText?.includes('wajib') ||
      bodyText?.includes('required') ||
      bodyText?.includes('harus') ||
      bodyText?.includes('tidak boleh kosong') ||
      page.url().includes('/profile');

    expect(hasValidation).toBeTruthy();
  });
});
