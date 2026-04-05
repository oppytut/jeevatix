import { getDb, schema } from '@jeevatix/core';
import { and, eq, sql } from 'drizzle-orm';

const RESERVATION_TTL_MINUTES = 10;

type TicketReserverEnv = {
  DATABASE_URL?: string;
  PARTYKIT_HOST?: string;
  PARTY_SECRET?: string;
};

type DurableObjectStateLike = {
  blockConcurrencyWhile<T>(closure: () => Promise<T>): Promise<T>;
  waitUntil?(promise: Promise<unknown>): void;
};

type TierState = {
  eventId: string;
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
  event_id: string;
  quota: number;
  sold_count: number;
  pending_reservations: number;
};

type ErrorResponse = {
  ok: false;
  error: 'BAD_REQUEST' | 'DATABASE_UNAVAILABLE' | 'NOT_FOUND' | 'INVALID_STATE';
  message: string;
};

type TimedStep = {
  step: string;
  durationMs: number;
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

const DurableObjectBase =
  (
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

function getPartyKitHost(envPartyKitHost?: string) {
  return envPartyKitHost ?? getProcessEnv('PARTYKIT_HOST');
}

function getPartySecret(envPartySecret?: string) {
  return envPartySecret ?? getProcessEnv('PARTY_SECRET');
}

function shouldProfileLoadTests() {
  return getProcessEnv('LOAD_TEST_PROFILE') === '1';
}

function logTimedSteps(scope: string, details: Record<string, unknown>, steps: TimedStep[]) {
  if (!shouldProfileLoadTests()) {
    return;
  }

  console.log(
    `[load-profile] ${scope}`,
    JSON.stringify({
      ...details,
      steps,
    }),
  );
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
        eventId: true,
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
      .where(and(eq(reservations.ticketTierId, tierId), eq(reservations.status, 'active')));

    const [convertedReservationAggregate] = await database
      .select({
        quantity: sql<number>`coalesce(sum(${reservations.quantity}), 0)::int`,
      })
      .from(reservations)
      .where(and(eq(reservations.ticketTierId, tierId), eq(reservations.status, 'converted')));

    const pendingReservations = Math.max(0, pendingReservationAggregate?.quantity ?? 0);
    const soldCount = Math.max(0, convertedReservationAggregate?.quantity ?? 0);

    return {
      eventId: tier.eventId,
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
      event_id: tierState.eventId,
      quota: tierState.quota,
      sold_count: tierState.soldCount,
      pending_reservations: tierState.pendingReservations,
    } satisfies InitializeResponse;
  }

  private async broadcastAvailability(tierId: string, tierState: TierState) {
    const partyKitHost = getPartyKitHost(this.env.PARTYKIT_HOST);
    const partySecret = getPartySecret(this.env.PARTY_SECRET);

    if (!partyKitHost || !partySecret || !tierState.eventId) {
      return;
    }

    try {
      await fetch(`https://${partyKitHost}/parties/main/event-${tierState.eventId}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-party-secret': partySecret,
        },
        body: JSON.stringify({
          type: 'availability',
          data: [
            {
              tierId,
              remaining: Math.max(
                0,
                tierState.quota - tierState.soldCount - tierState.pendingReservations,
              ),
            },
          ],
        }),
      });
    } catch (error) {
      console.error('Failed to broadcast PartyKit availability update.', error);
    }
  }

  private scheduleAvailabilityBroadcast(tierId: string, tierState: TierState) {
    const broadcastPromise = this.broadcastAvailability(tierId, tierState);

    if (this.ctx.waitUntil) {
      this.ctx.waitUntil(broadcastPromise);
      return;
    }

    void broadcastPromise;
  }

  async reserve(userId: string, tierId: string, quantity: number) {
    if (!userId) {
      throw new Error('USER_ID_REQUIRED');
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error('INVALID_QUANTITY');
    }

    const startedAt = Date.now();
    const steps: TimedStep[] = [];
    const ensureTierStartedAt = Date.now();
    const tierState = await this.ensureTierState(tierId);
    steps.push({
      step: 'ensure_tier_state',
      durationMs: Date.now() - ensureTierStartedAt,
    });
    const remaining = tierState.quota - tierState.soldCount - tierState.pendingReservations;

    if (remaining < quantity) {
      logTimedSteps(
        'ticketReserver.reserve',
        {
          tierId,
          outcome: 'sold_out',
          totalDurationMs: Date.now() - startedAt,
        },
        steps,
      );

      return {
        ok: false,
        error: 'SOLD_OUT',
      } satisfies SoldOutResponse;
    }

    tierState.pendingReservations += quantity;

    try {
      const reservationId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);
      const database = this.getDatabase();
      const insertReservationStartedAt = Date.now();
      await database.insert(reservations).values({
        id: reservationId,
        userId,
        ticketTierId: tierId,
        quantity,
        status: 'active',
        expiresAt,
      });
      steps.push({
        step: 'insert_reservation',
        durationMs: Date.now() - insertReservationStartedAt,
      });

      logTimedSteps(
        'ticketReserver.reserve',
        {
          tierId,
          outcome: 'success',
          totalDurationMs: Date.now() - startedAt,
        },
        steps,
      );

      return {
        ok: true,
        reservation_id: reservationId,
        expires_at: expiresAt.toISOString(),
      } satisfies SuccessfulReserveResponse;
    } catch (error) {
      tierState.pendingReservations = Math.max(0, tierState.pendingReservations - quantity);
      throw error;
    } finally {
      this.scheduleAvailabilityBroadcast(tierId, tierState);
    }
  }

  private applyConvertedReservation(tierId: string, quantity: number) {
    const tierState = this.tierStates.get(tierId);

    if (!tierState) {
      return null;
    }

    tierState.pendingReservations = Math.max(0, tierState.pendingReservations - quantity);
    tierState.soldCount += quantity;

    return tierState;
  }

  private async confirmActiveReservation(reservationId: string) {
    const database = this.getDatabase();
    const [confirmedReservation] = await database
      .update(reservations)
      .set({ status: 'converted' })
      .where(and(eq(reservations.id, reservationId), eq(reservations.status, 'active')))
      .returning({
        id: reservations.id,
        ticketTierId: reservations.ticketTierId,
        quantity: reservations.quantity,
      });

    if (!confirmedReservation) {
      return null;
    }

    const cachedTierState = this.applyConvertedReservation(
      confirmedReservation.ticketTierId,
      confirmedReservation.quantity,
    );

    if (!cachedTierState) {
      await this.ensureTierState(confirmedReservation.ticketTierId);
    }

    return {
      ok: true,
      reservation_id: confirmedReservation.id,
      status: 'converted',
    } satisfies ReservationStateResponse;
  }

  private async updateReservationState(
    reservationId: string,
    nextStatus: 'cancelled' | 'converted' | 'expired',
  ) {
    if (!reservationId) {
      throw new Error('RESERVATION_ID_REQUIRED');
    }

    const database = this.getDatabase();

    if (nextStatus === 'converted') {
      const confirmedReservation = await this.confirmActiveReservation(reservationId);

      if (confirmedReservation) {
        return confirmedReservation;
      }
    }

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

    if (reservation.status === 'cancelled' || reservation.status === 'expired') {
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

    let tierState = await this.ensureTierState(reservation.ticketTierId);

    if (nextStatus === 'converted') {
      if (reservation.status !== 'active') {
        const cachedTierState = this.tierStates.get(reservation.ticketTierId);

        if (cachedTierState && cachedTierState.pendingReservations >= reservation.quantity) {
          cachedTierState.pendingReservations = Math.max(
            0,
            cachedTierState.pendingReservations - reservation.quantity,
          );
          cachedTierState.soldCount += reservation.quantity;
          this.scheduleAvailabilityBroadcast(reservation.ticketTierId, cachedTierState);

          return {
            ok: true,
            reservation_id: reservation.id,
            status: reservation.status,
          } satisfies ReservationStateResponse;
        }

        const refreshedTierState = await this.loadTierState(reservation.ticketTierId);

        if (refreshedTierState) {
          this.tierStates.set(reservation.ticketTierId, refreshedTierState);
          this.scheduleAvailabilityBroadcast(reservation.ticketTierId, refreshedTierState);
        }

        return {
          ok: true,
          reservation_id: reservation.id,
          status: reservation.status,
        } satisfies ReservationStateResponse;
      }

      this.applyConvertedReservation(reservation.ticketTierId, reservation.quantity);

      await database
        .update(reservations)
        .set({ status: 'converted' })
        .where(eq(reservations.id, reservation.id));
    } else {
      if (reservation.status === 'active') {
        tierState.pendingReservations = Math.max(
          0,
          tierState.pendingReservations - reservation.quantity,
        );
        await database
          .update(reservations)
          .set({ status: nextStatus })
          .where(eq(reservations.id, reservation.id));
      } else {
        const refreshedTierState = await this.loadTierState(reservation.ticketTierId);

        if (refreshedTierState) {
          this.tierStates.set(reservation.ticketTierId, refreshedTierState);
          tierState = refreshedTierState;
        }

        tierState.soldCount = Math.max(0, tierState.soldCount - reservation.quantity);

        await database
          .update(reservations)
          .set({ status: nextStatus })
          .where(eq(reservations.id, reservation.id));
      }

      this.scheduleAvailabilityBroadcast(reservation.ticketTierId, tierState);
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
