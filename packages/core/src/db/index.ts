import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

const globalScope = globalThis as typeof globalThis & {
	__jeevatixDbCache?: Map<string, Database>;
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

function getDbCache() {
	if (!globalScope.__jeevatixDbCache) {
		globalScope.__jeevatixDbCache = new Map<string, Database>();
	}

	return globalScope.__jeevatixDbCache;
}

function getLocalDatabaseUrl() {
	return globalScope.process?.env?.DATABASE_URL;
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

	const database = createDb(resolvedDatabaseUrl);
	cache.set(resolvedDatabaseUrl, database);

	return database;
	}

export const db = getDb();

export { schema };
