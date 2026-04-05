import { getDb, schema } from '@jeevatix/core';
import { and, eq } from 'drizzle-orm';

import {
  buildOrderConfirmationEmail,
  createEmailService,
  type OrderConfirmationItem,
} from './email';
import { notificationService } from './notification.service';
import {
  OrderReservationServiceError,
  confirmReservation,
  releaseReservation,
} from './order-reservation.service';
import { generateTickets } from './ticket-generator';
import type {
  InitiatePaymentInput,
  InitiatePaymentPayload,
  PaymentWebhookInput,
  PaymentWebhookPayload,
} from '../schemas/payment.schema';

const { orders, payments, reservations } = schema;

type PaymentServiceEnv = {
  DATABASE_URL?: string;
  PAYMENT_WEBHOOK_SECRET?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  TICKET_RESERVER?: DurableObjectNamespace;
};

type TimedStep = {
  step: string;
  durationMs: number;
};

type BackgroundTaskScheduler = (task: Promise<unknown>) => void;
type BackgroundTaskFactory = () => Promise<unknown>;

type PaymentNotificationType = 'info' | 'new_order' | 'order_confirmed';

type SuccessfulPaymentFulfillmentPayload = {
  orderId: string;
  orderNumber: string;
  buyerId: string;
  buyerEmail: string;
  buyerName: string;
  sellerUserId?: string | null;
  eventId: string;
  eventTitle: string;
  items: OrderConfirmationItem[];
};

export class PaymentServiceError extends Error {
  constructor(
    public readonly code:
      | 'DATABASE_UNAVAILABLE'
      | 'FORBIDDEN'
      | 'INVALID_SIGNATURE'
      | 'INVALID_STATE'
      | 'ORDER_NOT_FOUND'
      | 'PAYMENT_NOT_FOUND'
      | 'PAYMENT_WEBHOOK_SECRET_MISSING'
      | 'RESERVATION_NOT_FOUND'
      | 'TICKET_RESERVER_UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'PaymentServiceError';
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

function getBackgroundTaskConcurrencyLimit() {
  const rawValue = Number.parseInt(getProcessEnv('PAYMENT_BACKGROUND_TASK_CONCURRENCY') ?? '8', 10);

  return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 8;
}

const backgroundTaskQueue: Array<() => void> = [];
let activeBackgroundTaskCount = 0;

function drainBackgroundTaskQueue() {
  while (
    activeBackgroundTaskCount < getBackgroundTaskConcurrencyLimit() &&
    backgroundTaskQueue.length > 0
  ) {
    const nextTask = backgroundTaskQueue.shift();
    nextTask?.();
  }
}

function enqueueBackgroundTask<T>(taskFactory: () => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const runTask = () => {
      activeBackgroundTaskCount += 1;

      taskFactory()
        .then(resolve, reject)
        .finally(() => {
          activeBackgroundTaskCount = Math.max(0, activeBackgroundTaskCount - 1);
          drainBackgroundTaskQueue();
        });
    };

    backgroundTaskQueue.push(runTask);
    drainBackgroundTaskQueue();
  });
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

function scheduleBackgroundTask(
  scheduler: BackgroundTaskScheduler | undefined,
  taskFactory: BackgroundTaskFactory,
  label: string,
) {
  if (!scheduler) {
    return false;
  }

  scheduler(
    enqueueBackgroundTask(taskFactory).catch((error) => {
      console.error(`[background-task] ${label} failed.`, error);
    }),
  );

  return true;
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl ?? getProcessEnv('DATABASE_URL'));

  if (!db) {
    throw new PaymentServiceError('DATABASE_UNAVAILABLE', 'Database connection is not available.');
  }

  return db;
}

