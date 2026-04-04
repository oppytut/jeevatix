import { z } from '@hono/zod-openapi';

const orderStatusSchema = z.enum(['pending', 'confirmed', 'expired', 'cancelled', 'refunded']);
const paymentStatusSchema = z.enum(['pending', 'success', 'failed', 'refunded']);
const paymentMethodSchema = z.enum(['bank_transfer', 'e_wallet', 'credit_card', 'virtual_account']);
const ticketStatusSchema = z.enum(['valid', 'used', 'cancelled', 'refunded']);

export const createOrderSchema = z
  .object({
    reservation_id: z.string().uuid().openapi({ example: '6f0bb2b8-a945-48ca-80d6-7486d18b2f0b' }),
  })
  .openapi('CreateOrderInput');

export const listOrdersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
  })
  .openapi('ListOrdersQuery');

export const orderIdParamSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'f4fe78e2-4909-4fd4-bf51-f65077a355ea' }),
  })
  .openapi('OrderIdParam');

export const ordersPaginationMetaSchema = z
  .object({
    total: z.number().int().nonnegative().openapi({ example: 24 }),
    page: z.number().int().positive().openapi({ example: 1 }),
    limit: z.number().int().positive().openapi({ example: 20 }),
    totalPages: z.number().int().nonnegative().openapi({ example: 2 }),
  })
  .openapi('OrdersPaginationMeta');

export const orderListItemSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'f4fe78e2-4909-4fd4-bf51-f65077a355ea' }),
    reservation_id: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: '6f0bb2b8-a945-48ca-80d6-7486d18b2f0b' }),
    order_number: z.string().openapi({ example: 'JVX-20260401-48291' }),
    status: orderStatusSchema.openapi({ example: 'pending' }),
    total_amount: z.number().nonnegative().openapi({ example: 700000 }),
    event_id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    event_slug: z.string().openapi({ example: 'festival-musik-nusantara' }),
    event_title: z.string().openapi({ example: 'Festival Musik Nusantara' }),
    created_at: z.string().datetime().openapi({ example: '2026-04-01T03:00:00.000Z' }),
    expires_at: z.string().datetime().openapi({ example: '2026-04-01T03:30:00.000Z' }),
  })
  .openapi('OrderListItem');

export const orderListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(orderListItemSchema),
    meta: ordersPaginationMetaSchema,
  })
  .openapi('OrderListResponse');

export const orderItemSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '3f55db7f-8249-4eb0-bbde-1fc67f4e5d53' }),
    ticket_tier_id: z.string().uuid().openapi({ example: '9012ee69-d83a-44b2-9588-9622a736ab42' }),
    tier_name: z.string().openapi({ example: 'VIP' }),
    quantity: z.number().int().min(1).openapi({ example: 2 }),
    unit_price: z.number().nonnegative().openapi({ example: 350000 }),
    subtotal: z.number().nonnegative().openapi({ example: 700000 }),
  })
  .openapi('OrderItem');

export const orderPaymentSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'fb16c03d-c050-4ec9-bc36-e756bc7a12b5' }),
    method: paymentMethodSchema.openapi({ example: 'bank_transfer' }),
    status: paymentStatusSchema.openapi({ example: 'pending' }),
    amount: z.number().nonnegative().openapi({ example: 700000 }),
    external_ref: z.string().nullable().openapi({ example: null }),
    paid_at: z.string().datetime().nullable().openapi({ example: null }),
    created_at: z.string().datetime().openapi({ example: '2026-04-01T03:00:00.000Z' }),
    updated_at: z.string().datetime().openapi({ example: '2026-04-01T03:00:00.000Z' }),
  })
  .openapi('OrderPayment');

export const orderTicketSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'af1e1e0c-c77d-4d9d-8b0f-0ff713738d89' }),
    ticket_tier_id: z.string().uuid().openapi({ example: '9012ee69-d83a-44b2-9588-9622a736ab42' }),
    ticket_code: z.string().openapi({ example: 'JVX-ABC123XYZ789' }),
    status: ticketStatusSchema.openapi({ example: 'valid' }),
    issued_at: z.string().datetime().openapi({ example: '2026-04-01T03:05:00.000Z' }),
  })
  .openapi('OrderTicket');

export const orderDetailSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'f4fe78e2-4909-4fd4-bf51-f65077a355ea' }),
    reservation_id: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: '6f0bb2b8-a945-48ca-80d6-7486d18b2f0b' }),
    order_number: z.string().openapi({ example: 'JVX-20260401-48291' }),
    status: orderStatusSchema.openapi({ example: 'pending' }),
    total_amount: z.number().nonnegative().openapi({ example: 700000 }),
    service_fee: z.number().nonnegative().openapi({ example: 0 }),
    expires_at: z.string().datetime().openapi({ example: '2026-04-01T03:30:00.000Z' }),
    confirmed_at: z.string().datetime().nullable().openapi({ example: null }),
    created_at: z.string().datetime().openapi({ example: '2026-04-01T03:00:00.000Z' }),
    updated_at: z.string().datetime().openapi({ example: '2026-04-01T03:00:00.000Z' }),
    event_id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    event_slug: z.string().openapi({ example: 'festival-musik-nusantara' }),
    event_title: z.string().openapi({ example: 'Festival Musik Nusantara' }),
    items: z.array(orderItemSchema),
    payment: orderPaymentSchema,
    tickets: z.array(orderTicketSchema),
  })
  .openapi('OrderDetail');

export const orderResponseSchema = z
  .object({
    success: z.literal(true),
    data: orderDetailSchema,
  })
  .openapi('OrderResponse');

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type OrderListItem = z.infer<typeof orderListItemSchema>;
export type OrderDetail = z.infer<typeof orderDetailSchema>;
