// Tier 3 — Verifies reservation lifecycle: an active reservation reserves
// stock, cancelling the reservation releases stock back to the public tier,
// and a buyer cannot hold two active reservations at once.
import { expect, test } from '@playwright/test';

import {
  API_URL,
  createBuyerWithSession,
  createSmallQuotaEventFixture,
  tryReserveTicket,
  withRetry,
} from '../helpers';

async function getTierFromPublicEvent(
  request: import('@playwright/test').APIRequestContext,
  eventSlug: string,
  tierId: string,
) {
  const response = await request.get(`${API_URL}/events/${eventSlug}`, {
    headers: { Accept: 'application/json' },
  });
  expect(response.ok(), `GET /events/${eventSlug} failed: ${response.status()}`).toBeTruthy();
  const body = await response.json();
  const tier = (
    body.data.tiers as Array<{
      id: string;
      quota: number;
      sold_count: number;
      remaining: number;
    }>
  ).find((t) => t.id === tierId);
  expect(tier, `Tier ${tierId} not found in event ${eventSlug}`).toBeDefined();
  return tier!;
}

test.describe('Tier 3 — reservation lifecycle and stock release', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);

  test('reservation reserves stock and provides expires_at in the future', async ({ request }) => {
    const fixture = await withRetry(() =>
      createSmallQuotaEventFixture(request, {
        quota: 2,
        titlePrefix: 'Tier3 Lifecycle Reserve',
      }),
    );

    const before = await getTierFromPublicEvent(request, fixture.event.slug, fixture.ticketTierId);
    expect(before.remaining).toBe(fixture.quota);
    expect(before.sold_count).toBe(0);

    const buyer = await createBuyerWithSession(request);
    const reserveOutcome = await tryReserveTicket(
      request,
      buyer.session.access_token,
      fixture.ticketTierId,
      1,
    );
    expect(reserveOutcome.ok, JSON.stringify(reserveOutcome)).toBeTruthy();
    if (!reserveOutcome.ok) return;

    expect(new Date(reserveOutcome.expires_at).getTime()).toBeGreaterThan(Date.now());

    const after = await getTierFromPublicEvent(request, fixture.event.slug, fixture.ticketTierId);
    expect(after.sold_count).toBe(1);
    expect(after.remaining).toBe(fixture.quota - 1);

    const detailResponse = await request.get(
      `${API_URL}/reservations/${reserveOutcome.reservation_id}`,
      {
        headers: {
          Authorization: `Bearer ${buyer.session.access_token}`,
          Accept: 'application/json',
        },
      },
    );
    expect(detailResponse.ok()).toBeTruthy();
    const detailBody = await detailResponse.json();
    expect(detailBody.data.status).toBe('active');
    expect(detailBody.data.remaining_seconds).toBeGreaterThan(0);
  });

  test('cancelling a reservation releases stock back to remaining', async ({ request }) => {
    const fixture = await withRetry(() =>
      createSmallQuotaEventFixture(request, {
        quota: 2,
        titlePrefix: 'Tier3 Lifecycle Cancel',
      }),
    );

    const buyer = await createBuyerWithSession(request);
    const reserveOutcome = await tryReserveTicket(
      request,
      buyer.session.access_token,
      fixture.ticketTierId,
      1,
    );
    expect(reserveOutcome.ok, JSON.stringify(reserveOutcome)).toBeTruthy();
    if (!reserveOutcome.ok) return;

    const tierAfterReserve = await getTierFromPublicEvent(
      request,
      fixture.event.slug,
      fixture.ticketTierId,
    );
    expect(tierAfterReserve.sold_count).toBe(1);
    expect(tierAfterReserve.remaining).toBe(fixture.quota - 1);

    const cancelResponse = await request.delete(
      `${API_URL}/reservations/${reserveOutcome.reservation_id}`,
      {
        headers: {
          Authorization: `Bearer ${buyer.session.access_token}`,
          Accept: 'application/json',
        },
      },
    );
    expect(cancelResponse.ok()).toBeTruthy();
    const cancelBody = await cancelResponse.json();
    expect(cancelBody.data.status).toBe('cancelled');

    await expect
      .poll(
        async () => {
          const tier = await getTierFromPublicEvent(
            request,
            fixture.event.slug,
            fixture.ticketTierId,
          );
          return tier.remaining;
        },
        {
          message: 'Stock should be released back after cancellation',
          timeout: 20_000,
          intervals: [500, 1_000, 2_000],
        },
      )
      .toBe(fixture.quota);
  });

  test('buyer with active reservation cannot create a second one', async ({ request }) => {
    const fixture = await withRetry(() =>
      createSmallQuotaEventFixture(request, {
        quota: 5,
        titlePrefix: 'Tier3 Lifecycle Single',
      }),
    );

    const buyer = await createBuyerWithSession(request);

    const first = await tryReserveTicket(
      request,
      buyer.session.access_token,
      fixture.ticketTierId,
      1,
    );
    expect(first.ok, JSON.stringify(first)).toBeTruthy();

    const second = await tryReserveTicket(
      request,
      buyer.session.access_token,
      fixture.ticketTierId,
      1,
    );
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(['ACTIVE_RESERVATION_EXISTS', 'INVALID_STATE']).toContain(second.code);
      expect([409]).toContain(second.status);
    }
  });
});
