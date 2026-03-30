import { z } from '@hono/zod-openapi';

const userRoleSchema = z.enum(['buyer', 'seller', 'admin']);
const userStatusSchema = z.enum(['active', 'suspended', 'banned']);

export const registerSchema = z
  .object({
    email: z.string().email().openapi({ example: 'buyer@jeevatix.id' }),
    password: z.string().min(8).openapi({ example: 'Test123!' }),
    full_name: z.string().min(1).max(150).openapi({ example: 'Budi Santoso' }),
    phone: z.string().max(20).optional().openapi({ example: '081234567890' }),
  })
  .openapi('RegisterInput');

export const registerSellerSchema = registerSchema
  .extend({
    org_name: z.string().min(1).max(200).openapi({ example: 'EventPro Indonesia' }),
    org_description: z
      .string()
      .optional()
      .openapi({ example: 'Penyelenggara event musik dan workshop.' }),
  })
  .openapi('RegisterSellerInput');

export const loginSchema = z
  .object({
    email: z.string().email().openapi({ example: 'buyer@jeevatix.id' }),
    password: z.string().min(1).openapi({ example: 'Test123!' }),
  })
  .openapi('LoginInput');

export const refreshSchema = z
  .object({
    refresh_token: z
      .string()
      .min(1)
      .openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
  })
  .openapi('RefreshInput');

export const forgotPasswordSchema = z
  .object({
    email: z.string().email().openapi({ example: 'buyer@jeevatix.id' }),
  })
  .openapi('ForgotPasswordInput');

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1).openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
    password: z.string().min(8).openapi({ example: 'NewPassword123!' }),
  })
  .openapi('ResetPasswordInput');

export const verifyEmailSchema = z
  .object({
    token: z.string().min(1).openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
  })
  .openapi('VerifyEmailInput');

export const logoutSchema = z
  .object({
    refresh_token: z
      .string()
      .min(1)
      .openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
  })
  .openapi('LogoutInput');

export const authUserSchema = z
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
  .openapi('AuthUser');

export const authPayloadSchema = z
  .object({
    access_token: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
    refresh_token: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
    user: authUserSchema,
  })
  .openapi('AuthPayload');

export const authResponseSchema = z
  .object({
    success: z.literal(true),
    data: authPayloadSchema,
  })
  .openapi('AuthResponse');

export const messagePayloadSchema = z
  .object({
    message: z.string().openapi({ example: 'Operation completed successfully.' }),
  })
  .openapi('MessagePayload');

export const messageResponseSchema = z
  .object({
    success: z.literal(true),
    data: messagePayloadSchema,
  })
  .openapi('MessageResponse');

export const errorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: 'UNAUTHORIZED' }),
      message: z.string().openapi({ example: 'Invalid credentials.' }),
    }),
  })
  .openapi('ErrorResponse');

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterSellerInput = z.infer<typeof registerSellerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthPayload = z.infer<typeof authPayloadSchema>;
