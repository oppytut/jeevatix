import { db, schema } from '@jeevatix/core';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { sign, verify } from 'hono/jwt';

import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  type TokenPayloadInput,
} from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import type {
  AuthPayload,
  AuthUser,
  ForgotPasswordInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  RegisterSellerInput,
  ResetPasswordInput,
} from '../schemas/auth.schema';

const { refreshTokens, sellerProfiles, users } = schema;

const PASSWORD_RESET_TTL_SECONDS = 60 * 60;
const VERIFY_EMAIL_TTL_SECONDS = 60 * 60 * 24;

type ActionTokenType = 'password_reset' | 'verify_email';

type ActionTokenPayload = {
  sub: string;
  type: ActionTokenType;
  iat: number;
  exp: number;
};

type AuthenticatedUserRow = typeof users.$inferSelect;

type AuthResult = AuthPayload;

export class AuthServiceError extends Error {
  constructor(
    public readonly code:
      | 'ACCOUNT_NOT_ACTIVE'
      | 'DATABASE_UNAVAILABLE'
      | 'EMAIL_ALREADY_EXISTS'
      | 'INVALID_CREDENTIALS'
      | 'INVALID_REFRESH_TOKEN'
      | 'INVALID_RESET_TOKEN'
      | 'INVALID_VERIFY_EMAIL_TOKEN',
    message: string,
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

function getDatabase() {
  if (!db) {
    throw new AuthServiceError('DATABASE_UNAVAILABLE', 'Database connection is not available.');
  }

  return db;
}

function toAuthUser(user: AuthenticatedUserRow): AuthUser {
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

async function createSession(user: AuthenticatedUserRow, secret: string) {
  const payload: TokenPayloadInput = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = await generateAccessToken(payload, secret);
  const refreshToken = await generateRefreshToken(payload, secret);
  const refreshTokenHash = await hashPassword(refreshToken);
  const refreshPayload = await verifyToken(refreshToken, secret);

  return {
    accessToken,
    refreshToken,
    refreshTokenHash,
    refreshExpiresAt: new Date(refreshPayload.exp * 1000),
  };
}

async function findRefreshTokenRecord(userId: string, refreshToken: string) {
  const database = getDatabase();

  const activeRefreshTokens = await database.query.refreshTokens.findMany({
    where: and(
      eq(refreshTokens.userId, userId),
      isNull(refreshTokens.revokedAt),
      gt(refreshTokens.expiresAt, new Date()),
    ),
  });

  for (const tokenRecord of activeRefreshTokens) {
    const isMatch = await verifyPassword(refreshToken, tokenRecord.tokenHash);

    if (isMatch) {
      return tokenRecord;
    }
  }

  return null;
}

function assertActiveUser(user: AuthenticatedUserRow) {
  if (user.status !== 'active') {
    throw new AuthServiceError('ACCOUNT_NOT_ACTIVE', 'Account is not active.');
  }
}

async function signActionToken(
  userId: string,
  secret: string,
  type: ActionTokenType,
  ttlSeconds: number,
) {
  const issuedAt = Math.floor(Date.now() / 1000);

  return sign(
    {
      sub: userId,
      type,
      iat: issuedAt,
      exp: issuedAt + ttlSeconds,
    } satisfies ActionTokenPayload,
    secret,
  );
}

async function verifyActionToken(token: string, secret: string, expectedType: ActionTokenType) {
  const payload = (await verify(token, secret)) as Partial<ActionTokenPayload>;

  if (
    typeof payload.sub !== 'string' ||
    payload.type !== expectedType ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number'
  ) {
    throw new Error('Invalid action token payload.');
  }

  return payload as ActionTokenPayload;
}

export const authService = {
  async register(input: RegisterInput, secret: string): Promise<AuthResult> {
    const database = getDatabase();

    const existingUser = await database.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (existingUser) {
      throw new AuthServiceError('EMAIL_ALREADY_EXISTS', 'Email is already registered.');
    }

    const passwordHash = await hashPassword(input.password);

    return database.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email,
          passwordHash,
          fullName: input.full_name,
          phone: input.phone,
          role: 'buyer',
          status: 'active',
        })
        .returning();

      const session = await createSession(user, secret);

      await tx.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: session.refreshTokenHash,
        expiresAt: session.refreshExpiresAt,
      });

