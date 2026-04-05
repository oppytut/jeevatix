import { getDb, schema } from '@jeevatix/core';
import { and, desc, eq, sql } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';

import type { ListTicketsQuery, TicketDetail, TicketListItem } from '../schemas/ticket.schema';

const { events, orderItems, orders, ticketCheckins, ticketTiers, tickets } = schema;

const generateTicketId = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 12);

type IssuedTicket = {
  id: string;
  order_id: string;
  ticket_tier_id: string;
  ticket_code: string;
  status: 'valid' | 'used' | 'cancelled' | 'refunded';
  issued_at: string;
};

export class TicketServiceError extends Error {
  constructor(
    public readonly code:
      | 'DATABASE_UNAVAILABLE'
      | 'FORBIDDEN'
      | 'ORDER_NOT_FOUND'
      | 'TICKET_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'TicketServiceError';
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
    throw new TicketServiceError('DATABASE_UNAVAILABLE', 'Database connection is not available.');
  }

  return db;
}

export function buildTicketCode(ticketId = generateTicketId()) {
  return `JVX-${ticketId}`;
}

function toIssuedTicket(row: {
  id: string;
  orderId: string;
  ticketTierId: string;
  ticketCode: string;
  status: 'valid' | 'used' | 'cancelled' | 'refunded';
  issuedAt: Date;
}): IssuedTicket {
  return {
    id: row.id,
    order_id: row.orderId,
    ticket_tier_id: row.ticketTierId,
    ticket_code: row.ticketCode,
    status: row.status,
    issued_at: row.issuedAt.toISOString(),
  };
}

function toTicketListItem(row: {
  id: string;
  orderId: string;
  orderNumber: string;
  ticketTierId: string;
  tierName: string;
  ticketCode: string;
  status: 'valid' | 'used' | 'cancelled' | 'refunded';
  issuedAt: Date;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  eventStartAt: Date;
  venueName: string;
  venueCity: string;
}): TicketListItem {
  return {
    id: row.id,
    order_id: row.orderId,
    order_number: row.orderNumber,
    ticket_tier_id: row.ticketTierId,
    tier_name: row.tierName,
    ticket_code: row.ticketCode,
    status: row.status,
    issued_at: row.issuedAt.toISOString(),
    event_id: row.eventId,
    event_slug: row.eventSlug,
    event_title: row.eventTitle,
    event_start_at: row.eventStartAt.toISOString(),
    venue_name: row.venueName,
    venue_city: row.venueCity,
  };
}

function toTicketDetail(row: {
  id: string;
  orderId: string;
  orderNumber: string;
  ticketTierId: string;
  tierName: string;
  ticketCode: string;
  attendeeName: string | null;
  attendeeEmail: string | null;
  status: 'valid' | 'used' | 'cancelled' | 'refunded';
  issuedAt: Date;
  checkedInAt: Date | null;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  eventBannerUrl: string | null;
  eventStartAt: Date;
  eventEndAt: Date;
  venueName: string;
  venueAddress: string | null;
  venueCity: string;
}): TicketDetail {
  return {
    id: row.id,
    order_id: row.orderId,
    order_number: row.orderNumber,
    ticket_tier_id: row.ticketTierId,
    tier_name: row.tierName,
    ticket_code: row.ticketCode,
    qr_data: row.ticketCode,
    attendee_name: row.attendeeName,
    attendee_email: row.attendeeEmail,
    status: row.status,
    issued_at: row.issuedAt.toISOString(),
    checked_in_at: row.checkedInAt?.toISOString() ?? null,
    event: {
      id: row.eventId,
      slug: row.eventSlug,
      title: row.eventTitle,
      banner_url: row.eventBannerUrl,
      start_at: row.eventStartAt.toISOString(),
      end_at: row.eventEndAt.toISOString(),
      venue_name: row.venueName,
      venue_address: row.venueAddress,
      venue_city: row.venueCity,
    },
  };
}

