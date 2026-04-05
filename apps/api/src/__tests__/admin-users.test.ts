import { getDb, schema } from '@jeevatix/core';
import { eq, inArray, like } from 'drizzle-orm';
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
  throw new Error('DATABASE_URL is required for admin user tests.');
}

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required for admin user tests.');
}

const databaseInstance = getDb(databaseUrl);

if (!databaseInstance) {
  throw new Error('Failed to create database connection for admin user tests.');
}

const database = databaseInstance;

const { events, notifications, sellerProfiles, users } = schema;

const TEST_EMAIL_PREFIX = 'vitest-p3-admin-';

type TestUserRole = 'buyer' | 'seller' | 'admin';

type JsonRequestOptions = {
  method?: string;
  token?: string;
  body?: Record<string, unknown>;
};

function createTestEmail(role: TestUserRole) {
  return `${TEST_EMAIL_PREFIX}${role}-${crypto.randomUUID()}@example.com`;
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

async function createSellerFixture(isVerified = false, verifiedBy?: string) {
  const sellerUser = await createUser('seller');
  const [sellerProfile] = await database
    .insert(sellerProfiles)
    .values({
      userId: sellerUser.id,
      orgName: `Vitest Seller Org ${crypto.randomUUID()}`,
      orgDescription: 'Seller untuk pengujian endpoint admin.',
      bankName: 'Bank Test',
      bankAccountNumber: '9876543210',
      bankAccountHolder: 'Vitest Seller',
      isVerified,
      verifiedAt: isVerified ? new Date() : null,
      verifiedBy: isVerified ? (verifiedBy ?? null) : null,
    })
    .returning();

  return { sellerUser, sellerProfile };
}

async function createSellerEventFixture(sellerProfileId: string) {
  const now = Date.now();
  const [event] = await database
    .insert(events)
    .values({
      sellerProfileId,
      title: `Vitest Seller Event ${crypto.randomUUID()}`,
      slug: `vitest-seller-event-${crypto.randomUUID()}`,
      description: 'Event fixture untuk detail seller admin.',
      venueName: 'Vitest Arena',
      venueAddress: 'Jl. Test No. 2',
      venueCity: 'Bandung',
      startAt: new Date(now + 1000 * 60 * 60 * 24 * 7),
      endAt: new Date(now + 1000 * 60 * 60 * 24 * 7 + 1000 * 60 * 60 * 3),
      saleStartAt: new Date(now - 1000 * 60 * 60 * 24),
      saleEndAt: new Date(now + 1000 * 60 * 60 * 24 * 5),
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

  if (testUsers.length === 0) {
    return;
  }

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
      await database.delete(events).where(
        inArray(
          events.id,
          testEvents.map((event) => event.id),
        ),
      );
    }

    await database.delete(sellerProfiles).where(inArray(sellerProfiles.id, sellerProfileIds));
  }

  await database.delete(notifications).where(inArray(notifications.userId, userIds));
  await database.delete(users).where(inArray(users.id, userIds));
}

describe.sequential('Phase 3 Admin User API', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('returns a paginated user list for admins', async () => {
    const { token } = await createAccessToken('admin');
    const buyerUser = await createUser('buyer');

    const response = await requestJson('/admin/users', { token });
    const payload = await readJson<{
      success: boolean;
      data: Array<{ id: string; email: string; role: string }>;
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.meta.page).toBe(1);
    expect(payload.meta.limit).toBe(20);
    expect(payload.meta.total).toBeGreaterThanOrEqual(1);
    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: buyerUser.id, email: buyerUser.email, role: 'buyer' }),
      ]),
    );
  });

  it('filters users by seller role', async () => {
    const { token } = await createAccessToken('admin');
    const { sellerUser } = await createSellerFixture();
    await createUser('buyer');

    const response = await requestJson('/admin/users?role=seller', { token });
    const payload = await readJson<{
      success: boolean;
      data: Array<{ id: string; email: string; role: string }>;
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.length).toBeGreaterThan(0);
    expect(payload.data.every((user) => user.role === 'seller')).toBe(true);
    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: sellerUser.id, email: sellerUser.email, role: 'seller' }),
      ]),
    );
  });

  it('returns detailed user data including seller profile information', async () => {
    const { token } = await createAccessToken('admin');
    const { sellerUser, sellerProfile } = await createSellerFixture();
    const sellerEvent = await createSellerEventFixture(sellerProfile.id);

    const response = await requestJson(`/admin/users/${sellerUser.id}`, { token });
    const payload = await readJson<{
      success: boolean;
      data: {
        id: string;
        role: string;
        orderCount: number;
        ticketCount: number;
        sellerProfile: null | {
          id: string;
          orgName: string;
          eventCount: number;
          events: Array<{ id: string; title: string }>;
        };
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe(sellerUser.id);
    expect(payload.data.role).toBe('seller');
    expect(payload.data.orderCount).toBe(0);
    expect(payload.data.ticketCount).toBe(0);
    expect(payload.data.sellerProfile).toEqual(
      expect.objectContaining({
        id: sellerProfile.id,
        orgName: sellerProfile.orgName,
        eventCount: 1,
        events: expect.arrayContaining([
          expect.objectContaining({ id: sellerEvent.id, title: sellerEvent.title }),
        ]),
      }),
    );
  });

  it('updates a user status', async () => {
    const { token } = await createAccessToken('admin');
    const buyerUser = await createUser('buyer');

    const response = await requestJson(`/admin/users/${buyerUser.id}/status`, {
      method: 'PATCH',
      token,
      body: { status: 'suspended' },
    });

    const payload = await readJson<{
      success: boolean;
      data: { id: string; status: string };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe(buyerUser.id);
    expect(payload.data.status).toBe('suspended');

    const updatedUser = await database.query.users.findFirst({ where: eq(users.id, buyerUser.id) });
    expect(updatedUser?.status).toBe('suspended');
  });

  it('verifies a seller profile', async () => {
    const { user: adminUser, token } = await createAccessToken('admin');
    const { sellerProfile, sellerUser } = await createSellerFixture(false);

    const response = await requestJson(`/admin/sellers/${sellerProfile.id}/verify`, {
      method: 'PATCH',
      token,
      body: { is_verified: true },
    });

    const payload = await readJson<{
      success: boolean;
      data: { id: string; userId: string; isVerified: boolean; verifiedBy: string | null };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe(sellerProfile.id);
    expect(payload.data.userId).toBe(sellerUser.id);
    expect(payload.data.isVerified).toBe(true);
    expect(payload.data.verifiedBy).toBe(adminUser.id);

    const updatedSellerProfile = await database.query.sellerProfiles.findFirst({
      where: eq(sellerProfiles.id, sellerProfile.id),
    });
    expect(updatedSellerProfile?.isVerified).toBe(true);
    expect(updatedSellerProfile?.verifiedBy).toBe(adminUser.id);
  });

  it('forbids non-admin users from accessing admin user routes', async () => {
    const { token } = await createAccessToken('buyer');

    const response = await requestJson('/admin/users', { token });
    const payload = await readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(403);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('FORBIDDEN');
  });
});
