import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { and, eq } from 'drizzle-orm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(currentDir, '../../../../.env') });

import {
  categories,
  eventCategories,
  eventImages,
  events,
  sellerProfiles,
  ticketTiers,
  users,
} from './schema';

const { closeDb, db: importedDb } = await import('./index');

if (!importedDb) {
  throw new Error('DATABASE_URL is required to run the seed script.');
}

const db = importedDb;

const categorySeeds = [
  { name: 'Musik', slug: 'musik', icon: 'music-4' },
  { name: 'Olahraga', slug: 'olahraga', icon: 'dumbbell' },
  { name: 'Workshop', slug: 'workshop', icon: 'graduation-cap' },
  { name: 'Konser', slug: 'konser', icon: 'mic-2' },
  { name: 'Festival', slug: 'festival', icon: 'tickets' },
] as const;

const eventSeeds = [
  {
    title: 'Jakarta Night Festival 2026',
    slug: 'jakarta-night-festival-2026',
    description:
      'Festival malam di pusat Jakarta dengan perpaduan musik live, kuliner kurasi, dan pertunjukan visual.',
    venueName: 'Istora Senayan',
    venueAddress: 'Jl. Pintu Satu Senayan, Gelora, Jakarta Pusat',
    venueCity: 'Jakarta',
    venueLatitude: '-6.2181000',
    venueLongitude: '106.8027000',
    startAt: new Date('2026-05-16T19:00:00+07:00'),
    endAt: new Date('2026-05-16T23:30:00+07:00'),
    saleStartAt: new Date('2026-04-01T10:00:00+07:00'),
    saleEndAt: new Date('2026-05-16T18:00:00+07:00'),
    bannerUrl:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80',
    status: 'published' as const,
    maxTicketsPerOrder: 5,
    isFeatured: true,
    categorySlugs: ['musik', 'festival', 'konser'] as const,
    images: [
      {
        imageUrl:
          'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
      },
      {
        imageUrl:
          'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 1,
      },
    ],
    tiers: [
      {
        name: 'Early Bird',
        description: 'Akses festival dengan harga peluncuran terbatas.',
        price: '175000.00',
        quota: 200,
        sortOrder: 0,
      },
      {
        name: 'Regular',
        description: 'Tiket reguler untuk menikmati seluruh area festival.',
        price: '275000.00',
        quota: 500,
        sortOrder: 1,
      },
      {
        name: 'VIP Lounge',
        description: 'Akses area lounge premium dan jalur masuk prioritas.',
        price: '650000.00',
        quota: 80,
        sortOrder: 2,
      },
    ],
  },
  {
    title: 'Creative Growth Workshop 2026',
    slug: 'creative-growth-workshop-2026',
    description:
      'Workshop intensif seharian untuk pelaku industri kreatif membangun strategi brand, produk, dan distribusi.',
    venueName: 'The Kasablanka Hall',
    venueAddress: 'Jl. Raya Casablanca No.88, Jakarta Selatan',
    venueCity: 'Jakarta',
    venueLatitude: '-6.2234000',
    venueLongitude: '106.8421000',
    startAt: new Date('2026-06-06T09:00:00+07:00'),
    endAt: new Date('2026-06-06T17:00:00+07:00'),
    saleStartAt: new Date('2026-04-10T09:00:00+07:00'),
    saleEndAt: new Date('2026-06-05T23:00:00+07:00'),
    bannerUrl:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    status: 'published' as const,
    maxTicketsPerOrder: 4,
    isFeatured: false,
    categorySlugs: ['workshop'] as const,
    images: [
      {
        imageUrl:
          'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
      },
      {
        imageUrl:
          'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 1,
      },
    ],
    tiers: [
      {
        name: 'General Pass',
        description: 'Akses penuh ke seluruh sesi workshop dan networking.',
        price: '350000.00',
        quota: 150,
        sortOrder: 0,
      },
      {
        name: 'Pro Pass',
        description: 'Termasuk template toolkit, workbook digital, dan sesi mentoring grup.',
        price: '650000.00',
        quota: 60,
        sortOrder: 1,
      },
    ],
  },
] as const;

async function ensureAdminUser() {
  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, 'admin@jeevatix.id'),
  });

  if (existingAdmin) {
    return existingAdmin;
  }

  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const [adminUser] = await db
    .insert(users)
    .values({
      email: 'admin@jeevatix.id',
      passwordHash,
      fullName: 'Jeevatix Admin',
      phone: '081234567890',
      role: 'admin',
      status: 'active',
      emailVerifiedAt: new Date(),
    })
    .returning();

  return adminUser;
}

async function ensureCategories() {
  const categoryMap = new Map<string, number>();

  for (const categorySeed of categorySeeds) {
    const existingCategory = await db.query.categories.findFirst({
      where: eq(categories.slug, categorySeed.slug),
    });

    if (existingCategory) {
      categoryMap.set(categorySeed.slug, existingCategory.id);
      continue;
    }

    const [category] = await db.insert(categories).values(categorySeed).returning();
    categoryMap.set(categorySeed.slug, category.id);
  }

  return categoryMap;
}

