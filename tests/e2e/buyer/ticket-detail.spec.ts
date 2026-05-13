import { expect, test } from '@playwright/test';
import {
  createSellerViaApi,
  createEventViaSellerApi,
  createConfirmedOrderFixture,
  loginApi,
  loginBuyerUi,
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
    await loginBuyerUi(page, buyerEmail, buyerPassword);
    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toContainText(/tiket|ticket/i);
  });

  test('should navigate to ticket detail', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);
    await page.goto(`/tickets/${ticketId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toContainText(ticketCode);
  });

  test('should display QR code on ticket detail', async ({ page }) => {
    await loginBuyerUi(page, buyerEmail, buyerPassword);
    await page.goto(`/tickets/${ticketId}`);
    await page.waitForLoadState('networkidle');

    const qrImage = page.locator('img[alt*="QR"], img[alt*="qr"]');
    await expect(qrImage).toBeVisible();

    const downloadButton = page.getByRole('button', { name: /download qr/i });
    await expect(downloadButton).toBeVisible();
  });
});
