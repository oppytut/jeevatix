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

const orderStatusSchema = z.enum(['pending', 'confirmed', 'expired', 'cancelled', 'refunded']);
const paymentStatusSchema = z.enum(['pending', 'success', 'failed', 'refunded']);
const paymentMethodSchema = z.enum([
  'bank_transfer',
  'e_wallet',
  'credit_card',
  'virtual_account',
]);
const reservationStatusSchema = z.enum(['active', 'converted', 'expired', 'cancelled']);
const ticketTierStatusSchema = z.enum(['available', 'sold_out', 'hidden']);
const ticketStatusSchema = z.enum(['valid', 'used', 'cancelled', 'refunded']);
const notificationTypeSchema = z.enum([
  'order_confirmed',
  'payment_reminder',
  'event_reminder',
  'new_order',
  'event_approved',
  'event_rejected',
  'info',
]);

export const adminPaginationMetaSchema = z
  .object({
    total: z.number().int().nonnegative().openapi({ example: 42 }),
    page: z.number().int().positive().openapi({ example: 1 }),
    limit: z.number().int().positive().openapi({ example: 20 }),
    totalPages: z.number().int().nonnegative().openapi({ example: 3 }),
  })
  .openapi('AdminPaginationMeta');

export const adminEventListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    status: eventStatusSchema.optional().openapi({ example: 'pending_review' }),
    seller_id: z.string().uuid().optional().openapi({ example: '8ca73e15-7be4-4e68-b45e-3678bb1908f2' }),
    search: z.string().trim().min(1).optional().openapi({ example: 'festival musik' }),
  })
  .openapi('AdminEventListQuery');

export const adminEventIdParamSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '27c3278a-6ed1-41ab-b522-39c4f24ebf4f' }),
  })
  .openapi('AdminEventIdParam');

export const updateAdminEventStatusSchema = z
  .object({
    status: eventStatusSchema.openapi({ example: 'published' }),
  })
  .openapi('UpdateAdminEventStatusInput');

export const adminEventListItemSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    status: eventStatusSchema,
    venueCity: z.string(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    bannerUrl: z.string().nullable(),
    sellerProfileId: z.string().uuid(),
    sellerName: z.string(),
    sellerUserId: z.string().uuid(),
    sellerVerified: z.boolean(),
    totalQuota: z.number().int().nonnegative(),
    totalSold: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('AdminEventListItem');

export const adminEventSellerSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    orgName: z.string(),
    orgDescription: z.string().nullable(),
    logoUrl: z.string().nullable(),
    isVerified: z.boolean(),
    fullName: z.string(),
    email: z.string().email(),
    phone: z.string().nullable(),
  })
  .openapi('AdminEventSeller');

export const adminEventCategorySchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    slug: z.string(),
    icon: z.string().nullable(),
  })
  .openapi('AdminEventCategory');

export const adminEventImageSchema = z
  .object({
    id: z.string().uuid(),
    imageUrl: z.string().url(),
    sortOrder: z.number().int().min(0),
    createdAt: z.string().datetime(),
  })
  .openapi('AdminEventImage');

export const adminEventTierSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    price: z.number().nonnegative(),
    quota: z.number().int().min(0),
    soldCount: z.number().int().min(0),
    sortOrder: z.number().int().min(0),
    status: ticketTierStatusSchema,
    saleStartAt: z.string().datetime().nullable(),
    saleEndAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('AdminEventTier');

export const adminEventStatsSchema = z
  .object({
    orderCount: z.number().int().nonnegative(),
    confirmedOrderCount: z.number().int().nonnegative(),
    ticketsSold: z.number().int().nonnegative(),
    grossRevenue: z.number().nonnegative(),
  })
  .openapi('AdminEventStats');

export const adminEventDetailSchema = z
  .object({
    id: z.string().uuid(),
    sellerProfileId: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    venueName: z.string(),
    venueAddress: z.string().nullable(),
    venueCity: z.string(),
    venueLatitude: z.number().nullable(),
    venueLongitude: z.number().nullable(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    saleStartAt: z.string().datetime(),
    saleEndAt: z.string().datetime(),
    bannerUrl: z.string().nullable(),
    status: eventStatusSchema,
    maxTicketsPerOrder: z.number().int().positive(),
    isFeatured: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    seller: adminEventSellerSchema,
    categories: z.array(adminEventCategorySchema),
    images: z.array(adminEventImageSchema),
    tiers: z.array(adminEventTierSchema),
    stats: adminEventStatsSchema,
  })
  .openapi('AdminEventDetail');

export const adminEventsListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(adminEventListItemSchema),
    meta: adminPaginationMetaSchema,
  })
  .openapi('AdminEventsListResponse');

export const adminEventDetailResponseSchema = z
  .object({
    success: z.literal(true),
    data: adminEventDetailSchema,
  })
  .openapi('AdminEventDetailResponse');

