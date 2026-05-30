// Tier 3 — Verifies the Durable Object reservation lock prevents overselling.
// Five concurrent buyers race for a tier with quota 3; only quota-many succeed,
// the remainder receive SOLD_OUT and the tier ends up at 0 remaining stock.
import { expect, test } from '@playwright/test';

import {
  API_URL,
  createBuyerWithSession,
  createSmallQuotaEventFixture,
  tryReserveTicket,
  withRetry,
} from '../helpers';

test.describe('Tier 3 — concurrent reservations / overselling prevention', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);

  test('5 buyers racing for quota=3 — only 3 succeed, 2 get SOLD_OUT', async ({ request }) => {
    const QUOTA = 3;
    const NUM_BUYERS = 5;

    const fixture = await withRetry(() =>
      createSmallQuotaEventFixture(request, {
        quota: QUOTA,
        titlePrefix: 'Tier3 Race',
      }),
    );

    const buyers = await Promise.all(
      Array.from({ length: NUM_BUYERS }, () => createBuyerWithSession(request)),
    );

    const outcomes = await Promise.all(
      buyers.map((b) => tryReserveTicket(request, b.session.access_token, fixture.ticketTierId, 1)),
    );

    const succeeded = outcomes.filter((o): o is Extract<typeof o, { ok: true }> => o.ok);
    const failed = outcomes.filter((o): o is Extract<typeof o, { ok: false }> => !o.ok);

    expect(
      succeeded.length,
      `Expected exactly ${QUOTA} successful reservations, got ${succeeded.length}: ${JSON.stringify(
        outcomes,
      )}`,
    ).toBe(QUOTA);
    expect(failed.length).toBe(NUM_BUYERS - QUOTA);

    for (const f of failed) {
      expect(
        ['SOLD_OUT', 'ACTIVE_RESERVATION_EXISTS', 'MAX_TICKETS_EXCEEDED'].includes(f.code),
        `Unexpected failure code: ${f.code} (${f.message})`,
      ).toBeTruthy();
      expect([409, 429]).toContain(f.status);
    }

    const eventResponse = await request.get(`${API_URL}/events/${fixture.event.slug}`, {
      headers: { Accept: 'application/json' },
    });
    expect(eventResponse.ok()).toBeTruthy();
    const eventBody = await eventResponse.json();
    const tier = (
      eventBody.data.tiers as Array<{
        id: string;
        quota: number;
        sold_count: number;
        remaining: number;
      }>
    ).find((t) => t.id === fixture.ticketTierId);
    expect(tier).toBeDefined();
    expect(tier!.quota).toBe(QUOTA);
    expect(tier!.sold_count).toBe(QUOTA);
    expect(tier!.remaining).toBe(0);
  });

  test('subsequent attempt after sell-out still rejects with SOLD_OUT', async ({ request }) => {
    const QUOTA = 1;
    const fixture = await withRetry(() =>
      createSmallQuotaEventFixture(request, {
        quota: QUOTA,
        titlePrefix: 'Tier3 SellOut',
      }),
    );

    const winner = await createBuyerWithSession(request);
    const winnerOutcome = await tryReserveTicket(
      request,
      winner.session.access_token,
      fixture.ticketTierId,
      1,
    );
    expect(winnerOutcome.ok, JSON.stringify(winnerOutcome)).toBeTruthy();

    const latecomer = await createBuyerWithSession(request);
    const latecomerOutcome = await tryReserveTicket(
      request,
      latecomer.session.access_token,
      fixture.ticketTierId,
      1,
    );
    expect(latecomerOutcome.ok).toBe(false);
    if (!latecomerOutcome.ok) {
      expect(latecomerOutcome.code).toBe('SOLD_OUT');
      expect(latecomerOutcome.status).toBe(409);
    }
  });
});
