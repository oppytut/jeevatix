import { getDb, schema } from '@jeevatix/core';
import { and, desc, eq, lte, sql } from 'drizzle-orm';

import type {
  CreateOrderInput,
  ListOrdersQuery,
  OrderDetail,
  OrderListItem,
} from '../schemas/order.schema';

const ORDER_EXPIRY_MINUTES = 30;
const DEFAULT_PAYMENT_METHOD = 'bank_transfer';

const { orderItems, orders, payments, reservations, tickets } = schema;

type OrderServiceEnv = {
  DATABASE_URL?: string;
  TICKET_RESERVER?: DurableObjectNamespace;
};

type TicketReserverConfirmResponse =
  | {
      ok: true;
      reservation_id: string;
      status: 'cancelled' | 'converted' | 'expired';
    }
  | {
      ok: false;
      error: 'BAD_REQUEST' | 'DATABASE_UNAVAILABLE' | 'NOT_FOUND' | 'INVALID_STATE';
      message?: string;
    };

export class OrderServiceError extends Error {
  constructor(
    public readonly code:
      | 'DATABASE_UNAVAILABLE'
      | 'FORBIDDEN'
      | 'INVALID_STATE'
      | 'ORDER_NOT_FOUND'
      | 'ORDER_NUMBER_GENERATION_FAILED'
      | 'RESERVATION_NOT_FOUND'
      | 'TICKET_RESERVER_UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'OrderServiceError';
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
    throw new OrderServiceError('DATABASE_UNAVAILABLE', 'Database connection is not available.');
  }

  return db;
}

function getTicketReserverNamespace(env: OrderServiceEnv) {
  if (!env.TICKET_RESERVER) {
    throw new OrderServiceError(
      'TICKET_RESERVER_UNAVAILABLE',
      'Ticket reserver durable object binding is not available.',
    );
  }

  return env.TICKET_RESERVER;
}

function getRandomFiveDigitNumber() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);

  return (values[0] % 100000).toString().padStart(5, '0');
}

function formatOrderNumber(date: Date) {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');

  return `JVX-${year}${month}${day}-${getRandomFiveDigitNumber()}`;
}

async function generateUniqueOrderNumber(databaseUrl?: string) {
  const database = getDatabase(databaseUrl);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const orderNumber = formatOrderNumber(new Date());
    const existingOrder = await database.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
      columns: {
        id: true,
      },
    });

    if (!existingOrder) {
      return orderNumber;
    }
  }

  throw new OrderServiceError(
    'ORDER_NUMBER_GENERATION_FAILED',
    'Unable to generate a unique order number.',
  );
}

async function invokeTicketReserverConfirm(
  env: OrderServiceEnv,
  tierId: string,
  reservationId: string,
) {
  const namespace = getTicketReserverNamespace(env);
  const objectId = namespace.idFromName(tierId);
  const stub = namespace.get(objectId);
  const response = await stub.fetch('https://ticket-reserver', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action: 'confirm',
      reservationId,
    }),
  });

  const body = (await response.json()) as TicketReserverConfirmResponse;

  if (!body.ok) {
    if (body.error === 'DATABASE_UNAVAILABLE') {
      throw new OrderServiceError('DATABASE_UNAVAILABLE', 'Database connection is not available.');
    }

    if (body.error === 'NOT_FOUND') {
      throw new OrderServiceError('RESERVATION_NOT_FOUND', 'Reservation not found.');
    }

    throw new OrderServiceError('INVALID_STATE', body.message ?? 'Unable to confirm reservation.');
  }

  return body;
}

async function expirePendingOrder(databaseUrl: string | undefined, orderId: string) {
  const database = getDatabase(databaseUrl);

  await database
    .update(orders)
    .set({
      status: 'expired',
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, orderId), eq(orders.status, 'pending'), lte(orders.expiresAt, new Date())));
}

async function cleanupFailedOrder(orderId: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);

  await database.transaction(async (tx) => {
    await tx.delete(payments).where(eq(payments.orderId, orderId));
    await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await tx.delete(orders).where(eq(orders.id, orderId));
  });
}

