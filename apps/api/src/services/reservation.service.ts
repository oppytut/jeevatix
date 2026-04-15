import { getDb, schema, type Database } from '@jeevatix/core';
import { and, desc, eq, ilike, or, sql, type SQLWrapper } from 'drizzle-orm';

import { logTimedSteps, type LoadTestProfile, type TimedStep } from '../lib/load-test-profile';
import type {
  CreateReservationInput,
  ReservationCreatePayload,
  ReservationDetail,
  ReservationStatePayload,
} from '../schemas/reservation.schema';
import type { AdminReservationItem, AdminReservationListQuery } from '../schemas/admin.schema';

const { events, orderItems, orders, reservations, ticketTiers, users } = schema;

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
  saleStartAt: Date | null;
  saleEndAt: Date | null;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  eventStatus:
    | 'draft'
    | 'pending_review'
    | 'published'
    | 'rejected'
    | 'ongoing'
    | 'completed'
    | 'cancelled';
  maxTicketsPerOrder: number;
  eventSaleStartAt: Date;
  eventSaleEndAt: Date;
};

type ReservationEligibilityRecord = TicketTierAvailabilityRecord & {
  hasActiveReservation: boolean;
  ownedTickets: number;
};

type ReservationEligibilityProfile = {
  poolWaitDurationMs?: number;
  queryExecuteDurationMs?: number;
  postQueryChecksDurationMs?: number;
  totalDurationMs?: number;
};

type ProfiledReservationEligibilityRow = {
  id: string;
  name: string;
  status: ReservationEligibilityRecord['status'];
  saleStartAt: Date | string | null;
  saleEndAt: Date | string | null;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  eventStatus: ReservationEligibilityRecord['eventStatus'];
  maxTicketsPerOrder: number;
  eventSaleStartAt: Date | string;
  eventSaleEndAt: Date | string;
  hasActiveReservation: boolean;
  ownedTickets: number;
};

type DatabaseClientDebugFn = (
  connectionId: number,
  queryText: string,
  parameters: unknown[],
  parameterTypes: unknown[],
) => void;

type DatabaseClient = Database extends { $client: infer Client } ? Client : never;

type InstrumentedDatabaseClient = DatabaseClient & {
  options: {
    debug?: boolean | DatabaseClientDebugFn;
  };
};

type DatabaseUnsafeParameters = Parameters<InstrumentedDatabaseClient['unsafe']>[1];

type DebugProbeState = {
  pending: Map<string, Array<() => void>>;
};

const databaseDebugProbes = new WeakMap<InstrumentedDatabaseClient, DebugProbeState>();
const preparedReservationEligibilityQueries = new WeakMap<
  Database,
  ReturnType<typeof buildPreparedReservationEligibilityQuery>
>();

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
    throw new ReservationServiceError(
      'DATABASE_UNAVAILABLE',
      'Database connection is not available.',
    );
  }

  return db;
}

function getDatabaseClient(database: Database) {
  return (database as Database & { $client: InstrumentedDatabaseClient }).$client;
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

function toDateValue(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

function toReservationEligibilityRecord(
  row: ProfiledReservationEligibilityRow,
): ReservationEligibilityRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    saleStartAt: toDateValue(row.saleStartAt),
    saleEndAt: toDateValue(row.saleEndAt),
    eventId: row.eventId,
    eventTitle: row.eventTitle,
    eventSlug: row.eventSlug,
    eventStatus: row.eventStatus,
    maxTicketsPerOrder: Number(row.maxTicketsPerOrder),
    eventSaleStartAt: toDateValue(row.eventSaleStartAt) as Date,
    eventSaleEndAt: toDateValue(row.eventSaleEndAt) as Date,
    hasActiveReservation: Boolean(row.hasActiveReservation),
    ownedTickets: Number(row.ownedTickets),
  };
}

function buildQueryProbeKey(queryText: string, parameters: unknown[]) {
  return `${queryText}\n${JSON.stringify(parameters)}`;
}

