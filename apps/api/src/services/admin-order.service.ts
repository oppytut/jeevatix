import { getDb, schema } from '@jeevatix/core';
import { and, countDistinct, desc, eq, ilike, or } from 'drizzle-orm';

import type {
  AdminOrderDetail,
  AdminOrderListItem,
  AdminOrderListQuery,
} from '../schemas/admin.schema';
import { notificationService } from './notification.service';
import { OrderReservationServiceError, releaseReservation } from './order-reservation.service';

const { orderItems, orders, payments, ticketTiers, tickets, users } = schema;

type AdminOrderServiceEnv = {
  DATABASE_URL?: string;
  TICKET_RESERVER?: DurableObjectNamespace;
};

export class AdminOrderServiceError extends Error {
  constructor(
    public readonly code:
      | 'DATABASE_UNAVAILABLE'
      | 'INVALID_STATE'
      | 'ORDER_NOT_FOUND'
      | 'RESERVATION_NOT_FOUND'
      | 'TICKET_RESERVER_UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'AdminOrderServiceError';
  }
}

function mapReservationError(error: OrderReservationServiceError) {
  return new AdminOrderServiceError(error.code, error.message);
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new AdminOrderServiceError(
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

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === 'number' ? value : Number(value);
}

function toOrderListItem(row: {
  id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  totalAmount: string;
  serviceFee: string;
  createdAt: Date;
  confirmedAt: Date | null;
  expiresAt: Date;
  paymentStatus: 'pending' | 'success' | 'failed' | 'refunded';
  paymentMethod: 'bank_transfer' | 'e_wallet' | 'credit_card' | 'virtual_account';
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  venueCity: string;
  startAt: Date;
}): AdminOrderListItem {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    totalAmount: toNumber(row.totalAmount),
    serviceFee: toNumber(row.serviceFee),
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    paymentStatus: row.paymentStatus,
    paymentMethod: row.paymentMethod,
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
  };
}

function toOrderDetail(order: {
  id: string;
  reservationId: string | null;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  totalAmount: string;
  serviceFee: string;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt: Date | null;
  expiresAt: Date;
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
      } | null;
    } | null;
  }>;
  tickets: Array<{
    id: string;
    ticketTierId: string;
    ticketCode: string;
    status: 'valid' | 'used' | 'cancelled' | 'refunded';
    issuedAt: Date;
    checkin: {
      checkedInAt: Date;
    } | null;
    ticketTier: {
      name: string;
    } | null;
  }>;
}): AdminOrderDetail {
  const primaryEvent = order.orderItems[0]?.ticketTier?.event;

  if (!order.user || !order.payment || !primaryEvent) {
    throw new AdminOrderServiceError('ORDER_NOT_FOUND', 'Order not found.');
  }

  return {
    id: order.id,
    reservationId: order.reservationId,
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: toNumber(order.totalAmount),
    serviceFee: toNumber(order.serviceFee),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    confirmedAt: order.confirmedAt?.toISOString() ?? null,
    expiresAt: order.expiresAt.toISOString(),
    buyer: {
      id: order.user.id,
      fullName: order.user.fullName,
      email: order.user.email,
      phone: order.user.phone,
    },
    event: {
      id: primaryEvent.id,
      title: primaryEvent.title,
      slug: primaryEvent.slug,
      venueCity: primaryEvent.venueCity,
      startAt: primaryEvent.startAt.toISOString(),
    },
    payment: {
      id: order.payment.id,
      method: order.payment.method,
      status: order.payment.status,
      amount: toNumber(order.payment.amount),
      externalRef: order.payment.externalRef,
      paidAt: order.payment.paidAt?.toISOString() ?? null,
      createdAt: order.payment.createdAt.toISOString(),
      updatedAt: order.payment.updatedAt.toISOString(),
    },
    items: order.orderItems
      .filter((item) => item.ticketTier)
      .map((item) => ({
        id: item.id,
        ticketTierId: item.ticketTier!.id,
        tierName: item.ticketTier!.name,
        quantity: item.quantity,
        unitPrice: toNumber(item.unitPrice),
        subtotal: toNumber(item.subtotal),
      })),
    tickets: order.tickets.map((ticket) => ({
      id: ticket.id,
      ticketTierId: ticket.ticketTierId,
      ticketTierName: ticket.ticketTier?.name ?? 'Ticket',
      ticketCode: ticket.ticketCode,
      status: ticket.status,
      issuedAt: ticket.issuedAt.toISOString(),
      checkedInAt: ticket.checkin?.checkedInAt.toISOString() ?? null,
    })),
  };
}

