import { getDb, schema } from '@jeevatix/core';
import { and, countDistinct, desc, eq, ilike, or, sql } from 'drizzle-orm';

import type {
  AdminEventDetail,
  AdminEventListItem,
  AdminEventListQuery,
  UpdateAdminEventStatusInput,
} from '../schemas/admin.schema';
import { notificationService } from './notification.service';
import {
  getConvertedReservationCounts,
  getConvertedReservationCountsByEvent,
} from './reservation-counts';

const { eventImages, events, orderItems, orders, payments, sellerProfiles, ticketTiers, users } =
  schema;

export class AdminEventServiceError extends Error {
  constructor(
    public readonly code: 'DATABASE_UNAVAILABLE' | 'EVENT_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'AdminEventServiceError';
  }
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new AdminEventServiceError(
      'DATABASE_UNAVAILABLE',
      'Database connection is not available.',
    );
  }

  return db;
}

function toPaginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === 'number' ? value : Number(value);
}

function toEventListItem(row: {
  id: string;
  title: string;
  slug: string;
  status:
    | 'draft'
    | 'pending_review'
    | 'published'
    | 'rejected'
    | 'ongoing'
    | 'completed'
    | 'cancelled';
  venueCity: string;
  startAt: Date;
  endAt: Date;
  bannerUrl: string | null;
  sellerProfileId: string;
  sellerName: string;
  sellerUserId: string;
  sellerVerified: boolean;
  totalQuota: number | string | null;
  totalSold: number | string | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminEventListItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    venueCity: row.venueCity,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    bannerUrl: row.bannerUrl,
    sellerProfileId: row.sellerProfileId,
    sellerName: row.sellerName,
    sellerUserId: row.sellerUserId,
    sellerVerified: row.sellerVerified,
    totalQuota: toNumber(row.totalQuota),
    totalSold: toNumber(row.totalSold),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const adminEventService = {
  async listEvents(
    query: AdminEventListQuery,
    databaseUrl?: string,
  ): Promise<{ data: AdminEventListItem[]; meta: ReturnType<typeof toPaginationMeta> }> {
    const database = getDatabase(databaseUrl);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const searchTerm = query.search ? `%${query.search}%` : undefined;
    const conditions = [
      query.status ? eq(events.status, query.status) : undefined,
      query.seller_id ? eq(events.sellerProfileId, query.seller_id) : undefined,
      searchTerm
        ? or(
            ilike(events.title, searchTerm),
            ilike(sellerProfiles.orgName, searchTerm),
            ilike(users.fullName, searchTerm),
            ilike(users.email, searchTerm),
          )
        : undefined,
    ].filter((condition) => condition !== undefined);
    const whereClause = and(...conditions);

    const [totalRow] = await database
      .select({ total: countDistinct(events.id) })
      .from(events)
      .innerJoin(sellerProfiles, eq(sellerProfiles.id, events.sellerProfileId))
      .innerJoin(users, eq(users.id, sellerProfiles.userId))
      .where(whereClause);

    const rows = await database
      .select({
        id: events.id,
        title: events.title,
        slug: events.slug,
        status: events.status,
        venueCity: events.venueCity,
        startAt: events.startAt,
        endAt: events.endAt,
        bannerUrl: events.bannerUrl,
        sellerProfileId: sellerProfiles.id,
        sellerName: sellerProfiles.orgName,
        sellerUserId: sellerProfiles.userId,
        sellerVerified: sellerProfiles.isVerified,
        totalQuota: sql<number>`coalesce(sum(${ticketTiers.quota}), 0)::int`,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .innerJoin(sellerProfiles, eq(sellerProfiles.id, events.sellerProfileId))
      .innerJoin(users, eq(users.id, sellerProfiles.userId))
      .leftJoin(ticketTiers, eq(ticketTiers.eventId, events.id))
      .where(whereClause)
      .groupBy(
        events.id,
        events.title,
        events.slug,
        events.status,
        events.venueCity,
        events.startAt,
        events.endAt,
        events.bannerUrl,
        sellerProfiles.id,
        sellerProfiles.orgName,
        sellerProfiles.userId,
        sellerProfiles.isVerified,
        events.createdAt,
        events.updatedAt,
      )
      .orderBy(desc(events.createdAt))
      .limit(limit)
      .offset(offset);

    const convertedReservationCountsByEvent = await getConvertedReservationCountsByEvent(
      rows.map((row) => row.id),
      databaseUrl,
    );

    return {
      data: rows.map((row) =>
        toEventListItem({
          ...row,
          totalSold: convertedReservationCountsByEvent.get(row.id) ?? 0,
        }),
      ),
      meta: toPaginationMeta(totalRow?.total ?? 0, page, limit),
    };
  },

  async getEventDetail(id: string, databaseUrl?: string): Promise<AdminEventDetail> {
    const database = getDatabase(databaseUrl);
    const eventRecord = await database.query.events.findFirst({
      where: eq(events.id, id),
      with: {
        sellerProfile: {
          columns: {
            id: true,
            userId: true,
            orgName: true,
            orgDescription: true,
            logoUrl: true,
            isVerified: true,
          },
          with: {
            user: {
              columns: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        eventCategories: {
          with: {
            category: true,
          },
        },
        eventImages: {
          orderBy: [eventImages.sortOrder],
        },
        ticketTiers: {
          orderBy: [ticketTiers.sortOrder],
        },
      },
    });

    if (!eventRecord?.sellerProfile.user) {
      throw new AdminEventServiceError('EVENT_NOT_FOUND', 'Event not found.');
    }

    const [statsRow] = await database
      .select({
        orderCount: countDistinct(orders.id),
        confirmedOrderCount: sql<number>`count(distinct case when ${orders.status} = 'confirmed' then ${orders.id} end)::int`,
        ticketsSold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
        grossRevenue: sql<string>`coalesce(sum(case when ${orders.status} = 'confirmed' and ${payments.status} = 'success' then ${payments.amount} else 0 end), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(ticketTiers, eq(ticketTiers.id, orderItems.ticketTierId))
      .innerJoin(payments, eq(payments.orderId, orders.id))
      .where(eq(ticketTiers.eventId, id));

    const convertedReservationCounts = await getConvertedReservationCounts(
      eventRecord.ticketTiers.map((tier) => tier.id),
      databaseUrl,
    );

    return {
      id: eventRecord.id,
      sellerProfileId: eventRecord.sellerProfileId,
      title: eventRecord.title,
      slug: eventRecord.slug,
      description: eventRecord.description ?? null,
      venueName: eventRecord.venueName,
      venueAddress: eventRecord.venueAddress ?? null,
      venueCity: eventRecord.venueCity,
      venueLatitude: eventRecord.venueLatitude === null ? null : Number(eventRecord.venueLatitude),
      venueLongitude:
        eventRecord.venueLongitude === null ? null : Number(eventRecord.venueLongitude),
      startAt: eventRecord.startAt.toISOString(),
      endAt: eventRecord.endAt.toISOString(),
      saleStartAt: eventRecord.saleStartAt.toISOString(),
      saleEndAt: eventRecord.saleEndAt.toISOString(),
      bannerUrl: eventRecord.bannerUrl ?? null,
      status: eventRecord.status,
      maxTicketsPerOrder: eventRecord.maxTicketsPerOrder,
      isFeatured: eventRecord.isFeatured,
      createdAt: eventRecord.createdAt.toISOString(),
      updatedAt: eventRecord.updatedAt.toISOString(),
      seller: {
        id: eventRecord.sellerProfile.id,
        userId: eventRecord.sellerProfile.userId,
        orgName: eventRecord.sellerProfile.orgName,
        orgDescription: eventRecord.sellerProfile.orgDescription ?? null,
        logoUrl: eventRecord.sellerProfile.logoUrl ?? null,
        isVerified: eventRecord.sellerProfile.isVerified,
        fullName: eventRecord.sellerProfile.user.fullName,
        email: eventRecord.sellerProfile.user.email,
        phone: eventRecord.sellerProfile.user.phone ?? null,
      },
      categories: eventRecord.eventCategories.map(({ category }) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        icon: category.icon ?? null,
      })),
      images: eventRecord.eventImages.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        sortOrder: image.sortOrder,
        createdAt: image.createdAt.toISOString(),
      })),
      tiers: eventRecord.ticketTiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        description: tier.description ?? null,
        price: Number(tier.price),
        quota: tier.quota,
        soldCount: convertedReservationCounts.get(tier.id) ?? 0,
        sortOrder: tier.sortOrder,
        status: tier.status,
        saleStartAt: tier.saleStartAt?.toISOString() ?? null,
        saleEndAt: tier.saleEndAt?.toISOString() ?? null,
        createdAt: tier.createdAt.toISOString(),
        updatedAt: tier.updatedAt.toISOString(),
      })),
      stats: {
        orderCount: statsRow?.orderCount ?? 0,
        confirmedOrderCount: statsRow?.confirmedOrderCount ?? 0,
        ticketsSold: statsRow?.ticketsSold ?? 0,
        grossRevenue: toNumber(statsRow?.grossRevenue),
      },
    };
  },

  async updateEventStatus(
    id: string,
    input: UpdateAdminEventStatusInput,
    adminId: string,
    databaseUrl?: string,
  ) {
    const database = getDatabase(databaseUrl);
    const existing = await database.query.events.findFirst({
      where: eq(events.id, id),
      columns: {
        id: true,
        title: true,
        status: true,
      },
      with: {
        sellerProfile: {
          columns: {
            userId: true,
            orgName: true,
          },
        },
      },
    });

    if (!existing?.sellerProfile) {
      throw new AdminEventServiceError('EVENT_NOT_FOUND', 'Event not found.');
    }

    const [updated] = await database
      .update(events)
      .set({
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(events.id, id))
      .returning({
        id: events.id,
        status: events.status,
        updatedAt: events.updatedAt,
      });

    if (existing.sellerProfile.userId) {
      const notificationType =
        input.status === 'published'
          ? 'event_approved'
          : input.status === 'rejected'
            ? 'event_rejected'
            : 'info';
      const notificationTitle =
        input.status === 'published'
          ? 'Event disetujui'
          : input.status === 'rejected'
            ? 'Event perlu revisi'
            : 'Status event diperbarui';
      const notificationBody =
        input.status === 'published'
          ? `Event ${existing.title} telah dipublikasikan.`
          : input.status === 'rejected'
            ? `Event ${existing.title} ditandai sebagai rejected oleh admin.`
            : `Status event ${existing.title} diubah menjadi ${input.status}.`;

      await notificationService.sendNotification(
        existing.sellerProfile.userId,
        notificationType,
        notificationTitle,
        notificationBody,
        {
          admin_id: adminId,
          event_id: existing.id,
          event_title: existing.title,
          next_status: input.status,
        },
        databaseUrl,
      );
    }

    return {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    };
  },
};
