type MaybePromise<T> = T | Promise<T>;

type RateLimiterEnv = Record<string, never>;

type DurableObjectStorageLike = {
  get<T>(key: string): MaybePromise<T | undefined>;
  put(key: string, value: unknown): MaybePromise<void>;
  delete(key: string): MaybePromise<unknown>;
  list<T>(options?: { prefix?: string; limit?: number }): MaybePromise<Map<string, T>>;
};

type DurableObjectStateLike = {
  storage?: DurableObjectStorageLike;
  blockConcurrencyWhile<T>(closure: () => Promise<T>): Promise<T>;
};

type BucketState = {
  count: number;
  resetAt: number;
};

type ConsumeRequest = {
  action: 'consume';
  bucketKey: string;
  limit: number;
  windowMs: number;
  now?: number;
};

type ConsumeResponse = {
  ok: true;
  allowed: boolean;
  count: number;
  remaining: number;
  resetAt: number;
};

type ErrorResponse = {
  ok: false;
  error: 'BAD_REQUEST' | 'STORAGE_UNAVAILABLE';
  message: string;
};

const STORAGE_KEY_PREFIX = 'bucket:';
const CLEANUP_INTERVAL_MS = 60_000;
const CLEANUP_BATCH_SIZE = 100;

class RateLimiterBase {
  protected readonly ctx: DurableObjectStateLike;
  protected readonly env: RateLimiterEnv;

  constructor(ctx: DurableObjectStateLike, env: RateLimiterEnv) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(_request: Request) {
    return new Response(null, { status: 501 });
  }
}

const DurableObjectBase =
  (
    globalThis as typeof globalThis & {
      DurableObject?: new (ctx: DurableObjectStateLike, env: RateLimiterEnv) => RateLimiterBase;
    }
  ).DurableObject ?? RateLimiterBase;

function badRequest(message: string): Response {
  return Response.json(
    {
      ok: false,
      error: 'BAD_REQUEST',
      message,
    } satisfies ErrorResponse,
    { status: 400 },
  );
}

function storageUnavailable(): Response {
  return Response.json(
    {
      ok: false,
      error: 'STORAGE_UNAVAILABLE',
      message: 'Durable Object storage is not available.',
    } satisfies ErrorResponse,
    { status: 500 },
  );
}

function normalizeNow(rawNow?: number) {
  return Number.isFinite(rawNow) ? Number(rawNow) : Date.now();
}

function isValidConsumeRequest(payload: unknown): payload is ConsumeRequest {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Partial<ConsumeRequest>;

  return (
    candidate.action === 'consume' &&
    typeof candidate.bucketKey === 'string' &&
    candidate.bucketKey.length > 0 &&
    typeof candidate.limit === 'number' &&
    Number.isFinite(candidate.limit) &&
    candidate.limit > 0 &&
    typeof candidate.windowMs === 'number' &&
    Number.isFinite(candidate.windowMs) &&
    candidate.windowMs > 0
  );
}

export class RateLimiter extends DurableObjectBase {
  private readonly storage?: DurableObjectStorageLike;
  private lastCleanupAt = 0;

  constructor(ctx: DurableObjectStateLike, env: RateLimiterEnv) {
    super(ctx, env);
    this.storage = ctx.storage;
  }

  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return badRequest('Only POST requests are supported.');
    }

    if (!this.storage) {
      return storageUnavailable();
    }

    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      return badRequest('Request body must be valid JSON.');
    }

    if (!isValidConsumeRequest(payload)) {
      return badRequest('Invalid rate limit request payload.');
    }

    const now = normalizeNow(payload.now);

    if (now - this.lastCleanupAt >= CLEANUP_INTERVAL_MS) {
      await this.cleanupExpiredBuckets(now);
      this.lastCleanupAt = now;
    }

    return this.consume(payload.bucketKey, payload.limit, payload.windowMs, now);
  }

  private async consume(bucketKey: string, limit: number, windowMs: number, now: number) {
    if (!this.storage) {
      return storageUnavailable();
    }

    const storageKey = `${STORAGE_KEY_PREFIX}${bucketKey}`;
    const existing = await this.storage.get<BucketState>(storageKey);

    if (!existing || existing.resetAt <= now) {
      const nextState = {
        count: 1,
        resetAt: now + windowMs,
      } satisfies BucketState;

      await this.storage.put(storageKey, nextState);

      return Response.json({
        ok: true,
        allowed: true,
        count: nextState.count,
        remaining: Math.max(0, limit - nextState.count),
        resetAt: nextState.resetAt,
      } satisfies ConsumeResponse);
    }

    if (existing.count >= limit) {
      return Response.json({
        ok: true,
        allowed: false,
        count: existing.count,
        remaining: 0,
        resetAt: existing.resetAt,
      } satisfies ConsumeResponse);
    }

    const nextState = {
      count: existing.count + 1,
      resetAt: existing.resetAt,
    } satisfies BucketState;

    await this.storage.put(storageKey, nextState);

    return Response.json({
      ok: true,
      allowed: true,
      count: nextState.count,
      remaining: Math.max(0, limit - nextState.count),
      resetAt: nextState.resetAt,
    } satisfies ConsumeResponse);
  }

  private async cleanupExpiredBuckets(now: number) {
    if (!this.storage) {
      return;
    }

    const entries = await this.storage.list<BucketState>({
      prefix: STORAGE_KEY_PREFIX,
      limit: CLEANUP_BATCH_SIZE,
    });

    const deletions: Promise<unknown>[] = [];

    for (const [storageKey, state] of entries.entries()) {
      if (state.resetAt <= now) {
        deletions.push(Promise.resolve(this.storage.delete(storageKey)));
      }
    }

    await Promise.all(deletions);
  }
}
