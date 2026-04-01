import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p6-payment');

describe.sequential('Phase 6 Payment API', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  it('initiates payment and returns a payment URL', async () => {
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

    const payResponse = await context.requestJson(`/payments/${orderPayload.data.id}/pay`, {
      method: 'POST',
      token: buyer.token,
      body: {
        method: 'e_wallet',
      },
    });

    const payPayload = await context.readJson<{
      success: boolean;
      data: {
        order_id: string;
        payment_id: string;
        method: string;
        external_ref: string;
        payment_url: string | null;
      };
    }>(payResponse);

    const paymentRecord = await context.getPaymentByOrderId(orderPayload.data.id);

    expect(payResponse.status).toBe(200);
    expect(payPayload.success).toBe(true);
    expect(payPayload.data.order_id).toBe(orderPayload.data.id);
    expect(payPayload.data.method).toBe('e_wallet');
    expect(payPayload.data.external_ref).toMatch(/^PAY-\d{8}-[A-Z0-9]{8}$/);
    expect(payPayload.data.payment_url).toContain(payPayload.data.external_ref);
    expect(paymentRecord?.method).toBe('e_wallet');
    expect(paymentRecord?.externalRef).toBe(payPayload.data.external_ref);
  });

  it('accepts a valid payment webhook and confirms the order', async () => {
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

    const payResponse = await context.requestJson(`/payments/${orderPayload.data.id}/pay`, {
      method: 'POST',
      token: buyer.token,
      body: {
        method: 'virtual_account',
      },
    });
    const payPayload = await context.readJson<{
      data: { external_ref: string; payment_id: string };
    }>(payResponse);

    const webhookBody = {
      external_ref: payPayload.data.external_ref,
      status: 'success',
      paid_at: '2031-08-14T20:00:00.000Z',
    };
    const signature = await context.signWebhook(webhookBody);

    const webhookResponse = await context.requestJson('/webhooks/payment', {
      method: 'POST',
      body: webhookBody,
      headers: {
        'x-payment-signature': signature,
      },
    });

    const webhookPayload = await context.readJson<{
      success: boolean;
      data: { order_id: string; payment_id: string; status: string };
    }>(webhookResponse);

    const orderRecord = await context.getOrder(orderPayload.data.id);

    expect(webhookResponse.status).toBe(200);
    expect(webhookPayload.success).toBe(true);
    expect(webhookPayload.data.order_id).toBe(orderPayload.data.id);
    expect(webhookPayload.data.payment_id).toBe(payPayload.data.payment_id);
    expect(webhookPayload.data.status).toBe('success');
    expect(orderRecord?.status).toBe('confirmed');
    expect(orderRecord?.payment?.status).toBe('success');
  });

  it('rejects payment webhook with an invalid signature', async () => {
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

    const payResponse = await context.requestJson(`/payments/${orderPayload.data.id}/pay`, {
      method: 'POST',
      token: buyer.token,
      body: {
        method: 'credit_card',
      },
    });
    const payPayload = await context.readJson<{
      data: { external_ref: string };
    }>(payResponse);

    const webhookResponse = await context.requestJson('/webhooks/payment', {
      method: 'POST',
      body: {
        external_ref: payPayload.data.external_ref,
        status: 'success',
      },
      headers: {
        'x-payment-signature': 'invalid-signature',
      },
    });

    const webhookPayload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(webhookResponse);

    expect(webhookResponse.status).toBe(401);
    expect(webhookPayload.success).toBe(false);
    expect(webhookPayload.error.code).toBe('INVALID_SIGNATURE');
  });

  it('completes the full reserve to pay pipeline and persists confirmed status', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      price: 225000,
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

    const payResponse = await context.requestJson(`/payments/${orderPayload.data.id}/pay`, {
      method: 'POST',
      token: buyer.token,
      body: {
        method: 'bank_transfer',
      },
    });
    const payPayload = await context.readJson<{
      data: { external_ref: string };
    }>(payResponse);

    const webhookBody = {
      external_ref: payPayload.data.external_ref,
      status: 'success',
      paid_at: '2031-08-14T21:00:00.000Z',
    };
    const webhookSignature = await context.signWebhook(webhookBody);

    const webhookResponse = await context.requestJson('/webhooks/payment', {
      method: 'POST',
      body: webhookBody,
      headers: {
        'x-payment-signature': webhookSignature,
      },
    });

    const detailResponse = await context.requestJson(`/orders/${orderPayload.data.id}`, {
      token: buyer.token,
    });
    const detailPayload = await context.readJson<{
      success: boolean;
      data: {
        id: string;
        status: string;
        payment: { status: string; paid_at: string | null };
      };
    }>(detailResponse);

    expect(webhookResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(detailPayload.success).toBe(true);
    expect(detailPayload.data.id).toBe(orderPayload.data.id);
    expect(detailPayload.data.status).toBe('confirmed');
    expect(detailPayload.data.payment.status).toBe('success');
    expect(detailPayload.data.payment.paid_at).toBeTruthy();
  });

  it('allows retrying payment after a failed webhook while the order is still pending', async () => {
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

    const firstPayResponse = await context.requestJson(`/payments/${orderPayload.data.id}/pay`, {
      method: 'POST',
      token: buyer.token,
      body: {
        method: 'credit_card',
      },
    });
    const firstPayPayload = await context.readJson<{
      data: { external_ref: string };
    }>(firstPayResponse);

    const failedWebhookBody = {
      external_ref: firstPayPayload.data.external_ref,
      status: 'failed',
    };
    const failedWebhookSignature = await context.signWebhook(failedWebhookBody);

    const failedWebhookResponse = await context.requestJson('/webhooks/payment', {
      method: 'POST',
      body: failedWebhookBody,
      headers: {
        'x-payment-signature': failedWebhookSignature,
      },
    });

    const retryPayResponse = await context.requestJson(`/payments/${orderPayload.data.id}/pay`, {
      method: 'POST',
      token: buyer.token,
      body: {
        method: 'bank_transfer',
      },
    });
    const retryPayPayload = await context.readJson<{
      success: boolean;
      data: { external_ref: string; method: string; status: string };
    }>(retryPayResponse);
    const paymentRecord = await context.getPaymentByOrderId(orderPayload.data.id);

    expect(failedWebhookResponse.status).toBe(200);
    expect(retryPayResponse.status).toBe(200);
    expect(retryPayPayload.success).toBe(true);
    expect(retryPayPayload.data.method).toBe('bank_transfer');
    expect(retryPayPayload.data.status).toBe('pending');
    expect(retryPayPayload.data.external_ref).not.toBe(firstPayPayload.data.external_ref);
    expect(paymentRecord?.status).toBe('pending');
    expect(paymentRecord?.externalRef).toBe(retryPayPayload.data.external_ref);
  });
});