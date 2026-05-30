import { apiReference } from '@scalar/hono-api-reference';
import { OpenAPIHono } from '@hono/zod-openapi';
import { withSentry } from '@sentry/cloudflare';

import {
  buildHealthPayload,
  logUnhandledRequestError,
  observabilityMiddleware,
} from './lib/observability';
import { buildSentryOptions } from './lib/sentry';
import { resolveDatabaseUrl } from './lib/database-url';
import { getDb } from '@jeevatix/core';
import { sql } from 'drizzle-orm';
import { sentryTagsMiddleware } from './lib/sentry-context';
import { RateLimiter } from './durable-objects/rate-limiter';
import { TicketReserver } from './durable-objects/ticket-reserver';
import authRoutes from './routes/auth';
import type { AuthEnv } from './middleware/auth';
import { corsMiddleware } from './middleware/cors';
import adminCategoryRoutes from './routes/admin/categories';
import adminDashboardRoutes from './routes/admin/dashboard';
import adminEventRoutes from './routes/admin/events';
import adminOrderRoutes from './routes/admin/orders';
import adminPaymentRoutes from './routes/admin/payments';
import adminUserRoutes from './routes/admin/users';
import cspReportRoutes from './routes/csp-report';
import publicEventRoutes from './routes/events';
import notificationRoutes, { adminNotificationRoutes } from './routes/notifications';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import {
  enqueueReservationCleanup,
  reservationCleanupQueueHandler,
  type ReservationCleanupEnv,
  type ReservationCleanupMessage,
} from './queues/reservation-cleanup';
import reservationRoutes, { adminReservationRoutes } from './routes/reservations';
import sellerCheckinRoutes from './routes/seller/checkin';
import sellerDashboardRoutes from './routes/seller/dashboard';
import sellerEventRoutes from './routes/seller/events';
import sellerOrderRoutes from './routes/seller/orders';
import sellerProfileRoutes from './routes/seller/profile';
import sellerTierRoutes from './routes/seller/tiers';
import ticketRoutes from './routes/tickets';
import uploadRoutes from './routes/upload';
import usersRoutes from './routes/users';

const app = new OpenAPIHono<AuthEnv>();

function jsonError(code: string, message: string) {
  return {
    success: false as const,
    error: {
      code,
      message,
    },
  };
}

async function probeDatabaseLatency(env: AuthEnv['Bindings']): Promise<number | null> {
  try {
    const url = resolveDatabaseUrl(env);
    if (!url) return null;
    const db = getDb(url);
    if (!db) return null;
    const startedAt = Date.now();
    await db.execute(sql`select 1`);
    return Date.now() - startedAt;
  } catch {
    return null;
  }
}

app.use('*', observabilityMiddleware);
app.use('*', sentryTagsMiddleware);
app.use('*', corsMiddleware);

app.onError((error, c) => {
  logUnhandledRequestError(c, error);

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
});

app.get('/health', async (c) => {
  c.header('Cache-Control', 'no-store');
  const base = buildHealthPayload(c.env);
  const dbLatencyMs = await probeDatabaseLatency(c.env);
  const sentryStatus = c.env.SENTRY_DSN?.trim() ? 'enabled' : 'disabled';
  return c.json({ ...base, db_latency_ms: dbLatencyMs, sentry_status: sentryStatus });
});

app.doc('/doc', {
  openapi: '3.1.0',
  info: {
    title: 'Jeevatix API',
    version: '1.0.0',
    description: 'High-performance event ticket platform API',
  },
});

app.get('/reference', apiReference({ url: '/doc' }));

app.route('/admin/categories', adminCategoryRoutes);
app.route('/admin', adminDashboardRoutes);
app.route('/admin', adminEventRoutes);
app.route('/admin/notifications', adminNotificationRoutes);
app.route('/admin', adminOrderRoutes);
app.route('/admin', adminPaymentRoutes);
app.route('/admin/reservations', adminReservationRoutes);
app.route('/admin', adminUserRoutes);
app.route('/auth', authRoutes);
app.route('/', cspReportRoutes);
app.route('/notifications', notificationRoutes);
app.route('/orders', orderRoutes);
app.route('/', paymentRoutes);
app.route('/', publicEventRoutes);
app.route('/reservations', reservationRoutes);
app.route('/seller', sellerCheckinRoutes);
app.route('/seller', sellerDashboardRoutes);
app.route('/seller', sellerEventRoutes);
app.route('/seller', sellerOrderRoutes);
app.route('/seller', sellerProfileRoutes);
app.route('/seller', sellerTierRoutes);
app.route('/tickets', ticketRoutes);
app.route('/upload', uploadRoutes);
app.route('/users', usersRoutes);

type ApiWorker = {
  fetch: typeof app.fetch;
  queue: (
    batch: MessageBatch<ReservationCleanupMessage>,
    env: ReservationCleanupEnv,
    ctx: ExecutionContext,
  ) => Promise<void>;
  scheduled: (
    controller: ScheduledController,
    env: ReservationCleanupEnv,
    ctx: ExecutionContext,
  ) => Promise<void>;
};

async function queueHandler(
  batch: MessageBatch<ReservationCleanupMessage>,
  env: ReservationCleanupEnv,
  ctx: ExecutionContext,
) {
  await reservationCleanupQueueHandler(batch, env, ctx);
}

async function scheduledHandler(
  controller: ScheduledController,
  env: ReservationCleanupEnv,
  ctx: ExecutionContext,
) {
  ctx.waitUntil(enqueueReservationCleanup(env, controller.scheduledTime));
}

const worker: ApiWorker = {
  fetch: app.fetch,
  queue: queueHandler,
  scheduled: scheduledHandler,
};

const wrappedWorker = withSentry(
  (env: AuthEnv['Bindings']) => buildSentryOptions(env) ?? undefined,
  worker as unknown as ExportedHandler<AuthEnv['Bindings']>,
) as unknown as ApiWorker;

export default wrappedWorker;
export { app, queueHandler, scheduledHandler };
export { RateLimiter, TicketReserver };
