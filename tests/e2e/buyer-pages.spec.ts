import { test } from '@playwright/test';

import {
  createBuyerViaApi,
  createConfirmedOrderFixture,
  createPendingOrderFixture,
  createPublishedEventFixture,
  ensureBaseFixtures,
  gotoAndExpectDocument,
  listCategories,
  loginBuyerUi,
  waitForPortal,
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Buyer Route Smoke Coverage', () => {
  let fixture: {
    buyer: Awaited<ReturnType<typeof createBuyerViaApi>>;
    eventFixture: Awaited<ReturnType<typeof createPublishedEventFixture>>;
    category: Awaited<ReturnType<typeof listCategories>>[number];
    pendingOrder: Awaited<ReturnType<typeof createPendingOrderFixture>>;
    confirmedOrder: Awaited<ReturnType<typeof createConfirmedOrderFixture>>;
  };

  test.beforeAll(async ({ request }) => {
    await ensureBaseFixtures();
    await waitForPortal(request, 'buyer');

    const eventFixture = await createPublishedEventFixture(request);
    const buyer = await createBuyerViaApi(request);
    const categories = await listCategories(request);
    const pendingOrder = await createPendingOrderFixture(
      request,
      eventFixture.event.id,
      eventFixture.sellerSession.access_token,
      buyer,
    );
    const confirmedOrder = await createConfirmedOrderFixture(
      request,
      eventFixture.event.id,
      eventFixture.sellerSession.access_token,
      buyer,
    );

    fixture = {
      buyer,
      eventFixture,
      category: categories[0]!,
      pendingOrder,
      confirmedOrder,
    };
  });

  test('loads /', async ({ page }) => {
    await gotoAndExpectDocument(page, '/', { expectedText: /upcoming picks/i });
  });

  test('loads /events', async ({ page }) => {
    await gotoAndExpectDocument(page, '/events');
  });

  test('loads /events/[slug]', async ({ page }) => {
    await gotoAndExpectDocument(page, `/events/${fixture.eventFixture.event.slug}`, {
      expectedText: fixture.eventFixture.event.title,
    });
  });

  test('loads /categories/[slug]', async ({ page }) => {
    await gotoAndExpectDocument(page, `/categories/${fixture.category.slug}`);
  });

  test('loads /login', async ({ page }) => {
    await gotoAndExpectDocument(page, '/login', { expectedText: /login/i });
  });

  test('loads /register', async ({ page }) => {
    await gotoAndExpectDocument(page, '/register', { expectedText: /daftar/i });
  });

  test('loads /forgot-password', async ({ page }) => {
    await gotoAndExpectDocument(page, '/forgot-password');
  });

  test('loads /reset-password', async ({ page }) => {
    await gotoAndExpectDocument(page, '/reset-password?token=e2e-reset-token', {
      finalPath: '/reset-password?token=e2e-reset-token',
    });
  });

  test('loads /verify-email', async ({ page }) => {
    await gotoAndExpectDocument(page, '/verify-email?token=e2e-verify-token', {
      finalPath: '/verify-email?token=e2e-verify-token',
    });
  });

  test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.title.startsWith('loads /profile') || testInfo.title.startsWith('loads /notifications') || testInfo.title.startsWith('loads /checkout') || testInfo.title.startsWith('loads /orders') || testInfo.title.startsWith('loads /payment') || testInfo.title.startsWith('loads /tickets')) {
      await loginBuyerUi(page, fixture.buyer.email, fixture.buyer.password);
    }
  });

  test('loads /profile', async ({ page }) => {
    await gotoAndExpectDocument(page, '/profile', { expectedText: fixture.buyer.fullName });
  });

  test('loads /notifications', async ({ page }) => {
    await gotoAndExpectDocument(page, '/notifications', { expectedText: /buyer/i });
  });

  test('loads /checkout/[slug]', async ({ page }) => {
    await gotoAndExpectDocument(page, `/checkout/${fixture.eventFixture.event.slug}`, {
      expectedText: fixture.eventFixture.event.title,
    });
  });

  test('loads /orders', async ({ page }) => {
    await gotoAndExpectDocument(page, '/orders', {
      expectedText: fixture.confirmedOrder.order.order_number,
    });
  });

  test('loads /orders/[id]', async ({ page }) => {
    await gotoAndExpectDocument(page, `/orders/${fixture.confirmedOrder.order.id}`, {
      expectedText: fixture.confirmedOrder.order.order_number,
    });
  });

  test('loads /payment/[orderId]', async ({ page }) => {
    await gotoAndExpectDocument(page, `/payment/${fixture.pendingOrder.order.id}`, {
      expectedText: fixture.pendingOrder.order.order_number,
    });
  });

  test('loads /tickets', async ({ page }) => {
    await gotoAndExpectDocument(page, '/tickets', {
      expectedText: fixture.eventFixture.event.title,
    });
  });

  test('loads /tickets/[id]', async ({ page }) => {
    await gotoAndExpectDocument(page, `/tickets/${fixture.confirmedOrder.ticket.id}`, {
      expectedText: fixture.confirmedOrder.ticket.ticket_code,
    });
  });
});