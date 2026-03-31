import { z } from '@hono/zod-openapi';

const eventStatusSchema = z.enum([
  'draft',
  'pending_review',
  'published',
  'rejected',
  'ongoing',
  'completed',
  'cancelled',
]);

const ticketTierStatusSchema = z.enum(['available', 'sold_out', 'hidden']);

const temporalValidationMessage = {
  endAt: 'end_at must be later than start_at.',
  saleWindow: 'sale_end_at must be later than sale_start_at.',
  saleBeforeEvent: 'sale_start_at must be earlier than or equal to start_at.',
};

function isValidDate(value: string | undefined) {
  if (!value) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function validateEventTemporalFields(
  value: {
    start_at?: string;
    end_at?: string;
    sale_start_at?: string;
    sale_end_at?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (isValidDate(value.start_at) && isValidDate(value.end_at)) {
    if (new Date(value.end_at as string) <= new Date(value.start_at as string)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: temporalValidationMessage.endAt,
        path: ['end_at'],
      });
    }
  }

  if (isValidDate(value.sale_start_at) && isValidDate(value.sale_end_at)) {
    if (new Date(value.sale_end_at as string) <= new Date(value.sale_start_at as string)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: temporalValidationMessage.saleWindow,
        path: ['sale_end_at'],
      });
    }
  }

  if (isValidDate(value.sale_start_at) && isValidDate(value.start_at)) {
    if (new Date(value.sale_start_at as string) > new Date(value.start_at as string)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: temporalValidationMessage.saleBeforeEvent,
        path: ['sale_start_at'],
      });
    }
  }
}

export const sellerEventIdParamSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
  })
  .openapi('SellerEventIdParam');

export const sellerEventsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    status: eventStatusSchema.optional().openapi({ example: 'draft' }),
  })
  .openapi('SellerEventsQuery');

export const eventImageInputSchema = z
  .object({
    image_url: z
      .string()
      .url()
      .openapi({ example: 'https://cdn.jeevatix.id/events/festival/gallery-1.jpg' }),
    sort_order: z.coerce.number().int().min(0).default(0).openapi({ example: 0 }),
  })
  .openapi('EventImageInput');

export const ticketTierInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100).openapi({ example: 'VIP' }),
    description: z.string().optional().openapi({ example: 'Akses area depan panggung.' }),
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
  })
  .openapi('TicketTierInput');

const createEventSchemaBase = z.object({
  title: z.string().trim().min(1).max(255).openapi({ example: 'Festival Musik Nusantara' }),
  description: z
    .string()
    .optional()
    .openapi({ example: 'Festival musik lintas genre dengan artis nasional.' }),
  venue_name: z.string().trim().min(1).max(255).openapi({ example: 'Istora Senayan' }),
  venue_address: z
    .string()
    .optional()
    .openapi({ example: 'Jl. Pintu Satu Senayan, Jakarta Pusat' }),
  venue_city: z.string().trim().min(1).max(100).openapi({ example: 'Jakarta' }),
  venue_latitude: z.coerce.number().optional().openapi({ example: -6.2187 }),
  venue_longitude: z.coerce.number().optional().openapi({ example: 106.8022 }),
  start_at: z.string().datetime().openapi({ example: '2026-06-14T19:00:00.000Z' }),
  end_at: z.string().datetime().openapi({ example: '2026-06-14T23:00:00.000Z' }),
  sale_start_at: z.string().datetime().openapi({ example: '2026-05-01T10:00:00.000Z' }),
  sale_end_at: z.string().datetime().openapi({ example: '2026-06-13T23:59:59.000Z' }),
  banner_url: z
    .string()
    .url()
    .optional()
    .openapi({ example: 'https://cdn.jeevatix.id/events/festival/banner.jpg' }),
  max_tickets_per_order: z.coerce.number().int().min(1).max(20).default(5).openapi({ example: 5 }),
  category_ids: z.array(z.coerce.number().int().positive()).min(1).openapi({ example: [1, 4] }),
  images: z.array(eventImageInputSchema).default([]).openapi('EventImageInputList'),
  tiers: z.array(ticketTierInputSchema).min(1).openapi('TicketTierInputList'),
});

export const createEventSchema = createEventSchemaBase
  .superRefine(validateEventTemporalFields)
  .openapi('CreateEventInput');

export const updateEventSchema = createEventSchemaBase
  .partial()
  .superRefine(validateEventTemporalFields)
  .openapi('UpdateEventInput');

export const sellerEventCategorySchema = z
  .object({
    id: z.number().int().positive().openapi({ example: 1 }),
    name: z.string().openapi({ example: 'Musik' }),
    slug: z.string().openapi({ example: 'musik' }),
    icon: z.string().nullable().openapi({ example: 'music-2' }),
  })
  .openapi('SellerEventCategory');

export const sellerEventImageSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'ca6f9e9f-a27b-41a6-bce3-fcd2d139c48d' }),
    image_url: z
      .string()
      .url()
      .openapi({ example: 'https://cdn.jeevatix.id/events/festival/gallery-1.jpg' }),
    sort_order: z.number().int().min(0).openapi({ example: 0 }),
    created_at: z.string().datetime().openapi({ example: '2026-03-31T09:00:00.000Z' }),
  })
  .openapi('SellerEventImage');

