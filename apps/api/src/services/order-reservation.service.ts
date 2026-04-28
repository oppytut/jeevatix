import { getDb, schema } from '@jeevatix/core';
import { eq } from 'drizzle-orm';

const { reservations } = schema;

type OrderReservationEnv = {
  DATABASE_URL?: string;
  TICKET_RESERVER?: DurableObjectNamespace;
};

type ReservationRoutingCacheEntry = {
  ticketTierId: string;
  expiresAtMs: number;
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

const DEFAULT_RESERVATION_ROUTING_CACHE_MAX_ENTRIES = 10_000;
const DEFAULT_RESERVATION_ROUTING_CACHE_TTL_MS = 60 * 60 * 1000;

const reservationRoutingCache = new Map<string, ReservationRoutingCacheEntry>();
let resolvedReservationRoutingCacheMaxEntries: number | undefined;
let resolvedReservationRoutingCacheTtlMs: number | undefined;

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

function getReservationRoutingCacheMaxEntries() {
  if (resolvedReservationRoutingCacheMaxEntries !== undefined) {
    return resolvedReservationRoutingCacheMaxEntries;
  }

  const parsedValue = Number.parseInt(
    getProcessEnv('ORDER_RESERVATION_ROUTING_CACHE_MAX_ENTRIES') ?? '',
    10,
  );

  if (Number.isFinite(parsedValue) && parsedValue >= 0) {
    resolvedReservationRoutingCacheMaxEntries = Math.trunc(parsedValue);
    return resolvedReservationRoutingCacheMaxEntries;
  }

  resolvedReservationRoutingCacheMaxEntries = DEFAULT_RESERVATION_ROUTING_CACHE_MAX_ENTRIES;
  return resolvedReservationRoutingCacheMaxEntries;
}

function getReservationRoutingCacheTtlMs() {
  if (resolvedReservationRoutingCacheTtlMs !== undefined) {
    return resolvedReservationRoutingCacheTtlMs;
  }

  const parsedValue = Number.parseInt(
    getProcessEnv('ORDER_RESERVATION_ROUTING_CACHE_TTL_MS') ?? '',
    10,
  );

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    resolvedReservationRoutingCacheTtlMs = Math.trunc(parsedValue);
    return resolvedReservationRoutingCacheTtlMs;
  }

  resolvedReservationRoutingCacheTtlMs = DEFAULT_RESERVATION_ROUTING_CACHE_TTL_MS;
  return resolvedReservationRoutingCacheTtlMs;
}

function pruneReservationRoutingCache(maxEntries: number) {
  while (reservationRoutingCache.size > maxEntries) {
    const oldestCacheKey = reservationRoutingCache.keys().next().value;

    if (!oldestCacheKey) {
      return;
    }

    reservationRoutingCache.delete(oldestCacheKey);
  }
}

function getCachedReservationTicketTierId(reservationId: string) {
  const cacheEntry = reservationRoutingCache.get(reservationId);

  if (!cacheEntry) {
    return undefined;
  }

  if (cacheEntry.expiresAtMs <= Date.now()) {
    reservationRoutingCache.delete(reservationId);
    return undefined;
  }

  // Promote hot keys and trim oldest entries first.
  reservationRoutingCache.delete(reservationId);
  reservationRoutingCache.set(reservationId, cacheEntry);
  return cacheEntry.ticketTierId;
}

export function cacheReservationTicketTier(reservationId: string, ticketTierId: string) {
  if (!reservationId || !ticketTierId) {
    return;
  }

  const maxEntries = getReservationRoutingCacheMaxEntries();

  if (maxEntries === 0) {
    return;
  }

  const ttlMs = getReservationRoutingCacheTtlMs();
  reservationRoutingCache.set(reservationId, {
    ticketTierId,
    expiresAtMs: Date.now() + ttlMs,
  });
  pruneReservationRoutingCache(maxEntries);
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

type TicketReserverTransitionPayload =
  | {
      action: 'cancel';
      reservationId: string;
      status: 'cancelled' | 'expired';
    }
  | {
      action: 'confirm';
      reservationId: string;
    };

async function transitionReservationViaTicketReserver(
  env: OrderReservationEnv,
  ticketTierId: string,
  payload: TicketReserverTransitionPayload,
) {
  const namespace = getTicketReserverNamespace(env);
  const objectId = namespace.idFromName(ticketTierId);
  const stub = namespace.get(objectId);
  const response = await stub.fetch('https://ticket-reserver', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
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
          body.message ?? 'Reservation state transition failed.',
        );
    }
  }

  return {
    reservationId: body.reservation_id,
    status: body.status,
  };
}

export async function releaseReservation(
  env: OrderReservationEnv,
  reservationId: string,
  status: 'cancelled' | 'expired',
) {
  const cachedTicketTierId = getCachedReservationTicketTierId(reservationId);

  if (cachedTicketTierId) {
    return transitionReservationViaTicketReserver(env, cachedTicketTierId, {
      action: 'cancel',
      reservationId,
      status,
    });
  }

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

  cacheReservationTicketTier(reservation.id, reservation.ticketTierId);

  if (reservation.status === 'cancelled' || reservation.status === 'expired') {
    return {
      reservationId: reservation.id,
      status: reservation.status,
    };
  }

  return transitionReservationViaTicketReserver(env, reservation.ticketTierId, {
    action: 'cancel',
    reservationId: reservation.id,
    status,
  });
}

export async function confirmReservation(env: OrderReservationEnv, reservationId: string) {
  const cachedTicketTierId = getCachedReservationTicketTierId(reservationId);

  if (cachedTicketTierId) {
    return transitionReservationViaTicketReserver(env, cachedTicketTierId, {
      action: 'confirm',
      reservationId,
    });
  }

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

  cacheReservationTicketTier(reservation.id, reservation.ticketTierId);

  if (reservation.status !== 'active' && reservation.status !== 'converted') {
    throw new OrderReservationServiceError(
      'INVALID_STATE',
      'Reservation is not active and cannot be converted.',
    );
  }

  return transitionReservationViaTicketReserver(env, reservation.ticketTierId, {
    action: 'confirm',
    reservationId: reservation.id,
  });
}
