import { getDb, schema } from '@jeevatix/core';
import { and, countDistinct, desc, eq, sql } from 'drizzle-orm';

import type {
  CreateEventInput,
  SellerEventDetail,
  SellerEventListItem,
  SellerEventsPaginationMeta,
  SellerEventsQuery,
  UpdateEventInput,
} from '../schemas/event.schema';
import {
  getConvertedReservationCounts,
  getConvertedReservationCountsByEvent,
} from './reservation-counts';

const { categories, eventCategories, eventImages, events, ticketTiers } = schema;

type EventRow = typeof events.$inferSelect;
type EventImageRow = typeof eventImages.$inferSelect;
type TicketTierRow = typeof ticketTiers.$inferSelect;

export class EventServiceError extends Error {
  constructor(
    public readonly code:
      | 'CATEGORY_NOT_FOUND'
      | 'DATABASE_UNAVAILABLE'
      | 'EVENT_NOT_FOUND'
      | 'FORBIDDEN'
      | 'INVALID_EVENT_STATE',
    message: string,
  ) {
    super(message);
    this.name = 'EventServiceError';
  }
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new EventServiceError('DATABASE_UNAVAILABLE', 'Database connection is not available.');
  }

  return db;
}

function slugifyEventTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function toPaginationMeta(total: number, page: number, limit: number): SellerEventsPaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

function numericToNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'number' ? value : Number(value);
}

function toEventListItem(
  event: EventRow,
  totals: {
    totalQuota: number;
    totalSold: number;
  },
): SellerEventListItem {
  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    venue_city: event.venueCity,
    start_at: event.startAt.toISOString(),
    end_at: event.endAt.toISOString(),
    sale_start_at: event.saleStartAt.toISOString(),
    sale_end_at: event.saleEndAt.toISOString(),
    banner_url: event.bannerUrl ?? null,
    status: event.status,
    max_tickets_per_order: event.maxTicketsPerOrder,
    total_quota: totals.totalQuota,
    total_sold: totals.totalSold,
    created_at: event.createdAt.toISOString(),
    updated_at: event.updatedAt.toISOString(),
  };
}

function toEventDetail(
  event: EventRow,
  data: {
    categoryRows: Array<{
      id: number;
      name: string;
      slug: string;
      icon: string | null;
    }>;
    imageRows: EventImageRow[];
    tierRows: TicketTierRow[];
    convertedReservationCounts: Map<string, number>;
  },
): SellerEventDetail {
  const totalQuota = data.tierRows.reduce((sum, tier) => sum + tier.quota, 0);
  const totalSold = data.tierRows.reduce(
    (sum, tier) => sum + (data.convertedReservationCounts.get(tier.id) ?? 0),
    0,
  );

  return {
    id: event.id,
    seller_profile_id: event.sellerProfileId,
    title: event.title,
    slug: event.slug,
    description: event.description ?? null,
    venue_name: event.venueName,
    venue_address: event.venueAddress ?? null,
    venue_city: event.venueCity,
    venue_latitude: numericToNumber(event.venueLatitude),
    venue_longitude: numericToNumber(event.venueLongitude),
    start_at: event.startAt.toISOString(),
    end_at: event.endAt.toISOString(),
    sale_start_at: event.saleStartAt.toISOString(),
    sale_end_at: event.saleEndAt.toISOString(),
    banner_url: event.bannerUrl ?? null,
    status: event.status,
    max_tickets_per_order: event.maxTicketsPerOrder,
    total_quota: totalQuota,
    total_sold: totalSold,
    categories: data.categoryRows.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
    })),
    images: data.imageRows
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((image) => ({
        id: image.id,
        image_url: image.imageUrl,
        sort_order: image.sortOrder,
        created_at: image.createdAt.toISOString(),
      })),
    tiers: data.tierRows
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((tier) => ({
        id: tier.id,
        name: tier.name,
        description: tier.description ?? null,
        price: Number(tier.price),
        quota: tier.quota,
        sold_count: data.convertedReservationCounts.get(tier.id) ?? 0,
        sort_order: tier.sortOrder,
        status: tier.status,
        sale_start_at: tier.saleStartAt?.toISOString() ?? null,
        sale_end_at: tier.saleEndAt?.toISOString() ?? null,
        created_at: tier.createdAt.toISOString(),
        updated_at: tier.updatedAt.toISOString(),
      })),
    created_at: event.createdAt.toISOString(),
    updated_at: event.updatedAt.toISOString(),
  };
}

