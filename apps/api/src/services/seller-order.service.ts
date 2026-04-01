import { getDb, schema } from '@jeevatix/core';
import { and, countDistinct, desc, eq } from 'drizzle-orm';

import type {
  ListSellerOrdersQuery,
  SellerOrderDetail,
  SellerOrderListItem,
} from '../schemas/seller-order.schema';

const { events, orderItems, orders, payments, ticketTiers, users } = schema;

export class SellerOrderServiceError extends Error {
  constructor(
    public readonly code: 'DATABASE_UNAVAILABLE' | 'FORBIDDEN' | 'ORDER_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'SellerOrderServiceError';
  }
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new SellerOrderServiceError(
      'DATABASE_UNAVAILABLE',
      'Database connection is not available.',
    );
  }

  return db;
}

function toPaginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

function toSellerOrderListItem(row: {
  orderId: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  totalAmount: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  paymentStatus: 'pending' | 'success' | 'failed' | 'refunded';
  createdAt: Date;
  confirmedAt: Date | null;
}): SellerOrderListItem {
  return {
    id: row.orderId,
    order_number: row.orderNumber,
    status: row.status,
    total_amount: Number(row.totalAmount),
    buyer_id: row.buyerId,
    buyer_name: row.buyerName,
    buyer_email: row.buyerEmail,
    event_id: row.eventId,
    event_title: row.eventTitle,
    event_slug: row.eventSlug,
    payment_status: row.paymentStatus,
    created_at: row.createdAt.toISOString(),
    confirmed_at: row.confirmedAt?.toISOString() ?? null,
  };
}

function toSellerOrderDetail(order: {
  id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  totalAmount: string;
  serviceFee: string;
  expiresAt: Date;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  } | null;
  payment: {
    id: string;
    method: 'bank_transfer' | 'e_wallet' | 'credit_card' | 'virtual_account';
    status: 'pending' | 'success' | 'failed' | 'refunded';
    amount: string;
    externalRef: string | null;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  orderItems: Array<{
    id: string;
    quantity: number;
    unitPrice: string;
    subtotal: string;
    ticketTier: {
      id: string;
      name: string;
      event: {
        id: string;
        title: string;
        slug: string;
        venueCity: string;
        startAt: Date;
        sellerProfileId: string;
      } | null;
    } | null;
  }>;
}): SellerOrderDetail {
  const primaryItem = order.orderItems[0]?.ticketTier?.event;

  if (!order.user || !order.payment || !primaryItem) {
    throw new SellerOrderServiceError('ORDER_NOT_FOUND', 'Order not found.');
  }

  return {
    id: order.id,
    order_number: order.orderNumber,
    status: order.status,
    total_amount: Number(order.totalAmount),
    service_fee: Number(order.serviceFee),
    expires_at: order.expiresAt.toISOString(),
    confirmed_at: order.confirmedAt?.toISOString() ?? null,
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
    buyer: {
      id: order.user.id,
      full_name: order.user.fullName,
      email: order.user.email,
      phone: order.user.phone ?? null,
    },
    event: {
      id: primaryItem.id,
      title: primaryItem.title,
      slug: primaryItem.slug,
      start_at: primaryItem.startAt.toISOString(),
      venue_city: primaryItem.venueCity,
    },
    items: order.orderItems
      .filter((item) => item.ticketTier)
      .map((item) => ({
        id: item.id,
        ticket_tier_id: item.ticketTier!.id,
        tier_name: item.ticketTier!.name,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
      })),
    payment: {
      id: order.payment.id,
      method: order.payment.method,
      status: order.payment.status,
      amount: Number(order.payment.amount),
      external_ref: order.payment.externalRef,
      paid_at: order.payment.paidAt?.toISOString() ?? null,
      created_at: order.payment.createdAt.toISOString(),
      updated_at: order.payment.updatedAt.toISOString(),
    },
  };
}

export const sellerOrderService = {
  async listOrders(
    sellerProfileId: string,
    query: ListSellerOrdersQuery,
    databaseUrl?: string,
  ): Promise<{ data: SellerOrderListItem[]; meta: ReturnType<typeof toPaginationMeta> }> {
    const database = getDatabase(databaseUrl);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const conditions = [
      eq(events.sellerProfileId, sellerProfileId),
      query.event_id ? eq(events.id, query.event_id) : undefined,
      query.status ? eq(orders.status, query.status) : undefined,
    ].filter((condition) => condition !== undefined);
    const whereClause = and(...conditions);

    const [totalRow] = await database
      .select({ total: countDistinct(orders.id) })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .innerJoin(ticketTiers, eq(ticketTiers.id, orderItems.ticketTierId))
      .innerJoin(events, eq(events.id, ticketTiers.eventId))
      .where(whereClause);

    const rows = await database
      .select({
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        totalAmount: orders.totalAmount,
        buyerId: users.id,
        buyerName: users.fullName,
        buyerEmail: users.email,
        eventId: events.id,
        eventTitle: events.title,
        eventSlug: events.slug,
        paymentStatus: payments.status,
        createdAt: orders.createdAt,
        confirmedAt: orders.confirmedAt,
      })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.userId))
      .innerJoin(payments, eq(payments.orderId, orders.id))
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .innerJoin(ticketTiers, eq(ticketTiers.id, orderItems.ticketTierId))
      .innerJoin(events, eq(events.id, ticketTiers.eventId))
      .where(whereClause)
      .groupBy(
        orders.id,
        orders.orderNumber,
        orders.status,
        orders.totalAmount,
        users.id,
        users.fullName,
        users.email,
        events.id,
        events.title,
        events.slug,
        payments.status,
        orders.createdAt,
        orders.confirmedAt,
      )
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows.map(toSellerOrderListItem),
      meta: toPaginationMeta(totalRow?.total ?? 0, page, limit),
    };
  },

  async getOrderDetail(
    sellerProfileId: string,
    orderId: string,
    databaseUrl?: string,
  ): Promise<SellerOrderDetail> {
    const database = getDatabase(databaseUrl);
    const order = await database.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        user: {
          columns: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        payment: true,
        orderItems: {
          with: {
            ticketTier: {
              with: {
                event: {
                  columns: {
                    id: true,
                    title: true,
                    slug: true,
                    venueCity: true,
                    startAt: true,
                    sellerProfileId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order || order.orderItems.length === 0) {
      throw new SellerOrderServiceError('ORDER_NOT_FOUND', 'Order not found.');
    }

    const sellerOwnsOrder = order.orderItems.every(
      (item) => item.ticketTier?.event?.sellerProfileId === sellerProfileId,
    );

    if (!sellerOwnsOrder) {
      throw new SellerOrderServiceError('FORBIDDEN', 'You do not have access to this order.');
    }

    return toSellerOrderDetail(order);
  },
};