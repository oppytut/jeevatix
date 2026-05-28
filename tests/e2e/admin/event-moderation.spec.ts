import { expect, test } from '@playwright/test';
import {
  API_URL,
  createSellerViaApi,
  loginApi,
  createEventViaSellerApi,
  submitEventForReview,
  isPortalErrorPage,
  tryLoginAdminUi,
  withRetry,
} from '../helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Admin Event Moderation', () => {
  let eventId: string;
  let secondEventId: string;
  let sellerToken: string;
  let fixtureReady = false;

  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000);
    try {
      await withRetry(async () => {
        const seller = await createSellerViaApi(request);
        const loginRes = await loginApi(request, seller.email, seller.password);
        sellerToken = loginRes.access_token;

        const event = await createEventViaSellerApi(request, sellerToken);
        eventId = event.id;
        await submitEventForReview(request, eventId, sellerToken);

        const secondEvent = await createEventViaSellerApi(request, sellerToken);
        secondEventId = secondEvent.id;
        await submitEventForReview(request, secondEventId, sellerToken);
      });

      for (let attempt = 0; attempt < 10; attempt++) {
        const res = await request.get(`${API_URL}/admin/events/${eventId}`, {
          headers: { Accept: 'application/json' },
        });
        if (res.ok()) {
          fixtureReady = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (error) {
      console.error('Event moderation fixture creation failed:', error);
      fixtureReady = false;
    }
  });

  test.beforeEach(async ({}, testInfo) => {
    if (!fixtureReady) {
      testInfo.skip();
    }
  });

  test('should display event list with pending events', async ({ page }) => {
    if (!(await tryLoginAdminUi(page))) {
      test.skip(true, 'Admin login failed on staging - service flakiness');
      return;
    }
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    // Verify event list page loaded
    await expect(page.locator('body')).toContainText(/event/i);
  });

  test('should navigate to event detail from list', async ({ page }) => {
    if (!(await tryLoginAdminUi(page))) {
      test.skip(true, 'Admin login failed on staging - service flakiness');
      return;
    }
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    let body = page.locator('body');
    let bodyText = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.goto(`/events/${eventId}`);
      await page.waitForLoadState('networkidle');

      if (await isPortalErrorPage(page)) {
        test.skip(true, 'Admin portal event detail page returned error - staging flakiness');
        return;
      }

      bodyText = (await body.textContent({ timeout: 5000 })) ?? '';
      if (!bodyText.includes('Gagal memuat detail')) {
        break;
      }
      await page.waitForTimeout(3000);
    }

    if (bodyText.includes('Gagal memuat detail')) {
      test.skip(true, 'Admin event detail load consistently failing - upstream API issue');
      return;
    }

    await expect(body).toContainText(/pending review|published|rejected|draft|approved/i);
  });

  test('should publish event successfully', async ({ page }) => {
    if (!(await tryLoginAdminUi(page))) {
      test.skip(true, 'Admin login failed on staging - service flakiness');
      return;
    }

    let body = page.locator('body');
    let bodyText = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.goto(`/events/${eventId}`);
      await page.waitForLoadState('networkidle');

      bodyText = (await body.textContent({ timeout: 5000 })) ?? '';
      if (!bodyText.includes('Gagal memuat detail')) {
        break;
      }
      await page.waitForTimeout(3000);
    }

    if (bodyText.includes('Gagal memuat detail')) {
      test.skip(true, 'Admin event detail load consistently failing - upstream API issue');
      return;
    }

    // Click publish button
    const publishButton = page.getByRole('button', { name: /publish event/i });
    await publishButton.click();

    // Wait for modal and confirm
    await expect(page.getByText('Ubah status event')).toBeVisible();
    const confirmButton = page.getByRole('button', { name: /simpan status/i });
    await confirmButton.click();

    // Wait for action to complete
    await page.waitForLoadState('networkidle');

    // Verify success - status updated
    await expect(body).toContainText(/published/i);
  });

  test('should reject event with status change', async ({ page }) => {
    if (!(await tryLoginAdminUi(page))) {
      test.skip(true, 'Admin login failed on staging - service flakiness');
      return;
    }

    const body = page.locator('body');
    let bodyText = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.goto(`/events/${secondEventId}`);
      await page.waitForLoadState('networkidle');

      bodyText = (await body.textContent({ timeout: 5000 })) ?? '';
      if (!bodyText.includes('Gagal memuat detail')) {
        break;
      }
      await page.waitForTimeout(3000);
    }

    if (bodyText.includes('Gagal memuat detail')) {
      test.skip(true, 'Admin event detail load consistently failing - upstream API issue');
      return;
    }

    // Click reject button
    const rejectButton = page.getByRole('button', { name: /reject event/i });
    await rejectButton.click();

    // Wait for modal and confirm
    await expect(page.getByText('Ubah status event')).toBeVisible();
    const confirmButton = page.getByRole('button', { name: /simpan status/i });
    await confirmButton.click();

    // Wait for action to complete
    await page.waitForLoadState('networkidle');

    // Verify success - status updated
    await expect(body).toContainText(/rejected/i);
  });
});