async function generateUniqueEventSlug(title: string, excludeId?: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const baseSlug = slugifyEventTitle(title) || 'event';
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existingEvent = await database.query.events.findFirst({
      where: excludeId
        ? and(eq(events.slug, candidate), sql<boolean>`${events.id} <> ${excludeId}`)
        : eq(events.slug, candidate),
      columns: { id: true },
    });

    if (!existingEvent) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function ensureCategoriesExist(categoryIds: number[], databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const uniqueCategoryIds = Array.from(new Set(categoryIds));
  const existingCategories = await database.query.categories.findMany({
    where: sql<boolean>`${categories.id} in ${uniqueCategoryIds}`,
    columns: { id: true },
  });

  if (existingCategories.length !== uniqueCategoryIds.length) {
    throw new EventServiceError('CATEGORY_NOT_FOUND', 'One or more categories were not found.');
  }

  return uniqueCategoryIds;
}

async function getOwnedEventRecord(sellerProfileId: string, eventId: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const event = await database.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) {
    throw new EventServiceError('EVENT_NOT_FOUND', 'Event not found.');
  }

  if (event.sellerProfileId !== sellerProfileId) {
    throw new EventServiceError('FORBIDDEN', 'You do not have access to this event.');
  }

  return event;
}

async function getEventDetailPayload(
  sellerProfileId: string,
  eventId: string,
  databaseUrl?: string,
) {
  const database = getDatabase(databaseUrl);
  const event = await getOwnedEventRecord(sellerProfileId, eventId, databaseUrl);

  const [categoryRows, imageRows, tierRows] = await Promise.all([
    database
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        icon: categories.icon,
      })
      .from(eventCategories)
      .innerJoin(categories, eq(categories.id, eventCategories.categoryId))
      .where(eq(eventCategories.eventId, event.id)),
    database.query.eventImages.findMany({
      where: eq(eventImages.eventId, event.id),
      orderBy: [eventImages.sortOrder],
    }),
    database.query.ticketTiers.findMany({
      where: eq(ticketTiers.eventId, event.id),
      orderBy: [ticketTiers.sortOrder],
    }),
  ]);

  const convertedReservationCounts = await getConvertedReservationCounts(
    tierRows.map((tier) => tier.id),
    databaseUrl,
  );

  return toEventDetail(event, { categoryRows, imageRows, tierRows, convertedReservationCounts });
}

function toCreateEventValues(
  sellerProfileId: string,
  input: CreateEventInput | UpdateEventInput,
  slug: string,
) {
  return {
    sellerProfileId,
    title: input.title?.trim() ?? '',
    slug,
    description: input.description?.trim() || null,
    venueName: input.venue_name?.trim() ?? '',
    venueAddress: input.venue_address?.trim() || null,
    venueCity: input.venue_city?.trim() ?? '',
    venueLatitude: input.venue_latitude?.toString(),
    venueLongitude: input.venue_longitude?.toString(),
    startAt: new Date(input.start_at as string),
    endAt: new Date(input.end_at as string),
    saleStartAt: new Date(input.sale_start_at as string),
    saleEndAt: new Date(input.sale_end_at as string),
    bannerUrl: input.banner_url ?? null,
    maxTicketsPerOrder: input.max_tickets_per_order ?? 5,
  };
}

