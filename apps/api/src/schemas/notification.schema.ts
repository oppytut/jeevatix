import { z } from '@hono/zod-openapi';

const notificationTypeSchema = z.enum([
  'order_confirmed',
  'payment_reminder',
  'event_reminder',
  'new_order',
  'event_approved',
  'event_rejected',
  'info',
]);

const broadcastTargetRoleSchema = z.enum(['buyer', 'seller', 'all']);

export const notificationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
  })
  .openapi('NotificationListQuery');

export const notificationIdParamSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '2ddc0a56-1b8d-44f3-9c7d-216b95ec5c5e' }),
  })
  .openapi('NotificationIdParam');

export const notificationSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '2ddc0a56-1b8d-44f3-9c7d-216b95ec5c5e' }),
    type: notificationTypeSchema.openapi({ example: 'order_confirmed' }),
    title: z.string().openapi({ example: 'Pesanan dikonfirmasi' }),
    body: z.string().openapi({ example: 'Pembayaran order JVX-20260331-00001 telah diterima.' }),
    is_read: z.boolean().openapi({ example: false }),
    metadata: z.record(z.string(), z.unknown()).nullable().openapi({ example: null }),
    created_at: z.string().datetime().openapi({ example: '2026-03-31T10:00:00.000Z' }),
  })
  .openapi('Notification');

export const notificationListPayloadSchema = z
  .object({
    notifications: z.array(notificationSchema),
    unread_count: z.number().int().nonnegative().openapi({ example: 3 }),
  })
  .openapi('NotificationListPayload');

export const notificationPaginationMetaSchema = z
  .object({
    total: z.number().int().nonnegative().openapi({ example: 42 }),
    page: z.number().int().positive().openapi({ example: 1 }),
    limit: z.number().int().positive().openapi({ example: 20 }),
    totalPages: z.number().int().nonnegative().openapi({ example: 3 }),
  })
  .openapi('NotificationPaginationMeta');

export const notificationListResponseSchema = z
  .object({
    success: z.literal(true),
    data: notificationListPayloadSchema,
    meta: notificationPaginationMetaSchema,
  })
  .openapi('NotificationListResponse');

export const notificationResponseSchema = z
  .object({
    success: z.literal(true),
    data: notificationSchema,
  })
  .openapi('NotificationResponse');

export const notificationReadAllPayloadSchema = z
  .object({
    message: z.string().openapi({ example: 'All notifications marked as read.' }),
    unread_count: z.number().int().nonnegative().openapi({ example: 0 }),
  })
  .openapi('NotificationReadAllPayload');

export const notificationReadAllResponseSchema = z
  .object({
    success: z.literal(true),
    data: notificationReadAllPayloadSchema,
  })
  .openapi('NotificationReadAllResponse');

export const broadcastSchema = z
  .object({
    title: z.string().trim().min(1).max(255).openapi({ example: 'Pengumuman Sistem' }),
    body: z.string().trim().min(1).openapi({ example: 'Platform akan menjalani maintenance malam ini.' }),
    target_role: broadcastTargetRoleSchema.default('all').optional().openapi({ example: 'all' }),
  })
  .openapi('BroadcastNotificationInput');

export const broadcastNotificationPayloadSchema = z
  .object({
    message: z.string().openapi({ example: 'Broadcast notification sent successfully.' }),
    sent_count: z.number().int().nonnegative().openapi({ example: 120 }),
    target_role: broadcastTargetRoleSchema.openapi({ example: 'all' }),
  })
  .openapi('BroadcastNotificationPayload');

export const broadcastNotificationResponseSchema = z
  .object({
    success: z.literal(true),
    data: broadcastNotificationPayloadSchema,
  })
  .openapi('BroadcastNotificationResponse');

export const notificationErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: 'NOTIFICATION_NOT_FOUND' }),
      message: z.string().openapi({ example: 'Notification not found.' }),
    }),
  })
  .openapi('NotificationErrorResponse');

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type NotificationListPayload = z.infer<typeof notificationListPayloadSchema>;
export type NotificationPaginationMeta = z.infer<typeof notificationPaginationMetaSchema>;
export type BroadcastNotificationInput = z.infer<typeof broadcastSchema>;