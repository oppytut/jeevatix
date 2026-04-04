import { schema } from '@jeevatix/core';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { database, createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p10-users-route');
const { users } = schema;

describe.sequential('users route error mapping', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  it('returns not found when the authenticated user no longer exists', async () => {
    const buyer = await context.createBuyerFixture();

    await database.delete(users).where(eq(users.id, buyer.user.id));

    const response = await context.requestJson('/users/me', {
      token: buyer.token,
    });
    const payload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('USER_NOT_FOUND');
  });

  it('returns not found when updating a deleted user profile', async () => {
    const buyer = await context.createBuyerFixture();

    await database.delete(users).where(eq(users.id, buyer.user.id));

    const response = await context.requestJson('/users/me', {
      method: 'PATCH',
      token: buyer.token,
      body: {
        full_name: 'Missing User',
      },
    });
    const payload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('USER_NOT_FOUND');
  });

  it('returns unauthorized when the current password is incorrect', async () => {
    const buyer = await context.createBuyerFixture();

    const response = await context.requestJson('/users/me/password', {
      method: 'PATCH',
      token: buyer.token,
      body: {
        old_password: 'WrongPass123!',
        new_password: 'NewPass456!',
      },
    });
    const payload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns not found when changing the password for a deleted user', async () => {
    const buyer = await context.createBuyerFixture();

    await database.delete(users).where(eq(users.id, buyer.user.id));

    const response = await context.requestJson('/users/me/password', {
      method: 'PATCH',
      token: buyer.token,
      body: {
        old_password: 'TestPass123!',
        new_password: 'NewPass456!',
      },
    });
    const payload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('USER_NOT_FOUND');
  });
});
