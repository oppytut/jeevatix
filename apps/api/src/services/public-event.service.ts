import { getDb, schema } from '@jeevatix/core';
import { and, asc, eq, ilike, inArray, lte, gte, ne, or, sql } from 'drizzle-orm';

import type {
  ListEventsQuery,
  PublicCategory,
  PublicCategoryEventsQuery,
  PublicEventDetail,
  PublicEventListItem,
  PublicEventsPaginationMeta,
} from '../schemas/public-event.schema';
import { getActiveReservationCounts, getConvertedReservationCounts } from './reservation-counts';

const { categories, eventCategories, events, reservations, ticketTiers } = schema;

const PUBLIC_EVENT_STATUSES = ['published', 'ongoing'] as const;

type EventListRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  bannerUrl: string | null;
  venueName: string;
  venueCity: string;
  startAt: Date;
  endAt: Date;
  saleStartAt: Date;
  saleEndAt: Date;
  status: 'published' | 'ongoing';
  isFeatured: boolean;
  maxTicketsPerOrder: number;
  minPrice: string | null;
};

export class PublicEventServiceError extends Error {
  constructor(
    public readonly code: 'CATEGORY_NOT_FOUND' | 'DATABASE_UNAVAILABLE' | 'EVENT_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'PublicEventServiceError';
  }
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new PublicEventServiceError(
      'DATABASE_UNAVAILABLE',
      'Database connection is not available.',
    );
  }

  return db;
}

function numericToNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'number' ? value : Number(value);
}

function toInclusiveEndOfDay(value: string) {
  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

function toPaginationMeta(total: number, page: number, limit: number): PublicEventsPaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

function toEventListItem(row: EventListRow): PublicEventListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    banner_url: row.bannerUrl ?? null,
    venue_name: row.venueName,
    venue_city: row.venueCity,
    start_at: row.startAt.toISOString(),
    end_at: row.endAt.toISOString(),
    sale_start_at: row.saleStartAt.toISOString(),
    sale_end_at: row.saleEndAt.toISOString(),
    status: row.status,
    is_featured: row.isFeatured,
    max_tickets_per_order: row.maxTicketsPerOrder,
    min_price: numericToNumber(row.minPrice),
  };
}

function buildListConditions(query: ListEventsQuery) {
  const conditions = [inArray(events.status, PUBLIC_EVENT_STATUSES)];
  const locationQuery = query.location ?? query.city;

  if (query.search) {
    const searchTerm = `%${query.search.trim()}%`;
    conditions.push(or(ilike(events.title, searchTerm), ilike(events.description, searchTerm)));
  }

  if (locationQuery) {
    conditions.push(ilike(events.venueCity, `%${locationQuery.trim()}%`));
  }

  if (query.date_from) {
    conditions.push(gte(events.startAt, new Date(query.date_from)));
  }

  if (query.date_to) {
    conditions.push(lte(events.startAt, toInclusiveEndOfDay(query.date_to)));
  }

  if (query.category) {
    conditions.push(sql<boolean>`exists (
      select 1
      from ${eventCategories}
      inner join ${categories}
        on ${categories.id} = ${eventCategories.categoryId}
      where ${eventCategories.eventId} = ${events.id}
        and lower(${categories.slug}) = lower(${query.category.trim()})
    )`);
  }

  if (query.price_min !== undefined || query.price_max !== undefined) {
    const tierConditions = [eq(ticketTiers.eventId, events.id), ne(ticketTiers.status, 'hidden')];

    if (query.price_min !== undefined) {
      tierConditions.push(sql<boolean>`${ticketTiers.price} >= ${query.price_min.toString()}`);
    }

    if (query.price_max !== undefined) {
      tierConditions.push(sql<boolean>`${ticketTiers.price} <= ${query.price_max.toString()}`);
    }

    conditions.push(sql<boolean>`exists (
      select 1
      from ${ticketTiers}
      where ${and(...tierConditions)}
    )`);
  }

  return and(...conditions);
}

async function getPublicEventBySlug(slug: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const event = await database.query.events.findFirst({
    where: and(eq(events.slug, slug), inArray(events.status, PUBLIC_EVENT_STATUSES)),
    with: {
      sellerProfile: true,
      eventCategories: {
        with: {
          category: true,
        },
      },
      eventImages: true,
      ticketTiers: {
        where: ne(ticketTiers.status, 'hidden'),
        orderBy: [asc(ticketTiers.sortOrder), asc(ticketTiers.createdAt)],
      },
    },
  });

  if (!event) {
    throw new PublicEventServiceError('EVENT_NOT_FOUND', 'Event not found.');
  }

  return event;
}

async function ensureCategoryExists(slug: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const category = await database.query.categories.findFirst({
    where: eq(categories.slug, slug),
  });

  if (!category) {
    throw new PublicEventServiceError('CATEGORY_NOT_FOUND', 'Category not found.');
  }

  return category;
}