function getDebugProbeState(client: InstrumentedDatabaseClient) {
  const existingState = databaseDebugProbes.get(client);

  if (existingState) {
    return existingState;
  }

  const pending = new Map<string, Array<() => void>>();
  const originalDebug = client.options.debug;

  client.options.debug = (
    connectionId: number,
    queryText: string,
    parameters: unknown[],
    parameterTypes: unknown[],
  ) => {
    const probeKey = buildQueryProbeKey(queryText, parameters);
    const listeners = pending.get(probeKey);

    if (listeners?.length) {
      const listener = listeners.shift();
      listener?.();

      if (listeners.length === 0) {
        pending.delete(probeKey);
      }
    }

    if (typeof originalDebug === 'function') {
      originalDebug(connectionId, queryText, parameters, parameterTypes);
    }
  };

  const state = { pending } satisfies DebugProbeState;
  databaseDebugProbes.set(client, state);
  return state;
}

function registerQueryDebugProbe(
  client: InstrumentedDatabaseClient,
  queryText: string,
  parameters: unknown[],
  listener: () => void,
) {
  const state = getDebugProbeState(client);
  const probeKey = buildQueryProbeKey(queryText, parameters);
  const listeners = state.pending.get(probeKey) ?? [];
  listeners.push(listener);
  state.pending.set(probeKey, listeners);

  return () => {
    const activeListeners = state.pending.get(probeKey);

    if (!activeListeners) {
      return;
    }

    const listenerIndex = activeListeners.indexOf(listener);

    if (listenerIndex >= 0) {
      activeListeners.splice(listenerIndex, 1);
    }

    if (activeListeners.length === 0) {
      state.pending.delete(probeKey);
    }
  };
}

function aliasSelection<T>(fragment: SQLWrapper, alias: string) {
  return sql<T>`${fragment}`.as(alias);
}

function buildReservationEligibilityQuery(
  database: Database,
  userId: string | SQLWrapper,
  ticketTierId: string | SQLWrapper,
) {
  return database
    .select({
      id: aliasSelection<string>(ticketTiers.id, 'id'),
      name: aliasSelection<string>(ticketTiers.name, 'name'),
      status: aliasSelection<ReservationEligibilityRecord['status']>(ticketTiers.status, 'status'),
      saleStartAt: aliasSelection<Date | null>(ticketTiers.saleStartAt, 'saleStartAt'),
      saleEndAt: aliasSelection<Date | null>(ticketTiers.saleEndAt, 'saleEndAt'),
      eventId: aliasSelection<string>(events.id, 'eventId'),
      eventTitle: aliasSelection<string>(events.title, 'eventTitle'),
      eventSlug: aliasSelection<string>(events.slug, 'eventSlug'),
      eventStatus: aliasSelection<ReservationEligibilityRecord['eventStatus']>(
        events.status,
        'eventStatus',
      ),
      maxTicketsPerOrder: aliasSelection<number>(events.maxTicketsPerOrder, 'maxTicketsPerOrder'),
      eventSaleStartAt: aliasSelection<Date>(events.saleStartAt, 'eventSaleStartAt'),
      eventSaleEndAt: aliasSelection<Date>(events.saleEndAt, 'eventSaleEndAt'),
      hasActiveReservation: sql<boolean>`exists(
        select 1
        from ${reservations} as reservation
        inner join ${ticketTiers} as tier
          on reservation.ticket_tier_id = tier.id
        where reservation.user_id = ${userId}
          and reservation.status = 'active'
          and tier.event_id = ${events.id}
          and reservation.expires_at > now()
      )`.as('hasActiveReservation'),
      ownedTickets: sql<number>`coalesce((
        select sum(order_item.quantity)::int
        from ${orderItems} as order_item
        inner join ${orders} as buyer_order
          on order_item.order_id = buyer_order.id
        inner join ${ticketTiers} as owned_tier
          on order_item.ticket_tier_id = owned_tier.id
        where buyer_order.user_id = ${userId}
          and buyer_order.status = 'confirmed'
          and owned_tier.event_id = ${events.id}
      ), 0)::int`.as('ownedTickets'),
    })
    .from(ticketTiers)
    .innerJoin(events, eq(ticketTiers.eventId, events.id))
    .where(eq(ticketTiers.id, ticketTierId))
    .limit(1);
}

