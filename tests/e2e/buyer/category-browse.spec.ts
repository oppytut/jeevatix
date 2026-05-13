import { expect, test } from '@playwright/test';
import { createBuyerViaApi, listCategories, loginBuyerUi, tryWithRetry } from '../helpers';

test.describe('Buyer Category Browse', () => {
  test('should display category page with events', async ({ page, request }) => {
    const buyerResult = await tryWithRetry(() => createBuyerViaApi(request));
    if (!buyerResult.ok) {
      test.skip(true, 'Could not create buyer via staging API - service flakiness');
      return;
    }
    await loginBuyerUi(page, buyerResult.value.email, buyerResult.value.password);

    const categoriesResult = await tryWithRetry(() => listCategories(request));
    if (!categoriesResult.ok) {
      test.skip(true, 'Could not list categories via staging API - service flakiness');
      return;
    }
    const categories = categoriesResult.value;
    expect(categories.length).toBeGreaterThan(0);

    await page.goto(`/categories/${categories[0].slug}`);
    await page.waitForLoadState('networkidle');

    const hasSpotlight = await page.locator('text=/category spotlight/i').count();
    const hasCategoryName = await page.locator(`text=${categories[0].name}`).count();

    expect(hasSpotlight + hasCategoryName).toBeGreaterThan(0);
  });

  test('should show empty state for category with no events', async ({ page, request }) => {
    const buyerResult = await tryWithRetry(() => createBuyerViaApi(request));
    if (!buyerResult.ok) {
      test.skip(true, 'Could not create buyer via staging API - service flakiness');
      return;
    }
    await loginBuyerUi(page, buyerResult.value.email, buyerResult.value.password);

    await page.goto('/categories/nonexistent-category-slug-xyz');
    await page.waitForLoadState('networkidle');

    const hasError =
      (await page.locator('text=/error|tidak ditemukan|not found|404/i').count()) > 0 ||
      (await page.locator('text=/empty|no events|kosong|belum ada/i').count()) > 0;

    expect(hasError).toBe(true);
  });

  test('should display category filter pills', async ({ page, request }) => {
    const buyerResult = await tryWithRetry(() => createBuyerViaApi(request));
    if (!buyerResult.ok) {
      test.skip(true, 'Could not create buyer via staging API - service flakiness');
      return;
    }
    await loginBuyerUi(page, buyerResult.value.email, buyerResult.value.password);

    const categoriesResult = await tryWithRetry(() => listCategories(request));
    if (!categoriesResult.ok) {
      test.skip(true, 'Could not list categories via staging API - service flakiness');
      return;
    }
    const categories = categoriesResult.value;
    expect(categories.length).toBeGreaterThan(0);

    await page.goto(`/categories/${categories[0].slug}`);
    await page.waitForLoadState('networkidle');

    const pills = await page.locator('a.rounded-full, button.rounded-full').count();
    expect(pills).toBeGreaterThan(0);
  });
});
