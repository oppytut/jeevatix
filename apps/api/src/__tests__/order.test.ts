import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p6-order');

class FailingConfirmNamespace {
  idFromName(name: string) {
    return name;
  }

  get() {
    return {
      async fetch() {
        return Response.json(
          {
            ok: false,
            error: 'INVALID_STATE',
            message: 'Reservation confirm failed for regression test.',
          },
          { status: 409 },
        );
      },
    };
  }
}

describe.sequential('Phase 6 Order API', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  it('creates an order from a valid reservation with order items and pending payment', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      quota: 5,
      price: 175000,
    });

    const reservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 2,
      },
    });

    const reservationPayload = await context.readJson<{
      data: { reservation_id: string };
    }>(reservationResponse);

    const orderResponse = await context.requestJson('/orders', {
      method: 'POST',
      token: buyer.token,
      body: {
        reservation_id: reservationPayload.data.reservation_id,
      },
    });

    const orderPayload = await context.readJson<{
      success: boolean;
      data: {
        id: string;
        reservation_id: string;
        order_number: string;
        status: string;
        total_amount: number;
        items: Array<{ quantity: number; subtotal: number }>;
        payment: { status: string; method: string };
      };
    }>(orderResponse);

    const orderRecord = await context.getOrder(orderPayload.data.id);
    const reservationRecord = await context.getReservation(reservationPayload.data.reservation_id);

    expect(orderResponse.status).toBe(201);
    expect(orderPayload.success).toBe(true);
    expect(orderPayload.data.order_number).toMatch(/^JVX-\d{8}-\d{5}$/);
    expect(orderPayload.data.status).toBe('pending');
    expect(orderPayload.data.total_amount).toBe(350000);
    expect(orderPayload.data.items).toEqual([
      expect.objectContaining({ quantity: 2, subtotal: 350000 }),
    ]);
    expect(orderPayload.data.payment.status).toBe('pending');
    expect(orderPayload.data.payment.method).toBe('bank_transfer');
    expect(orderRecord?.orderItems).toHaveLength(1);
    expect(orderRecord?.payment?.status).toBe('pending');
    expect(reservationRecord?.status).toBe('converted');
  });

  it('rejects order creation when the reservation is no longer active', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
    });

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

    const firstOrderResponse = await context.requestJson('/orders', {
      method: 'POST',
      token: buyer.token,
      body: {
        reservation_id: reservationPayload.data.reservation_id,
      },
    });

    const secondOrderResponse = await context.requestJson('/orders', {
      method: 'POST',
      token: buyer.token,
      body: {
        reservation_id: reservationPayload.data.reservation_id,
      },
    });

    const secondOrderPayload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(secondOrderResponse);

    expect(firstOrderResponse.status).toBe(201);
    expect(secondOrderResponse.status).toBe(409);
    expect(secondOrderPayload.success).toBe(false);
    expect(secondOrderPayload.error.code).toBe('INVALID_STATE');
  });

  it('lists buyer orders with pagination metadata', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const firstEvent = await context.createEventFixture({ sellerProfileId: seller.sellerProfile.id });
    const secondEvent = await context.createEventFixture({ sellerProfileId: seller.sellerProfile.id });

    const firstReservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: firstEvent.tier.id,
        quantity: 1,
      },
    });
    const firstReservationPayload = await context.readJson<{
      data: { reservation_id: string };
    }>(firstReservationResponse);

    const secondReservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: secondEvent.tier.id,
        quantity: 1,
      },
    });
    const secondReservationPayload = await context.readJson<{
      data: { reservation_id: string };
    }>(secondReservationResponse);

    await context.requestJson('/orders', {
      method: 'POST',
      token: buyer.token,
      body: { reservation_id: firstReservationPayload.data.reservation_id },
    });
    await context.requestJson('/orders', {
      method: 'POST',
      token: buyer.token,
      body: { reservation_id: secondReservationPayload.data.reservation_id },
    });

    const listResponse = await context.requestJson('/orders?page=1&limit=1', {
      token: buyer.token,
    });
    const listPayload = await context.readJson<{
      success: boolean;
      data: Array<{ id: string; order_number: string; event_title: string; status: string }>;
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(listResponse);

    expect(listResponse.status).toBe(200);
    expect(listPayload.success).toBe(true);
    expect(listPayload.data).toHaveLength(1);
    expect(listPayload.meta.total).toBe(2);
    expect(listPayload.meta.page).toBe(1);
    expect(listPayload.meta.limit).toBe(1);
    expect(listPayload.meta.totalPages).toBe(2);
  });

  it('returns order detail with items and payment info', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { event, tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      price: 200000,
    });

    const reservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 2,
      },
    });
    const reservationPayload = await context.readJson<{
      data: { reservation_id: string };
    }>(reservationResponse);

    const orderResponse = await context.requestJson('/orders', {
      method: 'POST',
      token: buyer.token,
      body: {
        reservation_id: reservationPayload.data.reservation_id,
      },
    });
    const orderPayload = await context.readJson<{
      data: { id: string };
    }>(orderResponse);

    const detailResponse = await context.requestJson(`/orders/${orderPayload.data.id}`, {
      token: buyer.token,
    });
    const detailPayload = await context.readJson<{
      success: boolean;
      data: {
        id: string;
        event_title: string;
        items: Array<{ tier_name: string; quantity: number; unit_price: number }>;
        payment: { status: string; amount: number };
      };
    }>(detailResponse);

    expect(detailResponse.status).toBe(200);
    expect(detailPayload.success).toBe(true);
    expect(detailPayload.data.id).toBe(orderPayload.data.id);
    expect(detailPayload.data.event_title).toBe(event.title);
    expect(detailPayload.data.items).toEqual([
      expect.objectContaining({ tier_name: 'General Admission', quantity: 2, unit_price: 200000 }),
    ]);
    expect(detailPayload.data.payment.status).toBe('pending');
    expect(detailPayload.data.payment.amount).toBe(400000);
  });

  it('forbids reading another buyer order detail', async () => {
    const firstBuyer = await context.createBuyerFixture();
    const secondBuyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
    });

    const reservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: firstBuyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 1,
      },
    });
    const reservationPayload = await context.readJson<{
      data: { reservation_id: string };
    }>(reservationResponse);

    const orderResponse = await context.requestJson('/orders', {
      method: 'POST',
      token: firstBuyer.token,
      body: {
        reservation_id: reservationPayload.data.reservation_id,
      },
    });
    const orderPayload = await context.readJson<{
      data: { id: string };
    }>(orderResponse);

    const forbiddenResponse = await context.requestJson(`/orders/${orderPayload.data.id}`, {
      token: secondBuyer.token,
    });
    const forbiddenPayload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(forbiddenResponse);

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenPayload.success).toBe(false);
    expect(forbiddenPayload.error.code).toBe('FORBIDDEN');
  });

  it('rolls back transient order records when reservation confirmation fails', async () => {
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

    const orderResponse = await context.requestJson('/orders', {
      method: 'POST',
      token: buyer.token,
      body: {
        reservation_id: reservationPayload.data.reservation_id,
      },
      envOverride: {
        TICKET_RESERVER: new FailingConfirmNamespace() as unknown as DurableObjectNamespace,
      },
    });
    const orderPayload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(orderResponse);

    const reservationRecord = await context.getReservation(reservationPayload.data.reservation_id);
    const orderRecord = await context.getOrderByReservationId(reservationPayload.data.reservation_id);

    expect(orderResponse.status).toBe(409);
    expect(orderPayload.success).toBe(false);
    expect(orderPayload.error.code).toBe('INVALID_STATE');
    expect(reservationRecord?.status).toBe('active');
    expect(orderRecord).toBeUndefined();
  });

  it('marks a pending order as expired when it is read after the payment window closes', async () => {
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

    const orderResponse = await context.requestJson('/orders', {
      method: 'POST',
      token: buyer.token,
      body: {
        reservation_id: reservationPayload.data.reservation_id,
      },
    });
    const orderPayload = await context.readJson<{
      data: { id: string };
    }>(orderResponse);

    await context.expireOrder(orderPayload.data.id);

    const detailResponse = await context.requestJson(`/orders/${orderPayload.data.id}`, {
      token: buyer.token,
    });
    const detailPayload = await context.readJson<{
      success: boolean;
      data: { status: string };
    }>(detailResponse);
    const orderRecord = await context.getOrder(orderPayload.data.id);

    expect(detailResponse.status).toBe(200);
    expect(detailPayload.success).toBe(true);
    expect(detailPayload.data.status).toBe('expired');
    expect(orderRecord?.status).toBe('expired');
  });
});