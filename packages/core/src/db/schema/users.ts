import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  timestamp as timestamptz,
  uniqueIndex,
  uuid,
  varchar,
  text,
} from 'drizzle-orm/pg-core';

import { notifications } from './notifications';
import { orders } from './orders';
import { reservations } from './reservations';
import { events } from './events';
import { ticketCheckins } from './tickets';
import { userRole, userStatus } from './enums';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    avatarUrl: text('avatar_url'),
    role: userRole('role').default('buyer').notNull(),
    status: userStatus('status').default('active').notNull(),
    emailVerifiedAt: timestamptz('email_verified_at', { withTimezone: true }),
    createdAt: timestamptz('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamptz('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_users_email').on(table.email),
    index('idx_users_role').on(table.role),
  ],
);

export const sellerProfiles = pgTable(
  'seller_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    orgName: varchar('org_name', { length: 200 }).notNull(),
    orgDescription: text('org_description'),
    logoUrl: text('logo_url'),
    bankName: varchar('bank_name', { length: 100 }),
    bankAccountNumber: varchar('bank_account_number', { length: 50 }),
    bankAccountHolder: varchar('bank_account_holder', { length: 150 }),
    isVerified: boolean('is_verified').default(false).notNull(),
    verifiedAt: timestamptz('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by').references(() => users.id),
    createdAt: timestamptz('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamptz('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('idx_seller_profiles_user_id').on(table.userId)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    expiresAt: timestamptz('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamptz('revoked_at', { withTimezone: true }),
    createdAt: timestamptz('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_refresh_tokens_user_id').on(table.userId),
    uniqueIndex('idx_refresh_tokens_token_hash').on(table.tokenHash),
    index('idx_refresh_tokens_expires_at').on(table.expiresAt),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  sellerProfile: one(sellerProfiles, {
    fields: [users.id],
    references: [sellerProfiles.userId],
    relationName: 'sellerProfileUser',
  }),
  verifiedSellerProfiles: many(sellerProfiles, { relationName: 'sellerProfileVerifiedBy' }),
  refreshTokens: many(refreshTokens),
  orders: many(orders),
  reservations: many(reservations),
  notifications: many(notifications),
  sellerEvents: many(events),
  ticketCheckins: many(ticketCheckins, { relationName: 'ticketCheckinVerifiedBy' }),
}));

export const sellerProfilesRelations = relations(sellerProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [sellerProfiles.userId],
    references: [users.id],
    relationName: 'sellerProfileUser',
  }),
  verifiedByUser: one(users, {
    fields: [sellerProfiles.verifiedBy],
    references: [users.id],
    relationName: 'sellerProfileVerifiedBy',
  }),
  events: many(events),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));
