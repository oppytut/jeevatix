import { expect, test } from '@playwright/test';

import {
  API_URL,
  createConfirmedOrderFixture,
  createPublishedEventFixture,
  createPendingOrderFixture,
  sendPaymentWebhook,
  withRetry,
} from '../helpers';

test.describe('Tier 3 — payment webhook idempotency & signature enforcement', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);

  test('replaying a successful webhook 5x returns idempotent response, order stays confirmed once', async ({
    request,
  }) => {
    const eventFixture = await withRetry(() => createPublishedEventFixture(request));
    const fixture = await withRetry(() =>
      createConfirmedOrderFixture(
        request,
        eventFixture.event.id,
        eventFixture.sellerSession.access_token,
      ),
    );

    const replayPayload = {
      external_ref: fixture.payment.external_ref,
      status: 'success' as const,
      paid_at: new Date().toISOString(),
      metadata: { gateway: 'tier3-replay-test' },
    };

    const replays = await Promise.all(
      Array.from({ length: 5 }, () => sendPaymentWebhook(request, replayPayload)),
    );

    for (const replay of replays) {
      expect(replay.status, `Replay should return 200, got ${replay.status}`).toBe(200);
      const body = replay.body as {
        success: true;
        data: { external_ref: string; status: string };
      } | null;
      expect(body?.success).toBe(true);
      expect(body?.data.external_ref).toBe(fixture.payment.external_ref);
      expect(body?.data.status).toBe('ignored');
    }

    const orderResponse = await request.get(`${API_URL}/orders/${fixture.order.id}`, {
      headers: {
        Authorization: `Bearer ${fixture.buyerSession.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(orderResponse.ok()).toBeTruthy();
    const orderBody = await orderResponse.json();
    expect(orderBody.success).toBe(true);
    expect(orderBody.data.status).toBe('confirmed');
    expect(orderBody.data.confirmed_at ?? orderBody.data.confirmedAt).toBeTruthy();

    const ticketsResponse = await request.get(`${API_URL}/tickets?page=1&limit=50`, {
      headers: {
        Authorization: `Bearer ${fixture.buyerSession.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(ticketsResponse.ok()).toBeTruthy();
    const ticketsBody = await ticketsResponse.json();
    const orderTickets = (ticketsBody.data as Array<{ event_id: string }>).filter(
      (t) => t.event_id === eventFixture.event.id,
    );
    expect(orderTickets.length).toBe(1);
  });

  test('webhook with invalid signature returns 401 and does not transition order', async ({
    request,
  }) => {
    const eventFixture = await withRetry(() => createPublishedEventFixture(request));
    const pending = await withRetry(() =>
      createPendingOrderFixture(
        request,
        eventFixture.event.id,
        eventFixture.sellerSession.access_token,
      ),
    );

    const initiateResponse = await request.post(`${API_URL}/payments/${pending.order.id}/pay`, {
      headers: {
        Authorization: `Bearer ${pending.buyerSession.access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: { method: 'bank_transfer' },
    });
    expect(initiateResponse.ok()).toBeTruthy();
    const initiateBody = await initiateResponse.json();
    const externalRef = initiateBody.data.external_ref as string;

    const rawBody = JSON.stringify({
      external_ref: externalRef,
      status: 'success',
      paid_at: new Date().toISOString(),
      metadata: { gateway: 'tier3-invalid-signature' },
    });

    const badSigResponse = await request.post(`${API_URL}/webhooks/payment`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-payment-signature': 'deadbeef'.repeat(8),
      },
      data: rawBody,
    });
    expect(badSigResponse.status()).toBe(401);

    const missingSigResponse = await request.post(`${API_URL}/webhooks/payment`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: rawBody,
    });
    expect(missingSigResponse.status()).toBe(401);

    const orderResponse = await request.get(`${API_URL}/orders/${pending.order.id}`, {
      headers: {
        Authorization: `Bearer ${pending.buyerSession.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(orderResponse.ok()).toBeTruthy();
    const orderBody = await orderResponse.json();
    expect(orderBody.data.status).toBe('pending');
  });

  test('webhook with unknown external_ref returns 404 (no order side-effects)', async ({
    request,
  }) => {
    const result = await sendPaymentWebhook(request, {
      external_ref: `PAY-FAKE-${Date.now()}-NOTREAL`,
      status: 'success',
      paid_at: new Date().toISOString(),
      metadata: { gateway: 'tier3-unknown-ref' },
    });

    expect(result.status).toBe(404);
    const body = result.body as { success: false; error: { code: string } } | null;
    expect(body?.success).toBe(false);
    expect(body?.error.code).toBe('PAYMENT_NOT_FOUND');
  });
});
