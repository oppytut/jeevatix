import { getDb, schema } from '@jeevatix/core';
import { and, desc, eq, sql } from 'drizzle-orm';

import type {
  Notification,
  NotificationListPayload,
} from '../schemas/notification.schema';

const { notifications } = schema;

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

async function countUnread(userId: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const [result] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

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

  async listForUser(userId: string, databaseUrl?: string): Promise<NotificationListPayload> {
    const database = getDatabase(databaseUrl);
    const [rows, unreadCount] = await Promise.all([
      database.query.notifications.findMany({
        where: eq(notifications.userId, userId),
        orderBy: [desc(notifications.createdAt)],
      }),
      countUnread(userId, databaseUrl),
    ]);

    return {
      notifications: rows.map(toNotification),
      unread_count: unreadCount,
    };
  },

  async markAsRead(userId: string, notificationId: string, databaseUrl?: string): Promise<Notification> {
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
};