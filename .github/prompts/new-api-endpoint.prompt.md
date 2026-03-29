---
description: "Generate a new API endpoint following Jeevatix 3-layer architecture + OpenAPI pattern. Creates route, service, and schema files."
agent: "agent"
argument-hint: "Describe the endpoint: method, path, domain (e.g., POST /seller/events - create event)"
---
Generate a new API endpoint for the Jeevatix project following the 3-layer architecture + OpenAPI contract pattern.

## Steps

1. **Read context**: Baca `DATABASE_DESIGN.md` (tabel & kolom terkait) dan `PAGES.md` (endpoint spec) untuk memahami domain.

2. **Create Schema** (`apps/api/src/schemas/<domain>.schema.ts`):
   - Import `z` dari `@hono/zod-openapi` (BUKAN dari `zod`).
   - Definisikan input schema (request body/query/params) + output schema (response).
   - Setiap schema diberi `.openapi('SchemaName')`.
   - Export `z.infer<typeof schema>` types.

3. **Create Service** (`apps/api/src/services/<domain>.service.ts`):
   - Semua business logic + DB queries menggunakan Drizzle ORM.
   - Tidak boleh import Hono context atau HTTP-related types.
   - Return typed data, biarkan route handle response wrapping.

4. **Create Route** (`apps/api/src/routes/<domain>.ts`):
   - `createRoute({ method, path, tags, summary, request, responses })`.
   - `app.openapi(route, handler)`.
   - Handler: `c.req.valid('json'|'param'|'query')` → call service → return response.
   - Thin handler (~30 baris), zero business logic.

5. **Verify**: Pastikan endpoint terdaftar di index.ts dan bisa diakses via `/reference` (Scalar UI).

## Output Format

Generate 3 files dengan pattern lengkap. Ikuti konvensi Execution Rules #10 dan #11 dari DEVELOPMENT_PLAN.md.
