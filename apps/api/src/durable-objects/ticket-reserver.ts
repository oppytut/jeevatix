import { getDb, schema } from '@jeevatix/core';
import { and, eq, sql } from 'drizzle-orm';

const RESERVATION_TTL_MINUTES = 10;

type TicketReserverEnv = {
  DATABASE_URL?: string;
};

type DurableObjectStateLike = {
  blockConcurrencyWhile<T>(closure: () => Promise<T>): Promise<T>;
};

type TierState = {
  quota: number;
  soldCount: number;
  pendingReservations: number;
};

type InitializeRequest = {
  action: 'initialize';
  tierId: string;
};

type ReserveRequest = {
  action: 'reserve';
  userId: string;
  tierId: string;
  quantity: number;
};

type CancelRequest = {
  action: 'cancel';
  reservationId: string;
  status?: 'cancelled' | 'expired';
};

type ConfirmRequest = {
  action: 'confirm';
  reservationId: string;
};

type AvailabilityRequest = {
  action: 'availability';
  tierId: string;
};

type TicketReserverRequest =
  | InitializeRequest
  | ReserveRequest
  | CancelRequest
  | ConfirmRequest
  | AvailabilityRequest;

type SuccessfulReserveResponse = {
  ok: true;
  reservation_id: string;
  expires_at: string;
};

type SoldOutResponse = {
  ok: false;
  error: 'SOLD_OUT';
};

type AvailabilityResponse = {
  ok: true;
  tier_id: string;
  remaining: number;
};

type ReservationStateResponse = {
  ok: true;
  reservation_id: string;
  status: 'cancelled' | 'converted' | 'expired';
};

type InitializeResponse = {
  ok: true;
  tier_id: string;
  quota: number;
  sold_count: number;
  pending_reservations: number;
};

type ErrorResponse = {
  ok: false;
  error: 'BAD_REQUEST' | 'DATABASE_UNAVAILABLE' | 'NOT_FOUND' | 'INVALID_STATE';
  message: string;
};

const { reservations, ticketTiers } = schema;

class TicketReserverBase {
  protected readonly ctx: DurableObjectStateLike;
  protected readonly env: TicketReserverEnv;

  constructor(ctx: DurableObjectStateLike, env: TicketReserverEnv) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(_request: Request) {
    return new Response(null, { status: 501 });
  }
}

const DurableObjectBase = (
  globalThis as typeof globalThis & {
    DurableObject?: new (
      ctx: DurableObjectStateLike,
      env: TicketReserverEnv,
    ) => TicketReserverBase;
  }
).DurableObject ?? TicketReserverBase;

