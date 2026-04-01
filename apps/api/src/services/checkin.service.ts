import { getDb, schema } from '@jeevatix/core';
import { and, desc, eq, sql } from 'drizzle-orm';

import type { CheckinResult, CheckinStats } from '../schemas/checkin.schema';

const { events, orders, sellerProfiles, ticketCheckins, ticketTiers, tickets, users } = schema;

export class CheckinServiceError extends Error {
  constructor(
    public readonly code: 'DATABASE_UNAVAILABLE' | 'EVENT_NOT_FOUND' | 'FORBIDDEN',
    message: string,
  ) {
    super(message);
    this.name = 'CheckinServiceError';
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
    throw new CheckinServiceError('DATABASE_UNAVAILABLE', 'Database connection is not available.');
  }

  return db;
}

function normalizeTicketCode(ticketCode: string) {
  return ticketCode.trim().toUpperCase();
}

function buildInvalidResult(ticketCode: string): CheckinResult {
  return {
    status: 'INVALID',
    ticket_id: null,
    ticket_code: ticketCode,
    buyer_name: null,
    buyer_email: null,
    tier_name: null,
    checked_in_at: null,
    message: 'Ticket code is invalid for this event.',
  };
}

function buildAlreadyUsedResult(row: {
  ticketId: string;
  ticketCode: string;
  buyerName: string | null;
  buyerEmail: string | null;
  tierName: string;
  checkedInAt: Date | null;
}): CheckinResult {
  return {
    status: 'ALREADY_USED',
    ticket_id: row.ticketId,
    ticket_code: row.ticketCode,
    buyer_name: row.buyerName,
    buyer_email: row.buyerEmail,
    tier_name: row.tierName,
    checked_in_at: row.checkedInAt?.toISOString() ?? null,
    message: 'This ticket has already been checked in.',
  };
}

async function getOwnedEvent(sellerId: string, eventId: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);

  const [ownedEvent] = await database
    .select({
      id: events.id,
      title: events.title,
    })
    .from(events)
    .innerJoin(sellerProfiles, eq(events.sellerProfileId, sellerProfiles.id))
    .where(and(eq(events.id, eventId), eq(sellerProfiles.userId, sellerId)))
    .limit(1);

  if (ownedEvent) {
    return ownedEvent;
  }

  const eventExists = await database.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { id: true },
  });

  if (!eventExists) {
    throw new CheckinServiceError('EVENT_NOT_FOUND', 'Event not found.');
  }

  throw new CheckinServiceError('FORBIDDEN', 'You do not have access to this event.');
}

async function getCheckinCandidate(eventId: string, ticketCode: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);

  const [row] = await database
    .select({
      ticketId: tickets.id,
      ticketCode: tickets.ticketCode,
      ticketStatus: tickets.status,
      buyerName: users.fullName,
      buyerEmail: users.email,
      tierName: ticketTiers.name,
      checkedInAt: ticketCheckins.checkedInAt,
    })
    .from(tickets)
    .innerJoin(ticketTiers, eq(tickets.ticketTierId, ticketTiers.id))
    .innerJoin(events, eq(ticketTiers.eventId, events.id))
    .innerJoin(orders, eq(tickets.orderId, orders.id))
    .innerJoin(users, eq(orders.userId, users.id))
    .leftJoin(ticketCheckins, eq(ticketCheckins.ticketId, tickets.id))
    .where(and(eq(events.id, eventId), eq(tickets.ticketCode, ticketCode)))
    .limit(1);

  return row ?? null;
}