      return {
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        user: toAuthUser(user),
      };
    });
  },

  async registerSeller(input: RegisterSellerInput, secret: string): Promise<AuthResult> {
    const database = getDatabase();

    const existingUser = await database.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (existingUser) {
      throw new AuthServiceError('EMAIL_ALREADY_EXISTS', 'Email is already registered.');
    }

    const passwordHash = await hashPassword(input.password);

    return database.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email,
          passwordHash,
          fullName: input.full_name,
          phone: input.phone,
          role: 'seller',
          status: 'active',
        })
        .returning();

      await tx.insert(sellerProfiles).values({
        userId: user.id,
        orgName: input.org_name,
        orgDescription: input.org_description,
      });

      const session = await createSession(user, secret);

      await tx.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: session.refreshTokenHash,
        expiresAt: session.refreshExpiresAt,
      });

      return {
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        user: toAuthUser(user),
      };
    });
  },

  async login(input: LoginInput, secret: string): Promise<AuthResult> {
    const database = getDatabase();

    const user = await database.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (!user) {
      throw new AuthServiceError('INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    assertActiveUser(user);

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AuthServiceError('INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const session = await createSession(user, secret);

    await database.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: session.refreshTokenHash,
      expiresAt: session.refreshExpiresAt,
    });

    return {
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      user: toAuthUser(user),
    };
  },

  async refresh(input: RefreshInput, secret: string): Promise<AuthResult> {
    const database = getDatabase();
    const payload = await verifyToken(input.refresh_token, secret).catch(() => {
      throw new AuthServiceError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
    });

    if (payload.type !== 'refresh') {
      throw new AuthServiceError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
    }

    const user = await database.query.users.findFirst({
      where: eq(users.id, payload.id),
    });

    if (!user) {
      throw new AuthServiceError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
    }

    assertActiveUser(user);

    const matchingToken = await findRefreshTokenRecord(user.id, input.refresh_token);

    if (!matchingToken) {
      throw new AuthServiceError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
    }

    return database.transaction(async (tx) => {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, matchingToken.id));

      const session = await createSession(user, secret);

      await tx.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: session.refreshTokenHash,
        expiresAt: session.refreshExpiresAt,
      });

      return {
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        user: toAuthUser(user),
      };
    });
  },

  async forgotPassword(input: ForgotPasswordInput, secret: string) {
    const database = getDatabase();
    const user = await database.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (!user) {
      return {
        message: 'If the email is registered, reset instructions have been generated.',
      };
    }

    await signActionToken(user.id, secret, 'password_reset', PASSWORD_RESET_TTL_SECONDS);

    return {
      message: 'If the email is registered, reset instructions have been generated.',
    };
  },

  async resetPassword(input: ResetPasswordInput, secret: string) {
    const database = getDatabase();
    const payload = await verifyActionToken(input.token, secret, 'password_reset').catch(() => {
      throw new AuthServiceError('INVALID_RESET_TOKEN', 'Invalid or expired reset token.');
    });

    const passwordHash = await hashPassword(input.password);

    const [updatedUser] = await database
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, payload.sub))
      .returning({ id: users.id });

    if (!updatedUser) {
      throw new AuthServiceError('INVALID_RESET_TOKEN', 'Invalid or expired reset token.');
    }

    await database
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, payload.sub), isNull(refreshTokens.revokedAt)));

    return {
      message: 'Password has been reset successfully.',
    };
  },

  async verifyEmail(token: string, secret: string) {
    const database = getDatabase();
    const payload = await verifyActionToken(token, secret, 'verify_email').catch(() => {
      throw new AuthServiceError(
        'INVALID_VERIFY_EMAIL_TOKEN',
        'Invalid or expired verification token.',
      );
    });

    const [updatedUser] = await database
      .update(users)
      .set({
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, payload.sub))
      .returning({ id: users.id });

    if (!updatedUser) {
      throw new AuthServiceError(
        'INVALID_VERIFY_EMAIL_TOKEN',
        'Invalid or expired verification token.',
      );
    }

    return {
      message: 'Email has been verified successfully.',
    };
  },

  async logout(refreshToken: string, secret: string) {
    const database = getDatabase();
    const payload = await verifyToken(refreshToken, secret).catch(() => {
      throw new AuthServiceError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
    });

    if (payload.type !== 'refresh') {
      throw new AuthServiceError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
    }

    const matchingToken = await findRefreshTokenRecord(payload.id, refreshToken);

    if (matchingToken) {
      await database
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, matchingToken.id));
    }

    return {
      message: 'Logout successful.',
    };
  },

  async generateVerifyEmailToken(userId: string, secret: string) {
    return signActionToken(userId, secret, 'verify_email', VERIFY_EMAIL_TTL_SECONDS);
  },
};
