import dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(currentDir, '../../../../.env') });
dotenv.config({ path: resolve(currentDir, '../../../../.env.staging') });

const { closeDb, db: importedDb } = await import('./index');

if (!importedDb) {
  throw new Error('DATABASE_URL is required to run the reset script.');
}

const db = importedDb;

async function main() {
  console.log('⚠️  Resetting staging database...\n');

  console.log('Dropping all tables (CASCADE)...');
  await db.execute(sql`DROP SCHEMA public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await db.execute(sql`GRANT ALL ON SCHEMA public TO PUBLIC`);

  console.log('✅ Database reset complete. Schema is empty.\n');
  console.log('Run seed-staging.ts next to populate with demo data.');
}

try {
  await main();
} finally {
  await closeDb(db, { timeout: 5 });
}
