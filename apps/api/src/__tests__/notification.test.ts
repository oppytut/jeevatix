import { schema } from '@jeevatix/core';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { cleanupExpiredReservations } from '../queues/reservation-cleanup';
import { database, createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p7-notification');
const { events, notifications, reservations } = schema;

describe.sequential('Phase 7 Notification API', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  it('lists paginated notifications with unread counts', async () => {
    const buyer = await context.createBuyerFixture();

    await database.insert(notifications).values([
      {
        userId: buyer.user.id,
        type: 'info',
        title: 'Older',
        body: 'Older notification',
        isRead: false,
        createdAt: new Date('2031-08-10T08:00:00.000Z'),
      },
      {
        userId: buyer.user.id,
        type: 'order_confirmed',
        title: 'Newest',
        body: 'Newest notification',
        isRead: false,
        createdAt: new Date('2031-08-10T10:00:00.000Z'),
      },
      {
        userId: buyer.user.id,
        type: 'new_order',
        title: 'Middle',
        body: 'Middle notification',
        isRead: true,
        createdAt: new Date('2031-08-10T09:00:00.000Z'),
      },
    ]);

    const response = await context.requestJson('/notifications?page=1&limit=2', {
      token: buyer.token,
    });
    const payload = await context.readJson<{
      success: boolean;
      data: {
        notifications: Array<{ title: string; is_read: boolean }>;
        unread_count: number;
      };
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.unread_count).toBe(2);
    expect(payload.data.notifications).toHaveLength(2);
    expect(payload.data.notifications.map((notification) => notification.title)).toEqual([
      'Newest',
      'Middle',
    ]);
    expect(payload.meta).toEqual({
      total: 3,
      page: 1,
      limit: 2,
      totalPages: 2,
    });
  });

  it('marks a notification as read and enforces ownership', async () => {
    const buyer = await context.createBuyerFixture();
    const otherBuyer = await context.createBuyerFixture();

    const [ownNotification] = await database
      .insert(notifications)
      .values({
        userId: buyer.user.id,
        type: 'info',
        title: 'Own notification',
        body: 'Body',
      })
      .returning();

    const [otherNotification] = await database
      .insert(notifications)
      .values({
        userId: otherBuyer.user.id,
        type: 'info',
        title: 'Other notification',
        body: 'Body',
      })
      .returning();

    const markOwnResponse = await context.requestJson(`/notifications/${ownNotification.id}/read`, {
      method: 'PATCH',
      token: buyer.token,
    });
    const markOwnPayload = await context.readJson<{
      success: boolean;
      data: { id: string; is_read: boolean };
    }>(markOwnResponse);

    const markOtherResponse = await context.requestJson(
      `/notifications/${otherNotification.id}/read`,
      {
        method: 'PATCH',
        token: buyer.token,
      },
    );
    const markOtherPayload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(markOtherResponse);

    expect(markOwnResponse.status).toBe(200);
    expect(markOwnPayload.data.id).toBe(ownNotification.id);
    expect(markOwnPayload.data.is_read).toBe(true);
    expect(markOtherResponse.status).toBe(404);
    expect(markOtherPayload.success).toBe(false);
    expect(markOtherPayload.error.code).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('marks all notifications as read for the authenticated user only', async () => {
    const buyer = await context.createBuyerFixture();
    const otherBuyer = await context.createBuyerFixture();

    await database.insert(notifications).values([
      {
        userId: buyer.user.id,
        type: 'info',
        title: 'First',
        body: 'Body',
      },
      {
        userId: buyer.user.id,
        type: 'info',
        title: 'Second',
        body: 'Body',
      },
      {
        userId: otherBuyer.user.id,
        type: 'info',
        title: 'Third',
        body: 'Body',
      },
    ]);

    const response = await context.requestJson('/notifications/read-all', {
      method: 'PATCH',
      token: buyer.token,
    });
    const payload = await context.readJson<{
      success: boolean;
      data: { unread_count: number };
    }>(response);

    const buyerNotifications = await context.getNotificationsForUser(buyer.user.id);
    const otherNotifications = await context.getNotificationsForUser(otherBuyer.user.id);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.unread_count).toBe(0);
    expect(buyerNotifications.every((notification) => notification.isRead)).toBe(true);
    expect(otherNotifications.every((notification) => notification.isRead)).toBe(false);
  });

  it('broadcasts notifications to the requested role', async () => {
    const admin = await context.createAdminFixture();
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();

    const response = await context.requestJson('/admin/notifications/broadcast', {
      method: 'POST',
      token: admin.token,
      body: {
        title: 'Maintenance',
        body: 'Sistem akan maintenance malam ini.',
        target_role: 'seller',
      },
    });
    const payload = await context.readJson<{
      success: boolean;
      data: { sent_count: number; target_role: 'buyer' | 'seller' | 'all' };
    }>(response);

    const buyerNotifications = await context.getNotificationsForUser(buyer.user.id);
    const sellerNotifications = await context.getNotificationsForUser(seller.user.id);
    const buyerMaintenanceNotifications = buyerNotifications.filter(
      (notification) => notification.title === 'Maintenance',
    );
    const sellerMaintenanceNotifications = sellerNotifications.filter(
      (notification) => notification.title === 'Maintenance',
    );

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.sent_count).toBeGreaterThanOrEqual(1);
    expect(payload.data.target_role).toBe('seller');
    expect(buyerMaintenanceNotifications).toHaveLength(0);
    expect(sellerMaintenanceNotifications).toHaveLength(1);
    expect(sellerMaintenanceNotifications[0]?.type).toBe('info');
  });

  it('forbids non-admin users from broadcasting notifications', async () => {
    const seller = await context.createSellerFixture();

    const response = await context.requestJson('/admin/notifications/broadcast', {
      method: 'POST',
      token: seller.token,
      body: {
        title: 'Maintenance',
        body: 'Unauthorized broadcast attempt.',
        target_role: 'buyer',
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

  it('sends payment reminders for soon-expiring reservations', async () => {
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

    await database
      .update(reservations)
      .set({
        expiresAt: new Date(Date.now() + 60_000),
      })
      .where(eq(reservations.id, reservationPayload.data.reservation_id));

    const result = await cleanupExpiredReservations(context.env());
    const buyerNotifications = await context.getNotificationsForUser(buyer.user.id);
    const paymentReminder = buyerNotifications.find(
      (notification) => notification.type === 'payment_reminder',
    );

    expect(result.payment_reminders).toBe(1);
    expect(paymentReminder).toBeTruthy();
    expect(paymentReminder?.title).toBe('Segera Bayar');
  });

  it('sends event reminders for confirmed orders that start within 24 hours', async () => {
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
      data: { external_ref: string };
    }>(payResponse);

    const webhookBody = {
      external_ref: payPayload.data.external_ref,
      status: 'success',
      paid_at: '2031-08-14T20:00:00.000Z',
    };
    const signature = await context.signWebhook(webhookBody);

    await context.requestJson('/webhooks/payment', {
      method: 'POST',
      body: webhookBody,
      headers: {
        'x-payment-signature': signature,
      },
    });

    const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);

    await database
      .update(events)
      .set({
        startAt,
        endAt,
      })
      .where(eq(events.id, event.id));

    const result = await cleanupExpiredReservations(context.env());
    const buyerNotifications = await context.getNotificationsForUser(buyer.user.id);
    const eventReminder = buyerNotifications.find(
      (notification) => notification.type === 'event_reminder',
    );

    expect(result.event_reminders).toBe(1);
    expect(eventReminder).toBeTruthy();
    expect(eventReminder?.metadata).toMatchObject({
      event_id: event.id,
      order_id: orderPayload.data.id,
    });
  });
});
