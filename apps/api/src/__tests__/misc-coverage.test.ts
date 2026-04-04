import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p10-misc-coverage');

async function createConfirmedSellerOrder() {
  const admin = await context.createAdminFixture();
  const buyer = await context.createBuyerFixture();
  const seller = await context.createSellerFixture();
  const { event, tier } = await context.createEventFixture({
    sellerProfileId: seller.sellerProfile.id,
    price: 225000,
    quota: 6,
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

  const order = await context.getOrder(orderPayload.data.id);

  if (!order?.payment) {
    throw new Error('Expected seller order fixture to have a payment.');
  }

  const updateResponse = await context.requestJson(`/admin/payments/${order.payment.id}/status`, {
    method: 'PATCH',
    token: admin.token,
    body: {
      status: 'success',
    },
  });

  expect(updateResponse.status).toBe(200);

  return { admin, buyer, seller, event, tier, order };
}

describe.sequential('Phase 10 misc coverage tests', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  it('returns seller dashboard aggregates and recent orders', async () => {
    const fixture = await createConfirmedSellerOrder();

    const response = await context.requestJson('/seller/dashboard', {
      token: fixture.seller.token,
    });
    const payload = await context.readJson<{
      success: boolean;
      data: {
        total_events: number;
        total_revenue: number;
        total_tickets_sold: number;
        upcoming_events: number;
        recent_orders: Array<{ id: string; event_title: string }>;
        daily_sales: Array<{ date: string; tickets_sold: number }>;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.total_events).toBeGreaterThanOrEqual(1);
    expect(payload.data.total_revenue).toBeGreaterThan(0);
    expect(payload.data.total_tickets_sold).toBeGreaterThanOrEqual(2);
    expect(payload.data.upcoming_events).toBeGreaterThanOrEqual(1);
    expect(payload.data.recent_orders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: fixture.order.id, event_title: fixture.event.title }),
      ]),
    );
    expect(payload.data.daily_sales).toHaveLength(30);
  });

  it('returns and updates the current user profile', async () => {
    const buyer = await context.createBuyerFixture();

    const meResponse = await context.requestJson('/users/me', {
      token: buyer.token,
    });
    const mePayload = await context.readJson<{
      success: boolean;
      data: { id: string; email: string; full_name: string };
    }>(meResponse);

    const updateResponse = await context.requestJson('/users/me', {
      method: 'PATCH',
      token: buyer.token,
      body: {
        full_name: 'Updated Buyer Name',
        phone: '089900112233',
        avatar_url: 'https://example.com/avatar.png',
      },
    });
    const updatePayload = await context.readJson<{
      success: boolean;
      data: { full_name: string; phone: string | null; avatar_url: string | null };
    }>(updateResponse);

    expect(meResponse.status).toBe(200);
    expect(mePayload.success).toBe(true);
    expect(mePayload.data.id).toBe(buyer.user.id);
    expect(updateResponse.status).toBe(200);
    expect(updatePayload.success).toBe(true);
    expect(updatePayload.data).toMatchObject({
      full_name: 'Updated Buyer Name',
      phone: '089900112233',
      avatar_url: 'https://example.com/avatar.png',
    });
  });

  it('changes the current user password and rejects the old password afterwards', async () => {
    const buyer = await context.createBuyerFixture();

    const changeResponse = await context.requestJson('/users/me/password', {
      method: 'PATCH',
      token: buyer.token,
      body: {
        old_password: 'TestPass123!',
        new_password: 'NewPass456!',
      },
    });
    const changePayload = await context.readJson<{
      success: boolean;
      data: { message: string };
    }>(changeResponse);

    const oldLoginResponse = await context.requestJson('/auth/login', {
      method: 'POST',
      body: {
        email: buyer.user.email,
        password: 'TestPass123!',
      },
    });
    const newLoginResponse = await context.requestJson('/auth/login', {
      method: 'POST',
      body: {
        email: buyer.user.email,
        password: 'NewPass456!',
      },
    });

    expect(changeResponse.status).toBe(200);
    expect(changePayload.success).toBe(true);
    expect(changePayload.data.message).toBe('Password changed successfully.');
    expect(oldLoginResponse.status).toBe(401);
    expect(newLoginResponse.status).toBe(200);
  });
});