export const adminEventStatusPayloadSchema = z
  .object({
    id: z.string().uuid(),
    status: eventStatusSchema,
    updatedAt: z.string().datetime(),
  })
  .openapi('AdminEventStatusPayload');

export const adminEventStatusResponseSchema = z
  .object({
    success: z.literal(true),
    data: adminEventStatusPayloadSchema,
  })
  .openapi('AdminEventStatusResponse');

export const adminOrderListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: orderStatusSchema.optional(),
    paymentStatus: paymentStatusSchema.optional(),
    eventId: z.string().uuid().optional(),
    search: z.string().trim().min(1).optional(),
  })
  .openapi('AdminOrderListQuery');

export const adminOrderIdParamSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'f4fe78e2-4909-4fd4-bf51-f65077a355ea' }),
  })
  .openapi('AdminOrderIdParam');

export const adminOrderBuyerSchema = z
  .object({
    id: z.string().uuid(),
    fullName: z.string(),
    email: z.string().email(),
    phone: z.string().nullable(),
  })
  .openapi('AdminOrderBuyer');

export const adminOrderEventSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    venueCity: z.string(),
    startAt: z.string().datetime(),
  })
  .openapi('AdminOrderEvent');

export const adminOrderPaymentSchema = z
  .object({
    id: z.string().uuid(),
    method: paymentMethodSchema,
    status: paymentStatusSchema,
    amount: z.number().nonnegative(),
    externalRef: z.string().nullable(),
    paidAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('AdminOrderPayment');

export const adminOrderItemSchema = z
  .object({
    id: z.string().uuid(),
    ticketTierId: z.string().uuid(),
    tierName: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
    subtotal: z.number().nonnegative(),
  })
  .openapi('AdminOrderItem');

export const adminOrderTicketSchema = z
  .object({
    id: z.string().uuid(),
    ticketTierId: z.string().uuid(),
    ticketTierName: z.string(),
    ticketCode: z.string(),
    status: ticketStatusSchema,
    issuedAt: z.string().datetime(),
    checkedInAt: z.string().datetime().nullable(),
  })
  .openapi('AdminOrderTicket');

export const adminOrderListItemSchema = z
  .object({
    id: z.string().uuid(),
    orderNumber: z.string(),
    status: orderStatusSchema,
    totalAmount: z.number().nonnegative(),
    serviceFee: z.number().nonnegative(),
    createdAt: z.string().datetime(),
    confirmedAt: z.string().datetime().nullable(),
    expiresAt: z.string().datetime(),
    paymentStatus: paymentStatusSchema,
    paymentMethod: paymentMethodSchema,
    buyer: adminOrderBuyerSchema,
    event: adminOrderEventSchema,
  })
  .openapi('AdminOrderListItem');

export const adminOrderDetailSchema = z
  .object({
    id: z.string().uuid(),
    reservationId: z.string().uuid().nullable(),
    orderNumber: z.string(),
    status: orderStatusSchema,
    totalAmount: z.number().nonnegative(),
    serviceFee: z.number().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    confirmedAt: z.string().datetime().nullable(),
    expiresAt: z.string().datetime(),
    buyer: adminOrderBuyerSchema,
    event: adminOrderEventSchema,
    payment: adminOrderPaymentSchema,
    items: z.array(adminOrderItemSchema),
    tickets: z.array(adminOrderTicketSchema),
  })
  .openapi('AdminOrderDetail');

export const adminOrdersListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(adminOrderListItemSchema),
    meta: adminPaginationMetaSchema,
  })
  .openapi('AdminOrdersListResponse');

export const adminOrderDetailResponseSchema = z
  .object({
    success: z.literal(true),
    data: adminOrderDetailSchema,
  })
  .openapi('AdminOrderDetailResponse');

export const adminOrderActionPayloadSchema = z
  .object({
    id: z.string().uuid(),
    status: orderStatusSchema,
    paymentStatus: paymentStatusSchema,
    updatedAt: z.string().datetime(),
  })
  .openapi('AdminOrderActionPayload');

export const adminOrderActionResponseSchema = z
  .object({
    success: z.literal(true),
    data: adminOrderActionPayloadSchema,
  })
  .openapi('AdminOrderActionResponse');

export const adminPaymentListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: paymentStatusSchema.optional(),
    method: paymentMethodSchema.optional(),
    search: z.string().trim().min(1).optional(),
  })
  .openapi('AdminPaymentListQuery');

export const adminPaymentIdParamSchema = z
  .object({
    id: z.string().uuid().openapi({ example: 'fb16c03d-c050-4ec9-bc36-e756bc7a12b5' }),
  })
  .openapi('AdminPaymentIdParam');

export const updateAdminPaymentStatusSchema = z
  .object({
    status: paymentStatusSchema.openapi({ example: 'success' }),
  })
  .openapi('UpdateAdminPaymentStatusInput');

