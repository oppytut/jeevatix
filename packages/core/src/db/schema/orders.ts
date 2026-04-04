import { relations } from 'drizzle-orm';
import {
  index,
  numeric,
  pgTable,
  timestamp as timestamptz,
  uniqueIndex,
  uuid,
  varchar,
  integer,
} from 'drizzle-orm/pg-core';

import { orderStatus, paymentMethod, paymentStatus } from './enums';
import { reservations } from './reservations';
import { ticketTiers, tickets } from './tickets';
import { users } from './users';

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    reservationId: uuid('reservation_id').references(() => reservations.id),
    orderNumber: varchar('order_number', { length: 30 }).notNull(),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).notNull(),
    serviceFee: numeric('service_fee', { precision: 12, scale: 2 }).default('0').notNull(),
    status: orderStatus('status').default('pending').notNull(),
    expiresAt: timestamptz('expires_at', { withTimezone: true }).notNull(),
    confirmedAt: timestamptz('confirmed_at', { withTimezone: true }),
    createdAt: timestamptz('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamptz('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_orders_user_id').on(table.userId),
    uniqueIndex('idx_orders_order_number').on(table.orderNumber),
    index('idx_orders_status').on(table.status),
    uniqueIndex('idx_orders_reservation_id').on(table.reservationId),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    ticketTierId: uuid('ticket_tier_id')
      .notNull()
      .references(() => ticketTiers.id),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull(),
  },
  (table) => [
    index('idx_order_items_order_id').on(table.orderId),
    index('idx_order_items_ticket_tier_id').on(table.ticketTierId),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    method: paymentMethod('method').notNull(),
    status: paymentStatus('status').default('pending').notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    externalRef: varchar('external_ref', { length: 255 }),
    paidAt: timestamptz('paid_at', { withTimezone: true }),
    createdAt: timestamptz('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamptz('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_payments_order_id').on(table.orderId),
    index('idx_payments_status').on(table.status),
    index('idx_payments_external_ref').on(table.externalRef),
  ],
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  reservation: one(reservations, {
    fields: [orders.reservationId],
    references: [reservations.id],
  }),
  orderItems: many(orderItems),
  payment: one(payments, {
    fields: [orders.id],
    references: [payments.orderId],
  }),
  tickets: many(tickets),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  ticketTier: one(ticketTiers, {
    fields: [orderItems.ticketTierId],
    references: [ticketTiers.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));
