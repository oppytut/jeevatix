import { z } from '@hono/zod-openapi';

const ticketTierStatusSchema = z.enum(['available', 'sold_out', 'hidden']);

function isValidDate(value: string | undefined) {
  if (!value) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function validateTierTemporalFields(
  value: {
    sale_start_at?: string;
    sale_end_at?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (isValidDate(value.sale_start_at) && isValidDate(value.sale_end_at)) {
    if (new Date(value.sale_end_at as string) <= new Date(value.sale_start_at as string)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'sale_end_at must be later than sale_start_at.',
        path: ['sale_end_at'],
      });
    }
  }
}

const createTierSchemaBase = z.object({
  name: z.string().trim().min(1).max(100).openapi({ example: 'VIP' }),
  description: z
    .string()
    .optional()
    .openapi({ example: 'Akses area depan panggung dan jalur antrean prioritas.' }),
  price: z.coerce.number().nonnegative().openapi({ example: 350000 }),
  quota: z.coerce.number().int().min(1).openapi({ example: 100 }),
  sort_order: z.coerce.number().int().min(0).default(0).openapi({ example: 0 }),
  sale_start_at: z
    .string()
    .datetime()
    .optional()
    .openapi({ example: '2026-05-01T10:00:00.000Z' }),
  sale_end_at: z
    .string()
    .datetime()
    .optional()
    .openapi({ example: '2026-06-01T10:00:00.000Z' }),
});

export const createTierSchema = createTierSchemaBase
  .superRefine(validateTierTemporalFields)
  .openapi('CreateTierInput');

export const updateTierSchema = createTierSchemaBase
  .partial()
  .extend({
    status: ticketTierStatusSchema.optional().openapi({ example: 'available' }),
  })
  .superRefine(validateTierTemporalFields)
  .openapi('UpdateTierInput');

export const sellerEventTierParamsSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
  })
  .openapi('SellerEventTierParams');

export const sellerEventTierByIdParamsSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    tierId: z.string().uuid().openapi({ example: '9012ee69-d83a-44b2-9588-9622a736ab42' }),
  })
  .openapi('SellerEventTierByIdParams');

export const sellerTierSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '9012ee69-d83a-44b2-9588-9622a736ab42' }),
    event_id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    name: z.string().openapi({ example: 'VIP' }),
    description: z
      .string()
      .nullable()
      .openapi({ example: 'Akses area depan panggung dan jalur antrean prioritas.' }),
    price: z.number().nonnegative().openapi({ example: 350000 }),
    quota: z.number().int().min(0).openapi({ example: 100 }),
    sold_count: z.number().int().min(0).openapi({ example: 24 }),
    sort_order: z.number().int().min(0).openapi({ example: 0 }),
    status: ticketTierStatusSchema.openapi({ example: 'available' }),
    sale_start_at: z.string().datetime().nullable().openapi({ example: '2026-05-01T10:00:00.000Z' }),
    sale_end_at: z.string().datetime().nullable().openapi({ example: '2026-06-01T10:00:00.000Z' }),
    created_at: z.string().datetime().openapi({ example: '2026-03-31T09:00:00.000Z' }),
    updated_at: z.string().datetime().openapi({ example: '2026-03-31T09:00:00.000Z' }),
  })
  .openapi('SellerTier');

export const sellerTierListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(sellerTierSchema),
  })
  .openapi('SellerTierListResponse');

export const sellerTierResponseSchema = z
  .object({
    success: z.literal(true),
    data: sellerTierSchema,
  })
  .openapi('SellerTierResponse');

export const sellerTierErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: 'TIER_NOT_FOUND' }),
      message: z.string().openapi({ example: 'Ticket tier not found.' }),
    }),
  })
  .openapi('SellerTierErrorResponse');

export type CreateTierInput = z.infer<typeof createTierSchema>;
export type UpdateTierInput = z.infer<typeof updateTierSchema>;
export type SellerTier = z.infer<typeof sellerTierSchema>;