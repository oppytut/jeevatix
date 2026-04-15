import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';

import type { AuthEnv } from './auth';

const localAllowedOrigins = [
  'http://localhost:4301',
  'http://localhost:4302',
  'http://localhost:4303',
];

function getProcessEnv(key: string) {
  return (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[key];
}

export function resolveAllowedOrigins(rawOrigins?: string) {
  if (!rawOrigins) {
    return localAllowedOrigins;
  }

  const parsedOrigins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return parsedOrigins.length > 0 ? parsedOrigins : localAllowedOrigins;
}

export const corsMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const allowedOrigins = resolveAllowedOrigins(
    c.env.CORS_ALLOWED_ORIGINS || getProcessEnv('CORS_ALLOWED_ORIGINS'),
  );

  return cors({
    origin: (origin) => {
      if (!origin) {
        return undefined;
      }

      return allowedOrigins.includes(origin) ? origin : undefined;
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })(c, next);
});
