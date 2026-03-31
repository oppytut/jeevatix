import { getDb, schema } from '@jeevatix/core';
import { eq } from 'drizzle-orm';

import type { SellerProfile, UpdateSellerProfileInput } from '../schemas/seller-profile.schema';

const { sellerProfiles } = schema;

export class SellerProfileServiceError extends Error {
  constructor(
    public readonly code: 'DATABASE_UNAVAILABLE' | 'SELLER_PROFILE_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'SellerProfileServiceError';
  }
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new SellerProfileServiceError(
      'DATABASE_UNAVAILABLE',
      'Database connection is not available.',
    );
  }

  return db;
}

async function getSellerProfileRecord(userId: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);

  return database.query.sellerProfiles.findFirst({
    where: eq(sellerProfiles.userId, userId),
    with: {
      user: true,
    },
  });
}

function toSellerProfile(
  record: NonNullable<Awaited<ReturnType<typeof getSellerProfileRecord>>>,
): SellerProfile {
  return {
    id: record.id,
    user_id: record.userId,
    email: record.user.email,
    full_name: record.user.fullName,
    phone: record.user.phone ?? null,
    avatar_url: record.user.avatarUrl ?? null,
    org_name: record.orgName,
    org_description: record.orgDescription ?? null,
    logo_url: record.logoUrl ?? null,
    bank_name: record.bankName ?? null,
    bank_account_number: record.bankAccountNumber ?? null,
    bank_account_holder: record.bankAccountHolder ?? null,
    is_verified: record.isVerified,
    verified_at: record.verifiedAt?.toISOString() ?? null,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}

export const sellerProfileService = {
  async getProfile(userId: string, databaseUrl?: string): Promise<SellerProfile> {
    const profile = await getSellerProfileRecord(userId, databaseUrl);

    if (!profile) {
      throw new SellerProfileServiceError('SELLER_PROFILE_NOT_FOUND', 'Seller profile not found.');
    }

    return toSellerProfile(profile);
  },

  async updateProfile(
    userId: string,
    input: UpdateSellerProfileInput,
    databaseUrl?: string,
  ): Promise<SellerProfile> {
    const database = getDatabase(databaseUrl);
    const values: Partial<typeof sellerProfiles.$inferInsert> = {};

    if (input.org_name !== undefined) {
      values.orgName = input.org_name;
    }

    if (input.org_description !== undefined) {
      values.orgDescription = input.org_description;
    }

    if (input.logo_url !== undefined) {
      values.logoUrl = input.logo_url;
    }

    if (input.bank_name !== undefined) {
      values.bankName = input.bank_name;
    }

    if (input.bank_account_number !== undefined) {
      values.bankAccountNumber = input.bank_account_number;
    }

    if (input.bank_account_holder !== undefined) {
      values.bankAccountHolder = input.bank_account_holder;
    }

    if (Object.keys(values).length === 0) {
      return this.getProfile(userId, databaseUrl);
    }

    const [profile] = await database
      .update(sellerProfiles)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(sellerProfiles.userId, userId))
      .returning({ id: sellerProfiles.id });

    if (!profile) {
      throw new SellerProfileServiceError('SELLER_PROFILE_NOT_FOUND', 'Seller profile not found.');
    }

    return this.getProfile(userId, databaseUrl);
  },
};