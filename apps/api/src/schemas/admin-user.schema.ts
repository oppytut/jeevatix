import { z } from '@hono/zod-openapi';

const userRoleSchema = z.enum(['buyer', 'seller', 'admin']);
const userStatusSchema = z.enum(['active', 'suspended', 'banned']);

export const adminUserIdParamSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a' }),
  })
  .openapi('AdminUserIdParam');

export const adminSellerIdParamSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '5a197f34-d1df-4ec2-b0d4-2fd6a18ef61e' }),
  })
  .openapi('AdminSellerIdParam');

export const listUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    search: z.string().trim().min(1).optional().openapi({ example: 'budi' }),
    role: userRoleSchema.optional().openapi({ example: 'seller' }),
    status: userStatusSchema.optional().openapi({ example: 'active' }),
  })
  .openapi('ListAdminUsersQuery');

export const listSellersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    search: z.string().trim().min(1).optional().openapi({ example: 'eventpro' }),
    is_verified: z.enum(['true', 'false']).optional().openapi({ example: 'false' }),
  })
  .openapi('ListAdminSellersQuery');

export const updateUserStatusSchema = z
  .object({
    status: userStatusSchema.openapi({ example: 'suspended' }),
  })
  .openapi('UpdateAdminUserStatusInput');

export const verifySellerSchema = z
  .object({
    is_verified: z.boolean().openapi({ example: true }),
  })
  .openapi('VerifySellerInput');

export const paginationMetaSchema = z
  .object({
    total: z.number().int().nonnegative().openapi({ example: 42 }),
    page: z.number().int().positive().openapi({ example: 1 }),
    limit: z.number().int().positive().openapi({ example: 20 }),
    totalPages: z.number().int().nonnegative().openapi({ example: 3 }),
  })
  .openapi('PaginationMeta');

export const adminUserListItemSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a' }),
    email: z.string().email().openapi({ example: 'seller@jeevatix.id' }),
    fullName: z.string().openapi({ example: 'Budi Santoso' }),
    phone: z.string().nullable().openapi({ example: '081234567890' }),
    avatarUrl: z.string().nullable().openapi({ example: 'https://cdn.jeevatix.id/avatar.png' }),
    role: userRoleSchema.openapi({ example: 'seller' }),
    status: userStatusSchema.openapi({ example: 'active' }),
    emailVerifiedAt: z
      .string()
      .datetime()
      .nullable()
      .openapi({ example: '2026-03-30T10:00:00.000Z' }),
    sellerProfileId: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: '5a197f34-d1df-4ec2-b0d4-2fd6a18ef61e' }),
    sellerOrgName: z.string().nullable().openapi({ example: 'EventPro Indonesia' }),
    sellerVerified: z.boolean().nullable().openapi({ example: true }),
    createdAt: z.string().datetime().openapi({ example: '2026-03-30T10:00:00.000Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2026-03-30T10:00:00.000Z' }),
  })
  .openapi('AdminUserListItem');

export const adminSellerProfileSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '5a197f34-d1df-4ec2-b0d4-2fd6a18ef61e' }),
    orgName: z.string().openapi({ example: 'EventPro Indonesia' }),
    orgDescription: z
      .string()
      .nullable()
      .openapi({ example: 'Penyelenggara event musik dan workshop.' }),
    logoUrl: z.string().nullable().openapi({ example: 'https://cdn.jeevatix.id/logo.png' }),
    bankName: z.string().nullable().openapi({ example: 'Bank Central Asia' }),
    bankAccountNumber: z.string().nullable().openapi({ example: '1234567890' }),
    bankAccountHolder: z.string().nullable().openapi({ example: 'PT EventPro Indonesia' }),
    isVerified: z.boolean().openapi({ example: true }),
    verifiedAt: z.string().datetime().nullable().openapi({ example: '2026-03-30T10:00:00.000Z' }),
    verifiedBy: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: '7dc4978f-0d2f-4f6a-b8c0-99f9f52d3d64' }),
    eventCount: z.number().int().nonnegative().openapi({ example: 7 }),
    events: z
      .array(
        z
          .object({
            id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
            title: z.string().openapi({ example: 'Festival Musik Nusantara' }),
            slug: z.string().openapi({ example: 'festival-musik-nusantara' }),
            status: z
              .enum([
                'draft',
                'pending_review',
                'published',
                'rejected',
                'ongoing',
                'completed',
                'cancelled',
              ])
              .openapi({ example: 'published' }),
            venueCity: z.string().openapi({ example: 'Jakarta' }),
            startAt: z.string().datetime().openapi({ example: '2026-06-10T19:00:00.000Z' }),
          })
          .openapi('AdminSellerEventSummary'),
      )
      .openapi('AdminSellerEventSummaryList'),
    createdAt: z.string().datetime().openapi({ example: '2026-03-30T10:00:00.000Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2026-03-30T10:00:00.000Z' }),
  })
  .openapi('AdminSellerProfile');

