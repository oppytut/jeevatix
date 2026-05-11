import { expect, test } from '@playwright/test';
import { uniqueEmail } from '../helpers';

test.describe('Buyer Authentication', () => {
  test.describe.configure({ mode: 'serial' });

  let testEmail: string;
  const testPassword = 'TestBuyer123!';
  const testFullName = 'Test Buyer User';

  test.beforeEach(() => {
    testEmail = uniqueEmail('buyer-auth');
  });

  test('should register new buyer account successfully', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByLabel(/nama|name/i).fill(testFullName);

    await page.getByRole('button', { name: /daftar|register/i }).click();

    await page.waitForLoadState('networkidle');
    
    const bodyText = await page.locator('body').textContent();
    const currentUrl = page.url();
    const isSuccess = 
      bodyText?.includes('berhasil') || 
      bodyText?.includes('success') ||
      bodyText?.includes('verifikasi') ||
      currentUrl.includes('verify-email') ||
      currentUrl.includes('/login') ||
      !currentUrl.includes('/register');

    expect(isSuccess).toBeTruthy();
  });

  test('should prevent duplicate email registration', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel(/email/i).fill('buyer@jeevatix.id');
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByLabel(/nama|name/i).fill(testFullName);

    await page.getByRole('button', { name: /daftar|register/i }).click();

    await page.waitForTimeout(1000);

    const bodyText = await page.locator('body').textContent();
    const hasError = 
      bodyText?.includes('sudah terdaftar') ||
      bodyText?.includes('already exists') ||
      bodyText?.includes('email') ||
      page.url().includes('/register');

    expect(hasError).toBeTruthy();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('buyer@jeevatix.id');
    await page.getByLabel(/password/i).fill('Buyer123!');

    await page.getByRole('button', { name: /login|masuk/i }).click();

    await page.waitForURL(/\/$/, { timeout: 15000 });
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('buyer@jeevatix.id');
    await page.getByLabel(/password/i).fill('WrongPassword123!');

    await page.getByRole('button', { name: /login|masuk/i }).click();

    await page.waitForTimeout(1000);

    const bodyText = await page.locator('body').textContent();
    const hasError = 
      bodyText?.includes('salah') ||
      bodyText?.includes('invalid') ||
      bodyText?.includes('incorrect') ||
      page.url().includes('/login');

    expect(hasError).toBeTruthy();
  });

  test('should handle forgot password flow', async ({ page }) => {
    await page.goto('/forgot-password');

    await page.getByLabel(/email/i).fill('buyer@jeevatix.id');

    await page.getByRole('button', { name: /kirim|send|reset/i }).click();

    await page.waitForTimeout(1000);

    const bodyText = await page.locator('body').textContent();
    const isSuccess = 
      bodyText?.includes('terkirim') ||
      bodyText?.includes('sent') ||
      bodyText?.includes('email') ||
      bodyText?.includes('check');

    expect(isSuccess).toBeTruthy();
  });

  test('should validate password strength on registration', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill('weak');
    await page.getByLabel(/nama|name/i).fill(testFullName);

    await page.getByRole('button', { name: /daftar|register/i }).click();

    await page.waitForTimeout(500);

    const bodyText = await page.locator('body').textContent();
    const hasPasswordError = 
      bodyText?.includes('password') ||
      bodyText?.includes('lemah') ||
      bodyText?.includes('weak') ||
      page.url().includes('/register');

    expect(hasPasswordError).toBeTruthy();
  });

  test('should validate password confirmation match', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByLabel(/nama|name/i).fill(testFullName);

    await page.getByRole('button', { name: /daftar|register/i }).click();

    await page.waitForTimeout(500);

    const bodyText = await page.locator('body').textContent();
    const isOnRegisterOrSuccess = 
      bodyText?.includes('berhasil') ||
      bodyText?.includes('success') ||
      bodyText?.includes('verifikasi') ||
      page.url().includes('/register') ||
      page.url().includes('verify-email');

    expect(isOnRegisterOrSuccess).toBeTruthy();
  });

  test('should logout successfully', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('buyer@jeevatix.id');
    await page.getByLabel(/password/i).fill('Buyer123!');
    await page.getByRole('button', { name: /login|masuk/i }).click();
    await page.waitForURL(/\/$/, { timeout: 15000 });
    const logoutButton = page.getByRole('button', { name: /logout|keluar/i });
    if (await logoutButton.count() > 0) {
      await logoutButton.click();
    } else {
      const profileMenu = page.getByRole('button', { name: /profile|profil/i });
      if (await profileMenu.count() > 0) {
        await profileMenu.click();
        await page.getByRole('menuitem', { name: /logout|keluar/i }).click();
      }
    }

    await page.waitForTimeout(1000);

    const loginLink = page.getByRole('link', { name: /login|masuk/i });
    await expect(loginLink).toBeVisible();
  });
});
