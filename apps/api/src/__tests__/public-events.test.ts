import { getDb, schema } from '@jeevatix/core';
import { inArray, like, or } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { hashPassword } from '../lib/password';

const globalScope = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const processEnv = (globalScope.process ??= { env: {} }).env ?? {};

processEnv.DATABASE_URL ??= 'postgresql://jeevatix:jeevatix@localhost:5432/jeevatix';
processEnv.JWT_SECRET ??= 'vitest-phase-5-secret';

const databaseUrl = processEnv.DATABASE_URL;
const jwtSecret = processEnv.JWT_SECRET;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for public event tests.');
}

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required for public event tests.');
}

const database = getDb(databaseUrl);

if (!database) {
  throw new Error('Failed to create database connection for public event tests.');
}

const {
  categories,
  eventCategories,
  eventImages,
  events,
  notifications,
  sellerProfiles,
  ticketTiers,
  users,
} = schema;

const TEST_EMAIL_PREFIX = 'vitest-p5-public-events-';
const TEST_CATEGORY_NAME_PREFIX = 'Vitest Phase 5 Category';
const TEST_CATEGORY_SLUG_PREFIX = 'vitest-phase-5-category';
const TEST_EVENT_TITLE_PREFIX = 'Vitest Phase 5 Event';
const TEST_EVENT_SLUG_PREFIX = 'vitest-phase-5-event';

type EventStatus = 'draft' | 'pending_review' | 'published' | 'ongoing';

