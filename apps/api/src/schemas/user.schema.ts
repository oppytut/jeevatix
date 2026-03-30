import { z } from '@hono/zod-openapi';

const userRoleSchema = z.enum(['buyer', 'seller', 'admin']);
const userStatusSchema = z.enum(['active', 'suspended', 'banned']);

export const updateProfileSchema = z
  .object({
    full_name: z.string().min(1).max(150).optional().openapi({ example: 'Budi Santoso' }),
    phone: z.string().max(20).optional().openapi({ example: '081234567890' }),
    avatar_url: z
      .string()
      .url()
      .optional()
      .openapi({ example: 'https://cdn.jeevatix.id/avatar.png' }),
  })
  .openapi('UpdateProfileInput');

export const changePasswordSchema = z
  .object({
    old_password: z.string().min(1).openapi({ example: 'CurrentPassword123!' }),
    new_password: z.string().min(8).openapi({ example: 'NewPassword123!' }),
  })
  .openapi('ChangePasswordInput');

export const userProfileSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a' }),
    email: z.string().email().openapi({ example: 'buyer@jeevatix.id' }),
    full_name: z.string().openapi({ example: 'Budi Santoso' }),
    phone: z.string().nullable().openapi({ example: '081234567890' }),
    avatar_url: z.string().nullable().openapi({ example: 'https://cdn.jeevatix.id/avatar.png' }),
    role: userRoleSchema.openapi({ example: 'buyer' }),
    status: userStatusSchema.openapi({ example: 'active' }),
    email_verified_at: z
      .string()
      .datetime()
      .nullable()
      .openapi({ example: '2026-03-30T10:00:00.000Z' }),
    created_at: z.string().datetime().openapi({ example: '2026-03-30T10:00:00.000Z' }),
    updated_at: z.string().datetime().openapi({ example: '2026-03-30T10:00:00.000Z' }),
  })
  .openapi('UserProfile');

export const userProfileResponseSchema = z
  .object({
    success: z.literal(true),
    data: userProfileSchema,
  })
  .openapi('UserProfileResponse');

export const userMessagePayloadSchema = z
  .object({
    message: z.string().openapi({ example: 'Password changed successfully.' }),
  })
  .openapi('UserMessagePayload');

export const userMessageResponseSchema = z
  .object({
    success: z.literal(true),
    data: userMessagePayloadSchema,
  })
  .openapi('UserMessageResponse');

export const userErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: 'USER_NOT_FOUND' }),
      message: z.string().openapi({ example: 'User not found.' }),
    }),
  })
  .openapi('UserErrorResponse');

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserMessagePayload = z.infer<typeof userMessagePayloadSchema>;
