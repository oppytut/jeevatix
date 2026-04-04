import { getDb, schema } from '@jeevatix/core';
import { and, count, desc, eq, exists, gte, inArray, sql, sum } from 'drizzle-orm';

import type {
  SellerDashboard,
  SellerDashboardDailySalesPoint,
  SellerDashboardRecentOrder,
} from '../schemas/seller-dashboard.schema';

const { events, orderItems, orders, payments, ticketTiers } = schema;

const UPCOMING_EVENT_STATUSES = ['draft', 'pending_review', 'published', 'ongoing'] as const;

export class SellerDashboardServiceError extends Error {
  constructor(
    public readonly code: 'DATABASE_UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'SellerDashboardServiceError';
  }
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new SellerDashboardServiceError(
      'DATABASE_UNAVAILABLE',
      'Database connection is not available.',
    );
  }

  return db;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === 'number' ? value : Number(value);
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildSellerOrderExistsCondition(
  database: ReturnType<typeof getDatabase>,
  sellerProfileId: string,
) {
  return exists(
    database
      .select({ id: orderItems.id })
      .from(orderItems)
      .innerJoin(ticketTiers, eq(ticketTiers.id, orderItems.ticketTierId))
      .innerJoin(events, eq(events.id, ticketTiers.eventId))
      .where(and(eq(orderItems.orderId, orders.id), eq(events.sellerProfileId, sellerProfileId))),
  );
}

function buildDailySales(
  days: number,
  rows: Array<{ date: string; ticketsSold: number | string | null }>,
) {
  const ticketsByDay = new Map(rows.map((row) => [row.date, toNumber(row.ticketsSold)]));
  const endDate = startOfDay(new Date());
  const startDate = addDays(endDate, -(days - 1));
  const points: SellerDashboardDailySalesPoint[] = [];

  for (let index = 0; index < days; index += 1) {
    const currentDate = addDays(startDate, index);
    const dateKey = formatDateKey(currentDate);

    points.push({
      date: dateKey,
      tickets_sold: ticketsByDay.get(dateKey) ?? 0,
    });
  }

  return points;
}

function toRecentOrder(record: {
  id: string;
  orderNumber: string;
  totalAmount: string;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  createdAt: Date;
  user: {
    fullName: string;
  } | null;
  orderItems: Array<{
    ticketTier: {
      event: {
        title: string;
      } | null;
    } | null;
  }>;
}): SellerDashboardRecentOrder {
  const eventTitle =
    record.orderItems.find((item) => item.ticketTier?.event)?.ticketTier?.event?.title ??
    'Untitled Event';

  return {
    id: record.id,
    order_number: record.orderNumber,
    event_title: eventTitle,
    buyer_name: record.user?.fullName ?? 'Unknown Buyer',
    total_amount: toNumber(record.totalAmount),
    status: record.status,
    created_at: record.createdAt.toISOString(),
  };
}

export const sellerDashboardService = {
  async getDashboard(sellerProfileId: string, databaseUrl?: string): Promise<SellerDashboard> {
    const database = getDatabase(databaseUrl);
    const sellerOrderExistsCondition = buildSellerOrderExistsCondition(database, sellerProfileId);
    const thirtyDaysAgo = addDays(startOfDay(new Date()), -29);

    const [
      totalEventsRow,
      upcomingEventsRow,
      revenueRow,
      ticketsSoldRow,
      recentOrderRecords,
      dailySalesRows,
    ] = await Promise.all([
      database
        .select({ total: count() })
        .from(events)
        .where(eq(events.sellerProfileId, sellerProfileId)),
      database
        .select({ total: count() })
        .from(events)
        .where(
          and(
            eq(events.sellerProfileId, sellerProfileId),
            gte(events.startAt, new Date()),
            inArray(events.status, UPCOMING_EVENT_STATUSES),
          ),
        ),
      database
        .select({
          totalRevenue: sql<string>`coalesce(sum(${payments.amount}), 0)`,
        })
        .from(orders)
        .innerJoin(payments, eq(payments.orderId, orders.id))
        .where(
          and(
            eq(orders.status, 'confirmed'),
            eq(payments.status, 'success'),
            sellerOrderExistsCondition,
          ),
        ),
      database
        .select({
          totalTicketsSold: sum(orderItems.quantity),
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .innerJoin(payments, eq(payments.orderId, orders.id))
        .innerJoin(ticketTiers, eq(ticketTiers.id, orderItems.ticketTierId))
        .innerJoin(events, eq(events.id, ticketTiers.eventId))
        .where(
          and(
            eq(events.sellerProfileId, sellerProfileId),
            eq(orders.status, 'confirmed'),
            eq(payments.status, 'success'),
          ),
        ),
      database.query.orders.findMany({
        where: sellerOrderExistsCondition,
        orderBy: [desc(orders.createdAt)],
        limit: 5,
        with: {
          user: {
            columns: {
              fullName: true,
            },
          },
          orderItems: {
            columns: {},
            with: {
              ticketTier: {
                columns: {},
                with: {
                  event: {
                    columns: {
                      title: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      database
        .select({
          date: sql<string>`to_char(date_trunc('day', ${orders.confirmedAt}), 'YYYY-MM-DD')`,
          ticketsSold: sql<string>`coalesce(sum(${orderItems.quantity}), 0)`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .innerJoin(payments, eq(payments.orderId, orders.id))
        .innerJoin(ticketTiers, eq(ticketTiers.id, orderItems.ticketTierId))
        .innerJoin(events, eq(events.id, ticketTiers.eventId))
        .where(
          and(
            eq(events.sellerProfileId, sellerProfileId),
            eq(orders.status, 'confirmed'),
            eq(payments.status, 'success'),
            gte(orders.confirmedAt, thirtyDaysAgo),
          ),
        )
        .groupBy(sql`date_trunc('day', ${orders.confirmedAt})`)
        .orderBy(sql`date_trunc('day', ${orders.confirmedAt})`),
    ]);

    return {
      total_events: totalEventsRow[0]?.total ?? 0,
      total_revenue: toNumber(revenueRow[0]?.totalRevenue),
      total_tickets_sold: toNumber(ticketsSoldRow[0]?.totalTicketsSold),
      upcoming_events: upcomingEventsRow[0]?.total ?? 0,
      recent_orders: recentOrderRecords.map(toRecentOrder),
      daily_sales: buildDailySales(30, dailySalesRows),
    };
  },
};
