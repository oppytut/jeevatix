import { getDb, schema } from '@jeevatix/core';
import { eq } from 'drizzle-orm';

const { reservations } = schema;

type OrderReservationEnv = {
  DATABASE_URL?: string;
  TICKET_RESERVER?: DurableObjectNamespace;
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

export class OrderReservationServiceError extends Error {
  constructor(
    public readonly code:
      | 'DATABASE_UNAVAILABLE'
      | 'INVALID_STATE'
      | 'RESERVATION_NOT_FOUND'
      | 'TICKET_RESERVER_UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'OrderReservationServiceError';
  }
}

function getProcessEnv(key: string) {
  return (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[key];
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl ?? getProcessEnv('DATABASE_URL'));

  if (!db) {
    throw new OrderReservationServiceError(
      'DATABASE_UNAVAILABLE',
      'Database connection is not available.',
    );
  }

  return db;
}

function getTicketReserverNamespace(env: OrderReservationEnv) {
  if (!env.TICKET_RESERVER) {
    throw new OrderReservationServiceError(
      'TICKET_RESERVER_UNAVAILABLE',
      'Ticket reserver durable object binding is not available.',
    );
  }

  return env.TICKET_RESERVER;
}

export async function releaseReservation(
  env: OrderReservationEnv,
  reservationId: string,
  status: 'cancelled' | 'expired',
) {
  const database = getDatabase(env.DATABASE_URL);
  const reservation = await database.query.reservations.findFirst({
    where: eq(reservations.id, reservationId),
    columns: {
      id: true,
      ticketTierId: true,
      status: true,
    },
  });

  if (!reservation) {
    throw new OrderReservationServiceError('RESERVATION_NOT_FOUND', 'Reservation not found.');
  }

  if (reservation.status === 'cancelled' || reservation.status === 'expired') {
    return {
      reservationId: reservation.id,
      status: reservation.status,
    };
  }

  const namespace = getTicketReserverNamespace(env);
  const objectId = namespace.idFromName(reservation.ticketTierId);
  const stub = namespace.get(objectId);
  const response = await stub.fetch('https://ticket-reserver', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action: 'cancel',
      reservationId: reservation.id,
      status,
    }),
  });

  const body = (await response.json()) as TicketReserverStateResponse;

  if (!body.ok) {
    switch (body.error) {
      case 'DATABASE_UNAVAILABLE':
        throw new OrderReservationServiceError(
          'DATABASE_UNAVAILABLE',
          'Database connection is not available.',
        );
      case 'NOT_FOUND':
        throw new OrderReservationServiceError('RESERVATION_NOT_FOUND', 'Reservation not found.');
      default:
        throw new OrderReservationServiceError(
          'INVALID_STATE',
          body.message ?? 'Reservation could not be released.',
        );
    }
  }

  return {
    reservationId: body.reservation_id,
    status: body.status,
  };
}