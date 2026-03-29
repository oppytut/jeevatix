---
description: "Use when creating or editing business logic services in apps/api/src/services/. Covers service layer patterns: DB queries with Drizzle, no HTTP context, typed returns."
applyTo: "apps/api/src/services/**"
---
# Service Layer Pattern

Service files contain **all business logic and DB queries**. They are testable without HTTP context.

## Required Pattern

```typescript
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@jeevatix/core';
import { users, events } from '@jeevatix/core/schema';
import type { CreateEventInput } from '../schemas/event.schema';

export const eventService = {
  async create(sellerId: string, input: CreateEventInput) {
    const [event] = await db
      .insert(events)
      .values({ ...input, sellerId })
      .returning();
    return event;
  },

  async getById(id: string) {
    return db.query.events.findFirst({
      where: eq(events.id, id),
      with: { ticketTiers: true, seller: true },
    });
  },

  async list(query: { page: number; limit: number; status?: string }) {
    const { page, limit, status } = query;
    const offset = (page - 1) * limit;
    // ... query with filters, pagination
  },
};
```

## Rules

- JANGAN import Hono context (`c`) atau HTTP-related types.
- JANGAN throw HTTP errors — return `null`/`undefined` dan biarkan route handle 404/403.
- SELALU gunakan Drizzle ORM untuk DB queries (parameterized, no raw SQL string concatenation).
- SELALU return typed data — biarkan route wrap dalam `{ success, data }`.
- Untuk operasi `sold_count` pada `ticket_tiers`: JANGAN update langsung — gunakan Durable Object.
- Pagination: offset-based, default limit 20, max 100.
- Ikuti DATABASE_DESIGN.md untuk kolom dan relasi. Jangan mengarang field.