async function ensureSeller(adminUserId: string) {
  const existingSeller = await db.query.users.findFirst({
    where: eq(users.email, 'seller@jeevatix.id'),
  });

  let sellerUser = existingSeller;
  if (!sellerUser) {
    const passwordHash = await bcrypt.hash('Seller123!', 10);
    [sellerUser] = await db
      .insert(users)
      .values({
        email: 'seller@jeevatix.id',
        passwordHash,
        fullName: 'EventPro Indonesia',
        phone: '081298765432',
        role: 'seller',
        status: 'active',
        emailVerifiedAt: new Date(),
      })
      .returning();
  }

  const existingProfile = await db.query.sellerProfiles.findFirst({
    where: eq(sellerProfiles.userId, sellerUser.id),
  });

  if (existingProfile) {
    return existingProfile;
  }

  const [sellerProfile] = await db
    .insert(sellerProfiles)
    .values({
      userId: sellerUser.id,
      orgName: 'EventPro Indonesia',
      orgDescription:
        'Penyelenggara event musik, festival, dan experiential workshop berskala nasional.',
      logoUrl:
        'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=400&q=80',
      bankName: 'Bank Central Asia',
      bankAccountNumber: '1234567890',
      bankAccountHolder: 'PT EventPro Indonesia',
      isVerified: true,
      verifiedAt: new Date(),
      verifiedBy: adminUserId,
    })
    .returning();

  return sellerProfile;
}

async function ensureEventCategory(eventId: string, categoryId: number) {
  const existingRelation = await db.query.eventCategories.findFirst({
    where: and(eq(eventCategories.eventId, eventId), eq(eventCategories.categoryId, categoryId)),
  });

  if (!existingRelation) {
    await db.insert(eventCategories).values({ eventId, categoryId });
  }
}

async function ensureEventImage(eventId: string, imageUrl: string, sortOrder: number) {
  const existingImage = await db.query.eventImages.findFirst({
    where: and(eq(eventImages.eventId, eventId), eq(eventImages.imageUrl, imageUrl)),
  });

  if (!existingImage) {
    await db.insert(eventImages).values({ eventId, imageUrl, sortOrder });
  }
}

async function ensureTicketTier(
  eventId: string,
  tier: {
    name: string;
    description: string;
    price: string;
    quota: number;
    sortOrder: number;
  },
) {
  const existingTier = await db.query.ticketTiers.findFirst({
    where: and(eq(ticketTiers.eventId, eventId), eq(ticketTiers.name, tier.name)),
  });

  if (!existingTier) {
    await db.insert(ticketTiers).values({
      eventId,
      name: tier.name,
      description: tier.description,
      price: tier.price,
      quota: tier.quota,
      sortOrder: tier.sortOrder,
      status: 'available',
    });
  }
}

async function ensureEvents(sellerProfileId: string, categoryMap: Map<string, number>) {
  for (const eventSeed of eventSeeds) {
    let eventRecord = await db.query.events.findFirst({
      where: eq(events.slug, eventSeed.slug),
    });

    if (!eventRecord) {
      [eventRecord] = await db
        .insert(events)
        .values({
          sellerProfileId,
          title: eventSeed.title,
          slug: eventSeed.slug,
          description: eventSeed.description,
          venueName: eventSeed.venueName,
          venueAddress: eventSeed.venueAddress,
          venueCity: eventSeed.venueCity,
          venueLatitude: eventSeed.venueLatitude,
          venueLongitude: eventSeed.venueLongitude,
          startAt: eventSeed.startAt,
          endAt: eventSeed.endAt,
          saleStartAt: eventSeed.saleStartAt,
          saleEndAt: eventSeed.saleEndAt,
          bannerUrl: eventSeed.bannerUrl,
          status: eventSeed.status,
          maxTicketsPerOrder: eventSeed.maxTicketsPerOrder,
          isFeatured: eventSeed.isFeatured,
        })
        .returning();
    }

    for (const categorySlug of eventSeed.categorySlugs) {
      const categoryId = categoryMap.get(categorySlug);
      if (!categoryId) {
        throw new Error(`Category slug not found in seed map: ${categorySlug}`);
      }

      await ensureEventCategory(eventRecord.id, categoryId);
    }

    for (const image of eventSeed.images) {
      await ensureEventImage(eventRecord.id, image.imageUrl, image.sortOrder);
    }

    for (const tier of eventSeed.tiers) {
      await ensureTicketTier(eventRecord.id, tier);
    }
  }
}

async function main() {
  const adminUser = await ensureAdminUser();
  const categoryMap = await ensureCategories();
  const sellerProfile = await ensureSeller(adminUser.id);

  await ensureEvents(sellerProfile.id, categoryMap);

  console.log('Seed completed successfully.');
}

try {
  await main();
} finally {
  await closeDb(db, { timeout: 5 });
}