function getWebhookSecret(env: PaymentServiceEnv) {
  const secret = env.PAYMENT_WEBHOOK_SECRET ?? getProcessEnv('PAYMENT_WEBHOOK_SECRET');

  if (!secret) {
    throw new PaymentServiceError(
      'PAYMENT_WEBHOOK_SECRET_MISSING',
      'Payment webhook secret is not configured.',
    );
  }

  return secret;
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

async function signWebhookPayload(payload: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));

  return toHex(signature);
}

function getRandomToken(size = 8) {
  const values = new Uint8Array(size);
  crypto.getRandomValues(values);

  return Array.from(values, (value) => value.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, size);
}

function buildExternalRef() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = now.getUTCDate().toString().padStart(2, '0');

  return `PAY-${year}${month}${day}-${getRandomToken(8).toUpperCase()}`;
}

function buildMockPaymentUrl(externalRef: string, method: InitiatePaymentInput['method']) {
  const url = new URL(`https://payments.mock.jeevatix.id/pay/${externalRef}`);
  url.searchParams.set('method', method);

  return url.toString();
}

async function verifyWebhookSignature(headers: Headers, rawBody: string, env: PaymentServiceEnv) {
  const providedSignature = headers.get('x-payment-signature');

  if (!providedSignature) {
    throw new PaymentServiceError('INVALID_SIGNATURE', 'Missing payment webhook signature.');
  }

  const expectedSignature = await signWebhookPayload(rawBody, getWebhookSecret(env));

  if (!secureEqual(providedSignature, expectedSignature)) {
    throw new PaymentServiceError('INVALID_SIGNATURE', 'Invalid payment webhook signature.');
  }
}

