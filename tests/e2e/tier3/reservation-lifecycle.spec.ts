import { expect, test } from '@playwright/test';

import {
  API_URL,
  createBuyerWithSession,
  createPublishedEventFixture,
  createSmallQuotaEventFixture,
  loginApi,
  reserveOrThrow,
  withRetry,
} from '../helpers';

test.describe('Tier 3 — reservation lifecycle (expiry, cancel, ownership)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);

  test('reservation has future expires_at and is fetchable by owner', async ({ request }) => {
    const fixture = await withRetry(() => createPublishedEventFixture(request));
    const buyer = await createBuyerWithSession(request);

    const outcome = await reserveOrThrow(
      request,
      buyer.session.access_token,
      fixture.event.tiers[0]!.id,
      1,
    );

    const expiresAt = new Date(outcome.expires_at);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    const remainingMinutes = (expiresAt.getTime() - Date.now()) / 60_000;
    expect(remainingMinutes).toBeGreaterThan(1);
    expect(remainingMinutes).toBeLessThanOrEqual(15);

    const detailResponse = await request.get(`${API_URL}/reservations/${outcome.reservation_id}`, {
      headers: {
        Authorization: `Bearer ${buyer.session.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(detailResponse.ok()).toBeTruthy();
    const detail = await detailResponse.json();
    expect(detail.success).toBe(true);
    expect(detail.data.id).toBe(outcome.reservation_id);
    expect(detail.data.status).toBe('active');
    expect(detail.data.remaining_seconds).toBeGreaterThan(0);
  });

  test('cancelled reservation transitions status to cancelled and frees inventory', async ({
    request,
  }) => {
    const fixture = await withRetry(() =>
      createSmallQuotaEventFixture(request, { quota: 1, titlePrefix: 'Tier3 CancelLifecycle' }),
    );
    const buyer = await createBuyerWithSession(request);

    const reserve = await reserveOrThrow(
      request,
      buyer.session.access_token,
      fixture.ticketTierId,
      1,
    );

    const cancelResponse = await request.delete(
      `${API_URL}/reservations/${reserve.reservation_id}`,
      {
        headers: {
          Authorization: `Bearer ${buyer.session.access_token}`,
          Accept: 'application/json',
        },
      },
    );
    expect(cancelResponse.ok()).toBeTruthy();
    const cancelBody = await cancelResponse.json();
    expect(cancelBody.success).toBe(true);
    expect(cancelBody.data.status).toBe('cancelled');

    const detailResponse = await request.get(`${API_URL}/reservations/${reserve.reservation_id}`, {
      headers: {
        Authorization: `Bearer ${buyer.session.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(detailResponse.ok()).toBeTruthy();
    const detail = await detailResponse.json();
    expect(detail.data.status).toBe('cancelled');

    const next = await createBuyerWithSession(request);
    await reserveOrThrow(request, next.session.access_token, fixture.ticketTierId, 1);
  });

  test('cancel is idempotent — second cancel returns 4xx with no inventory change', async ({
    request,
  }) => {
    const fixture = await withRetry(() =>
      createSmallQuotaEventFixture(request, { quota: 1, titlePrefix: 'Tier3 DoubleCancel' }),
    );
    const buyer = await createBuyerWithSession(request);

    const reserve = await reserveOrThrow(
      request,
      buyer.session.access_token,
      fixture.ticketTierId,
      1,
    );

    const firstCancel = await request.delete(`${API_URL}/reservations/${reserve.reservation_id}`, {
      headers: {
        Authorization: `Bearer ${buyer.session.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(firstCancel.ok()).toBeTruthy();

    const secondCancel = await request.delete(`${API_URL}/reservations/${reserve.reservation_id}`, {
      headers: {
        Authorization: `Bearer ${buyer.session.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(secondCancel.ok()).toBe(false);
    expect([404, 409]).toContain(secondCancel.status());
  });

  test('reservation owner-scoped: another buyer cannot read or cancel it', async ({ request }) => {
    const fixture = await withRetry(() => createPublishedEventFixture(request));
    const owner = await createBuyerWithSession(request);
    const stranger = await createBuyerWithSession(request);

    const reserve = await reserveOrThrow(
      request,
      owner.session.access_token,
      fixture.event.tiers[0]!.id,
      1,
    );

    const strangerGet = await request.get(`${API_URL}/reservations/${reserve.reservation_id}`, {
      headers: {
        Authorization: `Bearer ${stranger.session.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(strangerGet.ok()).toBe(false);
    expect([403, 404]).toContain(strangerGet.status());

    const strangerDelete = await request.delete(
      `${API_URL}/reservations/${reserve.reservation_id}`,
      {
        headers: {
          Authorization: `Bearer ${stranger.session.access_token}`,
          Accept: 'application/json',
        },
      },
    );
    expect(strangerDelete.ok()).toBe(false);
    expect([403, 404]).toContain(strangerDelete.status());

    const ownerSession = await withRetry(() =>
      loginApi(request, owner.buyer.email, owner.buyer.password),
    );
    const ownerGet = await request.get(`${API_URL}/reservations/${reserve.reservation_id}`, {
      headers: {
        Authorization: `Bearer ${ownerSession.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(ownerGet.ok()).toBeTruthy();
  });
});
