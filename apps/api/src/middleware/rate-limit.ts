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

type RateLimitDecision = {
  allowed: boolean;
  count: number;
  remaining: number;
  resetAt: number;
};

type DistributedRateLimitResponse = {
  ok: true;
  allowed: boolean;
  count: number;
  remaining: number;
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
const RATE_LIMITER_SHARD_COUNT = 64;

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

function hashBucketKey(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return hash >>> 0;
}

function getRateLimiterStub(namespace: DurableObjectNamespace, bucketKey: string) {
  const shard = hashBucketKey(bucketKey) % RATE_LIMITER_SHARD_COUNT;
  return namespace.get(namespace.idFromName(`rate-limit:${shard}`));
}

async function consumeDistributedRateLimit(
  namespace: DurableObjectNamespace,
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitDecision> {
  const stub = getRateLimiterStub(namespace, bucketKey);
  const response = await stub.fetch('https://rate-limiter.internal/consume', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'consume',
      bucketKey,
      limit,
      windowMs,
    }),
  });

  if (!response.ok) {
    throw new Error(`RATE_LIMITER_REQUEST_FAILED:${response.status}`);
  }

  const payload = (await response.json()) as DistributedRateLimitResponse;

  if (!payload.ok) {
    throw new Error('RATE_LIMITER_INVALID_RESPONSE');
  }

  return {
    allowed: payload.allowed,
    count: payload.count,
    remaining: payload.remaining,
    resetAt: payload.resetAt,
  };
}

function consumeInMemoryRateLimit(bucketKey: string, limit: number, windowMs: number) {
  const now = Date.now();
  cleanupExpiredRecords(now);
  const existing = rateLimitStore.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    const nextRecord = {
      count: 1,
      resetAt: now + windowMs,
    } satisfies RateLimitRecord;

    rateLimitStore.set(bucketKey, nextRecord);

    return {
      allowed: true,
      count: nextRecord.count,
      remaining: Math.max(0, limit - nextRecord.count),
      resetAt: nextRecord.resetAt,
    } satisfies RateLimitDecision;
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      count: existing.count,
      remaining: 0,
      resetAt: existing.resetAt,
    } satisfies RateLimitDecision;
  }

  existing.count += 1;
  rateLimitStore.set(bucketKey, existing);

  return {
    allowed: true,
    count: existing.count,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  } satisfies RateLimitDecision;
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
    const bucketKey = `${name}:${key}`;

    let decision: RateLimitDecision;
    let backend: 'durable_object' | 'in_memory' = 'in_memory';

    try {
      if (c.env.RATE_LIMITER) {
        const consumeStartedAt = profile.enabled ? Date.now() : 0;
        decision = await consumeDistributedRateLimit(
          c.env.RATE_LIMITER,
          bucketKey,
          limit,
          windowMs,
        );
        backend = 'durable_object';

        if (profile.enabled) {
          steps.push({
            step: 'consume_distributed_bucket',
            durationMs: Date.now() - consumeStartedAt,
          });
        }
      } else {
        const consumeStartedAt = profile.enabled ? Date.now() : 0;
        decision = consumeInMemoryRateLimit(bucketKey, limit, windowMs);

        if (profile.enabled) {
          steps.push({
            step: 'consume_in_memory_bucket',
            durationMs: Date.now() - consumeStartedAt,
          });
        }
      }
    } catch (error) {
      console.error('rate-limit: falling back to in-memory limiter', error);

      const consumeStartedAt = profile.enabled ? Date.now() : 0;
      decision = consumeInMemoryRateLimit(bucketKey, limit, windowMs);

      if (profile.enabled) {
        steps.push({
          step: 'consume_fallback_bucket',
          durationMs: Date.now() - consumeStartedAt,
        });
      }
    }

    if (!decision.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((decision.resetAt - now) / 1000));
      c.header('Retry-After', String(retryAfterSeconds));
      return c.json(
        jsonError('RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.'),
        429,
      );
    }

    await next();

    if (profile.enabled) {
      logTimedSteps(
        profile,
        'rateLimit.middleware',
        {
          name,
          path: new URL(requestUrl).pathname,
          outcome: backend,
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
