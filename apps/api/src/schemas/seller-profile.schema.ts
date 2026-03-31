import { z } from '@hono/zod-openapi';

export const updateSellerProfileSchema = z
  .object({
    org_name: z.string().min(1).max(200).optional().openapi({ example: 'EventPro Indonesia' }),
    org_description: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: 'Penyelenggara event musik, festival, dan workshop.' }),
    logo_url: z
      .union([z.string().url(), z.null()])
      .optional()
      .openapi({ example: 'https://cdn.jeevatix.id/sellers/eventpro-logo.png' }),
    bank_name: z.string().max(100).nullable().optional().openapi({ example: 'Bank Central Asia' }),
    bank_account_number: z.string().max(50).nullable().optional().openapi({ example: '1234567890' }),
    bank_account_holder: z.string().max(150).nullable().optional().openapi({ example: 'PT EventPro Indonesia' }),
  })
  .openapi('UpdateSellerProfileInput');

export const sellerProfileSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a' }),
    user_id: z.string().uuid().openapi({ example: '2dbf65b3-8a8c-4eb3-a1f2-4b8c4f8d4dc5' }),
    email: z.string().email().openapi({ example: 'seller@jeevatix.id' }),
    full_name: z.string().openapi({ example: 'Rizky Pratama' }),
    phone: z.string().nullable().openapi({ example: '081234567890' }),
    avatar_url: z
      .string()
      .nullable()
      .openapi({ example: 'https://cdn.jeevatix.id/avatar/seller.png' }),
    org_name: z.string().openapi({ example: 'EventPro Indonesia' }),
    org_description: z
      .string()
      .nullable()
      .openapi({ example: 'Penyelenggara event musik, festival, dan workshop.' }),
    logo_url: z
      .string()
      .nullable()
      .openapi({ example: 'https://cdn.jeevatix.id/sellers/eventpro-logo.png' }),
    bank_name: z.string().nullable().openapi({ example: 'Bank Central Asia' }),
    bank_account_number: z.string().nullable().openapi({ example: '1234567890' }),
    bank_account_holder: z.string().nullable().openapi({ example: 'PT EventPro Indonesia' }),
    is_verified: z.boolean().openapi({ example: true }),
    verified_at: z
      .string()
      .datetime()
      .nullable()
      .openapi({ example: '2026-03-30T10:00:00.000Z' }),
    created_at: z.string().datetime().openapi({ example: '2026-03-30T10:00:00.000Z' }),
    updated_at: z.string().datetime().openapi({ example: '2026-03-30T10:00:00.000Z' }),
  })
  .openapi('SellerProfile');

export const sellerProfileResponseSchema = z
  .object({
    success: z.literal(true),
    data: sellerProfileSchema,
  })
  .openapi('SellerProfileResponse');

export const sellerProfileErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: 'SELLER_PROFILE_NOT_FOUND' }),
      message: z.string().openapi({ example: 'Seller profile not found.' }),
    }),
  })
  .openapi('SellerProfileErrorResponse');

export type UpdateSellerProfileInput = z.infer<typeof updateSellerProfileSchema>;
export type SellerProfile = z.infer<typeof sellerProfileSchema>;