import { z } from '@hono/zod-openapi';

const checkinStatusSchema = z.enum(['SUCCESS', 'ALREADY_USED', 'INVALID']);

export const checkinSchema = z
  .object({
    ticket_code: z.string().min(1).max(50).openapi({ example: 'JVX-AB12CD34EF56' }),
  })
  .openapi('CheckinInput');

export const checkinEventParamsSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
  })
  .openapi('CheckinEventParams');

export const checkinResultSchema = z
  .object({
    status: checkinStatusSchema.openapi({ example: 'SUCCESS' }),
    ticket_id: z.string().uuid().nullable().openapi({ example: 'af1e1e0c-c77d-4d9d-8b0f-0ff713738d89' }),
    ticket_code: z.string().nullable().openapi({ example: 'JVX-AB12CD34EF56' }),
    buyer_name: z.string().nullable().openapi({ example: 'Budi Santoso' }),
    buyer_email: z.string().email().nullable().openapi({ example: 'buyer@jeevatix.id' }),
    tier_name: z.string().nullable().openapi({ example: 'VIP' }),
    checked_in_at: z.string().datetime().nullable().openapi({ example: '2026-04-01T09:45:00.000Z' }),
    message: z.string().openapi({ example: 'Ticket checked in successfully.' }),
  })
  .openapi('CheckinResult');

export const recentCheckinItemSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '52bcce6b-11a0-4876-97ba-1a2c58490916' }),
    ticket_id: z.string().uuid().openapi({ example: 'af1e1e0c-c77d-4d9d-8b0f-0ff713738d89' }),
    ticket_code: z.string().openapi({ example: 'JVX-AB12CD34EF56' }),
    buyer_name: z.string().nullable().openapi({ example: 'Budi Santoso' }),
    buyer_email: z.string().email().nullable().openapi({ example: 'buyer@jeevatix.id' }),
    tier_name: z.string().openapi({ example: 'VIP' }),
    checked_in_at: z.string().datetime().openapi({ example: '2026-04-01T09:45:00.000Z' }),
  })
  .openapi('RecentCheckinItem');

export const checkinStatsSchema = z
  .object({
    event_id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    event_title: z.string().openapi({ example: 'Festival Musik Nusantara' }),
    total_tickets: z.number().int().nonnegative().openapi({ example: 500 }),
    checked_in: z.number().int().nonnegative().openapi({ example: 328 }),
    remaining: z.number().int().nonnegative().openapi({ example: 172 }),
    percentage: z.number().min(0).max(100).openapi({ example: 65.6 }),
    recent_checkins: z.array(recentCheckinItemSchema),
  })
  .openapi('CheckinStats');

export const checkinResponseSchema = z
  .object({
    success: z.literal(true),
    data: checkinResultSchema,
  })
  .openapi('CheckinResponse');

export const checkinStatsResponseSchema = z
  .object({
    success: z.literal(true),
    data: checkinStatsSchema,
  })
  .openapi('CheckinStatsResponse');

export type CheckinInput = z.infer<typeof checkinSchema>;
export type CheckinResult = z.infer<typeof checkinResultSchema>;
export type CheckinStats = z.infer<typeof checkinStatsSchema>;
