import { getDb, schema } from '@jeevatix/core';
import { and, eq, gt, gte, lte, sql } from 'drizzle-orm';

import { notificationService } from '../services/notification.service';

const { events, notifications, orderItems, orders, reservations, ticketTiers } = schema;

export type ReservationCleanupMessage = {
  action: 'cleanup-expired-reservations';
  triggered_at?: string;
};

export type ReservationCleanupEnv = {
  DATABASE_URL?: string;
  TICKET_RESERVER?: DurableObjectNamespace;
  RESERVATION_CLEANUP_QUEUE?: Queue<ReservationCleanupMessage>;
};

type TicketReserverStateResponse =
  | {
      ok: true;
      reservation_id: string;
      status: 'cancelled' | 'converted' | 'expired';
    }
  | {
      ok: false;
      error: 'BAD_REQUEST' | 'DATABASE_UNAVAILABLE' | 'NOT_FOUND' | 'INVALID_STATE';
      message?: string;
    };

function getProcessEnv(key: string) {
  return (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[key];
}

function getDatabase(env: ReservationCleanupEnv) {
  const database = getDb(env.DATABASE_URL ?? getProcessEnv('DATABASE_URL'));

  if (!database) {
    throw new Error('DATABASE_UNAVAILABLE');
  }

  return database;
}

function getTicketReserverNamespace(env: ReservationCleanupEnv) {
  if (!env.TICKET_RESERVER) {
    throw new Error('TICKET_RESERVER_UNAVAILABLE');
  }

  return env.TICKET_RESERVER;
}

async function expireReservation(
  env: ReservationCleanupEnv,
  reservationId: string,
  tierId: string,
) {
  const namespace = getTicketReserverNamespace(env);
  const objectId = namespace.idFromName(tierId);
  const stub = namespace.get(objectId);
  const response = await stub.fetch('https://ticket-reserver', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action: 'cancel',
      reservationId,
      status: 'expired',
    }),
  });

  const body = (await response.json()) as TicketReserverStateResponse;

  if (!body.ok) {
    throw new Error(body.error);
  }

  return body;
}

async function reminderAlreadySent(
  userId: string,
  type: 'payment_reminder' | 'event_reminder',
  metadataKey: 'reservation_id' | 'order_id',
  metadataValue: string,
  env: ReservationCleanupEnv,
) {
  const database = getDatabase(env);
  const existingReminder = await database.query.notifications.findFirst({
    where: and(
      eq(notifications.userId, userId),
      eq(notifications.type, type),
      sql<boolean>`${notifications.metadata}->>${metadataKey} = ${metadataValue}`,
    ),
    columns: {
      id: true,
    },
  });

  return Boolean(existingReminder);
}