function toOrderListItem(row: {
  id: string;
  reservationId: string | null;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  totalAmount: string;
  createdAt: Date;
  expiresAt: Date;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
}): OrderListItem {
  return {
    id: row.id,
    reservation_id: row.reservationId,
    order_number: row.orderNumber,
    status: row.status,
    total_amount: Number(row.totalAmount),
    event_id: row.eventId,
    event_slug: row.eventSlug,
    event_title: row.eventTitle,
    created_at: row.createdAt.toISOString(),
    expires_at: row.expiresAt.toISOString(),
  };
}

function toOrderDetail(row: {
  id: string;
  reservationId: string | null;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  totalAmount: string;
  serviceFee: string;
  expiresAt: Date;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
        slug: string;
        title: string;
      } | null;
    } | null;
  }>;
  tickets: Array<{
    id: string;
    ticketTierId: string;
    ticketCode: string;
    status: 'valid' | 'used' | 'cancelled' | 'refunded';
    issuedAt: Date;
  }>;
}): OrderDetail {
  const primaryEvent = row.orderItems[0]?.ticketTier?.event;

  if (!row.payment || !primaryEvent) {
    throw new OrderServiceError('INVALID_STATE', 'Order is missing payment or event data.');
  }

  return {
    id: row.id,
    reservation_id: row.reservationId,
    order_number: row.orderNumber,
    status: row.status,
    total_amount: Number(row.totalAmount),
    service_fee: Number(row.serviceFee),
    expires_at: row.expiresAt.toISOString(),
    confirmed_at: row.confirmedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    event_id: primaryEvent.id,
    event_slug: primaryEvent.slug,
    event_title: primaryEvent.title,
    items: row.orderItems
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
      id: row.payment.id,
      method: row.payment.method,
      status: row.payment.status,
      amount: Number(row.payment.amount),
      external_ref: row.payment.externalRef,
      paid_at: row.payment.paidAt?.toISOString() ?? null,
      created_at: row.payment.createdAt.toISOString(),
      updated_at: row.payment.updatedAt.toISOString(),
    },
    tickets: row.tickets.map((ticket) => ({
      id: ticket.id,
      ticket_tier_id: ticket.ticketTierId,
      ticket_code: ticket.ticketCode,
      status: ticket.status,
      issued_at: ticket.issuedAt.toISOString(),
    })),
  };
}

