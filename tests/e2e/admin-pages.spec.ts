import { test } from '@playwright/test';

import {
  createBuyerViaApi,
  createConfirmedOrderFixture,
  createEventViaSellerApi,
  createSellerViaApi,
  ensureBaseFixtures,
  gotoAndExpectDocument,
  loginAdminUi,
  loginApi,
  publishEventAsAdmin,
  waitForPortal,
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Admin Route Smoke Coverage', () => {
  let fixture: {
    buyer: Awaited<ReturnType<typeof createBuyerViaApi>>;
    seller: Awaited<ReturnType<typeof createSellerViaApi>>;
    event: Awaited<ReturnType<typeof createEventViaSellerApi>>;
    order: Awaited<ReturnType<typeof createConfirmedOrderFixture>>;
  };

  test.beforeAll(async ({ request }) => {
    await ensureBaseFixtures();
    await waitForPortal(request, 'admin');

    const seller = await createSellerViaApi(request);
    const sellerSession = await loginApi(request, seller.email, seller.password);
    const event = await createEventViaSellerApi(request, sellerSession.access_token, 'Admin Smoke');
    await publishEventAsAdmin(request, event.id);

    const buyer = await createBuyerViaApi(request);
    const order = await createConfirmedOrderFixture(
      request,
      event.id,
      sellerSession.access_token,
      buyer,
    );

    fixture = { buyer, seller, event, order };
  });

  test('loads /login', async ({ page }) => {
    await gotoAndExpectDocument(page, '/login', { expectedText: /login/i });
  });

  test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.title !== 'loads /login') {
      await loginAdminUi(page);
    }
  });

  test('loads /', async ({ page }) => {
    await gotoAndExpectDocument(page, '/', { expectedText: 'Admin Dashboard' });
  });

  test('loads /categories', async ({ page }) => {
    await gotoAndExpectDocument(page, '/categories');
  });

  test('loads /reservations', async ({ page }) => {
    await gotoAndExpectDocument(page, '/reservations');
  });

  test('loads /users', async ({ page }) => {
    await gotoAndExpectDocument(page, '/users');
  });

  test('loads /users/[id]', async ({ page }) => {
    await gotoAndExpectDocument(page, `/users/${fixture.buyer.userId}`, {
      expectedText: fixture.buyer.fullName,
    });
  });

  test('loads /sellers', async ({ page }) => {
    await gotoAndExpectDocument(page, '/sellers', { expectedText: fixture.seller.orgName });
  });

  test('loads /sellers/[id]', async ({ page }) => {
    await gotoAndExpectDocument(page, `/sellers/${fixture.seller.userId}`, {
      expectedText: fixture.seller.orgName,
    });
  });

  test('loads /events', async ({ page }) => {
    await gotoAndExpectDocument(page, '/events', { expectedText: fixture.event.title });
  });

  test('loads /events/[id]', async ({ page }) => {
    await gotoAndExpectDocument(page, `/events/${fixture.event.id}`, {
      expectedText: fixture.event.title,
    });
  });

  test('loads /orders', async ({ page }) => {
    await gotoAndExpectDocument(page, '/orders', { expectedText: fixture.order.order.order_number });
  });

  test('loads /orders/[id]', async ({ page }) => {
    await gotoAndExpectDocument(page, `/orders/${fixture.order.order.id}`, {
      expectedText: fixture.order.order.order_number,
    });
  });

  test('loads /payments', async ({ page }) => {
    await gotoAndExpectDocument(page, '/payments');
  });

  test('loads /payments/[id]', async ({ page }) => {
    await gotoAndExpectDocument(page, `/payments/${fixture.order.payment.payment_id}`);
  });

  test('loads /notifications', async ({ page }) => {
    await gotoAndExpectDocument(page, '/notifications');
  });
});