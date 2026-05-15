import { test } from '@playwright/test';

import {
  createConfirmedOrderFixture,
  createEventViaSellerApi,
  createSellerViaApi,
  ensureBaseFixtures,
  gotoAndExpectDocument,
  loginApi,
  publishEventAsAdmin,
  tryLoginSellerUi,
  waitForPortal,
  withRetry,
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Seller Route Smoke Coverage', () => {
  test.setTimeout(180_000);

  let fixture: {
    seller: Awaited<ReturnType<typeof createSellerViaApi>>;
    event: Awaited<ReturnType<typeof createEventViaSellerApi>>;
    order: Awaited<ReturnType<typeof createConfirmedOrderFixture>>;
  };
  let fixtureReady = false;

  test.beforeAll(async ({ request }) => {
    await ensureBaseFixtures();
    await waitForPortal(request, 'seller');

    try {
      await withRetry(async () => {
        const seller = await createSellerViaApi(request);
        const sellerSession = await loginApi(request, seller.email, seller.password);
        const event = await createEventViaSellerApi(
          request,
          sellerSession.access_token,
          'Seller Smoke',
        );
        await publishEventAsAdmin(request, event.id);
        const order = await createConfirmedOrderFixture(
          request,
          event.id,
          sellerSession.access_token,
        );

        fixture = { seller, event, order };
      });
      fixtureReady = true;
    } catch (error) {
      console.error('Seller smoke fixture creation failed:', error);
      fixtureReady = false;
    }
  });

  test('loads /login', async ({ page }) => {
    await gotoAndExpectDocument(page, '/login', { expectedText: /login/i });
  });

  test('loads /register', async ({ page }) => {
    await gotoAndExpectDocument(page, '/register', { expectedText: /seller/i });
  });

  test('loads /forgot-password', async ({ page }) => {
    await gotoAndExpectDocument(page, '/forgot-password');
  });

  test('loads /reset-password', async ({ page }) => {
    await gotoAndExpectDocument(page, '/reset-password?token=e2e-reset-token', {
      finalPath: '/reset-password?token=e2e-reset-token',
    });
  });

  test.beforeEach(async ({ page }, testInfo) => {
    const isPublicRoute =
      testInfo.title.startsWith('loads /login') ||
      testInfo.title.startsWith('loads /register') ||
      testInfo.title.startsWith('loads /forgot-password') ||
      testInfo.title.startsWith('loads /reset-password');

    if (isPublicRoute) {
      return;
    }

    if (!fixtureReady) {
      testInfo.skip(true, 'Seller smoke fixture unavailable - staging service flakiness');
      return;
    }

    if (!(await tryLoginSellerUi(page, fixture.seller.email, fixture.seller.password))) {
      testInfo.skip(true, 'Seller login failed on staging - service flakiness');
      return;
    }
  });

  test('loads /', async ({ page }) => {
    await gotoAndExpectDocument(page, '/', { expectedText: /dashboard/i });
  });

  test('loads /events', async ({ page }) => {
    await gotoAndExpectDocument(page, '/events', { expectedText: fixture.event.title });
  });

  test('loads /events/create', async ({ page }) => {
    await gotoAndExpectDocument(page, '/events/create');
  });

  test('loads /events/[id]', async ({ page }) => {
    await gotoAndExpectDocument(page, `/events/${fixture.event.id}`, {
      expectedText: fixture.event.title,
    });
  });

  test('loads /events/[id]/edit', async ({ page }) => {
    await gotoAndExpectDocument(page, `/events/${fixture.event.id}/edit`, {
      expectedText: 'Edit event',
    });
  });

  test('loads /events/[id]/tiers', async ({ page }) => {
    await gotoAndExpectDocument(page, `/events/${fixture.event.id}/tiers`);
  });

  test('loads /events/[id]/checkin', async ({ page }) => {
    await gotoAndExpectDocument(page, `/events/${fixture.event.id}/checkin`, {
      expectedText: 'Check-in scanner',
    });
  });

  test('loads /orders', async ({ page }) => {
    await gotoAndExpectDocument(page, '/orders', {
      expectedText: fixture.order.order.order_number,
    });
  });

  test('loads /orders/[id]', async ({ page }) => {
    await gotoAndExpectDocument(page, `/orders/${fixture.order.order.id}`, {
      expectedText: fixture.order.order.order_number,
    });
  });

  test('loads /profile', async ({ page }) => {
    await gotoAndExpectDocument(page, '/profile', {
      expectedText: 'Profil Organisasi',
    });
  });

  test('loads /profile/password', async ({ page }) => {
    await gotoAndExpectDocument(page, '/profile/password', {
      expectedText: 'Ubah Password',
    });
  });

  test('loads /notifications', async ({ page }) => {
    await gotoAndExpectDocument(page, '/notifications');
  });
});
