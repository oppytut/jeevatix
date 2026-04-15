import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const currentDir = dirname(fileURLToPath(import.meta.url));

function getRepoRoot() {
  return resolve(currentDir, '../../..');
}

function loadDotEnv(envFilePath: string) {
  const fileContents = readFileSync(envFilePath, 'utf8');

  for (const line of fileContents.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const normalizedValue = rawValue.replace(/^['"]|['"]$/gu, '');
    process.env[key] = normalizedValue;
  }
}

async function main() {
  loadDotEnv(resolve(getRepoRoot(), '.env'));

  const databaseUrl = process.env.DATABASE_URL;
  const benchmarkSellerEmail = 'bench-seller-checkout@jeevatix.com';

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to create a checkout benchmark target.');
  }

  const sql = postgres(databaseUrl, { max: 1, prepare: false });

  try {
    const [existingBenchmarkUser] = await sql<{ id: string }[]>`
      select id
      from users
      where email = ${benchmarkSellerEmail}
      limit 1
    `;

    const [existingBenchmarkSeller] = await sql<{ id: string }[]>`
      select seller_profiles.id
      from seller_profiles
      inner join users on users.id = seller_profiles.user_id
      where users.email = ${benchmarkSellerEmail}
      limit 1
    `;

    let sellerProfile = existingBenchmarkSeller;

    if (!sellerProfile) {
      const benchmarkUser = existingBenchmarkUser
        ? existingBenchmarkUser
        : (
            await sql<{ id: string }[]>`
              insert into users (
                email,
                password_hash,
                full_name,
                role,
                status,
                email_verified_at
              )
              values (
                ${benchmarkSellerEmail},
                ${'load-test-only'},
                ${'Checkout Benchmark Seller'},
                ${'seller'},
                ${'active'},
                now()
              )
              returning id
            `
          )[0];

      const [createdSellerProfile] = await sql<{ id: string }[]>`
        insert into seller_profiles (
          user_id,
          org_name,
          org_description,
          is_verified,
          verified_at
        )
        values (
          ${benchmarkUser.id},
          ${'Checkout Benchmark Organizer'},
          ${'Synthetic seller profile for local checkout benchmarks'},
          ${true},
          now()
        )
        returning id
      `;

      sellerProfile = createdSellerProfile;
    }

    if (!sellerProfile) {
      throw new Error('Failed to resolve a seller_profile for the checkout benchmark event.');
    }

    const now = Date.now();
    const slug = `checkout-bench-${now}`;
    const startAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 3 * 60 * 60 * 1000);
    const saleStartAt = new Date(now - 60 * 60 * 1000);
    const saleEndAt = new Date(startAt.getTime() - 30 * 60 * 1000);

    const [eventRow] = await sql<{ id: string; slug: string }[]>`
      insert into events (
        seller_profile_id,
        title,
        slug,
        description,
        venue_name,
        venue_address,
        venue_city,
        start_at,
        end_at,
        sale_start_at,
        sale_end_at,
        banner_url,
        status,
        max_tickets_per_order,
        is_featured
      )
      values (
        ${sellerProfile.id},
        ${`Checkout Bench ${now}`},
        ${slug},
        ${'Synthetic checkout benchmark event'},
        ${'Load Test Hall'},
        ${'Jl. Benchmark No. 1'},
        ${'Jakarta'},
        ${startAt.toISOString()},
        ${endAt.toISOString()},
        ${saleStartAt.toISOString()},
        ${saleEndAt.toISOString()},
        ${'https://example.com/checkout-bench-banner.jpg'},
        ${'published'},
        ${5},
        ${false}
      )
      returning id, slug
    `;

    const [tierRow] = await sql<{ id: string }[]>`
      insert into ticket_tiers (
        event_id,
        name,
        description,
        price,
        quota,
        sold_count,
        sort_order,
        status,
        sale_start_at,
        sale_end_at
      )
      values (
        ${eventRow.id},
        ${'Benchmark General Admission'},
        ${'Synthetic tier for 500-user checkout benchmark'},
        ${'150000.00'},
        ${1000},
        ${0},
        ${0},
        ${'available'},
        ${saleStartAt.toISOString()},
        ${saleEndAt.toISOString()}
      )
      returning id
    `;

    console.log(
      JSON.stringify({
        targetEventSlug: eventRow.slug,
        targetTier: tierRow.id,
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await main();
