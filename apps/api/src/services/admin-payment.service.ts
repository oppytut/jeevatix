import { getDb, schema } from '@jeevatix/core';
import { and, countDistinct, desc, eq, ilike, or } from 'drizzle-orm';

import type {
  AdminPaymentDetail,
  AdminPaymentListItem,
  AdminPaymentListQuery,
  UpdateAdminPaymentStatusInput,
} from '../schemas/admin.schema';
import { notificationService } from './notification.service';
import { generateTickets } from './ticket-generator';

const { orderItems, orders, payments, ticketTiers, tickets, users } = schema;

export class AdminPaymentServiceError extends Error {
  constructor(
    public readonly code: 'DATABASE_UNAVAILABLE' | 'INVALID_STATE' | 'PAYMENT_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'AdminPaymentServiceError';
  }
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new AdminPaymentServiceError(
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

function toPaymentListItem(row: {
  id: string;
  orderId: string;
  orderNumber: string;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  method: 'bank_transfer' | 'e_wallet' | 'credit_card' | 'virtual_account';
  amount: string;
  externalRef: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  orderStatus: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  venueCity: string;
  startAt: Date;
}): AdminPaymentListItem {
  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    status: row.status,
    method: row.method,
    amount: toNumber(row.amount),
    externalRef: row.externalRef,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    orderStatus: row.orderStatus,
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

function toPaymentDetail(payment: {
  id: string;
  orderId: string;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  method: 'bank_transfer' | 'e_wallet' | 'credit_card' | 'virtual_account';
  amount: string;
  externalRef: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  order: {
    id: string;
    orderNumber: string;
    status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
    user: {
      id: string;
      fullName: string;
      email: string;
      phone: string | null;
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
      ticketTier: {
        name: string;
      } | null;
    }>;
  } | null;
}): AdminPaymentDetail {
  const order = payment.order;
  const primaryEvent = order?.orderItems[0]?.ticketTier?.event;

  if (!order?.user || !primaryEvent) {
    throw new AdminPaymentServiceError('PAYMENT_NOT_FOUND', 'Payment not found.');
  }

  return {
    id: payment.id,
    orderId: payment.orderId,
    orderNumber: order.orderNumber,
    status: payment.status,
    method: payment.method,
    amount: toNumber(payment.amount),
    externalRef: payment.externalRef,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    orderStatus: order.status,
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
      checkedInAt: null,
    })),
  };
}

