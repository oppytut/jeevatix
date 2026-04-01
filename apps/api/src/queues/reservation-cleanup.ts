import { getDb, schema } from '@jeevatix/core';
import { and, eq, lte } from 'drizzle-orm';

import { notificationService } from '../services/notification.service';

const { reservations } = schema;

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

export async function cleanupExpiredReservations(env: ReservationCleanupEnv) {
  const database = getDatabase(env);
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