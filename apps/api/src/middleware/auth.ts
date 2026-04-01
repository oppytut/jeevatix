import { createMiddleware } from 'hono/factory';

import { verifyToken, type TokenPayload, type UserRole } from '../lib/jwt';

type AuthBindings = {
  JWT_SECRET: string;
  DATABASE_URL?: string;
  TICKET_RESERVER: DurableObjectNamespace;
  BUCKET: R2Bucket;
  UPLOAD_PUBLIC_URL?: string;
};

export type AuthUser = Pick<TokenPayload, 'id' | 'email' | 'role'>;

export type AuthEnv = {
  Bindings: AuthBindings;
  Variables: {
    user: AuthUser;
  };
};

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
  const token = extractBearerToken(c.req.header('Authorization'));

  if (!token) {
    return c.json(jsonError('UNAUTHORIZED', 'Missing or invalid bearer token.'), 401);
  }

  const secret = getJwtSecret(c.env.JWT_SECRET);

  if (!secret) {
    return c.json(jsonError('JWT_SECRET_MISSING', 'JWT secret is not configured.'), 500);
  }

  try {
    const payload = await verifyToken(token, secret);

    if (payload.type !== 'access') {
      return c.json(jsonError('INVALID_TOKEN_TYPE', 'Access token is required.'), 401);
    }

    c.set('user', {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    });

    await next();
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
