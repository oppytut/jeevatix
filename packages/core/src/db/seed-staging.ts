import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { and, eq } from 'drizzle-orm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(currentDir, '../../../../.env.staging') });

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
  { name: 'Seminar', slug: 'seminar', icon: 'presentation' },
  { name: 'Pameran', slug: 'pameran', icon: 'gallery-horizontal' },
  { name: 'Teater', slug: 'teater', icon: 'drama' },
] as const;

const eventSeeds = [
  {
    title: 'Jakarta Night Festival 2026',
    slug: 'jakarta-night-festival-2026',
    description:
      'Festival malam di pusat Jakarta dengan perpaduan musik live, kuliner kurasi, dan pertunjukan visual. Nikmati pengalaman festival yang tak terlupakan dengan lineup artis nasional dan internasional.',
    venueName: 'Istora Senayan',
    venueAddress: 'Jl. Pintu Satu Senayan, Gelora, Jakarta Pusat',
    venueCity: 'Jakarta',
    venueLatitude: '-6.2181000',
    venueLongitude: '106.8027000',
    startAt: new Date('2026-06-20T18:00:00+07:00'),
    endAt: new Date('2026-06-20T23:30:00+07:00'),
    saleStartAt: new Date('2026-05-01T10:00:00+07:00'),
    saleEndAt: new Date('2026-06-20T17:00:00+07:00'),
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
    title: 'Bandung Jazz Festival 2026',
    slug: 'bandung-jazz-festival-2026',
    description:
      'Festival jazz tahunan terbesar di Bandung menampilkan musisi jazz lokal dan internasional. Rasakan atmosfer jazz yang hangat di kota kembang.',
    venueName: 'Sabuga ITB',
    venueAddress: 'Jl. Ganesa No.10, Lb. Siliwangi, Coblong, Bandung',
    venueCity: 'Bandung',
    venueLatitude: '-6.8915000',
    venueLongitude: '107.6107000',
    startAt: new Date('2026-07-15T19:00:00+07:00'),
    endAt: new Date('2026-07-15T23:00:00+07:00'),
    saleStartAt: new Date('2026-05-15T10:00:00+07:00'),
    saleEndAt: new Date('2026-07-15T18:00:00+07:00'),
    bannerUrl:
      'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=1200&q=80',
    status: 'published' as const,
    maxTicketsPerOrder: 4,
    isFeatured: true,
    categorySlugs: ['musik', 'konser'] as const,
    images: [
      {
        imageUrl:
          'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
      },
    ],
    tiers: [
      {
        name: 'Festival Pass',
        description: 'Akses penuh ke semua pertunjukan jazz.',
        price: '250000.00',
        quota: 300,
        sortOrder: 0,
      },
      {
        name: 'Premium Seat',
        description: 'Tempat duduk premium dengan view terbaik.',
        price: '450000.00',
        quota: 100,
        sortOrder: 1,
      },
    ],
  },
  {
    title: 'Surabaya Marathon 2026',
    slug: 'surabaya-marathon-2026',
    description:
      'Lomba lari marathon internasional di Surabaya dengan rute scenic melewati landmark kota. Tersedia kategori 5K, 10K, Half Marathon, dan Full Marathon.',
    venueName: 'Taman Bungkul',
    venueAddress: 'Jl. Raya Darmo, Sawunggaling, Wonokromo, Surabaya',
    venueCity: 'Surabaya',
    venueLatitude: '-7.2914000',
    venueLongitude: '112.7378000',
    startAt: new Date('2026-08-02T05:00:00+07:00'),
    endAt: new Date('2026-08-02T12:00:00+07:00'),
    saleStartAt: new Date('2026-05-01T10:00:00+07:00'),
    saleEndAt: new Date('2026-07-25T23:59:00+07:00'),
    bannerUrl:
      'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=1200&q=80',
    status: 'published' as const,
    maxTicketsPerOrder: 3,
    isFeatured: false,
    categorySlugs: ['olahraga'] as const,
    images: [
      {
        imageUrl:
          'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
      },
    ],
    tiers: [
      {
        name: '5K Fun Run',
        description: 'Kategori 5 kilometer untuk pemula.',
        price: '150000.00',
        quota: 500,
        sortOrder: 0,
      },
      {
        name: '10K Run',
        description: 'Kategori 10 kilometer.',
        price: '200000.00',
        quota: 400,
        sortOrder: 1,
      },
      {
        name: 'Half Marathon',
        description: 'Kategori 21 kilometer.',
        price: '300000.00',
        quota: 200,
        sortOrder: 2,
      },
      {
        name: 'Full Marathon',
        description: 'Kategori 42 kilometer.',
        price: '400000.00',
        quota: 150,
        sortOrder: 3,
      },
    ],
  },
  {
    title: 'Digital Marketing Workshop 2026',
    slug: 'digital-marketing-workshop-2026',
    description:
      'Workshop intensif 2 hari tentang strategi digital marketing modern, SEO, social media marketing, dan content creation. Cocok untuk entrepreneur dan marketer.',
    venueName: 'The Kasablanka Hall',
    venueAddress: 'Jl. Raya Casablanca No.88, Jakarta Selatan',
    venueCity: 'Jakarta',
    venueLatitude: '-6.2234000',
    venueLongitude: '106.8421000',
    startAt: new Date('2026-06-10T09:00:00+07:00'),
    endAt: new Date('2026-06-11T17:00:00+07:00'),
    saleStartAt: new Date('2026-05-01T09:00:00+07:00'),
    saleEndAt: new Date('2026-06-09T23:00:00+07:00'),
    bannerUrl:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    status: 'published' as const,
    maxTicketsPerOrder: 4,
    isFeatured: false,
    categorySlugs: ['workshop', 'seminar'] as const,
    images: [
      {
        imageUrl:
          'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
      },
    ],
    tiers: [
      {
        name: 'General Pass',
        description: 'Akses penuh ke seluruh sesi workshop.',
        price: '450000.00',
        quota: 100,
        sortOrder: 0,
      },
      {
        name: 'Pro Pass',
        description: 'Termasuk toolkit digital dan sesi mentoring.',
        price: '750000.00',
        quota: 40,
        sortOrder: 1,
      },
    ],
  },
  {
    title: 'Yogyakarta Art Exhibition 2026',
    slug: 'yogyakarta-art-exhibition-2026',
    description:
      'Pameran seni rupa kontemporer menampilkan karya seniman lokal dan nasional. Eksplorasi berbagai medium dari lukisan, patung, hingga instalasi digital.',
    venueName: 'Jogja National Museum',
    venueAddress: 'Jl. Prof. Ki Amri Yahya No.1, Gampingan, Yogyakarta',
    venueCity: 'Yogyakarta',
    venueLatitude: '-7.8034000',
    venueLongitude: '110.3644000',
    startAt: new Date('2026-07-01T10:00:00+07:00'),
    endAt: new Date('2026-07-31T18:00:00+07:00'),
    saleStartAt: new Date('2026-05-15T10:00:00+07:00'),
    saleEndAt: new Date('2026-07-30T23:59:00+07:00'),
    bannerUrl:
      'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?auto=format&fit=crop&w=1200&q=80',
    status: 'published' as const,
    maxTicketsPerOrder: 6,
    isFeatured: false,
    categorySlugs: ['pameran'] as const,
    images: [
      {
        imageUrl:
          'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
      },
    ],
    tiers: [
      {
        name: 'Single Entry',
        description: 'Tiket masuk satu kali kunjungan.',
        price: '50000.00',
        quota: 1000,
        sortOrder: 0,
      },
      {
        name: 'Monthly Pass',
        description: 'Akses unlimited selama bulan Juli 2026.',
        price: '150000.00',
        quota: 200,
        sortOrder: 1,
      },
    ],
  },
  {
    title: 'Bali Electronic Music Festival 2026',
    slug: 'bali-electronic-music-festival-2026',
    description:
      'Festival musik elektronik terbesar di Bali dengan lineup DJ internasional. Beach party dengan sunset view yang spektakuler.',
    venueName: 'Potato Head Beach Club',
    venueAddress: 'Jl. Petitenget No.51B, Seminyak, Bali',
    venueCity: 'Bali',
    venueLatitude: '-8.6819000',
    venueLongitude: '115.1558000',
    startAt: new Date('2026-08-15T16:00:00+08:00'),
    endAt: new Date('2026-08-16T02:00:00+08:00'),
    saleStartAt: new Date('2026-05-20T10:00:00+08:00'),
    saleEndAt: new Date('2026-08-15T12:00:00+08:00'),
    bannerUrl:
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=80',
    status: 'published' as const,
    maxTicketsPerOrder: 5,
    isFeatured: true,
    categorySlugs: ['musik', 'festival'] as const,
    images: [
      {
        imageUrl:
          'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
      },
    ],
    tiers: [
      {
        name: 'Beach Access',
        description: 'Akses area beach dengan standing area.',
        price: '500000.00',
        quota: 800,
        sortOrder: 0,
      },
      {
        name: 'VIP Cabana',
        description: 'Private cabana untuk 4 orang dengan bottle service.',
        price: '3500000.00',
        quota: 30,
        sortOrder: 1,
      },
    ],
  },
  {
    title: 'Stand Up Comedy Night Jakarta',
    slug: 'stand-up-comedy-night-jakarta',
    description:
      'Malam penuh tawa bersama komedian stand up terbaik Indonesia. Special guest dari luar negeri!',
    venueName: 'Balai Sarbini',
    venueAddress: 'Jl. Sisingamangaraja, Kebayoran Baru, Jakarta Selatan',
    venueCity: 'Jakarta',
    venueLatitude: '-6.2423000',
    venueLongitude: '106.7987000',
    startAt: new Date('2026-06-25T19:30:00+07:00'),
    endAt: new Date('2026-06-25T22:00:00+07:00'),
    saleStartAt: new Date('2026-05-10T10:00:00+07:00'),
    saleEndAt: new Date('2026-06-25T18:00:00+07:00'),
    bannerUrl:
      'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=1200&q=80',
    status: 'published' as const,
    maxTicketsPerOrder: 6,
    isFeatured: false,
    categorySlugs: ['teater'] as const,
    images: [
      {
        imageUrl:
          'https://images.unsplash.com/photo-1527224857830-43a7acc85260?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
      },
    ],
    tiers: [
      {
        name: 'Regular Seat',
        description: 'Tempat duduk reguler.',
        price: '200000.00',
        quota: 400,
        sortOrder: 0,
      },
      {
        name: 'Premium Seat',
        description: 'Tempat duduk premium di barisan depan.',
        price: '350000.00',
        quota: 100,
        sortOrder: 1,
      },
    ],
  },
  {
    title: 'Tech Startup Summit 2026',
    slug: 'tech-startup-summit-2026',
    description:
      'Summit tahunan untuk startup tech di Indonesia. Networking, pitching session, dan keynote dari founder sukses.',
    venueName: 'JCC Senayan',
    venueAddress: 'Jl. Jenderal Gatot Subroto, Senayan, Jakarta Pusat',
    venueCity: 'Jakarta',
    venueLatitude: '-6.2253000',
    venueLongitude: '106.7993000',
    startAt: new Date('2026-09-10T08:00:00+07:00'),
    endAt: new Date('2026-09-11T18:00:00+07:00'),
    saleStartAt: new Date('2026-06-01T10:00:00+07:00'),
    saleEndAt: new Date('2026-09-09T23:59:00+07:00'),
    bannerUrl:
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    status: 'published' as const,
    maxTicketsPerOrder: 3,
    isFeatured: false,
    categorySlugs: ['seminar', 'workshop'] as const,
    images: [
      {
        imageUrl:
          'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
      },
    ],
    tiers: [
      {
        name: 'Startup Pass',
        description: 'Untuk founder dan team startup.',
        price: '500000.00',
        quota: 300,
        sortOrder: 0,
      },
      {
        name: 'Investor Pass',
        description: 'Akses khusus investor dengan private networking.',
        price: '1500000.00',
        quota: 50,
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
    console.log('✓ Admin user already exists');
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

  console.log('✓ Created admin user: admin@jeevatix.id');
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
    console.log(`✓ Created category: ${categorySeed.name}`);
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
    console.log('✓ Created seller user: seller@jeevatix.id');
  }

  const existingProfile = await db.query.sellerProfiles.findFirst({
    where: eq(sellerProfiles.userId, sellerUser.id),
  });

  if (existingProfile) {
    console.log('✓ Seller profile already exists');
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

  console.log('✓ Created seller profile: EventPro Indonesia');
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
      console.log(`✓ Created event: ${eventSeed.title}`);
    } else {
      console.log(`  Event already exists: ${eventSeed.title}`);
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
  console.log('🌱 Starting staging seed...\n');

  const adminUser = await ensureAdminUser();
  const categoryMap = await ensureCategories();
  const sellerProfile = await ensureSeller(adminUser.id);

  console.log('\n📅 Seeding events...');
  await ensureEvents(sellerProfile.id, categoryMap);

  console.log('\n✅ Staging seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Categories: ${categoryMap.size}`);
  console.log(`   - Events: ${eventSeeds.length}`);
  console.log(`   - Admin: admin@jeevatix.id (password: Admin123!)`);
  console.log(`   - Seller: seller@jeevatix.id (password: Seller123!)`);
}

try {
  await main();
} finally {
  await closeDb(db, { timeout: 5 });
}