type JsonSuccess<T> = {
  success: true;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type JsonFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function createCategoryName(label: string) {
  return `${TEST_CATEGORY_NAME_PREFIX} ${label} ${crypto.randomUUID()}`;
}

function createEventTitle(label: string) {
  return `${TEST_EVENT_TITLE_PREFIX} ${label} ${crypto.randomUUID()}`;
}

async function requestJson(path: string) {
  return app.request(
    path,
    {
      method: 'GET',
      headers: new Headers({
        Accept: 'application/json',
      }),
    },
    {
      JWT_SECRET: jwtSecret,
      DATABASE_URL: databaseUrl,
    },
  );
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

async function createSellerFixture() {
  const [user] = await database
    .insert(users)
    .values({
      email: `${TEST_EMAIL_PREFIX}${crypto.randomUUID()}@example.com`,
      passwordHash: await hashPassword('TestPass123!'),
      fullName: 'Vitest Phase 5 Seller',
      phone: '081234567890',
      role: 'seller',
      status: 'active',
      emailVerifiedAt: new Date(),
    })
    .returning();

  const [sellerProfile] = await database
    .insert(sellerProfiles)
    .values({
      userId: user.id,
      orgName: `Vitest Phase 5 Organizer ${crypto.randomUUID()}`,
      orgDescription: 'Organizer fixture untuk pengujian public event API.',
      logoUrl: 'https://example.com/logo.png',
      bankName: 'Bank Test',
      bankAccountNumber: '1234567890',
      bankAccountHolder: 'Vitest Phase 5',
      isVerified: true,
      verifiedAt: new Date(),
      verifiedBy: null,
    })
    .returning();

  return { user, sellerProfile };
}

async function createCategoryFixture(label: string) {
  const name = createCategoryName(label);
  const [category] = await database
    .insert(categories)
    .values({
      name,
      slug: slugify(name),
      icon: 'ticket',
    })
    .returning();

  return category;
}

async function createEventFixture(input: {
  sellerProfileId: string;
  categoryId: number;
  titleLabel: string;
  description: string;
  city: string;
  status: EventStatus;
  isFeatured?: boolean;
  startAt?: Date;
  endAt?: Date;
  saleStartAt?: Date;
  saleEndAt?: Date;
  regularPrice?: number;
  vipPrice?: number;
  hiddenPrice?: number;
}) {
  const title = createEventTitle(input.titleLabel);
  const slug = `${TEST_EVENT_SLUG_PREFIX}-${slugify(input.titleLabel)}-${crypto.randomUUID()}`;
  const startAt = input.startAt ?? new Date('2031-08-15T19:00:00.000Z');
  const endAt = input.endAt ?? new Date(startAt.getTime() + 3 * 60 * 60 * 1000);
  const saleStartAt = input.saleStartAt ?? new Date(startAt.getTime() - 45 * 24 * 60 * 60 * 1000);
  const saleEndAt = input.saleEndAt ?? new Date(startAt.getTime() - 24 * 60 * 60 * 1000);

  const [event] = await database
    .insert(events)
    .values({
      sellerProfileId: input.sellerProfileId,
      title,
      slug,
      description: input.description,
      venueName: 'Vitest Public Hall',
      venueAddress: 'Jl. Vitest Publik No. 5',
      venueCity: input.city,
      venueLatitude: '106.8000000',
      venueLongitude: '-6.2000000',
      startAt,
      endAt,
      saleStartAt,
      saleEndAt,
      bannerUrl: 'https://example.com/public-banner.png',
      status: input.status,
      maxTicketsPerOrder: 5,
      isFeatured: input.isFeatured ?? false,
    })
    .returning();

  await database.insert(eventCategories).values({
    eventId: event.id,
    categoryId: input.categoryId,
  });

  await database.insert(eventImages).values([
    {
      eventId: event.id,
      imageUrl: 'https://example.com/public-gallery-1.png',
      sortOrder: 0,
    },
    {
      eventId: event.id,
      imageUrl: 'https://example.com/public-gallery-2.png',
      sortOrder: 1,
    },
  ]);

  await database.insert(ticketTiers).values([
    {
      eventId: event.id,
      name: 'Regular',
      description: 'Akses reguler untuk public event test.',
      price: String(input.regularPrice ?? 125000),
      quota: 120,
      soldCount: 20,
      sortOrder: 0,
      status: 'available',
      saleStartAt,
      saleEndAt,
    },
    {
      eventId: event.id,
      name: 'VIP',
      description: 'Akses VIP untuk public event test.',
      price: String(input.vipPrice ?? 250000),
      quota: 40,
      soldCount: 10,
      sortOrder: 1,
      status: 'available',
      saleStartAt,
      saleEndAt,
    },
    {
      eventId: event.id,
      name: 'Hidden',
      description: 'Tier ini tidak boleh tampil di public.',
      price: String(input.hiddenPrice ?? 500000),
      quota: 10,
      soldCount: 0,
      sortOrder: 2,
      status: 'hidden',
      saleStartAt,
      saleEndAt,
    },
  ]);

  return event;
}

async function cleanupTestData() {
  const testUsers = await database
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `${TEST_EMAIL_PREFIX}%`));

  if (testUsers.length > 0) {
    const userIds = testUsers.map((user) => user.id);
    const testSellerProfiles = await database
      .select({ id: sellerProfiles.id })
      .from(sellerProfiles)
      .where(inArray(sellerProfiles.userId, userIds));

    if (testSellerProfiles.length > 0) {
      const sellerProfileIds = testSellerProfiles.map((item) => item.id);
      const testEvents = await database
        .select({ id: events.id })
        .from(events)
        .where(inArray(events.sellerProfileId, sellerProfileIds));

      if (testEvents.length > 0) {
        const eventIds = testEvents.map((event) => event.id);
        await database.delete(ticketTiers).where(inArray(ticketTiers.eventId, eventIds));
        await database.delete(eventImages).where(inArray(eventImages.eventId, eventIds));
        await database.delete(eventCategories).where(inArray(eventCategories.eventId, eventIds));
        await database.delete(events).where(inArray(events.id, eventIds));
      }

      await database.delete(sellerProfiles).where(inArray(sellerProfiles.id, sellerProfileIds));
    }

    await database.delete(notifications).where(inArray(notifications.userId, userIds));
    await database.delete(users).where(inArray(users.id, userIds));
  }

  const testCategories = await database
    .select({ id: categories.id })
    .from(categories)
    .where(
      or(
        like(categories.name, `${TEST_CATEGORY_NAME_PREFIX}%`),
        like(categories.slug, `${TEST_CATEGORY_SLUG_PREFIX}%`),
      ),
    );

  if (testCategories.length > 0) {
    await database.delete(categories).where(
      inArray(
        categories.id,
        testCategories.map((category) => category.id),
      ),
    );
  }
}