async function sendPaymentReminders(env: ReservationCleanupEnv) {
  const database = getDatabase(env);
  const now = new Date();
  const reminderWindowEnd = new Date(now.getTime() + 2 * 60 * 1000);
  const soonExpiringReservations = await database.query.reservations.findMany({
    where: and(
      eq(reservations.status, 'active'),
      gt(reservations.expiresAt, now),
      lte(reservations.expiresAt, reminderWindowEnd),
    ),
    columns: {
      id: true,
      userId: true,
      expiresAt: true,
    },
    with: {
      ticketTier: {
        columns: {
          id: true,
        },
        with: {
          event: {
            columns: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  let sent = 0;

  for (const reservation of soonExpiringReservations) {
    const alreadySent = await reminderAlreadySent(
      reservation.userId,
      'payment_reminder',
      'reservation_id',
      reservation.id,
      env,
    );

    if (alreadySent) {
      continue;
    }

    await notificationService.sendNotification(
      reservation.userId,
      'payment_reminder',
      'Segera Bayar',
      'Reservasi Anda akan expired dalam 2 menit.',
      {
        reservation_id: reservation.id,
        event_id: reservation.ticketTier.event?.id ?? null,
        event_title: reservation.ticketTier.event?.title ?? null,
        expires_at: reservation.expiresAt.toISOString(),
      },
      env.DATABASE_URL ?? getProcessEnv('DATABASE_URL'),
    );

    sent += 1;
  }

  return sent;
}

async function sendEventReminders(env: ReservationCleanupEnv) {
  const database = getDatabase(env);
  const now = new Date();
  const reminderWindowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const reminderWindowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const upcomingOrders = await database
    .select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      userId: orders.userId,
      eventId: events.id,
      eventTitle: events.title,
      eventStartAt: events.startAt,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(ticketTiers, eq(ticketTiers.id, orderItems.ticketTierId))
    .innerJoin(events, eq(events.id, ticketTiers.eventId))
    .where(
      and(
        eq(orders.status, 'confirmed'),
        gte(events.startAt, reminderWindowStart),
        lte(events.startAt, reminderWindowEnd),
      ),
    )
    .groupBy(orders.id, orders.orderNumber, orders.userId, events.id, events.title, events.startAt);

  let sent = 0;

  for (const order of upcomingOrders) {
    const alreadySent = await reminderAlreadySent(
      order.userId,
      'event_reminder',
      'order_id',
      order.orderId,
      env,
    );

    if (alreadySent) {
      continue;
    }

    await notificationService.sendNotification(
      order.userId,
      'event_reminder',
      'Pengingat Event',
      `Event ${order.eventTitle} akan dimulai dalam 24 jam.`,
      {
        order_id: order.orderId,
        order_number: order.orderNumber,
        event_id: order.eventId,
        start_at: order.eventStartAt.toISOString(),
      },
      env.DATABASE_URL ?? getProcessEnv('DATABASE_URL'),
    );

    sent += 1;
  }

  return sent;
}

export async function cleanupExpiredReservations(env: ReservationCleanupEnv) {
  const database = getDatabase(env);
  const [paymentReminderCount, eventReminderCount] = await Promise.all([
    sendPaymentReminders(env),
    sendEventReminders(env),
  ]);
  const expiredReservations = await database.query.reservations.findMany({
    where: and(eq(reservations.status, 'active'), lte(reservations.expiresAt, new Date())),
    columns: {
      id: true,
      userId: true,
      ticketTierId: true,
      expiresAt: true,
    },
    with: {
      ticketTier: {
        columns: {
          id: true,
        },
        with: {
          event: {
            columns: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  const results = await Promise.all(
    expiredReservations.map(async (reservation) => {
      const result = await expireReservation(env, reservation.id, reservation.ticketTierId);

      if (result.status === 'expired') {
        await notificationService.sendNotification(
          reservation.userId,
          'info',
          'Reservasi Kedaluwarsa',
          `Reservasi tiket Anda untuk ${reservation.ticketTier.event?.title ?? 'event'} telah berakhir dan stok dikembalikan.`,
          {
            reservation_id: reservation.id,
            event_id: reservation.ticketTier.event?.id ?? null,
            expired_at: reservation.expiresAt.toISOString(),
          },
          env.DATABASE_URL ?? getProcessEnv('DATABASE_URL'),
        );
      }

      return result;
    }),
  );

  return {
    payment_reminders: paymentReminderCount,
    event_reminders: eventReminderCount,
    processed: results.filter((result) => result.status === 'expired').length,
    skipped: results.filter((result) => result.status !== 'expired').length,
  };
}

export async function enqueueReservationCleanup(env: ReservationCleanupEnv, scheduledTime?: number) {
  if (!env.RESERVATION_CLEANUP_QUEUE) {
    return cleanupExpiredReservations(env);
  }

  await env.RESERVATION_CLEANUP_QUEUE.send({
    action: 'cleanup-expired-reservations',
    triggered_at: scheduledTime ? new Date(scheduledTime).toISOString() : new Date().toISOString(),
  });

  return {
    enqueued: true as const,
  };
}

export async function reservationCleanupQueueHandler(
  batch: MessageBatch<ReservationCleanupMessage>,
  env: ReservationCleanupEnv,
  _ctx: ExecutionContext,
) {
  const shouldRunCleanup = batch.messages.some(
    (message) => message.body?.action === 'cleanup-expired-reservations',
  );

  if (!shouldRunCleanup) {
    batch.ackAll();
    return;
  }

  await cleanupExpiredReservations(env);
  batch.ackAll();
}