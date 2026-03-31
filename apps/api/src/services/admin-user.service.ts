import { getDb, schema } from '@jeevatix/core';
import { and, countDistinct, desc, eq, ilike, or } from 'drizzle-orm';

import type {
  AdminSellerListItem,
  AdminSellerProfile,
  AdminUserDetail,
  AdminUserListItem,
  ListSellersQuery,
  ListUsersQuery,
  PaginationMeta,
  UpdateUserStatusInput,
  VerifySellerInput,
} from '../schemas/admin-user.schema';

const { events, orders, sellerProfiles, tickets, users } = schema;

type UserRow = typeof users.$inferSelect;
type SellerProfileRow = typeof sellerProfiles.$inferSelect;

export class AdminUserServiceError extends Error {
  constructor(
    public readonly code:
      | 'CANNOT_UPDATE_SELF'
      | 'DATABASE_UNAVAILABLE'
      | 'SELLER_NOT_FOUND'
      | 'USER_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'AdminUserServiceError';
  }
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new AdminUserServiceError(
      'DATABASE_UNAVAILABLE',
      'Database connection is not available.',
    );
  }

  return db;
}

function toPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

function normalizeSearch(search?: string) {
  return search?.trim() || undefined;
}

function toAdminUserListItem(
  user: UserRow,
  sellerProfile?: Pick<SellerProfileRow, 'id' | 'orgName' | 'isVerified'> | null,
): AdminUserListItem {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    sellerProfileId: sellerProfile?.id ?? null,
    sellerOrgName: sellerProfile?.orgName ?? null,
    sellerVerified: sellerProfile?.isVerified ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function toAdminSellerProfile(
  sellerProfile: SellerProfileRow,
  eventCount: number,
): AdminSellerProfile {
  return {
    id: sellerProfile.id,
    orgName: sellerProfile.orgName,
    orgDescription: sellerProfile.orgDescription ?? null,
    logoUrl: sellerProfile.logoUrl ?? null,
    bankName: sellerProfile.bankName ?? null,
    bankAccountNumber: sellerProfile.bankAccountNumber ?? null,
    bankAccountHolder: sellerProfile.bankAccountHolder ?? null,
    isVerified: sellerProfile.isVerified,
    verifiedAt: sellerProfile.verifiedAt?.toISOString() ?? null,
    verifiedBy: sellerProfile.verifiedBy ?? null,
    eventCount,
    createdAt: sellerProfile.createdAt.toISOString(),
    updatedAt: sellerProfile.updatedAt.toISOString(),
  };
}

function toAdminSellerListItem(
  sellerProfile: SellerProfileRow,
  user: UserRow,
  eventCount: number,
): AdminSellerListItem {
  return {
    id: sellerProfile.id,
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    orgName: sellerProfile.orgName,
    isVerified: sellerProfile.isVerified,
    verifiedAt: sellerProfile.verifiedAt?.toISOString() ?? null,
    verifiedBy: sellerProfile.verifiedBy ?? null,
    eventCount,
    createdAt: sellerProfile.createdAt.toISOString(),
    updatedAt: sellerProfile.updatedAt.toISOString(),
  };
}

async function getUserListItem(userId: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const row = await database
    .select({
      user: users,
      sellerProfile: {
        id: sellerProfiles.id,
        orgName: sellerProfiles.orgName,
        isVerified: sellerProfiles.isVerified,
      },
    })
    .from(users)
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  const result = row[0];

  if (!result) {
    throw new AdminUserServiceError('USER_NOT_FOUND', 'User not found.');
  }

  return toAdminUserListItem(result.user, result.sellerProfile?.id ? result.sellerProfile : null);
}

async function getSellerListItem(sellerProfileId: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const rows = await database
    .select({
      sellerProfile: sellerProfiles,
      user: users,
      eventCount: countDistinct(events.id),
    })
    .from(sellerProfiles)
    .innerJoin(users, eq(users.id, sellerProfiles.userId))
    .leftJoin(events, eq(events.sellerProfileId, sellerProfiles.id))
    .where(eq(sellerProfiles.id, sellerProfileId))
    .groupBy(sellerProfiles.id, users.id)
    .limit(1);

  const result = rows[0];

  if (!result) {
    throw new AdminUserServiceError('SELLER_NOT_FOUND', 'Seller profile not found.');
  }

  return toAdminSellerListItem(result.sellerProfile, result.user, result.eventCount);
}

export const adminUserService = {
  async listUsers(query: ListUsersQuery, databaseUrl?: string) {
    const database = getDatabase(databaseUrl);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const search = normalizeSearch(query.search);
    const conditions = [
      query.role ? eq(users.role, query.role) : undefined,
      query.status ? eq(users.status, query.status) : undefined,
      search
        ? or(
            ilike(users.fullName, `%${search}%`),
            ilike(users.email, `%${search}%`),
            ilike(sellerProfiles.orgName, `%${search}%`),
          )
        : undefined,
    ].filter((condition) => condition !== undefined);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await database
      .select({ total: countDistinct(users.id) })
      .from(users)
      .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
      .where(whereClause);

    const rows = await database
      .select({
        user: users,
        sellerProfile: {
          id: sellerProfiles.id,
          orgName: sellerProfiles.orgName,
          isVerified: sellerProfiles.isVerified,
        },
      })
      .from(users)
      .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows.map((row) =>
        toAdminUserListItem(row.user, row.sellerProfile?.id ? row.sellerProfile : null),
      ),
      meta: toPaginationMeta(totalRow?.total ?? 0, page, limit),
    };
  },

  async getUserDetail(userId: string, databaseUrl?: string): Promise<AdminUserDetail> {
    const database = getDatabase(databaseUrl);
    const rows = await database
      .select({
        user: users,
        sellerProfile: sellerProfiles,
        orderCount: countDistinct(orders.id),
        ticketCount: countDistinct(tickets.id),
        eventCount: countDistinct(events.id),
      })
      .from(users)
      .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
      .leftJoin(orders, eq(orders.userId, users.id))
      .leftJoin(tickets, eq(tickets.orderId, orders.id))
      .leftJoin(events, eq(events.sellerProfileId, sellerProfiles.id))
      .where(eq(users.id, userId))
      .groupBy(users.id, sellerProfiles.id)
      .limit(1);

    const result = rows[0];

    if (!result) {
      throw new AdminUserServiceError('USER_NOT_FOUND', 'User not found.');
    }

    return {
      id: result.user.id,
      email: result.user.email,
      fullName: result.user.fullName,
      phone: result.user.phone ?? null,
      avatarUrl: result.user.avatarUrl ?? null,
      role: result.user.role,
      status: result.user.status,
      emailVerifiedAt: result.user.emailVerifiedAt?.toISOString() ?? null,
      orderCount: result.orderCount,
      ticketCount: result.ticketCount,
      sellerProfile: result.sellerProfile?.id
        ? toAdminSellerProfile(result.sellerProfile, result.eventCount)
        : null,
      createdAt: result.user.createdAt.toISOString(),
      updatedAt: result.user.updatedAt.toISOString(),
    };
  },

  async updateUserStatus(
    userId: string,
    input: UpdateUserStatusInput,
    adminUserId: string,
    databaseUrl?: string,
  ): Promise<AdminUserListItem> {
    if (userId === adminUserId) {
      throw new AdminUserServiceError(
        'CANNOT_UPDATE_SELF',
        'Admin cannot update their own account status.',
      );
    }

    const database = getDatabase(databaseUrl);
    const [updatedUser] = await database
      .update(users)
      .set({
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new AdminUserServiceError('USER_NOT_FOUND', 'User not found.');
    }

    return getUserListItem(updatedUser.id, databaseUrl);
  },

  async listSellers(query: ListSellersQuery, databaseUrl?: string) {
    const database = getDatabase(databaseUrl);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const search = normalizeSearch(query.search);
    const isVerified = query.is_verified === undefined ? undefined : query.is_verified === 'true';
    const conditions = [
      isVerified === undefined ? undefined : eq(sellerProfiles.isVerified, isVerified),
      search
        ? or(
            ilike(users.fullName, `%${search}%`),
            ilike(users.email, `%${search}%`),
            ilike(sellerProfiles.orgName, `%${search}%`),
          )
        : undefined,
    ].filter((condition) => condition !== undefined);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await database
      .select({ total: countDistinct(sellerProfiles.id) })
      .from(sellerProfiles)
      .innerJoin(users, eq(users.id, sellerProfiles.userId))
      .where(whereClause);

    const rows = await database
      .select({
        sellerProfile: sellerProfiles,
        user: users,
        eventCount: countDistinct(events.id),
      })
      .from(sellerProfiles)
      .innerJoin(users, eq(users.id, sellerProfiles.userId))
      .leftJoin(events, eq(events.sellerProfileId, sellerProfiles.id))
      .where(whereClause)
      .groupBy(sellerProfiles.id, users.id)
      .orderBy(desc(sellerProfiles.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows.map((row) => toAdminSellerListItem(row.sellerProfile, row.user, row.eventCount)),
      meta: toPaginationMeta(totalRow?.total ?? 0, page, limit),
    };
  },

  async verifySeller(
    sellerProfileId: string,
    input: VerifySellerInput,
    adminUserId: string,
    databaseUrl?: string,
  ): Promise<AdminSellerListItem> {
    const database = getDatabase(databaseUrl);
    const [updatedSellerProfile] = await database
      .update(sellerProfiles)
      .set({
        isVerified: input.is_verified,
        verifiedAt: input.is_verified ? new Date() : null,
        verifiedBy: input.is_verified ? adminUserId : null,
        updatedAt: new Date(),
      })
      .where(eq(sellerProfiles.id, sellerProfileId))
      .returning({ id: sellerProfiles.id });

    if (!updatedSellerProfile) {
      throw new AdminUserServiceError('SELLER_NOT_FOUND', 'Seller profile not found.');
    }

    return getSellerListItem(updatedSellerProfile.id, databaseUrl);
  },
};
