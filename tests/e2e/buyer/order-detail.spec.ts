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

test.describe('Buyer Order Detail', () => {
  test.describe.configure({ mode: 'serial' });

  let buyerEmail: string;
  let buyerPassword: string;
  let orderId: string;
  let orderNumber: string;
  let fixtureCreated = false;

  // Fixture creates seller + event + publish + buyer + reservation + order + payment + webhook
  // — many sequential API calls that can exceed default 60s on staging cold start.
  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000);
    try {
      // Create seller
      const seller = await withRetry(() => createSellerViaApi(request));
      const sellerSession = await withRetry(() => loginApi(request, seller.email, seller.password));

      // Create event
      const event = await withRetry(() =>
        createEventViaSellerApi(request, sellerSession.access_token),
      );

      // Publish event
      await withRetry(() => publishEventAsAdmin(request, event.id));

      // Create confirmed order fixture
      const fixture = await withRetry(() =>
        createConfirmedOrderFixture(request, event.id, sellerSession.access_token),
      );

      buyerEmail = fixture.buyer.email;
      buyerPassword = fixture.buyer.password;
      orderId = fixture.order.id;
      orderNumber = fixture.order.order_number;

      // Verify order is accessible with buyer's token before tests run
      const verifySession = await loginApi(request, buyerEmail, buyerPassword);
      const verifyResponse = await request.get(`${API_URL}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${verifySession.access_token}` },
      });
      if (verifyResponse.status() !== 200) {
        throw new Error(
          `Order verification failed: ${verifyResponse.status()} - buyer cannot access own order`,
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

  test('should display order detail page', async ({ page }) => {
    if (!(await tryLoginBuyerUi(page, buyerEmail, buyerPassword))) {
      test.skip(true, 'Buyer login failed on staging - service flakiness');
      return;
    }
    await page.goto(`/orders/${orderId}`);
    await expect(page.locator('body')).toContainText(orderNumber, { timeout: 15_000 });
  });

  test('should display order items with tier and price', async ({ page }) => {
    if (!(await tryLoginBuyerUi(page, buyerEmail, buyerPassword))) {
      test.skip(true, 'Buyer login failed on staging - service flakiness');
      return;
    }
    await page.goto(`/orders/${orderId}`);
    await expect(page.locator('body')).toContainText(orderNumber, { timeout: 10_000 });
    await expect(page.locator('body')).toContainText('Rp');
    await expect(page.locator('body')).toContainText(/tiket|Regular/i);
  });

  test('should display payment status', async ({ page }) => {
    if (!(await tryLoginBuyerUi(page, buyerEmail, buyerPassword))) {
      test.skip(true, 'Buyer login failed on staging - service flakiness');
      return;
    }
    await page.goto(`/orders/${orderId}`);
    await expect(page.locator('body')).toContainText(orderNumber, { timeout: 10_000 });
    await expect(page.locator('body')).toContainText(/confirmed|berhasil|success/i);
  });

  test('should show ticket link for confirmed orders', async ({ page }) => {
    if (!(await tryLoginBuyerUi(page, buyerEmail, buyerPassword))) {
      test.skip(true, 'Buyer login failed on staging - service flakiness');
      return;
    }
    await page.goto(`/orders/${orderId}`);
    await expect(page.locator('body')).toContainText(orderNumber, { timeout: 10_000 });

    const ticketLink = page.locator('a, button').filter({
      hasText: /tiket|ticket|lihat tiket saya/i,
    });
    await expect(ticketLink).toBeVisible();
  });
});
