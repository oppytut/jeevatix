import { z } from '@hono/zod-openapi';

const reservationStatusSchema = z.enum(['active', 'converted', 'expired', 'cancelled']);

export const createReservationSchema = z
  .object({
    ticket_tier_id: z
      .string()
      .uuid()
      .openapi({ example: '9012ee69-d83a-44b2-9588-9622a736ab42' }),
    quantity: z.coerce.number().int().min(1).openapi({ example: 2 }),
  })
  .openapi('CreateReservationInput');

export const reservationIdParamSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '6f0bb2b8-a945-48ca-80d6-7486d18b2f0b' }),
  })
  .openapi('ReservationIdParam');

export const reservationCreatePayloadSchema = z
  .object({
    reservation_id: z
      .string()
      .uuid()
      .openapi({ example: '6f0bb2b8-a945-48ca-80d6-7486d18b2f0b' }),
    expires_at: z.string().datetime().openapi({ example: '2026-04-01T02:20:00.000Z' }),
  })
  .openapi('ReservationCreatePayload');

export const reservationCreateResponseSchema = z
  .object({
    success: z.literal(true),
    data: reservationCreatePayloadSchema,
  })
  .openapi('ReservationCreateResponse');

export const reservationDetailSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '6f0bb2b8-a945-48ca-80d6-7486d18b2f0b' }),
    user_id: z.string().uuid().openapi({ example: '3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a' }),
    ticket_tier_id: z
      .string()
      .uuid()
      .openapi({ example: '9012ee69-d83a-44b2-9588-9622a736ab42' }),
    event_id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    event_slug: z.string().openapi({ example: 'festival-musik-nusantara' }),
    event_title: z.string().openapi({ example: 'Festival Musik Nusantara' }),
    tier_name: z.string().openapi({ example: 'VIP' }),
    quantity: z.number().int().min(1).openapi({ example: 2 }),
    status: reservationStatusSchema.openapi({ example: 'active' }),
    expires_at: z.string().datetime().openapi({ example: '2026-04-01T02:20:00.000Z' }),
    created_at: z.string().datetime().openapi({ example: '2026-04-01T02:10:00.000Z' }),
    remaining_seconds: z.number().int().min(0).openapi({ example: 534 }),
  })
  .openapi('ReservationDetail');

export const reservationResponseSchema = z
  .object({
    success: z.literal(true),
    data: reservationDetailSchema,
  })
  .openapi('ReservationResponse');

export const reservationStatePayloadSchema = z
  .object({
    reservation_id: z
      .string()
      .uuid()
      .openapi({ example: '6f0bb2b8-a945-48ca-80d6-7486d18b2f0b' }),
    status: reservationStatusSchema.openapi({ example: 'cancelled' }),
  })
  .openapi('ReservationStatePayload');

export const reservationStateResponseSchema = z
  .object({
    success: z.literal(true),
    data: reservationStatePayloadSchema,
  })
  .openapi('ReservationStateResponse');

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type ReservationIdParam = z.infer<typeof reservationIdParamSchema>;
export type ReservationCreatePayload = z.infer<typeof reservationCreatePayloadSchema>;
export type ReservationDetail = z.infer<typeof reservationDetailSchema>;
export type ReservationStatePayload = z.infer<typeof reservationStatePayloadSchema>;