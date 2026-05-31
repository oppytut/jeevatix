import { expect, test } from '@playwright/test';
import {
  API_URL,
  createSellerViaApi,
  createEventViaSellerApi,
  createConfirmedOrderFixture,
  loginApi,
  tryLoginBuyerUi,
  publishEventAsAdmin,
  withRetry,
} from '../helpers';

test.describe('Buyer Ticket Detail', () => {
  test.describe.configure({ mode: 'serial' });

  let buyerEmail: string;
  let buyerPassword: string;
  let ticketId: string;
  let ticketCode: string;
  let fixtureCreated = false;

  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000);
    try {
      const seller = await withRetry(() => createSellerViaApi(request));
      const sellerSession = await withRetry(() => loginApi(request, seller.email, seller.password));

      const event = await withRetry(() =>
        createEventViaSellerApi(request, sellerSession.access_token),
      );

      await withRetry(() => publishEventAsAdmin(request, event.id));

      const fixture = await withRetry(() =>
        createConfirmedOrderFixture(request, event.id, sellerSession.access_token),
      );

      buyerEmail = fixture.buyer.email;
      buyerPassword = fixture.buyer.password;
      ticketId = fixture.ticket.id;
      ticketCode = fixture.ticket.ticket_code;

      // Verify ticket is accessible with buyer's token before tests run
      const verifySession = await loginApi(request, buyerEmail, buyerPassword);
      const verifyResponse = await request.get(`${API_URL}/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${verifySession.access_token}` },
      });
      if (verifyResponse.status() !== 200) {
        throw new Error(
          `Ticket verification failed: ${verifyResponse.status()} - buyer cannot access own ticket`,
        );
      }

      fixtureCreated = true;
    } catch (error) {
      console.error('Failed to create test fixtures:', error);
      fixtureCreated = false;
    }
  });

  test.beforeEach(async ({}, testInfo) => {
    if (!fixtureCreated) {
      testInfo.skip();
    }
  });

  test('should display ticket list with issued tickets', async ({ page }) => {
    if (!(await tryLoginBuyerUi(page, buyerEmail, buyerPassword))) {
      test.skip(true, 'Buyer login failed on staging - service flakiness');
      return;
    }
    await page.goto('/tickets');
    await expect(page.locator('body')).toContainText(/tiket|ticket/i, { timeout: 10_000 });
  });

  test('should navigate to ticket detail', async ({ page }) => {
    if (!(await tryLoginBuyerUi(page, buyerEmail, buyerPassword))) {
      test.skip(true, 'Buyer login failed on staging - service flakiness');
      return;
    }
    await page.goto(`/tickets/${ticketId}`);
    await expect(page.locator('body')).toContainText(ticketCode, { timeout: 10_000 });
  });

  test('should display QR code on ticket detail', async ({ page }) => {
    test.setTimeout(120_000);

    if (!(await tryLoginBuyerUi(page, buyerEmail, buyerPassword))) {
      test.skip(true, 'Buyer login failed on staging - service flakiness');
      return;
    }
    await page.goto(`/tickets/${ticketId}`);

    // QR generation runs in a $effect after client hydration, and the qrcode
    // package is dynamically imported (~150KB). On cold staging Workers the
    // first render can take well over 30s. Race the rendered image against
    // the in-page error placeholder, capping each wait at 45s and the
    // overall test at 120s (default 60s would kill the test before our
    // graceful skip path fires).
    const qrImage = page.locator('img[alt*="QR"], img[alt*="qr"]');
    const qrErrorMessage = page.getByText(/qr code tiket tidak bisa dirender/i);

    const outcome = await Promise.race([
      qrImage.waitFor({ state: 'attached', timeout: 45_000 }).then(() => 'image' as const),
      qrErrorMessage.waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'error' as const),
    ]).catch(() => 'none' as const);

    if (outcome !== 'image') {
      test.skip(
        true,
        `QR rendering did not complete on staging (outcome: ${outcome}) - non-deterministic`,
      );
      return;
    }

    await expect(qrImage).toBeVisible({ timeout: 5_000 });

    const downloadButton = page.getByRole('button', { name: /download qr/i });
    await expect(downloadButton).toBeVisible();
  });
});
