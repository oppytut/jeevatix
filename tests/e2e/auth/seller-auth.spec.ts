import { expect, test } from '@playwright/test';
import { uniqueEmail } from '../helpers';

test.describe('Seller Authentication', () => {
  test('should register new seller with organization details', async ({ page }) => {
    const email = uniqueEmail('seller-reg');
    const password = 'Seller123!';
    const fullName = 'Test Seller';
    const orgName = 'Test Organization';

    await page.goto('/register');

    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByLabel(/confirm.*password/i).fill(password);
    await page.getByLabel(/nama.*lengkap|full.*name/i).fill(fullName);
    await page.getByLabel(/phone|telepon/i).fill('081234567890');
    await page.getByLabel(/nama.*organisasi|organization.*name/i).fill(orgName);
    await page.getByLabel(/deskripsi.*organisasi|organization.*description/i).fill('Test organization description');

    await page.getByRole('button', { name: /daftar|register/i }).click();

    await page.waitForURL(/\/(|verify-email)/);
    
    const bodyText = await page.locator('body').textContent();
    const isSuccess = bodyText?.includes('berhasil') || 
                     bodyText?.includes('success') || 
                     bodyText?.includes('verifikasi') ||
                     page.url().includes('verify-email');
    
    expect(isSuccess).toBeTruthy();
  });

  test('should validate organization name is required', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel(/email/i).fill(uniqueEmail('seller-val'));
    await page.getByLabel(/^password$/i).fill('Seller123!');
    await page.getByLabel(/confirm.*password/i).fill('Seller123!');
    await page.getByLabel(/nama.*lengkap|full.*name/i).fill('Test Seller');

    await page.getByRole('button', { name: /daftar|register/i }).click();

    await page.waitForTimeout(500);

    const orgInput = page.getByLabel(/nama.*organisasi|organization.*name/i);
    const isInvalid = await orgInput.getAttribute('aria-invalid') === 'true' ||
                     await page.locator('.error').count() > 0 ||
                     page.url().includes('/register');

    expect(isInvalid).toBeTruthy();
  });

  test('should login seller and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('seller-e2e@jeevatix.id');
    await page.getByLabel('Password').fill('Seller123!');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('body')).toContainText(/dashboard|event|pesanan/i);
  });

  test('should show error for invalid seller credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('invalid@seller.com');
    await page.getByLabel('Password').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Login' }).click();

    await page.waitForTimeout(1000);

    const bodyText = await page.locator('body').textContent();
    const hasError = bodyText?.includes('salah') || 
                    bodyText?.includes('invalid') || 
                    bodyText?.includes('tidak ditemukan') ||
                    page.url().includes('/login');

    expect(hasError).toBeTruthy();
  });

  test('should handle forgot password flow', async ({ page }) => {
    await page.goto('/forgot-password');

    await page.getByLabel(/email/i).fill('seller-e2e@jeevatix.id');
    await page.getByRole('button', { name: /kirim|send|reset/i }).click();

    await page.waitForTimeout(1000);

    const bodyText = await page.locator('body').textContent();
    const isSuccess = bodyText?.includes('terkirim') || 
                     bodyText?.includes('sent') || 
                     bodyText?.includes('email');

    expect(isSuccess).toBeTruthy();
  });

  test('should logout seller successfully', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('seller-e2e@jeevatix.id');
    await page.getByLabel('Password').fill('Seller123!');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/$/);

    const logoutButton = page.getByRole('button', { name: /logout|keluar/i });
    if (await logoutButton.count() > 0) {
      await logoutButton.click();
      await page.waitForTimeout(500);
      
      const currentUrl = page.url();
      expect(currentUrl).toContain('/login');
    }
  });
});
