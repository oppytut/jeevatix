import { relations } from 'drizzle-orm';
import { index, integer, pgTable, timestamp as timestamptz, uuid } from 'drizzle-orm/pg-core';

import { reservationStatus } from './enums';
import { ticketTiers } from './tickets';
import { users } from './users';

export const reservations = pgTable(
  'reservations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    ticketTierId: uuid('ticket_tier_id')
      .notNull()
      .references(() => ticketTiers.id),
    quantity: integer('quantity').notNull(),
    status: reservationStatus('status').default('active').notNull(),
    expiresAt: timestamptz('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamptz('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_reservations_user_id').on(table.userId),
    index('idx_reservations_ticket_tier_id').on(table.ticketTierId),
    index('idx_reservations_status_expires').on(table.status, table.expiresAt),
  ],
);

export const reservationsRelations = relations(reservations, ({ one }) => ({
  user: one(users, {
    fields: [reservations.userId],
    references: [users.id],
  }),
  ticketTier: one(ticketTiers, {
    fields: [reservations.ticketTierId],
    references: [ticketTiers.id],
  }),
}));