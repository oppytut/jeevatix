import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

const localDatabaseUrl =
	typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined;

export function createDb(databaseUrl: string) {
	const client = postgres(databaseUrl, {
		prepare: false,
	});

	return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

export const db = localDatabaseUrl ? createDb(localDatabaseUrl) : null;

export { schema };
