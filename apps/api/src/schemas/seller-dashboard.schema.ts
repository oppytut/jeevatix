import { z } from '@hono/zod-openapi';

const sellerDashboardOrderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'expired',
  'cancelled',
  'refunded',
]);

export const sellerDashboardRecentOrderSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'f4fe78e2-4909-4fd4-bf51-f65077a355ea' }),
    order_number: z.string().openapi({ example: 'JVX-20260401-48291' }),
    event_title: z.string().openapi({ example: 'Festival Musik Nusantara' }),
    buyer_name: z.string().openapi({ example: 'Budi Santoso' }),
    total_amount: z.number().nonnegative().openapi({ example: 700000 }),
    status: sellerDashboardOrderStatusSchema.openapi({ example: 'confirmed' }),
    created_at: z.string().datetime().openapi({ example: '2026-04-01T03:00:00.000Z' }),
  })
  .openapi('SellerDashboardRecentOrder');

export const sellerDashboardDailySalesPointSchema = z
  .object({
    date: z.string().openapi({ example: '2026-04-01' }),
    tickets_sold: z.number().int().nonnegative().openapi({ example: 14 }),
  })
  .openapi('SellerDashboardDailySalesPoint');

export const sellerDashboardSchema = z
  .object({
    total_events: z.number().int().nonnegative().openapi({ example: 8 }),
    total_revenue: z.number().nonnegative().openapi({ example: 12400000 }),
    total_tickets_sold: z.number().int().nonnegative().openapi({ example: 327 }),
    upcoming_events: z.number().int().nonnegative().openapi({ example: 3 }),
    recent_orders: z.array(sellerDashboardRecentOrderSchema).openapi({ example: [] }),
    daily_sales: z.array(sellerDashboardDailySalesPointSchema).openapi({ example: [] }),
  })
  .openapi('SellerDashboard');

export const sellerDashboardResponseSchema = z
  .object({
    success: z.literal(true),
    data: sellerDashboardSchema,
  })
  .openapi('SellerDashboardResponse');

export type SellerDashboard = z.infer<typeof sellerDashboardSchema>;
export type SellerDashboardRecentOrder = z.infer<typeof sellerDashboardRecentOrderSchema>;
export type SellerDashboardDailySalesPoint = z.infer<typeof sellerDashboardDailySalesPointSchema>;
