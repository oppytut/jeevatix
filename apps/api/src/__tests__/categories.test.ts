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
processEnv.JWT_SECRET ??= 'vitest-phase-3-secret';

const databaseUrl = processEnv.DATABASE_URL;
const jwtSecret = processEnv.JWT_SECRET;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for category tests.');
}

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required for category tests.');
}

const database = getDb(databaseUrl);

if (!database) {
  throw new Error('Failed to create database connection for category tests.');
}

const { categories, eventCategories, events, sellerProfiles, users } = schema;

const TEST_EMAIL_PREFIX = 'vitest-p3-cat-';
const TEST_CATEGORY_NAME_PREFIX = 'Vitest Phase 3 Category';
const TEST_CATEGORY_SLUG_PREFIX = 'vitest-phase-3-category';

type TestUserRole = 'buyer' | 'seller' | 'admin';

type JsonRequestOptions = {
  method?: string;
  token?: string;
  body?: Record<string, unknown>;
};

function createTestEmail(role: TestUserRole) {
  return `${TEST_EMAIL_PREFIX}${role}-${crypto.randomUUID()}@example.com`;
}

function createTestCategoryName() {
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

async function createAccessToken(role: TestUserRole) {
  const user = await createUser(role);
  const token = await generateAccessToken(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    jwtSecret,
  );

  return { user, token };
}

async function createSellerFixture(adminUserId?: string) {
  const sellerUser = await createUser('seller');
  const [sellerProfile] = await database
    .insert(sellerProfiles)
    .values({
      userId: sellerUser.id,
      orgName: `Vitest Organizer ${crypto.randomUUID()}`,
      orgDescription: 'Organizer untuk pengujian Phase 3.',
      bankName: 'Bank Test',
      bankAccountNumber: '1234567890',
      bankAccountHolder: 'Vitest Organizer',
      isVerified: Boolean(adminUserId),
      verifiedAt: adminUserId ? new Date() : null,
      verifiedBy: adminUserId ?? null,
    })
    .returning();

  return { sellerUser, sellerProfile };
}

async function createCategoryRecord(name = createTestCategoryName()) {
  const [category] = await database
    .insert(categories)
    .values({
      name,
      slug: slugifyCategoryName(name),
      icon: 'tag',
    })
    .returning();

  return category;
}

async function createEventFixture(sellerProfileId: string) {
  const now = Date.now();
  const startAt = new Date(now + 1000 * 60 * 60 * 24 * 14);
  const endAt = new Date(now + 1000 * 60 * 60 * 24 * 14 + 1000 * 60 * 60 * 4);
  const saleStartAt = new Date(now - 1000 * 60 * 60 * 24);
  const saleEndAt = new Date(now + 1000 * 60 * 60 * 24 * 10);

  const [event] = await database
    .insert(events)
    .values({
      sellerProfileId,
      title: `Vitest Category Event ${crypto.randomUUID()}`,
      slug: `vitest-category-event-${crypto.randomUUID()}`,
      description: 'Event fixture untuk pengujian delete category.',
      venueName: 'Vitest Hall',
      venueAddress: 'Jl. Pengujian No. 1',
      venueCity: 'Jakarta',
      startAt,
      endAt,
      saleStartAt,
      saleEndAt,
      status: 'published',
      maxTicketsPerOrder: 5,
      isFeatured: false,
    })
    .returning();

  return event;
}

async function cleanupTestData() {
  const testUsers = await database
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `${TEST_EMAIL_PREFIX}%`));

  const testCategories = await database
    .select({ id: categories.id })
    .from(categories)
    .where(
      or(
        like(categories.name, `${TEST_CATEGORY_NAME_PREFIX}%`),
        like(categories.slug, `${TEST_CATEGORY_SLUG_PREFIX}%`),
      ),
    );

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
        await database.delete(eventCategories).where(inArray(eventCategories.eventId, eventIds));
        await database.delete(events).where(inArray(events.id, eventIds));
      }

      await database.delete(sellerProfiles).where(inArray(sellerProfiles.id, sellerProfileIds));
    }

    await database.delete(users).where(inArray(users.id, userIds));
  }

  if (testCategories.length > 0) {
    const categoryIds = testCategories.map((category) => category.id);
    await database.delete(categories).where(inArray(categories.id, categoryIds));
  }
}

