import { getDb, schema } from '@jeevatix/core';
import { eq, inArray, like } from 'drizzle-orm';

import app from '../index';
import { TicketReserver } from '../durable-objects/ticket-reserver';
import { generateAccessToken } from '../lib/jwt';
import { hashPassword } from '../lib/password';

const globalScope = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const processEnv = (globalScope.process ??= { env: {} }).env ?? {};

processEnv.DATABASE_URL ??= 'postgresql://jeevatix:jeevatix@localhost:5432/jeevatix';
processEnv.JWT_SECRET ??= 'vitest-phase-6-secret';
processEnv.PAYMENT_WEBHOOK_SECRET ??= 'vitest-phase-6-webhook-secret';

export const databaseUrl = processEnv.DATABASE_URL;
export const jwtSecret = processEnv.JWT_SECRET;
export const paymentWebhookSecret = processEnv.PAYMENT_WEBHOOK_SECRET;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for phase 6 tests.');
}

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required for phase 6 tests.');
}

if (!paymentWebhookSecret) {
  throw new Error('PAYMENT_WEBHOOK_SECRET is required for phase 6 tests.');
}

export const database = getDb(databaseUrl);

if (!database) {
  throw new Error('Failed to create database connection for phase 6 tests.');
}

const {
  notifications,
  orderItems,
  orders,
  payments,
  refreshTokens,
  reservations,
  sellerProfiles,
  ticketCheckins,
  tickets,
  ticketTiers,
  users,
  events,
} = schema;

type TestUserRole = 'buyer' | 'seller' | 'admin';

type JsonRequestOptions = {
  method?: string;
  token?: string;
  body?: Record<string, unknown>;
  headers?: HeadersInit;
  envOverride?: Partial<{
    JWT_SECRET: string;
    DATABASE_URL: string;
    PAYMENT_WEBHOOK_SECRET: string;
    TICKET_RESERVER: DurableObjectNamespace;
  }>;
};

type BuyerFixture = {
  user: typeof users.$inferSelect;
  token: string;
};

type SellerFixture = {
  user: typeof users.$inferSelect;
  sellerProfile: typeof sellerProfiles.$inferSelect;
  token: string;
};

type AdminFixture = {
  user: typeof users.$inferSelect;
  token: string;
};

type EventFixture = {
  event: typeof events.$inferSelect;
  tier: typeof ticketTiers.$inferSelect;
};

class TestDurableObjectNamespace {
  private readonly instances = new Map<string, TicketReserver>();

  constructor(private readonly env: { DATABASE_URL: string }) {}

  idFromName(name: string) {
    return name;
  }

  get(id: string) {
    if (!this.instances.has(id)) {
      this.instances.set(
        id,
        new TicketReserver(
          {
            async blockConcurrencyWhile<T>(closure: () => Promise<T>) {
              return closure();
            },
          },
          this.env,
        ),
      );
    }

    const instance = this.instances.get(id)!;

    return {
      fetch(input: Request | string | URL, init?: RequestInit) {
        const request =
          input instanceof Request
            ? input
            : new Request(typeof input === 'string' ? input : input.toString(), init);

        return instance.fetch(request);
      },
    };
  }

  reset() {
    this.instances.clear();
  }
}

function createEmail(prefix: string, role: TestUserRole) {
  return `${prefix}${role}-${crypto.randomUUID()}@example.com`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

async function signPaymentWebhookPayload(payload: Record<string, unknown>, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(payload)));

  return Array.from(new Uint8Array(signature), (value) => value.toString(16).padStart(2, '0')).join('');
}

