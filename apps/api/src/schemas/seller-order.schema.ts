import { z } from '@hono/zod-openapi';

const sellerOrderStatusSchema = z.enum(['pending', 'confirmed', 'expired', 'cancelled', 'refunded']);
const sellerPaymentStatusSchema = z.enum(['pending', 'success', 'failed', 'refunded']);
const sellerPaymentMethodSchema = z.enum([
  'bank_transfer',
  'e_wallet',
  'credit_card',
  'virtual_account',
]);

export const listSellerOrdersQuerySchema = z
  .object({
    event_id: z
      .string()
      .uuid()
      .optional()
      .openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    status: sellerOrderStatusSchema.optional().openapi({ example: 'confirmed' }),
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
  })
  .openapi('ListSellerOrdersQuery');

export const sellerOrderIdParamSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'f4fe78e2-4909-4fd4-bf51-f65077a355ea' }),
  })
  .openapi('SellerOrderIdParam');

export const sellerOrdersPaginationMetaSchema = z
  .object({
    total: z.number().int().nonnegative().openapi({ example: 24 }),
    page: z.number().int().positive().openapi({ example: 1 }),
    limit: z.number().int().positive().openapi({ example: 20 }),
    totalPages: z.number().int().nonnegative().openapi({ example: 2 }),
  })
  .openapi('SellerOrdersPaginationMeta');

export const sellerOrderListItemSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'f4fe78e2-4909-4fd4-bf51-f65077a355ea' }),
    order_number: z.string().openapi({ example: 'JVX-20260401-48291' }),
    status: sellerOrderStatusSchema.openapi({ example: 'confirmed' }),
    total_amount: z.number().nonnegative().openapi({ example: 700000 }),
    buyer_id: z.string().uuid().openapi({ example: '3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a' }),
    buyer_name: z.string().openapi({ example: 'Budi Santoso' }),
    buyer_email: z.string().email().openapi({ example: 'buyer@jeevatix.id' }),
    event_id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    event_title: z.string().openapi({ example: 'Festival Musik Nusantara' }),
    event_slug: z.string().openapi({ example: 'festival-musik-nusantara' }),
    payment_status: sellerPaymentStatusSchema.openapi({ example: 'success' }),
    created_at: z.string().datetime().openapi({ example: '2026-04-01T03:00:00.000Z' }),
    confirmed_at: z.string().datetime().nullable().openapi({ example: '2026-04-01T03:05:00.000Z' }),
  })
  .openapi('SellerOrderListItem');

export const sellerOrderBuyerSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a' }),
    full_name: z.string().openapi({ example: 'Budi Santoso' }),
    email: z.string().email().openapi({ example: 'buyer@jeevatix.id' }),
    phone: z.string().nullable().openapi({ example: '081234567890' }),
  })
  .openapi('SellerOrderBuyer');

export const sellerOrderEventSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    title: z.string().openapi({ example: 'Festival Musik Nusantara' }),
    slug: z.string().openapi({ example: 'festival-musik-nusantara' }),
    start_at: z.string().datetime().openapi({ example: '2026-06-10T19:00:00.000Z' }),
    venue_city: z.string().openapi({ example: 'Jakarta' }),
  })
  .openapi('SellerOrderEvent');

export const sellerOrderItemSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '3f55db7f-8249-4eb0-bbde-1fc67f4e5d53' }),
    ticket_tier_id: z
      .string()
      .uuid()
      .openapi({ example: '9012ee69-d83a-44b2-9588-9622a736ab42' }),
    tier_name: z.string().openapi({ example: 'VIP' }),
    quantity: z.number().int().min(1).openapi({ example: 2 }),
    unit_price: z.number().nonnegative().openapi({ example: 350000 }),
    subtotal: z.number().nonnegative().openapi({ example: 700000 }),
  })
  .openapi('SellerOrderItem');

export const sellerOrderPaymentSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'fb16c03d-c050-4ec9-bc36-e756bc7a12b5' }),
    method: sellerPaymentMethodSchema.openapi({ example: 'bank_transfer' }),
    status: sellerPaymentStatusSchema.openapi({ example: 'success' }),
    amount: z.number().nonnegative().openapi({ example: 700000 }),
    external_ref: z.string().nullable().openapi({ example: 'PAY-20260401-AB12CD34' }),
    paid_at: z.string().datetime().nullable().openapi({ example: '2026-04-01T03:05:00.000Z' }),
    created_at: z.string().datetime().openapi({ example: '2026-04-01T03:00:00.000Z' }),
    updated_at: z.string().datetime().openapi({ example: '2026-04-01T03:05:00.000Z' }),
  })
  .openapi('SellerOrderPayment');

export const sellerOrderDetailSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'f4fe78e2-4909-4fd4-bf51-f65077a355ea' }),
    order_number: z.string().openapi({ example: 'JVX-20260401-48291' }),
    status: sellerOrderStatusSchema.openapi({ example: 'confirmed' }),
    total_amount: z.number().nonnegative().openapi({ example: 700000 }),
    service_fee: z.number().nonnegative().openapi({ example: 0 }),
    expires_at: z.string().datetime().openapi({ example: '2026-04-01T03:30:00.000Z' }),
    confirmed_at: z.string().datetime().nullable().openapi({ example: '2026-04-01T03:05:00.000Z' }),
    created_at: z.string().datetime().openapi({ example: '2026-04-01T03:00:00.000Z' }),
    updated_at: z.string().datetime().openapi({ example: '2026-04-01T03:05:00.000Z' }),
    buyer: sellerOrderBuyerSchema,
    event: sellerOrderEventSchema,
    items: z.array(sellerOrderItemSchema),
    payment: sellerOrderPaymentSchema,
  })
  .openapi('SellerOrderDetail');

export const sellerOrdersListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(sellerOrderListItemSchema),
    meta: sellerOrdersPaginationMetaSchema,
  })
  .openapi('SellerOrdersListResponse');

export const sellerOrderResponseSchema = z
  .object({
    success: z.literal(true),
    data: sellerOrderDetailSchema,
  })
  .openapi('SellerOrderResponse');

export type ListSellerOrdersQuery = z.infer<typeof listSellerOrdersQuerySchema>;
export type SellerOrderListItem = z.infer<typeof sellerOrderListItemSchema>;
export type SellerOrderDetail = z.infer<typeof sellerOrderDetailSchema>;