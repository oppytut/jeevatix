import { z } from '@hono/zod-openapi';

const publicEventStatusSchema = z.enum(['published', 'ongoing']);

const ticketTierStatusSchema = z.enum(['available', 'sold_out', 'hidden']);

function isValidDate(value: string | undefined) {
  if (!value) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

export const listEventsQuerySchema = z
  .object({
    search: z.string().trim().min(1).optional().openapi({ example: 'festival musik' }),
    category: z.string().trim().min(1).optional().openapi({ example: 'musik' }),
    city: z.string().trim().min(1).optional().openapi({ example: 'Jakarta' }),
    date_from: z
      .string()
      .optional()
      .refine((value) => value === undefined || isValidDate(value), {
        message: 'date_from must be a valid date string.',
      })
      .openapi({ example: '2026-06-01T00:00:00.000Z' }),
    date_to: z
      .string()
      .optional()
      .refine((value) => value === undefined || isValidDate(value), {
        message: 'date_to must be a valid date string.',
      })
      .openapi({ example: '2026-06-30T23:59:59.000Z' }),
    price_min: z.coerce.number().nonnegative().optional().openapi({ example: 50000 }),
    price_max: z.coerce.number().nonnegative().optional().openapi({ example: 350000 }),
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
  })
  .superRefine((value, ctx) => {
    if (
      value.date_from &&
      value.date_to &&
      new Date(value.date_from).getTime() > new Date(value.date_to).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'date_from must be earlier than or equal to date_to.',
        path: ['date_from'],
      });
    }

    if (
      value.price_min !== undefined &&
      value.price_max !== undefined &&
      value.price_min > value.price_max
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'price_min must be less than or equal to price_max.',
        path: ['price_min'],
      });
    }
  })
  .openapi('ListEventsQuery');

export const publicCategoryEventsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
  })
  .openapi('PublicCategoryEventsQuery');

export const publicEventSlugParamSchema = z
  .object({
    slug: z.string().trim().min(1).openapi({ example: 'festival-musik-nusantara' }),
  })
  .openapi('PublicEventSlugParam');

export const publicCategorySlugParamSchema = z
  .object({
    slug: z.string().trim().min(1).openapi({ example: 'musik' }),
  })
  .openapi('PublicCategorySlugParam');

export const publicEventsPaginationMetaSchema = z
  .object({
    total: z.number().int().nonnegative().openapi({ example: 24 }),
    page: z.number().int().positive().openapi({ example: 1 }),
    limit: z.number().int().positive().openapi({ example: 20 }),
    totalPages: z.number().int().nonnegative().openapi({ example: 2 }),
  })
  .openapi('PublicEventsPaginationMeta');

export const publicEventCategorySchema = z
  .object({
    id: z.number().int().positive().openapi({ example: 1 }),
    name: z.string().openapi({ example: 'Musik' }),
    slug: z.string().openapi({ example: 'musik' }),
    icon: z.string().nullable().openapi({ example: 'music-2' }),
  })
  .openapi('PublicEventCategory');

export const publicCategorySchema = z
  .object({
    id: z.number().int().positive().openapi({ example: 1 }),
    name: z.string().openapi({ example: 'Musik' }),
    slug: z.string().openapi({ example: 'musik' }),
    icon: z.string().nullable().openapi({ example: 'music-2' }),
    event_count: z.number().int().nonnegative().openapi({ example: 12 }),
  })
  .openapi('PublicCategory');

export const publicEventListItemSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    slug: z.string().openapi({ example: 'festival-musik-nusantara' }),
    title: z.string().openapi({ example: 'Festival Musik Nusantara' }),
    description: z
      .string()
      .nullable()
      .openapi({ example: 'Festival musik lintas genre dengan artis nasional.' }),
    banner_url: z
      .string()
      .nullable()
      .openapi({ example: 'https://cdn.jeevatix.id/events/festival/banner.jpg' }),
    venue_name: z.string().openapi({ example: 'Istora Senayan' }),
    venue_city: z.string().openapi({ example: 'Jakarta' }),
    start_at: z.string().datetime().openapi({ example: '2026-06-14T19:00:00.000Z' }),
    end_at: z.string().datetime().openapi({ example: '2026-06-14T23:00:00.000Z' }),
    sale_start_at: z.string().datetime().openapi({ example: '2026-05-01T10:00:00.000Z' }),
    sale_end_at: z.string().datetime().openapi({ example: '2026-06-13T23:59:59.000Z' }),
    status: publicEventStatusSchema.openapi({ example: 'published' }),
    is_featured: z.boolean().openapi({ example: true }),
    max_tickets_per_order: z.number().int().positive().openapi({ example: 5 }),
    min_price: z.number().nonnegative().nullable().openapi({ example: 150000 }),
  })
  .openapi('PublicEventListItem');

