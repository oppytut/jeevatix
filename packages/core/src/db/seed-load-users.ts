import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getDb, schema } from './index';

const currentDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(currentDir, '../../../../.env') });

const { users } = schema;
const database = getDb();

if (!database) {
  throw new Error('DATABASE_URL is required to run the load-user seed script.');
}

const DEFAULT_PASSWORD = process.env.LOAD_TEST_PASSWORD ?? 'LoadTest123!';
const DEFAULT_BATCH_SIZE = Number.parseInt(process.env.LOAD_TEST_BATCH_SIZE ?? '200', 10);

type SeedGroup = {
  label: string;
  prefix: string;
  count: number;
  fullNamePrefix: string;
};

function parseCount(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildEmail(prefix: string, index: number) {
  return `${prefix}+${index}@jeevatix.com`;
}

async function seedGroup(group: SeedGroup, passwordHash: string) {
  if (group.count === 0) {
    return { ...group, created: 0 };
  }

  let created = 0;

  for (let startIndex = 0; startIndex < group.count; startIndex += DEFAULT_BATCH_SIZE) {
    const endIndex = Math.min(startIndex + DEFAULT_BATCH_SIZE, group.count);
    const values = [];

    for (let index = startIndex; index < endIndex; index += 1) {
      values.push({
        email: buildEmail(group.prefix, index),
        passwordHash,
        fullName: `${group.fullNamePrefix} ${index}`,
        role: 'buyer' as const,
        status: 'active' as const,
        emailVerifiedAt: new Date(),
      });
    }

    const inserted = await database
      .insert(users)
      .values(values)
      .onConflictDoNothing({ target: users.email })
      .returning({ email: users.email });

    created += inserted.length;
  }

  return { ...group, created };
}

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const groups: SeedGroup[] = [
    {
      label: 'war-ticket',
      prefix: process.env.LOAD_TEST_PREFIX ?? 'loadtest',
      count: parseCount(process.env.LOAD_TEST_USER_COUNT, 1000),
      fullNamePrefix: 'Load Test User',
    },
    {
      label: 'checkout-flow',
      prefix: process.env.CHECKOUT_LOAD_TEST_PREFIX ?? 'checkout',
      count: parseCount(process.env.CHECKOUT_LOAD_TEST_USER_COUNT, 500),
      fullNamePrefix: 'Checkout Load User',
    },
  ];

  const results = [];

  for (const group of groups) {
    results.push(await seedGroup(group, passwordHash));
  }

  console.log('Load-test user seed completed.');
  console.log('Default credentials are configured in the seeder source, not emitted to logs.');

  for (const result of results) {
    console.log(
      `${result.label}: total=${result.count}, created=${result.created}, prefix=${result.prefix}`,
    );
  }
}

await main();
