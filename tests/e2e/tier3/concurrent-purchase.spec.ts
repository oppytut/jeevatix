import { expect, test } from '@playwright/test';

import {
  API_URL,
  createBuyerWithSession,
  createSmallQuotaEventFixture,
  reserveOrThrow,
  tryReserveTicket,
  withRetry,
} from '../helpers';

test.describe('Tier 3 — concurrent purchase / overselling prevention', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);

  test('quota=2 with N=5 racing buyers → exactly 2 succeed, others get 409 SOLD_OUT', async ({
    request,
  }) => {
    const fixture = await withRetry(() =>
      createSmallQuotaEventFixture(request, { quota: 2, titlePrefix: 'Tier3 Race' }),
    );

    const numBuyers = 5;
    const buyers = [];
    for (let i = 0; i < numBuyers; i += 1) {
      buyers.push(await createBuyerWithSession(request));
    }

    const outcomes = await Promise.all(
      buyers.map((b) => tryReserveTicket(request, b.session.access_token, fixture.ticketTierId, 1)),
    );

    const successes = outcomes.filter((o) => o.ok);
    const failures = outcomes.filter((o) => !o.ok);

    expect(
      successes.length,
      `Expected exactly ${fixture.quota} successful reservations, got ${successes.length}. Failures: ${JSON.stringify(failures)}`,
    ).toBe(fixture.quota);

    expect(failures.length).toBe(numBuyers - fixture.quota);

    const failureCodes = failures.map((f) => (f.ok ? null : f.code));
    expect(
      failureCodes.every((code) => code === 'SOLD_OUT' || code === 'TIER_NOT_FOUND'),
      `Expected all failures to be SOLD_OUT, got: ${JSON.stringify(failureCodes)}`,
    ).toBeTruthy();

    expect(failures.every((f) => !f.ok && f.status >= 400 && f.status < 500)).toBeTruthy();
  });

  test('after quota exhausted, subsequent buyer sees 409 SOLD_OUT (no further reservations)', async ({
    request,
  }) => {
    const fixture = await withRetry(() =>
      createSmallQuotaEventFixture(request, { quota: 1, titlePrefix: 'Tier3 PostExhausted' }),
    );

    const winner = await createBuyerWithSession(request);
    await reserveOrThrow(request, winner.session.access_token, fixture.ticketTierId, 1);

    const loser = await createBuyerWithSession(request);
    const loserOutcome = await tryReserveTicket(
      request,
      loser.session.access_token,
      fixture.ticketTierId,
      1,
    );

    expect(loserOutcome.ok).toBe(false);
    if (!loserOutcome.ok) {
      expect(loserOutcome.code).toBe('SOLD_OUT');
      expect(loserOutcome.status).toBe(409);
    }

    const tierResponse = await request.get(`${API_URL}/events/${fixture.event.slug}`, {
      headers: { Accept: 'application/json' },
    });
    expect(tierResponse.ok()).toBeTruthy();
  });

  test('cancelled reservation releases stock for next buyer', async ({ request }) => {
    const fixture = await withRetry(() =>
      createSmallQuotaEventFixture(request, { quota: 1, titlePrefix: 'Tier3 Release' }),
    );

    const first = await createBuyerWithSession(request);
    const firstOutcome = await reserveOrThrow(
      request,
      first.session.access_token,
      fixture.ticketTierId,
      1,
    );

    const cancelResponse = await request.delete(
      `${API_URL}/reservations/${firstOutcome.reservation_id}`,
      {
        headers: {
          Authorization: `Bearer ${first.session.access_token}`,
          Accept: 'application/json',
        },
      },
    );
    expect(cancelResponse.ok()).toBeTruthy();
    const cancelBody = await cancelResponse.json();
    expect(cancelBody.success).toBe(true);
    expect(cancelBody.data.status).toBe('cancelled');

    const second = await createBuyerWithSession(request);
    await reserveOrThrow(request, second.session.access_token, fixture.ticketTierId, 1);
  });
});
