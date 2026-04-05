import { getDb, schema } from '@jeevatix/core';
import { inArray, like, or } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { generateAccessToken } from '../lib/jwt';
import { hashPassword } from '../lib/password';

const globalScope = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const processEnv = (globalScope.process ??= { env: {} }).env ?? {};

processEnv.DATABASE_URL ??= 'postgresql://jeevatix:jeevatix@localhost:5432/jeevatix';
processEnv.JWT_SECRET ??= 'vitest-phase-4-secret';

const databaseUrl = processEnv.DATABASE_URL;
const jwtSecret = processEnv.JWT_SECRET;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for seller event tests.');
}

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required for seller event tests.');
}

const databaseInstance = getDb(databaseUrl);

if (!databaseInstance) {
  throw new Error('Failed to create database connection for seller event tests.');
}

const database = databaseInstance;

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

const TEST_EMAIL_PREFIX = 'vitest-p4-seller-events-';
const TEST_CATEGORY_NAME_PREFIX = 'Vitest Phase 4 Seller Category';
const TEST_CATEGORY_SLUG_PREFIX = 'vitest-phase-4-seller-category';

type TestUserRole = 'buyer' | 'seller' | 'admin';

type JsonRequestOptions = {
  method?: string;
  token?: string;
  body?: Record<string, unknown>;
};

function createTestEmail(role: TestUserRole) {
  return `${TEST_EMAIL_PREFIX}${role}-${crypto.randomUUID()}@example.com`;
}

function createCategoryName() {
  return `${TEST_CATEGORY_NAME_PREFIX} ${crypto.randomUUID()}`;
}

function slugifyCategoryName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildEventPayload(
  categoryId: number,
  title = `Vitest Seller Event ${crypto.randomUUID()}`,
) {
  return {
    title,
    description: 'Event fixture untuk pengujian Phase 4 seller API.',
    venue_name: 'Vitest Convention Hall',
    venue_address: 'Jl. Pengujian Seller No. 4',
    venue_city: 'Jakarta',
    start_at: '2030-07-01T19:00:00.000Z',
    end_at: '2030-07-01T22:00:00.000Z',
    sale_start_at: '2030-06-01T10:00:00.000Z',
    sale_end_at: '2030-06-30T23:00:00.000Z',
    banner_url: 'https://example.com/banner.png',
    max_tickets_per_order: 5,
    category_ids: [categoryId],
    images: [
      {
        image_url: 'https://example.com/gallery-1.png',
        sort_order: 0,
      },
    ],
    tiers: [
      {
        name: 'Early Bird',
        description: 'Harga promo awal.',
        price: 150000,
        quota: 50,
        sort_order: 0,
        sale_start_at: '2030-06-01T10:00:00.000Z',
        sale_end_at: '2030-06-20T23:00:00.000Z',
      },
    ],
  };
}

