import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  OrderReservationServiceError,
  releaseReservation,
} from '../services/order-reservation.service';
import { createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p10-order-reservation');

describe.sequential('order reservation service', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  it('returns early when the reservation is already cancelled', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({ sellerProfileId: seller.sellerProfile.id });

    const reservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 1,
      },
    });
    const reservationPayload = await context.readJson<{
      data: { reservation_id: string };
    }>(reservationResponse);

    await context.requestJson(`/reservations/${reservationPayload.data.reservation_id}`, {
      method: 'DELETE',
      token: buyer.token,
    });

    const result = await releaseReservation(
      context.env(),
      reservationPayload.data.reservation_id,
      'cancelled',
    );

    expect(result).toEqual({
      reservationId: reservationPayload.data.reservation_id,
      status: 'cancelled',
    });
  });

  it('releases an active reservation through the durable object binding', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({ sellerProfileId: seller.sellerProfile.id });

    const reservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 1,
      },
    });
    const reservationPayload = await context.readJson<{
      data: { reservation_id: string };
    }>(reservationResponse);

    const result = await releaseReservation(
      context.env(),
      reservationPayload.data.reservation_id,
      'expired',
    );
    const reservationRecord = await context.getReservation(reservationPayload.data.reservation_id);

    expect(result).toEqual({
      reservationId: reservationPayload.data.reservation_id,
      status: 'expired',
    });
    expect(reservationRecord?.status).toBe('expired');
  });

  it('throws when the durable object binding is missing for an active reservation', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({ sellerProfileId: seller.sellerProfile.id });

    const reservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 1,
      },
    });
    const reservationPayload = await context.readJson<{
      data: { reservation_id: string };
    }>(reservationResponse);

    await expect(
      releaseReservation(
        {
          DATABASE_URL: context.env().DATABASE_URL,
        },
        reservationPayload.data.reservation_id,
        'cancelled',
      ),
    ).rejects.toMatchObject<OrderReservationServiceError>({
      code: 'TICKET_RESERVER_UNAVAILABLE',
    });
  });

  it('maps durable object not-found responses to reservation errors', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({ sellerProfileId: seller.sellerProfile.id });

    const reservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 1,
      },
    });
    const reservationPayload = await context.readJson<{
      data: { reservation_id: string };
    }>(reservationResponse);

    const env = {
      DATABASE_URL: context.env().DATABASE_URL,
      TICKET_RESERVER: {
        idFromName(name: string) {
          return name;
        },
        get() {
          return {
            async fetch() {
              return Response.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
            },
          };
        },
      } as DurableObjectNamespace,
    };

    await expect(
      releaseReservation(env, reservationPayload.data.reservation_id, 'cancelled'),
    ).rejects.toMatchObject<OrderReservationServiceError>({
      code: 'RESERVATION_NOT_FOUND',
    });
  });
});
