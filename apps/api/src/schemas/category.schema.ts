import { z } from '@hono/zod-openapi';

export const categoryIdParamSchema = z
  .object({
    id: z.coerce.number().int().positive().openapi({ example: 1 }),
  })
  .openapi('CategoryIdParam');

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100).openapi({ example: 'Musik' }),
    icon: z.string().max(50).optional().openapi({ example: 'music-2' }),
  })
  .openapi('CreateCategoryInput');

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional().openapi({ example: 'Konser Musik' }),
    icon: z.string().max(50).optional().openapi({ example: 'disc-3' }),
  })
  .openapi('UpdateCategoryInput');

export const categoryResponseSchema = z
  .object({
    id: z.number().int().positive().openapi({ example: 1 }),
    name: z.string().openapi({ example: 'Musik' }),
    slug: z.string().openapi({ example: 'musik' }),
    icon: z.string().nullable().openapi({ example: 'music-2' }),
    eventCount: z.number().int().nonnegative().optional().openapi({ example: 12 }),
  })
  .openapi('CategoryResponse');

export const categoryListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(categoryResponseSchema),
  })
  .openapi('CategoryListResponse');

export const categorySingleResponseSchema = z
  .object({
    success: z.literal(true),
    data: categoryResponseSchema,
  })
  .openapi('CategorySingleResponse');

export const categoryMessagePayloadSchema = z
  .object({
    message: z.string().openapi({ example: 'Category deleted successfully.' }),
  })
  .openapi('CategoryMessagePayload');

export const categoryMessageResponseSchema = z
  .object({
    success: z.literal(true),
    data: categoryMessagePayloadSchema,
  })
  .openapi('CategoryMessageResponse');

export const categoryErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: 'CATEGORY_ALREADY_EXISTS' }),
      message: z.string().openapi({ example: 'Category name already exists.' }),
    }),
  })
  .openapi('CategoryErrorResponse');

export type CategoryIdParam = z.infer<typeof categoryIdParamSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryResponse = z.infer<typeof categoryResponseSchema>;
export type CategoryMessagePayload = z.infer<typeof categoryMessagePayloadSchema>;
