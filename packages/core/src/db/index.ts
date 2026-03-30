import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

const globalScope = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    prepare: false,
  });

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

function getLocalDatabaseUrl() {
  return globalScope.process?.env?.DATABASE_URL;
}

export function getDb(databaseUrl?: string) {
  const resolvedDatabaseUrl = databaseUrl ?? getLocalDatabaseUrl();

  if (!resolvedDatabaseUrl) {
    return null;
  }

  return createDb(resolvedDatabaseUrl);
}

export const db = getDb();

export { schema };
