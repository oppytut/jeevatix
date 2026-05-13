import { expect, test } from '@playwright/test';
import { loginBuyerUi, createBuyerViaApi, listCategories, withRetry } from '../helpers';

test.describe('Buyer Category Browse', () => {
  test('should display category page with events', async ({ page, request }) => {
    const buyer = await withRetry(() => createBuyerViaApi(request));
    await loginBuyerUi(page, buyer.email, buyer.password);

    const categories = await withRetry(() => listCategories(request));
    expect(categories.length).toBeGreaterThan(0);

    await page.goto(`/categories/${categories[0].slug}`);
    await page.waitForLoadState('networkidle');

    const hasSpotlight = await page.locator('text=/category spotlight/i').count();
    const hasCategoryName = await page.locator(`text=${categories[0].name}`).count();

    expect(hasSpotlight + hasCategoryName).toBeGreaterThan(0);
  });

  test('should show empty state for category with no events', async ({ page, request }) => {
    const buyer = await withRetry(() => createBuyerViaApi(request));
    await loginBuyerUi(page, buyer.email, buyer.password);

    await page.goto('/categories/nonexistent-category-slug-xyz');
    await page.waitForLoadState('networkidle');

    const hasError =
      (await page.locator('text=/error|tidak ditemukan|not found|404/i').count()) > 0 ||
      (await page.locator('text=/empty|no events|kosong|belum ada/i').count()) > 0;

    expect(hasError).toBe(true);
  });

  test('should display category filter pills', async ({ page, request }) => {
    const buyer = await withRetry(() => createBuyerViaApi(request));
    await loginBuyerUi(page, buyer.email, buyer.password);

    const categories = await withRetry(() => listCategories(request));
    expect(categories.length).toBeGreaterThan(0);

    await page.goto(`/categories/${categories[0].slug}`);
    await page.waitForLoadState('networkidle');

    const pills = await page.locator('a.rounded-full, button.rounded-full').count();
    expect(pills).toBeGreaterThan(0);
  });
});