function getProcessEnv(key: string) {
  return (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[key];
}

function getDatabaseUrl(envDatabaseUrl?: string) {
  return envDatabaseUrl ?? getProcessEnv('DATABASE_URL');
}

function badRequest(message: string): Response {
  return Response.json(
    {
      ok: false,
      error: 'BAD_REQUEST',
      message,
    } satisfies ErrorResponse,
    { status: 400 },
  );
}

function notFound(message: string): Response {
  return Response.json(
    {
      ok: false,
      error: 'NOT_FOUND',
      message,
    } satisfies ErrorResponse,
    { status: 404 },
  );
}

function invalidState(message: string): Response {
  return Response.json(
    {
      ok: false,
      error: 'INVALID_STATE',
      message,
    } satisfies ErrorResponse,
    { status: 409 },
  );
}

function databaseUnavailable(): Response {
  return Response.json(
    {
      ok: false,
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database connection is not available.',
    } satisfies ErrorResponse,
    { status: 500 },
  );
}

export class TicketReserver extends DurableObjectBase {
  private readonly tierStates = new Map<string, TierState>();

  private getDatabase() {
    const database = getDb(getDatabaseUrl(this.env.DATABASE_URL));

    if (!database) {
      throw new Error('DATABASE_UNAVAILABLE');
    }

    return database;
  }

  private async loadTierState(tierId: string) {
    const database = this.getDatabase();
    const tier = await database.query.ticketTiers.findFirst({
      where: eq(ticketTiers.id, tierId),
      columns: {
        id: true,
        quota: true,
        soldCount: true,
      },
    });

    if (!tier) {
      return null;
    }

    const [pendingReservationAggregate] = await database
      .select({
        quantity: sql<number>`coalesce(sum(${reservations.quantity}), 0)::int`,
      })
      .from(reservations)
      .where(
        and(eq(reservations.ticketTierId, tierId), eq(reservations.status, 'active')),
      );

    const pendingReservations = Math.max(0, pendingReservationAggregate?.quantity ?? 0);
    const soldCount = Math.max(0, tier.soldCount - pendingReservations);

    return {
      quota: tier.quota,
      soldCount,
      pendingReservations,
    } satisfies TierState;
  }

  private async ensureTierState(tierId: string) {
    if (!tierId) {
      throw new Error('TIER_ID_REQUIRED');
    }

    if (this.tierStates.has(tierId)) {
      return this.tierStates.get(tierId) as TierState;
    }

    await this.ctx.blockConcurrencyWhile(async () => {
      if (this.tierStates.has(tierId)) {
        return;
      }

      const tierState = await this.loadTierState(tierId);

      if (!tierState) {
        throw new Error('TIER_NOT_FOUND');
      }

      this.tierStates.set(tierId, tierState);
    });

    return this.tierStates.get(tierId) as TierState;
  }

  async initialize(tierId: string) {
    const tierState = await this.ensureTierState(tierId);

    return {
      ok: true,
      tier_id: tierId,
      quota: tierState.quota,
      sold_count: tierState.soldCount,
      pending_reservations: tierState.pendingReservations,
    } satisfies InitializeResponse;
  }

  async reserve(userId: string, tierId: string, quantity: number) {
    if (!userId) {
      throw new Error('USER_ID_REQUIRED');
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error('INVALID_QUANTITY');
    }

    const tierState = await this.ensureTierState(tierId);
    const remaining = tierState.quota - tierState.soldCount - tierState.pendingReservations;

    if (remaining < quantity) {
      return {
        ok: false,
        error: 'SOLD_OUT',
      } satisfies SoldOutResponse;
    }

    tierState.pendingReservations += quantity;

    try {
      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);
      const database = this.getDatabase();
      const reservation = await database.transaction(async (tx) => {
        const [createdReservation] = await tx
          .insert(reservations)
          .values({
            userId,
            ticketTierId: tierId,
            quantity,
            status: 'active',
            expiresAt,
          })
          .returning({
            id: reservations.id,
            expiresAt: reservations.expiresAt,
          });

        await tx
          .update(ticketTiers)
          .set({
            soldCount: sql`${ticketTiers.soldCount} + ${quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(ticketTiers.id, tierId));

        return createdReservation;
      });

      return {
        ok: true,
        reservation_id: reservation.id,
        expires_at: reservation.expiresAt.toISOString(),
      } satisfies SuccessfulReserveResponse;
    } catch (error) {
      tierState.pendingReservations = Math.max(0, tierState.pendingReservations - quantity);
      throw error;
    }
  }

  private async updateReservationState(
    reservationId: string,
    nextStatus: 'cancelled' | 'converted' | 'expired',
  ) {
    if (!reservationId) {
      throw new Error('RESERVATION_ID_REQUIRED');
    }

    const database = this.getDatabase();
    const reservation = await database.query.reservations.findFirst({
      where: eq(reservations.id, reservationId),
      columns: {
        id: true,
        ticketTierId: true,
        quantity: true,
        status: true,
      },
    });

    if (!reservation) {
      throw new Error('RESERVATION_NOT_FOUND');
    }

    if (reservation.status !== 'active') {
      const refreshedTierState = await this.loadTierState(reservation.ticketTierId);

      if (refreshedTierState) {
        this.tierStates.set(reservation.ticketTierId, refreshedTierState);
      }

      return {
        ok: true,
        reservation_id: reservation.id,
        status: reservation.status,
      } satisfies ReservationStateResponse;
    }

    const tierState = await this.ensureTierState(reservation.ticketTierId);

    if (nextStatus === 'converted') {
      tierState.pendingReservations = Math.max(0, tierState.pendingReservations - reservation.quantity);
      tierState.soldCount += reservation.quantity;

      await database
        .update(reservations)
        .set({ status: 'converted' })
        .where(eq(reservations.id, reservation.id));
    } else {
      tierState.pendingReservations = Math.max(0, tierState.pendingReservations - reservation.quantity);

      await database.transaction(async (tx) => {
        await tx
          .update(reservations)
          .set({ status: nextStatus })
          .where(eq(reservations.id, reservation.id));

        await tx
          .update(ticketTiers)
          .set({
            soldCount: sql`${ticketTiers.soldCount} - ${reservation.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(ticketTiers.id, reservation.ticketTierId));
      });
    }

    return {
      ok: true,
      reservation_id: reservation.id,
      status: nextStatus,
    } satisfies ReservationStateResponse;
  }

  async cancelReservation(reservationId: string, status: 'cancelled' | 'expired' = 'cancelled') {
    return this.updateReservationState(reservationId, status);
  }

  async confirmReservation(reservationId: string) {
    return this.updateReservationState(reservationId, 'converted');
  }

  async getAvailability(tierId: string) {
    const tierState = await this.ensureTierState(tierId);

    return {
      ok: true,
      tier_id: tierId,
      remaining: Math.max(0, tierState.quota - tierState.soldCount - tierState.pendingReservations),
    } satisfies AvailabilityResponse;
  }

  override async fetch(request: Request) {
    let payload: TicketReserverRequest;

    try {
      payload = (await request.json()) as TicketReserverRequest;
    } catch {
      return badRequest('Request body must be valid JSON.');
    }

    try {
      switch (payload.action) {
        case 'initialize':
          return Response.json(await this.initialize(payload.tierId));
        case 'reserve': {
          const result = await this.reserve(payload.userId, payload.tierId, payload.quantity);

          if (!result.ok) {
            return Response.json(result, { status: 409 });
          }

          return Response.json(result);
        }
        case 'cancel':
          return Response.json(
            await this.cancelReservation(payload.reservationId, payload.status ?? 'cancelled'),
          );
        case 'confirm':
          return Response.json(await this.confirmReservation(payload.reservationId));
        case 'availability':
          return Response.json(await this.getAvailability(payload.tierId));
        default:
          return badRequest('Unsupported TicketReserver action.');
      }
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'DATABASE_UNAVAILABLE':
            return databaseUnavailable();
          case 'INVALID_QUANTITY':
            return badRequest('Quantity must be a positive integer.');
          case 'USER_ID_REQUIRED':
            return badRequest('userId is required.');
          case 'TIER_ID_REQUIRED':
            return badRequest('tierId is required.');
          case 'RESERVATION_ID_REQUIRED':
            return badRequest('reservationId is required.');
          case 'TIER_NOT_FOUND':
            return notFound('Ticket tier not found.');
          case 'RESERVATION_NOT_FOUND':
            return notFound('Reservation not found.');
          default:
            return invalidState(error.message);
        }
      }

      return invalidState('Unexpected durable object error.');
    }
  }
}