export const adminOrderService = {
  async listOrders(
    query: AdminOrderListQuery,
    databaseUrl?: string,
  ): Promise<{ data: AdminOrderListItem[]; meta: ReturnType<typeof toPaginationMeta> }> {
    const database = getDatabase(databaseUrl);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const searchTerm = query.search ? `%${query.search}%` : undefined;
    const conditions = [
      query.status ? eq(orders.status, query.status) : undefined,
      query.paymentStatus ? eq(payments.status, query.paymentStatus) : undefined,
      query.eventId ? eq(ticketTiers.eventId, query.eventId) : undefined,
      searchTerm
        ? or(
            ilike(orders.orderNumber, searchTerm),
            ilike(users.fullName, searchTerm),
            ilike(users.email, searchTerm),
            ilike(schema.events.title, searchTerm),
          )
        : undefined,
    ].filter((condition) => condition !== undefined);
    const whereClause = and(...conditions);

    const [totalRow] = await database
      .select({ total: countDistinct(orders.id) })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.userId))
      .innerJoin(payments, eq(payments.orderId, orders.id))
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .innerJoin(ticketTiers, eq(ticketTiers.id, orderItems.ticketTierId))
      .innerJoin(schema.events, eq(schema.events.id, ticketTiers.eventId))
      .where(whereClause);

    const rows = await database
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        totalAmount: orders.totalAmount,
        serviceFee: orders.serviceFee,
        createdAt: orders.createdAt,
        confirmedAt: orders.confirmedAt,
        expiresAt: orders.expiresAt,
        paymentStatus: payments.status,
        paymentMethod: payments.method,
        buyerId: users.id,
        buyerName: users.fullName,
        buyerEmail: users.email,
        buyerPhone: users.phone,
        eventId: schema.events.id,
        eventTitle: schema.events.title,
        eventSlug: schema.events.slug,
        venueCity: schema.events.venueCity,
        startAt: schema.events.startAt,
      })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.userId))
      .innerJoin(payments, eq(payments.orderId, orders.id))
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .innerJoin(ticketTiers, eq(ticketTiers.id, orderItems.ticketTierId))
      .innerJoin(schema.events, eq(schema.events.id, ticketTiers.eventId))
      .where(whereClause)
      .groupBy(
        orders.id,
        orders.orderNumber,
        orders.status,
        orders.totalAmount,
        orders.serviceFee,
        orders.createdAt,
        orders.confirmedAt,
        orders.expiresAt,
        payments.status,
        payments.method,
        users.id,
        users.fullName,
        users.email,
        users.phone,
        schema.events.id,
        schema.events.title,
        schema.events.slug,
        schema.events.venueCity,
        schema.events.startAt,
      )
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows.map(toOrderListItem),
      meta: toPaginationMeta(totalRow?.total ?? 0, page, limit),
    };
  },

  async getOrderDetail(id: string, databaseUrl?: string): Promise<AdminOrderDetail> {
    const database = getDatabase(databaseUrl);
    const order = await database.query.orders.findFirst({
      where: eq(orders.id, id),
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
                  },
                },
              },
            },
          },
        },
        tickets: {
          with: {
            checkin: {
              columns: {
                checkedInAt: true,
              },
            },
            ticketTier: {
              columns: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new AdminOrderServiceError('ORDER_NOT_FOUND', 'Order not found.');
    }

    return toOrderDetail(order);
  },

  async refundOrder(id: string, databaseUrl?: string) {
    const database = getDatabase(databaseUrl);
    const order = await database.query.orders.findFirst({
      where: eq(orders.id, id),
      columns: {
        id: true,
        userId: true,
        status: true,
      },
      with: {
        user: {
          columns: {
            fullName: true,
          },
        },
        payment: {
          columns: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!order?.payment) {
      throw new AdminOrderServiceError('ORDER_NOT_FOUND', 'Order not found.');
    }

    if (order.status === 'refunded' && order.payment.status === 'refunded') {
      return {
        id: order.id,
        status: 'refunded' as const,
        paymentStatus: 'refunded' as const,
        updatedAt: new Date().toISOString(),
      };
    }

    if (order.status !== 'confirmed' || order.payment.status !== 'success') {
      throw new AdminOrderServiceError(
        'INVALID_STATE',
        'Only confirmed orders with successful payments can be refunded.',
      );
    }

    const now = new Date();
    await database.transaction(async (tx) => {
      await tx.update(orders).set({ status: 'refunded', updatedAt: now }).where(eq(orders.id, id));
      await tx
        .update(payments)
        .set({ status: 'refunded', updatedAt: now })
        .where(eq(payments.orderId, id));
      await tx.update(tickets).set({ status: 'refunded' }).where(eq(tickets.orderId, id));
    });

    await notificationService.sendNotification(
      order.userId,
      'info',
      'Pesanan direfund',
      `Order ${id} telah direfund oleh admin.`,
      {
        order_id: id,
        action: 'refund',
      },
      databaseUrl,
    );

    return {
      id,
      status: 'refunded' as const,
      paymentStatus: 'refunded' as const,
      updatedAt: now.toISOString(),
    };
  },

  async cancelOrder(id: string, env: AdminOrderServiceEnv) {
    const database = getDatabase(env.DATABASE_URL);
    const order = await database.query.orders.findFirst({
      where: eq(orders.id, id),
      columns: {
        id: true,
        userId: true,
        reservationId: true,
        status: true,
      },
      with: {
        payment: {
          columns: {
            status: true,
          },
        },
      },
    });

    if (!order?.payment) {
      throw new AdminOrderServiceError('ORDER_NOT_FOUND', 'Order not found.');
    }

    if (order.status === 'cancelled') {
      return {
        id,
        status: 'cancelled' as const,
        paymentStatus: order.payment.status,
        updatedAt: new Date().toISOString(),
      };
    }

    if (order.status === 'confirmed' || order.payment.status === 'success') {
      throw new AdminOrderServiceError(
        'INVALID_STATE',
        'Confirmed orders must be refunded, not cancelled.',
      );
    }

    if (order.reservationId) {
      try {
        await releaseReservation(env, order.reservationId, 'cancelled');
      } catch (error) {
        if (error instanceof OrderReservationServiceError) {
          throw mapReservationError(error);
        }

        throw error;
      }
    }

    const now = new Date();
    await database.transaction(async (tx) => {
      await tx.update(orders).set({ status: 'cancelled', updatedAt: now }).where(eq(orders.id, id));
      await tx
        .update(payments)
        .set({ status: 'failed', updatedAt: now })
        .where(eq(payments.orderId, id));
      await tx.update(tickets).set({ status: 'cancelled' }).where(eq(tickets.orderId, id));
    });

    await notificationService.sendNotification(
      order.userId,
      'info',
      'Pesanan dibatalkan',
      `Order ${id} telah dibatalkan oleh admin.`,
      {
        order_id: id,
        action: 'cancel',
      },
      env.DATABASE_URL,
    );

    return {
      id,
      status: 'cancelled' as const,
      paymentStatus: 'failed' as const,
      updatedAt: now.toISOString(),
    };
  },
};