export const publicEventService = {
  async listEvents(
    query: ListEventsQuery,
    databaseUrl?: string,
  ): Promise<{ data: PublicEventListItem[]; meta: PublicEventsPaginationMeta }> {
    const database = getDatabase(databaseUrl);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const whereClause = buildListConditions(query);

    const [totalResult] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(whereClause);

    const rows = await database
      .select({
        id: events.id,
        slug: events.slug,
        title: events.title,
        description: events.description,
        bannerUrl: events.bannerUrl,
        venueName: events.venueName,
        venueCity: events.venueCity,
        startAt: events.startAt,
        endAt: events.endAt,
        saleStartAt: events.saleStartAt,
        saleEndAt: events.saleEndAt,
        status: events.status,
        isFeatured: events.isFeatured,
        maxTicketsPerOrder: events.maxTicketsPerOrder,
        minPrice: sql<string | null>`(
          select min(${ticketTiers.price})::text
          from ${ticketTiers}
          where ${ticketTiers.eventId} = ${events.id}
            and ${ticketTiers.status} <> 'hidden'
        )`,
      })
      .from(events)
      .where(whereClause)
      .orderBy(asc(events.startAt), asc(events.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows.map((row) => toEventListItem(row as EventListRow)),
      meta: toPaginationMeta(totalResult?.count ?? 0, page, limit),
    };
  },

  async listFeatured(databaseUrl?: string): Promise<PublicEventListItem[]> {
    const database = getDatabase(databaseUrl);
    const rows = await database
      .select({
        id: events.id,
        slug: events.slug,
        title: events.title,
        description: events.description,
        bannerUrl: events.bannerUrl,
        venueName: events.venueName,
        venueCity: events.venueCity,
        startAt: events.startAt,
        endAt: events.endAt,
        saleStartAt: events.saleStartAt,
        saleEndAt: events.saleEndAt,
        status: events.status,
        isFeatured: events.isFeatured,
        maxTicketsPerOrder: events.maxTicketsPerOrder,
        minPrice: sql<string | null>`(
          select min(${ticketTiers.price})::text
          from ${ticketTiers}
          where ${ticketTiers.eventId} = ${events.id}
            and ${ticketTiers.status} <> 'hidden'
        )`,
      })
      .from(events)
      .where(and(inArray(events.status, PUBLIC_EVENT_STATUSES), eq(events.isFeatured, true)))
      .orderBy(asc(events.startAt), asc(events.createdAt))
      .limit(10);

    return rows.map((row) => toEventListItem(row as EventListRow));
  },

  async getBySlug(slug: string, databaseUrl?: string): Promise<PublicEventDetail> {
    const event = await getPublicEventBySlug(slug, databaseUrl);
    const tierIds = event.ticketTiers.map((tier) => tier.id);
    const [activeReservationCounts, convertedReservationCounts] = await Promise.all([
      getActiveReservationCounts(tierIds, databaseUrl),
      getConvertedReservationCounts(tierIds, databaseUrl),
    ]);
    const minPrice = event.ticketTiers.reduce<number | null>((currentMin, tier) => {
      const price = Number(tier.price);

      if (currentMin === null || price < currentMin) {
        return price;
      }

      return currentMin;
    }, null);

    return {
      id: event.id,
      seller_profile_id: event.sellerProfileId,
      slug: event.slug,
      title: event.title,
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
      is_featured: event.isFeatured,
      max_tickets_per_order: event.maxTicketsPerOrder,
      min_price: minPrice,
      categories: event.eventCategories
        .map((item) => item.category)
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          icon: category.icon ?? null,
        })),
      images: event.eventImages
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((image) => ({
          id: image.id,
          image_url: image.imageUrl,
          sort_order: image.sortOrder,
          created_at: image.createdAt.toISOString(),
        })),
      tiers: event.ticketTiers.map((tier) => ({
        sold_count:
          (convertedReservationCounts.get(tier.id) ?? 0) +
          (activeReservationCounts.get(tier.id) ?? 0),
        id: tier.id,
        name: tier.name,
        description: tier.description ?? null,
        price: Number(tier.price),
        quota: tier.quota,
        remaining: Math.max(
          tier.quota - (convertedReservationCounts.get(tier.id) ?? 0) -
            (activeReservationCounts.get(tier.id) ?? 0),
          0,
        ),
        sort_order: tier.sortOrder,
        status: tier.status,
        sale_start_at: tier.saleStartAt?.toISOString() ?? null,
        sale_end_at: tier.saleEndAt?.toISOString() ?? null,
      })),
      seller: {
        id: event.sellerProfile.id,
        org_name: event.sellerProfile.orgName,
        org_description: event.sellerProfile.orgDescription ?? null,
        logo_url: event.sellerProfile.logoUrl ?? null,
        is_verified: event.sellerProfile.isVerified,
      },
      created_at: event.createdAt.toISOString(),
      updated_at: event.updatedAt.toISOString(),
    };
  },

  async listCategories(databaseUrl?: string): Promise<PublicCategory[]> {
    const database = getDatabase(databaseUrl);
    const rows = await database
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        icon: categories.icon,
        eventCount: sql<number>`count(distinct case when ${events.status} in ('published', 'ongoing') then ${events.id} end)::int`,
      })
      .from(categories)
      .leftJoin(eventCategories, eq(eventCategories.categoryId, categories.id))
      .leftJoin(events, eq(events.id, eventCategories.eventId))
      .groupBy(categories.id, categories.name, categories.slug, categories.icon)
      .orderBy(categories.name);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      icon: row.icon ?? null,
      event_count: row.eventCount,
    }));
  },

  async listByCategory(
    slug: string,
    pagination: PublicCategoryEventsQuery,
    databaseUrl?: string,
  ): Promise<{ data: PublicEventListItem[]; meta: PublicEventsPaginationMeta }> {
    await ensureCategoryExists(slug, databaseUrl);

    return this.listEvents(
      {
        category: slug,
        page: pagination.page,
        limit: pagination.limit,
      },
      databaseUrl,
    );
  },
};