export const sellerEventTierSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '9012ee69-d83a-44b2-9588-9622a736ab42' }),
    name: z.string().openapi({ example: 'VIP' }),
    description: z.string().nullable().openapi({ example: 'Akses area depan panggung.' }),
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
  .openapi('SellerEventTier');

export const sellerEventListItemSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    title: z.string().openapi({ example: 'Festival Musik Nusantara' }),
    slug: z.string().openapi({ example: 'festival-musik-nusantara' }),
    venue_city: z.string().openapi({ example: 'Jakarta' }),
    start_at: z.string().datetime().openapi({ example: '2026-06-14T19:00:00.000Z' }),
    end_at: z.string().datetime().openapi({ example: '2026-06-14T23:00:00.000Z' }),
    sale_start_at: z.string().datetime().openapi({ example: '2026-05-01T10:00:00.000Z' }),
    sale_end_at: z.string().datetime().openapi({ example: '2026-06-13T23:59:59.000Z' }),
    banner_url: z.string().nullable().openapi({ example: 'https://cdn.jeevatix.id/events/festival/banner.jpg' }),
    status: eventStatusSchema.openapi({ example: 'draft' }),
    max_tickets_per_order: z.number().int().positive().openapi({ example: 5 }),
    total_quota: z.number().int().min(0).openapi({ example: 400 }),
    total_sold: z.number().int().min(0).openapi({ example: 120 }),
    created_at: z.string().datetime().openapi({ example: '2026-03-31T09:00:00.000Z' }),
    updated_at: z.string().datetime().openapi({ example: '2026-03-31T09:00:00.000Z' }),
  })
  .openapi('SellerEventListItem');

export const sellerEventDetailSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    seller_profile_id: z.string().uuid().openapi({ example: '5a197f34-d1df-4ec2-b0d4-2fd6a18ef61e' }),
    title: z.string().openapi({ example: 'Festival Musik Nusantara' }),
    slug: z.string().openapi({ example: 'festival-musik-nusantara' }),
    description: z
      .string()
      .nullable()
      .openapi({ example: 'Festival musik lintas genre dengan artis nasional.' }),
    venue_name: z.string().openapi({ example: 'Istora Senayan' }),
    venue_address: z.string().nullable().openapi({ example: 'Jl. Pintu Satu Senayan, Jakarta Pusat' }),
    venue_city: z.string().openapi({ example: 'Jakarta' }),
    venue_latitude: z.number().nullable().openapi({ example: -6.2187 }),
    venue_longitude: z.number().nullable().openapi({ example: 106.8022 }),
    start_at: z.string().datetime().openapi({ example: '2026-06-14T19:00:00.000Z' }),
    end_at: z.string().datetime().openapi({ example: '2026-06-14T23:00:00.000Z' }),
    sale_start_at: z.string().datetime().openapi({ example: '2026-05-01T10:00:00.000Z' }),
    sale_end_at: z.string().datetime().openapi({ example: '2026-06-13T23:59:59.000Z' }),
    banner_url: z.string().nullable().openapi({ example: 'https://cdn.jeevatix.id/events/festival/banner.jpg' }),
    status: eventStatusSchema.openapi({ example: 'pending_review' }),
    max_tickets_per_order: z.number().int().positive().openapi({ example: 5 }),
    total_quota: z.number().int().min(0).openapi({ example: 400 }),
    total_sold: z.number().int().min(0).openapi({ example: 120 }),
    categories: z.array(sellerEventCategorySchema),
    images: z.array(sellerEventImageSchema),
    tiers: z.array(sellerEventTierSchema),
    created_at: z.string().datetime().openapi({ example: '2026-03-31T09:00:00.000Z' }),
    updated_at: z.string().datetime().openapi({ example: '2026-03-31T09:00:00.000Z' }),
  })
  .openapi('SellerEventDetail');

export const sellerEventsPaginationMetaSchema = z
  .object({
    total: z.number().int().nonnegative().openapi({ example: 12 }),
    page: z.number().int().positive().openapi({ example: 1 }),
    limit: z.number().int().positive().openapi({ example: 20 }),
    totalPages: z.number().int().nonnegative().openapi({ example: 1 }),
  })
  .openapi('SellerEventsPaginationMeta');

export const sellerEventsListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(sellerEventListItemSchema),
    meta: sellerEventsPaginationMetaSchema,
  })
  .openapi('SellerEventsListResponse');

export const sellerEventDetailResponseSchema = z
  .object({
    success: z.literal(true),
    data: sellerEventDetailSchema,
  })
  .openapi('SellerEventDetailResponse');

export const sellerEventErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: 'EVENT_NOT_FOUND' }),
      message: z.string().openapi({ example: 'Event not found.' }),
    }),
  })
  .openapi('SellerEventErrorResponse');

export type SellerEventIdParam = z.infer<typeof sellerEventIdParamSchema>;
export type SellerEventsQuery = z.infer<typeof sellerEventsQuerySchema>;
export type EventImageInput = z.infer<typeof eventImageInputSchema>;
export type TicketTierInput = z.infer<typeof ticketTierInputSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type SellerEventListItem = z.infer<typeof sellerEventListItemSchema>;
export type SellerEventDetail = z.infer<typeof sellerEventDetailSchema>;
export type SellerEventsPaginationMeta = z.infer<typeof sellerEventsPaginationMetaSchema>;