import { getDb, schema } from '@jeevatix/core';
import { inArray, like } from 'drizzle-orm';
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
  throw new Error('DATABASE_URL is required for seller profile tests.');
}

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required for seller profile tests.');
}

const database = getDb(databaseUrl);

if (!database) {
  throw new Error('Failed to create database connection for seller profile tests.');
}

const { sellerProfiles, users } = schema;

const TEST_EMAIL_PREFIX = 'vitest-p4-seller-profile-';

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
      orgName: `Vitest Organizer ${crypto.randomUUID()}`,
      orgDescription: 'Seller profile fixture untuk pengujian Phase 4.',
      logoUrl: 'https://example.com/logo.png',
      bankName: 'Bank Test',
      bankAccountNumber: '1234567890',
      bankAccountHolder: 'Vitest Organizer',
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
    await database.delete(sellerProfiles).where(
      inArray(
        sellerProfiles.id,
        testSellerProfiles.map((sellerProfile) => sellerProfile.id),
      ),
    );
  }

  await database.delete(users).where(inArray(users.id, userIds));
}

describe.sequential('Phase 4 Seller Profile API', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('returns the current seller profile for authenticated sellers', async () => {
    const { sellerUser, sellerProfile, token } = await createSellerFixture();

    const response = await requestJson('/seller/profile', { token });
    const payload = await readJson<{
      success: boolean;
      data: {
        id: string;
        user_id: string;
        email: string;
        org_name: string;
        bank_name: string | null;
        is_verified: boolean;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe(sellerProfile.id);
    expect(payload.data.user_id).toBe(sellerUser.id);
    expect(payload.data.email).toBe(sellerUser.email);
    expect(payload.data.org_name).toBe(sellerProfile.orgName);
    expect(payload.data.bank_name).toBe('Bank Test');
    expect(payload.data.is_verified).toBe(false);
  });

  it('updates the current seller profile', async () => {
    const { token } = await createSellerFixture();

    const response = await requestJson('/seller/profile', {
      method: 'PATCH',
      token,
      body: {
        org_name: 'Updated Organizer Name',
        org_description: 'Updated description for seller profile.',
        logo_url: 'https://example.com/updated-logo.png',
        bank_name: 'Bank Updated',
        bank_account_number: '9988776655',
        bank_account_holder: 'Updated Organizer',
      },
    });
    const payload = await readJson<{
      success: boolean;
      data: {
        org_name: string;
        org_description: string | null;
        logo_url: string | null;
        bank_name: string | null;
        bank_account_number: string | null;
        bank_account_holder: string | null;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.org_name).toBe('Updated Organizer Name');
    expect(payload.data.org_description).toBe('Updated description for seller profile.');
    expect(payload.data.logo_url).toBe('https://example.com/updated-logo.png');
    expect(payload.data.bank_name).toBe('Bank Updated');
    expect(payload.data.bank_account_number).toBe('9988776655');
    expect(payload.data.bank_account_holder).toBe('Updated Organizer');
  });

  it('rejects buyer access to seller profile routes', async () => {
    const buyerUser = await createUser('buyer');
    const buyerToken = await createTokenForUser(buyerUser);

    const response = await requestJson('/seller/profile', { token: buyerToken });
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
});