import { getDb, schema } from '@jeevatix/core';
import { and, asc, eq } from 'drizzle-orm';

import type { CreateTierInput, SellerTier, UpdateTierInput } from '../schemas/tier.schema';

const { events, ticketTiers } = schema;

type EventRow = typeof events.$inferSelect;
type TicketTierRow = typeof ticketTiers.$inferSelect;

export class TierServiceError extends Error {
  constructor(
    public readonly code:
      | 'DATABASE_UNAVAILABLE'
      | 'EVENT_NOT_FOUND'
      | 'FORBIDDEN'
      | 'PRICE_LOCKED'
      | 'QUOTA_BELOW_SOLD_COUNT'
      | 'TIER_HAS_SALES'
      | 'TIER_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'TierServiceError';
  }
}

function getDatabase(databaseUrl?: string) {
  const db = getDb(databaseUrl);

  if (!db) {
    throw new TierServiceError('DATABASE_UNAVAILABLE', 'Database connection is not available.');
  }

  return db;
}

function toSellerTier(tier: TicketTierRow): SellerTier {
  return {
    id: tier.id,
    event_id: tier.eventId,
    name: tier.name,
    description: tier.description ?? null,
    price: Number(tier.price),
    quota: tier.quota,
    sold_count: tier.soldCount,
    sort_order: tier.sortOrder,
    status: tier.status,
    sale_start_at: tier.saleStartAt?.toISOString() ?? null,
    sale_end_at: tier.saleEndAt?.toISOString() ?? null,
    created_at: tier.createdAt.toISOString(),
    updated_at: tier.updatedAt.toISOString(),
  };
}

async function getOwnedEventRecord(
  sellerProfileId: string,
  eventId: string,
  databaseUrl?: string,
): Promise<EventRow> {
  const database = getDatabase(databaseUrl);
  const event = await database.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) {
    throw new TierServiceError('EVENT_NOT_FOUND', 'Event not found.');
  }

  if (event.sellerProfileId !== sellerProfileId) {
    throw new TierServiceError('FORBIDDEN', 'You do not have access to this event.');
  }

  return event;
}

async function getOwnedTierRecord(
  sellerProfileId: string,
  eventId: string,
  tierId: string,
  databaseUrl?: string,
): Promise<TicketTierRow> {
  await getOwnedEventRecord(sellerProfileId, eventId, databaseUrl);

  const database = getDatabase(databaseUrl);
  const tier = await database.query.ticketTiers.findFirst({
    where: and(eq(ticketTiers.id, tierId), eq(ticketTiers.eventId, eventId)),
  });

  if (!tier) {
    throw new TierServiceError('TIER_NOT_FOUND', 'Ticket tier not found.');
  }

  return tier;
}

export const tierService = {
  async listTiers(
    sellerProfileId: string,
    eventId: string,
    databaseUrl?: string,
  ): Promise<SellerTier[]> {
    const database = getDatabase(databaseUrl);

    await getOwnedEventRecord(sellerProfileId, eventId, databaseUrl);

    const rows = await database.query.ticketTiers.findMany({
      where: eq(ticketTiers.eventId, eventId),
      orderBy: [asc(ticketTiers.sortOrder), asc(ticketTiers.createdAt)],
    });

    return rows.map(toSellerTier);
  },

  async createTier(
    sellerProfileId: string,
    eventId: string,
    input: CreateTierInput,
    databaseUrl?: string,
  ): Promise<SellerTier> {
    const database = getDatabase(databaseUrl);

    await getOwnedEventRecord(sellerProfileId, eventId, databaseUrl);

    const [createdTier] = await database
      .insert(ticketTiers)
      .values({
        eventId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        price: input.price.toString(),
        quota: input.quota,
        sortOrder: input.sort_order ?? 0,
        saleStartAt: input.sale_start_at ? new Date(input.sale_start_at) : null,
        saleEndAt: input.sale_end_at ? new Date(input.sale_end_at) : null,
      })
      .returning();

    return toSellerTier(createdTier);
  },

  async updateTier(
    sellerProfileId: string,
    eventId: string,
    tierId: string,
    input: UpdateTierInput,
    databaseUrl?: string,
  ): Promise<SellerTier> {
    const database = getDatabase(databaseUrl);
    const existingTier = await getOwnedTierRecord(sellerProfileId, eventId, tierId, databaseUrl);

    if (input.quota !== undefined && input.quota < existingTier.soldCount) {
      throw new TierServiceError(
        'QUOTA_BELOW_SOLD_COUNT',
        'Quota cannot be lower than sold_count.',
      );
    }

    if (
      existingTier.soldCount > 0 &&
      input.price !== undefined &&
      Number(existingTier.price) !== input.price
    ) {
      throw new TierServiceError(
        'PRICE_LOCKED',
        'Price cannot be changed after tickets have been sold.',
      );
    }

    const values: Partial<typeof ticketTiers.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      values.name = input.name.trim();
    }

    if (input.description !== undefined) {
      values.description = input.description?.trim() || null;
    }

    if (input.price !== undefined) {
      values.price = input.price.toString();
    }

    if (input.quota !== undefined) {
      values.quota = input.quota;
    }

    if (input.sort_order !== undefined) {
      values.sortOrder = input.sort_order;
    }

    if (input.status !== undefined) {
      values.status = input.status;
    }

    if (input.sale_start_at !== undefined) {
      values.saleStartAt = input.sale_start_at ? new Date(input.sale_start_at) : null;
    }

    if (input.sale_end_at !== undefined) {
      values.saleEndAt = input.sale_end_at ? new Date(input.sale_end_at) : null;
    }

    const [updatedTier] = await database
      .update(ticketTiers)
      .set(values)
      .where(and(eq(ticketTiers.id, tierId), eq(ticketTiers.eventId, eventId)))
      .returning();

    if (!updatedTier) {
      throw new TierServiceError('TIER_NOT_FOUND', 'Ticket tier not found.');
    }

    return toSellerTier(updatedTier);
  },

  async deleteTier(
    sellerProfileId: string,
    eventId: string,
    tierId: string,
    databaseUrl?: string,
  ) {
    const database = getDatabase(databaseUrl);
    const existingTier = await getOwnedTierRecord(sellerProfileId, eventId, tierId, databaseUrl);

    if (existingTier.soldCount > 0) {
      throw new TierServiceError(
        'TIER_HAS_SALES',
        'Ticket tier cannot be deleted after tickets have been sold.',
      );
    }

    const [deletedTier] = await database
      .delete(ticketTiers)
      .where(and(eq(ticketTiers.id, tierId), eq(ticketTiers.eventId, eventId)))
      .returning({ id: ticketTiers.id });

    if (!deletedTier) {
      throw new TierServiceError('TIER_NOT_FOUND', 'Ticket tier not found.');
    }

    return {
      message: 'Ticket tier deleted successfully.',
    };
  },
};