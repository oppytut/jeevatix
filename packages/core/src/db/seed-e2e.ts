import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(currentDir, '../../../../.env') });

import {
  categories,
  eventCategories,
  events,
  notifications,
  orderItems,
  orders,
  refreshTokens,
  reservations,
  sellerProfiles,
  ticketTiers,
  tickets,
  users,
} from './schema';

const { closeDb, db: importedDb } = await import('./index');

if (!importedDb) {
  throw new Error('DATABASE_URL is required to run E2E seed script.');
}

const db = importedDb;

async function seedE2EData() {
  console.log('🌱 Seeding E2E test data...');

  const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const sellerPassword = await bcrypt.hash('Seller123!', 10);

  console.log('🗑️  Cleaning existing data...');
  await db.execute(`
    TRUNCATE TABLE 
      tickets, 
      order_items, 
      payments,
      orders, 
      reservations, 
      ticket_tiers, 
      event_categories, 
      events, 
      seller_profiles, 
      notifications, 
      refresh_tokens, 
      users, 
      categories 
    CASCADE
  `);

  console.log('📂 Creating categories...');
  const categoryData = [
    { name: 'Musik', slug: 'musik', icon: 'music-4' },
    { name: 'Olahraga', slug: 'olahraga', icon: 'dumbbell' },
    { name: 'Workshop', slug: 'workshop', icon: 'graduation-cap' },
    { name: 'Konser', slug: 'konser', icon: 'mic-2' },
    { name: 'Festival', slug: 'festival', icon: 'tickets' },
  ];

  await db.insert(categories).values(categoryData);

  console.log('👤 Creating test users...');
  const [adminUser] = await db
    .insert(users)
    .values({
      email: 'admin@jeevatix.id',
      passwordHash: adminPassword,
      fullName: 'Admin Jeevatix',
      phone: '081111111111',
      role: 'admin',
      status: 'active',
      emailVerifiedAt: new Date(),
    })
    .returning();

  const [buyerUser] = await db
    .insert(users)
    .values({
      email: 'buyer@jeevatix.id',
      passwordHash: hashedPassword,
      fullName: 'Test Buyer',
      phone: '081234567890',
      role: 'buyer',
      status: 'active',
      emailVerifiedAt: new Date(),
    })
    .returning();

  const [sellerUser] = await db
    .insert(users)
    .values({
      email: 'seller@jeevatix.id',
      passwordHash: sellerPassword,
      fullName: 'Test Seller',
      phone: '081234567891',
      role: 'seller',
      status: 'active',
      emailVerifiedAt: new Date(),
    })
    .returning();

  console.log('🏢 Creating seller profile...');
  const [sellerProfile] = await db
    .insert(sellerProfiles)
    .values({
      userId: sellerUser.id,
      orgName: 'E2E Test Organizer',
      orgDescription: 'Test event organizer for E2E testing',
      isVerified: true,
      verifiedAt: new Date(),
    })
    .returning();

  console.log('🎫 Creating test event...');
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 30);
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 4);

  const [event] = await db
    .insert(events)
    .values({
      sellerProfileId: sellerProfile.id,
      title: 'E2E Test Event',
      slug: 'e2e-test-event',
      description: 'Event for E2E testing purposes',
      venueName: 'Test Venue',
      venueAddress: 'Jl. Test Venue No. 1',
      venueCity: 'Jakarta',
      startAt: startDate,
      endAt: endDate,
      saleStartAt: new Date(),
      saleEndAt: startDate,
      status: 'published',
      maxTicketsPerOrder: 5,
    })
    .returning();

  console.log('🎟️ Creating ticket tiers...');
  await db.insert(ticketTiers).values([
    {
      eventId: event.id,
      name: 'Regular',
      description: 'Regular ticket',
      price: '100000.00',
      quota: 100,
      sortOrder: 0,
    },
    {
      eventId: event.id,
      name: 'VIP',
      description: 'VIP ticket',
      price: '250000.00',
      quota: 50,
      sortOrder: 1,
    },
  ]);

  console.log('✅ E2E seed data created successfully!');
  console.log('\nTest Accounts:');
  console.log('  Admin: admin@jeevatix.id / Admin123!');
  console.log('  Buyer: buyer@jeevatix.id / TestPassword123!');
  console.log('  Seller: seller@jeevatix.id / Seller123!');
}

seedE2EData()
  .then(() => {
    console.log('\n🎉 E2E seeding complete!');
    return closeDb();
  })
  .catch((error) => {
    console.error('❌ E2E seeding failed:', error);
    process.exit(1);
  });
