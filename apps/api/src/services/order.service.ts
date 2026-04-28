import { getDb, schema } from '@jeevatix/core';
import { and, desc, eq, lte, sql } from 'drizzle-orm';

import type {
  CreateOrderInput,
  ListOrdersQuery,
  OrderDetail,
  OrderListItem,
} from '../schemas/order.schema';
import { logErrorWithContext } from '../lib/observability';
import {
  cacheReservationTicketTier,
  OrderReservationServiceError,
  releaseReservation,
} from './order-reservation.service';

const ORDER_EXPIRY_MINUTES = 30;
const DEFAULT_PAYMENT_METHOD = 'bank_transfer' as const;

const { events, orderItems, orders, payments, reservations, ticketTiers, tickets } = schema;

type OrderServiceEnv = {
  DATABASE_URL?: string;
  TICKET_RESERVER?: DurableObjectNamespace;
};

type TimedStep = {
  step: string;
  durationMs: number;
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

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl ?? getProcessEnv('DATABASE_URL'));

  if (!db) {
    throw new OrderServiceError('DATABASE_UNAVAILABLE', 'Database connection is not available.');
  }

  return db;
}

function getRandomFiveDigitNumber() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);

  return (values[0] % 100000).toString().padStart(5, '0');
}

export function formatOrderNumber(date: Date, randomPart = getRandomFiveDigitNumber()) {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');

  return `JVX-${year}${month}${day}-${randomPart}`;
}

async function generateUniqueOrderNumber() {
  return formatOrderNumber(new Date());
}

function getDatabaseErrorDetails(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const candidate = error as {
    code?: string;
    constraint_name?: string;
    constraint?: string;
    cause?: unknown;
  };

  if (candidate.code) {
    return candidate;
  }

  if (candidate.cause && typeof candidate.cause === 'object' && candidate.cause !== null) {
    const cause = candidate.cause as {
      code?: string;
      constraint_name?: string;
      constraint?: string;
    };

    if (cause.code) {
      return cause;
    }
  }

  return null;
}

function isUniqueViolation(error: unknown, constraint?: string) {
  const pgError = getDatabaseErrorDetails(error);

  if (!pgError) {
    return false;
  }

  if (pgError.code !== '23505') {
    return false;
  }

  if (!constraint) {
    return true;
  }

  return pgError.constraint === constraint || pgError.constraint_name === constraint;
}

function isRetryableDatabaseError(error: unknown) {
  const pgError = getDatabaseErrorDetails(error);

  if (!pgError?.code) {
    return false;
  }

  return ['40001', '40P01', '55P03', '08000', '08003', '08006', '08001'].includes(pgError.code);
}

