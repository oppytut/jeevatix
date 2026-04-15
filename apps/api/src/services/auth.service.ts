import { getDb, schema } from '@jeevatix/core';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { sign, verify } from 'hono/jwt';

import {
  generateAccessToken,
  generateRefreshToken,
  JWT_ALGORITHM,
  verifyToken,
  type TokenPayloadInput,
} from '../lib/jwt';
import { logErrorWithContext } from '../lib/observability';
import { hashPassword, verifyPassword } from '../lib/password';
import type {
  AuthPayload,
  AuthUser,
  ForgotPasswordPayload,
  ForgotPasswordInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  RegisterSellerInput,
  ResetPasswordInput,
} from '../schemas/auth.schema';
import {
  buildResetPasswordEmail,
  buildVerificationEmail,
  createEmailService,
  type EmailEnv,
} from './email';

const { refreshTokens, sellerProfiles, users } = schema;

const PASSWORD_RESET_TTL_SECONDS = 60 * 60;
const VERIFY_EMAIL_TTL_SECONDS = 60 * 60 * 24;

type ActionTokenType = 'password_reset' | 'verify_email';

type ActionTokenPayload = {
  sub: string;
  type: ActionTokenType;
  ver: number;
  iat: number;
  exp: number;
};

type AuthenticatedUserRow = typeof users.$inferSelect;

type BackgroundTaskScheduler = (task: Promise<unknown>) => void;

type AuthFlowOptions = EmailEnv & {
  apiBaseUrl?: string;
  buyerAppUrl?: string;
  sellerAppUrl?: string;
  exposeDebugTokens?: boolean;
  scheduleTask?: BackgroundTaskScheduler;
};

type AuthResult = AuthPayload & {
  verify_email_token?: string;
};

type ForgotPasswordResult = ForgotPasswordPayload & {
  reset_token?: string;
};

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

function getProcessEnv(key: string) {
  return (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[key];
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

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

async function hashSessionToken(token: string) {
  const encodedToken = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', encodedToken);

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

async function createSession(user: AuthenticatedUserRow, secret: string) {
  const payload: TokenPayloadInput = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = await generateAccessToken(payload, secret);
  const refreshToken = await generateRefreshToken(payload, secret);
  const refreshTokenHash = await hashSessionToken(refreshToken);
  const refreshPayload = await verifyToken(refreshToken, secret);

  return {
    accessToken,
    refreshToken,
    refreshTokenHash,
    refreshExpiresAt: new Date(refreshPayload.exp * 1000),
  };
}

async function findRefreshTokenRecord(userId: string, refreshToken: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);
  const refreshTokenHash = await hashSessionToken(refreshToken);

  return database.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.userId, userId),
      eq(refreshTokens.tokenHash, refreshTokenHash),
      isNull(refreshTokens.revokedAt),
      gt(refreshTokens.expiresAt, new Date()),
    ),
  });
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
  version: number,
) {
  const issuedAt = Math.floor(Date.now() / 1000);

  return sign(
    {
      sub: userId,
      type,
      ver: version,
      iat: issuedAt,
      exp: issuedAt + ttlSeconds,
    } satisfies ActionTokenPayload,
    secret,
  );
}

