import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p7-checkin');

describe.sequential('Phase 7 Seller Check-in API', () => {
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
    const { event, tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
    });

    const reservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity,
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

    const ticketsResponse = await context.requestJson('/tickets', {
      token: buyer.token,
    });
    const ticketsPayload = await context.readJson<{
      data: Array<{ id: string; ticket_code: string }>;
    }>(ticketsResponse);

    return {
      buyer,
      seller,
      event,
      orderId: orderPayload.data.id,
      tickets: ticketsPayload.data,
    };
  }

  it('checks in a valid ticket and returns buyer details', async () => {
    const { buyer, seller, event, tickets } = await createConfirmedOrder();
    const ticket = tickets[0];

    const response = await context.requestJson(`/seller/events/${event.id}/checkin`, {
      method: 'POST',
      token: seller.token,
      body: {
        ticket_code: ticket?.ticket_code,
      },
    });
    const payload = await context.readJson<{
      success: boolean;
      data: {
        status: string;
        ticket_id: string | null;
        ticket_code: string | null;
        buyer_name: string | null;
        buyer_email: string | null;
        checked_in_at: string | null;
        message: string;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe('SUCCESS');
    expect(payload.data.ticket_id).toBe(ticket?.id);
    expect(payload.data.ticket_code).toBe(ticket?.ticket_code);
    expect(payload.data.buyer_name).toBe(buyer.user.fullName);
    expect(payload.data.buyer_email).toBe(buyer.user.email);
    expect(payload.data.checked_in_at).toBeTruthy();
    expect(payload.data.message).toBe('Ticket checked in successfully.');
  });

  it('returns already used when the same ticket is checked in twice', async () => {
    const { seller, event, tickets } = await createConfirmedOrder();
    const ticket = tickets[0];

    await context.requestJson(`/seller/events/${event.id}/checkin`, {
      method: 'POST',
      token: seller.token,
      body: {
        ticket_code: ticket?.ticket_code,
      },
    });

    const response = await context.requestJson(`/seller/events/${event.id}/checkin`, {
      method: 'POST',
      token: seller.token,
      body: {
        ticket_code: ticket?.ticket_code,
      },
    });
    const payload = await context.readJson<{
      success: boolean;
      data: {
        status: string;
        ticket_id: string | null;
        ticket_code: string | null;
        checked_in_at: string | null;
        message: string;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe('ALREADY_USED');
    expect(payload.data.ticket_id).toBe(ticket?.id);
    expect(payload.data.ticket_code).toBe(ticket?.ticket_code);
    expect(payload.data.checked_in_at).toBeTruthy();
    expect(payload.data.message).toBe('This ticket has already been checked in.');
  });

  it('returns invalid for a ticket code that does not belong to the event', async () => {
    const { seller, event } = await createConfirmedOrder();

    const response = await context.requestJson(`/seller/events/${event.id}/checkin`, {
      method: 'POST',
      token: seller.token,
      body: {
        ticket_code: 'jvx-invalid-code',
      },
    });
    const payload = await context.readJson<{
      success: boolean;
      data: {
        status: string;
        ticket_id: string | null;
        ticket_code: string | null;
        checked_in_at: string | null;
        message: string;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe('INVALID');
    expect(payload.data.ticket_id).toBeNull();
    expect(payload.data.ticket_code).toBe('JVX-INVALID-CODE');
    expect(payload.data.checked_in_at).toBeNull();
    expect(payload.data.message).toBe('Ticket code is invalid for this event.');
  });

  it('returns check-in stats including recent history', async () => {
    const { buyer, seller, event, tickets } = await createConfirmedOrder(2);
    const ticket = tickets[0];

    await context.requestJson(`/seller/events/${event.id}/checkin`, {
      method: 'POST',
      token: seller.token,
      body: {
        ticket_code: ticket?.ticket_code,
      },
    });

    const response = await context.requestJson(`/seller/events/${event.id}/checkin/stats`, {
      token: seller.token,
    });
    const payload = await context.readJson<{
      success: boolean;
      data: {
        event_id: string;
        event_title: string;
        total_tickets: number;
        checked_in: number;
        remaining: number;
        percentage: number;
        recent_checkins: Array<{
          ticket_id: string;
          ticket_code: string;
          buyer_name: string | null;
          buyer_email: string | null;
        }>;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.event_id).toBe(event.id);
    expect(payload.data.event_title).toBe(event.title);
    expect(payload.data.total_tickets).toBe(2);
    expect(payload.data.checked_in).toBe(1);
    expect(payload.data.remaining).toBe(1);
    expect(payload.data.percentage).toBe(50);
    expect(payload.data.recent_checkins).toHaveLength(1);
    expect(payload.data.recent_checkins[0]?.ticket_id).toBe(ticket?.id);
    expect(payload.data.recent_checkins[0]?.ticket_code).toBe(ticket?.ticket_code);
    expect(payload.data.recent_checkins[0]?.buyer_name).toBe(buyer.user.fullName);
    expect(payload.data.recent_checkins[0]?.buyer_email).toBe(buyer.user.email);
  });

  it('forbids another seller from checking in tickets for an event they do not own', async () => {
    const { event, tickets } = await createConfirmedOrder();
    const otherSeller = await context.createSellerFixture();

    const response = await context.requestJson(`/seller/events/${event.id}/checkin`, {
      method: 'POST',
      token: otherSeller.token,
      body: {
        ticket_code: tickets[0]?.ticket_code,
      },
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