describe.sequential('Phase 5 Public Event API', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('returns a paginated list of public published and ongoing events', async () => {
    const { sellerProfile } = await createSellerFixture();
    const musicCategory = await createCategoryFixture('Music');

    const publishedEvent = await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: musicCategory.id,
      titleLabel: 'Published List',
      description: 'Event publik untuk list published.',
      city: 'Jakarta',
      status: 'published',
      isFeatured: true,
    });
    const ongoingEvent = await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: musicCategory.id,
      titleLabel: 'Ongoing List',
      description: 'Event publik untuk list ongoing.',
      city: 'Bandung',
      status: 'ongoing',
    });
    await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: musicCategory.id,
      titleLabel: 'Draft Hidden',
      description: 'Event draft tidak boleh tampil.',
      city: 'Surabaya',
      status: 'draft',
    });
    await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: musicCategory.id,
      titleLabel: 'Pending Hidden',
      description: 'Event pending tidak boleh tampil.',
      city: 'Yogyakarta',
      status: 'pending_review',
    });

    const response = await requestJson('/events?page=1&limit=20');
    const payload = await readJson<
      JsonSuccess<Array<{ id: string; slug: string; status: 'published' | 'ongoing' }>>
    >(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.meta).toBeDefined();
    expect(payload.meta?.page).toBe(1);
    expect(payload.meta?.limit).toBe(20);
    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: publishedEvent.id, status: 'published' }),
        expect.objectContaining({ id: ongoingEvent.id, status: 'ongoing' }),
      ]),
    );
    expect(payload.data.some((event) => !['published', 'ongoing'].includes(event.status))).toBe(
      false,
    );
  });

  it('filters events by keyword in title or description', async () => {
    const { sellerProfile } = await createSellerFixture();
    const workshopCategory = await createCategoryFixture('Workshop');
    const descriptionKeyword = `deep-dive-${crypto.randomUUID()}`;

    const matchingEvent = await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: workshopCategory.id,
      titleLabel: 'Search Match',
      description: `Workshop intensif dengan materi ${descriptionKeyword}.`,
      city: 'Jakarta',
      status: 'published',
    });
    await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: workshopCategory.id,
      titleLabel: 'Search Miss',
      description: 'Workshop tanpa keyword yang dicari.',
      city: 'Jakarta',
      status: 'published',
    });

    const response = await requestJson(`/events?search=${descriptionKeyword}`);
    const payload = await readJson<JsonSuccess<Array<{ id: string }>>>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: matchingEvent.id })]),
    );
    expect(payload.data).toHaveLength(1);
  });

  it('filters events by category slug', async () => {
    const { sellerProfile } = await createSellerFixture();
    const musicCategory = await createCategoryFixture('Music Filter');
    const sportsCategory = await createCategoryFixture('Sports Filter');

    const musicEvent = await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: musicCategory.id,
      titleLabel: 'Music Category',
      description: 'Masuk kategori musik.',
      city: 'Jakarta',
      status: 'published',
    });
    await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: sportsCategory.id,
      titleLabel: 'Sports Category',
      description: 'Masuk kategori olahraga.',
      city: 'Jakarta',
      status: 'published',
    });

    const response = await requestJson(`/events?category=${musicCategory.slug}`);
    const payload = await readJson<JsonSuccess<Array<{ id: string }>>>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([
      expect.objectContaining({ id: musicEvent.id }),
    ]);
  });

  it('filters events by location alias mapped to city', async () => {
    const { sellerProfile } = await createSellerFixture();
    const festivalCategory = await createCategoryFixture('Festival Filter');

    const bandungEvent = await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: festivalCategory.id,
      titleLabel: 'Bandung Location',
      description: 'Event untuk filter lokasi Bandung.',
      city: 'Bandung',
      status: 'published',
    });
    await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: festivalCategory.id,
      titleLabel: 'Jakarta Location',
      description: 'Event untuk filter lokasi Jakarta.',
      city: 'Jakarta',
      status: 'published',
    });

    const response = await requestJson('/events?location=Bandung');
    const payload = await readJson<JsonSuccess<Array<{ id: string; venue_city: string }>>>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([
      expect.objectContaining({ id: bandungEvent.id, venue_city: 'Bandung' }),
    ]);
  });

  it('treats date_to as inclusive through the end of the selected day', async () => {
    const { sellerProfile } = await createSellerFixture();
    const category = await createCategoryFixture('Inclusive Date');
    const keyword = `inclusive-date-${crypto.randomUUID()}`;

    const sameDayEvent = await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: category.id,
      titleLabel: keyword,
      description: `Event dengan keyword ${keyword} pada hari yang sama.`,
      city: 'Jakarta',
      status: 'published',
      startAt: new Date('2031-08-15T19:00:00.000Z'),
    });
    await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: category.id,
      titleLabel: `${keyword}-next-day`,
      description: `Event keyword ${keyword} pada hari berikutnya.`,
      city: 'Jakarta',
      status: 'published',
      startAt: new Date('2031-08-16T09:00:00.000Z'),
    });

    const response = await requestJson(`/events?search=${keyword}&date_to=2031-08-15`);
    const payload = await readJson<JsonSuccess<Array<{ id: string }>>>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([
      expect.objectContaining({ id: sameDayEvent.id }),
    ]);
  });

  it('filters events by price range', async () => {
    const { sellerProfile } = await createSellerFixture();
    const category = await createCategoryFixture('Price Range');
    const keyword = `price-range-${crypto.randomUUID()}`;

    await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: category.id,
      titleLabel: `${keyword}-budget`,
      description: `Event budget ${keyword}.`,
      city: 'Bandung',
      status: 'published',
      regularPrice: 100000,
      vipPrice: 150000,
    });
    const matchingEvent = await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: category.id,
      titleLabel: `${keyword}-premium`,
      description: `Event premium ${keyword}.`,
      city: 'Bandung',
      status: 'published',
      regularPrice: 300000,
      vipPrice: 350000,
    });

    const response = await requestJson(
      `/events?search=${keyword}&price_min=200000&price_max=320000`,
    );
    const payload = await readJson<JsonSuccess<Array<{ id: string }>>>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([
      expect.objectContaining({ id: matchingEvent.id }),
    ]);
  });

  it('returns distinct slices across pagination pages', async () => {
    const { sellerProfile } = await createSellerFixture();
    const category = await createCategoryFixture('Pagination Slice');
    const keyword = `pagination-slice-${crypto.randomUUID()}`;

    await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: category.id,
      titleLabel: `${keyword}-one`,
      description: `Event pertama ${keyword}.`,
      city: 'Surabaya',
      status: 'published',
      startAt: new Date('2031-08-15T09:00:00.000Z'),
    });
    const secondEvent = await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: category.id,
      titleLabel: `${keyword}-two`,
      description: `Event kedua ${keyword}.`,
      city: 'Surabaya',
      status: 'published',
      startAt: new Date('2031-08-16T09:00:00.000Z'),
    });
    const thirdEvent = await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: category.id,
      titleLabel: `${keyword}-three`,
      description: `Event ketiga ${keyword}.`,
      city: 'Surabaya',
      status: 'published',
      startAt: new Date('2031-08-17T09:00:00.000Z'),
    });

    const firstPageResponse = await requestJson(`/events?search=${keyword}&page=1&limit=1`);
    const secondPageResponse = await requestJson(`/events?search=${keyword}&page=2&limit=1`);
    const firstPagePayload = await readJson<JsonSuccess<Array<{ id: string }>>>(firstPageResponse);
    const secondPagePayload = await readJson<JsonSuccess<Array<{ id: string }>>>(secondPageResponse);

    expect(firstPageResponse.status).toBe(200);
    expect(secondPageResponse.status).toBe(200);
    expect(firstPagePayload.success).toBe(true);
    expect(secondPagePayload.success).toBe(true);
    expect(firstPagePayload.meta).toMatchObject({ total: 3, page: 1, limit: 1, totalPages: 3 });
    expect(secondPagePayload.meta).toMatchObject({ total: 3, page: 2, limit: 1, totalPages: 3 });
    expect(firstPagePayload.data[0]?.id).not.toBe(secondPagePayload.data[0]?.id);
    expect([secondEvent.id, thirdEvent.id]).toContain(secondPagePayload.data[0]?.id);
  });

  it('returns only published or ongoing events in public listing', async () => {
    const { sellerProfile } = await createSellerFixture();
    const category = await createCategoryFixture('Visibility');

    await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: category.id,
      titleLabel: 'Published Visible',
      description: 'Event published.',
      city: 'Jakarta',
      status: 'published',
    });
    await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: category.id,
      titleLabel: 'Ongoing Visible',
      description: 'Event ongoing.',
      city: 'Jakarta',
      status: 'ongoing',
    });
    const draftEvent = await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: category.id,
      titleLabel: 'Draft Invisible',
      description: 'Event draft.',
      city: 'Jakarta',
      status: 'draft',
    });
    const pendingEvent = await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: category.id,
      titleLabel: 'Pending Invisible',
      description: 'Event pending review.',
      city: 'Jakarta',
      status: 'pending_review',
    });

    const response = await requestJson('/events');
    const payload = await readJson<JsonSuccess<Array<{ id: string }>>>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.some((event) => event.id === draftEvent.id)).toBe(false);
    expect(payload.data.some((event) => event.id === pendingEvent.id)).toBe(false);
  });

  it('returns public event detail with visible tiers and images', async () => {
    const { sellerProfile } = await createSellerFixture();
    const category = await createCategoryFixture('Detail');
    const event = await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: category.id,
      titleLabel: 'Detail Page',
      description: 'Event detail fixture untuk Phase 5.',
      city: 'Semarang',
      status: 'published',
      isFeatured: true,
    });

    const response = await requestJson(`/events/${event.slug}`);
    const payload = await readJson<
      JsonSuccess<{
        id: string;
        slug: string;
        images: Array<{ image_url: string }>;
        tiers: Array<{ name: string; status: string }>;
        seller: { org_name: string; is_verified: boolean };
      }>
    >(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe(event.id);
    expect(payload.data.slug).toBe(event.slug);
    expect(payload.data.images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ image_url: 'https://example.com/public-gallery-1.png' }),
        expect.objectContaining({ image_url: 'https://example.com/public-gallery-2.png' }),
      ]),
    );
    expect(payload.data.tiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Regular', status: 'available' }),
        expect.objectContaining({ name: 'VIP', status: 'available' }),
      ]),
    );
    expect(payload.data.tiers.some((tier) => tier.name === 'Hidden')).toBe(false);
    expect(payload.data.seller.org_name).toContain('Vitest Phase 5 Organizer');
    expect(payload.data.seller.is_verified).toBe(true);
  });

  it('returns 404 for a non-existent public event slug', async () => {
    const response = await requestJson(`/events/${crypto.randomUUID()}`);
    const payload = await readJson<JsonFailure>(response);

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('EVENT_NOT_FOUND');
  });

  it('returns public events for a category slug', async () => {
    const { sellerProfile } = await createSellerFixture();
    const category = await createCategoryFixture('Category Listing');
    const matchingEvent = await createEventFixture({
      sellerProfileId: sellerProfile.id,
      categoryId: category.id,
      titleLabel: 'Category Listing Match',
      description: 'Event untuk list category.',
      city: 'Malang',
      status: 'published',
    });

    const response = await requestJson(`/categories/${category.slug}/events?page=1&limit=20`);
    const payload = await readJson<JsonSuccess<Array<{ id: string }>>>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.meta).toBeDefined();
    expect(payload.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: matchingEvent.id })]),
    );
  });
});