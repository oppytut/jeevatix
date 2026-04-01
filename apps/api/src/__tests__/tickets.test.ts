import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p7-tickets');

describe.sequential('Phase 7 Tickets API', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  async function createConfirmedOrder(quantity = 1) {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { event, tier } = await context.createEventFixture({ sellerProfileId: seller.sellerProfile.id });

    const reservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity,
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

    return { buyer, seller, event, tier, orderId: orderPayload.data.id };
  }

  it('lists buyer tickets with pagination metadata after payment success', async () => {
    const { buyer, event, tier, orderId } = await createConfirmedOrder(2);

    const response = await context.requestJson('/tickets?page=1&limit=1', {
      token: buyer.token,
    });
    const payload = await context.readJson<{
      success: boolean;
      data: Array<{
        id: string;
        order_id: string;
        event_id: string;
        ticket_tier_id: string;
        tier_name: string;
        event_title: string;
        status: string;
        ticket_code: string;
      }>;
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.order_id).toBe(orderId);
    expect(payload.data[0]?.event_id).toBe(event.id);
    expect(payload.data[0]?.ticket_tier_id).toBe(tier.id);
    expect(payload.data[0]?.tier_name).toBe('General Admission');
    expect(payload.data[0]?.event_title).toBe(event.title);
    expect(payload.data[0]?.status).toBe('valid');
    expect(payload.data[0]?.ticket_code).toMatch(/^JVX-/);
    expect(payload.meta).toEqual({
      total: 2,
      page: 1,
      limit: 1,
      totalPages: 2,
    });
  });

  it('returns ticket detail including qr data for the ticket owner', async () => {
    const { buyer, event } = await createConfirmedOrder();

    const listResponse = await context.requestJson('/tickets', {
      token: buyer.token,
    });
    const listPayload = await context.readJson<{
      data: Array<{ id: string; ticket_code: string }>;
    }>(listResponse);

    const ticketId = listPayload.data[0]?.id;
    expect(ticketId).toBeTruthy();

    const response = await context.requestJson(`/tickets/${ticketId}`, {
      token: buyer.token,
    });
    const payload = await context.readJson<{
      success: boolean;
      data: {
        id: string;
        ticket_code: string;
        qr_data: string;
        status: string;
        checked_in_at: string | null;
        event: { id: string; title: string; venue_city: string };
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe(ticketId);
    expect(payload.data.qr_data).toBe(payload.data.ticket_code);
    expect(payload.data.status).toBe('valid');
    expect(payload.data.checked_in_at).toBeNull();
    expect(payload.data.event.id).toBe(event.id);
    expect(payload.data.event.title).toBe(event.title);
    expect(payload.data.event.venue_city).toBe('Jakarta');
  });

  it('forbids another buyer from reading ticket details', async () => {
    const { buyer } = await createConfirmedOrder();
    const otherBuyer = await context.createBuyerFixture();

    const listResponse = await context.requestJson('/tickets', {
      token: buyer.token,
    });
    const listPayload = await context.readJson<{
      data: Array<{ id: string }>;
    }>(listResponse);

    const ticketId = listPayload.data[0]?.id;
    expect(ticketId).toBeTruthy();

    const response = await context.requestJson(`/tickets/${ticketId}`, {
      token: otherBuyer.token,
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