export const checkinService = {
  async checkin(
    sellerId: string,
    eventId: string,
    ticketCode: string,
    databaseUrl?: string,
  ): Promise<CheckinResult> {
    await getOwnedEvent(sellerId, eventId, databaseUrl);

    const normalizedCode = normalizeTicketCode(ticketCode);
    const database = getDatabase(databaseUrl);
    const candidate = await getCheckinCandidate(eventId, normalizedCode, databaseUrl);

    if (!candidate) {
      return buildInvalidResult(normalizedCode);
    }

    if (candidate.ticketStatus === 'used' || candidate.checkedInAt) {
      return buildAlreadyUsedResult(candidate);
    }

    if (candidate.ticketStatus !== 'valid') {
      return buildInvalidResult(candidate.ticketCode);
    }

    return database.transaction(async (transaction) => {
      const [updatedTicket] = await transaction
        .update(tickets)
        .set({ status: 'used' })
        .where(and(eq(tickets.id, candidate.ticketId), eq(tickets.status, 'valid')))
        .returning({ id: tickets.id });

      if (!updatedTicket) {
        const latestCandidate = await getCheckinCandidate(eventId, normalizedCode, databaseUrl);

        if (latestCandidate && (latestCandidate.ticketStatus === 'used' || latestCandidate.checkedInAt)) {
          return buildAlreadyUsedResult(latestCandidate);
        }

        return buildInvalidResult(normalizedCode);
      }

      const [checkinRecord] = await transaction
        .insert(ticketCheckins)
        .values({
          ticketId: candidate.ticketId,
          checkedInBy: sellerId,
        })
        .returning({
          checkedInAt: ticketCheckins.checkedInAt,
        });

      return {
        status: 'SUCCESS',
        ticket_id: candidate.ticketId,
        ticket_code: candidate.ticketCode,
        buyer_name: candidate.buyerName,
        buyer_email: candidate.buyerEmail,
        tier_name: candidate.tierName,
        checked_in_at: checkinRecord.checkedInAt.toISOString(),
        message: 'Ticket checked in successfully.',
      } satisfies CheckinResult;
    });
  },

  async getStats(sellerId: string, eventId: string, databaseUrl?: string): Promise<CheckinStats> {
    const ownedEvent = await getOwnedEvent(sellerId, eventId, databaseUrl);
    const database = getDatabase(databaseUrl);

    const [totalsRow, recentCheckins] = await Promise.all([
      database
        .select({
          totalTickets: sql<number>`count(${tickets.id})::int`,
          checkedIn: sql<number>`count(${ticketCheckins.id})::int`,
        })
        .from(ticketTiers)
        .leftJoin(tickets, eq(tickets.ticketTierId, ticketTiers.id))
        .leftJoin(ticketCheckins, eq(ticketCheckins.ticketId, tickets.id))
        .where(eq(ticketTiers.eventId, eventId)),
      database
        .select({
          id: ticketCheckins.id,
          ticketId: tickets.id,
          ticketCode: tickets.ticketCode,
          buyerName: users.fullName,
          buyerEmail: users.email,
          tierName: ticketTiers.name,
          checkedInAt: ticketCheckins.checkedInAt,
        })
        .from(ticketCheckins)
        .innerJoin(tickets, eq(ticketCheckins.ticketId, tickets.id))
        .innerJoin(ticketTiers, eq(tickets.ticketTierId, ticketTiers.id))
        .innerJoin(orders, eq(tickets.orderId, orders.id))
        .innerJoin(users, eq(orders.userId, users.id))
        .where(eq(ticketTiers.eventId, eventId))
        .orderBy(desc(ticketCheckins.checkedInAt))
        .limit(10),
    ]);

    const totalTickets = Number(totalsRow[0]?.totalTickets ?? 0);
    const checkedIn = Number(totalsRow[0]?.checkedIn ?? 0);
    const remaining = Math.max(totalTickets - checkedIn, 0);

    return {
      event_id: ownedEvent.id,
      event_title: ownedEvent.title,
      total_tickets: totalTickets,
      checked_in: checkedIn,
      remaining,
      percentage: totalTickets === 0 ? 0 : Number(((checkedIn / totalTickets) * 100).toFixed(2)),
      recent_checkins: recentCheckins.map((item) => ({
        id: item.id,
        ticket_id: item.ticketId,
        ticket_code: item.ticketCode,
        buyer_name: item.buyerName,
        buyer_email: item.buyerEmail,
        tier_name: item.tierName,
        checked_in_at: item.checkedInAt.toISOString(),
      })),
    };
  },
};
