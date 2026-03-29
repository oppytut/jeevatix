---
description: "Use when creating or editing Drizzle ORM schemas in packages/core/src/db/. Covers pgTable, pgEnum, relations, indexes, and constraints following DATABASE_DESIGN.md exactly."
applyTo: "packages/core/src/db/**"
---
# Drizzle ORM Schema Pattern

## Required Pattern

```typescript
import { pgTable, uuid, varchar, text, boolean, integer, numeric, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { userRole, userStatus } from './enums';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  role: userRole('role').default('buyer').notNull(),
  status: userStatus('status').default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
}));

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  notifications: many(notifications),
}));
```

## Rules

- Ikuti DATABASE_DESIGN.md **PERSIS** — kolom, tipe, constraint, index. JANGAN mengarang field.
- Enum: import dari `./enums.ts` yang menggunakan `pgEnum()`.
- Relations: definisikan `relations()` untuk setiap tabel (Drizzle relational query builder).
- File grouping per domain: `users.ts`, `events.ts`, `tickets.ts`, `orders.ts`, `reservations.ts`, `notifications.ts`.
- `index.ts`: re-export semua schema + enums.
- CHECK constraint pada `ticket_tiers`: `sold_count >= 0 AND sold_count <= quota`.