async function verifyActionToken(token: string, secret: string, expectedType: ActionTokenType) {
  const payload = (await verify(token, secret, JWT_ALGORITHM)) as Partial<ActionTokenPayload>;

  if (
    typeof payload.sub !== 'string' ||
    payload.type !== expectedType ||
    typeof payload.ver !== 'number' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number'
  ) {
    throw new Error('Invalid action token payload.');
  }

  return payload as ActionTokenPayload;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

async function getUserById(userId: string, databaseUrl?: string) {
  const database = getDatabase(databaseUrl);

  return database.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

function assertActionTokenVersion(
  tokenPayload: ActionTokenPayload,
  user: AuthenticatedUserRow,
  errorCode: AuthServiceError['code'],
  message: string,
) {
  if (user.updatedAt.getTime() !== tokenPayload.ver) {
    throw new AuthServiceError(errorCode, message);
  }
}

async function createVerifyEmailToken(user: AuthenticatedUserRow, secret: string) {
  return signActionToken(
    user.id,
    secret,
    'verify_email',
    VERIFY_EMAIL_TTL_SECONDS,
    user.updatedAt.getTime(),
  );
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function resolveConfiguredUrl(value: string | undefined, envKey: string) {
  const configuredValue = value ?? getProcessEnv(envKey);

  return configuredValue ? trimTrailingSlash(configuredValue) : undefined;
}

function resolveBuyerAppUrl(options?: AuthFlowOptions) {
  return resolveConfiguredUrl(options?.buyerAppUrl, 'BUYER_APP_URL') ?? 'http://localhost:4301';
}

function resolveSellerAppUrl(options?: AuthFlowOptions) {
  return resolveConfiguredUrl(options?.sellerAppUrl, 'SELLER_APP_URL') ?? 'http://localhost:4303';
}

function resolveApiBaseUrl(options?: AuthFlowOptions) {
  return resolveConfiguredUrl(options?.apiBaseUrl, 'API_BASE_URL') ?? 'http://localhost:8787';
}

function buildActionUrl(baseUrl: string, path: string, token: string) {
  const url = new URL(path, `${baseUrl}/`);
  url.searchParams.set('token', token);
  return url.toString();
}

function shouldExposeDebugTokens(options?: AuthFlowOptions) {
  if (options?.exposeDebugTokens !== undefined) {
    return options.exposeDebugTokens;
  }

  const value = getProcessEnv('AUTH_EXPOSE_DEBUG_TOKENS');

  return value === '1' || value === 'true';
}

function scheduleBackgroundTask(
  options: AuthFlowOptions | undefined,
  label: string,
  taskFactory: () => Promise<void>,
) {
  const task = taskFactory().catch((error) => {
    logErrorWithContext('auth.email_delivery_failed', error, {
      operation: label,
    });
  });

  if (options?.scheduleTask) {
    options.scheduleTask(task);
    return;
  }

  void task;
}

function resolveEmailEnv(options?: AuthFlowOptions): EmailEnv | null {
  const EMAIL_API_KEY = options?.EMAIL_API_KEY ?? getProcessEnv('EMAIL_API_KEY');
  const EMAIL_FROM = options?.EMAIL_FROM ?? getProcessEnv('EMAIL_FROM');

  if (!EMAIL_API_KEY || !EMAIL_FROM) {
    return null;
  }

  return {
    EMAIL_API_KEY,
    EMAIL_FROM,
  };
}

async function sendVerificationEmail(
  user: AuthenticatedUserRow,
  token: string,
  options?: AuthFlowOptions,
) {
  const emailEnv = resolveEmailEnv(options);

  if (!emailEnv) {
    return;
  }

  const verifyUrl = buildActionUrl(resolveApiBaseUrl(options), '/auth/verify-email', token);
  const verificationEmail = buildVerificationEmail(user.fullName, verifyUrl);
  const emailService = createEmailService(emailEnv);

  await emailService.sendEmail(user.email, verificationEmail.subject, verificationEmail.html);
}

async function sendResetPasswordEmail(
  user: AuthenticatedUserRow,
  token: string,
  options?: AuthFlowOptions,
) {
  const emailEnv = resolveEmailEnv(options);

  if (!emailEnv) {
    return;
  }

  const appBaseUrl =
    user.role === 'seller' ? resolveSellerAppUrl(options) : resolveBuyerAppUrl(options);
  const resetUrl = buildActionUrl(appBaseUrl, '/reset-password', token);
  const resetPasswordEmail = buildResetPasswordEmail(user.fullName, resetUrl);
  const emailService = createEmailService(emailEnv);

  await emailService.sendEmail(user.email, resetPasswordEmail.subject, resetPasswordEmail.html);
}

export const authService = {
  async register(
    input: RegisterInput,
    secret: string,
    databaseUrl?: string,
    options?: AuthFlowOptions,
  ): Promise<AuthResult> {
    const database = getDatabase(databaseUrl);

    const existingUser = await database.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (existingUser) {
      throw new AuthServiceError('EMAIL_ALREADY_EXISTS', 'Email is already registered.');
    }

    const passwordHash = await hashPassword(input.password);

    try {
      const result = await database.transaction(async (tx) => {
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
        const verifyEmailToken = await createVerifyEmailToken(user, secret);

        await tx.insert(refreshTokens).values({
          userId: user.id,
          tokenHash: session.refreshTokenHash,
          expiresAt: session.refreshExpiresAt,
        });

        return {
          auth: {
            access_token: session.accessToken,
            refresh_token: session.refreshToken,
            user: toAuthUser(user),
          },
          user,
          verifyEmailToken,
        };
      });

      scheduleBackgroundTask(options, 'register.verify-email', () =>
        sendVerificationEmail(result.user, result.verifyEmailToken, options),
      );

      return shouldExposeDebugTokens(options)
        ? {
            ...result.auth,
            verify_email_token: result.verifyEmailToken,
          }
        : result.auth;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AuthServiceError('EMAIL_ALREADY_EXISTS', 'Email is already registered.');
      }

      throw error;
    }
  },

  async registerSeller(
    input: RegisterSellerInput,
    secret: string,
    databaseUrl?: string,
    options?: AuthFlowOptions,
  ): Promise<AuthResult> {
    const database = getDatabase(databaseUrl);

    const existingUser = await database.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (existingUser) {
      throw new AuthServiceError('EMAIL_ALREADY_EXISTS', 'Email is already registered.');
    }

    const passwordHash = await hashPassword(input.password);

    try {
      const result = await database.transaction(async (tx) => {
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
        const verifyEmailToken = await createVerifyEmailToken(user, secret);

        await tx.insert(refreshTokens).values({
          userId: user.id,
          tokenHash: session.refreshTokenHash,
          expiresAt: session.refreshExpiresAt,
        });

        return {
          auth: {
            access_token: session.accessToken,
            refresh_token: session.refreshToken,
            user: toAuthUser(user),
          },
          user,
          verifyEmailToken,
        };
      });

      scheduleBackgroundTask(options, 'register-seller.verify-email', () =>
        sendVerificationEmail(result.user, result.verifyEmailToken, options),
      );

      return shouldExposeDebugTokens(options)
        ? {
            ...result.auth,
            verify_email_token: result.verifyEmailToken,
          }
        : result.auth;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AuthServiceError('EMAIL_ALREADY_EXISTS', 'Email is already registered.');
      }

      throw error;
    }
  },

  async login(input: LoginInput, secret: string, databaseUrl?: string): Promise<AuthResult> {
    const database = getDatabase(databaseUrl);

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

  async refresh(input: RefreshInput, secret: string, databaseUrl?: string): Promise<AuthResult> {
    const database = getDatabase(databaseUrl);
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

    const matchingToken = await findRefreshTokenRecord(user.id, input.refresh_token, databaseUrl);

    if (!matchingToken) {
      throw new AuthServiceError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
    }

    return database.transaction(async (tx) => {
      const [revokedToken] = await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.id, matchingToken.id), isNull(refreshTokens.revokedAt)))
        .returning({ id: refreshTokens.id });

      if (!revokedToken) {
        throw new AuthServiceError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
      }

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

  async forgotPassword(
    input: ForgotPasswordInput,
    secret: string,
    databaseUrl?: string,
    options?: AuthFlowOptions,
  ): Promise<ForgotPasswordResult> {
    const database = getDatabase(databaseUrl);
    const user = await database.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (!user) {
      return {
        message: 'If the email is registered, reset instructions have been generated.',
      };
    }

    const resetToken = await signActionToken(
      user.id,
      secret,
      'password_reset',
      PASSWORD_RESET_TTL_SECONDS,
      user.updatedAt.getTime(),
    );

    scheduleBackgroundTask(options, 'forgot-password.reset-email', () =>
      sendResetPasswordEmail(user, resetToken, options),
    );

    return shouldExposeDebugTokens(options)
      ? {
          message: 'If the email is registered, reset instructions have been generated.',
          reset_token: resetToken,
        }
      : {
          message: 'If the email is registered, reset instructions have been generated.',
        };
  },

  async resetPassword(input: ResetPasswordInput, secret: string, databaseUrl?: string) {
    const database = getDatabase(databaseUrl);
    const payload = await verifyActionToken(input.token, secret, 'password_reset').catch(() => {
      throw new AuthServiceError('INVALID_RESET_TOKEN', 'Invalid or expired reset token.');
    });

    const user = await getUserById(payload.sub, databaseUrl);

    if (!user) {
      throw new AuthServiceError('INVALID_RESET_TOKEN', 'Invalid or expired reset token.');
    }

    assertActionTokenVersion(
      payload,
      user,
      'INVALID_RESET_TOKEN',
      'Invalid or expired reset token.',
    );

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

  async verifyEmail(token: string, secret: string, databaseUrl?: string) {
    const database = getDatabase(databaseUrl);
    const payload = await verifyActionToken(token, secret, 'verify_email').catch(() => {
      throw new AuthServiceError(
        'INVALID_VERIFY_EMAIL_TOKEN',
        'Invalid or expired verification token.',
      );
    });

    const user = await getUserById(payload.sub, databaseUrl);

    if (!user) {
      throw new AuthServiceError(
        'INVALID_VERIFY_EMAIL_TOKEN',
        'Invalid or expired verification token.',
      );
    }

    assertActionTokenVersion(
      payload,
      user,
      'INVALID_VERIFY_EMAIL_TOKEN',
      'Invalid or expired verification token.',
    );

    if (user.emailVerifiedAt) {
      return {
        message: 'Email has already been verified.',
      };
    }

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

  async logout(refreshToken: string, secret: string, databaseUrl?: string) {
    const database = getDatabase(databaseUrl);
    const payload = await verifyToken(refreshToken, secret).catch(() => {
      throw new AuthServiceError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
    });

    if (payload.type !== 'refresh') {
      throw new AuthServiceError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
    }

    const matchingToken = await findRefreshTokenRecord(payload.id, refreshToken, databaseUrl);

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

  async generateVerifyEmailToken(userId: string, secret: string, databaseUrl?: string) {
    const user = await getUserById(userId, databaseUrl);

    if (!user) {
      throw new AuthServiceError('INVALID_VERIFY_EMAIL_TOKEN', 'User not found.');
    }

    return createVerifyEmailToken(user, secret);
  },

  async generateResetPasswordToken(userId: string, secret: string, databaseUrl?: string) {
    const user = await getUserById(userId, databaseUrl);

    if (!user) {
      throw new AuthServiceError('INVALID_RESET_TOKEN', 'User not found.');
    }

    return signActionToken(
      user.id,
      secret,
      'password_reset',
      PASSWORD_RESET_TTL_SECONDS,
      user.updatedAt.getTime(),
    );
  },
};
