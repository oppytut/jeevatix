import { getDb, schema } from '@jeevatix/core';
import { and, eq, sql } from 'drizzle-orm';

import type {
  CreateReservationInput,
  ReservationCreatePayload,
  ReservationDetail,
  ReservationStatePayload,
} from '../schemas/reservation.schema';

const { orderItems, orders, reservations, ticketTiers } = schema;

type ReservationServiceEnv = {
  DATABASE_URL?: string;
  TICKET_RESERVER?: DurableObjectNamespace;
};

type TicketReserverReserveResponse =
  | {
      ok: true;
      reservation_id: string;
      expires_at: string;
    }
  | {
      ok: false;
      error: 'SOLD_OUT' | 'BAD_REQUEST' | 'DATABASE_UNAVAILABLE' | 'NOT_FOUND' | 'INVALID_STATE';
      message?: string;
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

type TicketTierAvailabilityRecord = {
  id: string;
  name: string;
  status: 'available' | 'sold_out' | 'hidden';
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  eventStatus: 'draft' | 'pending_review' | 'published' | 'rejected' | 'ongoing' | 'completed' | 'cancelled';
  maxTicketsPerOrder: number;
};

export class ReservationServiceError extends Error {
  constructor(
    public readonly code:
      | 'ACTIVE_RESERVATION_EXISTS'
      | 'DATABASE_UNAVAILABLE'
      | 'FORBIDDEN'
      | 'INVALID_STATE'
      | 'MAX_TICKETS_EXCEEDED'
      | 'RESERVATION_NOT_FOUND'
      | 'SOLD_OUT'
      | 'TICKET_RESERVER_UNAVAILABLE'
      | 'TIER_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'ReservationServiceError';
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
    throw new ReservationServiceError('DATABASE_UNAVAILABLE', 'Database connection is not available.');
  }

  return db;
}

function getReservationNamespace(env: ReservationServiceEnv) {
  if (!env.TICKET_RESERVER) {
    throw new ReservationServiceError(
      'TICKET_RESERVER_UNAVAILABLE',
      'Ticket reserver durable object binding is not available.',
    );
  }

  return env.TICKET_RESERVER;
}

async function getTierAvailabilityRecord(
  ticketTierId: string,
  databaseUrl?: string,
): Promise<TicketTierAvailabilityRecord> {
  const database = getDatabase(databaseUrl);
  const tier = await database.query.ticketTiers.findFirst({
    where: eq(ticketTiers.id, ticketTierId),
    columns: {
      id: true,
      name: true,
      status: true,
    },
    with: {
      event: {
        columns: {
          id: true,
          slug: true,
          title: true,
          status: true,
          maxTicketsPerOrder: true,
        },
      },
    },
  });

  if (!tier?.event) {
    throw new ReservationServiceError('TIER_NOT_FOUND', 'Ticket tier not found.');
  }

  if (tier.status === 'hidden' || !['published', 'ongoing'].includes(tier.event.status)) {
    throw new ReservationServiceError('INVALID_STATE', 'Ticket tier is not available for reservation.');
  }

  return {
    id: tier.id,
    name: tier.name,
    status: tier.status,
    eventId: tier.event.id,
    eventTitle: tier.event.title,
    eventSlug: tier.event.slug,
    eventStatus: tier.event.status,
    maxTicketsPerOrder: tier.event.maxTicketsPerOrder,
  };
}

async function ensureNoActiveReservationForEvent(
  userId: string,
  eventId: string,
  databaseUrl?: string,
) {
  const database = getDatabase(databaseUrl);
  const activeReservation = await database.query.reservations.findFirst({
    where: and(eq(reservations.userId, userId), eq(reservations.status, 'active')),
    columns: {
      id: true,
      expiresAt: true,
    },
    with: {
      ticketTier: {
        columns: {
          eventId: true,
        },
      },
    },
  });

  if (
    activeReservation?.ticketTier.eventId === eventId &&
    activeReservation.expiresAt.getTime() > Date.now()
  ) {
    throw new ReservationServiceError(
      'ACTIVE_RESERVATION_EXISTS',
      'You already have an active reservation for this event.',
    );
  }
}

async function ensureWithinTicketLimit(
  userId: string,
  eventId: string,
  quantity: number,
  maxTicketsPerOrder: number,
  databaseUrl?: string,
) {
  const database = getDatabase(databaseUrl);
  const [aggregate] = await database
    .select({
      quantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(ticketTiers, eq(orderItems.ticketTierId, ticketTiers.id))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orders.status, 'confirmed'),
        eq(ticketTiers.eventId, eventId),
      ),
    );

  const ownedTickets = aggregate?.quantity ?? 0;

  if (ownedTickets + quantity > maxTicketsPerOrder) {
    throw new ReservationServiceError(
      'MAX_TICKETS_EXCEEDED',
      'Requested quantity exceeds the maximum tickets allowed for this event.',
    );
  }
}

