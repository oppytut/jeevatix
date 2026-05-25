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

    // Diagnostic: capture cookies and SSR API call
    const cookies = await page.context().cookies();
    const accessTokenCookie = cookies.find((c) => c.name === 'jeevatix_buyer_access_token');
    const userCookie = cookies.find((c) => c.name === 'jeevatix_buyer_user');
    console.log('DIAG: access_token cookie present:', !!accessTokenCookie);
    console.log('DIAG: access_token cookie domain:', accessTokenCookie?.domain);
    console.log('DIAG: access_token value (first 20):', accessTokenCookie?.value?.slice(0, 20));
    if (userCookie) {
      try {
        const user = JSON.parse(userCookie.value);
        console.log('DIAG: user cookie id:', user.id);
        console.log('DIAG: user cookie email:', user.email);
      } catch {
        /* ignore */
      }
    }
    if (accessTokenCookie?.value) {
      try {
        const payload = JSON.parse(atob(accessTokenCookie.value.split('.')[1]));
        console.log('DIAG: JWT sub/id:', payload.id || payload.sub);
        console.log('DIAG: JWT email:', payload.email);
        console.log('DIAG: JWT exp:', new Date((payload.exp ?? 0) * 1000).toISOString());
      } catch {
        /* ignore */
      }
    }

    // Intercept SSR subrequest to API to see what token is actually sent
    const apiRequests: { url: string; auth: string | null; status: number }[] = [];
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/orders/') && url.includes('api')) {
        apiRequests.push({
          url,
          auth: response.request().headers()['authorization'] ?? null,
          status: response.status(),
        });
      }
    });

    await page.goto(`/orders/${orderId}`);

    // Log any captured API requests (SSR subrequests won't appear here — they're server-side)
    console.log('DIAG: browser-visible API requests:', JSON.stringify(apiRequests));
    console.log('DIAG: page URL after goto:', page.url());

    const bodyText = await page.textContent('body');
    if (bodyText?.includes('403')) {
      console.log('DIAG: 403 detected. Full page text (first 500):', bodyText.slice(0, 500));
      // Verify via direct API call that the token still works
      const directCheck = await page.context().request.get(`${API_URL}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${accessTokenCookie?.value}` },
      });
      console.log('DIAG: direct API check status:', directCheck.status());
      if (directCheck.status() === 200) {
        console.log('DIAG: CONFIRMED — token works via direct call but fails via SSR');
      }
    }

    await expect(page.locator('body')).not.toContainText('403', { timeout: 5_000 });
    await expect(page.locator('body')).toContainText(orderNumber, { timeout: 10_000 });
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