export const eventService = {
  async listSellerEvents(
    sellerProfileId: string,
    filters: SellerEventsQuery,
    databaseUrl?: string,
  ): Promise<{ data: SellerEventListItem[]; meta: SellerEventsPaginationMeta }> {
    const database = getDatabase(databaseUrl);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;
    const conditions = [
      eq(events.sellerProfileId, sellerProfileId),
      filters.status ? eq(events.status, filters.status) : undefined,
    ].filter((condition) => condition !== undefined);
    const whereClause = and(...conditions);

    const [totalRow] = await database
      .select({ total: countDistinct(events.id) })
      .from(events)
      .where(whereClause);

    const rows = await database
      .select({
        event: events,
        totalQuota: sql<number>`coalesce(sum(${ticketTiers.quota}), 0)::int`,
      })
      .from(events)
      .leftJoin(ticketTiers, eq(ticketTiers.eventId, events.id))
      .where(whereClause)
      .groupBy(events.id)
      .orderBy(desc(events.createdAt))
      .limit(limit)
      .offset(offset);

    const convertedReservationCountsByEvent = await getConvertedReservationCountsByEvent(
      rows.map((row) => row.event.id),
      databaseUrl,
    );

    return {
      data: rows.map((row) =>
        toEventListItem(row.event, {
          totalQuota: row.totalQuota,
          totalSold: convertedReservationCountsByEvent.get(row.event.id) ?? 0,
        }),
      ),
      meta: toPaginationMeta(totalRow?.total ?? 0, page, limit),
    };
  },

  async createEvent(
    sellerProfileId: string,
    input: CreateEventInput,
    databaseUrl?: string,
  ): Promise<SellerEventDetail> {
    const database = getDatabase(databaseUrl);
    const categoryIds = await ensureCategoriesExist(input.category_ids, databaseUrl);
    const slug = await generateUniqueEventSlug(input.title, undefined, databaseUrl);

    const eventId = await database.transaction(async (tx) => {
      const [createdEvent] = await tx
        .insert(events)
        .values({
          ...toCreateEventValues(sellerProfileId, input, slug),
          status: 'draft',
        })
        .returning({ id: events.id });

      await tx.insert(eventCategories).values(
        categoryIds.map((categoryId) => ({
          eventId: createdEvent.id,
          categoryId,
        })),
      );

      if (input.images.length > 0) {
        await tx.insert(eventImages).values(
          input.images.map((image) => ({
            eventId: createdEvent.id,
            imageUrl: image.image_url,
            sortOrder: image.sort_order,
          })),
        );
      }

      await tx.insert(ticketTiers).values(
        input.tiers.map((tier) => ({
          eventId: createdEvent.id,
          name: tier.name.trim(),
          description: tier.description?.trim() || null,
          price: tier.price.toString(),
          quota: tier.quota,
          sortOrder: tier.sort_order,
          saleStartAt: tier.sale_start_at ? new Date(tier.sale_start_at) : null,
          saleEndAt: tier.sale_end_at ? new Date(tier.sale_end_at) : null,
        })),
      );

      return createdEvent.id;
    });

    return getEventDetailPayload(sellerProfileId, eventId, databaseUrl);
  },

  async getSellerEvent(
    sellerProfileId: string,
    eventId: string,
    databaseUrl?: string,
  ): Promise<SellerEventDetail> {
    return getEventDetailPayload(sellerProfileId, eventId, databaseUrl);
  },

  async updateEvent(
    sellerProfileId: string,
    eventId: string,
    input: UpdateEventInput,
    databaseUrl?: string,
  ): Promise<SellerEventDetail> {
    const database = getDatabase(databaseUrl);
    const existingEvent = await getOwnedEventRecord(sellerProfileId, eventId, databaseUrl);
    const nextTitle = input.title?.trim() ?? existingEvent.title;
    const nextSlug =
      input.title !== undefined
        ? await generateUniqueEventSlug(nextTitle, existingEvent.id, databaseUrl)
        : existingEvent.slug;

    if (input.category_ids !== undefined) {
      await ensureCategoriesExist(input.category_ids, databaseUrl);
    }

    const existingTiers = await database.query.ticketTiers.findMany({
      where: eq(ticketTiers.eventId, existingEvent.id),
    });
    const convertedReservationCounts = await getConvertedReservationCounts(
      existingTiers.map((tier) => tier.id),
      databaseUrl,
    );

    if (
      input.tiers !== undefined &&
      existingTiers.some((tier) => (convertedReservationCounts.get(tier.id) ?? 0) > 0)
    ) {
      throw new EventServiceError(
        'INVALID_EVENT_STATE',
        'Ticket tiers cannot be replaced after tickets have been sold.',
      );
    }

    await database.transaction(async (tx) => {
      const values: Partial<typeof events.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.title !== undefined) {
        values.title = nextTitle;
        values.slug = nextSlug;
      }

      if (input.description !== undefined) {
        values.description = input.description?.trim() || null;
      }

      if (input.venue_name !== undefined) {
        values.venueName = input.venue_name.trim();
      }

      if (input.venue_address !== undefined) {
        values.venueAddress = input.venue_address?.trim() || null;
      }

      if (input.venue_city !== undefined) {
        values.venueCity = input.venue_city.trim();
      }

      if (input.venue_latitude !== undefined) {
        values.venueLatitude = input.venue_latitude.toString();
      }

      if (input.venue_longitude !== undefined) {
        values.venueLongitude = input.venue_longitude.toString();
      }

      if (input.start_at !== undefined) {
        values.startAt = new Date(input.start_at);
      }

      if (input.end_at !== undefined) {
        values.endAt = new Date(input.end_at);
      }

      if (input.sale_start_at !== undefined) {
        values.saleStartAt = new Date(input.sale_start_at);
      }

      if (input.sale_end_at !== undefined) {
        values.saleEndAt = new Date(input.sale_end_at);
      }

      if (input.banner_url !== undefined) {
        values.bannerUrl = input.banner_url ?? null;
      }

      if (input.max_tickets_per_order !== undefined) {
        values.maxTicketsPerOrder = input.max_tickets_per_order;
      }

      await tx.update(events).set(values).where(eq(events.id, existingEvent.id));

      if (input.category_ids !== undefined) {
        const categoryIds = Array.from(new Set(input.category_ids));
        await tx.delete(eventCategories).where(eq(eventCategories.eventId, existingEvent.id));
        await tx.insert(eventCategories).values(
          categoryIds.map((categoryId) => ({
            eventId: existingEvent.id,
            categoryId,
          })),
        );
      }

      if (input.images !== undefined) {
        await tx.delete(eventImages).where(eq(eventImages.eventId, existingEvent.id));

        if (input.images.length > 0) {
          await tx.insert(eventImages).values(
            input.images.map((image) => ({
              eventId: existingEvent.id,
              imageUrl: image.image_url,
              sortOrder: image.sort_order,
            })),
          );
        }
      }

      if (input.tiers !== undefined) {
        await tx.delete(ticketTiers).where(eq(ticketTiers.eventId, existingEvent.id));

        if (input.tiers.length > 0) {
          await tx.insert(ticketTiers).values(
            input.tiers.map((tier) => ({
              eventId: existingEvent.id,
              name: tier.name.trim(),
              description: tier.description?.trim() || null,
              price: tier.price.toString(),
              quota: tier.quota,
              sortOrder: tier.sort_order,
              saleStartAt: tier.sale_start_at ? new Date(tier.sale_start_at) : null,
              saleEndAt: tier.sale_end_at ? new Date(tier.sale_end_at) : null,
            })),
          );
        }
      }
    });

    return getEventDetailPayload(sellerProfileId, eventId, databaseUrl);
  },

  async submitEvent(
    sellerProfileId: string,
    eventId: string,
    databaseUrl?: string,
  ): Promise<SellerEventDetail> {
    const database = getDatabase(databaseUrl);
    const existingEvent = await getOwnedEventRecord(sellerProfileId, eventId, databaseUrl);

    if (existingEvent.status !== 'draft' && existingEvent.status !== 'rejected') {
      throw new EventServiceError(
        'INVALID_EVENT_STATE',
        'Only draft or rejected events can be submitted for review.',
      );
    }

    await database
      .update(events)
      .set({
        status: 'pending_review',
        updatedAt: new Date(),
      })
      .where(eq(events.id, existingEvent.id));

    return getEventDetailPayload(sellerProfileId, eventId, databaseUrl);
  },

  async deleteEvent(sellerProfileId: string, eventId: string, databaseUrl?: string) {
    const database = getDatabase(databaseUrl);
    const event = await getOwnedEventRecord(sellerProfileId, eventId, databaseUrl);

    if (event.status !== 'draft') {
      throw new EventServiceError('INVALID_EVENT_STATE', 'Only draft events can be deleted.');
    }

    await database.transaction(async (tx) => {
      await tx.delete(eventCategories).where(eq(eventCategories.eventId, event.id));
      await tx.delete(eventImages).where(eq(eventImages.eventId, event.id));
      await tx.delete(ticketTiers).where(eq(ticketTiers.eventId, event.id));

      const [deletedEvent] = await tx
        .delete(events)
        .where(eq(events.id, event.id))
        .returning({ id: events.id });

      if (!deletedEvent) {
        throw new EventServiceError('EVENT_NOT_FOUND', 'Event not found.');
      }
    });

    return {
      message: 'Event deleted successfully.',
    };
  },
};
