import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import postgres from 'postgres';

type Scenario = 'war-ticket' | 'checkout-flow';

function getScenario(): Scenario {
  const scenario = process.argv[2];

  if (scenario !== 'war-ticket' && scenario !== 'checkout-flow') {
    throw new Error('Usage: tsx scripts/run-load-scenario.ts <war-ticket|checkout-flow>');
  }

  return scenario;
}

function getRepoRoot() {
  return resolve(import.meta.dirname, '../../..');
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

async function validateTierState(sql: postgres.Sql, targetTier: string) {
  const rows = await sql<{
    id: string;
    quota: number;
    sold_count: number;
  }[]>`
    select id, quota, sold_count
    from ticket_tiers
    where id = ${targetTier}
    limit 1
  `;

  const tier = rows[0];

  if (!tier) {
    throw new Error(`ticket_tiers row not found for TARGET_TIER=${targetTier}`);
  }

  console.log(`[validate] Tier ${tier.id}`);
  console.log(`[validate] quota=${tier.quota}`);
  console.log(`[validate] sold_count=${tier.sold_count}`);

  if (tier.sold_count > tier.quota) {
    throw new Error(`Overselling detected: sold_count=${tier.sold_count}, quota=${tier.quota}`);
  }
}

async function validateCheckoutState(sql: postgres.Sql, targetEventSlug: string) {
  const loadCheckoutState = async () => {
    const rows = await sql<{
      slug: string;
      confirmed_orders: number;
      confirmed_tickets: number;
      issued_tickets: number;
    }[]>`
      with confirmed_totals as (
        select
          tt.event_id,
          count(distinct o.id)::int as confirmed_orders,
          coalesce(sum(oi.quantity), 0)::int as confirmed_tickets
        from ticket_tiers tt
        join order_items oi on oi.ticket_tier_id = tt.id
        join orders o on o.id = oi.order_id
        where o.status = 'confirmed'
        group by tt.event_id
      ),
      issued_totals as (
        select
          tt.event_id,
          count(t.id)::int as issued_tickets
        from ticket_tiers tt
        join tickets t on t.ticket_tier_id = tt.id
        group by tt.event_id
      )
      select
        e.slug,
        coalesce(c.confirmed_orders, 0)::int as confirmed_orders,
        coalesce(c.confirmed_tickets, 0)::int as confirmed_tickets,
        coalesce(i.issued_tickets, 0)::int as issued_tickets
      from events e
      left join confirmed_totals c on c.event_id = e.id
      left join issued_totals i on i.event_id = e.id
      where e.slug = ${targetEventSlug}
      limit 1
    `;

    return rows[0];
  };

  const deadline = Date.now() + 15_000;
  let event = await loadCheckoutState();

  while (event && event.issued_tickets < event.confirmed_tickets && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    event = await loadCheckoutState();
  }

  if (!event) {
    throw new Error(`events row not found for TARGET_EVENT_SLUG=${targetEventSlug}`);
  }

  console.log(`[validate] Event ${event.slug}`);
  console.log(`[validate] confirmed_orders=${event.confirmed_orders}`);
  console.log(`[validate] confirmed_tickets=${event.confirmed_tickets}`);
  console.log(`[validate] issued_tickets=${event.issued_tickets}`);

  if (event.issued_tickets < event.confirmed_tickets) {
    throw new Error(
      `Ticket generation mismatch: issued_tickets=${event.issued_tickets}, confirmed_tickets=${event.confirmed_tickets}`,
    );
  }
}

async function main() {
  const scenario = getScenario();
  const repoRoot = getRepoRoot();
  loadDotEnv(resolve(repoRoot, '.env'));
  const scriptPath =
    scenario === 'war-ticket'
      ? resolve(repoRoot, 'tests/load/war-ticket.js')
      : resolve(repoRoot, 'tests/load/checkout-flow.js');

  const k6Result = spawnSync('k6', ['run', scriptPath], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  const databaseUrl = process.env.DATABASE_URL;
  const targetTier = process.env.TARGET_TIER;
  const targetEventSlug = process.env.TARGET_EVENT_SLUG;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for automated load-test validation.');
  }

  if (!targetTier) {
    throw new Error('TARGET_TIER is required for automated load-test validation.');
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  let validationFailed = false;

  try {
    console.log('='.repeat(60));
    console.log(`[validate] Running post-load database checks for ${scenario}`);
    console.log('='.repeat(60));
    await validateTierState(sql, targetTier);

    if (scenario === 'checkout-flow' && targetEventSlug) {
      await validateCheckoutState(sql, targetEventSlug);
    }

    console.log('[validate] Database checks passed');
  } catch (error) {
    validationFailed = true;
    console.error(
      `[validate] ${error instanceof Error ? error.message : 'Unknown validation failure'}`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }

  const exitCode = k6Result.status ?? 1;
  process.exit(exitCode !== 0 ? exitCode : validationFailed ? 1 : 0);
}

await main();