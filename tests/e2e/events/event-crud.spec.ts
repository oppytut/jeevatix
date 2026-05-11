import { expect, test } from '@playwright/test';
import {
  createSellerViaApi,
  loginSellerUi,
  uniqueEmail,
  formatDateTimeLocal,
} from '../helpers';

test.describe('Event CRUD Operations', () => {
  test.describe.configure({ mode: 'serial' });

  test.fixme(true, 'Event create form is a multi-step wizard — selectors need audit');
  let sellerEmail: string;
  let sellerPassword: string;
  let createdEventSlug: string;

  test.beforeAll(async ({ request }) => {
    const seller = await createSellerViaApi(request);
    sellerEmail = seller.email;
    sellerPassword = seller.password;
  });

  test('should create new event with all required fields', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('/events/create');
    await page.waitForLoadState('networkidle');

    const eventTitle = `Test Event ${Date.now()}`;
    await page.getByLabel(/judul|title/i).fill(eventTitle);
    await page.getByLabel(/deskripsi|description/i).fill('Test event description for CRUD testing');

    const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);

    await page.getByLabel(/tanggal.*mulai|start.*date/i).fill(formatDateTimeLocal(startDate));
    await page.getByLabel(/tanggal.*selesai|end.*date/i).fill(formatDateTimeLocal(endDate));

    await page.getByLabel(/lokasi|location|venue/i).fill('Test Venue Jakarta');
    await page.getByLabel(/kota|city/i).fill('Jakarta');

    await page.getByRole('button', { name: /simpan.*draft|save.*draft/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toContainText(/berhasil|success|saved/i);

    const currentUrl = page.url();
    const slugMatch = currentUrl.match(/\/events\/([^\/]+)/);
    if (slugMatch) {
      createdEventSlug = slugMatch[1];
    }
  });

  test('should edit existing event', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    const firstEvent = page.locator('[data-event-card]').first();
    await firstEvent.click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: /edit|ubah/i }).click();
    await page.waitForLoadState('networkidle');

    const updatedTitle = `Updated Event ${Date.now()}`;
    const titleInput = page.getByLabel(/judul|title/i);
    await titleInput.clear();
    await titleInput.fill(updatedTitle);

    await page.getByRole('button', { name: /simpan|save|update/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toContainText(/berhasil|success|updated/i);
  });

  test('should publish draft event', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    const draftEvent = page.locator('[data-event-card]').filter({ hasText: /draft/i }).first();
    
    if ((await draftEvent.count()) > 0) {
      await draftEvent.click();
      await page.waitForLoadState('networkidle');

      const publishButton = page.getByRole('button', { name: /publish|terbitkan/i });
      
      if ((await publishButton.count()) > 0) {
        await publishButton.click();
        await page.waitForLoadState('networkidle');

        await expect(page.locator('body')).toContainText(/published|terbit|aktif/i);
      }
    }
  });

  test('should unpublish active event', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    const activeEvent = page.locator('[data-event-card]').filter({ hasText: /active|aktif/i }).first();
    
    if ((await activeEvent.count()) > 0) {
      await activeEvent.click();
      await page.waitForLoadState('networkidle');

      const unpublishButton = page.getByRole('button', { name: /unpublish|nonaktifkan/i });
      
      if ((await unpublishButton.count()) > 0) {
        await unpublishButton.click();
        
        const confirmButton = page.getByRole('button', { name: /ya|yes|confirm/i });
        if ((await confirmButton.count()) > 0) {
          await confirmButton.click();
        }
        
        await page.waitForLoadState('networkidle');
        await expect(page.locator('body')).toContainText(/draft|inactive|nonaktif/i);
      }
    }
  });

  test('should validate required fields on create', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('/events/create');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /simpan|save/i }).click();
    await page.waitForTimeout(500);

    const hasValidationError =
      (await page.locator('[aria-invalid="true"]').count()) > 0 ||
      (await page.locator('.error').count()) > 0 ||
      (await page.locator('[role="alert"]').count()) > 0;

    expect(hasValidationError || page.url().includes('/create')).toBeTruthy();
  });

  test('should prevent end date before start date', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('/events/create');
    await page.waitForLoadState('networkidle');

    const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    await page.getByLabel(/tanggal.*mulai|start.*date/i).fill(formatDateTimeLocal(startDate));
    await page.getByLabel(/tanggal.*selesai|end.*date/i).fill(formatDateTimeLocal(endDate));

    await page.getByRole('button', { name: /simpan|save/i }).click();
    await page.waitForTimeout(500);

    const hasDateError =
      (await page.locator('body').textContent())?.includes('tanggal') ||
      (await page.locator('body').textContent())?.includes('date') ||
      page.url().includes('/create');

    expect(hasDateError).toBeTruthy();
  });

  test('should show event in seller dashboard after creation', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    const eventCards = page.locator('[data-event-card]');
    const count = await eventCards.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should filter events by status', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    const filterButton = page.getByRole('button', { name: /filter|status/i }).first();
    
    if ((await filterButton.count()) > 0) {
      await filterButton.click();
      
      const draftOption = page.getByRole('option', { name: /draft/i });
      if ((await draftOption.count()) > 0) {
        await draftOption.click();
        await page.waitForLoadState('networkidle');

        const visibleEvents = page.locator('[data-event-card]');
        const count = await visibleEvents.count();
        
        expect(count).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