export const adminPaymentService = {
  async listPayments(
    query: AdminPaymentListQuery,
    databaseUrl?: string,
  ): Promise<{ data: AdminPaymentListItem[]; meta: ReturnType<typeof toPaginationMeta> }> {
    const database = getDatabase(databaseUrl);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const searchTerm = query.search ? `%${query.search}%` : undefined;
    const conditions = [
      query.status ? eq(payments.status, query.status) : undefined,
      query.method ? eq(payments.method, query.method) : undefined,
      searchTerm
        ? or(
            ilike(payments.externalRef, searchTerm),
            ilike(orders.orderNumber, searchTerm),
            ilike(users.fullName, searchTerm),
            ilike(users.email, searchTerm),
            ilike(schema.events.title, searchTerm),
          )
        : undefined,
    ].filter((condition) => condition !== undefined);
    const whereClause = and(...conditions);

    const [totalRow] = await database
      .select({ total: countDistinct(payments.id) })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .innerJoin(users, eq(users.id, orders.userId))
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .innerJoin(ticketTiers, eq(ticketTiers.id, orderItems.ticketTierId))
      .innerJoin(schema.events, eq(schema.events.id, ticketTiers.eventId))
      .where(whereClause);

    const rows = await database
      .select({
        id: payments.id,
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        status: payments.status,
        method: payments.method,
        amount: payments.amount,
        externalRef: payments.externalRef,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
        orderStatus: orders.status,
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
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .innerJoin(users, eq(users.id, orders.userId))
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .innerJoin(ticketTiers, eq(ticketTiers.id, orderItems.ticketTierId))
      .innerJoin(schema.events, eq(schema.events.id, ticketTiers.eventId))
      .where(whereClause)
      .groupBy(
        payments.id,
        orders.id,
        orders.orderNumber,
        payments.status,
        payments.method,
        payments.amount,
        payments.externalRef,
        payments.paidAt,
        payments.createdAt,
        payments.updatedAt,
        orders.status,
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
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows.map(toPaymentListItem),
      meta: toPaginationMeta(totalRow?.total ?? 0, page, limit),
    };
  },

  async getPaymentDetail(id: string, databaseUrl?: string): Promise<AdminPaymentDetail> {
    const database = getDatabase(databaseUrl);
    const payment = await database.query.payments.findFirst({
      where: eq(payments.id, id),
      with: {
        order: {
          with: {
            user: {
              columns: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
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
                ticketTier: {
                  columns: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new AdminPaymentServiceError('PAYMENT_NOT_FOUND', 'Payment not found.');
    }

    return toPaymentDetail(payment);
  },

  async updatePaymentStatus(
    id: string,
    input: UpdateAdminPaymentStatusInput,
    databaseUrl?: string,
  ) {
    const database = getDatabase(databaseUrl);
    const payment = await database.query.payments.findFirst({
      where: eq(payments.id, id),
      with: {
        order: {
          with: {
            user: {
              columns: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            orderItems: {
              with: {
                ticketTier: {
                  with: {
                    event: {
                      columns: {
                        id: true,
                        title: true,
                      },
                      with: {
                        sellerProfile: {
                          columns: {
                            userId: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            tickets: {
              columns: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!payment?.order?.user) {
      throw new AdminPaymentServiceError('PAYMENT_NOT_FOUND', 'Payment not found.');
    }

    const now = new Date();
    const primaryEvent = payment.order.orderItems[0]?.ticketTier?.event;
    const sellerUserId = primaryEvent?.sellerProfile?.userId;

    if (input.status === 'success') {
      if (payment.status === 'success' && payment.order.status === 'confirmed') {
        return {
          id: payment.id,
          status: payment.status,
          orderStatus: payment.order.status,
          paidAt: payment.paidAt?.toISOString() ?? null,
          updatedAt: payment.updatedAt.toISOString(),
        };
      }

      if (['cancelled', 'refunded'].includes(payment.order.status)) {
        throw new AdminPaymentServiceError(
          'INVALID_STATE',
          'Cancelled or refunded orders cannot be marked as paid.',
        );
      }

      await database.transaction(async (tx) => {
        await tx
          .update(payments)
          .set({ status: 'success', paidAt: now, updatedAt: now })
          .where(eq(payments.id, payment.id));
        await tx
          .update(orders)
          .set({ status: 'confirmed', confirmedAt: now, updatedAt: now })
          .where(eq(orders.id, payment.orderId));
      });

      if (payment.order.tickets.length === 0) {
        await generateTickets(payment.orderId, databaseUrl);
      }

      await Promise.all([
        notificationService.sendNotification(
          payment.order.user.id,
          'order_confirmed',
          'Pembayaran dikonfirmasi',
          `Pembayaran untuk order ${payment.order.orderNumber} telah dikonfirmasi admin.`,
          {
            order_id: payment.orderId,
            payment_id: payment.id,
          },
          databaseUrl,
        ),
        sellerUserId
          ? notificationService.sendNotification(
              sellerUserId,
              'new_order',
              'Pembayaran pesanan dikonfirmasi',
              `Order ${payment.order.orderNumber} untuk event ${primaryEvent?.title ?? 'event'} telah dibayar.`,
              {
                order_id: payment.orderId,
                payment_id: payment.id,
                event_id: primaryEvent?.id,
              },
              databaseUrl,
            )
          : Promise.resolve(),
      ]);

      return {
        id: payment.id,
        status: 'success' as const,
        orderStatus: 'confirmed' as const,
        paidAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    }

    if (input.status === 'refunded') {
      if (!(payment.status === 'success' || payment.order.status === 'confirmed')) {
        throw new AdminPaymentServiceError(
          'INVALID_STATE',
          'Only successful payments can be refunded.',
        );
      }

      await database.transaction(async (tx) => {
        await tx
          .update(payments)
          .set({ status: 'refunded', updatedAt: now })
          .where(eq(payments.id, payment.id));
        await tx
          .update(orders)
          .set({ status: 'refunded', updatedAt: now })
          .where(eq(orders.id, payment.orderId));
        await tx
          .update(tickets)
          .set({ status: 'refunded' })
          .where(eq(tickets.orderId, payment.orderId));
      });

      await notificationService.sendNotification(
        payment.order.user.id,
        'info',
        'Pembayaran direfund',
        `Pembayaran untuk order ${payment.order.orderNumber} telah direfund oleh admin.`,
        {
          order_id: payment.orderId,
          payment_id: payment.id,
        },
        databaseUrl,
      );

      return {
        id: payment.id,
        status: 'refunded' as const,
        orderStatus: 'refunded' as const,
        paidAt: payment.paidAt?.toISOString() ?? null,
        updatedAt: now.toISOString(),
      };
    }

    if (payment.status === 'success' || payment.status === 'refunded') {
      throw new AdminPaymentServiceError(
        'INVALID_STATE',
        'Successful or refunded payments cannot be marked as failed.',
      );
    }

    await database.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({ status: 'failed', updatedAt: now })
        .where(eq(payments.id, payment.id));
      await tx
        .update(orders)
        .set({ status: 'cancelled', updatedAt: now })
        .where(eq(orders.id, payment.orderId));
    });

    await notificationService.sendNotification(
      payment.order.user.id,
      'info',
      'Pembayaran gagal',
      `Pembayaran untuk order ${payment.order.orderNumber} ditandai gagal oleh admin.`,
      {
        order_id: payment.orderId,
        payment_id: payment.id,
      },
      databaseUrl,
    );

    return {
      id: payment.id,
      status: 'failed' as const,
      orderStatus: 'cancelled' as const,
      paidAt: null,
      updatedAt: now.toISOString(),
    };
  },
};
