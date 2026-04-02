import { getDb, schema } from '@jeevatix/core';
import { and, count, desc, eq, gte, sql, sum } from 'drizzle-orm';

import type {
  AdminDashboard,
  AdminDashboardDailyTransaction,
  AdminDashboardRecentEvent,
  AdminDashboardRecentOrder,
} from '../schemas/admin-dashboard.schema';

const { events, orderItems, orders, payments, users } = schema;

export class AdminDashboardServiceError extends Error {
  constructor(public readonly code: 'DATABASE_UNAVAILABLE', message: string) {
    super(message);
    this.name = 'AdminDashboardServiceError';
  }
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new AdminDashboardServiceError(
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

function buildDailyTransactions(
  days: number,
  rows: Array<{ date: string; transactionCount: number | string | null }>,
) {
  const transactionsByDay = new Map(
    rows.map((row) => [row.date, toNumber(row.transactionCount)]),
  );
  const endDate = startOfDay(new Date());
  const startDate = addDays(endDate, -(days - 1));
  const points: AdminDashboardDailyTransaction[] = [];

  for (let index = 0; index < days; index += 1) {
    const currentDate = addDays(startDate, index);
    const dateKey = formatDateKey(currentDate);

    points.push({
      date: dateKey,
      transaction_count: transactionsByDay.get(dateKey) ?? 0,
    });
  }

  return points;
}

function toRecentEvent(record: {
  id: string;
  title: string;
  status: 'draft' | 'pending_review' | 'published' | 'rejected' | 'ongoing' | 'completed' | 'cancelled';
  createdAt: Date;
  sellerProfile: {
    orgName: string;
  } | null;
}): AdminDashboardRecentEvent {
  return {
    id: record.id,
    name: record.title,
    seller: record.sellerProfile?.orgName ?? 'Unknown Seller',
    status: record.status,
    created_at: record.createdAt.toISOString(),
  };
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
}): AdminDashboardRecentOrder {
  return {
    id: record.id,
    order_number: record.orderNumber,
    buyer: record.user?.fullName ?? 'Unknown Buyer',
    total_amount: toNumber(record.totalAmount),
    status: record.status,
    created_at: record.createdAt.toISOString(),
  };
}

export const adminDashboardService = {
  async getDashboard(databaseUrl?: string): Promise<AdminDashboard> {
    const database = getDatabase(databaseUrl);
    const thirtyDaysAgo = addDays(startOfDay(new Date()), -29);

    const [
      totalUsersRow,
      totalSellersRow,
      totalBuyersRow,
      totalEventsRow,
      totalPublishedEventsRow,
      totalRevenueRow,
      totalTicketsSoldRow,
      dailyTransactionRows,
      recentEventRecords,
      recentOrderRecords,
    ] = await Promise.all([
      database.select({ total: count() }).from(users),
      database.select({ total: count() }).from(users).where(eq(users.role, 'seller')),
      database.select({ total: count() }).from(users).where(eq(users.role, 'buyer')),
      database.select({ total: count() }).from(events),
      database.select({ total: count() }).from(events).where(eq(events.status, 'published')),
      database
        .select({
          totalRevenue: sql<string>`coalesce(sum(${payments.amount}), 0)`,
        })
        .from(payments)
        .innerJoin(orders, eq(orders.id, payments.orderId))
        .where(and(eq(payments.status, 'success'), eq(orders.status, 'confirmed'))),
      database
        .select({
          totalTicketsSold: sum(orderItems.quantity),
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .innerJoin(payments, eq(payments.orderId, orders.id))
        .where(and(eq(payments.status, 'success'), eq(orders.status, 'confirmed'))),
      database
        .select({
          date: sql<string>`to_char(date_trunc('day', ${orders.confirmedAt}), 'YYYY-MM-DD')`,
          transactionCount: count(orders.id),
        })
        .from(orders)
        .innerJoin(payments, eq(payments.orderId, orders.id))
        .where(
          and(
            eq(payments.status, 'success'),
            eq(orders.status, 'confirmed'),
            gte(orders.confirmedAt, thirtyDaysAgo),
          ),
        )
        .groupBy(sql`date_trunc('day', ${orders.confirmedAt})`)
        .orderBy(sql`date_trunc('day', ${orders.confirmedAt})`),
      database.query.events.findMany({
        columns: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
        },
        with: {
          sellerProfile: {
            columns: {
              orgName: true,
            },
          },
        },
        orderBy: [desc(events.createdAt)],
        limit: 5,
      }),
      database.query.orders.findMany({
        columns: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
        with: {
          user: {
            columns: {
              fullName: true,
            },
          },
        },
        orderBy: [desc(orders.createdAt)],
        limit: 5,
      }),
    ]);

    return {
      total_users: totalUsersRow[0]?.total ?? 0,
      total_sellers: totalSellersRow[0]?.total ?? 0,
      total_buyers: totalBuyersRow[0]?.total ?? 0,
      total_events: totalEventsRow[0]?.total ?? 0,
      total_events_published: totalPublishedEventsRow[0]?.total ?? 0,
      total_revenue: toNumber(totalRevenueRow[0]?.totalRevenue),
      total_tickets_sold: toNumber(totalTicketsSoldRow[0]?.totalTicketsSold),
      daily_transactions: buildDailyTransactions(30, dailyTransactionRows),
      recent_events: recentEventRecords.map(toRecentEvent),
      recent_orders: recentOrderRecords.map(toRecentOrder),
    };
  },
};