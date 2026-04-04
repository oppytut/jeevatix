import { expect, test } from '@playwright/test';

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  createSellerViaApi,
  ensureBaseFixtures,
  waitForPortal,
} from './helpers';

test.describe('Admin E2E Flow', () => {
  test.setTimeout(180_000);

  test('login, create category, verify seller, inspect dashboard, logout', async ({
    page,
    request,
  }) => {
    await ensureBaseFixtures();
    await waitForPortal(request, 'admin');

    const seller = await createSellerViaApi(request);
    const categoryName = `E2E Category ${Date.now()}`;

    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL(/localhost:4302\/$/);
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();

    await page.goto('/categories');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Tambah Kategori' }).click();
    await expect(page.locator('#category-name')).toBeVisible();
    await page.locator('#category-name').fill(categoryName);
    await page.locator('#category-icon').fill('sparkles');
    await page.getByRole('button', { name: 'Simpan Kategori' }).click();
    await expect(page.getByText(categoryName)).toBeVisible();

    await page.goto('/sellers');
    await expect(page.getByText(seller.orgName)).toBeVisible();
    await page.goto(`/sellers/${seller.userId}`);
    await expect(page.getByText('Detail seller')).toBeVisible();
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByText('Konfirmasi verifikasi seller')).toBeVisible();
    await page.getByRole('button', { name: 'Simpan Keputusan' }).click();
    await expect(page.getByText('Seller diverifikasi')).toBeVisible();
    await expect(page.getByText('Verified', { exact: true })).toBeVisible();

    await page.goto('/');
    await expect(page.getByText('Total User')).toBeVisible();
    await expect(page.getByText('Total Seller')).toBeVisible();
    await expect(page.getByText('Total Event')).toBeVisible();
    await expect(page.getByText('Total Revenue')).toBeVisible();

    await page.getByRole('button', { name: 'Logout' }).click();
    await page.context().clearCookies();
    const loginPage = await page.context().newPage();
    await loginPage.goto('http://localhost:4302/login');
    await expect(loginPage).toHaveURL(/localhost:4302\/login/);
    await expect(loginPage.getByRole('button', { name: 'Login' })).toBeVisible();
    await loginPage.close();
  });
});