export const orderService = {
  async createOrder(
    env: OrderServiceEnv,
    userId: string,
    input: CreateOrderInput,
  ): Promise<OrderDetail> {
    const databaseUrl = env.DATABASE_URL ?? getProcessEnv('DATABASE_URL');
    const database = getDatabase(databaseUrl);
    const reservation = await database.query.reservations.findFirst({
      where: eq(reservations.id, input.reservation_id),
      columns: {
        id: true,
        userId: true,
        ticketTierId: true,
        quantity: true,
        status: true,
        expiresAt: true,
      },
      with: {
        ticketTier: {
          columns: {
            id: true,
            name: true,
            price: true,
          },
          with: {
            event: {
              columns: {
                id: true,
                slug: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!reservation?.ticketTier.event) {
      throw new OrderServiceError('RESERVATION_NOT_FOUND', 'Reservation not found.');
    }

    if (reservation.userId !== userId) {
      throw new OrderServiceError('FORBIDDEN', 'You do not have access to this reservation.');
    }

    if (reservation.status !== 'active') {
      throw new OrderServiceError('INVALID_STATE', 'Reservation is no longer active.');
    }

    if (reservation.expiresAt.getTime() <= Date.now()) {
      throw new OrderServiceError('INVALID_STATE', 'Reservation has expired.');
    }

    const existingOrder = await database.query.orders.findFirst({
      where: eq(orders.reservationId, reservation.id),
      columns: {
        id: true,
      },
    });

    if (existingOrder) {
      throw new OrderServiceError('INVALID_STATE', 'An order already exists for this reservation.');
    }

    const unitPrice = Number(reservation.ticketTier.price);
    const subtotal = unitPrice * reservation.quantity;
    const orderNumber = await generateUniqueOrderNumber(databaseUrl);
    const orderExpiresAt = new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000);

    const createdOrder = await database.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          userId,
          reservationId: reservation.id,
          orderNumber,
          totalAmount: subtotal.toString(),
          serviceFee: '0',
          status: 'pending',
          expiresAt: orderExpiresAt,
          updatedAt: new Date(),
        })
        .returning({
          id: orders.id,
        });

      await tx.insert(orderItems).values({
        orderId: order.id,
        ticketTierId: reservation.ticketTier.id,
        quantity: reservation.quantity,
        unitPrice: unitPrice.toString(),
        subtotal: subtotal.toString(),
      });

      await tx.insert(payments).values({
        orderId: order.id,
        method: DEFAULT_PAYMENT_METHOD,
        status: 'pending',
        amount: subtotal.toString(),
        updatedAt: new Date(),
      });

      return order;
    });

    let confirmResult: Awaited<ReturnType<typeof invokeTicketReserverConfirm>>;

    try {
      confirmResult = await invokeTicketReserverConfirm(env, reservation.ticketTier.id, reservation.id);
    } catch (error) {
      const refreshedReservation = await database.query.reservations.findFirst({
        where: eq(reservations.id, reservation.id),
        columns: {
          status: true,
        },
      });

      if (refreshedReservation?.status !== 'converted') {
        await cleanupFailedOrder(createdOrder.id, databaseUrl);
      }

      throw error;
    }

    if (confirmResult.status !== 'converted') {
      await cleanupFailedOrder(createdOrder.id, databaseUrl);
      throw new OrderServiceError('INVALID_STATE', 'Reservation could not be confirmed.');
    }

    return this.getOrderDetail(userId, createdOrder.id, databaseUrl);
  },

  async listOrders(
    userId: string,
    query: ListOrdersQuery,
    databaseUrl?: string,
  ): Promise<{
    data: OrderListItem[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const database = getDatabase(databaseUrl);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    await database
      .update(orders)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(and(eq(orders.userId, userId), eq(orders.status, 'pending'), lte(orders.expiresAt, new Date())));

    const [aggregate] = await database
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(eq(orders.userId, userId));

    const rows = await database.query.orders.findMany({
      where: eq(orders.userId, userId),
      columns: {
        id: true,
        reservationId: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        expiresAt: true,
      },
      with: {
        orderItems: {
          columns: {},
          with: {
            ticketTier: {
              columns: {},
              with: {
                event: {
                  columns: {
                    id: true,
                    slug: true,
                    title: true,
                  },
                },
              },
            },
          },
          limit: 1,
        },
      },
      orderBy: [desc(orders.createdAt)],
      limit,
      offset,
    });

    const data = rows
      .filter((row) => row.orderItems[0]?.ticketTier.event)
      .map((row) =>
        toOrderListItem({
          id: row.id,
          reservationId: row.reservationId,
          orderNumber: row.orderNumber,
          status: row.status,
          totalAmount: row.totalAmount,
          createdAt: row.createdAt,
          expiresAt: row.expiresAt,
          eventId: row.orderItems[0]!.ticketTier.event!.id,
          eventSlug: row.orderItems[0]!.ticketTier.event!.slug,
          eventTitle: row.orderItems[0]!.ticketTier.event!.title,
        }),
      );

    const total = aggregate?.count ?? 0;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  },

  async getOrderDetail(userId: string, orderId: string, databaseUrl?: string): Promise<OrderDetail> {
    await expirePendingOrder(databaseUrl, orderId);

    const database = getDatabase(databaseUrl);
    const order = await database.query.orders.findFirst({
      where: eq(orders.id, orderId),
      columns: {
        id: true,
        userId: true,
        reservationId: true,
        orderNumber: true,
        totalAmount: true,
        serviceFee: true,
        status: true,
        expiresAt: true,
        confirmedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        payment: {
          columns: {
            id: true,
            method: true,
            status: true,
            amount: true,
            externalRef: true,
            paidAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        orderItems: {
          columns: {
            id: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
          },
          with: {
            ticketTier: {
              columns: {
                id: true,
                name: true,
              },
              with: {
                event: {
                  columns: {
                    id: true,
                    slug: true,
                    title: true,
                  },
                },
              },
            },
          },
        },
        tickets: {
          columns: {
            id: true,
            ticketTierId: true,
            ticketCode: true,
            status: true,
            issuedAt: true,
          },
          orderBy: [desc(tickets.issuedAt)],
        },
      },
    });

    if (!order) {
      throw new OrderServiceError('ORDER_NOT_FOUND', 'Order not found.');
    }

    if (order.userId !== userId) {
      throw new OrderServiceError('FORBIDDEN', 'You do not have access to this order.');
    }

    return toOrderDetail(order);
  },
};