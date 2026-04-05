import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

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

export type Database = ReturnType<typeof createDb>;

function getDbCache() {
  if (!globalScope.__jeevatixDbCache) {
    globalScope.__jeevatixDbCache = new Map<string, Database>();
  }

  return globalScope.__jeevatixDbCache;
}

function getLocalDatabaseUrl() {
  return globalScope.process?.env?.DATABASE_URL;
}

function getMaxConnections() {
  const rawValue = globalScope.process?.env?.DB_MAX_CONNECTIONS;
  const parsedValue = Number.parseInt(rawValue ?? '', 10);

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return 20;
}

export function getDb(databaseUrl?: string) {
  const resolvedDatabaseUrl = databaseUrl ?? getLocalDatabaseUrl();

  if (!resolvedDatabaseUrl) {
    return null;
  }

  const cache = getDbCache();
  const cachedDb = cache.get(resolvedDatabaseUrl);

  if (cachedDb) {
    return cachedDb;
  }

  const db = createDb(resolvedDatabaseUrl);
  cache.set(resolvedDatabaseUrl, db);

  return db;
}

export const db = getDb();

export { schema };
