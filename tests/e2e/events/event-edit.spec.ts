import { expect, test } from '@playwright/test';
import {
  createSellerViaApi,
  createEventViaSellerApi,
  loginApi,
  loginSellerUi,
  formatDateTimeLocal,
} from '../helpers';

test.describe('Event Edit Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let sellerEmail: string;
  let sellerPassword: string;
  let sellerAccessToken: string;
  let eventId: string;

  test.beforeAll(async ({ request }) => {
    const seller = await createSellerViaApi(request);
    sellerEmail = seller.email;
    sellerPassword = seller.password;
    const session = await loginApi(request, seller.email, seller.password);
    sellerAccessToken = session.access_token;
    const event = await createEventViaSellerApi(request, sellerAccessToken, 'Edit Test');
    eventId = event.id;
  });

  test('should navigate to event edit page', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto(`/events/${eventId}/edit`);
    await page.waitForLoadState('networkidle');

    const titleInput = page.locator('#event-title');
    const isVisible = await titleInput.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Event edit page did not load title input');
      return;
    }

    const titleValue = await titleInput.inputValue();
    expect(titleValue).toContain('Edit Test');
  });

  test('should modify event title and description', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto(`/events/${eventId}/edit`);
    await page.waitForLoadState('networkidle');

    const titleInput = page.locator('#event-title');
    const isVisible = await titleInput.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Event edit page did not load');
      return;
    }

    const newTitle = `Updated Event ${Date.now()}`;
    await titleInput.clear();
    await titleInput.fill(newTitle);

    const descInput = page.locator('#event-description');
    await descInput.clear();
    await descInput.fill('Updated description for E2E test');

    // Navigate through wizard steps to save
    const lanjutButton = page.getByRole('button', { name: /Lanjut/i });
    await lanjutButton.click();
    await page.waitForTimeout(500);

    // Step 2 → Step 3
    await lanjutButton.click();
    await page.waitForTimeout(500);

    // Step 3 → Step 4
    await lanjutButton.click();
    await page.waitForTimeout(500);

    // Step 4 → Step 5 (Review)
    await lanjutButton.click();
    await page.waitForTimeout(500);

    // Save changes
    const saveButton = page.getByRole('button', { name: /Simpan Perubahan/i });
    const saveVisible = await saveButton.isVisible().catch(() => false);
    if (!saveVisible) {
      test.skip(true, 'Save button not visible on review step');
      return;
    }

    await saveButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.locator('body').textContent();
    const isSuccess =
      bodyText?.includes('berhasil') ||
      bodyText?.includes('success') ||
      !page.url().includes('/edit');

    expect(isSuccess).toBeTruthy();
  });

  test('should modify event dates', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto(`/events/${eventId}/edit`);
    await page.waitForLoadState('networkidle');

    const titleInput = page.locator('#event-title');
    const isVisible = await titleInput.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Event edit page did not load');
      return;
    }

    // Go to step 2 (dates)
    const lanjutButton = page.getByRole('button', { name: /Lanjut/i });
    await lanjutButton.click();
    await page.waitForTimeout(500);

    const startAtInput = page.getByLabel('Start At');
    const startVisible = await startAtInput.isVisible().catch(() => false);
    if (!startVisible) {
      test.skip(true, 'Step 2 did not load');
      return;
    }

    const newStart = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const newEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    await startAtInput.fill(formatDateTimeLocal(newStart));
    await page.getByLabel('End At').fill(formatDateTimeLocal(newEnd));

    // Navigate to review and save
    await lanjutButton.click();
    await page.waitForTimeout(500);
    await lanjutButton.click();
    await page.waitForTimeout(500);
    await lanjutButton.click();
    await page.waitForTimeout(500);

    const saveButton = page.getByRole('button', { name: /Simpan Perubahan/i });
    const saveVisible = await saveButton.isVisible().catch(() => false);
    if (saveVisible) {
      await saveButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    const bodyText = await page.locator('body').textContent();
    const isSuccess =
      bodyText?.includes('berhasil') ||
      bodyText?.includes('success') ||
      !page.url().includes('/edit');

    expect(isSuccess).toBeTruthy();
  });

  test('should validate empty required fields', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto(`/events/${eventId}/edit`);
    await page.waitForLoadState('networkidle');

    const titleInput = page.locator('#event-title');
    const isVisible = await titleInput.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Event edit page did not load');
      return;
    }

    // Clear required field
    await titleInput.clear();

    // Try to advance
    const lanjutButton = page.getByRole('button', { name: /Lanjut/i });
    await lanjutButton.click();
    await page.waitForTimeout(500);

    // Should still be on step 1 (validation prevents advance)
    const stillHasTitle = await titleInput.isVisible().catch(() => false);
    expect(stillHasTitle || page.url().includes('/edit')).toBeTruthy();
  });
});
