import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp as timestamptz,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { eventStatus } from './enums';
import { sellerProfiles } from './users';
import { ticketTiers } from './tickets';

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 50 }),
  createdAt: timestamptz('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('categories_name_unique').on(table.name), uniqueIndex('categories_slug_unique').on(table.slug)]);

export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sellerProfileId: uuid('seller_profile_id')
      .notNull()
      .references(() => sellerProfiles.id),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    venueName: varchar('venue_name', { length: 255 }).notNull(),
    venueAddress: text('venue_address'),
    venueCity: varchar('venue_city', { length: 100 }).notNull(),
    venueLatitude: numeric('venue_latitude', { precision: 10, scale: 7 }),
    venueLongitude: numeric('venue_longitude', { precision: 10, scale: 7 }),
    startAt: timestamptz('start_at', { withTimezone: true }).notNull(),
    endAt: timestamptz('end_at', { withTimezone: true }).notNull(),
    saleStartAt: timestamptz('sale_start_at', { withTimezone: true }).notNull(),
    saleEndAt: timestamptz('sale_end_at', { withTimezone: true }).notNull(),
    bannerUrl: text('banner_url'),
    status: eventStatus('status').default('draft').notNull(),
    maxTicketsPerOrder: integer('max_tickets_per_order').default(5).notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    createdAt: timestamptz('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamptz('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_events_slug').on(table.slug),
    index('idx_events_status').on(table.status),
    index('idx_events_seller_profile_id').on(table.sellerProfileId),
    index('idx_events_start_at').on(table.startAt),
    index('idx_events_sale_start_at').on(table.saleStartAt),
  ],
);

export const eventCategories = pgTable(
  'event_categories',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    categoryId: serial('category_id')
      .notNull()
      .references(() => categories.id),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.categoryId] })],
);

export const eventImages = pgTable(
  'event_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    imageUrl: text('image_url').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamptz('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_event_images_event_id').on(table.eventId)],
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  eventCategories: many(eventCategories),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  sellerProfile: one(sellerProfiles, {
    fields: [events.sellerProfileId],
    references: [sellerProfiles.id],
  }),
  eventCategories: many(eventCategories),
  eventImages: many(eventImages),
  ticketTiers: many(ticketTiers),
}));

export const eventCategoriesRelations = relations(eventCategories, ({ one }) => ({
  event: one(events, {
    fields: [eventCategories.eventId],
    references: [events.id],
  }),
  category: one(categories, {
    fields: [eventCategories.categoryId],
    references: [categories.id],
  }),
}));

export const eventImagesRelations = relations(eventImages, ({ one }) => ({
  event: one(events, {
    fields: [eventImages.eventId],
    references: [events.id],
  }),
}));