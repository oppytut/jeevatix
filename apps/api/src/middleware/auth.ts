import { createMiddleware } from 'hono/factory';

import {
  getReservationLoadTestProfile,
  logTimedSteps,
  type LoadTestProfile,
  type TimedStep,
} from '../lib/load-test-profile';
import { verifyToken, type TokenPayload, type UserRole } from '../lib/jwt';

type AuthBindings = {
  APP_ENVIRONMENT?: string;
  APP_VERSION?: string;
  JWT_SECRET: string;
  DATABASE_URL?: string;
  PARTYKIT_HOST?: string;
  PARTY_SECRET?: string;
  TICKET_RESERVER: DurableObjectNamespace;
  RATE_LIMITER?: DurableObjectNamespace;
  BUCKET: R2Bucket;
  UPLOAD_PUBLIC_URL?: string;
  PAYMENT_WEBHOOK_SECRET?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  BUYER_APP_URL?: string;
  SELLER_APP_URL?: string;
  CORS_ALLOWED_ORIGINS?: string;
  AUTH_EXPOSE_DEBUG_TOKENS?: string;
};

export type AuthUser = Pick<TokenPayload, 'id' | 'email' | 'role'>;

export type AuthEnv = {
  Bindings: AuthBindings;
  Variables: {
    errorLogged?: boolean;
    requestId: string;
    user: AuthUser;
    loadTestProfile?: LoadTestProfile;
  };
};

type CachedTokenVerification = {
  payload: TokenPayload;
  expiresAtMs: number;
};

const DEFAULT_AUTH_TOKEN_CACHE_MAX_ENTRIES = 5_000;
const tokenVerificationCache = new Map<string, CachedTokenVerification>();
let resolvedAuthTokenCacheMaxEntries: number | undefined;

function getProcessEnv(key: string) {
  return (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[key];
}

function getJwtSecret(envSecret?: string) {
  return envSecret || getProcessEnv('JWT_SECRET');
}

function getAuthTokenCacheMaxEntries() {
  if (resolvedAuthTokenCacheMaxEntries !== undefined) {
    return resolvedAuthTokenCacheMaxEntries;
  }

  const parsedValue = Number.parseInt(getProcessEnv('AUTH_TOKEN_CACHE_MAX_ENTRIES') ?? '', 10);

  if (Number.isFinite(parsedValue) && parsedValue >= 0) {
    resolvedAuthTokenCacheMaxEntries = Math.trunc(parsedValue);
    return resolvedAuthTokenCacheMaxEntries;
  }

  resolvedAuthTokenCacheMaxEntries = DEFAULT_AUTH_TOKEN_CACHE_MAX_ENTRIES;
  return resolvedAuthTokenCacheMaxEntries;
}

function buildTokenCacheKey(secret: string, token: string) {
  return `${secret}\n${token}`;
}

function pruneTokenVerificationCache(maxEntries: number) {
  while (tokenVerificationCache.size > maxEntries) {
    const oldestCacheKey = tokenVerificationCache.keys().next().value;

    if (!oldestCacheKey) {
      return;
    }

    tokenVerificationCache.delete(oldestCacheKey);
  }
}

function getCachedTokenPayload(cacheKey: string, nowMs: number) {
  const cachedVerification = tokenVerificationCache.get(cacheKey);

  if (!cachedVerification) {
    return undefined;
  }

  if (cachedVerification.expiresAtMs <= nowMs) {
    tokenVerificationCache.delete(cacheKey);
    return undefined;
  }

  // Promote recently used tokens to keep hot entries in cache.
  tokenVerificationCache.delete(cacheKey);
  tokenVerificationCache.set(cacheKey, cachedVerification);
  return cachedVerification.payload;
}

function cacheTokenPayload(cacheKey: string, payload: TokenPayload, maxEntries: number) {
  if (maxEntries === 0) {
    return;
  }

  const expiresAtMs = payload.exp * 1_000;

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return;
  }

  tokenVerificationCache.set(cacheKey, {
    payload,
    expiresAtMs,
  });
  pruneTokenVerificationCache(maxEntries);
}

async function verifyTokenWithCache(token: string, secret: string) {
  const maxEntries = getAuthTokenCacheMaxEntries();

  if (maxEntries === 0) {
    return {
      payload: await verifyToken(token, secret),
      cacheHit: false,
    } as const;
  }

  const cacheKey = buildTokenCacheKey(secret, token);
  const cachedPayload = getCachedTokenPayload(cacheKey, Date.now());

  if (cachedPayload) {
    return {
      payload: cachedPayload,
      cacheHit: true,
    } as const;
  }

  const payload = await verifyToken(token, secret);
  cacheTokenPayload(cacheKey, payload, maxEntries);

  return {
    payload,
    cacheHit: false,
  } as const;
}

function jsonError(code: string, message: string) {
  return {
    success: false as const,
    error: {
      code,
      message,
    },
  };
}

function extractBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const requestUrl = c.req.raw.url;
  const profile = getReservationLoadTestProfile(requestUrl, c.req.raw.headers);
  c.set('loadTestProfile', profile);
  const startedAt = profile.enabled ? Date.now() : 0;
  const steps: TimedStep[] = [];
  const token = extractBearerToken(c.req.header('Authorization'));

  if (!token) {
    return c.json(jsonError('UNAUTHORIZED', 'Missing or invalid bearer token.'), 401);
  }

  const secret = getJwtSecret(c.env.JWT_SECRET);

  if (!secret) {
    return c.json(jsonError('JWT_SECRET_MISSING', 'JWT secret is not configured.'), 500);
  }

  try {
    const verifyTokenStartedAt = profile.enabled ? Date.now() : 0;
    const { payload, cacheHit } = await verifyTokenWithCache(token, secret);

    if (profile.enabled) {
      steps.push({
        step: cacheHit ? 'verify_token_cache_hit' : 'verify_token_signature',
        durationMs: Date.now() - verifyTokenStartedAt,
      });
    }

    if (payload.type !== 'access') {
      return c.json(jsonError('INVALID_TOKEN_TYPE', 'Access token is required.'), 401);
    }

    c.set('user', {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    });

    await next();

    if (profile.enabled) {
      logTimedSteps(
        profile,
        'auth.middleware',
        {
          path: new URL(requestUrl).pathname,
          outcome: 'success',
          totalDurationMs: Date.now() - startedAt,
        },
        steps,
      );
    }
  } catch {
    return c.json(jsonError('UNAUTHORIZED', 'Invalid or expired token.'), 401);
  }
});

export function roleMiddleware(...roles: UserRole[]) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.var.user;

    if (!user) {
      return c.json(jsonError('UNAUTHORIZED', 'Authentication is required.'), 401);
    }

    if (!roles.includes(user.role)) {
      return c.json(jsonError('FORBIDDEN', 'You do not have access to this resource.'), 403);
    }

    await next();
  });
}