describe.sequential('Phase 3 Category Admin API', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('returns categories with event counts for admin users', async () => {
    const { token } = await createAccessToken('admin');
    const category = await createCategoryRecord();

    const response = await requestJson('/admin/categories', { token });
    const payload = await readJson<{
      success: boolean;
      data: Array<{ id: number; name: string; eventCount?: number }>;
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: category.id,
          name: category.name,
          eventCount: 0,
        }),
      ]),
    );
  });

  it('creates a category and auto-generates a slug', async () => {
    const { token } = await createAccessToken('admin');
    const name = createTestCategoryName();

    const response = await requestJson('/admin/categories', {
      method: 'POST',
      token,
      body: {
        name,
        icon: 'music-2',
      },
    });

    const payload = await readJson<{
      success: boolean;
      data: { name: string; slug: string; icon: string | null };
    }>(response);

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.name).toBe(name);
    expect(payload.data.slug).toBe(slugifyCategoryName(name));
    expect(payload.data.icon).toBe('music-2');
  });

  it('rejects duplicate category names', async () => {
    const { token } = await createAccessToken('admin');
    const name = createTestCategoryName();

    const firstResponse = await requestJson('/admin/categories', {
      method: 'POST',
      token,
      body: { name },
    });

    const duplicateResponse = await requestJson('/admin/categories', {
      method: 'POST',
      token,
      body: { name },
    });

    const payload = await readJson<{
      success: boolean;
      error: { code: string };
    }>(duplicateResponse);

    expect(firstResponse.status).toBe(201);
    expect(duplicateResponse.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('CATEGORY_ALREADY_EXISTS');
  });

  it('updates a category and regenerates the slug', async () => {
    const { token } = await createAccessToken('admin');
    const category = await createCategoryRecord();
    const updatedName = `${TEST_CATEGORY_NAME_PREFIX} Updated ${crypto.randomUUID()}`;

    const response = await requestJson(`/admin/categories/${category.id}`, {
      method: 'PATCH',
      token,
      body: {
        name: updatedName,
        icon: 'disc-3',
      },
    });

    const payload = await readJson<{
      success: boolean;
      data: { id: number; name: string; slug: string; icon: string | null };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe(category.id);
    expect(payload.data.name).toBe(updatedName);
    expect(payload.data.slug).toBe(slugifyCategoryName(updatedName));
    expect(payload.data.icon).toBe('disc-3');
  });

  it('deletes a category without attached events', async () => {
    const { token } = await createAccessToken('admin');
    const category = await createCategoryRecord();

    const response = await requestJson(`/admin/categories/${category.id}`, {
      method: 'DELETE',
      token,
    });

    const payload = await readJson<{
      success: boolean;
      data: { message: string };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.message).toBe('Category deleted successfully.');
  });

  it('rejects deleting a category that is still attached to events', async () => {
    const { user: adminUser, token } = await createAccessToken('admin');
    const category = await createCategoryRecord();
    const { sellerProfile } = await createSellerFixture(adminUser.id);
    const event = await createEventFixture(sellerProfile.id);

    await database.insert(eventCategories).values({
      eventId: event.id,
      categoryId: category.id,
    });

    const response = await requestJson(`/admin/categories/${category.id}`, {
      method: 'DELETE',
      token,
    });

    const payload = await readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('CATEGORY_HAS_EVENTS');
  });

  it('forbids non-admin users from creating categories', async () => {
    const { token } = await createAccessToken('buyer');

    const response = await requestJson('/admin/categories', {
      method: 'POST',
      token,
      body: { name: createTestCategoryName() },
    });

    const payload = await readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(403);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('FORBIDDEN');
  });
});
