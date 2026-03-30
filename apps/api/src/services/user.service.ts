import { getDb, schema } from '@jeevatix/core';
import { and, eq, isNull } from 'drizzle-orm';

import { hashPassword, verifyPassword } from '../lib/password';
import type {
  ChangePasswordInput,
  UpdateProfileInput,
  UserMessagePayload,
  UserProfile,
} from '../schemas/user.schema';

const { refreshTokens, users } = schema;

type UserRow = typeof users.$inferSelect;

export class UserServiceError extends Error {
  constructor(
    public readonly code: 'DATABASE_UNAVAILABLE' | 'INVALID_CREDENTIALS' | 'USER_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'UserServiceError';
  }
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new UserServiceError('DATABASE_UNAVAILABLE', 'Database connection is not available.');
  }

  return db;
}

function toUserProfile(user: UserRow): UserProfile {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    phone: user.phone ?? null,
    avatar_url: user.avatarUrl ?? null,
    role: user.role,
    status: user.status,
    email_verified_at: user.emailVerifiedAt?.toISOString() ?? null,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
}

async function getUserById(userId: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);

  return database.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

export const userService = {
  async getMe(userId: string, databaseUrl?: string): Promise<UserProfile> {
    const user = await getUserById(userId, databaseUrl);

    if (!user) {
      throw new UserServiceError('USER_NOT_FOUND', 'User not found.');
    }

    return toUserProfile(user);
  },

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
    databaseUrl?: string,
  ): Promise<UserProfile> {
    const database = getDatabase(databaseUrl);
    const values: Partial<typeof users.$inferInsert> = {};

    if (input.full_name !== undefined) {
      values.fullName = input.full_name;
    }

    if (input.phone !== undefined) {
      values.phone = input.phone;
    }

    if (input.avatar_url !== undefined) {
      values.avatarUrl = input.avatar_url;
    }

    if (Object.keys(values).length === 0) {
      return this.getMe(userId, databaseUrl);
    }

    const [user] = await database
      .update(users)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!user) {
      throw new UserServiceError('USER_NOT_FOUND', 'User not found.');
    }

    return toUserProfile(user);
  },

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    databaseUrl?: string,
  ): Promise<UserMessagePayload> {
    const database = getDatabase(databaseUrl);
    const user = await getUserById(userId, databaseUrl);

    if (!user) {
      throw new UserServiceError('USER_NOT_FOUND', 'User not found.');
    }

    const passwordMatches = await verifyPassword(input.old_password, user.passwordHash);

    if (!passwordMatches) {
      throw new UserServiceError('INVALID_CREDENTIALS', 'Current password is incorrect.');
    }

    const passwordHash = await hashPassword(input.new_password);

    await database.transaction(async (tx) => {
      const [updatedUser] = await tx
        .update(users)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({ id: users.id });

      if (!updatedUser) {
        throw new UserServiceError('USER_NOT_FOUND', 'User not found.');
      }

      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
    });

    return {
      message: 'Password changed successfully.',
    };
  },
};
