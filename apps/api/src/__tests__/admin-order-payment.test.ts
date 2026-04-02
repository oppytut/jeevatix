import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p9-admin-ops');

describe.sequential('Phase 9 Admin Order and Payment Operations', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  it('releases stock when an admin cancels an unpaid order', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const admin = await context.createAdminFixture();
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      quota: 4,
    });

    const reservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 2,
      },
    });
    const reservationPayload = await context.readJson<{ data: { reservation_id: string } }>(
      reservationResponse,
    );

    const orderResponse = await context.requestJson('/orders', {
      method: 'POST',
      token: buyer.token,
      body: {
        reservation_id: reservationPayload.data.reservation_id,
      },
    });
    const orderPayload = await context.readJson<{ data: { id: string } }>(orderResponse);

    const cancelResponse = await context.requestJson(`/admin/orders/${orderPayload.data.id}/cancel`, {
      method: 'POST',
      token: admin.token,
    });
    const cancelPayload = await context.readJson<{
      success: boolean;
      data: { status: string; paymentStatus: string };
    }>(cancelResponse);

    const orderRecord = await context.getOrder(orderPayload.data.id);
    const reservationRecord = await context.getReservation(reservationPayload.data.reservation_id);
    const tierRecord = await context.getTicketTier(tier.id);

    expect(cancelResponse.status).toBe(200);
    expect(cancelPayload.success).toBe(true);
    expect(cancelPayload.data.status).toBe('cancelled');
    expect(cancelPayload.data.paymentStatus).toBe('failed');
    expect(orderRecord?.status).toBe('cancelled');
    expect(orderRecord?.payment?.status).toBe('failed');
    expect(reservationRecord?.status).toBe('cancelled');
    expect(tierRecord?.soldCount).toBe(0);
  });

  it('releases stock when an admin marks a pending payment as failed', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const admin = await context.createAdminFixture();
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      quota: 3,
    });

    const reservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 1,
      },
    });
    const reservationPayload = await context.readJson<{ data: { reservation_id: string } }>(
      reservationResponse,
    );

    const orderResponse = await context.requestJson('/orders', {
      method: 'POST',
      token: buyer.token,
      body: {
        reservation_id: reservationPayload.data.reservation_id,
      },
    });
    const orderPayload = await context.readJson<{ data: { id: string } }>(orderResponse);
    const paymentRecord = await context.getPaymentByOrderId(orderPayload.data.id);

    expect(paymentRecord?.id).toBeTruthy();

    const updateResponse = await context.requestJson(`/admin/payments/${paymentRecord!.id}/status`, {
      method: 'PATCH',
      token: admin.token,
      body: {
        status: 'failed',
      },
    });
    const updatePayload = await context.readJson<{
      success: boolean;
      data: { status: string; orderStatus: string };
    }>(updateResponse);

    const orderRecord = await context.getOrder(orderPayload.data.id);
    const reservationRecord = await context.getReservation(reservationPayload.data.reservation_id);
    const tierRecord = await context.getTicketTier(tier.id);

    expect(updateResponse.status).toBe(200);
    expect(updatePayload.success).toBe(true);
    expect(updatePayload.data.status).toBe('failed');
    expect(updatePayload.data.orderStatus).toBe('cancelled');
    expect(orderRecord?.status).toBe('cancelled');
    expect(orderRecord?.payment?.status).toBe('failed');
    expect(reservationRecord?.status).toBe('cancelled');
    expect(tierRecord?.soldCount).toBe(0);
  });

  it('releases stock when an expired pending order is fetched again', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      quota: 2,
    });

    const reservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 1,
      },
    });
    const reservationPayload = await context.readJson<{ data: { reservation_id: string } }>(
      reservationResponse,
    );

    const orderResponse = await context.requestJson('/orders', {
      method: 'POST',
      token: buyer.token,
      body: {
        reservation_id: reservationPayload.data.reservation_id,
      },
    });
    const orderPayload = await context.readJson<{ data: { id: string } }>(orderResponse);

    await context.expireOrder(orderPayload.data.id);

    const detailResponse = await context.requestJson(`/orders/${orderPayload.data.id}`, {
      token: buyer.token,
    });
    const detailPayload = await context.readJson<{
      success: boolean;
      data: { status: string };
    }>(detailResponse);

    const orderRecord = await context.getOrder(orderPayload.data.id);
    const reservationRecord = await context.getReservation(reservationPayload.data.reservation_id);
    const tierRecord = await context.getTicketTier(tier.id);

    expect(detailResponse.status).toBe(200);
    expect(detailPayload.success).toBe(true);
    expect(detailPayload.data.status).toBe('expired');
    expect(orderRecord?.status).toBe('expired');
    expect(reservationRecord?.status).toBe('expired');
    expect(tierRecord?.soldCount).toBe(0);
  });
});