async function requestJson(path: string, options: JsonRequestOptions = {}) {
  const headers = new Headers();

  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  return app.request(
    path,
    {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
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

async function createUser(role: TestUserRole) {
  const [user] = await database
    .insert(users)
    .values({
      email: createTestEmail(role),
      passwordHash: await hashPassword('TestPass123!'),
      fullName: `Vitest ${role}`,
      phone: '081234567890',
      role,
      status: 'active',
      emailVerifiedAt: new Date(),
    })
    .returning();

  return user;
}

async function createTokenForUser(user: Awaited<ReturnType<typeof createUser>>) {
  return generateAccessToken(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    jwtSecret,
  );
}

async function createSellerFixture() {
  const sellerUser = await createUser('seller');
  const [sellerProfile] = await database
    .insert(sellerProfiles)
    .values({
      userId: sellerUser.id,
      orgName: `Vitest Seller Org ${crypto.randomUUID()}`,
      orgDescription: 'Seller fixture untuk pengujian event dan tier.',
      bankName: 'Bank Test',
      bankAccountNumber: '1234567890',
      bankAccountHolder: 'Vitest Seller',
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
    })
    .returning();

  return {
    sellerUser,
    sellerProfile,
    token: await createTokenForUser(sellerUser),
  };
}

async function createCategoryRecord() {
  const name = createCategoryName();
  const [category] = await database
    .insert(categories)
    .values({
      name,
      slug: slugifyCategoryName(name),
      icon: 'ticket',
    })
    .returning();

  return category;
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
      const sellerProfileIds = testSellerProfiles.map((sellerProfile) => sellerProfile.id);
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

describe.sequential('Phase 4 Seller Event API', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('creates an event, lists seller events, and returns event detail', async () => {
    const { token } = await createSellerFixture();
    const category = await createCategoryRecord();

    const createResponse = await requestJson('/seller/events', {
      method: 'POST',
      token,
      body: buildEventPayload(category.id),
    });
    const createPayload = await readJson<{
      success: boolean;
      data: {
        id: string;
        title: string;
        status: string;
        categories: Array<{ id: number }>;
        tiers: Array<{ id: string; name: string }>;
      };
    }>(createResponse);

    expect(createResponse.status).toBe(201);
    expect(createPayload.success).toBe(true);
    expect(createPayload.data.status).toBe('draft');
    expect(createPayload.data.categories).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: category.id })]),
    );
    expect(createPayload.data.tiers).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Early Bird' })]),
    );

    const listResponse = await requestJson('/seller/events?page=1&limit=20', { token });
    const listPayload = await readJson<{
      success: boolean;
      data: Array<{ id: string; title: string; status: string; total_quota: number }>;
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>(listResponse);

    expect(listResponse.status).toBe(200);
    expect(listPayload.success).toBe(true);
    expect(listPayload.meta.page).toBe(1);
    expect(listPayload.meta.limit).toBe(20);
    expect(listPayload.meta.total).toBeGreaterThanOrEqual(1);
    expect(listPayload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createPayload.data.id,
          title: createPayload.data.title,
          status: 'draft',
          total_quota: 50,
        }),
      ]),
    );

    const detailResponse = await requestJson(`/seller/events/${createPayload.data.id}`, { token });
    const detailPayload = await readJson<{
      success: boolean;
      data: {
        id: string;
        title: string;
        images: Array<{ image_url: string }>;
        tiers: Array<{ name: string; quota: number }>;
      };
    }>(detailResponse);

    expect(detailResponse.status).toBe(200);
    expect(detailPayload.success).toBe(true);
    expect(detailPayload.data.id).toBe(createPayload.data.id);
    expect(detailPayload.data.images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ image_url: 'https://example.com/gallery-1.png' }),
      ]),
    );
    expect(detailPayload.data.tiers).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Early Bird', quota: 50 })]),
    );
  });

  it('updates a seller event without auto-submitting it for review', async () => {
    const { token } = await createSellerFixture();
    const category = await createCategoryRecord();

    const createResponse = await requestJson('/seller/events', {
      method: 'POST',
      token,
      body: buildEventPayload(category.id),
    });
    const createPayload = await readJson<{
      success: boolean;
      data: { id: string };
    }>(createResponse);

    const updateResponse = await requestJson(`/seller/events/${createPayload.data.id}`, {
      method: 'PATCH',
      token,
      body: {
        title: 'Updated Seller Event Title',
      },
    });
    const updatePayload = await readJson<{
      success: boolean;
      data: {
        id: string;
        title: string;
        status: string;
      };
    }>(updateResponse);

    expect(updateResponse.status).toBe(200);
    expect(updatePayload.success).toBe(true);
    expect(updatePayload.data.id).toBe(createPayload.data.id);
    expect(updatePayload.data.title).toBe('Updated Seller Event Title');
    expect(updatePayload.data.status).toBe('draft');
  });

  it('submits draft events for review through the explicit submit endpoint', async () => {
    const { token } = await createSellerFixture();
    const category = await createCategoryRecord();

    const createResponse = await requestJson('/seller/events', {
      method: 'POST',
      token,
      body: buildEventPayload(category.id),
    });
    const createPayload = await readJson<{
      success: boolean;
      data: { id: string };
    }>(createResponse);

    const submitResponse = await requestJson(`/seller/events/${createPayload.data.id}/submit`, {
      method: 'POST',
      token,
    });
    const submitPayload = await readJson<{
      success: boolean;
      data: {
        id: string;
        status: string;
      };
    }>(submitResponse);

    expect(submitResponse.status).toBe(200);
    expect(submitPayload.success).toBe(true);
    expect(submitPayload.data.id).toBe(createPayload.data.id);
    expect(submitPayload.data.status).toBe('pending_review');
  });

  it('prevents other sellers from editing events they do not own', async () => {
    const owner = await createSellerFixture();
    const intruder = await createSellerFixture();
    const category = await createCategoryRecord();

    const createResponse = await requestJson('/seller/events', {
      method: 'POST',
      token: owner.token,
      body: buildEventPayload(category.id),
    });
    const createPayload = await readJson<{
      success: boolean;
      data: { id: string };
    }>(createResponse);

    const response = await requestJson(`/seller/events/${createPayload.data.id}`, {
      method: 'PATCH',
      token: intruder.token,
      body: {
        title: 'Should Not Be Allowed',
      },
    });
    const payload = await readJson<{
      success: boolean;
      error: {
        code: string;
        message: string;
      };
    }>(response);

    expect(response.status).toBe(403);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('FORBIDDEN');
  });

  it('rejects buyer access to seller event and tier routes', async () => {
    const buyerUser = await createUser('buyer');
    const buyerToken = await createTokenForUser(buyerUser);
    const owner = await createSellerFixture();
    const category = await createCategoryRecord();

    const createResponse = await requestJson('/seller/events', {
      method: 'POST',
      token: owner.token,
      body: buildEventPayload(category.id),
    });
    const createPayload = await readJson<{
      success: boolean;
      data: { id: string };
    }>(createResponse);

    const eventListResponse = await requestJson('/seller/events', { token: buyerToken });
    const eventListPayload = await readJson<{
      success: boolean;
      error: { code: string };
    }>(eventListResponse);

    expect(eventListResponse.status).toBe(403);
    expect(eventListPayload.success).toBe(false);
    expect(eventListPayload.error.code).toBe('FORBIDDEN');

    const tierCreateResponse = await requestJson(`/seller/events/${createPayload.data.id}/tiers`, {
      method: 'POST',
      token: buyerToken,
      body: {
        name: 'Buyer Forbidden Tier',
        price: 100000,
        quota: 10,
      },
    });
    const tierCreatePayload = await readJson<{
      success: boolean;
      error: { code: string };
    }>(tierCreateResponse);

    expect(tierCreateResponse.status).toBe(403);
    expect(tierCreatePayload.success).toBe(false);
    expect(tierCreatePayload.error.code).toBe('FORBIDDEN');
  });

  it('creates, lists, updates, and deletes ticket tiers for a seller event', async () => {
    const { token } = await createSellerFixture();
    const category = await createCategoryRecord();

    const createEventResponse = await requestJson('/seller/events', {
      method: 'POST',
      token,
      body: buildEventPayload(category.id),
    });
    const createEventPayload = await readJson<{
      success: boolean;
      data: { id: string };
    }>(createEventResponse);
    const eventId = createEventPayload.data.id;

    const createTierResponse = await requestJson(`/seller/events/${eventId}/tiers`, {
      method: 'POST',
      token,
      body: {
        name: 'VIP',
        description: 'Area prioritas dan merchandise.',
        price: 350000,
        quota: 25,
        sort_order: 1,
        sale_start_at: '2030-06-01T10:00:00.000Z',
        sale_end_at: '2030-06-25T23:00:00.000Z',
        status: 'hidden',
      },
    });
    const createTierPayload = await readJson<{
      success: boolean;
      data: {
        id: string;
        event_id: string;
        name: string;
        quota: number;
        status: string;
      };
    }>(createTierResponse);

    expect(createTierResponse.status).toBe(201);
    expect(createTierPayload.success).toBe(true);
    expect(createTierPayload.data.event_id).toBe(eventId);
    expect(createTierPayload.data.name).toBe('VIP');
    expect(createTierPayload.data.quota).toBe(25);
    expect(createTierPayload.data.status).toBe('hidden');

    const listTierResponse = await requestJson(`/seller/events/${eventId}/tiers`, { token });
    const listTierPayload = await readJson<{
      success: boolean;
      data: Array<{ id: string; name: string }>;
    }>(listTierResponse);

    expect(listTierResponse.status).toBe(200);
    expect(listTierPayload.success).toBe(true);
    expect(listTierPayload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Early Bird' }),
        expect.objectContaining({ id: createTierPayload.data.id, name: 'VIP' }),
      ]),
    );

    const updateTierResponse = await requestJson(
      `/seller/events/${eventId}/tiers/${createTierPayload.data.id}`,
      {
        method: 'PATCH',
        token,
        body: {
          name: 'VIP Updated',
          quota: 30,
          status: 'hidden',
        },
      },
    );
    const updateTierPayload = await readJson<{
      success: boolean;
      data: {
        id: string;
        name: string;
        quota: number;
        status: string;
      };
    }>(updateTierResponse);

    expect(updateTierResponse.status).toBe(200);
    expect(updateTierPayload.success).toBe(true);
    expect(updateTierPayload.data.id).toBe(createTierPayload.data.id);
    expect(updateTierPayload.data.name).toBe('VIP Updated');
    expect(updateTierPayload.data.quota).toBe(30);
    expect(updateTierPayload.data.status).toBe('hidden');

    const deleteTierResponse = await requestJson(
      `/seller/events/${eventId}/tiers/${createTierPayload.data.id}`,
      {
        method: 'DELETE',
        token,
      },
    );
    const deleteTierPayload = await readJson<{
      success: boolean;
      data: {
        message: string;
      };
    }>(deleteTierResponse);

    expect(deleteTierResponse.status).toBe(200);
    expect(deleteTierPayload.success).toBe(true);
    expect(deleteTierPayload.data.message).toMatch(/deleted/i);
  });
});