function buildCreatedOrderDetail(input: {
  order: {
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
  };
  payment: {
    id: string;
    method: 'bank_transfer' | 'e_wallet' | 'credit_card' | 'virtual_account';
    status: 'pending' | 'success' | 'failed' | 'refunded';
    amount: string;
    externalRef: string | null;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  orderItem: {
    id: string;
    ticketTierId: string;
    quantity: number;
    unitPrice: string;
    subtotal: string;
  };
  event: {
    id: string;
    slug: string;
    title: string;
  };
  tierName: string;
}): OrderDetail {
  return {
    id: input.order.id,
    reservation_id: input.order.reservationId,
    order_number: input.order.orderNumber,
    status: input.order.status,
    total_amount: Number(input.order.totalAmount),
    service_fee: Number(input.order.serviceFee),
    expires_at: input.order.expiresAt.toISOString(),
    confirmed_at: input.order.confirmedAt?.toISOString() ?? null,
    created_at: input.order.createdAt.toISOString(),
    updated_at: input.order.updatedAt.toISOString(),
    event_id: input.event.id,
    event_slug: input.event.slug,
    event_title: input.event.title,
    items: [
      {
        id: input.orderItem.id,
        ticket_tier_id: input.orderItem.ticketTierId,
        tier_name: input.tierName,
        quantity: input.orderItem.quantity,
        unit_price: Number(input.orderItem.unitPrice),
        subtotal: Number(input.orderItem.subtotal),
      },
    ],
    payment: {
      id: input.payment.id,
      method: input.payment.method,
      status: input.payment.status,
      amount: Number(input.payment.amount),
      external_ref: input.payment.externalRef,
      paid_at: input.payment.paidAt?.toISOString() ?? null,
      created_at: input.payment.createdAt.toISOString(),
      updated_at: input.payment.updatedAt.toISOString(),
    },
    tickets: [],
  };
}

async function expirePendingOrder(env: OrderServiceEnv, orderId: string) {
  const database = getDatabase(env.DATABASE_URL);
  const order = await database.query.orders.findFirst({
    where: eq(orders.id, orderId),
    columns: {
      id: true,
      reservationId: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!order || order.status !== 'pending' || order.expiresAt.getTime() > Date.now()) {
    return;
  }

  if (order.reservationId) {
    try {
      await releaseReservation(env, order.reservationId, 'expired');
    } catch (error) {
      if (error instanceof OrderReservationServiceError) {
        throw new OrderServiceError(error.code, error.message);
      }

      throw error;
    }
  }

  await database
    .update(orders)
    .set({
      status: 'expired',
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, orderId), eq(orders.status, 'pending')));
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

type OrderCreationReservationRecord = {
  id: string;
  userId: string;
  ticketTierId: string;
  quantity: number;
  status: 'active' | 'converted' | 'expired' | 'cancelled';
  expiresAt: Date;
  tierPrice: string;
  eventId: string;
};

type OrderCreationResponseMetadata = {
  tierName: string;
  eventSlug: string;
  eventTitle: string;
};

async function loadOrderCreationResponseMetadata(
  ticketTierId: string,
  databaseUrl?: string,
): Promise<OrderCreationResponseMetadata> {
  const database = getDatabase(databaseUrl);
  const [metadata] = await database
    .select({
      tierName: ticketTiers.name,
      eventSlug: events.slug,
      eventTitle: events.title,
    })
    .from(ticketTiers)
    .innerJoin(events, eq(ticketTiers.eventId, events.id))
    .where(eq(ticketTiers.id, ticketTierId))
    .limit(1);

  if (!metadata) {
    throw new OrderServiceError(
      'INVALID_STATE',
      'Event metadata is unavailable for this order.',
    );
  }

  return metadata;
}

export const orderService = {
  async createOrder(
    env: OrderServiceEnv,
    userId: string,
    input: CreateOrderInput,
  ): Promise<OrderDetail> {
    const startedAt = Date.now();
    const steps: TimedStep[] = [];
    const databaseUrl = env.DATABASE_URL ?? getProcessEnv('DATABASE_URL');
    const database = getDatabase(databaseUrl);
    let createdOrder: {
      reservation: OrderCreationReservationRecord;
      order: {
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
      };
      orderItem: {
        id: string;
        ticketTierId: string;
        quantity: number;
        unitPrice: string;
        subtotal: string;
      };
      payment: {
        id: string;
        method: 'bank_transfer' | 'e_wallet' | 'credit_card' | 'virtual_account';
        status: 'pending' | 'success' | 'failed' | 'refunded';
        amount: string;
        externalRef: string | null;
        paidAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
      };
    } | null = null;
    let lastRetryableError: unknown = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const orderNumber = await generateUniqueOrderNumber();
      const transactionStartedAt = Date.now();
      const transactionQueuedAt = Date.now();
      const attemptSteps: TimedStep[] = [];

      try {
        createdOrder = await database.transaction(async (tx) => {
          attemptSteps.push({
            step: 'transaction_queue_wait',
            durationMs: Date.now() - transactionQueuedAt,
          });

          const now = new Date();
          const orderExpiresAt = new Date(now.getTime() + ORDER_EXPIRY_MINUTES * 60 * 1000);

          const reservationLookupStartedAt = Date.now();
          const [reservation] = await tx
            .select({
              id: reservations.id,
              userId: reservations.userId,
              ticketTierId: reservations.ticketTierId,
              quantity: reservations.quantity,
              status: reservations.status,
              expiresAt: reservations.expiresAt,
              tierPrice: ticketTiers.price,
              eventId: ticketTiers.eventId,
            })
            .from(reservations)
            .innerJoin(ticketTiers, eq(reservations.ticketTierId, ticketTiers.id))
            .where(eq(reservations.id, input.reservation_id))
            .limit(1);
          attemptSteps.push({
            step: 'reservation_lookup',
            durationMs: Date.now() - reservationLookupStartedAt,
          });

          if (!reservation) {
            throw new OrderServiceError('RESERVATION_NOT_FOUND', 'Reservation not found.');
          }

          if (reservation.userId !== userId) {
            throw new OrderServiceError('FORBIDDEN', 'You do not have access to this reservation.');
          }

          if (reservation.status !== 'active') {
            throw new OrderServiceError('INVALID_STATE', 'Reservation is no longer active.');
          }

          if (reservation.expiresAt.getTime() <= now.getTime()) {
            throw new OrderServiceError('INVALID_STATE', 'Reservation has expired.');
          }

          const unitPrice = Number(reservation.tierPrice);
          const subtotal = unitPrice * reservation.quantity;
          const insertOrderStartedAt = Date.now();
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
              createdAt: now,
              updatedAt: now,
            })
            .returning({
              id: orders.id,
              reservationId: orders.reservationId,
              orderNumber: orders.orderNumber,
              status: orders.status,
              totalAmount: orders.totalAmount,
              serviceFee: orders.serviceFee,
              expiresAt: orders.expiresAt,
              confirmedAt: orders.confirmedAt,
              createdAt: orders.createdAt,
              updatedAt: orders.updatedAt,
            });

          attemptSteps.push({
            step: 'tx_insert_order',
            durationMs: Date.now() - insertOrderStartedAt,
          });

          const insertOrderItemStartedAt = Date.now();
          const [createdOrderItem] = await tx
            .insert(orderItems)
            .values({
              orderId: order.id,
              ticketTierId: reservation.ticketTierId,
              quantity: reservation.quantity,
              unitPrice: unitPrice.toString(),
              subtotal: subtotal.toString(),
            })
            .returning({
              id: orderItems.id,
              ticketTierId: orderItems.ticketTierId,
              quantity: orderItems.quantity,
              unitPrice: orderItems.unitPrice,
              subtotal: orderItems.subtotal,
            });
          attemptSteps.push({
            step: 'tx_insert_order_item',
            durationMs: Date.now() - insertOrderItemStartedAt,
          });

          const insertPaymentStartedAt = Date.now();
          const [payment] = await tx
            .insert(payments)
            .values({
              orderId: order.id,
              method: DEFAULT_PAYMENT_METHOD,
              status: 'pending',
              amount: subtotal.toString(),
              createdAt: now,
              updatedAt: now,
            })
            .returning({
              id: payments.id,
              method: payments.method,
              status: payments.status,
              amount: payments.amount,
              externalRef: payments.externalRef,
              paidAt: payments.paidAt,
              createdAt: payments.createdAt,
              updatedAt: payments.updatedAt,
            });
          attemptSteps.push({
            step: 'tx_insert_payment',
            durationMs: Date.now() - insertPaymentStartedAt,
          });

          return {
            reservation,
            order,
            orderItem: createdOrderItem,
            payment,
          };
        });
        steps.push(...attemptSteps);
        steps.push({
          step: 'create_order_transaction',
          durationMs: Date.now() - transactionStartedAt,
        });
        break;
      } catch (error) {
        if (isUniqueViolation(error, 'idx_orders_reservation_id')) {
          throw new OrderServiceError(
            'INVALID_STATE',
            'An order already exists for this reservation.',
          );
        }

        if (isUniqueViolation(error, 'idx_orders_order_number')) {
          continue;
        }

        if (isRetryableDatabaseError(error)) {
          lastRetryableError = error;
          continue;
        }

        if (error instanceof OrderServiceError) {
          throw error;
        }

        logErrorWithContext('orders.transaction_failure', error, {
          operation: 'createOrder',
        });

        throw error;
      }
    }

    if (!createdOrder) {
      logTimedSteps(
        'order.createOrder',
        {
          reservationId: input.reservation_id,
          outcome: 'failed',
          totalDurationMs: Date.now() - startedAt,
        },
        steps,
      );

      if (lastRetryableError) {
        throw new OrderServiceError(
          'DATABASE_UNAVAILABLE',
          'Temporary database issue prevented order creation. Please retry.',
        );
      }

      throw new OrderServiceError(
        'ORDER_NUMBER_GENERATION_FAILED',
        'Unable to generate a unique order number.',
      );
    }

    const responseMetadataStartedAt = Date.now();
    const responseMetadata = await loadOrderCreationResponseMetadata(
      createdOrder.reservation.ticketTierId,
      databaseUrl,
    );
    cacheReservationTicketTier(createdOrder.reservation.id, createdOrder.reservation.ticketTierId);
    steps.push({
      step: 'response_metadata_lookup',
      durationMs: Date.now() - responseMetadataStartedAt,
    });

    logTimedSteps(
      'order.createOrder',
      {
        reservationId: input.reservation_id,
        outcome: 'success',
        totalDurationMs: Date.now() - startedAt,
      },
      steps,
    );

    return buildCreatedOrderDetail({
      order: createdOrder.order,
      orderItem: createdOrder.orderItem,
      payment: createdOrder.payment,
      event: {
        id: createdOrder.reservation.eventId,
        slug: responseMetadata.eventSlug,
        title: responseMetadata.eventTitle,
      },
      tierName: responseMetadata.tierName,
    });
  },

  async listOrders(
    env: OrderServiceEnv,
    userId: string,
    query: ListOrdersQuery,
  ): Promise<{
    data: OrderListItem[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const database = getDatabase(env.DATABASE_URL);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const expiredOrders = await database.query.orders.findMany({
      where: and(
        eq(orders.userId, userId),
        eq(orders.status, 'pending'),
        lte(orders.expiresAt, new Date()),
      ),
      columns: {
        id: true,
      },
    });

    for (const expiredOrder of expiredOrders) {
      await expirePendingOrder(env, expiredOrder.id);
    }

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

  async getOrderDetail(
    env: OrderServiceEnv,
    userId: string,
    orderId: string,
  ): Promise<OrderDetail> {
    await expirePendingOrder(env, orderId);

    const database = getDatabase(env.DATABASE_URL);
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