function buildPreparedReservationEligibilityQuery(database: Database) {
  return buildReservationEligibilityQuery(
    database,
    sql.placeholder('userId'),
    sql.placeholder('ticketTierId'),
  ).prepare('reservation_eligibility_hot_path');
}

function getPreparedReservationEligibilityQuery(database: Database) {
  const existingQuery = preparedReservationEligibilityQueries.get(database);

  if (existingQuery) {
    return existingQuery;
  }

  const preparedQuery = buildPreparedReservationEligibilityQuery(database);
  preparedReservationEligibilityQueries.set(database, preparedQuery);
  return preparedQuery;
}

async function loadReservationEligibilityRecord(
  database: Database,
  userId: string,
  ticketTierId: string,
): Promise<ReservationEligibilityRecord | undefined> {
  const preparedQuery = getPreparedReservationEligibilityQuery(database);
  const rows = (await preparedQuery.execute({
    userId,
    ticketTierId,
  })) as ProfiledReservationEligibilityRow[];
  const [tier] = rows;

  return tier
    ? toReservationEligibilityRecord(tier as ProfiledReservationEligibilityRow)
    : undefined;
}

async function loadProfiledReservationEligibilityRecord(
  database: Database,
  userId: string,
  ticketTierId: string,
  profile: ReservationEligibilityProfile,
): Promise<ReservationEligibilityRecord | undefined> {
  const eligibilityQuery = buildReservationEligibilityQuery(database, userId, ticketTierId);
  const { sql: queryText, params } = eligibilityQuery.toSQL();
  const client = getDatabaseClient(database);
  const queuedAt = Date.now();
  let executeStartedAt = queuedAt;
  const unregisterDebugProbe = registerQueryDebugProbe(client, queryText, params, () => {
    executeStartedAt = Date.now();
    profile.poolWaitDurationMs = executeStartedAt - queuedAt;
  });

  try {
    const rows = await client.unsafe<ProfiledReservationEligibilityRow[]>(
      queryText,
      params as DatabaseUnsafeParameters,
    );
    profile.poolWaitDurationMs ??= 0;
    profile.queryExecuteDurationMs = Math.max(0, Date.now() - executeStartedAt);
    return rows[0] ? toReservationEligibilityRecord(rows[0]) : undefined;
  } finally {
    unregisterDebugProbe();
  }
}

