import { schema } from '@jeevatix/core';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { database, createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p10-seller-route-errors');
const { sellerProfiles } = schema;

describe.sequential('seller route error mapping', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  it('returns not found when the seller profile is missing', async () => {
    const seller = await context.createSellerFixture();

    await database.delete(sellerProfiles).where(eq(sellerProfiles.id, seller.sellerProfile.id));

    const response = await context.requestJson('/seller/profile', {
      token: seller.token,
    });
    const payload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('SELLER_PROFILE_NOT_FOUND');
  });

  it('returns not found when updating a missing seller profile', async () => {
    const seller = await context.createSellerFixture();

    await database.delete(sellerProfiles).where(eq(sellerProfiles.id, seller.sellerProfile.id));

    const response = await context.requestJson('/seller/profile', {
      method: 'PATCH',
      token: seller.token,
      body: {
        org_name: 'Missing Seller',
      },
    });
    const payload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('SELLER_PROFILE_NOT_FOUND');
  });

  it('returns not found on the seller dashboard when the seller profile is missing', async () => {
    const seller = await context.createSellerFixture();

    await database.delete(sellerProfiles).where(eq(sellerProfiles.id, seller.sellerProfile.id));

    const response = await context.requestJson('/seller/dashboard', {
      token: seller.token,
    });
    const payload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('SELLER_PROFILE_NOT_FOUND');
  });
});
