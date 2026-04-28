# Jeevatix — Project Guidelines

## Dokumen Referensi

Selalu baca dokumen referensi sebelum mengerjakan task:
- `README.md` — Tech stack, arsitektur, monorepo structure, MCP servers
- `DATABASE_DESIGN.md` — 15 tabel, 10 enum, ERD, concurrency flow
- `PAGES.md` — 48 halaman frontend + 67 API endpoints
- `DEVELOPMENT_PLAN.md` — 11 fase (0-10), 65 tasks, execution rules, AI prompts

## Tech Stack (Jangan Ganti)

- **Monorepo**: pnpm workspaces + Turborepo
- **IaC**: SST (Serverless Stack) → Cloudflare
- **Backend**: Hono (`OpenAPIHono` dari `@hono/zod-openapi`) di Cloudflare Workers
- **API Docs**: `@hono/zod-openapi` + `@scalar/hono-api-reference` (UI di `/reference`, JSON di `/doc`)
- **Frontend**: SvelteKit (Buyer :4301, Admin :4302, Seller :4303) + shadcn-svelte
- **Database**: PostgreSQL + Cloudflare Hyperdrive + Drizzle ORM
- **Concurrency**: Cloudflare Durable Objects (TicketReserver)
- **Background Jobs**: Cloudflare Queues (email, cleanup)
- **Real-time**: PartyKit WebSocket
- **File Storage**: Cloudflare R2
- **Code Quality**: ESLint (flat config) + Prettier (`prettier-plugin-svelte`, `prettier-plugin-tailwindcss`)
- **Testing**: Vitest (unit/integration) + Playwright (E2E) + K6 (load)

## Arsitektur 3-Layer (Semua API Endpoint)

```
Route (routes/*.ts)           → Thin HTTP handler (~30 baris)
  ↓ import
Service (services/*.service.ts) → Business logic + DB queries
  ↓ import
Schema (schemas/*.schema.ts)    → Zod schemas + .openapi() = DTO + OpenAPI spec
```

- **Route**: Hanya parse request → panggil service → return response. JANGAN taruh business logic.
- **Service**: Semua business logic, DB queries, orchestration. Bisa di-test tanpa HTTP.
- **Schema**: `z` dari `@hono/zod-openapi` (BUKAN dari `zod`). Setiap schema diberi `.openapi('Name')`.

## OpenAPI Contract Pattern

```typescript
// Schema: import z dari @hono/zod-openapi
import { z } from '@hono/zod-openapi';
const mySchema = z.object({ ... }).openapi('MySchema');

// Route: createRoute() + app.openapi()
import { createRoute } from '@hono/zod-openapi';
const route = createRoute({ method: 'post', path: '/...', tags: ['...'], request: { body: { content: { 'application/json': { schema: mySchema } } } }, responses: { ... } });
app.openapi(route, async (c) => {
  const body = c.req.valid('json'); // BUKAN c.req.json()
  // panggil service → return response
});
```

## Konvensi Kode

- **Edge compatibility**: Semua library di `apps/api` HARUS compatible Cloudflare Workers. No Node.js-only APIs.
- **Password hashing**: Gunakan `bcryptjs` (pure JavaScript, edge-compatible). BUKAN native `bcrypt` atau `argon2` (tidak compatible CF Workers).
- **Error response**: `{ success: boolean, data?: T, error?: { code: string, message: string } }`
- **Pagination**: offset-based. Default limit: 20, max: 100. Response: `{ data: T[], meta: { total, page, limit, totalPages } }`
- **Concurrent-safe**: Operasi `sold_count` pada `ticket_tiers` SELALU via Durable Object.
- **File upload**: Via `POST /upload` ke Cloudflare R2. Jangan simpan file di filesystem lokal.
- **Email**: Async via Cloudflare Queue. Jangan kirim sinkron di request handler.
- **Validasi**: `c.req.valid('json'|'query'|'param')` — BUKAN `schema.parse(await c.req.json())`.

## Code Quality

- Jalankan `pnpm run format:check` dan `pnpm run lint` sebelum commit.
- ESLint: flat config (`eslint.config.js`). Prettier: `.prettierrc` dengan plugin svelte + tailwindcss.
- CI/CD wajib: format:check → lint → typecheck → test → build.

## Load Test Safety

- Project ini berjalan di layanan usage-based (Cloudflare Workers, Durable Objects, Queues, R2, Hyperdrive, dan database origin) dan harus diperlakukan sebagai cost-sensitive karena budget startup masih minim.
- JANGAN menjalankan load test, stress test, soak test, benchmark, synthetic traffic, repeated probe skala besar, atau bulk seeding data load test pada environment remote tanpa konfirmasi eksplisit user di percakapan saat ini.
- Konfirmasi eksplisit wajib diminta sebelum menjalankan command atau script seperti `k6`, `pnpm run test:load*`, `run-load-scenario.ts`, `run-local-checkout-benchmark.ts`, `seed-load-users.ts`, `cleanup-load-test-data.ts`, loop `curl`/`wget`, `xargs`/`parallel` traffic generators, atau mekanisme lain yang berpotensi menaikkan billing/usage.
- Sebelum meminta konfirmasi, agent HARUS menjelaskan singkat target environment, skala traffic yang direncanakan, service yang bisa terdampak billing, potensi side effect, dan cleanup plan.
- Default aman: lakukan analisis script, review konfigurasi, estimasi biaya, atau validasi skala terkecil/lokal terlebih dahulu.
- Untuk environment production, agent HARUS meminta reconfirmation eksplisit walaupun user pernah memberi izin umum sebelumnya.
- Perubahan yang menonaktifkan atau membypass limiter, auth protection, anti-abuse guardrail, atau mekanisme proteksi provider demi keperluan load test juga memerlukan konfirmasi eksplisit user sebelum diubah atau dijalankan.
- Jika user belum memberi izin eksplisit, agent boleh menyiapkan kode, dokumentasi, atau rencana load test, tetapi tidak boleh mengeksekusi load test-nya.

## Git Workflow

- Branch per fase: `feat/phase-X`
- Commit per task: `feat(T-X.X): <deskripsi>`
- Satu task = satu commit (jika memungkinkan)


## MCP Tools

- **shadcn-ui MCP**: `list_components`, `get_component`, `get_component_demo`, `list_blocks`, `get_block`, `list_themes`, `apply_theme`
- **Context7 MCP**: `resolve-library-id` → `get-library-docs` — lookup dokumentasi terbaru untuk library (Hono, Drizzle, SvelteKit, SST, dll)