export const publicEventImageSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'ca6f9e9f-a27b-41a6-bce3-fcd2d139c48d' }),
    image_url: z
      .string()
      .url()
      .openapi({ example: 'https://cdn.jeevatix.id/events/festival/gallery-1.jpg' }),
    sort_order: z.number().int().min(0).openapi({ example: 0 }),
    created_at: z.string().datetime().openapi({ example: '2026-03-31T09:00:00.000Z' }),
  })
  .openapi('PublicEventImage');

export const publicEventTierSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '9012ee69-d83a-44b2-9588-9622a736ab42' }),
    name: z.string().openapi({ example: 'VIP' }),
    description: z.string().nullable().openapi({ example: 'Akses area depan panggung.' }),
    price: z.number().nonnegative().openapi({ example: 350000 }),
    quota: z.number().int().min(0).openapi({ example: 100 }),
    sold_count: z.number().int().min(0).openapi({ example: 24 }),
    remaining: z.number().int().min(0).openapi({ example: 76 }),
    sort_order: z.number().int().min(0).openapi({ example: 0 }),
    status: ticketTierStatusSchema.openapi({ example: 'available' }),
    sale_start_at: z.string().datetime().nullable().openapi({ example: '2026-05-01T10:00:00.000Z' }),
    sale_end_at: z.string().datetime().nullable().openapi({ example: '2026-06-01T10:00:00.000Z' }),
  })
  .openapi('PublicEventTier');

export const publicEventSellerSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '5a197f34-d1df-4ec2-b0d4-2fd6a18ef61e' }),
    org_name: z.string().openapi({ example: 'EventPro Indonesia' }),
    org_description: z
      .string()
      .nullable()
      .openapi({ example: 'Penyelenggara event musik, festival, dan workshop.' }),
    logo_url: z
      .string()
      .nullable()
      .openapi({ example: 'https://cdn.jeevatix.id/sellers/eventpro-logo.png' }),
    is_verified: z.boolean().openapi({ example: true }),
  })
  .openapi('PublicEventSeller');

export const publicEventDetailSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
    seller_profile_id: z.string().uuid().openapi({ example: '5a197f34-d1df-4ec2-b0d4-2fd6a18ef61e' }),
    slug: z.string().openapi({ example: 'festival-musik-nusantara' }),
    title: z.string().openapi({ example: 'Festival Musik Nusantara' }),
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
    banner_url: z
      .string()
      .nullable()
      .openapi({ example: 'https://cdn.jeevatix.id/events/festival/banner.jpg' }),
    status: publicEventStatusSchema.openapi({ example: 'published' }),
    is_featured: z.boolean().openapi({ example: true }),
    max_tickets_per_order: z.number().int().positive().openapi({ example: 5 }),
    min_price: z.number().nonnegative().nullable().openapi({ example: 150000 }),
    categories: z.array(publicEventCategorySchema),
    images: z.array(publicEventImageSchema),
    tiers: z.array(publicEventTierSchema),
    seller: publicEventSellerSchema,
    created_at: z.string().datetime().openapi({ example: '2026-03-31T09:00:00.000Z' }),
    updated_at: z.string().datetime().openapi({ example: '2026-03-31T09:00:00.000Z' }),
  })
  .openapi('PublicEventDetail');

export const publicEventsListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(publicEventListItemSchema),
    meta: publicEventsPaginationMetaSchema,
  })
  .openapi('PublicEventsListResponse');

export const publicEventDetailResponseSchema = z
  .object({
    success: z.literal(true),
    data: publicEventDetailSchema,
  })
  .openapi('PublicEventDetailResponse');

export const publicCategoriesResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(publicCategorySchema),
  })
  .openapi('PublicCategoriesResponse');

export const publicEventErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: 'EVENT_NOT_FOUND' }),
      message: z.string().openapi({ example: 'Event not found.' }),
    }),
  })
  .openapi('PublicEventErrorResponse');

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
export type PublicCategoryEventsQuery = z.infer<typeof publicCategoryEventsQuerySchema>;
export type PublicEventSlugParam = z.infer<typeof publicEventSlugParamSchema>;
export type PublicCategorySlugParam = z.infer<typeof publicCategorySlugParamSchema>;
export type PublicEventsPaginationMeta = z.infer<typeof publicEventsPaginationMetaSchema>;
export type PublicCategory = z.infer<typeof publicCategorySchema>;
export type PublicEventListItem = z.infer<typeof publicEventListItemSchema>;
export type PublicEventDetail = z.infer<typeof publicEventDetailSchema>;