export function createTransactionTestContext(prefix: string) {
  const emailPrefix = `${prefix}-`;
  const durableNamespace = new TestDurableObjectNamespace({ DATABASE_URL: databaseUrl });

  function buildEnv() {
    return {
      JWT_SECRET: jwtSecret,
      DATABASE_URL: databaseUrl,
      PAYMENT_WEBHOOK_SECRET: paymentWebhookSecret,
      TICKET_RESERVER: durableNamespace as unknown as DurableObjectNamespace,
    };
  }

  async function requestJson(path: string, options: JsonRequestOptions = {}) {
    const headers = new Headers(options.headers);

    if (options.body) {
      headers.set('Content-Type', 'application/json');
    }

    if (options.token) {
      headers.set('Authorization', `Bearer ${options.token}`);
    }

    return app.request(
      path,
      {
        method: options.method ?? 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      },
      {
        ...buildEnv(),
        ...options.envOverride,
      },
    );
  }

  async function readJson<T>(response: Response) {
    return (await response.json()) as T;
  }

  async function createUser(role: TestUserRole) {
    const [user] = await database
      .insert(users)
      .values({
        email: createEmail(emailPrefix, role),
        passwordHash: await hashPassword('TestPass123!'),
        fullName: `Vitest ${prefix} ${role}`,
        phone: '081234567890',
        role,
        status: 'active',
        emailVerifiedAt: new Date(),
      })
      .returning();

    return user;
  }

  async function createBuyerFixture(): Promise<BuyerFixture> {
    const user = await createUser('buyer');

    return {
      user,
      token: await generateAccessToken({ id: user.id, email: user.email, role: user.role }, jwtSecret),
    };
  }

  async function createSellerFixture(): Promise<SellerFixture> {
    const user = await createUser('seller');
    const [sellerProfile] = await database
      .insert(sellerProfiles)
      .values({
        userId: user.id,
        orgName: `Vitest ${prefix} Organizer ${crypto.randomUUID()}`,
        orgDescription: 'Seller fixture for phase 6 transaction tests.',
        bankName: 'Bank Test',
        bankAccountNumber: '1234567890',
        bankAccountHolder: 'Vitest Seller',
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: null,
      })
      .returning();

    return {
      user,
      sellerProfile,
      token: await generateAccessToken({ id: user.id, email: user.email, role: user.role }, jwtSecret),
    };
  }

  async function createAdminFixture(): Promise<AdminFixture> {
    const user = await createUser('admin');

    return {
      user,
      token: await generateAccessToken({ id: user.id, email: user.email, role: user.role }, jwtSecret),
    };
  }

  async function createEventFixture(input: {
    sellerProfileId: string;
    quota?: number;
    price?: number;
    soldCount?: number;
    maxTicketsPerOrder?: number;
    saleStartAt?: Date;
    saleEndAt?: Date;
    tierSaleStartAt?: Date | null;
    tierSaleEndAt?: Date | null;
  }): Promise<EventFixture> {
    const eventTitle = `Vitest ${prefix} Event ${crypto.randomUUID()}`;
    const now = Date.now();
    const startAt = new Date(now + 14 * 24 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 3 * 60 * 60 * 1000);
    const saleStartAt = input.saleStartAt ?? new Date(now - 24 * 60 * 60 * 1000);
    const saleEndAt = input.saleEndAt ?? new Date(now + 7 * 24 * 60 * 60 * 1000);

    const [event] = await database
      .insert(events)
      .values({
        sellerProfileId: input.sellerProfileId,
        title: eventTitle,
        slug: `${slugify(eventTitle)}-${crypto.randomUUID()}`,
        description: 'Published event fixture for phase 6 transaction tests.',
        venueName: 'Vitest Phase 6 Hall',
        venueAddress: 'Jl. Vitest Transaksi No. 6',
        venueCity: 'Jakarta',
        venueLatitude: '-6.2000000',
        venueLongitude: '106.8166667',
        startAt,
        endAt,
        saleStartAt,
        saleEndAt,
        bannerUrl: 'https://example.com/phase-6-banner.png',
        status: 'published',
        maxTicketsPerOrder: input.maxTicketsPerOrder ?? 5,
        isFeatured: false,
      })
      .returning();

    const [tier] = await database
      .insert(ticketTiers)
      .values({
        eventId: event.id,
        name: 'General Admission',
        description: 'Phase 6 transaction test tier.',
        price: String(input.price ?? 150000),
        quota: input.quota ?? 5,
        soldCount: input.soldCount ?? 0,
        sortOrder: 0,
        status: 'available',
        saleStartAt: input.tierSaleStartAt ?? saleStartAt,
        saleEndAt: input.tierSaleEndAt ?? saleEndAt,
      })
      .returning();

    return { event, tier };
  }

  async function getTicketTier(tierId: string) {
    return database.query.ticketTiers.findFirst({
      where: eq(ticketTiers.id, tierId),
    });
  }

  async function getReservation(reservationId: string) {
    return database.query.reservations.findFirst({
      where: eq(reservations.id, reservationId),
    });
  }

  async function getOrder(orderId: string) {
    return database.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        orderItems: true,
        payment: true,
      },
    });
  }

  async function getOrderByReservationId(reservationId: string) {
    return database.query.orders.findFirst({
      where: eq(orders.reservationId, reservationId),
      with: {
        orderItems: true,
        payment: true,
      },
    });
  }

  async function getPaymentByOrderId(orderId: string) {
    return database.query.payments.findFirst({
      where: eq(payments.orderId, orderId),
    });
  }

  async function getNotificationsForUser(userId: string) {
    return database.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: (notificationRows, { desc }) => [desc(notificationRows.createdAt)],
    });
  }

  async function expireOrder(orderId: string, expiresAt = new Date(Date.now() - 60_000)) {
    await database
      .update(orders)
      .set({
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  }

  async function signWebhook(body: Record<string, unknown>) {
    return signPaymentWebhookPayload(body, paymentWebhookSecret);
  }

  async function cleanupTestData() {
    const testUsers = await database
      .select({ id: users.id })
      .from(users)
      .where(like(users.email, `${emailPrefix}%`));

    if (testUsers.length > 0) {
      const userIds = testUsers.map((user) => user.id);

      const sellerProfileRows = await database
        .select({ id: sellerProfiles.id })
        .from(sellerProfiles)
        .where(inArray(sellerProfiles.userId, userIds));

      const sellerProfileIds = sellerProfileRows.map((sellerProfile) => sellerProfile.id);

      const eventRows =
        sellerProfileIds.length > 0
          ? await database
              .select({ id: events.id })
              .from(events)
              .where(inArray(events.sellerProfileId, sellerProfileIds))
          : [];

      const eventIds = eventRows.map((event) => event.id);

      const orderRows = await database
        .select({ id: orders.id })
        .from(orders)
        .where(inArray(orders.userId, userIds));

      const orderIds = orderRows.map((order) => order.id);

      await database.delete(notifications).where(inArray(notifications.userId, userIds));
      await database.delete(refreshTokens).where(inArray(refreshTokens.userId, userIds));

      if (orderIds.length > 0) {
        await database.delete(ticketCheckins).where(inArray(ticketCheckins.ticketId, database
          .select({ id: tickets.id })
          .from(tickets)
          .where(inArray(tickets.orderId, orderIds))));
        await database.delete(tickets).where(inArray(tickets.orderId, orderIds));
        await database.delete(payments).where(inArray(payments.orderId, orderIds));
        await database.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
        await database.delete(orders).where(inArray(orders.id, orderIds));
      }

      await database.delete(reservations).where(inArray(reservations.userId, userIds));

      if (eventIds.length > 0) {
        await database.delete(ticketTiers).where(inArray(ticketTiers.eventId, eventIds));
        await database.delete(events).where(inArray(events.id, eventIds));
      }

      if (sellerProfileIds.length > 0) {
        await database.delete(sellerProfiles).where(inArray(sellerProfiles.id, sellerProfileIds));
      }

      await database.delete(users).where(inArray(users.id, userIds));
    }

    durableNamespace.reset();
  }

  return {
    cleanupTestData,
    createAdminFixture,
    createBuyerFixture,
    createSellerFixture,
    createEventFixture,
    env: buildEnv,
    expireOrder,
    getNotificationsForUser,
    getOrder,
    getOrderByReservationId,
    getPaymentByOrderId,
    getReservation,
    getTicketTier,
    readJson,
    requestJson,
    signWebhook,
  };
}