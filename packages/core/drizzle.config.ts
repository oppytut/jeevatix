import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(currentDir, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to use Drizzle Kit.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/*',
  dbCredentials: {
    url: databaseUrl,
  },
});
