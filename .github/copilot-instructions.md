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

Semua API endpoint mengikuti strict 3-layer separation:

1. **Route** (`apps/api/src/routes/`) — Thin HTTP handlers, OpenAPI contract
2. **Service** (`apps/api/src/services/`) — Business logic, DB queries, no HTTP context
3. **Schema** (`apps/api/src/schemas/`) — Zod + OpenAPI validation

**Lihat detail pattern di:**
- `instructions/api-routes.instructions.md` — Route handler patterns
- `instructions/api-services.instructions.md` — Service layer patterns
- `instructions/api-schemas.instructions.md` — Schema patterns

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

⚠️ **CRITICAL**: Project ini berjalan di layanan usage-based Cloudflare dengan budget terbatas.

**Lihat `instructions/load-testing.instructions.md` untuk detailed safety rules.**

Key requirements:
- JANGAN jalankan load test di remote environment tanpa konfirmasi eksplisit user
- Jelaskan target environment, skala traffic, billing impact, dan cleanup plan sebelum minta approval
- Production load test butuh reconfirmation walaupun user sudah kasih izin umum sebelumnya

## Git Workflow

- Branch per fase: `feat/phase-X`
- Commit per task: `feat(T-X.X): <deskripsi>`
- Satu task = satu commit (jika memungkinkan)


## MCP Tools

- **shadcn-ui MCP**: `list_components`, `get_component`, `get_component_demo`, `list_blocks`, `get_block`, `list_themes`, `apply_theme`
- **Context7 MCP**: `resolve-library-id` → `get-library-docs` — lookup dokumentasi terbaru untuk library (Hono, Drizzle, SvelteKit, SST, dll)