export const adminPaymentListItemSchema = z
  .object({
    id: z.string().uuid(),
    orderId: z.string().uuid(),
    orderNumber: z.string(),
    status: paymentStatusSchema,
    method: paymentMethodSchema,
    amount: z.number().nonnegative(),
    externalRef: z.string().nullable(),
    paidAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    orderStatus: orderStatusSchema,
    buyer: adminOrderBuyerSchema,
    event: adminOrderEventSchema,
  })
  .openapi('AdminPaymentListItem');

export const adminPaymentDetailSchema = z
  .object({
    id: z.string().uuid(),
    orderId: z.string().uuid(),
    orderNumber: z.string(),
    status: paymentStatusSchema,
    method: paymentMethodSchema,
    amount: z.number().nonnegative(),
    externalRef: z.string().nullable(),
    paidAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    orderStatus: orderStatusSchema,
    buyer: adminOrderBuyerSchema,
    event: adminOrderEventSchema,
    items: z.array(adminOrderItemSchema),
    tickets: z.array(adminOrderTicketSchema),
  })
  .openapi('AdminPaymentDetail');

export const adminPaymentsListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(adminPaymentListItemSchema),
    meta: adminPaginationMetaSchema,
  })
  .openapi('AdminPaymentsListResponse');

export const adminPaymentDetailResponseSchema = z
  .object({
    success: z.literal(true),
    data: adminPaymentDetailSchema,
  })
  .openapi('AdminPaymentDetailResponse');

export const adminPaymentStatusPayloadSchema = z
  .object({
    id: z.string().uuid(),
    status: paymentStatusSchema,
    orderStatus: orderStatusSchema,
    paidAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime(),
  })
  .openapi('AdminPaymentStatusPayload');

export const adminPaymentStatusResponseSchema = z
  .object({
    success: z.literal(true),
    data: adminPaymentStatusPayloadSchema,
  })
  .openapi('AdminPaymentStatusResponse');

export const adminReservationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: reservationStatusSchema.optional(),
    eventId: z.string().uuid().optional(),
    search: z.string().trim().min(1).optional(),
  })
  .openapi('AdminReservationListQuery');

export const adminReservationItemSchema = z
  .object({
    id: z.string().uuid(),
    status: reservationStatusSchema,
    quantity: z.number().int().positive(),
    expiresAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    remainingSeconds: z.number().int().nonnegative(),
    buyer: adminOrderBuyerSchema,
    event: adminOrderEventSchema,
    ticketTier: z.object({
      id: z.string().uuid(),
      name: z.string(),
      status: ticketTierStatusSchema,
    }),
  })
  .openapi('AdminReservationItem');

export const adminReservationsListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(adminReservationItemSchema),
    meta: adminPaginationMetaSchema,
  })
  .openapi('AdminReservationsListResponse');

export const adminNotificationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: notificationTypeSchema.optional(),
    targetRole: z.enum(['buyer', 'seller', 'admin']).optional(),
    search: z.string().trim().min(1).optional(),
  })
  .openapi('AdminNotificationListQuery');

export const adminNotificationItemSchema = z
  .object({
    id: z.string().uuid(),
    type: notificationTypeSchema,
    title: z.string(),
    body: z.string(),
    isRead: z.boolean(),
    createdAt: z.string().datetime(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    user: z.object({
      id: z.string().uuid(),
      fullName: z.string(),
      email: z.string().email(),
      role: z.enum(['buyer', 'seller', 'admin']),
    }),
  })
  .openapi('AdminNotificationItem');

export const adminNotificationsListPayloadSchema = z
  .object({
    notifications: z.array(adminNotificationItemSchema),
  })
  .openapi('AdminNotificationsListPayload');

export const adminNotificationsListResponseSchema = z
  .object({
    success: z.literal(true),
    data: adminNotificationsListPayloadSchema,
    meta: adminPaginationMetaSchema,
  })
  .openapi('AdminNotificationsListResponse');

export type AdminEventListQuery = z.infer<typeof adminEventListQuerySchema>;
export type UpdateAdminEventStatusInput = z.infer<typeof updateAdminEventStatusSchema>;
export type AdminEventListItem = z.infer<typeof adminEventListItemSchema>;
export type AdminEventDetail = z.infer<typeof adminEventDetailSchema>;
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;
export type AdminOrderListItem = z.infer<typeof adminOrderListItemSchema>;
export type AdminOrderDetail = z.infer<typeof adminOrderDetailSchema>;
export type AdminPaymentListQuery = z.infer<typeof adminPaymentListQuerySchema>;
export type UpdateAdminPaymentStatusInput = z.infer<typeof updateAdminPaymentStatusSchema>;
export type AdminPaymentListItem = z.infer<typeof adminPaymentListItemSchema>;
export type AdminPaymentDetail = z.infer<typeof adminPaymentDetailSchema>;
export type AdminReservationListQuery = z.infer<typeof adminReservationListQuerySchema>;
export type AdminReservationItem = z.infer<typeof adminReservationItemSchema>;
export type AdminNotificationListQuery = z.infer<typeof adminNotificationListQuerySchema>;
export type AdminNotificationItem = z.infer<typeof adminNotificationItemSchema>;
