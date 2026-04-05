import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { TicketReserver } from '../durable-objects/ticket-reserver';
import { createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p10-ticket-reserver');

function createReserver() {
  return new TicketReserver(
    {
      async blockConcurrencyWhile<T>(closure: () => Promise<T>) {
        return closure();
      },
    },
    {
      DATABASE_URL: context.env().DATABASE_URL,
    },
  );
}

function createDurableObjectHarness(reserver = createReserver()) {
  let pending = Promise.resolve();

  return {
    async send<T>(payload: Record<string, unknown>) {
      const responsePromise = pending.then(() =>
        reserver.fetch(
          new Request('http://durable-object.test', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
          }),
        ),
      );

      pending = responsePromise.then(
        () => undefined,
        () => undefined,
      );

      const response = await responsePromise;
      return (await response.json()) as T;
    },
  };
}

describe.sequential('TicketReserver durable object', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  it('initializes availability and reserves tickets', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      quota: 5,
    });
    const reserver = createReserver();

    const initialized = await reserver.initialize(tier.id);
    const reservation = await reserver.reserve(buyer.user.id, tier.id, 2);
    const availability = await reserver.getAvailability(tier.id);
    const tierRecord = await context.getTicketTier(tier.id);

    expect(initialized).toMatchObject({
      ok: true,
      tier_id: tier.id,
      quota: 5,
      sold_count: 0,
      pending_reservations: 0,
    });
    expect(reservation).toMatchObject({ ok: true });
    expect(availability).toEqual({ ok: true, tier_id: tier.id, remaining: 3 });
    expect(tierRecord?.soldCount).toBe(0);
  });

  it('serializes overlapping reservation requests and returns sold out when quota is exhausted', async () => {
    const seller = await context.createSellerFixture();
    const buyers = await Promise.all([
      context.createBuyerFixture(),
      context.createBuyerFixture(),
      context.createBuyerFixture(),
      context.createBuyerFixture(),
    ]);
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      quota: 3,
    });
    const durableObject = createDurableObjectHarness();

    const results = await Promise.all(
      buyers.map((buyer) =>
        durableObject.send<
          | { ok: true; reservation_id: string; expires_at: string }
          | { ok: false; error: 'SOLD_OUT' }
        >({
          action: 'reserve',
          userId: buyer.user.id,
          tierId: tier.id,
          quantity: 1,
        }),
      ),
    );
    const successes = results.filter((result) => result.ok);
    const soldOuts = results.filter((result) => !result.ok && result.error === 'SOLD_OUT');
    const reserver = createReserver();
    const availability = await reserver.getAvailability(tier.id);
    const tierRecord = await context.getTicketTier(tier.id);

    expect(successes).toHaveLength(3);
    expect(soldOuts).toHaveLength(1);
    expect(availability).toEqual({ ok: true, tier_id: tier.id, remaining: 0 });
    expect(tierRecord?.soldCount).toBe(0);
  });

  it('cancels an active reservation and restores sold count', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      quota: 4,
    });
    const reserver = createReserver();

    const reservation = await reserver.reserve(buyer.user.id, tier.id, 2);

    if (!reservation.ok) {
      throw new Error('Expected reservation to succeed in cancel test.');
    }

    const cancelled = await reserver.cancelReservation(reservation.reservation_id);
    const availability = await reserver.getAvailability(tier.id);
    const tierRecord = await context.getTicketTier(tier.id);
    const reservationRecord = await context.getReservation(reservation.reservation_id);

    expect(cancelled).toEqual({
      ok: true,
      reservation_id: reservation.reservation_id,
      status: 'cancelled',
    });
    expect(availability).toEqual({ ok: true, tier_id: tier.id, remaining: 4 });
    expect(tierRecord?.soldCount).toBe(0);
    expect(reservationRecord?.status).toBe('cancelled');
  });

  it('can cancel a converted reservation and release stock again', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      quota: 2,
    });
    const reserver = createReserver();

    const reservation = await reserver.reserve(buyer.user.id, tier.id, 1);

    if (!reservation.ok) {
      throw new Error('Expected reservation to succeed in converted cancel test.');
    }

    const confirmed = await reserver.confirmReservation(reservation.reservation_id);
    const cancelled = await reserver.cancelReservation(reservation.reservation_id, 'cancelled');
    const availability = await reserver.getAvailability(tier.id);
    const tierRecord = await context.getTicketTier(tier.id);
    const reservationRecord = await context.getReservation(reservation.reservation_id);

    expect(confirmed).toEqual({
      ok: true,
      reservation_id: reservation.reservation_id,
      status: 'converted',
    });
    expect(cancelled).toEqual({
      ok: true,
      reservation_id: reservation.reservation_id,
      status: 'cancelled',
    });
    expect(availability).toEqual({ ok: true, tier_id: tier.id, remaining: 2 });
    expect(tierRecord?.soldCount).toBe(0);
    expect(reservationRecord?.status).toBe('cancelled');
  });
});
