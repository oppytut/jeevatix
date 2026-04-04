import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p10-admin-coverage');

async function createPendingOrderFixture() {
  const admin = await context.createAdminFixture();
  const buyer = await context.createBuyerFixture();
  const seller = await context.createSellerFixture();
  const { event, tier } = await context.createEventFixture({
    sellerProfileId: seller.sellerProfile.id,
    price: 175000,
    quota: 5,
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
    throw new Error('Expected pending order fixture to have a payment record.');
  }

  return {
    admin,
    buyer,
    seller,
    event,
    tier,
    order,
    payment: order.payment,
  };
}

async function createConfirmedOrderFixture() {
  const fixture = await createPendingOrderFixture();

  const response = await context.requestJson(`/admin/payments/${fixture.payment.id}/status`, {
    method: 'PATCH',
    token: fixture.admin.token,
    body: {
      status: 'success',
    },
  });

  expect(response.status).toBe(200);

  return fixture;
}

describe.sequential('Phase 10 Admin coverage tests', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  it('returns admin dashboard aggregates and recent activity', async () => {
    const fixture = await createConfirmedOrderFixture();

    const response = await context.requestJson('/admin/dashboard', {
      token: fixture.admin.token,
    });
    const payload = await context.readJson<{
      success: boolean;
      data: {
        total_users: number;
        total_sellers: number;
        total_buyers: number;
        total_events: number;
        total_events_published: number;
        total_revenue: number;
        total_tickets_sold: number;
        daily_transactions: Array<{ date: string; transaction_count: number }>;
        recent_events: Array<{ id: string; name: string }>;
        recent_orders: Array<{ id: string; order_number: string }>;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.total_users).toBeGreaterThanOrEqual(3);
    expect(payload.data.total_sellers).toBeGreaterThanOrEqual(1);
    expect(payload.data.total_buyers).toBeGreaterThanOrEqual(1);
    expect(payload.data.total_events).toBeGreaterThanOrEqual(1);
    expect(payload.data.total_events_published).toBeGreaterThanOrEqual(1);
    expect(payload.data.total_revenue).toBeGreaterThan(0);
    expect(payload.data.total_tickets_sold).toBeGreaterThanOrEqual(1);
    expect(payload.data.daily_transactions).toHaveLength(30);
    expect(payload.data.recent_events).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: fixture.event.id })]),
    );
    expect(payload.data.recent_orders).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: fixture.order.id })]),
    );
  });

  it('lists admin events, returns event detail, and updates event status', async () => {
    const admin = await context.createAdminFixture();
    const seller = await context.createSellerFixture();
    const { event, tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      quota: 8,
    });

    const listResponse = await context.requestJson(
      `/admin/events?search=${encodeURIComponent(event.title)}&status=published`,
      {
        token: admin.token,
      },
    );
    const listPayload = await context.readJson<{
      success: boolean;
      data: Array<{ id: string; totalQuota: number; totalSold: number }>;
    }>(listResponse);

    const detailResponse = await context.requestJson(`/admin/events/${event.id}`, {
      token: admin.token,
    });
    const detailPayload = await context.readJson<{
      success: boolean;
      data: {
        id: string;
        status: string;
        seller: { userId: string };
        tiers: Array<{ id: string; quota: number }>;
      };
    }>(detailResponse);

    const updateResponse = await context.requestJson(`/admin/events/${event.id}/status`, {
      method: 'PATCH',
      token: admin.token,
      body: {
        status: 'cancelled',
      },
    });
    const updatePayload = await context.readJson<{
      success: boolean;
      data: { id: string; status: string };
    }>(updateResponse);
    const sellerNotifications = await context.getNotificationsForUser(seller.user.id);

    expect(listResponse.status).toBe(200);
    expect(listPayload.success).toBe(true);
    expect(listPayload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: event.id, totalQuota: 8, totalSold: 0 }),
      ]),
    );
    expect(detailResponse.status).toBe(200);
    expect(detailPayload.success).toBe(true);
    expect(detailPayload.data.id).toBe(event.id);
    expect(detailPayload.data.status).toBe('published');
    expect(detailPayload.data.seller.userId).toBe(seller.user.id);
    expect(detailPayload.data.tiers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: tier.id, quota: 8 })]),
    );
    expect(updateResponse.status).toBe(200);
    expect(updatePayload.success).toBe(true);
    expect(updatePayload.data).toMatchObject({ id: event.id, status: 'cancelled' });
    expect(sellerNotifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Status event diperbarui',
          type: 'info',
        }),
      ]),
    );
  });

  it('lists admin orders and returns detailed order data', async () => {
    const fixture = await createConfirmedOrderFixture();

    const listResponse = await context.requestJson(
      `/admin/orders?status=confirmed&search=${encodeURIComponent(fixture.order.orderNumber)}`,
      {
        token: fixture.admin.token,
      },
    );
    const listPayload = await context.readJson<{
      success: boolean;
      data: Array<{
        id: string;
        orderNumber: string;
        paymentStatus: string;
        buyer: { id: string };
        event: { id: string };
      }>;
    }>(listResponse);

    const detailResponse = await context.requestJson(`/admin/orders/${fixture.order.id}`, {
      token: fixture.admin.token,
    });
    const detailPayload = await context.readJson<{
      success: boolean;
      data: {
        id: string;
        orderNumber: string;
        payment: { status: string };
        items: Array<{ quantity: number }>;
        tickets: Array<{ status: string }>;
      };
    }>(detailResponse);

    expect(listResponse.status).toBe(200);
    expect(listPayload.success).toBe(true);
    expect(listPayload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fixture.order.id,
          orderNumber: fixture.order.orderNumber,
          paymentStatus: 'success',
          buyer: expect.objectContaining({ id: fixture.buyer.user.id }),
          event: expect.objectContaining({ id: fixture.event.id }),
        }),
      ]),
    );
    expect(detailResponse.status).toBe(200);
    expect(detailPayload.success).toBe(true);
    expect(detailPayload.data.id).toBe(fixture.order.id);
    expect(detailPayload.data.payment.status).toBe('success');
    expect(detailPayload.data.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ quantity: 1 })]),
    );
    expect(detailPayload.data.tickets).toHaveLength(1);
  });

  it('lists admin payments, returns payment detail, and supports manual success updates', async () => {
    const fixture = await createPendingOrderFixture();

    const listResponse = await context.requestJson(
      `/admin/payments?status=pending&search=${encodeURIComponent(fixture.order.orderNumber)}`,
      {
        token: fixture.admin.token,
      },
    );
    const listPayload = await context.readJson<{
      success: boolean;
      data: Array<{
        id: string;
        orderId: string;
        status: string;
        buyer: { id: string };
        event: { id: string };
      }>;
    }>(listResponse);

    const detailResponse = await context.requestJson(`/admin/payments/${fixture.payment.id}`, {
      token: fixture.admin.token,
    });
    const detailPayload = await context.readJson<{
      success: boolean;
      data: {
        id: string;
        status: string;
        orderStatus: string;
        items: Array<{ quantity: number }>;
      };
    }>(detailResponse);

    const updateResponse = await context.requestJson(
      `/admin/payments/${fixture.payment.id}/status`,
      {
        method: 'PATCH',
        token: fixture.admin.token,
        body: {
          status: 'success',
        },
      },
    );
    const updatePayload = await context.readJson<{
      success: boolean;
      data: { id: string; status: string; orderStatus: string };
    }>(updateResponse);
    const updatedOrder = await context.getOrder(fixture.order.id);
    const buyerNotifications = await context.getNotificationsForUser(fixture.buyer.user.id);

    expect(listResponse.status).toBe(200);
    expect(listPayload.success).toBe(true);
    expect(listPayload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fixture.payment.id,
          orderId: fixture.order.id,
          status: 'pending',
          buyer: expect.objectContaining({ id: fixture.buyer.user.id }),
          event: expect.objectContaining({ id: fixture.event.id }),
        }),
      ]),
    );
    expect(detailResponse.status).toBe(200);
    expect(detailPayload.success).toBe(true);
    expect(detailPayload.data).toMatchObject({
      id: fixture.payment.id,
      status: 'pending',
      orderStatus: 'pending',
    });
    expect(detailPayload.data.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ quantity: 1 })]),
    );
    expect(updateResponse.status).toBe(200);
    expect(updatePayload.success).toBe(true);
    expect(updatePayload.data).toMatchObject({
      id: fixture.payment.id,
      status: 'success',
      orderStatus: 'confirmed',
    });
    expect(updatedOrder?.status).toBe('confirmed');
    expect(updatedOrder?.payment?.status).toBe('success');
    expect(updatedOrder?.orderItems).toHaveLength(1);
    expect(buyerNotifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Pembayaran dikonfirmasi',
          type: 'order_confirmed',
        }),
      ]),
    );
  });
});