export async function generateTickets(orderId: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const issuedTickets = await database.transaction(async (tx) => {
    await tx.execute(sql`select ${orders.id} from ${orders} where ${orders.id} = ${orderId} for update`);

    const order = await tx.query.orders.findFirst({
      where: eq(orders.id, orderId),
      columns: {
        id: true,
      },
      with: {
        orderItems: {
          columns: {
            id: true,
            ticketTierId: true,
            quantity: true,
          },
        },
        tickets: {
          columns: {
            id: true,
            orderId: true,
            ticketTierId: true,
            ticketCode: true,
            status: true,
            issuedAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new TicketServiceError('ORDER_NOT_FOUND', 'Order not found.');
    }

    const existingTicketsByTier = order.tickets.reduce<Map<string, number>>(
      (accumulator, ticket) => {
        accumulator.set(ticket.ticketTierId, (accumulator.get(ticket.ticketTierId) ?? 0) + 1);
        return accumulator;
      },
      new Map(),
    );

    const newTickets = order.orderItems.flatMap((item) => {
      const existingCount = existingTicketsByTier.get(item.ticketTierId) ?? 0;
      const remainingCount = Math.max(item.quantity - existingCount, 0);

      return Array.from({ length: remainingCount }, () => ({
        orderId,
        ticketTierId: item.ticketTierId,
        ticketCode: buildTicketCode(),
      }));
    });

    if (newTickets.length > 0) {
      await tx.insert(tickets).values(newTickets);
    }

    return tx.query.tickets.findMany({
      where: eq(tickets.orderId, orderId),
      columns: {
        id: true,
        orderId: true,
        ticketTierId: true,
        ticketCode: true,
        status: true,
        issuedAt: true,
      },
      orderBy: [tickets.issuedAt, tickets.createdAt],
    });
  });

  return issuedTickets.map(toIssuedTicket);
}

export const ticketService = {
  generateTickets,

  async listTickets(userId: string, query: ListTicketsQuery, databaseUrl?: string) {
    const database = getDatabase(databaseUrl);
    const page = query.page;
    const limit = query.limit;
    const offset = (page - 1) * limit;

    const [countResult, rows] = await Promise.all([
      database
        .select({ total: sql<number>`count(*)` })
        .from(tickets)
        .innerJoin(orders, eq(tickets.orderId, orders.id))
        .where(eq(orders.userId, userId)),
      database
        .select({
          id: tickets.id,
          orderId: tickets.orderId,
          orderNumber: orders.orderNumber,
          ticketTierId: tickets.ticketTierId,
          tierName: ticketTiers.name,
          ticketCode: tickets.ticketCode,
          status: tickets.status,
          issuedAt: tickets.issuedAt,
          eventId: events.id,
          eventSlug: events.slug,
          eventTitle: events.title,
          eventStartAt: events.startAt,
          venueName: events.venueName,
          venueCity: events.venueCity,
        })
        .from(tickets)
        .innerJoin(orders, eq(tickets.orderId, orders.id))
        .innerJoin(ticketTiers, eq(tickets.ticketTierId, ticketTiers.id))
        .innerJoin(events, eq(ticketTiers.eventId, events.id))
        .where(eq(orders.userId, userId))
        .orderBy(desc(tickets.issuedAt), desc(tickets.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.total ?? 0);

    return {
      data: rows.map(toTicketListItem),
      meta: {
        total,
        page,
        limit,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  },

  async getTicketDetail(userId: string, ticketId: string, databaseUrl?: string) {
    const database = getDatabase(databaseUrl);
    const [row] = await database
      .select({
        id: tickets.id,
        orderId: tickets.orderId,
        orderNumber: orders.orderNumber,
        orderUserId: orders.userId,
        ticketTierId: tickets.ticketTierId,
        tierName: ticketTiers.name,
        ticketCode: tickets.ticketCode,
        attendeeName: tickets.attendeeName,
        attendeeEmail: tickets.attendeeEmail,
        status: tickets.status,
        issuedAt: tickets.issuedAt,
        checkedInAt: ticketCheckins.checkedInAt,
        eventId: events.id,
        eventSlug: events.slug,
        eventTitle: events.title,
        eventBannerUrl: events.bannerUrl,
        eventStartAt: events.startAt,
        eventEndAt: events.endAt,
        venueName: events.venueName,
        venueAddress: events.venueAddress,
        venueCity: events.venueCity,
      })
      .from(tickets)
      .innerJoin(orders, eq(tickets.orderId, orders.id))
      .innerJoin(ticketTiers, eq(tickets.ticketTierId, ticketTiers.id))
      .innerJoin(events, eq(ticketTiers.eventId, events.id))
      .leftJoin(ticketCheckins, eq(ticketCheckins.ticketId, tickets.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!row) {
      throw new TicketServiceError('TICKET_NOT_FOUND', 'Ticket not found.');
    }

    if (row.orderUserId !== userId) {
      throw new TicketServiceError('FORBIDDEN', 'You do not have access to this ticket.');
    }

    return toTicketDetail(row);
  },
};
