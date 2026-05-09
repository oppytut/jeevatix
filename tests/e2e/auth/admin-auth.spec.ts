import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../helpers';

test.describe('Admin Authentication', () => {
  test('should login with valid admin credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Login' }).click();
    
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('body')).toContainText(/dashboard|admin/i);
  });

  test('should reject non-admin user login', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel('Email').fill('buyer@jeevatix.id');
    await page.getByLabel('Password').fill('Buyer123!');
    await page.getByRole('button', { name: 'Login' }).click();
    
    await page.waitForTimeout(1000);
    
    const isStillOnLogin = page.url().includes('/login');
    const hasError = (await page.locator('text=/tidak.*diizinkan|not.*authorized|admin.*only/i').count()) > 0;
    
    expect(isStillOnLogin || hasError).toBeTruthy();
  });

  test('should enforce admin-only routes', async ({ page, context }) => {
    await context.clearCookies();
    
    await page.goto('/users');
    
    await page.waitForLoadState('networkidle');
    
    const isRedirectedToLogin = page.url().includes('/login');
    expect(isRedirectedToLogin).toBeTruthy();
  });

  test('should logout admin successfully', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/$/);
    
    const logoutButton = page.getByRole('button', { name: /logout|keluar/i });
    if ((await logoutButton.count()) > 0) {
      await logoutButton.click();
      await page.waitForTimeout(500);
      
      const isLoggedOut = page.url().includes('/login') || 
                         (await page.getByRole('link', { name: /login/i }).count()) > 0;
      expect(isLoggedOut).toBeTruthy();
    }
  });
});
