import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';

import {
  getReservationLoadTestProfile,
  logTimedSteps,
  type TimedStep,
} from '../lib/load-test-profile';
import type { AuthEnv } from './auth';

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

type RateLimitConfig = {
  name: string;
  limit: number;
  windowMs: number;
  methods?: string[];
  keyGenerator: (context: Context<AuthEnv>) => string | null | Promise<string | null>;
};

const rateLimitStore = new Map<string, RateLimitRecord>();

function cleanupExpiredRecords(now: number) {
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
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

export function getClientIp(headers: Headers) {
  const cfConnectingIp = headers.get('cf-connecting-ip')?.trim();

  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const forwardedFor = headers.get('x-forwarded-for');

  if (!forwardedFor) {
    return null;
  }

  const [firstIp] = forwardedFor.split(',');
  return firstIp?.trim() || null;
}

export function createRateLimitMiddleware({
  name,
  limit,
  windowMs,
  methods,
  keyGenerator,
}: RateLimitConfig) {
  const normalizedMethods = methods?.map((method) => method.toUpperCase());

  return createMiddleware<AuthEnv>(async (c, next) => {
    if (normalizedMethods && !normalizedMethods.includes(c.req.method.toUpperCase())) {
      await next();
      return;
    }

    const requestUrl = c.req.raw.url;
    const profile =
      c.var.loadTestProfile ?? getReservationLoadTestProfile(requestUrl, c.req.raw.headers);
    const startedAt = profile.enabled ? Date.now() : 0;
    const steps: TimedStep[] = [];

    const keyStartedAt = profile.enabled ? Date.now() : 0;
    const key = await keyGenerator(c);

    if (profile.enabled) {
      steps.push({
        step: 'key_generator',
        durationMs: Date.now() - keyStartedAt,
      });
    }

    if (!key) {
      await next();
      return;
    }

    const now = Date.now();

    const cleanupStartedAt = profile.enabled ? Date.now() : 0;
    cleanupExpiredRecords(now);

    if (profile.enabled) {
      steps.push({
        step: 'cleanup_expired_records',
        durationMs: Date.now() - cleanupStartedAt,
      });
    }

    const bucketKey = `${name}:${key}`;
    const existing = rateLimitStore.get(bucketKey);

    if (!existing || existing.resetAt <= now) {
      rateLimitStore.set(bucketKey, {
        count: 1,
        resetAt: now + windowMs,
      });
      await next();

      if (profile.enabled) {
        logTimedSteps(
          profile,
          'rateLimit.middleware',
          {
            name,
            path: new URL(requestUrl).pathname,
            outcome: 'new_bucket',
            totalDurationMs: Date.now() - startedAt,
          },
          steps,
        );
      }
      return;
    }

    if (existing.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      c.header('Retry-After', String(retryAfterSeconds));
      return c.json(
        jsonError('RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.'),
        429,
      );
    }

    existing.count += 1;
    rateLimitStore.set(bucketKey, existing);
    await next();

    if (profile.enabled) {
      logTimedSteps(
        profile,
        'rateLimit.middleware',
        {
          name,
          path: new URL(requestUrl).pathname,
          outcome: 'incremented',
          totalDurationMs: Date.now() - startedAt,
        },
        steps,
      );
    }
  });
}

export function resetRateLimitState() {
  rateLimitStore.clear();
}
