import { inArray, like, or } from 'drizzle-orm';

import { closeDb, getDb, schema } from './index';

const database = getDb();

if (!database) {
  throw new Error('DATABASE_URL is required to clean up load-test data.');
}

const {
  eventCategories,
  eventImages,
  events,
  notifications,
  orderItems,
  orders,
  payments,
  refreshTokens,
  reservations,
  sellerProfiles,
  ticketCheckins,
  ticketTiers,
  tickets,
  users,
} = schema;

const db = database;

const dryRun = process.argv.includes('--dry-run');

function syntheticUserFilter() {
  return or(
    like(users.email, 'loadtest+%@jeevatix.com'),
    like(users.email, 'checkout+%@jeevatix.com'),
    like(users.email, 'checkoutfresh%@jeevatix.com'),
    like(users.email, 'bench-seller-%'),
    like(users.email, 'insert-prof-%'),
  );
}

function syntheticEventFilter() {
  return or(like(events.slug, 'checkout-bench-%'), like(events.slug, 'war-ticket-%'));
}

async function main() {
  const syntheticUsersQuery = db.select({ id: users.id }).from(users).where(syntheticUserFilter());
  const syntheticEventIdsQuery = db
    .select({ id: events.id })
    .from(events)
    .where(syntheticEventFilter());
  const syntheticTierIdsQuery = db
    .select({ id: ticketTiers.id })
    .from(ticketTiers)
    .where(inArray(ticketTiers.eventId, syntheticEventIdsQuery));
  const syntheticReservationsQuery = db
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      or(
        inArray(reservations.userId, syntheticUsersQuery),
        inArray(reservations.ticketTierId, syntheticTierIdsQuery),
      ),
    );
  const syntheticOrderIdsQuery = db
    .select({ id: orders.id })
    .from(orders)
    .where(
      or(
        inArray(orders.userId, syntheticUsersQuery),
        inArray(orders.reservationId, syntheticReservationsQuery),
      ),
    );
  const syntheticSellerProfileIdsQuery = db
    .select({ id: sellerProfiles.id })
    .from(sellerProfiles)
    .where(inArray(sellerProfiles.userId, syntheticUsersQuery));

  const [summary] = await Promise.all([
    Promise.all([
      db.$count(users, syntheticUserFilter()),
      db.$count(events, syntheticEventFilter()),
      db.$count(eventCategories, inArray(eventCategories.eventId, syntheticEventIdsQuery)),
      db.$count(eventImages, inArray(eventImages.eventId, syntheticEventIdsQuery)),
      db.$count(ticketTiers, inArray(ticketTiers.eventId, syntheticEventIdsQuery)),
      db.$count(
        reservations,
        or(
          inArray(reservations.userId, syntheticUsersQuery),
          inArray(reservations.ticketTierId, syntheticTierIdsQuery),
        ),
      ),
      db.$count(orders, inArray(orders.id, syntheticOrderIdsQuery)),
      db.$count(orderItems, inArray(orderItems.orderId, syntheticOrderIdsQuery)),
      db.$count(payments, inArray(payments.orderId, syntheticOrderIdsQuery)),
      db.$count(tickets, inArray(tickets.orderId, syntheticOrderIdsQuery)),
      db.$count(sellerProfiles, inArray(sellerProfiles.id, syntheticSellerProfileIdsQuery)),
    ]).then(
      ([
        userCount,
        eventCount,
        eventCategoryCount,
        eventImageCount,
        tierCount,
        reservationCount,
        orderCount,
        orderItemCount,
        paymentCount,
        ticketCount,
        sellerProfileCount,
      ]) => ({
        userCount,
        eventCount,
        eventCategoryCount,
        eventImageCount,
        tierCount,
        reservationCount,
        orderCount,
        orderItemCount,
        paymentCount,
        ticketCount,
        sellerProfileCount,
      }),
    ),
  ]);

  console.log(JSON.stringify({ dryRun, ...summary }, null, 2));

  if (dryRun) {
    return;
  }

  await db.delete(notifications).where(inArray(notifications.userId, syntheticUsersQuery));
  await db.delete(refreshTokens).where(inArray(refreshTokens.userId, syntheticUsersQuery));
  await db
    .delete(ticketCheckins)
    .where(
      inArray(
        ticketCheckins.ticketId,
        db
          .select({ id: tickets.id })
          .from(tickets)
          .where(inArray(tickets.orderId, syntheticOrderIdsQuery)),
      ),
    );
  await db.delete(tickets).where(inArray(tickets.orderId, syntheticOrderIdsQuery));
  await db.delete(payments).where(inArray(payments.orderId, syntheticOrderIdsQuery));
  await db
    .delete(orderItems)
    .where(
      or(
        inArray(orderItems.orderId, syntheticOrderIdsQuery),
        inArray(orderItems.ticketTierId, syntheticTierIdsQuery),
      ),
    );
  await db.delete(orders).where(inArray(orders.id, syntheticOrderIdsQuery));
  await db
    .delete(reservations)
    .where(
      or(
        inArray(reservations.userId, syntheticUsersQuery),
        inArray(reservations.ticketTierId, syntheticTierIdsQuery),
      ),
    );
  await db.delete(ticketTiers).where(inArray(ticketTiers.eventId, syntheticEventIdsQuery));
  await db.delete(eventImages).where(inArray(eventImages.eventId, syntheticEventIdsQuery));
  await db.delete(eventCategories).where(inArray(eventCategories.eventId, syntheticEventIdsQuery));
  await db.delete(events).where(inArray(events.id, syntheticEventIdsQuery));
  await db.delete(sellerProfiles).where(inArray(sellerProfiles.id, syntheticSellerProfileIdsQuery));
  await db.delete(users).where(syntheticUserFilter());

  console.log('Load-test synthetic data cleanup completed.');
}

try {
  await main();
} finally {
  await closeDb(db, { timeout: 5 });
}
