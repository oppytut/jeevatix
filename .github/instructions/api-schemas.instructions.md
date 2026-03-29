---
description: "Use when creating or editing Zod validation schemas in apps/api/src/schemas/. Covers @hono/zod-openapi patterns: z import, .openapi() metadata, type inference."
applyTo: "apps/api/src/schemas/**"
---
# Schema / DTO Pattern

Schema files define **Zod validation schemas** that double as OpenAPI spec and TypeScript types.

## Required Pattern

```typescript
// WAJIB: import z dari @hono/zod-openapi (BUKAN dari 'zod')
import { z } from '@hono/zod-openapi';

// Input schema (request body)
export const createEventSchema = z
  .object({
    title: z.string().min(1).max(200).openapi({ example: 'Music Festival 2026' }),
    description: z.string().optional(),
    venue: z.string().min(1),
    eventDate: z.string().datetime(),
    categoryIds: z.array(z.string().uuid()).min(1),
  })
  .openapi('CreateEventInput');

// Output schema (response)
export const eventResponseSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    status: z.enum(['draft', 'pending_review', 'published', 'cancelled', 'completed']),
    createdAt: z.string().datetime(),
  })
  .openapi('EventResponse');

// Query schema (pagination + filters)
export const eventQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['draft', 'published']).optional(),
    search: z.string().optional(),
  })
  .openapi('EventQuery');

// Export inferred types untuk dipakai di service
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type EventResponse = z.infer<typeof eventResponseSchema>;
export type EventQuery = z.infer<typeof eventQuerySchema>;
```

## Rules

- WAJIB import `z` dari `@hono/zod-openapi` — BUKAN dari `zod` langsung.
- SETIAP schema harus diberi `.openapi('SchemaName')` untuk OpenAPI spec generation.
- Field penting diberi `.openapi({ example: '...' })` untuk dokumentasi yang baik.
- Export `z.infer<typeof schema>` types untuk dipakai di service layer.
- Ikuti exact kolom dan tipe dari DATABASE_DESIGN.md. Jangan mengarang field.
- Untuk enum values, gunakan persis dari DATABASE_DESIGN.md.