async function markOrderExpiredIfNeeded(
  env: PaymentServiceEnv,
  order: {
    id: string;
    reservationId: string | null;
    status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
    expiresAt: Date;
  },
) {
  if (order.status !== 'pending') {
    return;
  }

  if (order.expiresAt.getTime() > Date.now()) {
    return;
  }

  const database = getDatabase(env.DATABASE_URL);

  if (order.reservationId) {
    try {
      await releaseReservation(env, order.reservationId, 'expired');
    } catch (error) {
      if (error instanceof OrderReservationServiceError) {
        throw new PaymentServiceError(error.code, error.message);
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
    .where(and(eq(orders.id, order.id), eq(orders.status, 'pending')));
}

async function sendNotification(
  userId: string | null | undefined,
  type: PaymentNotificationType,
  title: string,
  body: string,
  metadata: Record<string, unknown>,
  databaseUrl?: string,
) {
  if (!userId) {
    return;
  }

  await notificationService.sendNotification(userId, type, title, body, metadata, databaseUrl);
}

async function enqueuePostPaymentEffects(
  env: PaymentServiceEnv,
  payload: SuccessfulPaymentFulfillmentPayload,
) {
  const databaseUrl = env.DATABASE_URL ?? getProcessEnv('DATABASE_URL');
  const emailService = createEmailService({
    EMAIL_API_KEY: env.EMAIL_API_KEY,
    EMAIL_FROM: env.EMAIL_FROM,
  });
  const orderEmail = buildOrderConfirmationEmail(
    payload.buyerName,
    payload.orderNumber,
    payload.items,
  );

  await Promise.allSettled([
    sendNotification(
      payload.buyerId,
      'order_confirmed',
      'Pesanan Dikonfirmasi',
      `Pembayaran untuk order ${payload.orderNumber} berhasil diterima.`,
      {
        order_id: payload.orderId,
        order_number: payload.orderNumber,
        event_id: payload.eventId,
      },
      databaseUrl,
    ),
    sendNotification(
      payload.sellerUserId,
      'new_order',
      'Pesanan Baru',
      `Ada pesanan baru yang sudah dibayar untuk event ${payload.eventTitle}.`,
      {
        order_id: payload.orderId,
        order_number: payload.orderNumber,
        event_id: payload.eventId,
      },
      databaseUrl,
    ),
    emailService.sendEmail(payload.buyerEmail, orderEmail.subject, orderEmail.html),
  ]);
}

async function loadSuccessfulPaymentFulfillmentPayload(orderId: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const order = await database.query.orders.findFirst({
    where: eq(orders.id, orderId),
    columns: {
      id: true,
      orderNumber: true,
    },
    with: {
      user: {
        columns: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      orderItems: {
        columns: {
          quantity: true,
          unitPrice: true,
        },
        with: {
          ticketTier: {
            columns: {
              name: true,
            },
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
    },
  });

  if (!order?.user) {
    throw new PaymentServiceError('ORDER_NOT_FOUND', 'Order not found.');
  }

  const firstEvent = order.orderItems[0]?.ticketTier?.event;

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    buyerId: order.user.id,
    buyerEmail: order.user.email,
    buyerName: order.user.fullName,
    sellerUserId: firstEvent?.sellerProfile?.userId,
    eventId: firstEvent?.id ?? '',
    eventTitle: firstEvent?.title ?? 'event',
    items: order.orderItems
      .filter((item) => item.ticketTier)
      .map((item) => ({
        name: item.ticketTier!.name,
        quantity: item.quantity,
        price: Number(item.unitPrice),
      })),
  } satisfies SuccessfulPaymentFulfillmentPayload;
}

async function fulfillSuccessfulPayment(env: PaymentServiceEnv, orderId: string, databaseUrl?: string) {
  const fulfillmentPayload = await loadSuccessfulPaymentFulfillmentPayload(orderId, databaseUrl);
  await generateTickets(orderId, databaseUrl);
  await enqueuePostPaymentEffects(env, fulfillmentPayload);
}


export const paymentService = {
  async initiatePayment(
    env: PaymentServiceEnv,
    userId: string,
    orderId: string,
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentPayload> {
    const database = getDatabase(env.DATABASE_URL);
    const order = await database.query.orders.findFirst({
      where: eq(orders.id, orderId),
      columns: {
        id: true,
        userId: true,
        reservationId: true,
        status: true,
        expiresAt: true,
      },
      with: {
        payment: {
          columns: {
            id: true,
            method: true,
            status: true,
            externalRef: true,
          },
        },
      },
    });

    if (!order?.payment) {
      throw new PaymentServiceError('ORDER_NOT_FOUND', 'Order not found.');
    }

    if (order.userId !== userId) {
      throw new PaymentServiceError('FORBIDDEN', 'You do not have access to this order.');
    }

    await markOrderExpiredIfNeeded(env, order);

    if (order.expiresAt.getTime() <= Date.now()) {
      throw new PaymentServiceError('INVALID_STATE', 'Order payment window has expired.');
    }

    if (order.status !== 'pending' || !['pending', 'failed'].includes(order.payment.status)) {
      throw new PaymentServiceError('INVALID_STATE', 'Order is not awaiting payment.');
    }

    const externalRef =
      order.payment.status === 'failed' || !order.payment.externalRef
        ? buildExternalRef()
        : order.payment.externalRef;
    const paymentUrl = buildMockPaymentUrl(externalRef, input.method);

    const [updatedPayment] = await database
      .update(payments)
      .set({
        method: input.method,
        status: 'pending',
        externalRef,
        paidAt: null,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, order.payment.id))
      .returning({
        id: payments.id,
        method: payments.method,
        status: payments.status,
        externalRef: payments.externalRef,
      });

    if (!updatedPayment?.externalRef) {
      throw new PaymentServiceError('PAYMENT_NOT_FOUND', 'Payment not found.');
    }

    return {
      order_id: order.id,
      payment_id: updatedPayment.id,
      method: updatedPayment.method,
      status: updatedPayment.status,
      external_ref: updatedPayment.externalRef,
      payment_url: paymentUrl,
    };
  },

  async handleWebhook(
    env: PaymentServiceEnv,
    headers: Headers,
    rawBody: string,
    body: PaymentWebhookInput,
    backgroundTaskScheduler?: BackgroundTaskScheduler,
  ): Promise<PaymentWebhookPayload> {
    const startedAt = Date.now();
    const steps: TimedStep[] = [];
    const signatureStartedAt = Date.now();
    await verifyWebhookSignature(headers, rawBody, env);
    steps.push({
      step: 'verify_signature',
      durationMs: Date.now() - signatureStartedAt,
    });

    const databaseUrl = env.DATABASE_URL ?? getProcessEnv('DATABASE_URL');
    const database = getDatabase(databaseUrl);
    const paymentLookupStartedAt = Date.now();
    const [payment] = await database
      .select({
        id: payments.id,
        orderId: payments.orderId,
        status: payments.status,
        externalRef: payments.externalRef,
        order: {
          id: orders.id,
          reservationId: orders.reservationId,
          status: orders.status,
          expiresAt: orders.expiresAt,
        },
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(eq(payments.externalRef, body.external_ref))
      .limit(1);
    steps.push({
      step: 'payment_lookup',
      durationMs: Date.now() - paymentLookupStartedAt,
    });

    if (!payment?.order || !payment.externalRef) {
      throw new PaymentServiceError('PAYMENT_NOT_FOUND', 'Payment not found.');
    }

    if (payment.status === 'success') {
      const ticketsStartedAt = Date.now();
      await generateTickets(payment.order.id, databaseUrl);
      steps.push({
        step: 'generate_tickets_for_ignored_success',
        durationMs: Date.now() - ticketsStartedAt,
      });

      logTimedSteps(
        'payment.handleWebhook',
        {
          externalRef: body.external_ref,
          outcome: 'ignored',
          totalDurationMs: Date.now() - startedAt,
        },
        steps,
      );

      return {
        order_id: payment.order.id,
        payment_id: payment.id,
        external_ref: payment.externalRef,
        status: 'ignored',
      };
    }

    if (payment.order.status !== 'pending') {
      throw new PaymentServiceError('INVALID_STATE', 'Order is not awaiting payment confirmation.');
    }

    await markOrderExpiredIfNeeded(env, payment.order);

    if (payment.order.expiresAt.getTime() <= Date.now()) {
      throw new PaymentServiceError('INVALID_STATE', 'Order payment window has expired.');
    }

    const paidAt = body.paid_at ? new Date(body.paid_at) : new Date();

    if (body.status === 'failed') {
      const failedUpdateStartedAt = Date.now();
      await database
        .update(payments)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
      steps.push({
        step: 'mark_payment_failed',
        durationMs: Date.now() - failedUpdateStartedAt,
      });

      logTimedSteps(
        'payment.handleWebhook',
        {
          externalRef: body.external_ref,
          outcome: 'failed',
          totalDurationMs: Date.now() - startedAt,
        },
        steps,
      );

      return {
        order_id: payment.order.id,
        payment_id: payment.id,
        external_ref: payment.externalRef,
        status: 'failed',
      };
    }

    const transitionStartedAt = Date.now();
    const transactionSteps: TimedStep[] = [];
    const transitionResult = await database.transaction(async (tx) => {
      const updatePaymentStartedAt = Date.now();
      const [updatedPayment] = await tx
        .update(payments)
        .set({
          status: 'success',
          paidAt,
          updatedAt: new Date(),
        })
        .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')))
        .returning({
          id: payments.id,
        });
      transactionSteps.push({
        step: 'tx_update_payment',
        durationMs: Date.now() - updatePaymentStartedAt,
      });

      if (!updatedPayment) {
        return {
          transitioned: false,
        } as const;
      }

      const updateOrderStartedAt = Date.now();
      const [updatedOrder] = await tx
        .update(orders)
        .set({
          status: 'confirmed',
          confirmedAt: paidAt,
          updatedAt: new Date(),
        })
        .where(and(eq(orders.id, payment.order.id), eq(orders.status, 'pending')))
        .returning({
          id: orders.id,
        });
      transactionSteps.push({
        step: 'tx_update_order',
        durationMs: Date.now() - updateOrderStartedAt,
      });

      if (!updatedOrder) {
        throw new PaymentServiceError(
          'INVALID_STATE',
          'Order is not awaiting payment confirmation.',
        );
      }

      if (payment.order.reservationId) {
        const updateReservationStartedAt = Date.now();
        const [updatedReservation] = await tx
          .update(reservations)
          .set({
            status: 'converted',
          })
          .where(
            and(
              eq(reservations.id, payment.order.reservationId),
              eq(reservations.status, 'active'),
            ),
          )
          .returning({
            id: reservations.id,
          });
        transactionSteps.push({
          step: 'tx_update_reservation',
          durationMs: Date.now() - updateReservationStartedAt,
        });

        if (!updatedReservation) {
          throw new PaymentServiceError(
            'INVALID_STATE',
            'Reservation is not active for payment confirmation.',
          );
        }

        transactionSteps.push({
          step: 'tx_update_ticket_tier',
          durationMs: 0,
        });
      }

      return {
        transitioned: true,
      } as const;
    });
    steps.push({
      step: 'confirm_payment_transaction',
      durationMs: Date.now() - transitionStartedAt,
    });
    steps.push(...transactionSteps);

    if (transitionResult.transitioned && payment.order.reservationId) {
      if (
        scheduleBackgroundTask(
          backgroundTaskScheduler,
          () => confirmReservation(env, payment.order.reservationId!),
          'sync_reservation_state',
        )
      ) {
        steps.push({
          step: 'sync_reservation_state_deferred',
          durationMs: 0,
        });
      } else {
        const syncReservationStartedAt = Date.now();
        await confirmReservation(env, payment.order.reservationId);
        steps.push({
          step: 'sync_reservation_state',
          durationMs: Date.now() - syncReservationStartedAt,
        });
      }
    }

    if (!transitionResult.transitioned) {
      const latestPaymentLookupStartedAt = Date.now();
      const latestPayment = await database.query.payments.findFirst({
        where: eq(payments.id, payment.id),
        columns: {
          status: true,
        },
      });
      steps.push({
        step: 'latest_payment_lookup',
        durationMs: Date.now() - latestPaymentLookupStartedAt,
      });

      if (latestPayment?.status === 'success') {
        const ticketsStartedAt = Date.now();
        await generateTickets(payment.order.id, databaseUrl);
        steps.push({
          step: 'generate_tickets_after_race',
          durationMs: Date.now() - ticketsStartedAt,
        });

        logTimedSteps(
          'payment.handleWebhook',
          {
            externalRef: body.external_ref,
            outcome: 'ignored_after_race',
            totalDurationMs: Date.now() - startedAt,
          },
          steps,
        );

        return {
          order_id: payment.order.id,
          payment_id: payment.id,
          external_ref: payment.externalRef,
          status: 'ignored',
        };
      }

      throw new PaymentServiceError('INVALID_STATE', 'Payment is not awaiting confirmation.');
    }

    if (
      scheduleBackgroundTask(
        backgroundTaskScheduler,
        () => fulfillSuccessfulPayment(env, payment.order.id, databaseUrl),
        'fulfill_successful_payment',
      )
    ) {
      steps.push({
        step: 'successful_payment_fulfillment_deferred',
        durationMs: 0,
      });
    } else {
      const fulfillmentStartedAt = Date.now();
      await fulfillSuccessfulPayment(env, payment.order.id, databaseUrl);
      steps.push({
        step: 'successful_payment_fulfillment',
        durationMs: Date.now() - fulfillmentStartedAt,
      });
    }

    logTimedSteps(
      'payment.handleWebhook',
      {
        externalRef: body.external_ref,
        outcome: 'success',
        totalDurationMs: Date.now() - startedAt,
      },
      steps,
    );

    return {
      order_id: payment.order.id,
      payment_id: payment.id,
      external_ref: payment.externalRef,
      status: 'success',
    };
  },
};