export const adminUserDetailSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a' }),
    email: z.string().email().openapi({ example: 'seller@jeevatix.id' }),
    fullName: z.string().openapi({ example: 'Budi Santoso' }),
    phone: z.string().nullable().openapi({ example: '081234567890' }),
    avatarUrl: z.string().nullable().openapi({ example: 'https://cdn.jeevatix.id/avatar.png' }),
    role: userRoleSchema.openapi({ example: 'seller' }),
    status: userStatusSchema.openapi({ example: 'active' }),
    emailVerifiedAt: z
      .string()
      .datetime()
      .nullable()
      .openapi({ example: '2026-03-30T10:00:00.000Z' }),
    orderCount: z.number().int().nonnegative().openapi({ example: 12 }),
    ticketCount: z.number().int().nonnegative().openapi({ example: 28 }),
    sellerProfile: adminSellerProfileSchema.nullable(),
    createdAt: z.string().datetime().openapi({ example: '2026-03-30T10:00:00.000Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2026-03-30T10:00:00.000Z' }),
  })
  .openapi('AdminUserDetail');

export const adminSellerListItemSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '5a197f34-d1df-4ec2-b0d4-2fd6a18ef61e' }),
    userId: z.string().uuid().openapi({ example: '3e4666bf-d5e5-4aa7-b8ce-cefe41c7568a' }),
    email: z.string().email().openapi({ example: 'seller@jeevatix.id' }),
    fullName: z.string().openapi({ example: 'Budi Santoso' }),
    phone: z.string().nullable().openapi({ example: '081234567890' }),
    avatarUrl: z.string().nullable().openapi({ example: 'https://cdn.jeevatix.id/avatar.png' }),
    orgName: z.string().openapi({ example: 'EventPro Indonesia' }),
    isVerified: z.boolean().openapi({ example: true }),
    verifiedAt: z.string().datetime().nullable().openapi({ example: '2026-03-30T10:00:00.000Z' }),
    verifiedBy: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: '7dc4978f-0d2f-4f6a-b8c0-99f9f52d3d64' }),
    eventCount: z.number().int().nonnegative().openapi({ example: 7 }),
    createdAt: z.string().datetime().openapi({ example: '2026-03-30T10:00:00.000Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2026-03-30T10:00:00.000Z' }),
  })
  .openapi('AdminSellerListItem');

export const adminUsersListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(adminUserListItemSchema),
    meta: paginationMetaSchema,
  })
  .openapi('AdminUsersListResponse');

export const adminUserDetailResponseSchema = z
  .object({
    success: z.literal(true),
    data: adminUserDetailSchema,
  })
  .openapi('AdminUserDetailResponse');

export const adminUserStatusResponseSchema = z
  .object({
    success: z.literal(true),
    data: adminUserListItemSchema,
  })
  .openapi('AdminUserStatusResponse');

export const adminSellersListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(adminSellerListItemSchema),
    meta: paginationMetaSchema,
  })
  .openapi('AdminSellersListResponse');

export const adminSellerVerifyResponseSchema = z
  .object({
    success: z.literal(true),
    data: adminSellerListItemSchema,
  })
  .openapi('AdminSellerVerifyResponse');

export const adminUserErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: 'USER_NOT_FOUND' }),
      message: z.string().openapi({ example: 'User not found.' }),
    }),
  })
  .openapi('AdminUserErrorResponse');

export type AdminUserIdParam = z.infer<typeof adminUserIdParamSchema>;
export type AdminSellerIdParam = z.infer<typeof adminSellerIdParamSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ListSellersQuery = z.infer<typeof listSellersQuerySchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type VerifySellerInput = z.infer<typeof verifySellerSchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type AdminUserListItem = z.infer<typeof adminUserListItemSchema>;
export type AdminSellerProfile = z.infer<typeof adminSellerProfileSchema>;
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;
export type AdminSellerListItem = z.infer<typeof adminSellerListItemSchema>;