async function getReservationEligibilityRecord(
  userId: string,
  ticketTierId: string,
  databaseUrl?: string,
  profile?: ReservationEligibilityProfile,
): Promise<ReservationEligibilityRecord> {
  const database = getDatabase(databaseUrl);
  const startedAt = profile ? Date.now() : 0;

  let tier = undefined as ReservationEligibilityRecord | undefined;

  if (profile) {
    tier = await loadProfiledReservationEligibilityRecord(database, userId, ticketTierId, profile);
  } else {
    tier = await loadReservationEligibilityRecord(database, userId, ticketTierId);
  }

  const postQueryChecksStartedAt = profile ? Date.now() : 0;

  if (!tier) {
    throw new ReservationServiceError('TIER_NOT_FOUND', 'Ticket tier not found.');
  }

  if (tier.status === 'hidden' || !['published', 'ongoing'].includes(tier.eventStatus)) {
    throw new ReservationServiceError(
      'INVALID_STATE',
      'Ticket tier is not available for reservation.',
    );
  }

  const now = new Date();
  const effectiveSaleStartAt =
    tier.saleStartAt && tier.saleStartAt.getTime() > tier.eventSaleStartAt.getTime()
      ? tier.saleStartAt
      : tier.eventSaleStartAt;
  const effectiveSaleEndAt =
    tier.saleEndAt && tier.saleEndAt.getTime() < tier.eventSaleEndAt.getTime()
      ? tier.saleEndAt
      : tier.eventSaleEndAt;

  if (
    effectiveSaleStartAt.getTime() > now.getTime() ||
    effectiveSaleEndAt.getTime() < now.getTime()
  ) {
    throw new ReservationServiceError(
      'INVALID_STATE',
      'Ticket tier is outside the active sale window.',
    );
  }

  if (profile) {
    profile.postQueryChecksDurationMs = Date.now() - postQueryChecksStartedAt;
    profile.totalDurationMs = Date.now() - startedAt;
  }

  return {
    id: tier.id,
    name: tier.name,
    status: tier.status,
    saleStartAt: tier.saleStartAt,
    saleEndAt: tier.saleEndAt,
    eventId: tier.eventId,
    eventTitle: tier.eventTitle,
    eventSlug: tier.eventSlug,
    eventStatus: tier.eventStatus,
    maxTicketsPerOrder: tier.maxTicketsPerOrder,
    eventSaleStartAt: tier.eventSaleStartAt,
    eventSaleEndAt: tier.eventSaleEndAt,
    hasActiveReservation: tier.hasActiveReservation,
    ownedTickets: tier.ownedTickets,
  };
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
    profile?: LoadTestProfile,
  ): Promise<ReservationCreatePayload> {
    const startedAt = profile?.enabled ? Date.now() : 0;
    const steps: TimedStep[] = [];
    const databaseUrl = env.DATABASE_URL ?? getProcessEnv('DATABASE_URL');
    const eligibilityStartedAt = profile?.enabled ? Date.now() : 0;
    const eligibilityProfile: ReservationEligibilityProfile | undefined = profile?.enabled
      ? {}
      : undefined;
    const tier = await getReservationEligibilityRecord(
      userId,
      input.ticket_tier_id,
      databaseUrl,
      eligibilityProfile,
    );

    if (profile?.enabled) {
      steps.push({
        step: 'eligibility_query',
        durationMs: Date.now() - eligibilityStartedAt,
      });

      if (typeof eligibilityProfile?.poolWaitDurationMs === 'number') {
        steps.push({
          step: 'eligibility_pool_wait',
          durationMs: eligibilityProfile.poolWaitDurationMs,
        });
      }

      if (typeof eligibilityProfile?.queryExecuteDurationMs === 'number') {
        steps.push({
          step: 'eligibility_query_execute',
          durationMs: eligibilityProfile.queryExecuteDurationMs,
        });
      }

      if (typeof eligibilityProfile?.postQueryChecksDurationMs === 'number') {
        steps.push({
          step: 'eligibility_post_query_checks',
          durationMs: eligibilityProfile.postQueryChecksDurationMs,
        });
      }
    }

    if (tier.hasActiveReservation) {
      throw new ReservationServiceError(
        'ACTIVE_RESERVATION_EXISTS',
        'You already have an active reservation for this event.',
      );
    }

    if (tier.ownedTickets + input.quantity > tier.maxTicketsPerOrder) {
      throw new ReservationServiceError(
        'MAX_TICKETS_EXCEEDED',
        'Requested quantity exceeds the maximum tickets allowed for this event.',
      );
    }

    const durableObjectStartedAt = profile?.enabled ? Date.now() : 0;
    const result = await invokeTicketReserver<TicketReserverReserveResponse>(env, tier.id, {
      action: 'reserve',
      userId,
      tierId: tier.id,
      quantity: input.quantity,
      profile,
    });

    if (profile?.enabled) {
      steps.push({
        step: 'durable_object_reserve',
        durationMs: Date.now() - durableObjectStartedAt,
      });
    }

    if (!result.ok) {
      logTimedSteps(
        profile,
        'reservation.reserve',
        {
          ticketTierId: input.ticket_tier_id,
          outcome: result.error,
          totalDurationMs: Date.now() - startedAt,
        },
        steps,
      );

      if (result.error === 'SOLD_OUT') {
        throw new ReservationServiceError('SOLD_OUT', 'Ticket tier is sold out.');
      }

      if (result.error === 'NOT_FOUND') {
        throw new ReservationServiceError('TIER_NOT_FOUND', 'Ticket tier not found.');
      }

      if (result.error === 'DATABASE_UNAVAILABLE') {
        throw new ReservationServiceError(
          'DATABASE_UNAVAILABLE',
          'Database connection is not available.',
        );
      }

      throw new ReservationServiceError(
        'INVALID_STATE',
        result.message ?? 'Unable to create reservation.',
      );
    }

    logTimedSteps(
      profile,
      'reservation.reserve',
      {
        ticketTierId: input.ticket_tier_id,
        outcome: 'success',
        totalDurationMs: Date.now() - startedAt,
      },
      steps,
    );

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

  async listAdmin(
    query: AdminReservationListQuery,
    databaseUrl?: string,
  ): Promise<{
    data: AdminReservationItem[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const database = getDatabase(databaseUrl);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const searchTerm = query.search ? `%${query.search}%` : undefined;
    const conditions = [
      query.status ? eq(reservations.status, query.status) : undefined,
      query.eventId ? eq(ticketTiers.eventId, query.eventId) : undefined,
      searchTerm
        ? or(
            ilike(users.fullName, searchTerm),
            ilike(users.email, searchTerm),
            ilike(ticketTiers.name, searchTerm),
            ilike(schema.events.title, searchTerm),
          )
        : undefined,
    ].filter((condition) => condition !== undefined);
    const whereClause = and(...conditions);

    const [totalRow, rows] = await Promise.all([
      database
        .select({ total: sql<number>`count(*)::int` })
        .from(reservations)
        .innerJoin(users, eq(users.id, reservations.userId))
        .innerJoin(ticketTiers, eq(ticketTiers.id, reservations.ticketTierId))
        .innerJoin(schema.events, eq(schema.events.id, ticketTiers.eventId))
        .where(whereClause),
      database
        .select({
          id: reservations.id,
          status: reservations.status,
          quantity: reservations.quantity,
          expiresAt: reservations.expiresAt,
          createdAt: reservations.createdAt,
          buyerId: users.id,
          buyerName: users.fullName,
          buyerEmail: users.email,
          buyerPhone: users.phone,
          eventId: schema.events.id,
          eventTitle: schema.events.title,
          eventSlug: schema.events.slug,
          venueCity: schema.events.venueCity,
          startAt: schema.events.startAt,
          ticketTierId: ticketTiers.id,
          ticketTierName: ticketTiers.name,
          ticketTierStatus: ticketTiers.status,
        })
        .from(reservations)
        .innerJoin(users, eq(users.id, reservations.userId))
        .innerJoin(ticketTiers, eq(ticketTiers.id, reservations.ticketTierId))
        .innerJoin(schema.events, eq(schema.events.id, ticketTiers.eventId))
        .where(whereClause)
        .orderBy(desc(reservations.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        status: row.status,
        quantity: row.quantity,
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        remainingSeconds:
          row.status === 'active'
            ? Math.max(0, Math.ceil((row.expiresAt.getTime() - Date.now()) / 1000))
            : 0,
        buyer: {
          id: row.buyerId,
          fullName: row.buyerName,
          email: row.buyerEmail,
          phone: row.buyerPhone,
        },
        event: {
          id: row.eventId,
          title: row.eventTitle,
          slug: row.eventSlug,
          venueCity: row.venueCity,
          startAt: row.startAt.toISOString(),
        },
        ticketTier: {
          id: row.ticketTierId,
          name: row.ticketTierName,
          status: row.ticketTierStatus,
        },
      })),
      meta: {
        total: totalRow[0]?.total ?? 0,
        page,
        limit,
        totalPages: totalRow[0]?.total ? Math.ceil(totalRow[0].total / limit) : 0,
      },
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
        throw new ReservationServiceError(
          'DATABASE_UNAVAILABLE',
          'Database connection is not available.',
        );
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
