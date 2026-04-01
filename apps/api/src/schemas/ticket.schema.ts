import { z } from '@hono/zod-openapi';

const ticketStatusSchema = z.enum(['valid', 'used', 'cancelled', 'refunded']);

export const listTicketsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
  })
  .openapi('ListTicketsQuery');

export const ticketIdParamSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'af1e1e0c-c77d-4d9d-8b0f-0ff713738d89' }),
  })
  .openapi('TicketIdParam');

export const ticketsPaginationMetaSchema = z
  .object({
    total: z.number().int().nonnegative().openapi({ example: 6 }),
    page: z.number().int().positive().openapi({ example: 1 }),
    limit: z.number().int().positive().openapi({ example: 20 }),
    totalPages: z.number().int().nonnegative().openapi({ example: 1 }),
  })
  .openapi('TicketsPaginationMeta');

export const ticketListItemSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'af1e1e0c-c77d-4d9d-8b0f-0ff713738d89' }),
    order_id: z.string().uuid().openapi({ example: 'f4fe78e2-4909-4fd4-bf51-f65077a355ea' }),
    order_number: z.string().openapi({ example: 'JVX-20260401-48291' }),
    ticket_tier_id: z
      .string()
      .uuid()
      .openapi({ example: '9012ee69-d83a-44b2-9588-9622a736ab42' }),
    tier_name: z.string().openapi({ example: 'VIP' }),
    ticket_code: z.string().openapi({ example: 'JVX-AB12CD34EF56' }),
    status: ticketStatusSchema.openapi({ example: 'valid' }),
    issued_at: z.string().datetime().openapi({ example: '2026-04-01T03:05:00.000Z' }),
    event_id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    event_slug: z.string().openapi({ example: 'festival-musik-nusantara' }),
    event_title: z.string().openapi({ example: 'Festival Musik Nusantara' }),
    event_start_at: z.string().datetime().openapi({ example: '2026-06-01T12:00:00.000Z' }),
    venue_name: z.string().openapi({ example: 'Istora Senayan' }),
    venue_city: z.string().openapi({ example: 'Jakarta' }),
  })
  .openapi('TicketListItem');

export const ticketListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ticketListItemSchema),
    meta: ticketsPaginationMetaSchema,
  })
  .openapi('TicketListResponse');

export const ticketDetailSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'af1e1e0c-c77d-4d9d-8b0f-0ff713738d89' }),
    order_id: z.string().uuid().openapi({ example: 'f4fe78e2-4909-4fd4-bf51-f65077a355ea' }),
    order_number: z.string().openapi({ example: 'JVX-20260401-48291' }),
    ticket_tier_id: z
      .string()
      .uuid()
      .openapi({ example: '9012ee69-d83a-44b2-9588-9622a736ab42' }),
    tier_name: z.string().openapi({ example: 'VIP' }),
    ticket_code: z.string().openapi({ example: 'JVX-AB12CD34EF56' }),
    qr_data: z.string().openapi({ example: 'JVX-AB12CD34EF56' }),
    attendee_name: z.string().nullable().openapi({ example: null }),
    attendee_email: z.string().email().nullable().openapi({ example: null }),
    status: ticketStatusSchema.openapi({ example: 'valid' }),
    issued_at: z.string().datetime().openapi({ example: '2026-04-01T03:05:00.000Z' }),
    checked_in_at: z.string().datetime().nullable().openapi({ example: null }),
    event: z
      .object({
        id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
        slug: z.string().openapi({ example: 'festival-musik-nusantara' }),
        title: z.string().openapi({ example: 'Festival Musik Nusantara' }),
        banner_url: z.string().nullable().openapi({ example: 'https://cdn.jeevatix.id/banner.png' }),
        start_at: z.string().datetime().openapi({ example: '2026-06-01T12:00:00.000Z' }),
        end_at: z.string().datetime().openapi({ example: '2026-06-01T18:00:00.000Z' }),
        venue_name: z.string().openapi({ example: 'Istora Senayan' }),
        venue_address: z.string().nullable().openapi({ example: 'Jl. Pintu Satu Senayan' }),
        venue_city: z.string().openapi({ example: 'Jakarta' }),
      })
      .openapi('TicketDetailEvent'),
  })
  .openapi('TicketDetail');

export const ticketResponseSchema = z
  .object({
    success: z.literal(true),
    data: ticketDetailSchema,
  })
  .openapi('TicketResponse');

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
export type TicketListItem = z.infer<typeof ticketListItemSchema>;
export type TicketDetail = z.infer<typeof ticketDetailSchema>;
