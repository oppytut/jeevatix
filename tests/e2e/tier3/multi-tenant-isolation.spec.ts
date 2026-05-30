import { expect, test } from '@playwright/test';

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  API_URL,
  createBuyerWithSession,
  createConfirmedOrderFixture,
  createEventViaSellerApi,
  createPublishedEventFixture,
  createSellerViaApi,
  loginApi,
  withRetry,
} from '../helpers';

test.describe('Tier 3 — multi-tenant isolation across roles', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);

  test("seller A cannot read seller B's draft event via /seller/events/:id", async ({
    request,
  }) => {
    const sellerA = await withRetry(() => createSellerViaApi(request));
    const sellerASession = await withRetry(() =>
      loginApi(request, sellerA.email, sellerA.password),
    );
    const sellerAEvent = await withRetry(() =>
      createEventViaSellerApi(request, sellerASession.access_token, 'Tier3 Seller A Private'),
    );

    const sellerB = await withRetry(() => createSellerViaApi(request));
    const sellerBSession = await withRetry(() =>
      loginApi(request, sellerB.email, sellerB.password),
    );

    const crossReadResponse = await request.get(`${API_URL}/seller/events/${sellerAEvent.id}`, {
      headers: {
        Authorization: `Bearer ${sellerBSession.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(crossReadResponse.ok()).toBe(false);
    expect([403, 404]).toContain(crossReadResponse.status());

    const crossEditResponse = await request.patch(`${API_URL}/seller/events/${sellerAEvent.id}`, {
      headers: {
        Authorization: `Bearer ${sellerBSession.access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: { title: 'Hijacked by Seller B' },
    });
    expect(crossEditResponse.ok()).toBe(false);
    expect([403, 404]).toContain(crossEditResponse.status());

    const ownerReadResponse = await request.get(`${API_URL}/seller/events/${sellerAEvent.id}`, {
      headers: {
        Authorization: `Bearer ${sellerASession.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(ownerReadResponse.ok()).toBeTruthy();
  });

  test("seller A cannot read seller B's order via /seller/orders/:id", async ({ request }) => {
    const eventFixture = await withRetry(() => createPublishedEventFixture(request));
    const orderFixture = await withRetry(() =>
      createConfirmedOrderFixture(
        request,
        eventFixture.event.id,
        eventFixture.sellerSession.access_token,
      ),
    );

    const ownerListResponse = await request.get(`${API_URL}/seller/orders?page=1&limit=20`, {
      headers: {
        Authorization: `Bearer ${eventFixture.sellerSession.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(ownerListResponse.ok()).toBeTruthy();

    const otherSeller = await withRetry(() => createSellerViaApi(request));
    const otherSellerSession = await withRetry(() =>
      loginApi(request, otherSeller.email, otherSeller.password),
    );

    const otherSellerDetailResponse = await request.get(
      `${API_URL}/seller/orders/${orderFixture.order.id}`,
      {
        headers: {
          Authorization: `Bearer ${otherSellerSession.access_token}`,
          Accept: 'application/json',
        },
      },
    );
    expect(otherSellerDetailResponse.ok()).toBe(false);
    expect([403, 404]).toContain(otherSellerDetailResponse.status());

    const otherSellerListResponse = await request.get(`${API_URL}/seller/orders?page=1&limit=50`, {
      headers: {
        Authorization: `Bearer ${otherSellerSession.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(otherSellerListResponse.ok()).toBeTruthy();
    const otherSellerListBody = await otherSellerListResponse.json();
    const orderIds = (otherSellerListBody.data as Array<{ id: string }>).map((o) => o.id);
    expect(orderIds).not.toContain(orderFixture.order.id);
  });

  test("buyer cannot read another buyer's order detail", async ({ request }) => {
    const eventFixture = await withRetry(() => createPublishedEventFixture(request));
    const orderFixture = await withRetry(() =>
      createConfirmedOrderFixture(
        request,
        eventFixture.event.id,
        eventFixture.sellerSession.access_token,
      ),
    );

    const stranger = await createBuyerWithSession(request);
    const strangerResponse = await request.get(`${API_URL}/orders/${orderFixture.order.id}`, {
      headers: {
        Authorization: `Bearer ${stranger.session.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(strangerResponse.ok()).toBe(false);
    expect([403, 404]).toContain(strangerResponse.status());

    const ownerResponse = await request.get(`${API_URL}/orders/${orderFixture.order.id}`, {
      headers: {
        Authorization: `Bearer ${orderFixture.buyerSession.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(ownerResponse.ok()).toBeTruthy();
  });

  test('buyer cannot access admin routes; seller cannot access buyer-only routes', async ({
    request,
  }) => {
    const buyer = await createBuyerWithSession(request);
    const buyerToAdmin = await request.get(`${API_URL}/admin/events?page=1&limit=10`, {
      headers: {
        Authorization: `Bearer ${buyer.session.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(buyerToAdmin.ok()).toBe(false);
    expect([401, 403]).toContain(buyerToAdmin.status());

    const buyerToSellerOrders = await request.get(`${API_URL}/seller/orders`, {
      headers: {
        Authorization: `Bearer ${buyer.session.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(buyerToSellerOrders.ok()).toBe(false);
    expect([401, 403]).toContain(buyerToSellerOrders.status());

    const seller = await withRetry(() => createSellerViaApi(request));
    const sellerSession = await withRetry(() => loginApi(request, seller.email, seller.password));
    const sellerToOrders = await request.get(`${API_URL}/orders`, {
      headers: {
        Authorization: `Bearer ${sellerSession.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(sellerToOrders.ok()).toBe(false);
    expect([401, 403]).toContain(sellerToOrders.status());

    const sellerToAdmin = await request.get(`${API_URL}/admin/users`, {
      headers: {
        Authorization: `Bearer ${sellerSession.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(sellerToAdmin.ok()).toBe(false);
    expect([401, 403]).toContain(sellerToAdmin.status());

    const adminSession = await withRetry(() => loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD));
    const adminToAdmin = await request.get(`${API_URL}/admin/events?page=1&limit=5`, {
      headers: {
        Authorization: `Bearer ${adminSession.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(adminToAdmin.ok()).toBeTruthy();
  });

  test('unauthenticated requests to scoped routes return 401', async ({ request }) => {
    const targets = [
      { method: 'GET' as const, path: '/orders' },
      { method: 'GET' as const, path: '/seller/orders' },
      { method: 'GET' as const, path: '/admin/events?page=1&limit=10' },
      { method: 'GET' as const, path: '/admin/users' },
      { method: 'GET' as const, path: '/users/me' },
    ];

    for (const target of targets) {
      const response = await request.fetch(`${API_URL}${target.path}`, {
        method: target.method,
        headers: { Accept: 'application/json' },
      });
      expect(
        [401, 403].includes(response.status()),
        `${target.method} ${target.path} expected 401/403, got ${response.status()}`,
      ).toBeTruthy();
    }
  });
});
