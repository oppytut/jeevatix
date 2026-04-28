import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

type DatabaseClient = ReturnType<typeof postgres>;
type CloseDbOptions = {
  timeout?: number;
};

const WORKER_DB_MAX_CONNECTIONS = 1;

const globalScope = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
  __jeevatixDbCache?: Map<string, Database>;
};

export function createDb(databaseUrl: string) {
  const maxConnections = getMaxConnections();
  const client = postgres(databaseUrl, {
    max: maxConnections,
    prepare: false,
  });

  return drizzle(client, { schema });
}

export function createDbWithConfig(databaseUrl: string, maxConnections: number) {
  const client = postgres(databaseUrl, {
    max: maxConnections,
    prepare: false,
  });

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

function getDbClient(database: Database) {
  return (database as Database & { $client: DatabaseClient }).$client;
}

function getDbCache() {
  if (!globalScope.__jeevatixDbCache) {
    globalScope.__jeevatixDbCache = new Map<string, Database>();
  }

  return globalScope.__jeevatixDbCache;
}

function getLocalDatabaseUrl() {
  return globalScope.process?.env?.DATABASE_URL;
}

function shouldDisableDbCache() {
  return globalScope.process?.env?.DB_DISABLE_CACHE === '1';
}

function getMaxConnections() {
  const rawValue = globalScope.process?.env?.DB_MAX_CONNECTIONS;
  const parsedValue = Number.parseInt(rawValue ?? '', 10);

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return 20;
}

function resolveMaxConnections(maxConnections?: number) {
  if (typeof maxConnections === 'number' && Number.isFinite(maxConnections) && maxConnections > 0) {
    return Math.trunc(maxConnections);
  }

  if (shouldDisableDbCache()) {
    return WORKER_DB_MAX_CONNECTIONS;
  }

  return getMaxConnections();
}

function buildCloseOptions(options?: CloseDbOptions) {
  if (
    typeof options?.timeout === 'number' &&
    Number.isFinite(options.timeout) &&
    options.timeout >= 0
  ) {
    return { timeout: options.timeout };
  }

  return undefined;
}

function removeDbFromCache(database: Database) {
  const cache = getDbCache();

  for (const [cacheKey, cachedDb] of cache.entries()) {
    if (cachedDb === database) {
      cache.delete(cacheKey);
    }
  }
}

export function getDb(databaseUrl?: string, maxConnections?: number) {
  const resolvedDatabaseUrl = databaseUrl ?? getLocalDatabaseUrl();

  if (!resolvedDatabaseUrl) {
    return null;
  }

  const resolvedMaxConnections = resolveMaxConnections(maxConnections);

  if (shouldDisableDbCache()) {
    return createDbWithConfig(resolvedDatabaseUrl, resolvedMaxConnections);
  }

  const cache = getDbCache();
  const cacheKey = `${resolvedDatabaseUrl}::max=${resolvedMaxConnections}`;
  const cachedDb = cache.get(cacheKey);

  if (cachedDb) {
    return cachedDb;
  }

  const db = createDbWithConfig(resolvedDatabaseUrl, resolvedMaxConnections);
  cache.set(cacheKey, db);

  return db;
}

export async function closeDb(database?: Database | null, options?: CloseDbOptions) {
  if (!database) {
    return;
  }

  removeDbFromCache(database);
  await getDbClient(database).end(buildCloseOptions(options));
}

export async function closeAllDbs(options?: CloseDbOptions) {
  const cache = getDbCache();
  const databases = Array.from(new Set(cache.values()));

  cache.clear();

  await Promise.all(
    databases.map(async (database) => getDbClient(database).end(buildCloseOptions(options))),
  );
}

export const db = getDb();

export { schema };