async function invokeTicketReserver<TResponse>(
  env: ReservationServiceEnv,
  tierId: string,
  payload: Record<string, unknown>,
): Promise<TResponse> {
  const namespace = getReservationNamespace(env);
  const objectId = namespace.idFromName(tierId);
  const stub = namespace.get(objectId);
  const response = await stub.fetch('https://ticket-reserver', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as TResponse;

  return body;
}

function getRemainingSeconds(expiresAt: Date) {
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
}

export const reservationService = {
  async reserve(
    env: ReservationServiceEnv,
    userId: string,
    input: CreateReservationInput,
  ): Promise<ReservationCreatePayload> {
    const databaseUrl = env.DATABASE_URL ?? getProcessEnv('DATABASE_URL');
    const tier = await getTierAvailabilityRecord(input.ticket_tier_id, databaseUrl);

    await ensureNoActiveReservationForEvent(userId, tier.eventId, databaseUrl);
    await ensureWithinTicketLimit(
      userId,
      tier.eventId,
      input.quantity,
      tier.maxTicketsPerOrder,
      databaseUrl,
    );

    const result = await invokeTicketReserver<TicketReserverReserveResponse>(env, tier.id, {
      action: 'reserve',
      userId,
      tierId: tier.id,
      quantity: input.quantity,
    });

    if (!result.ok) {
      if (result.error === 'SOLD_OUT') {
        throw new ReservationServiceError('SOLD_OUT', 'Ticket tier is sold out.');
      }

      if (result.error === 'NOT_FOUND') {
        throw new ReservationServiceError('TIER_NOT_FOUND', 'Ticket tier not found.');
      }

      if (result.error === 'DATABASE_UNAVAILABLE') {
        throw new ReservationServiceError('DATABASE_UNAVAILABLE', 'Database connection is not available.');
      }

      throw new ReservationServiceError(
        'INVALID_STATE',
        result.message ?? 'Unable to create reservation.',
      );
    }

    return {
      reservation_id: result.reservation_id,
      expires_at: result.expires_at,
    };
  },

  async getReservation(
    userId: string,
    reservationId: string,
    databaseUrl?: string,
  ): Promise<ReservationDetail> {
    const database = getDatabase(databaseUrl);
    const reservation = await database.query.reservations.findFirst({
      where: eq(reservations.id, reservationId),
      columns: {
        id: true,
        userId: true,
        quantity: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
      with: {
        ticketTier: {
          columns: {
            id: true,
            name: true,
          },
          with: {
            event: {
              columns: {
                id: true,
                slug: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!reservation?.ticketTier.event) {
      throw new ReservationServiceError('RESERVATION_NOT_FOUND', 'Reservation not found.');
    }

    if (reservation.userId !== userId) {
      throw new ReservationServiceError('FORBIDDEN', 'You do not have access to this reservation.');
    }

    return {
      id: reservation.id,
      user_id: reservation.userId,
      ticket_tier_id: reservation.ticketTier.id,
      event_id: reservation.ticketTier.event.id,
      event_slug: reservation.ticketTier.event.slug,
      event_title: reservation.ticketTier.event.title,
      tier_name: reservation.ticketTier.name,
      quantity: reservation.quantity,
      status: reservation.status,
      expires_at: reservation.expiresAt.toISOString(),
      created_at: reservation.createdAt.toISOString(),
      remaining_seconds: getRemainingSeconds(reservation.expiresAt),
    };
  },

  async cancelReservation(
    env: ReservationServiceEnv,
    userId: string,
    reservationId: string,
  ): Promise<ReservationStatePayload> {
    const databaseUrl = env.DATABASE_URL ?? getProcessEnv('DATABASE_URL');
    const database = getDatabase(databaseUrl);
    const reservation = await database.query.reservations.findFirst({
      where: eq(reservations.id, reservationId),
      columns: {
        id: true,
        userId: true,
        status: true,
        ticketTierId: true,
      },
    });

    if (!reservation) {
      throw new ReservationServiceError('RESERVATION_NOT_FOUND', 'Reservation not found.');
    }

    if (reservation.userId !== userId) {
      throw new ReservationServiceError('FORBIDDEN', 'You do not have access to this reservation.');
    }

    if (reservation.status !== 'active') {
      throw new ReservationServiceError(
        'INVALID_STATE',
        'Only active reservations can be cancelled.',
      );
    }

    const result = await invokeTicketReserver<TicketReserverStateResponse>(
      env,
      reservation.ticketTierId,
      {
        action: 'cancel',
        reservationId: reservation.id,
        status: 'cancelled',
      },
    );

    if (!result.ok) {
      if (result.error === 'NOT_FOUND') {
        throw new ReservationServiceError('RESERVATION_NOT_FOUND', 'Reservation not found.');
      }

      if (result.error === 'DATABASE_UNAVAILABLE') {
        throw new ReservationServiceError('DATABASE_UNAVAILABLE', 'Database connection is not available.');
      }

      throw new ReservationServiceError(
        'INVALID_STATE',
        result.message ?? 'Unable to cancel reservation.',
      );
    }

    return {
      reservation_id: result.reservation_id,
      status: result.status,
    };
  },
};