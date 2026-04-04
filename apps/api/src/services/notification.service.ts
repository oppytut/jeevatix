import { getDb, schema } from '@jeevatix/core';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import type {
  BroadcastNotificationInput,
  Notification,
  NotificationListQuery,
  NotificationListPayload,
  NotificationPaginationMeta,
} from '../schemas/notification.schema';
import type { AdminNotificationItem, AdminNotificationListQuery } from '../schemas/admin.schema';

const { notifications, users } = schema;

type NotificationRow = typeof notifications.$inferSelect;

export class NotificationServiceError extends Error {
  constructor(
    public readonly code: 'DATABASE_UNAVAILABLE' | 'NOTIFICATION_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'NotificationServiceError';
  }
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new NotificationServiceError(
      'DATABASE_UNAVAILABLE',
      'Database connection is not available.',
    );
  }

  return db;
}

function toNotification(record: NotificationRow): Notification {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    body: record.body,
    is_read: record.isRead,
    metadata: (record.metadata as Record<string, unknown> | null | undefined) ?? null,
    created_at: record.createdAt.toISOString(),
  };
}

function toPaginationMeta(total: number, page: number, limit: number): NotificationPaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

async function countUnread(userId: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const [result] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return result?.count ?? 0;
}

async function countAll(userId: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const [result] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(eq(notifications.userId, userId));

  return result?.count ?? 0;
}

export const notificationService = {
  async sendNotification(
    userId: string,
    type: Notification['type'],
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
    databaseUrl?: string,
  ): Promise<Notification> {
    const database = getDatabase(databaseUrl);
    const [created] = await database
      .insert(notifications)
      .values({
        userId,
        type,
        title,
        body,
        metadata,
      })
      .returning();

    return toNotification(created);
  },

  async listForUser(
    userId: string,
    query: NotificationListQuery,
    databaseUrl?: string,
  ): Promise<{ data: NotificationListPayload; meta: NotificationPaginationMeta }> {
    const database = getDatabase(databaseUrl);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const [rows, unreadCount, total] = await Promise.all([
      database.query.notifications.findMany({
        where: eq(notifications.userId, userId),
        orderBy: [desc(notifications.createdAt)],
        limit,
        offset,
      }),
      countUnread(userId, databaseUrl),
      countAll(userId, databaseUrl),
    ]);

    return {
      data: {
        notifications: rows.map(toNotification),
        unread_count: unreadCount,
      },
      meta: toPaginationMeta(total, page, limit),
    };
  },

  async listAdmin(
    query: AdminNotificationListQuery,
    databaseUrl?: string,
  ): Promise<{
    data: { notifications: AdminNotificationItem[] };
    meta: NotificationPaginationMeta;
  }> {
    const database = getDatabase(databaseUrl);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const searchTerm = query.search ? `%${query.search}%` : undefined;
    const conditions = [
      query.type ? eq(notifications.type, query.type) : undefined,
      query.targetRole ? eq(users.role, query.targetRole) : undefined,
      searchTerm
        ? or(
            ilike(notifications.title, searchTerm),
            ilike(notifications.body, searchTerm),
            ilike(users.fullName, searchTerm),
            ilike(users.email, searchTerm),
          )
        : undefined,
    ].filter((condition) => condition !== undefined);
    const whereClause = and(...conditions);

    const [totalRow, rows] = await Promise.all([
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .innerJoin(users, eq(users.id, notifications.userId))
        .where(whereClause),
      database
        .select({
          id: notifications.id,
          type: notifications.type,
          title: notifications.title,
          body: notifications.body,
          isRead: notifications.isRead,
          metadata: notifications.metadata,
          createdAt: notifications.createdAt,
          userId: users.id,
          userFullName: users.fullName,
          userEmail: users.email,
          userRole: users.role,
        })
        .from(notifications)
        .innerJoin(users, eq(users.id, notifications.userId))
        .where(whereClause)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    return {
      data: {
        notifications: rows.map((row) => ({
          id: row.id,
          type: row.type,
          title: row.title,
          body: row.body,
          isRead: row.isRead,
          createdAt: row.createdAt.toISOString(),
          metadata: (row.metadata as Record<string, unknown> | null | undefined) ?? null,
          user: {
            id: row.userId,
            fullName: row.userFullName,
            email: row.userEmail,
            role: row.userRole,
          },
        })),
      },
      meta: toPaginationMeta(totalRow[0]?.count ?? 0, page, limit),
    };
  },

  async markAsRead(
    userId: string,
    notificationId: string,
    databaseUrl?: string,
  ): Promise<Notification> {
    const database = getDatabase(databaseUrl);
    const existing = await database.query.notifications.findFirst({
      where: and(eq(notifications.id, notificationId), eq(notifications.userId, userId)),
    });

    if (!existing) {
      throw new NotificationServiceError('NOTIFICATION_NOT_FOUND', 'Notification not found.');
    }

    if (existing.isRead) {
      return toNotification(existing);
    }

    const [updated] = await database
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();

    if (!updated) {
      throw new NotificationServiceError('NOTIFICATION_NOT_FOUND', 'Notification not found.');
    }

    return toNotification(updated);
  },

  async markAllAsRead(
    userId: string,
    databaseUrl?: string,
  ): Promise<{ message: string; unread_count: number }> {
    const database = getDatabase(databaseUrl);

    await database
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    return {
      message: 'All notifications marked as read.',
      unread_count: 0,
    };
  },

  async broadcast(
    input: BroadcastNotificationInput,
    databaseUrl?: string,
  ): Promise<{ message: string; sent_count: number; target_role: 'buyer' | 'seller' | 'all' }> {
    const database = getDatabase(databaseUrl);
    const targetRole = input.target_role ?? 'all';
    const recipients = await database.query.users.findMany({
      where:
        targetRole === 'all'
          ? eq(users.status, 'active')
          : and(eq(users.status, 'active'), eq(users.role, targetRole)),
      columns: {
        id: true,
      },
    });

    if (recipients.length === 0) {
      return {
        message: 'Broadcast notification sent successfully.',
        sent_count: 0,
        target_role: targetRole,
      };
    }

    await database.insert(notifications).values(
      recipients.map((recipient) => ({
        userId: recipient.id,
        type: 'info',
        title: input.title,
        body: input.body,
        metadata: {
          target_role: targetRole,
          broadcast: true,
        },
      })),
    );

    return {
      message: 'Broadcast notification sent successfully.',
      sent_count: recipients.length,
      target_role: targetRole,
    };
  },
};
