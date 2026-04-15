import { getDb, schema } from '@jeevatix/core';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';

const { reservations, ticketTiers } = schema;

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new Error('DATABASE_UNAVAILABLE');
  }

  return db;
}

export async function getActiveReservationCounts(tierIds: string[], databaseUrl?: string) {
  if (tierIds.length === 0) {
    return new Map<string, number>();
  }

  const database = getDatabase(databaseUrl);
  const rows = await database
    .select({
      ticketTierId: reservations.ticketTierId,
      quantity: sql<number>`coalesce(sum(${reservations.quantity}), 0)::int`,
    })
    .from(reservations)
    .where(
      and(
        inArray(reservations.ticketTierId, tierIds),
        eq(reservations.status, 'active'),
        gte(reservations.expiresAt, new Date()),
      ),
    )
    .groupBy(reservations.ticketTierId);

  return new Map(rows.map((row) => [row.ticketTierId, row.quantity]));
}

export async function getConvertedReservationCounts(tierIds: string[], databaseUrl?: string) {
  if (tierIds.length === 0) {
    return new Map<string, number>();
  }

  const database = getDatabase(databaseUrl);
  const rows = await database
    .select({
      ticketTierId: reservations.ticketTierId,
      quantity: sql<number>`coalesce(sum(${reservations.quantity}), 0)::int`,
    })
    .from(reservations)
    .where(and(inArray(reservations.ticketTierId, tierIds), eq(reservations.status, 'converted')))
    .groupBy(reservations.ticketTierId);

  return new Map(rows.map((row) => [row.ticketTierId, row.quantity]));
}

export async function getConvertedReservationCountsByEvent(
  eventIds: string[],
  databaseUrl?: string,
) {
  if (eventIds.length === 0) {
    return new Map<string, number>();
  }

  const database = getDatabase(databaseUrl);
  const rows = await database
    .select({
      eventId: ticketTiers.eventId,
      quantity: sql<number>`coalesce(sum(${reservations.quantity}), 0)::int`,
    })
    .from(reservations)
    .innerJoin(ticketTiers, eq(ticketTiers.id, reservations.ticketTierId))
    .where(and(inArray(ticketTiers.eventId, eventIds), eq(reservations.status, 'converted')))
    .groupBy(ticketTiers.eventId);

  return new Map(rows.map((row) => [row.eventId, row.quantity]));
}
