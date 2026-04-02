import { z } from '@hono/zod-openapi';

const adminDashboardEventStatusSchema = z.enum([
  'draft',
  'pending_review',
  'published',
  'rejected',
  'ongoing',
  'completed',
  'cancelled',
]);

const adminDashboardOrderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'expired',
  'cancelled',
  'refunded',
]);

export const adminDashboardDailyTransactionSchema = z
  .object({
    date: z.string().openapi({ example: '2026-04-02' }),
    transaction_count: z.number().int().nonnegative().openapi({ example: 18 }),
  })
  .openapi('AdminDashboardDailyTransaction');

export const adminDashboardRecentEventSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    name: z.string().openapi({ example: 'Festival Musik Nusantara' }),
    seller: z.string().openapi({ example: 'EventPro Indonesia' }),
    status: adminDashboardEventStatusSchema.openapi({ example: 'published' }),
    created_at: z.string().datetime().openapi({ example: '2026-04-01T03:00:00.000Z' }),
  })
  .openapi('AdminDashboardRecentEvent');

export const adminDashboardRecentOrderSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'f4fe78e2-4909-4fd4-bf51-f65077a355ea' }),
    order_number: z.string().openapi({ example: 'JVX-20260401-48291' }),
    buyer: z.string().openapi({ example: 'Budi Santoso' }),
    total_amount: z.number().nonnegative().openapi({ example: 700000 }),
    status: adminDashboardOrderStatusSchema.openapi({ example: 'confirmed' }),
    created_at: z.string().datetime().openapi({ example: '2026-04-01T03:00:00.000Z' }),
  })
  .openapi('AdminDashboardRecentOrder');

export const adminDashboardSchema = z
  .object({
    total_users: z.number().int().nonnegative().openapi({ example: 1240 }),
    total_sellers: z.number().int().nonnegative().openapi({ example: 52 }),
    total_buyers: z.number().int().nonnegative().openapi({ example: 1182 }),
    total_events: z.number().int().nonnegative().openapi({ example: 83 }),
    total_events_published: z.number().int().nonnegative().openapi({ example: 41 }),
    total_revenue: z.number().nonnegative().openapi({ example: 245000000 }),
    total_tickets_sold: z.number().int().nonnegative().openapi({ example: 9370 }),
    daily_transactions: z.array(adminDashboardDailyTransactionSchema).openapi({ example: [] }),
    recent_events: z.array(adminDashboardRecentEventSchema).openapi({ example: [] }),
    recent_orders: z.array(adminDashboardRecentOrderSchema).openapi({ example: [] }),
  })
  .openapi('AdminDashboard');

export const adminDashboardResponseSchema = z
  .object({
    success: z.literal(true),
    data: adminDashboardSchema,
  })
  .openapi('AdminDashboardResponse');

export type AdminDashboard = z.infer<typeof adminDashboardSchema>;
export type AdminDashboardDailyTransaction = z.infer<typeof adminDashboardDailyTransactionSchema>;
export type AdminDashboardRecentEvent = z.infer<typeof adminDashboardRecentEventSchema>;
export type AdminDashboardRecentOrder = z.infer<typeof adminDashboardRecentOrderSchema>;