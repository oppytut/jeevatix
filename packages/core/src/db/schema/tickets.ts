import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  timestamp as timestamptz,
  uniqueIndex,
  uuid,
  varchar,
  text,
} from 'drizzle-orm/pg-core';

import { events } from './events';
import { ticketStatus, ticketTierStatus } from './enums';
import { orderItems, orders } from './orders';
import { reservations } from './reservations';
import { users } from './users';

export const ticketTiers = pgTable(
  'ticket_tiers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    quota: integer('quota').notNull(),
    soldCount: integer('sold_count').default(0).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    status: ticketTierStatus('status').default('available').notNull(),
    saleStartAt: timestamptz('sale_start_at', { withTimezone: true }),
    saleEndAt: timestamptz('sale_end_at', { withTimezone: true }),
    createdAt: timestamptz('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamptz('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_ticket_tiers_event_id').on(table.eventId),
    index('idx_ticket_tiers_status').on(table.status),
    check('ticket_tiers_sold_count_check', sql`${table.soldCount} >= 0 AND ${table.soldCount} <= ${table.quota}`),
  ],
);

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    ticketTierId: uuid('ticket_tier_id')
      .notNull()
      .references(() => ticketTiers.id),
    ticketCode: varchar('ticket_code', { length: 50 }).notNull(),
    attendeeName: varchar('attendee_name', { length: 150 }),
    attendeeEmail: varchar('attendee_email', { length: 255 }),
    status: ticketStatus('status').default('valid').notNull(),
    issuedAt: timestamptz('issued_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamptz('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_tickets_order_id').on(table.orderId),
    uniqueIndex('idx_tickets_ticket_code').on(table.ticketCode),
    index('idx_tickets_ticket_tier_id').on(table.ticketTierId),
    index('idx_tickets_status').on(table.status),
  ],
);

export const ticketCheckins = pgTable(
  'ticket_checkins',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id),
    checkedInAt: timestamptz('checked_in_at', { withTimezone: true }).defaultNow().notNull(),
    checkedInBy: uuid('checked_in_by').references(() => users.id),
  },
  (table) => [uniqueIndex('idx_ticket_checkins_ticket_id').on(table.ticketId)],
);

export const ticketTiersRelations = relations(ticketTiers, ({ one, many }) => ({
  event: one(events, {
    fields: [ticketTiers.eventId],
    references: [events.id],
  }),
  reservations: many(reservations),
  orderItems: many(orderItems),
  tickets: many(tickets),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  order: one(orders, {
    fields: [tickets.orderId],
    references: [orders.id],
  }),
  ticketTier: one(ticketTiers, {
    fields: [tickets.ticketTierId],
    references: [ticketTiers.id],
  }),
  checkin: one(ticketCheckins, {
    fields: [tickets.id],
    references: [ticketCheckins.ticketId],
  }),
}));

export const ticketCheckinsRelations = relations(ticketCheckins, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketCheckins.ticketId],
    references: [tickets.id],
  }),
  checkedInByUser: one(users, {
    fields: [ticketCheckins.checkedInBy],
    references: [users.id],
    relationName: 'ticketCheckinVerifiedBy',
  }),
}));