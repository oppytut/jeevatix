import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p7-seller-orders');

describe.sequential('Phase 7 Seller Order API', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  async function createConfirmedOrder() {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { event, tier } = await context.createEventFixture({ sellerProfileId: seller.sellerProfile.id });

    const reservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 1,
      },
    });
    const reservationPayload = await context.readJson<{ data: { reservation_id: string } }>(reservationResponse);

    const orderResponse = await context.requestJson('/orders', {
      method: 'POST',
      token: buyer.token,
      body: {
        reservation_id: reservationPayload.data.reservation_id,
      },
    });
    const orderPayload = await context.readJson<{ data: { id: string } }>(orderResponse);

    const payResponse = await context.requestJson(`/payments/${orderPayload.data.id}/pay`, {
      method: 'POST',
      token: buyer.token,
      body: {
        method: 'bank_transfer',
      },
    });
    const payPayload = await context.readJson<{ data: { external_ref: string } }>(payResponse);

    const webhookBody = {
      external_ref: payPayload.data.external_ref,
      status: 'success',
      paid_at: '2031-08-14T21:00:00.000Z',
    };
    const webhookSignature = await context.signWebhook(webhookBody);

    await context.requestJson('/webhooks/payment', {
      method: 'POST',
      body: webhookBody,
      headers: {
        'x-payment-signature': webhookSignature,
      },
    });

    return { buyer, seller, event, orderId: orderPayload.data.id };
  }

  it('lists seller orders for the authenticated seller', async () => {
    const { seller, event, orderId } = await createConfirmedOrder();

    const response = await context.requestJson(`/seller/orders?event_id=${event.id}&status=confirmed`, {
      token: seller.token,
    });
    const payload = await context.readJson<{
      success: boolean;
      data: Array<{
        id: string;
        event_id: string;
        buyer_name: string;
        payment_status: string;
      }>;
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.id).toBe(orderId);
    expect(payload.data[0]?.event_id).toBe(event.id);
    expect(payload.data[0]?.payment_status).toBe('success');
    expect(payload.meta.total).toBe(1);
  });

  it('returns seller order detail with buyer info and payment data', async () => {
    const { buyer, seller, event, orderId } = await createConfirmedOrder();

    const response = await context.requestJson(`/seller/orders/${orderId}`, {
      token: seller.token,
    });
    const payload = await context.readJson<{
      success: boolean;
      data: {
        id: string;
        buyer: { id: string; full_name: string; email: string };
        event: { id: string; title: string };
        items: Array<{ quantity: number; tier_name: string }>;
        payment: { status: string; method: string };
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe(orderId);
    expect(payload.data.buyer.id).toBe(buyer.user.id);
    expect(payload.data.buyer.email).toBe(buyer.user.email);
    expect(payload.data.event.id).toBe(event.id);
    expect(payload.data.items[0]?.quantity).toBe(1);
    expect(payload.data.payment.status).toBe('success');
    expect(payload.data.payment.method).toBe('bank_transfer');
  });

  it('forbids another seller from reading order details', async () => {
    const { orderId } = await createConfirmedOrder();
    const otherSeller = await context.createSellerFixture();

    const response = await context.requestJson(`/seller/orders/${orderId}`, {
      token: otherSeller.token,
    });
    const payload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(403);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('FORBIDDEN');
  });
});