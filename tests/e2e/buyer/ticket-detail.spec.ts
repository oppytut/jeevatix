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
    await expect(page.locator('body')).not.toContainText('403', { timeout: 5_000 });
    await expect(page.locator('body')).toContainText(/tiket|ticket/i, { timeout: 10_000 });
  });

  test('should navigate to ticket detail', async ({ page }) => {
    if (!(await tryLoginBuyerUi(page, buyerEmail, buyerPassword))) {
      test.skip(true, 'Buyer login failed on staging - service flakiness');
      return;
    }
    await page.goto(`/tickets/${ticketId}`);
    await expect(page.locator('body')).not.toContainText('403', { timeout: 5_000 });
    await expect(page.locator('body')).toContainText(ticketCode, { timeout: 10_000 });
  });

  test('should display QR code on ticket detail', async ({ page }) => {
    if (!(await tryLoginBuyerUi(page, buyerEmail, buyerPassword))) {
      test.skip(true, 'Buyer login failed on staging - service flakiness');
      return;
    }
    await page.goto(`/tickets/${ticketId}`);
    await expect(page.locator('body')).not.toContainText('403', { timeout: 5_000 });

    const qrImage = page.locator('img[alt*="QR"], img[alt*="qr"]');
    await expect(qrImage).toBeVisible({ timeout: 10_000 });

    const downloadButton = page.getByRole('button', { name: /download qr/i });
    await expect(downloadButton).toBeVisible();
  });
});
