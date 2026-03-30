# Jeevatix — Development Plan

> Dokumen ini adalah **rencana eksekusi pembangunan** platform Jeevatix dari nol.
> Setiap fase memiliki **task ID**, **deskripsi**, **deliverables**, **dependensi**, dan **referensi** ke dokumen lain.
> AI agent harus mengeksekusi task **secara berurutan per fase**, kecuali task dalam fase yang sama boleh paralel jika tidak ada dependensi.

**Dokumen referensi:**
- `README.md` — Tech stack, arsitektur, monorepo structure, MCP servers
- `DATABASE_DESIGN.md` — Skema database, 15 tabel, enum, ERD
- `PAGES.md` — 48 halaman frontend + 67 API endpoints

**MCP Tools tersedia:**
- `shadcn-ui-mcp-server` — Referensi komponen, block, dan tema shadcn/ui (gunakan untuk semua task UI)
- `context7` — Lookup dokumentasi library terbaru (Hono, Drizzle, SvelteKit, SST, dll)

---

## Execution Rules for AI Agents

1. **Kerjakan per fase.** Jangan loncat ke fase berikutnya sebelum semua task di fase sekarang selesai.
2. **Setiap task harus menghasilkan deliverable yang bisa diverifikasi** (file, test, atau command yang berjalan tanpa error).
3. **Jangan buat file yang tidak diminta.** Ikuti monorepo structure di README.md.
4. **Gunakan exact tech stack** yang tercantum di README.md. Jangan ganti framework/library.
5. **Ikuti DATABASE_DESIGN.md** untuk skema database. Jangan modifikasi kolom/tabel tanpa instruksi eksplisit.
6. **Ikuti PAGES.md** untuk route dan API endpoint. Jangan tambah/kurangi halaman tanpa instruksi.
7. **Setiap fase punya checkpoint.** Jalankan checkpoint command sebelum lanjut ke fase berikutnya.
8. **Gunakan MCP tools** yang tersedia:
   - **shadcn-ui MCP**: Untuk semua task UI — gunakan `list_components` untuk melihat komponen tersedia, `get_component` / `get_component_demo` untuk mendapatkan source code & contoh penggunaan, `list_blocks` / `get_block` untuk template block siap pakai (dashboard, login, sidebar), dan `list_themes` / `apply_theme` untuk menerapkan tema.
   - **Context7 MCP**: Untuk lookup dokumentasi library — gunakan `resolve-library-id` lalu `get-library-docs` saat butuh referensi API terbaru (Hono, Drizzle ORM, SvelteKit, SST, Zod, dll).
9. **Satu task = satu commit, satu branch per fase.** Gunakan `git` CLI untuk membuat branch `feat/phase-X` dan commit setiap task selesai.
10. **Ikuti arsitektur 3-layer untuk semua API endpoint:**
    - **Route** (`routes/`) — Thin HTTP handler (~30 baris). Hanya: parse request body/params → panggil service → return response. JANGAN taruh business logic di route.
    - **Service** (`services/*.service.ts`) — Semua business logic, DB queries, orchestration. Bisa di-test tanpa HTTP context.
    - **Schema** (`schemas/*.schema.ts`) — Zod validation schemas untuk request/response. Berfungsi sebagai DTO. Export inferred types (`z.infer<typeof schema>`).
    - Contoh: `routes/auth.ts` → import `authService` dari `services/auth.service.ts` + import schemas dari `schemas/auth.schema.ts`.
11. **Gunakan `@hono/zod-openapi` untuk semua API route (OpenAPI contract):**
    - Import `z` dari `@hono/zod-openapi` (BUKAN dari `zod` langsung). Library ini re-export `z` + tambah method `.openapi()`.
    - Setiap Zod schema di `schemas/*.schema.ts` harus diberi metadata `.openapi('SchemaName')` dan field penting diberi `.openapi({ example: '...' })`.
    - Setiap route di `routes/*.ts` harus didefinisikan dengan `createRoute({ method, path, tags, summary, request, responses })`, lalu di-register via `app.openapi(route, handler)`.
    - Handler menerima `c` dengan tipe yang sudah di-infer dari `createRoute`. Gunakan `c.req.valid('json')`, `c.req.valid('param')`, `c.req.valid('query')` — BUKAN manual `c.req.json()`.
    - `apps/api/src/index.ts` menggunakan `OpenAPIHono` (bukan `new Hono()`), expose `/doc` (JSON spec) dan `/reference` (Scalar UI).
    - Dependencies: `@hono/zod-openapi`, `@scalar/hono-api-reference`.
12. **Gunakan ESLint + Prettier untuk code quality dari awal:**
    - **ESLint** — Flat config (`eslint.config.js` di root). Pakai `@typescript-eslint/eslint-plugin` + `eslint-plugin-svelte`. Setiap app bisa extend config root.
    - **Prettier** — Config `.prettierrc` di root. Plugin: `prettier-plugin-svelte`, `prettier-plugin-tailwindcss` (urutan plugin penting — svelte dulu, tailwindcss terakhir).
    - Jalankan `pnpm run lint` dan `pnpm run format:check` sebagai bagian dari checkpoint setiap fase.
    - CI/CD wajib lint + format check sebelum build.
13. **Playwright E2E sudah di-setup di Phase 0** — Phase 10 (T-10.2) fokus menulis test cases, bukan setup.
14. **Gunakan AI agent customization files di `.github/`:**
    - `copilot-instructions.md` — Workspace-wide rules (always active). Berisi ringkasan tech stack, arsitektur 3-layer, OpenAPI, code quality, dan konvensi project.
    - `instructions/*.instructions.md` — File-specific instructions (auto-attach by pattern). Berisi pattern khusus per folder: routes, services, schemas, svelte pages, drizzle schema.
    - `prompts/*.prompt.md` — Reusable slash commands: `/new-api-endpoint`, `/new-svelte-page`, `/phase-checkpoint`.
    - `agents/reviewer.agent.md` — Read-only code review agent.
    - Lihat README.md bagian "AI Development Setup" untuk daftar lengkap.
15. **Spec-First Development — definisikan contract sebelum implementasi:**
    - Untuk setiap task API (route + service + schema), kerjakan dalam urutan: **Schema → Service → Route**.
    - Schema (`schemas/*.schema.ts`) adalah **contract/spec** — definisikan dulu request/response shape + `.openapi()` metadata sebelum menulis logic.
    - Setelah schema selesai, verify OpenAPI spec di `/doc` (JSON) atau `/reference` (Scalar UI) — pastikan contract benar sebelum implementasi service & route.
    - Jika spec berubah, **update schema dulu**, baru adjust service & route.
16. **Test-Driven Development — setiap fase API harus punya task test:**
    - Phase 2 sudah punya T-2.4 (Auth Tests). Phase 3–7 masing-masing punya task test di akhir fase.
    - Urutan kerja per task API: **Schema (spec) → Test file (tulis test cases berdasarkan spec) → Service (implementasi logic) → Route (wiring) → Run tests (semua harus pass)**.
    - Minimal test setiap fase: unit test untuk service functions + integration test untuk API routes (menggunakan Hono `app.request()`).
    - Phase 10 hanya berisi: E2E tests (Playwright), load tests (K6), security review, CI/CD, dan deploy — **bukan** unit/integration tests.

---

## Phase Overview

```mermaid
gantt
    title Jeevatix Development Plan
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d
    
    section Phase 0 - Foundation
    Monorepo Setup           :p0, 2026-03-27, 3d
    
    section Phase 1 - Database
    Drizzle Schema & Migrate :p1, after p0, 2d
    
    section Phase 2 - API Core
    Auth API                 :p2a, after p1, 2d
    User & Profile API       :p2b, after p2a, 1d
    File Upload & Email      :p2c, after p2a, 1d
    
    section Phase 3 - Admin CRUD
    Category API + Admin UI  :p3a, after p2b, 2d
    User Mgmt Admin UI       :p3b, after p3a, 2d
    Seller Verification      :p3c, after p3b, 1d
    Phase 3 Tests            :p3t, after p3c, 1d
    
    section Phase 4 - Seller
    Event CRUD API + UI      :p4a, after p3t, 3d
    Tier Tiket API + UI      :p4b, after p4a, 1d
    Seller Dashboard         :p4c, after p4b, 1d
    Phase 4 Tests            :p4t, after p4c, 1d
    
    section Phase 5 - Buyer Public
    Event List & Detail      :p5a, after p4t, 2d
    Homepage & Kategori      :p5b, after p5a, 1d
    Phase 5 Tests            :p5t, after p5b, 1d
    
    section Phase 6 - Transaction
    Durable Objects + Reserve:p6a, after p5t, 3d
    Order & Payment API      :p6b, after p6a, 2d
    Checkout & Payment UI    :p6c, after p6b, 2d
    Phase 6 Tests            :p6t, after p6c, 1d
    
    section Phase 7 - Post-Transaction
    Ticket Generation        :p7a, after p6t, 2d
    Check-in System          :p7b, after p7a, 1d
    Notification System      :p7c, after p7b, 1d
    Seller Notification UI   :p7d, after p7c, 1d
    Phase 7 Tests            :p7t, after p7d, 1d
    
    section Phase 8 - Realtime
    PartyKit WebSocket       :p8, after p7t, 2d
    
    section Phase 9 - Polish
    Dashboards & Analytics   :p9a, after p8, 2d
    Admin Order & Payment    :p9b, after p9a, 1d
    
    section Phase 10 - QA & Deploy
    Coverage & Gap Tests     :p10a, after p9b, 2d
    E2E & Load Tests         :p10b, after p10a, 2d
    Security & CI/CD         :p10c, after p10b, 2d
    Deploy & Monitoring      :p10d, after p10c, 1d
```

---

## Phase 0: Monorepo Foundation

**Tujuan:** Setup monorepo dari nol sehingga `pnpm install` dan `pnpm run dev` bisa berjalan tanpa error.

### Task 0.1 — Initialize Root Monorepo [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-0.1`                                                   |
| Dependensi  | Tidak ada                                                  |
| Deliverables| `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.nvmrc`, `tsconfig.base.json`, `docker-compose.yml`, `.github/copilot-instructions.md`, `.github/instructions/`, `.github/prompts/`, `.github/agents/` |

**Instruksi:**
1. Init `package.json` dengan `"private": true` dan `"packageManager": "pnpm@9.x"`.
2. Buat `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
   ```
3. Buat `turbo.json` dengan pipeline `build`, `dev`, `lint`, `lint:fix`, `format`, `format:check`, `test`.
4. Buat `tsconfig.base.json` (shared TypeScript config, `strict: true`, paths alias `@jeevatix/*`).
5. Buat `.nvmrc` → `22`.
6. Buat `.gitignore` (node_modules, .env, dist, .turbo, .sst).
7. Buat `.env.example` dengan variabel:
   ```
   DATABASE_URL=postgresql://jeevatix:jeevatix@localhost:5432/jeevatix
   CLOUDFLARE_ACCOUNT_ID=
   CLOUDFLARE_API_TOKEN=
   JWT_SECRET=
   ```
8. Buat `docker-compose.yml` untuk PostgreSQL lokal:
   ```yaml
   services:
     postgres:
       image: postgres:17-alpine
       ports:
         - "5432:5432"
       environment:
         POSTGRES_DB: jeevatix
         POSTGRES_USER: jeevatix
         POSTGRES_PASSWORD: jeevatix
       volumes:
         - pgdata:/var/lib/postgresql/data
   volumes:
     pgdata:
   ```
9. Buat folder `.github/` dengan AI agent customization files (salin dari file yang sudah ada di repo — lihat `.github/copilot-instructions.md`, `.github/instructions/`, `.github/prompts/`, `.github/agents/`).

**Prompt:**
```
Kerjakan Task T-0.1: Initialize Root Monorepo.

Buat file-file berikut di root project:
1. `package.json` — private: true, packageManager: pnpm@9.x, scripts kosong (build, dev, lint, lint:fix, format, format:check, test via turbo).
2. `pnpm-workspace.yaml` — packages: ["apps/*", "packages/*"].
3. `turbo.json` — pipeline: build, dev, lint, lint:fix, format, format:check, test.
4. `tsconfig.base.json` — strict: true, paths alias @jeevatix/* ke packages/*.
5. `.nvmrc` — isi: 22.
6. `.gitignore` — node_modules, .env, dist, .turbo, .sst, .wrangler.
7. `.env.example` — variabel: DATABASE_URL (default: postgresql://jeevatix:jeevatix@localhost:5432/jeevatix), CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, JWT_SECRET.
8. `docker-compose.yml` — PostgreSQL 17 Alpine, port 5432, DB name: jeevatix, user: jeevatix, password: jeevatix, volume: pgdata.
9. `.github/` — AI agent customization files sudah ada di repo. Pastikan folder `.github/copilot-instructions.md`, `.github/instructions/`, `.github/prompts/`, `.github/agents/` ter-copy.

Jangan buat folder apps/ atau packages/ dulu — itu task berikutnya.
Pastikan `pnpm install` bisa berjalan tanpa error setelah selesai.
```

### Task 0.2 — Setup SST Config [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-0.2`                                                   |
| Dependensi  | `T-0.1`                                                   |
| Deliverables| `sst.config.ts`                                            |

**Instruksi:**
1. `pnpm add -Dw sst@latest aws-cdk-lib constructs`.
2. Buat `sst.config.ts` — definisikan app name `jeevatix`, stage dari env.
3. Placeholder untuk Cloudflare Workers, Hyperdrive, Durable Objects, Queues.

**Prompt:**
```
Kerjakan Task T-0.2: Setup SST Config.
Dependensi: T-0.1 sudah selesai.

1. Install SST: `pnpm add -Dw sst@latest aws-cdk-lib constructs`.
2. Buat file `sst.config.ts` di root project.
3. Definisikan app name: "jeevatix", stage dari environment variable.
4. Tambahkan placeholder/komentar untuk resource yang akan dibuat nanti: Cloudflare Workers (API), Hyperdrive (DB connection pooling), Durable Objects (TicketReserver), Queues (email, reservation cleanup).

Pastikan file valid TypeScript dan tidak ada error.
```

### Task 0.3 — Create Package: `packages/types` [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-0.3`                                                   |
| Dependensi  | `T-0.1`                                                   |
| Deliverables| `packages/types/package.json`, `packages/types/src/index.ts` |

**Instruksi:**
1. Buat package `@jeevatix/types`.
2. Export TypeScript interfaces/types untuk semua enum dari DATABASE_DESIGN.md:
   - `UserRole`, `UserStatus`, `EventStatus`, `TicketTierStatus`, `OrderStatus`, `PaymentStatus`, `PaymentMethod`, `ReservationStatus`, `TicketStatus`, `NotificationType`.
3. Export interface untuk setiap entity (User, SellerProfile, Event, TicketTier, Reservation, Order, OrderItem, Payment, Ticket, TicketCheckin, Notification, Category).
4. Export API response types generik: `ApiResponse<T>`, `PaginatedResponse<T>`, `ErrorResponse`.

**Prompt:**
```
Referensi: DATABASE_DESIGN.md (semua enum dan tabel).

Kerjakan Task T-0.3: Create Package packages/types.
Dependensi: T-0.1 sudah selesai.

1. Buat folder `packages/types/` dengan `package.json` (name: @jeevatix/types) dan `tsconfig.json` (extends root tsconfig.base.json).
2. Buat `packages/types/src/index.ts` yang meng-export:
   a. TypeScript enum/union types untuk semua 10 enum di DATABASE_DESIGN.md: UserRole, UserStatus, EventStatus, TicketTierStatus, OrderStatus, PaymentStatus, PaymentMethod, ReservationStatus, TicketStatus, NotificationType.
   b. Interface untuk setiap entity: User, SellerProfile, Event, Category, EventCategory, EventImage, TicketTier, Reservation, Order, OrderItem, Payment, Ticket, TicketCheckin, Notification, RefreshToken.
   c. Generic API response types: ApiResponse<T>, PaginatedResponse<T>, ErrorResponse.

Gunakan exact kolom dan tipe dari DATABASE_DESIGN.md. Jangan mengarang field.
```

### Task 0.4 — Create Package: `packages/core` [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-0.4`                                                   |
| Dependensi  | `T-0.1`, `T-0.3`                                          |
| Deliverables| `packages/core/package.json`, `packages/core/src/index.ts`, `packages/core/drizzle.config.ts` |

**Instruksi:**
1. Buat package `@jeevatix/core`.
2. `pnpm add drizzle-orm postgres` di `packages/core`.
3. `pnpm add -D drizzle-kit` di `packages/core`.
4. Buat `drizzle.config.ts` (baca `DATABASE_URL` dari env, schema path, PostgreSQL dialect).
5. Buat placeholder `src/db/index.ts` untuk koneksi database.
6. Buat placeholder folder `src/db/schema/` (akan diisi di Phase 1).

**Prompt:**
```
Kerjakan Task T-0.4: Create Package packages/core.
Dependensi: T-0.1 dan T-0.3 sudah selesai.

1. Buat folder `packages/core/` dengan `package.json` (name: @jeevatix/core).
2. Install dependencies: `pnpm add drizzle-orm postgres` dan `pnpm add -D drizzle-kit` di packages/core.
3. Buat `packages/core/drizzle.config.ts` — PostgreSQL dialect, baca DATABASE_URL dari env, schema path: ./src/db/schema/*.
4. Buat `packages/core/tsconfig.json` (extends root tsconfig.base.json).
5. Buat placeholder `packages/core/src/db/index.ts` — export kosong, akan diisi koneksi DB di Phase 1.
6. Buat folder kosong `packages/core/src/db/schema/` (akan diisi schema Drizzle di Phase 1).
7. Buat `packages/core/src/index.ts` — re-export dari db.

Pastikan package bisa di-resolve dari workspace lain via @jeevatix/core.
```

### Task 0.5 — Create App: `apps/api` [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-0.5`                                                   |
| Dependensi  | `T-0.1`, `T-0.4`                                          |
| Deliverables| `apps/api/package.json`, `apps/api/src/index.ts`, `apps/api/wrangler.toml`, folder structure `routes/`, `services/`, `schemas/`, `middleware/`, `lib/` |

**Instruksi:**
1. Buat package `@jeevatix/api`.
2. `pnpm add hono @hono/zod-openapi @scalar/hono-api-reference` di `apps/api`.
3. Buat `src/index.ts` — **OpenAPIHono** app dengan health check route `GET /health` → `{ status: "ok" }`, endpoint `/doc` (OpenAPI JSON spec), dan `/reference` (Scalar interactive API docs).
4. Buat `wrangler.toml` — config untuk Cloudflare Workers.
5. Setup script: `"dev": "wrangler dev src/index.ts"`.
6. **Scaffold arsitektur 3-layer:** Buat folder `src/routes/`, `src/services/`, `src/schemas/`, `src/middleware/`, `src/lib/`, `src/durable-objects/`, `src/queues/` (masing-masing dengan `.gitkeep`).

**Prompt:**
```
Kerjakan Task T-0.5: Create App apps/api.
Dependensi: T-0.1 dan T-0.4 sudah selesai.

1. Buat folder `apps/api/` dengan `package.json` (name: @jeevatix/api).
2. Install: `pnpm add hono @hono/zod-openapi @scalar/hono-api-reference` di apps/api.
3. Install dev: `pnpm add -D wrangler @cloudflare/workers-types` di apps/api.
4. Buat `apps/api/tsconfig.json` (extends root, types: @cloudflare/workers-types).
5. Buat `apps/api/wrangler.toml` — name: jeevatix-api, compatibility_date terbaru, main: src/index.ts.
6. Buat `apps/api/src/index.ts` menggunakan **OpenAPIHono** (bukan `new Hono()`):
   ~~~typescript
   import { OpenAPIHono } from '@hono/zod-openapi';
   import { apiReference } from '@scalar/hono-api-reference';

   const app = new OpenAPIHono();

   // Health check
   app.get('/health', (c) => c.json({ status: 'ok' }));

   // OpenAPI JSON spec
   app.doc('/doc', {
     openapi: '3.1.0',
     info: { title: 'Jeevatix API', version: '1.0.0', description: 'High-performance event ticket platform API' },
   });

   // Scalar interactive API docs
   app.get('/reference', apiReference({ spec: { url: '/doc' } }));

   export default app;
   ~~~
7. Scaffold arsitektur 3-layer — buat folder berikut (masing-masing dengan file .gitkeep agar ter-track Git):
   - `apps/api/src/routes/` — Thin HTTP handlers menggunakan `createRoute()` + `app.openapi()`.
   - `apps/api/src/services/` — Business logic & DB operations.
   - `apps/api/src/schemas/` — Zod schemas dengan `.openapi()` metadata (request/response DTO).
   - `apps/api/src/middleware/` — Auth, CORS, error handler.
   - `apps/api/src/lib/` — Pure utilities (jwt, password, helpers).
   - `apps/api/src/durable-objects/` — Cloudflare Durable Objects.
   - `apps/api/src/queues/` — Cloudflare Queue consumers.
8. Tambahkan script di package.json: "dev": "wrangler dev src/index.ts".

Verifikasi: `cd apps/api && pnpm dev` harus start tanpa error, GET http://localhost:8787/health harus return { status: "ok" }, GET http://localhost:8787/reference harus menampilkan Scalar API docs.
```

### Task 0.6 — Create App: `apps/buyer` [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-0.6`                                                   |
| Dependensi  | `T-0.1`                                                   |
| Deliverables| `apps/buyer/` (SvelteKit project yang bisa `dev`)          |

**Instruksi:**
1. Initialize SvelteKit project di `apps/buyer` dengan `npx sv create`.
2. Tambah TailwindCSS via `npx sv add tailwindcss`.
3. Setup `svelte.config.js` — adapter `@sveltejs/adapter-cloudflare`.
4. Buat layout dasar: `src/routes/+layout.svelte` dengan `<slot />`.
5. Buat `src/routes/+page.svelte` → placeholder homepage.
6. Port dev: `4301`.

**Prompt:**
```
Kerjakan Task T-0.6: Create App apps/buyer.
Dependensi: T-0.1 sudah selesai.

1. Initialize SvelteKit project di `apps/buyer/` menggunakan `npx sv create` (skeleton project, TypeScript).
2. Tambahkan TailwindCSS: `npx sv add tailwindcss`.
3. Setup `apps/buyer/svelte.config.js` — adapter: @sveltejs/adapter-cloudflare. Install: pnpm add -D @sveltejs/adapter-cloudflare.
4. Buat layout: `src/routes/+layout.svelte` dengan HTML boilerplate, TailwindCSS import, dan <slot />.
5. Buat `src/routes/+page.svelte` — tampilkan heading "Jeevatix — Menghidupkan Setiap Momenmu" sebagai placeholder.
6. Konfigurasi dev port: 4301 di vite.config.ts (server.port: 4301).
7. Setup shadcn-svelte: `npx shadcn-svelte@latest init` — sehingga buyer juga bisa pakai komponen dari packages/ui.

Verifikasi: `cd apps/buyer && pnpm dev` harus start di http://localhost:4301 tanpa error.
```

### Task 0.7 — Create App: `apps/admin` [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-0.7`                                                   |
| Dependensi  | `T-0.1`                                                   |
| Deliverables| `apps/admin/` (SvelteKit project yang bisa `dev`)          |

**Instruksi:**
1. Initialize SvelteKit project di `apps/admin`.
2. Tambah TailwindCSS + shadcn-svelte.
3. Setup `svelte.config.js` — Cloudflare adapter.
4. Buat layout dasar: `src/routes/+layout.svelte` dengan sidebar navigation.
5. Buat `src/routes/+page.svelte` → placeholder dashboard.
6. Port dev: `4302`.

**Prompt:**
```
Kerjakan Task T-0.7: Create App apps/admin.
Dependensi: T-0.1 sudah selesai.

1. Initialize SvelteKit project di `apps/admin/`.
2. Tambahkan TailwindCSS + shadcn-svelte.
3. Setup `apps/admin/svelte.config.js` — adapter: @sveltejs/adapter-cloudflare.
4. Buat layout: `src/routes/+layout.svelte` dengan sidebar navigation (menu: Dashboard, Users, Sellers, Events, Orders, Payments, Categories, Notifications, Reservations).
5. Buat `src/routes/+page.svelte` — placeholder dashboard "Admin Dashboard".
6. Konfigurasi dev port: 4302 di vite.config.ts (server.port: 4302).

Verifikasi: `cd apps/admin && pnpm dev` harus start di http://localhost:4302 tanpa error.
```

### Task 0.8 — Create App: `apps/seller` [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-0.8`                                                   |
| Dependensi  | `T-0.1`                                                   |
| Deliverables| `apps/seller/` (SvelteKit project yang bisa `dev`)         |

**Instruksi:**
1. Initialize SvelteKit project di `apps/seller`.
2. Tambah TailwindCSS + shadcn-svelte.
3. Setup `svelte.config.js` — Cloudflare adapter.
4. Buat layout dasar: `src/routes/+layout.svelte` dengan sidebar navigation.
5. Buat `src/routes/+page.svelte` → placeholder dashboard.
6. Port dev: `4303`.

**Prompt:**
```
Kerjakan Task T-0.8: Create App apps/seller.
Dependensi: T-0.1 sudah selesai.

1. Initialize SvelteKit project di `apps/seller/`.
2. Tambahkan TailwindCSS + shadcn-svelte.
3. Setup `apps/seller/svelte.config.js` — adapter: @sveltejs/adapter-cloudflare.
4. Buat layout: `src/routes/+layout.svelte` dengan sidebar navigation (menu: Dashboard, Events, Orders, Check-in, Notifications, Profile).
5. Buat `src/routes/+page.svelte` — placeholder "Seller Dashboard".
6. Konfigurasi dev port: 4303 di vite.config.ts (server.port: 4303).

Verifikasi: `cd apps/seller && pnpm dev` harus start di http://localhost:4303 tanpa error.
```

### Task 0.9 — Create Package: `packages/ui` [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-0.9`                                                   |
| Dependensi  | `T-0.1`                                                   |
| Deliverables| `packages/ui/package.json`, shared components placeholder  |

**Instruksi:**
1. Buat package `@jeevatix/ui`.
2. Setup dengan shadcn-svelte sebagai base.
3. Export shared components: Button, Input, Card, Badge, Modal, Toast, DataTable.
4. Export shared TailwindCSS preset/theme (warna brand Jeevatix).

**Prompt:**
```
Kerjakan Task T-0.9: Create Package packages/ui.
Dependensi: T-0.1 sudah selesai.

1. Buat folder `packages/ui/` dengan `package.json` (name: @jeevatix/ui).
2. Setup dengan shadcn-svelte sebagai base component library.
3. Tambahkan TailwindCSS config/preset dengan warna brand Jeevatix.
4. Buat dan export shared components placeholder: Button, Input, Card, Badge, Modal, Toast, DataTable.
5. Buat `packages/ui/src/index.ts` — re-export semua components.
6. Buat `packages/ui/tsconfig.json` (extends root tsconfig.base.json).

Package ini akan digunakan oleh apps/admin, apps/seller, dan apps/buyer. Pastikan bisa di-import via @jeevatix/ui.
```

### Task 0.10 — Setup Prettier, ESLint & Playwright [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-0.10`                                                  |
| Dependensi  | `T-0.1`, `T-0.5`, `T-0.6`, `T-0.7`, `T-0.8`             |
| Deliverables| `.prettierrc`, `.prettierignore`, `eslint.config.js`, `playwright.config.ts`, `tests/e2e/.gitkeep` |

**Instruksi:**
1. **Prettier:**
   - Install di root: `pnpm add -Dw prettier prettier-plugin-svelte prettier-plugin-tailwindcss`.
   - Buat `.prettierrc`:
     ```json
     {
       "semi": true,
       "singleQuote": true,
       "tabWidth": 2,
       "trailingComma": "all",
       "printWidth": 100,
       "plugins": ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"],
       "overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }]
     }
     ```
   - Buat `.prettierignore`: `node_modules`, `dist`, `.svelte-kit`, `.turbo`, `build`, `*.min.js`, `pnpm-lock.yaml`.
   - Tambah script di root `package.json`: `"format": "turbo run format"`, `"format:check": "turbo run format:check"`.
   - Tambah script di setiap app/package `package.json`:
     - `"format": "prettier --write ."`.
     - `"format:check": "prettier --check ."`.
2. **ESLint (Flat Config):**
   - Install di root: `pnpm add -Dw eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-svelte svelte-eslint-parser globals eslint-config-prettier`.
   - Buat `eslint.config.js` di root (flat config):
     ```js
     import globals from 'globals';
     import tseslint from '@typescript-eslint/eslint-plugin';
     import tsparser from '@typescript-eslint/parser';
     import svelte from 'eslint-plugin-svelte';
     import svelteParser from 'svelte-eslint-parser';
     import prettier from 'eslint-config-prettier';

     export default [
       { ignores: ['**/dist/**', '**/.svelte-kit/**', '**/.turbo/**', '**/build/**'] },
       {
         files: ['**/*.ts'],
         languageOptions: { parser: tsparser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module' }, globals: { ...globals.browser, ...globals.node } },
         plugins: { '@typescript-eslint': tseslint },
         rules: { ...tseslint.configs.recommended.rules, '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
       },
       ...svelte.configs['flat/recommended'],
       {
         files: ['**/*.svelte'],
         languageOptions: { parser: svelteParser, parserOptions: { parser: tsparser } },
       },
       prettier,
     ];
     ```
   - Tambah script di root `package.json`: `"lint": "turbo run lint"`, `"lint:fix": "turbo run lint:fix"`.
   - Tambah script di setiap app/package `package.json`:
     - `"lint": "eslint ."`.
     - `"lint:fix": "eslint . --fix"`.
   - `eslint-config-prettier` wajib ada di posisi terakhir agar Prettier rules menang (tidak bentrok).
3. **Playwright:**
   - Install di root: `pnpm add -Dw @playwright/test`.
   - Install browsers: `npx playwright install --with-deps chromium` (hanya Chromium untuk dev, hemat disk).
   - Buat `playwright.config.ts` di root:
     ```typescript
     import { defineConfig, devices } from '@playwright/test';
     export default defineConfig({
       testDir: './tests/e2e',
       fullyParallel: true,
       forbidOnly: !!process.env.CI,
       retries: process.env.CI ? 2 : 0,
       workers: process.env.CI ? 1 : undefined,
       reporter: 'html',
       use: { trace: 'on-first-retry' },
       projects: [
         { name: 'buyer', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4301' } },
         { name: 'admin', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4302' } },
         { name: 'seller', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4303' } },
       ],
       webServer: [
         { command: 'pnpm run dev', url: 'http://localhost:4301', reuseExistingServer: !process.env.CI },
       ],
     });
     ```
   - Buat folder `tests/e2e/` dengan `.gitkeep`.
   - Tambah script di root `package.json`: `"test:e2e": "playwright test"`.
   - Tambah ke `.gitignore`: `test-results/`, `playwright-report/`, `blob-report/`.

**Prompt:**
```
Kerjakan Task T-0.10: Setup Prettier, ESLint & Playwright.
Dependensi: T-0.1, T-0.5, T-0.6, T-0.7, T-0.8 sudah selesai (semua apps & packages sudah ada).

1. PRETTIER:
   - Install di root: pnpm add -Dw prettier prettier-plugin-svelte prettier-plugin-tailwindcss.
   - Buat `.prettierrc` di root:
     { "semi": true, "singleQuote": true, "tabWidth": 2, "trailingComma": "all", "printWidth": 100, "plugins": ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"], "overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }] }
   - Buat `.prettierignore`: node_modules, dist, .svelte-kit, .turbo, build, *.min.js, pnpm-lock.yaml.
   - Tambah script di setiap app/package package.json: "format": "prettier --write .", "format:check": "prettier --check .".
   - Tambah script di root package.json: "format": "turbo run format", "format:check": "turbo run format:check".

2. ESLINT (Flat Config):
   - Install di root: pnpm add -Dw eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-svelte svelte-eslint-parser globals eslint-config-prettier.
   - Buat `eslint.config.js` di root — flat config dengan @typescript-eslint + eslint-plugin-svelte + eslint-config-prettier (posisi terakhir, agar tidak bentrok dengan Prettier).
   - Ignore: dist, .svelte-kit, .turbo, build.
   - Rules: recommended + no-unused-vars warn (ignore _ prefix).
   - Tambah script di setiap app/package package.json: "lint": "eslint .", "lint:fix": "eslint . --fix".
   - Tambah script di root package.json: "lint": "turbo run lint", "lint:fix": "turbo run lint:fix".

3. PLAYWRIGHT:
   - Install di root: pnpm add -Dw @playwright/test.
   - Install browsers: npx playwright install --with-deps chromium.
   - Buat `playwright.config.ts` di root — 3 projects: buyer (:4301), admin (:4302), seller (:4303). testDir: ./tests/e2e. webServer: pnpm run dev.
   - Buat folder `tests/e2e/` dengan .gitkeep.
   - Tambah script di root: "test:e2e": "playwright test".
   - Tambah ke .gitignore: test-results/, playwright-report/, blob-report/.

4. Update turbo.json pipeline — tambah: format, format:check, lint:fix (selain lint dan test yang sudah ada).

5. Jalankan format pada semua file: pnpm run format (auto-fix semua formatting).
6. Jalankan lint: pnpm run lint (harus pass tanpa error).

Verifikasi: pnpm run format:check && pnpm run lint harus pass tanpa error.
```

**Checkpoint Phase 0:**
```bash
pnpm install          # harus sukses tanpa error
pnpm run build        # semua app harus build sukses
pnpm run format:check # Prettier — formatting konsisten
pnpm run lint         # ESLint — tidak ada lint errors
pnpm run dev          # semua app harus start di port masing-masing
```

---

## Phase 1: Database Schema & Migration

**Tujuan:** Definisikan seluruh 15 tabel + 10 enum di Drizzle ORM, jalankan push ke PostgreSQL.

### Task 1.1 — Drizzle Enum Definitions [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-1.1`                                                   |
| Dependensi  | `T-0.4`                                                   |
| Deliverables| `packages/core/src/db/schema/enums.ts`                     |

**Instruksi:**
1. Definisikan semua 10 enum menggunakan `pgEnum()` dari drizzle-orm/pg-core.
2. Lihat enum definitions di DATABASE_DESIGN.md → bagian "Enum Definitions".
3. Export semua enum.

**Prompt:**
```
Referensi: DATABASE_DESIGN.md (Enum Definitions).

Kerjakan Task T-1.1: Drizzle Enum Definitions.
Dependensi: T-0.4 sudah selesai.

Buat file `packages/core/src/db/schema/enums.ts`:
1. Import `pgEnum` dari drizzle-orm/pg-core.
2. Definisikan semua 10 enum PERSIS sesuai DATABASE_DESIGN.md:
   - userRole: buyer, seller, admin
   - userStatus: active, suspended, banned
   - eventStatus: draft, pending_review, published, rejected, ongoing, completed, cancelled
   - ticketTierStatus: available, sold_out, hidden
   - orderStatus: pending, confirmed, expired, cancelled, refunded
   - paymentStatus: pending, success, failed, refunded
   - paymentMethod: bank_transfer, e_wallet, credit_card, virtual_account
   - reservationStatus: active, converted, expired, cancelled
   - ticketStatus: valid, used, cancelled, refunded
   - notificationType: order_confirmed, payment_reminder, event_reminder, new_order, event_approved, event_rejected, info
3. Export semua enum.

Jangan menambah atau mengurangi value enum dari yang ada di DATABASE_DESIGN.md.
```

### Task 1.2 — Drizzle Table Schemas [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-1.2`                                                   |
| Dependensi  | `T-1.1`                                                   |
| Deliverables| File schema per tabel di `packages/core/src/db/schema/`    |

**Instruksi:**
Buat file schema per domain. Ikuti **persis** kolom, tipe, constraint, dan index di DATABASE_DESIGN.md.

| File                    | Tabel yang didefinisikan                     |
| ----------------------- | -------------------------------------------- |
| `users.ts`              | `users`, `seller_profiles`, `refresh_tokens` |
| `events.ts`             | `events`, `event_categories`, `event_images`, `categories` |
| `tickets.ts`            | `ticket_tiers`, `tickets`, `ticket_checkins` |
| `orders.ts`             | `orders`, `order_items`, `payments`          |
| `reservations.ts`       | `reservations`                               |
| `notifications.ts`      | `notifications`                              |
| `index.ts`              | Re-export semua schema + enums               |

Setiap file harus:
- Definisikan `relations()` (Drizzle relational query builder).
- Export tabel dan relations.

**Prompt:**
```
Referensi: DATABASE_DESIGN.md (Tables — semua 15 tabel, kolom, tipe, constraint, index).

Kerjakan Task T-1.2: Drizzle Table Schemas.
Dependensi: T-1.1 sudah selesai (enum sudah ada di packages/core/src/db/schema/enums.ts).

Buat file schema per domain di `packages/core/src/db/schema/`:

1. `users.ts` — tabel: users, seller_profiles, refresh_tokens.
2. `events.ts` — tabel: events, event_categories, event_images, categories.
3. `tickets.ts` — tabel: ticket_tiers (dengan CHECK constraint: sold_count >= 0 AND sold_count <= quota), tickets, ticket_checkins.
4. `orders.ts` — tabel: orders, order_items, payments.
5. `reservations.ts` — tabel: reservations.
6. `notifications.ts` — tabel: notifications.
7. `index.ts` — re-export semua schema + enums.

Untuk SETIAP file:
- Ikuti PERSIS kolom, tipe data, constraint, dan index dari DATABASE_DESIGN.md. Jangan mengarang kolom.
- Import enum dari ./enums.ts.
- Definisikan relations() menggunakan Drizzle relational query builder.
- Export tabel dan relations.

Gunakan: pgTable, uuid, varchar, text, boolean, integer, numeric, serial, timestamptz, jsonb, primaryKey, uniqueIndex, index dari drizzle-orm/pg-core.
```

### Task 1.3 — Database Connection [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-1.3`                                                   |
| Dependensi  | `T-1.2`                                                   |
| Deliverables| `packages/core/src/db/index.ts` yang sudah terkoneksi      |

**Instruksi:**
1. Buat koneksi PostgreSQL menggunakan `postgres` driver.
2. Buat `drizzle()` instance dengan schema.
3. Export `db` instance dan type `Database`.
4. Untuk edge (Cloudflare Workers): koneksi via Hyperdrive URL yang di-pass sebagai binding.

**Prompt:**
```
Kerjakan Task T-1.3: Database Connection.
Dependensi: T-1.2 sudah selesai (semua schema sudah ada di packages/core/src/db/schema/).

Update file `packages/core/src/db/index.ts`:
1. Import `drizzle` dari drizzle-orm/postgres-js dan `postgres` dari postgres.
2. Buat fungsi `createDb(databaseUrl: string)` yang:
   - Buat koneksi PostgreSQL menggunakan postgres driver dengan databaseUrl.
   - Buat drizzle() instance dengan schema (import dari ./schema/index.ts).
   - Return db instance.
3. Export fungsi `createDb` dan type `Database` (ReturnType dari createDb).
4. Untuk development lokal: baca DATABASE_URL dari process.env.
5. Untuk Cloudflare Workers (edge): koneksi menerima Hyperdrive URL yang di-pass sebagai parameter.

Pastikan compatible dengan Cloudflare Workers runtime (jangan gunakan Node.js-only APIs).
```

### Task 1.4 — Run Migration [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-1.4`                                                   |
| Dependensi  | `T-1.3`                                                   |
| Deliverables| Database PostgreSQL lokal berisi 15 tabel + 10 enum        |

**Instruksi:**
1. Jalankan `pnpm drizzle-kit push` dari `packages/core` untuk development.
2. Verifikasi semua tabel sudah terbuat dengan `pnpm drizzle-kit studio`.
3. Buat seed script: `packages/core/src/db/seed.ts`:
   - 1 admin user (email: `admin@jeevatix.id`).
   - 5 kategori dummy (Musik, Olahraga, Workshop, Konser, Festival).
   - 1 seller user + seller_profile.
   - 2 events dummy dengan masing-masing 2-3 ticket_tiers.

**Prompt:**
```
Kerjakan Task T-1.4: Run Migration & Seed.
Dependensi: T-1.3 sudah selesai (DB connection sudah tersedia).

1. Pastikan PostgreSQL sudah running via Docker Compose: `docker compose up -d`.
2. Pastikan DATABASE_URL di .env sudah benar (default: postgresql://jeevatix:jeevatix@localhost:5432/jeevatix).
3. Jalankan `cd packages/core && pnpm drizzle-kit push` untuk membuat semua tabel di database.
3. Verifikasi dengan `pnpm drizzle-kit studio` — harus terlihat 15 tabel dan 10 enum.
4. Buat file `packages/core/src/db/seed.ts` yang:
   - Import db dari ./index.ts dan semua schema.
   - Insert 1 admin user (email: admin@jeevatix.id, password: hash dari "Admin123!", role: admin, email_verified_at: now).
   - Insert 5 kategori: Musik, Olahraga, Workshop, Konser, Festival (dengan slug masing-masing).
   - Insert 1 seller user (email: seller@jeevatix.id, role: seller) + 1 seller_profile (org_name: "EventPro Indonesia", is_verified: true).
   - Insert 2 events dummy (status: published, dengan data lengkap venue, tanggal, dll) + event_categories + masing-masing 2-3 ticket_tiers.
5. Jalankan `pnpm tsx src/db/seed.ts` dan pastikan data masuk tanpa error.

Gunakan bcryptjs untuk hash password. Pastikan seed idempotent (cek dulu apakah data sudah ada sebelum insert).
```

**Checkpoint Phase 1:**
```bash
cd packages/core
pnpm drizzle-kit push    # harus sukses, tabel terbuat
pnpm tsx src/db/seed.ts  # data seed berhasil dimasukkan
```

---

## Phase 2: Auth & User API

**Tujuan:** Sistem autentikasi lengkap (register, login, JWT) + user profile endpoints.

### Task 2.1 — Auth Middleware & Utilities [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-2.1`                                                   |
| Dependensi  | `T-0.5`, `T-1.3`                                          |
| Deliverables| `apps/api/src/middleware/auth.ts`, `apps/api/src/lib/password.ts`, `apps/api/src/lib/jwt.ts` |

**Instruksi:**
1. `password.ts` — hash & verify password (gunakan `bcryptjs` atau Web Crypto API yang edge-compatible).
2. `jwt.ts` — generate & verify JWT token (gunakan `hono/jwt` atau `jose` library yang edge-compatible).
3. `auth.ts` — Hono middleware yang:
   - Extract JWT dari `Authorization: Bearer <token>` header.
   - Verify token → attach `user` ke Hono context.
   - Export `authMiddleware` (wajib login) dan `roleMiddleware(role)` (cek role).
4. `cors.ts` — Setup CORS middleware menggunakan `hono/cors`. Whitelist origin: `localhost:4301`, `localhost:4302`, `localhost:4303` (dev). Production: domain frontend sesungguhnya.

**Prompt:**
```
Referensi: DATABASE_DESIGN.md (users, refresh_tokens), PAGES.md (Auth API E1-E7, E63).

Kerjakan Task T-2.1: Auth Middleware & Utilities.
Dependensi: T-0.5 dan T-1.3 sudah selesai.

Buat file-file berikut di `apps/api/src/`:

1. `lib/password.ts` — fungsi hashPassword(password) dan verifyPassword(password, hash). Gunakan bcryptjs atau Web Crypto API yang edge-compatible (Cloudflare Workers). JANGAN gunakan Node.js native crypto.

2. `lib/jwt.ts` — fungsi generateAccessToken(payload, secret), generateRefreshToken(payload, secret), verifyToken(token, secret). Gunakan hono/jwt atau jose library. Access token expiry: 15 menit, refresh token expiry: 7 hari.

3. `middleware/auth.ts` — Hono middleware:
   - authMiddleware: extract JWT dari header Authorization: Bearer <token>, verify, attach user (id, email, role) ke Hono context (c.set('user', ...)).
   - roleMiddleware(...roles): cek apakah user.role termasuk dalam roles yang diizinkan, return 403 jika tidak.

4. `middleware/cors.ts` — Setup CORS menggunakan hono/cors. Whitelist origin: http://localhost:4301, http://localhost:4302, http://localhost:4303. Allow credentials. Methods: GET, POST, PATCH, DELETE, OPTIONS.

Semua library HARUS compatible dengan Cloudflare Workers runtime.
```

### Task 2.2 — Auth API Endpoints [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-2.2`                                                   |
| Dependensi  | `T-2.1`                                                   |
| Deliverables| `apps/api/src/routes/auth.ts`, `apps/api/src/services/auth.service.ts`, `apps/api/src/schemas/auth.schema.ts` |
| Endpoints   | E1–E7, E63 (lihat PAGES.md → Auth API)                     |

**Instruksi:**
1. Buat Zod schemas di `schemas/auth.schema.ts` — registerSchema, loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema.
2. Buat business logic di `services/auth.service.ts` — register(), login(), refresh(), forgotPassword(), resetPassword(), verifyEmail(), logout().
3. Buat OpenAPIHono router di `routes/auth.ts` — definisikan setiap route dengan `createRoute()` + `app.openapi()`, handler parse request via `c.req.valid()` → call authService → return response.
4. Implementasi:
   - `POST /auth/register` → validasi input, hash password, insert ke `users`, return access token + refresh token.
   - `POST /auth/register/seller` → insert ke `users` (role=seller) + insert ke `seller_profiles`.
   - `POST /auth/login` → cek email+password, return access token + refresh token + user data. Simpan refresh token hash ke `refresh_tokens`.
   - `POST /auth/refresh` → verify refresh token, generate access token baru + rotate refresh token baru. Revoke token lama.
   - `POST /auth/forgot-password` → generate token, enqueue email.
   - `POST /auth/reset-password` → verify token, update password_hash.
   - `POST /auth/verify-email` → update `email_verified_at`.
   - `POST /auth/logout` → revoke refresh token di tabel `refresh_tokens`.
3. Input validation menggunakan `zod` (pnpm add zod di apps/api).
4. Access token expiry: 15 menit. Refresh token expiry: 7 hari.

**Prompt:**
```
Referensi: PAGES.md (Auth API E1-E7, E63), DATABASE_DESIGN.md (users, seller_profiles, refresh_tokens).

Kerjakan Task T-2.2: Auth API Endpoints.
Dependensi: T-2.1 sudah selesai (middleware auth, password, jwt sudah ada).

Buat 3 file:

**File 1: `apps/api/src/schemas/auth.schema.ts`:**
- registerSchema: { email, password.min(8), full_name, phone? }.openapi('RegisterInput')
- registerSellerSchema: extends registerSchema + { org_name, org_description? }.openapi('RegisterSellerInput')
- loginSchema: { email, password }.openapi('LoginInput')
- refreshSchema: { refresh_token }.openapi('RefreshInput')
- forgotPasswordSchema: { email }.openapi('ForgotPasswordInput')
- resetPasswordSchema: { token, password }.openapi('ResetPasswordInput')

**File 2: `apps/api/src/services/auth.service.ts`:**
- register(input): hash password, insert ke users (role: buyer), generate tokens. Return { access_token, refresh_token, user }.
- registerSeller(input): insert ke users (role: seller) + seller_profiles. Return tokens.
- login(input): cek email, verify password, simpan refresh token hash ke refresh_tokens. Return { access_token, refresh_token, user }.
- refresh(input): verify token, cek hash di DB, rotate tokens. Revoke token lama.
- forgotPassword(input): generate reset token, placeholder enqueue email.
- resetPassword(input): verify token, update password_hash.
- verifyEmail(token): update email_verified_at = now().
- logout(refreshToken): revoke di refresh_tokens.

**File 3: `apps/api/src/routes/auth.ts`** — Tags: ['Auth']:
- POST /register — Register buyer. Call authService.register().
- POST /register/seller — Register seller. Call authService.registerSeller().
- POST /login — Login, return tokens + user data. Call authService.login().
- POST /refresh — Rotate tokens. Call authService.refresh().
- POST /forgot-password — Generate reset token, enqueue email. Call authService.forgotPassword().
- POST /reset-password — Verify token, update password. Call authService.resetPassword().
- POST /verify-email — Update email_verified_at. Call authService.verifyEmail().
- POST /logout — Revoke refresh token. Call authService.logout().

Access token expiry: 15 menit. Refresh token expiry: 7 hari.
Mount router di apps/api/src/index.ts.
```

### Task 2.3 — User API Endpoints [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-2.3`                                                   |
| Dependensi  | `T-2.2`                                                   |
| Deliverables| `apps/api/src/routes/users.ts`, `apps/api/src/services/user.service.ts`, `apps/api/src/schemas/user.schema.ts` |
| Endpoints   | E8–E10 (lihat PAGES.md → User API)                         |

**Instruksi:**
1. Buat schemas di `schemas/user.schema.ts` — updateProfileSchema, changePasswordSchema.
2. Buat logic di `services/user.service.ts` — getMe(), updateProfile(), changePassword().
3. Buat OpenAPIHono router di `routes/users.ts` → definisikan route dengan `createRoute()` + `app.openapi()`, handler `c.req.valid()` → call userService → return response.

**Prompt:**
```
Referensi: PAGES.md (User API E8-E10), DATABASE_DESIGN.md (users).

Kerjakan Task T-2.3: User API Endpoints.
Dependensi: T-2.2 sudah selesai.

Buat 3 file:

**File 1: `apps/api/src/schemas/user.schema.ts`:**
- updateProfileSchema: { full_name?, phone?, avatar_url? }.openapi('UpdateProfileInput')
- changePasswordSchema: { old_password, new_password.min(8) }.openapi('ChangePasswordInput')

**File 2: `apps/api/src/services/user.service.ts`:**
- getMe(userId): query user by id, exclude password_hash.
- updateProfile(userId, input): update fields yang dikirim saja.
- changePassword(userId, input): verify old_password, hash new_password, update.

**File 3: `apps/api/src/routes/users.ts`** — Tags: ['User'], protected (authMiddleware):
1. GET /users/me — Get current user. Call userService.getMe().
2. PATCH /users/me — Update profile. Call userService.updateProfile().
3. PATCH /users/me/password — Change password. Call userService.changePassword().

Mount router di apps/api/src/index.ts.
```

### Task 2.4 — Auth Unit Tests [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-2.4`                                                   |
| Dependensi  | `T-2.2`, `T-2.3`                                          |
| Deliverables| `apps/api/src/routes/__tests__/auth.test.ts`               |

**Instruksi:**
1. Setup Vitest di `apps/api`.
2. Test: register → login → get profile → update profile → change password.
3. Test: register dengan email duplikat → 409 Conflict.
4. Test: login dengan password salah → 401 Unauthorized.
5. Test: akses protected route tanpa token → 401.
6. Test: akses admin route dengan role buyer → 403 Forbidden.
7. Test: refresh token flow → access token baru valid.

**Prompt:**
```
Kerjakan Task T-2.4: Auth Unit Tests.
Dependensi: T-2.2 dan T-2.3 sudah selesai.

1. Setup Vitest di `apps/api`: install vitest, tambahkan script "test": "vitest run" di package.json.
2. Buat file `apps/api/src/routes/__tests__/auth.test.ts`.
3. Tulis test cases:
   a. Register buyer → harus return 201 + access_token + refresh_token.
   b. Register dengan email duplikat → harus return 409 Conflict.
   c. Login dengan credentials valid → harus return 200 + access_token + refresh_token + user data.
   d. Login dengan password salah → harus return 401 Unauthorized.
   e. GET /users/me dengan valid token → harus return 200 + user data.
   f. GET /users/me tanpa token → harus return 401.
   g. PATCH /users/me → update full_name berhasil.
   h. PATCH /users/me/password → ubah password berhasil, login dengan password baru berhasil.
   i. POST /auth/refresh dengan valid refresh token → return access token baru.
   j. Akses admin endpoint dengan role buyer → harus return 403 Forbidden.

Gunakan Hono test helper (app.request()) untuk test tanpa server.
Pastikan semua test pass: `cd apps/api && pnpm test`.
```

### Task 2.5 — File Upload Service (Cloudflare R2) [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-2.5`                                                   |
| Dependensi  | `T-2.1`                                                   |
| Deliverables| `apps/api/src/routes/upload.ts`, `apps/api/src/services/upload.service.ts`, `apps/api/src/schemas/upload.schema.ts`, R2 bucket config di `wrangler.toml` |
| Endpoints   | E64 (lihat PAGES.md → File Upload API)                     |

**Instruksi:**
1. Konfigurasi R2 bucket binding di `wrangler.toml`.
2. `POST /upload` → terima file multipart (image), validasi tipe (jpg/png/webp) & ukuran (max 5MB).
3. Upload ke R2 dengan key unik (uuid + extension).
4. Return URL publik R2.
5. Endpoint ini digunakan oleh semua form yang butuh upload gambar (avatar, logo, banner, galeri event).
6. Proteksi: harus authenticated.

**Prompt:**
```
Kerjakan Task T-2.5: File Upload Service (Cloudflare R2).
Dependensi: T-2.1 sudah selesai (auth middleware tersedia).

1. Tambahkan R2 bucket binding di `apps/api/wrangler.toml`:
   ```toml
   [[r2_buckets]]
   binding = "BUCKET"
   bucket_name = "jeevatix-uploads"
   ```
Buat 3 file:

2. **`apps/api/src/schemas/upload.schema.ts`:** — Validasi konstanta: ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'], MAX_SIZE = 5 * 1024 * 1024. uploadResponseSchema: { url }.openapi('UploadResponse').
3. **`apps/api/src/services/upload.service.ts`:** — uploadFile(env, file): validasi tipe & ukuran, generate key unik `uploads/{uuid}.{extension}`, upload ke R2, return { url }.
4. **`apps/api/src/routes/upload.ts`** — Tags: ['Upload'], protected (authMiddleware). POST /upload — Terima multipart form data, call uploadService.uploadFile().
5. Mount router di apps/api/src/index.ts.

Endpoint ini akan digunakan oleh semua form upload gambar: avatar user, logo seller, banner event, galeri event.
```

### Task 2.6 — Email Service [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-2.6`                                                   |
| Dependensi  | `T-0.5`                                                   |
| Deliverables| `apps/api/src/services/email.ts`                           |

**Instruksi:**
1. Buat email service menggunakan provider transactional email (Resend atau Mailgun).
2. Method: `sendEmail(to, subject, htmlBody)`.
3. Integrasikan dengan Cloudflare Queue: email dikirim secara async melalui queue consumer.
4. Template email: verifikasi email, reset password, e-ticket konfirmasi.
5. Konfigurasi API key via environment variable / SST secret.

**Prompt:**
```
Kerjakan Task T-2.6: Email Service.
Dependensi: T-0.5 sudah selesai (apps/api sudah ada).

Buat file `apps/api/src/services/email.ts`:

1. Buat class/module EmailService dengan method:
   - sendEmail(to: string, subject: string, htmlBody: string): Promise<void>
2. Gunakan Resend SDK atau fetch ke Resend/Mailgun API (pilih salah satu). API key dibaca dari environment variable (c.env.EMAIL_API_KEY).
3. Buat email template functions:
   - buildVerificationEmail(userName: string, verifyUrl: string): {subject, html}
   - buildResetPasswordEmail(userName: string, resetUrl: string): {subject, html}
   - buildOrderConfirmationEmail(userName: string, orderNumber: string, items: Array): {subject, html}
   - buildETicketEmail(userName: string, tickets: Array): {subject, html}
4. Email akan dikirim secara async melalui Cloudflare Queue (consumer akan memanggil sendEmail). Untuk saat ini buat service-nya dulu, integrasi Queue di Phase 6 (T-6.5).
5. Tambahkan EMAIL_API_KEY dan EMAIL_FROM ke .env.example.

Pastikan compatible dengan Cloudflare Workers runtime (gunakan fetch, bukan nodemailer).
```

**Checkpoint Phase 2:**
```bash
cd apps/api
pnpm test              # auth tests pass
# Verify OpenAPI spec:
curl http://localhost:8787/doc  # JSON spec harus include /auth/* endpoints
# Manual test:
curl -X POST http://localhost:8787/auth/register -d '{"email":"test@test.com","password":"Test123!","full_name":"Test"}'
curl -X POST http://localhost:8787/auth/login -d '{"email":"test@test.com","password":"Test123!"}'
```

---

## Phase 3: Admin Portal — Category & User Management

**Tujuan:** Admin bisa login, kelola kategori (CRUD), dan kelola user/seller.

### Task 3.1 — Category Admin API [DONE]

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-3.1`                                                   |
| Dependensi  | `T-2.1`                                                   |
| Deliverables| `apps/api/src/routes/admin/categories.ts`, `apps/api/src/services/category.service.ts`, `apps/api/src/schemas/category.schema.ts` |
| Endpoints   | E57–E60 (lihat PAGES.md → Admin API)                        |

**Instruksi:**
1. Admin: CRUD `GET/POST/PATCH/DELETE /admin/categories`.
2. Auto-generate slug dari name.
3. Validasi: jangan hapus kategori yang masih punya event.

> **Note:** Public category endpoints (`GET /categories`, `GET /categories/:slug/events`) di-implementasi di T-5.1 (Public Event API) bersama endpoint publik lainnya, untuk menghindari duplikasi route.

**Prompt:**
```
Referensi: PAGES.md (Admin API E57-E60), DATABASE_DESIGN.md (categories, event_categories).

Kerjakan Task T-3.1: Category Admin API.
Dependensi: T-2.1 sudah selesai.

> PENTING: Public category endpoints (GET /categories, GET /categories/:slug/events) TIDAK dibuat di task ini. Endpoint tersebut dibuat di T-5.1 (Public Event API).

Buat 3 file:

**File 1: `apps/api/src/schemas/category.schema.ts`:**
- createCategorySchema: { name, icon? }.openapi('CreateCategoryInput')
- updateCategorySchema: { name?, icon? }.openapi('UpdateCategoryInput')
- categoryResponseSchema: { id, name, slug, icon, eventCount? }.openapi('CategoryResponse')

**File 2: `apps/api/src/services/category.service.ts`:**
- listAdmin(): list kategori + jumlah event per kategori.
- create(input): auto-generate slug, validasi name unique, insert.
- update(id, input): re-generate slug jika name berubah.
- remove(id): validasi tidak ada event terhubung via event_categories, hapus.

**File 3: `apps/api/src/routes/admin/categories.ts`:**
1. GET /admin/categories — Admin only. List + event count. Call categoryService.listAdmin().
2. POST /admin/categories — Admin only. Create category. Call categoryService.create().
3. PATCH /admin/categories/:id — Admin only. Update category. Call categoryService.update().
4. DELETE /admin/categories/:id — Admin only. Delete (error jika masih ada event). Call categoryService.remove().

Mount di index.ts.
```

### Task 3.2 — Admin Auth UI (Login)

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-3.2`                                                   |
| Dependensi  | `T-0.7`, `T-2.2`                                          |
| Deliverables| Admin login page (A1 dari PAGES.md)                        |

**Instruksi:**
1. Buat `apps/admin/src/routes/login/+page.svelte` — form email + password.
2. Buat `apps/admin/src/lib/api.ts` — HTTP client wrapper untuk call API.
3. Buat `apps/admin/src/lib/auth.ts` — simpan JWT di cookie/localStorage, redirect logic.
4. Buat auth guard di `+layout.server.ts` → redirect ke `/login` jika belum login, redirect ke `/` jika sudah login dan role = admin.

**Prompt:**
```
Referensi: PAGES.md (Admin Portal Auth A1).

Kerjakan Task T-3.2: Admin Auth UI (Login).
Dependensi: T-0.7 dan T-2.2 sudah selesai.

Di `apps/admin/`:

1. Buat `src/lib/api.ts` — HTTP client wrapper (fetch) untuk call API di localhost:8787. Fungsi: apiGet, apiPost, apiPatch, apiDelete. Otomatis attach Authorization header dari stored token. Handle error response.
2. Buat `src/lib/auth.ts` — fungsi login(email, password), logout(), getUser(), isAuthenticated(). Simpan access_token dan refresh_token di cookie (httpOnly) atau localStorage. Implementasi auto-refresh: jika access token expired, panggil POST /auth/refresh.
3. Buat `src/routes/login/+page.svelte` — form email + password + tombol Login. Panggil API POST /auth/login. Jika sukses dan role=admin, redirect ke /. Jika role bukan admin, tampilkan error.
4. Buat auth guard di `src/routes/+layout.server.ts` atau `+layout.ts` — cek apakah user sudah login dan role=admin. Jika belum, redirect ke /login. Exclude halaman /login dari guard.
```

### Task 3.3 — Admin Category Management UI

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-3.3`                                                   |
| Dependensi  | `T-3.1`, `T-3.2`                                          |
| Deliverables| Admin category page (A13 dari PAGES.md)                    |

**Instruksi:**
1. Buat `apps/admin/src/routes/categories/+page.svelte`:
   - Tabel: nama, slug, icon, jumlah event.
   - Tombol: Tambah, Edit (modal), Hapus (konfirmasi).
2. Gunakan DataTable dari `@jeevatix/ui`.

**Prompt:**
```
Referensi: PAGES.md (Admin Portal A13 — Manajemen Kategori).

Kerjakan Task T-3.3: Admin Category Management UI.
Dependensi: T-3.1 dan T-3.2 sudah selesai.

Di `apps/admin/`:

Buat `src/routes/categories/+page.svelte`:
1. Fetch GET /admin/categories saat page load.
2. Tampilkan DataTable dengan kolom: Nama, Slug, Icon, Jumlah Event, Aksi.
3. Tombol "Tambah Kategori" → buka modal form (name, icon). Submit POST /admin/categories.
4. Tombol Edit per row → buka modal form pre-filled. Submit PATCH /admin/categories/:id.
5. Tombol Hapus per row → konfirmasi dialog. Submit DELETE /admin/categories/:id. Tampilkan error toast jika kategori masih punya event.
6. Setelah setiap aksi CRUD, refresh tabel.
```

### Task 3.4 — Admin User Management API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-3.4`                                                   |
| Dependensi  | `T-2.1`                                                   |
| Deliverables| `apps/api/src/routes/admin/users.ts`, `apps/api/src/services/admin-user.service.ts`, `apps/api/src/schemas/admin-user.schema.ts` |
| Endpoints   | E45–E49 (lihat PAGES.md → Admin API)                       |

**Instruksi:**
1. `GET /admin/users` → list + filter by role, status + search by name/email + pagination.
2. `GET /admin/users/:id` → detail user + seller_profile (jika seller).
3. `PATCH /admin/users/:id/status` → ubah status (active/suspended/banned).
4. `GET /admin/sellers` → list seller + is_verified status.
5. `PATCH /admin/sellers/:id/verify` → set is_verified = true/false.

**Prompt:**
```
Referensi: PAGES.md (Admin API E45-E49), DATABASE_DESIGN.md (users, seller_profiles).

Kerjakan Task T-3.4: Admin User Management API.
Dependensi: T-2.1 sudah selesai.

Buat 3 file:

**File 1: `apps/api/src/schemas/admin-user.schema.ts`:**
- listUsersQuerySchema: { role?, status?, search?, page?, limit? }.openapi('ListUsersQuery')
- updateUserStatusSchema: { status: enum['active','suspended','banned'] }.openapi('UpdateUserStatusInput')
- verifySellerSchema: { is_verified: boolean }.openapi('VerifySellerInput')

**File 2: `apps/api/src/services/admin-user.service.ts`:**
- listUsers(query): filter by role/status, search ILIKE name/email, paginated.
- getUserDetail(id): join seller_profiles jika seller. Include order/ticket count.
- updateUserStatus(id, status, adminId): jangan bisa ubah status admin sendiri.
- listSellers(query): filter by is_verified, paginated.
- verifySeller(id, isVerified, adminId): set is_verified, verified_at, verified_by.

**File 3: `apps/api/src/routes/admin/users.ts`** — admin-only via roleMiddleware('admin'):
1. GET /admin/users — List users (filter role/status/search). Call adminUserService.listUsers().
2. GET /admin/users/:id — User detail. Call adminUserService.getUserDetail().
3. PATCH /admin/users/:id/status — Update user status. Call adminUserService.updateUserStatus().
4. GET /admin/sellers — List sellers. Call adminUserService.listSellers().
5. PATCH /admin/sellers/:id/verify — Verify seller. Call adminUserService.verifySeller().

Mount di index.ts.
```

### Task 3.5 — Admin User Management UI

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-3.5`                                                   |
| Dependensi  | `T-3.4`, `T-3.2`                                          |
| Deliverables| Admin user pages (A3–A6 dari PAGES.md)                     |

**Instruksi:**
1. `apps/admin/src/routes/users/+page.svelte` — tabel user + filter + search.
2. `apps/admin/src/routes/users/[id]/+page.svelte` — detail user + aksi suspend/ban.
3. `apps/admin/src/routes/sellers/+page.svelte` — daftar seller.
4. `apps/admin/src/routes/sellers/[id]/+page.svelte` — detail seller + tombol verify/reject.

**Prompt:**
```
Referensi: PAGES.md (Admin Portal A3-A6: Users dan Sellers).

Kerjakan Task T-3.5: Admin User Management UI.
Dependensi: T-3.4 dan T-3.2 sudah selesai.

Di `apps/admin/`:

1. `src/routes/users/+page.svelte` — DataTable semua user. Filter dropdown: role (all/buyer/seller/admin), status (all/active/suspended/banned). Search bar. Pagination. Klik row → navigate ke /users/[id].
2. `src/routes/users/[id]/+page.svelte` — Detail user: info profil, seller profile (jika seller), statistik order/tiket. Tombol aksi: Suspend, Ban, Activate (PATCH /admin/users/:id/status). Konfirmasi dialog sebelum aksi.
3. `src/routes/sellers/+page.svelte` — DataTable seller. Filter: verified/unverified. Kolom: Nama Organisasi, Email, Status Verifikasi, Jumlah Event. Klik row → navigate ke /sellers/[id].
4. `src/routes/sellers/[id]/+page.svelte` — Detail seller: data organisasi, data bank, daftar event. Tombol "Verify" (set is_verified=true) dan "Reject" (set is_verified=false). Konfirmasi dialog.
```

### Task 3.6 — Phase 3 API Tests

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-3.6`                                                   |
| Dependensi  | `T-3.1`, `T-3.4`                                          |
| Deliverables| `apps/api/src/__tests__/categories.test.ts`, `apps/api/src/__tests__/admin-users.test.ts` |

**Instruksi:**
1. Test category admin CRUD flow: create → list → update → delete.
2. Test delete category yang masih punya event → 409.
3. Test admin user management: list users, filter by role, get detail, update status, verify seller.
4. Test authorization: non-admin tidak bisa akses admin routes.

> **Note:** Public category endpoints (GET /categories, GET /categories/:slug/events) di-test di T-5.5 (Phase 5 Tests) karena endpoint tersebut dibuat di T-5.1.

**Prompt:**
```
Kerjakan Task T-3.6: Phase 3 API Tests.
Dependensi: T-3.1 dan T-3.4 sudah selesai.

Buat test files di `apps/api/src/__tests__/`:

1. `categories.test.ts`:
   a. GET /admin/categories → return list categories with event count.
   b. POST /admin/categories → create category, return 201. Cek slug auto-generated.
   c. POST /admin/categories dengan nama duplikat → 409 Conflict.
   d. PATCH /admin/categories/:id → update nama, slug berubah.
   e. DELETE /admin/categories/:id (tanpa event) → 200 OK.
   f. DELETE /admin/categories/:id (dengan event) → 409 Conflict.
   g. Non-admin POST /admin/categories → 403 Forbidden.

2. `admin-users.test.ts`:
   a. GET /admin/users → return paginated list.
   b. GET /admin/users?role=seller → filter by role.
   c. GET /admin/users/:id → return user detail.
   d. PATCH /admin/users/:id/status → update status.
   e. PATCH /admin/sellers/:id/verify → set is_verified=true.
   f. Non-admin akses → 403 Forbidden.

Gunakan Hono test helper (app.request()). Pastikan semua test pass: `cd apps/api && pnpm test`.
```

**Checkpoint Phase 3:**
```bash
cd apps/api && pnpm test   # category + admin user tests pass
# Admin bisa login, CRUD kategori, lihat & kelola user, verifikasi seller
open http://localhost:4302/login      # login sebagai admin
open http://localhost:4302/categories # CRUD kategori
open http://localhost:4302/users      # list user
open http://localhost:4302/sellers    # verifikasi seller
```

---

## Phase 4: Seller Portal — Event & Tier Management

**Tujuan:** Seller bisa login, CRUD event, kelola tier tiket.

### Task 4.1 — Seller Auth & Profile API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-4.1`                                                   |
| Dependensi  | `T-2.2`                                                   |
| Deliverables| `apps/api/src/routes/seller/profile.ts`, `apps/api/src/services/seller-profile.service.ts`, `apps/api/src/schemas/seller-profile.schema.ts` |
| Endpoints   | E39–E40 (lihat PAGES.md)                                   |

**Instruksi:**
1. `GET /seller/profile` → return seller_profiles + users data.
2. `PATCH /seller/profile` → update org_name, org_description, logo_url, bank info.

**Prompt:**
```
Referensi: PAGES.md (Seller Profile API E39-E40), DATABASE_DESIGN.md (users, seller_profiles).

Kerjakan Task T-4.1: Seller Auth & Profile API.
Dependensi: T-2.2 sudah selesai.

Buat 3 file:

**File 1: `apps/api/src/schemas/seller-profile.schema.ts`:**
- updateSellerProfileSchema: { org_name?, org_description?, logo_url?, bank_name?, bank_account_number?, bank_account_holder? }.openapi('UpdateSellerProfileInput')

**File 2: `apps/api/src/services/seller-profile.service.ts`:**
- getProfile(userId): join users + seller_profiles berdasarkan user_id.
- updateProfile(userId, input): update seller_profiles fields yang dikirim saja.

**File 3: `apps/api/src/routes/seller/profile.ts`** — seller-only via authMiddleware + roleMiddleware('seller'):
1. GET /seller/profile — Get seller profile. Call sellerProfileService.getProfile().
2. PATCH /seller/profile — Update seller profile. Call sellerProfileService.updateProfile().

Mount di apps/api/src/index.ts dengan prefix /seller.
```

### Task 4.2 — Seller Event CRUD API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-4.2`                                                   |
| Dependensi  | `T-2.1`, `T-1.3`                                          |
| Deliverables| `apps/api/src/routes/seller/events.ts`, `apps/api/src/services/event.service.ts`, `apps/api/src/schemas/event.schema.ts` |
| Endpoints   | E16–E20 (lihat PAGES.md → Event API Seller)                |

**Instruksi:**
1. `GET /seller/events` → list events milik seller (filter by status) + join ticket_tiers untuk statistik.
2. `POST /seller/events` → buat event baru + event_categories + event_images + ticket_tiers. Gunakan database transaction.
3. `GET /seller/events/:id` → detail event + statistik penjualan.
4. `PATCH /seller/events/:id` → update semua field event. Validasi: hanya event milik seller ini.
5. `DELETE /seller/events/:id` → hapus event (hanya status `draft`). Cascade ke event_categories, event_images, ticket_tiers.
6. **Event status flow:** Seller membuat event (`draft`) → submit untuk review (`pending_review`) → Admin approve (`published`) atau tolak (`rejected`). Seller bisa edit event `rejected` lalu submit ulang.

**Prompt:**
```
Referensi: PAGES.md (Seller Event API E16-E20), DATABASE_DESIGN.md (events, event_categories, event_images, ticket_tiers, seller_profiles).

Kerjakan Task T-4.2: Seller Event CRUD API.
Dependensi: T-2.1 dan T-1.3 sudah selesai.

Buat 3 file:

**File 1: `apps/api/src/schemas/event.schema.ts`:**
- createEventSchema: { title, description, venue_name, venue_address, venue_city, venue_latitude?, venue_longitude?, start_at, end_at, sale_start_at, sale_end_at, banner_url?, max_tickets_per_order?, category_ids: array(number), images: array({image_url, sort_order}), tiers: array({name, description?, price, quota, sort_order, sale_start_at?, sale_end_at?}) }.openapi('CreateEventInput')
- updateEventSchema: partial dari createEventSchema.openapi('UpdateEventInput')
- Validasi temporal: end_at > start_at, sale_end_at > sale_start_at, sale_start_at <= start_at.

**File 2: `apps/api/src/services/event.service.ts`:**
- listSellerEvents(sellerProfileId, filters): filter by status, join ticket_tiers untuk statistik (total_quota, total_sold). Paginated.
- createEvent(sellerProfileId, input): database transaction — insert event (status: draft) + event_categories + event_images + ticket_tiers. Auto-generate slug.
- getSellerEvent(sellerProfileId, eventId): detail + images + categories + tiers + statistik. Validasi ownership.
- updateEvent(sellerProfileId, eventId, input): validasi ownership. Handle status flow: draft/rejected → pending_review.
- deleteEvent(sellerProfileId, eventId): hanya status draft. Cascade delete.

**File 3: `apps/api/src/routes/seller/events.ts`** — seller-only:
1. GET /seller/events — List seller events. Call eventService.listSellerEvents().
2. POST /seller/events — Create event. Call eventService.createEvent().
3. GET /seller/events/:id — Event detail. Call eventService.getSellerEvent().
4. PATCH /seller/events/:id — Update event. Call eventService.updateEvent().
5. DELETE /seller/events/:id — Delete event (draft only). Call eventService.deleteEvent().

Event status flow: draft → pending_review (seller submit) → published/rejected (admin review). Seller bisa edit event rejected lalu submit ulang ke pending_review.
Mount di index.ts.
```

### Task 4.3 — Ticket Tier CRUD API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-4.3`                                                   |
| Dependensi  | `T-4.2`                                                   |
| Deliverables| `apps/api/src/routes/seller/tiers.ts`, `apps/api/src/services/tier.service.ts`, `apps/api/src/schemas/tier.schema.ts` |
| Endpoints   | E21–E24 (lihat PAGES.md → Ticket Tier API Seller)          |

**Instruksi:**
1. CRUD tier tiket untuk event tertentu.
2. Validasi: jangan hapus tier yang sudah ada penjualan (sold_count > 0).
3. Validasi: seller hanya bisa kelola tier dari eventnya sendiri.

**Prompt:**
```
Referensi: PAGES.md (Ticket Tier API E21-E24), DATABASE_DESIGN.md (ticket_tiers).

Kerjakan Task T-4.3: Ticket Tier CRUD API.
Dependensi: T-4.2 sudah selesai.

Buat 3 file:

**File 1: `apps/api/src/schemas/tier.schema.ts`:**
- createTierSchema: { name, description?, price, quota, sort_order?, sale_start_at?, sale_end_at? }.openapi('CreateTierInput')
- updateTierSchema: partial dari createTierSchema + { status? }.openapi('UpdateTierInput')

**File 2: `apps/api/src/services/tier.service.ts`:**
- listTiers(sellerProfileId, eventId): validasi ownership, return semua tier.
- createTier(sellerProfileId, eventId, input): validasi ownership, insert.
- updateTier(sellerProfileId, eventId, tierId, input): validasi ownership + quota >= sold_count, jangan ubah price jika sold_count > 0.
- deleteTier(sellerProfileId, eventId, tierId): validasi ownership, jangan hapus jika sold_count > 0.

**File 3: `apps/api/src/routes/seller/tiers.ts`** — seller-only:
1. GET /seller/events/:id/tiers — List tiers. Call tierService.listTiers().
2. POST /seller/events/:id/tiers — Create tier. Call tierService.createTier().
3. PATCH /seller/events/:id/tiers/:tierId — Update tier. Call tierService.updateTier().
4. DELETE /seller/events/:id/tiers/:tierId — Delete tier. Call tierService.deleteTier().

Mount di index.ts.
```

### Task 4.4 — Seller Auth & Layout UI

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-4.4`                                                   |
| Dependensi  | `T-0.8`, `T-2.2`                                          |
| Deliverables| Seller auth pages (S1–S4 dari PAGES.md)                    |

**Instruksi:**
1. Login, Register (with org data), Forgot/Reset Password pages.
2. Sidebar layout dengan menu: Dashboard, Events, Orders, Check-in, Profile.
3. Auth guard: hanya role `seller`.

**Prompt:**
```
Referensi: PAGES.md (Seller Portal Auth S1-S4).

Kerjakan Task T-4.4: Seller Auth & Layout UI.
Dependensi: T-0.8 dan T-2.2 sudah selesai.

Di `apps/seller/`:

1. Buat `src/lib/api.ts` — HTTP client wrapper (mirip admin, tapi untuk seller). Fungsi: apiGet, apiPost, apiPatch, apiDelete. Attach Authorization header. Handle error. Auto-refresh token jika expired.
2. Buat `src/lib/auth.ts` — login, logout, getUser, isAuthenticated. Simpan tokens di cookie/localStorage.
3. Buat auth pages:
   - `src/routes/login/+page.svelte` — form email + password. Call POST /auth/login. Validasi role=seller.
   - `src/routes/register/+page.svelte` — form: email, password, full_name, phone, org_name, org_description. Call POST /auth/register/seller.
   - `src/routes/forgot-password/+page.svelte` — form email. Call POST /auth/forgot-password.
   - `src/routes/reset-password/+page.svelte` — form password baru. Call POST /auth/reset-password.
4. Update `src/routes/+layout.svelte` — sidebar menu: Dashboard, Events, Orders, Check-in, Notifications, Profile.
5. Auth guard di layout: redirect ke /login jika belum login atau role bukan seller.
```

### Task 4.5 — Seller Event Management UI

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-4.5`                                                   |
| Dependensi  | `T-4.2`, `T-4.3`, `T-4.4`                                 |
| Deliverables| Seller event pages (S6–S10 dari PAGES.md)                  |

**Instruksi:**
1. `apps/seller/src/routes/events/+page.svelte` → tabel daftar event.
2. `apps/seller/src/routes/events/create/+page.svelte` → form multi-step buat event.
3. `apps/seller/src/routes/events/[id]/+page.svelte` → detail event + statistik.
4. `apps/seller/src/routes/events/[id]/edit/+page.svelte` → edit event.
5. `apps/seller/src/routes/events/[id]/tiers/+page.svelte` → kelola tier tiket.

**Prompt:**
```
Referensi: PAGES.md (Seller Portal S6-S10: Event Management).

Kerjakan Task T-4.5: Seller Event Management UI.
Dependensi: T-4.2, T-4.3, T-4.4 sudah selesai.

Di `apps/seller/`:

1. `src/routes/events/+page.svelte` — DataTable daftar event milik seller. Kolom: Title, Status (badge warna), Tanggal, Tiket Terjual (sold/quota), Aksi. Filter by status: all/draft/pending_review/published/rejected/completed. Klik row → navigate ke detail.
2. `src/routes/events/create/+page.svelte` — Form multi-step:
   - Step 1: Info dasar (title, description/rich text, kategori multi-select).
   - Step 2: Lokasi & waktu (venue_name, venue_address, venue_city, koordinat, start_at, end_at, sale_start_at, sale_end_at).
   - Step 3: Gambar (banner upload via POST /upload, galeri images upload).
   - Step 4: Tier tiket (tambah/hapus tier: name, description, price, quota).
   - Step 5: Review & simpan (POST /seller/events).
3. `src/routes/events/[id]/+page.svelte` — Detail event: info, statistik penjualan per tier (progress bar sold/quota), grafik, daftar pesanan terbaru. Tombol: Edit, Submit Review (jika draft/rejected).
4. `src/routes/events/[id]/edit/+page.svelte` — Form edit event (sama dengan create, pre-filled).
5. `src/routes/events/[id]/tiers/+page.svelte` — CRUD tier tiket: tabel tier + form tambah/edit. Tampilkan sold_count. Disable delete jika sold_count > 0.

Upload gambar via POST /upload (T-2.5).
```

### Task 4.6 — Seller Profile UI

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-4.6`                                                   |
| Dependensi  | `T-4.1`, `T-4.4`                                          |
| Deliverables| Seller profile pages (S14–S15 dari PAGES.md)               |

**Instruksi:**
1. `apps/seller/src/routes/profile/+page.svelte` → edit profil organisasi.
2. `apps/seller/src/routes/profile/password/+page.svelte` → ubah password.

**Prompt:**
```
Referensi: PAGES.md (Seller Portal S14-S15: Profile & Settings).

Kerjakan Task T-4.6: Seller Profile UI.
Dependensi: T-4.1 dan T-4.4 sudah selesai.

Di `apps/seller/`:

1. `src/routes/profile/+page.svelte` — Form edit profil organisasi. Fetch GET /seller/profile saat load. Fields:
   - Org Name, Org Description (textarea), Logo (upload via POST /upload, preview gambar).
   - Data Bank: Bank Name, Account Number, Account Holder.
   - Tampilkan status verifikasi: Verified ✅ / Pending ⏳.
   - Tombol Simpan → PATCH /seller/profile.
2. `src/routes/profile/password/+page.svelte` — Form ubah password: Old Password, New Password, Confirm New Password. Submit PATCH /users/me/password.
```

### Task 4.7 — Phase 4 API Tests

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-4.7`                                                   |
| Dependensi  | `T-4.1`, `T-4.2`, `T-4.3`                                 |
| Deliverables| `apps/api/src/__tests__/seller-profile.test.ts`, `apps/api/src/__tests__/seller-events.test.ts` |

**Instruksi:**
1. Test seller profile: get profile, update profile.
2. Test seller event CRUD: create event → list → detail → update → submit for review.
3. Test tier CRUD: add tier → list → update → delete.
4. Test authorization: buyer tidak bisa akses seller routes.

**Prompt:**
```
Kerjakan Task T-4.7: Phase 4 API Tests.
Dependensi: T-4.1, T-4.2, dan T-4.3 sudah selesai.

Buat test files di `apps/api/src/__tests__/`:

1. `seller-profile.test.ts`:
   a. GET /seller/profile → return seller profile.
   b. PATCH /seller/profile → update org_name, bank info. Verify response.
   c. Buyer akses GET /seller/profile → 403 Forbidden.

2. `seller-events.test.ts`:
   a. POST /seller/events → create event, return 201 + event data.
   b. GET /seller/events → list events owned by seller.
   c. GET /seller/events/:id → event detail + tiers.
   d. PATCH /seller/events/:id → update event fields.
   e. POST /seller/events/:id/submit → ubah status ke pending_review.
   f. POST /seller/events → seller lain tidak bisa edit event milik seller lain.
   g. POST /seller/events/:id/tiers → create tier, return 201.
   h. PATCH /seller/events/:id/tiers/:tierId → update tier.
   i. DELETE /seller/events/:id/tiers/:tierId → delete tier (hanya jika belum ada sold).

Gunakan Hono test helper (app.request()). Pastikan semua test pass.
```

**Checkpoint Phase 4:**
```bash
cd apps/api && pnpm test   # seller profile + event + tier tests pass
# Seller bisa login, buat event, kelola tier, edit profil
open http://localhost:4303/login
open http://localhost:4303/events/create  # buat event + tier
open http://localhost:4303/events         # list events
# Verify OpenAPI spec:
curl http://localhost:8787/doc  # JSON spec harus include /seller/* endpoints
```

---

## Phase 5: Buyer Portal — Public Pages

**Tujuan:** Buyer bisa browse event, lihat detail, search & filter.

### Task 5.1 — Public Event API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-5.1`                                                   |
| Dependensi  | `T-1.3`                                                   |
| Deliverables| `apps/api/src/routes/events.ts`, `apps/api/src/services/public-event.service.ts`, `apps/api/src/schemas/public-event.schema.ts` |
| Endpoints   | E11–E15 (lihat PAGES.md → Event API Public)                |

**Instruksi:**
1. `GET /events` → list published events + filter (category, city, date range, price range) + search (title) + pagination.
2. `GET /events/featured` → events where `is_featured = true`.
3. `GET /events/:slug` → detail event by slug, join semua relasi.
4. `GET /categories` → list semua kategori.
5. `GET /categories/:slug/events` → events by kategori.
6. Hanya return events dengan `status = 'published'` atau `'ongoing'` untuk endpoint publik.
7. **Search strategy:** Gunakan PostgreSQL `ILIKE` untuk pencarian title. Untuk performa lebih baik, tambahkan `tsvector` column + GIN index pada `events.title` dan `events.description` untuk full-text search.

> **Note:** Public category endpoints (E14, E15) dibuat di task ini karena secara konteks lebih cocok di public event routes. T-3.1 hanya menangani admin CRUD category.

**Prompt:**
```
Referensi: PAGES.md (Event API Public E11-E15), DATABASE_DESIGN.md (events, categories, event_categories, event_images, ticket_tiers, seller_profiles).

Kerjakan Task T-5.1: Public Event API.
Dependensi: T-1.3 sudah selesai.

Buat 3 file:

**File 1: `apps/api/src/schemas/public-event.schema.ts`:**
- listEventsQuerySchema: { search?, category?, city?, date_from?, date_to?, price_min?, price_max?, page?, limit? }.openapi('ListEventsQuery')

**File 2: `apps/api/src/services/public-event.service.ts`:**
- listEvents(query): filter published/ongoing, ILIKE search, category join, city, date range, price range. Paginated. Return events + min_price.
- listFeatured(): is_featured = true, published/ongoing, limit 10.
- getBySlug(slug): detail event + images + categories + tiers (availability) + seller info.
- listCategories(): all categories.
- listByCategory(slug, pagination): events by kategori, published/ongoing.

**File 3: `apps/api/src/routes/events.ts`** — semua public/tanpa auth:
1. GET /events — List events (filter+search+pagination). Call publicEventService.listEvents().
2. GET /events/featured — Featured events. Call publicEventService.listFeatured().
3. GET /events/:slug — Event detail. Call publicEventService.getBySlug().
4. GET /categories — List categories. Call publicEventService.listCategories().
5. GET /categories/:slug/events — Events by category. Call publicEventService.listByCategory().

Search strategy: gunakan ILIKE untuk sekarang. Tambahkan tsvector + GIN index nanti jika perlu.
Mount di index.ts.
```

### Task 5.2 — Buyer Auth Pages

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-5.2`                                                   |
| Dependensi  | `T-0.6`, `T-2.2`                                          |
| Deliverables| Buyer auth pages (B1–B5 dari PAGES.md)                     |

**Instruksi:**
1. Buat halaman SvelteKit: register, login, forgot-password, reset-password, verify-email.
2. Gunakan SvelteKit load functions dan form actions untuk interaktivitas.
3. Simpan JWT di cookie (httpOnly via server hooks).

**Prompt:**
```
Referensi: PAGES.md (Buyer Portal Auth B1-B5).

Kerjakan Task T-5.2: Buyer Auth Pages.
Dependensi: T-0.6 dan T-2.2 sudah selesai.

Di `apps/buyer/`:

1. Buat `src/lib/api.ts` — HTTP client wrapper untuk call API di localhost:8787. Attach Authorization header. Auto-refresh token jika expired.
2. Buat `src/lib/auth.ts` — login, logout, getUser, isAuthenticated. Simpan tokens di cookie (httpOnly via SvelteKit hooks).
3. Buat halaman SvelteKit:
   - `src/routes/register/+page.svelte` — Form: email, password, full_name, phone. Call POST /auth/register.
   - `src/routes/login/+page.svelte` — Form: email, password. Call POST /auth/login. Redirect ke / jika sukses.
   - `src/routes/forgot-password/+page.svelte` — Form: email. Call POST /auth/forgot-password.
   - `src/routes/reset-password/+page.svelte` — Form: new password. Baca token dari URL query param. Call POST /auth/reset-password.
   - `src/routes/verify-email/+page.svelte` — Baca token dari URL. Call POST /auth/verify-email. Tampilkan sukses/gagal.
4. Gunakan +layout.svelte sebagai shared layout untuk semua halaman.

Desain bersih dan responsive.
```

### Task 5.3 — Homepage & Explore

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-5.3`                                                   |
| Dependensi  | `T-5.1`, `T-5.2`                                          |
| Deliverables| Buyer public pages (B6–B9 dari PAGES.md)                   |

**Instruksi:**
1. `apps/buyer/src/routes/+page.svelte` → Hero banner, featured events carousel, kategori grid, upcoming events.
2. `apps/buyer/src/routes/events/+page.svelte` → Daftar event + filter sidebar (kategori, kota, tanggal, harga) + search bar + pagination.
3. `apps/buyer/src/routes/events/[slug]/+page.svelte` → Detail event: deskripsi, galeri, map, tier tiket + harga, info seller. Tombol "Beli Tiket" (link ke checkout).
4. `apps/buyer/src/routes/categories/[slug]/+page.svelte` → Event per kategori.

**Prompt:**
```
Referensi: PAGES.md (Buyer Portal Public B6-B9).

Kerjakan Task T-5.3: Homepage & Explore.
Dependensi: T-5.1 dan T-5.2 sudah selesai.

Di `apps/buyer/`:

1. `src/routes/+page.svelte` + `+page.server.ts` — Homepage:
   - Load function: fetch GET /events/featured dan GET /categories.
   - Hero banner section (gambar besar + tagline Jeevatix).
   - Featured events carousel/grid. Tampilkan: banner, title, tanggal, venue_city, harga mulai dari.
   - Kategori grid. Tampilkan icon + nama kategori, klik → /categories/[slug].
   - Upcoming events section (fetch GET /events?limit=8). Card event: banner, title, tanggal, kota, harga dari.

2. `src/routes/events/+page.svelte` + `+page.server.ts` — Explore Events:
   - Search bar (ketik → filter).
   - Filter sidebar/top-bar: kategori (multi-select), kota (dropdown), tanggal (date range picker), harga (range slider).
   - Grid/list event cards. Pagination (load more atau page numbers).
   - Fetch GET /events dengan query params sesuai filter.

3. `src/routes/events/[slug]/+page.svelte` + `+page.server.ts` — Event Detail:
   - Banner utama + galeri gambar (dari event_images).
   - Info event: title, deskripsi (rich text), tanggal & waktu, lokasi (venue_name, address, city, embedded map jika ada koordinat).
   - Info penyelenggara: org_name, logo dari seller_profiles.
   - Tier tiket: tabel/card per tier (name, description, price, available = quota - sold_count). Badge: Available / Sold Out.
   - Tombol "Beli Tiket" → link ke /checkout/[slug] (perlu login).

4. `src/routes/categories/[slug]/+page.svelte` + `+page.server.ts` — Event per kategori. Fetch GET /categories/:slug/events. Re-use EventCard component.

Buat reusable Svelte component: EventCard.svelte di `src/lib/components/`.
Desain modern, responsive.
```

### Task 5.4 — Buyer Profile & Notifications UI

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-5.4`                                                   |
| Dependensi  | `T-5.2`, `T-2.3`                                          |
| Deliverables| Buyer profile & notification pages (B16–B17 dari PAGES.md) |

**Instruksi:**
1. `apps/buyer/src/routes/profile/+page.svelte` → edit profil buyer.
2. `apps/buyer/src/routes/notifications/+page.svelte` → daftar notifikasi.

**Prompt:**
```
Referensi: PAGES.md (Buyer Portal Protected B16-B17).

Kerjakan Task T-5.4: Buyer Profile & Notifications UI.
Dependensi: T-5.2 dan T-2.3 sudah selesai.

Di `apps/buyer/`:

1. `src/routes/profile/+page.svelte` — Halaman profil buyer (protected, perlu login):
   - Fetch GET /users/me saat load.
   - Form edit: Full Name, Phone, Avatar (upload via POST /upload, preview).
   - Tombol Simpan → PATCH /users/me.
   - Section ubah password: Old Password, New Password, Confirm. Submit PATCH /users/me/password.

2. `src/routes/notifications/+page.svelte` — Halaman notifikasi (protected):
   - Fetch GET /notifications saat load.
   - List notifikasi: icon per type, title, body, waktu (relative: "2 jam lalu"), badge unread.
   - Klik notifikasi → mark as read (PATCH /notifications/:id/read).
   - Tombol "Mark All as Read" → PATCH /notifications/read-all.

Protect halaman: redirect ke /login jika belum login.
```

### Task 5.5 — Phase 5 API Tests

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-5.5`                                                   |
| Dependensi  | `T-5.1`                                                   |
| Deliverables| `apps/api/src/__tests__/public-events.test.ts`             |

**Instruksi:**
1. Test public event list: pagination, filter by category/location/date, search.
2. Test event detail: return event + tiers + images.
3. Test hanya event published yang muncul di public.
4. Test event not found → 404.

**Prompt:**
```
Kerjakan Task T-5.5: Phase 5 API Tests.
Dependensi: T-5.1 sudah selesai.

Buat test file `apps/api/src/__tests__/public-events.test.ts`:

1. GET /events → return paginated list of published events.
2. GET /events?search=keyword → filter by nama/deskripsi.
3. GET /events?category=slug → filter by kategori.
4. GET /events?location=city → filter by lokasi.
5. GET /events → hanya event dengan status published/ongoing yang muncul (bukan draft/pending).
6. GET /events/:slug → return event detail + tiers + images.
7. GET /events/:slug (non-existent) → 404 Not Found.
8. GET /categories/:slug/events → return events by category.

Gunakan Hono test helper (app.request()). Pastikan semua test pass.
```

**Checkpoint Phase 5:**
```bash
cd apps/api && pnpm test   # public event tests pass
open http://localhost:4301/           # homepage dengan event
open http://localhost:4301/events     # list event + filter
open http://localhost:4301/events/slug-event # detail event
```

---

## Phase 6: Transaction Engine — Reservation, Order, Payment

**Tujuan:** Implementasi flow inti: reservasi (Durable Objects) → order → payment. Ini adalah bagian paling kritis.

### Task 6.1 — Durable Object: TicketReserver

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-6.1`                                                   |
| Dependensi  | `T-0.5`, `T-1.3`                                          |
| Deliverables| `apps/api/src/durable-objects/ticket-reserver.ts`          |

**Instruksi:**
1. Buat Durable Object class `TicketReserver`.
2. In-memory state: `{ [tierId]: { quota, soldCount, pendingReservations } }`.
3. Method `initialize(tierId)` → load dari database ke in-memory.
4. Method `reserve(userId, tierId, quantity)`:
   - Cek `quota - soldCount - pendingReservations >= quantity`.
   - Jika ya: increment pendingReservations, insert reservasi ke DB, return reservation_id + expires_at.
   - Jika tidak: return `SOLD_OUT`.
5. Method `cancelReservation(reservationId)` → decrement pendingReservations, update DB.
6. Method `confirmReservation(reservationId)` → decrement pendingReservations, increment soldCount, update DB `sold_count`.
7. Method `getAvailability(tierId)` → return remaining = quota - soldCount - pendingReservations.
8. Daftarkan di `wrangler.toml` sebagai Durable Object binding.

**Prompt:**
```
Referensi: DATABASE_DESIGN.md (Concurrency & War Ticket Flow, tabel reservations, ticket_tiers).

Kerjakan Task T-6.1: Durable Object TicketReserver.
Dependensi: T-0.5 dan T-1.3 sudah selesai.

Buat file `apps/api/src/durable-objects/ticket-reserver.ts`:

1. Export class TicketReserver (extends DurableObject).
2. In-memory state per tier: Map<tierId, { quota: number, soldCount: number, pendingReservations: number }>.
3. Method initialize(tierId: string) — load data dari PostgreSQL (via Hyperdrive binding): SELECT quota, sold_count FROM ticket_tiers WHERE id = tierId. Simpan ke in-memory state.
4. Method reserve(userId: string, tierId: string, quantity: number):
   - Cek state: (quota - soldCount - pendingReservations) >= quantity.
   - Jika ya: increment pendingReservations. Insert ke DB: reservations (status: active, expires_at: now + 10 menit). Update DB: ticket_tiers SET sold_count = sold_count + quantity. Return { reservation_id, expires_at }.
   - Jika tidak: return { error: 'SOLD_OUT' }.
5. Method cancelReservation(reservationId: string) — decrement pendingReservations. Update DB: reservations SET status = cancelled. Update DB: ticket_tiers SET sold_count = sold_count - quantity.
6. Method confirmReservation(reservationId: string) — decrement pendingReservations (tiket sudah terjual, bukan pending lagi). Update DB: reservations SET status = converted.
7. Method getAvailability(tierId: string) — return { remaining: quota - soldCount - pendingReservations }.

8. Tambahkan di `wrangler.toml`:
   ```toml
   [durable_objects]
   bindings = [{ name = "TICKET_RESERVER", class_name = "TicketReserver" }]
   [[migrations]]
   tag = "v1"
   new_classes = ["TicketReserver"]
   ```

INI ADALAH BAGIAN PALING KRITIS. Pastikan semua operasi stok atomik dan concurrent-safe.
```

### Task 6.2 — Reservation API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-6.2`                                                   |
| Dependensi  | `T-6.1`                                                   |
| Deliverables| `apps/api/src/routes/reservations.ts`, `apps/api/src/services/reservation.service.ts`, `apps/api/src/schemas/reservation.schema.ts` |
| Endpoints   | E25–E27 (lihat PAGES.md)                                   |

**Instruksi:**
1. `POST /reservations` → delegate ke Durable Object `TicketReserver.reserve()`.
2. `GET /reservations/:id` → get reservation status + remaining time.
3. `DELETE /reservations/:id` → delegate ke `TicketReserver.cancelReservation()`.
4. Validasi: user hanya bisa punya 1 active reservation per event.
5. Set `expires_at` = now + 10 menit.
6. **Anti-abuse:** Cek total tiket yang sudah dimiliki user untuk event ini (dari order sebelumnya). Tolak jika melebihi `max_tickets_per_order` yang di-set di `events`.

**Prompt:**
```
Referensi: PAGES.md (Reservation API E25-E27), DATABASE_DESIGN.md (reservations, ticket_tiers, events).

Kerjakan Task T-6.2: Reservation API.
Dependensi: T-6.1 sudah selesai.

Buat 3 file:

**File 1: `apps/api/src/schemas/reservation.schema.ts`:**
- createReservationSchema: { ticket_tier_id: string, quantity: number.min(1) }.openapi('CreateReservationInput')

**File 2: `apps/api/src/services/reservation.service.ts`:**
- reserve(env, userId, input): cek active reservation per event, anti-abuse quota check, delegate ke Durable Object TicketReserver.reserve(). Return { reservation_id, expires_at }.
- getReservation(userId, reservationId): return reservation + remaining time. Validasi ownership.
- cancelReservation(env, userId, reservationId): validasi ownership + status active. Delegate ke TicketReserver.cancelReservation().

**File 3: `apps/api/src/routes/reservations.ts`** — buyer-only via authMiddleware + roleMiddleware('buyer'):
1. POST /reservations — Create reservation. Call reservationService.reserve().
2. GET /reservations/:id — Get reservation status. Call reservationService.getReservation().
3. DELETE /reservations/:id — Cancel reservation. Call reservationService.cancelReservation().

Set expires_at = now + 10 menit.
Mount di index.ts.
```

### Task 6.3 — Order API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-6.3`                                                   |
| Dependensi  | `T-6.2`                                                   |
| Deliverables| `apps/api/src/routes/orders.ts`, `apps/api/src/services/order.service.ts`, `apps/api/src/schemas/order.schema.ts` |
| Endpoints   | E28–E30 (lihat PAGES.md)                                   |

**Instruksi:**
1. `POST /orders` → buat order dari reservation:
   - Validasi reservation `active` dan belum expired.
   - Database transaction: insert order + order_items + payment (pending).
   - Update reservation status → `converted`.
   - Generate `order_number` format `JVX-YYYYMMDD-XXXXX`.
   - Set `expires_at` = now + 30 menit (batas waktu pembayaran).
2. `GET /orders` → list order milik buyer + pagination.
3. `GET /orders/:id` → detail order + items + payment + tickets.

**Prompt:**
```
Referensi: PAGES.md (Order API E28-E30), DATABASE_DESIGN.md (orders, order_items, payments, reservations, ticket_tiers).

Kerjakan Task T-6.3: Order API.
Dependensi: T-6.2 sudah selesai.

Buat 3 file:

**File 1: `apps/api/src/schemas/order.schema.ts`:**
- createOrderSchema: { reservation_id: string }.openapi('CreateOrderInput')
- listOrdersQuerySchema: { page?, limit? }.openapi('ListOrdersQuery')

**File 2: `apps/api/src/services/order.service.ts`:**
- createOrder(userId, input): database transaction — validasi reservation (active, not expired, ownership), generate order_number (JVX-YYYYMMDD-XXXXX), insert order + order_items + payment (pending), update reservation status → converted. expires_at = now + 30 menit.
- listOrders(userId, pagination): join order_items, payments, events. Return status, order_number, total_amount, created_at.
- getOrderDetail(userId, orderId): detail + items + payment + tickets. Validasi ownership.

**File 3: `apps/api/src/routes/orders.ts`** — buyer-only:
1. POST /orders — Create order from reservation. Call orderService.createOrder().
2. GET /orders — List buyer orders. Call orderService.listOrders().
3. GET /orders/:id — Order detail. Call orderService.getOrderDetail().

Mount di index.ts.
```

### Task 6.4 — Payment API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-6.4`                                                   |
| Dependensi  | `T-6.3`                                                   |
| Deliverables| `apps/api/src/routes/payments.ts`, `apps/api/src/services/payment.service.ts`, `apps/api/src/schemas/payment.schema.ts` |
| Endpoints   | E31–E32 (lihat PAGES.md)                                   |

**Instruksi:**
1. `POST /payments/:orderId/pay` → inisiasi pembayaran:
   - Validasi order status `pending` dan belum expired.
   - Integrasikan dengan payment gateway (gunakan mock/placeholder dulu).
   - Update payment method.
   - Return payment URL / instructions.
2. `POST /webhooks/payment` → callback dari payment gateway:
   - Verify webhook signature (keamanan!).
   - **Idempotency:** Cek `payment.status` sebelum update — jika sudah `success`, skip. Gunakan `external_ref` sebagai idempotency key.
   - Update payment status → `success`.
   - Update order status → `confirmed`.
   - Trigger ticket generation (Phase 7).
   - Enqueue email send via Cloudflare Queue.

**Prompt:**
```
Referensi: PAGES.md (Payment API E31-E32), DATABASE_DESIGN.md (payments, orders, tickets, order_items).

Kerjakan Task T-6.4: Payment API.
Dependensi: T-6.3 sudah selesai.

Buat 3 file:

**File 1: `apps/api/src/schemas/payment.schema.ts`:**
- initiatePaymentSchema: { method: enum['bank_transfer', 'e_wallet', 'credit_card', 'virtual_account'] }.openapi('InitiatePaymentInput')

**File 2: `apps/api/src/services/payment.service.ts`:**
- initiatePayment(userId, orderId, input): validasi order (ownership, pending, not expired), update payment method, integrasikan payment gateway (mock dulu). Return { payment_url } atau { status: 'success' }.
- handleWebhook(headers, body): verify signature, idempotency check (external_ref), update payment → success + order → confirmed, call generateTickets(), enqueue email + notification.

**File 3: `apps/api/src/routes/payments.ts`:**
1. POST /payments/:orderId/pay — Buyer-only. Initiate payment. Call paymentService.initiatePayment().
2. POST /webhooks/payment — Public (verify signature). Payment webhook callback. Call paymentService.handleWebhook().

Mount di index.ts.
```

### Task 6.5 — Cloudflare Queue: Reservation Cleanup

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-6.5`                                                   |
| Dependensi  | `T-6.2`                                                   |
| Deliverables| `apps/api/src/queues/reservation-cleanup.ts`               |

**Instruksi:**
1. Cloudflare Queue consumer yang berjalan periodik.
2. Query: `SELECT * FROM reservations WHERE status = 'active' AND expires_at < now()`.
3. Untuk setiap reservation expired:
   - Update status → `expired`.
   - Call Durable Object → restore availability.
4. Daftarkan di `wrangler.toml` sebagai Queue binding.

**Prompt:**
```
Referensi: DATABASE_DESIGN.md (reservations, ticket_tiers, Concurrency & War Ticket Flow).

Kerjakan Task T-6.5: Cloudflare Queue Reservation Cleanup.
Dependensi: T-6.2 sudah selesai.

Buat file `apps/api/src/queues/reservation-cleanup.ts`:

1. Export fungsi queue handler sesuai Cloudflare Queue consumer pattern.
2. Logika cleanup (berjalan periodik):
   - Query: SELECT * FROM reservations WHERE status = 'active' AND expires_at < now().
   - Untuk setiap reservation expired:
     a. Update reservations SET status = 'expired'.
     b. Get Durable Object instance dan call cancelReservation(reservationId) untuk restore in-memory counter.
     c. (Opsional) Send notification ke buyer: 'payment_reminder' jika mendekati expire, atau info bahwa reservasi sudah expired.
3. Daftarkan Queue consumer di `wrangler.toml`:
   ```toml
   [[queues.consumers]]
   queue = "reservation-cleanup"
   max_batch_size = 10
   max_batch_timeout = 30
   ```
4. Juga setup cron trigger di wrangler.toml untuk menjalankan cleanup setiap 1 menit:
   ```toml
   [triggers]
   crons = ["* * * * *"]
   ```

Pastikan cleanup idempotent (jangan proses reservation yang sudah expired).
```

### Task 6.6 — Checkout & Payment UI (Buyer)

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-6.6`                                                   |
| Dependensi  | `T-6.2`, `T-6.3`, `T-6.4`, `T-5.3`                       |
| Deliverables| Buyer checkout & payment pages (B10–B11 dari PAGES.md)     |

**Instruksi:**
1. `apps/buyer/src/routes/checkout/[slug]/+page.svelte` → pilih tier, jumlah → submit reservation → show countdown timer (10 menit) → redirect ke payment.
2. `apps/buyer/src/routes/payment/[orderId]/+page.svelte` → ringkasan order, pilih metode bayar, submit → redirect ke payment gateway.
3. Countdown timer yang real-time (reactive Svelte).

**Prompt:**
```
Referensi: PAGES.md (Buyer Portal Protected B10-B11: Checkout & Payment).

Kerjakan Task T-6.6: Checkout & Payment UI (Buyer).
Dependensi: T-6.2, T-6.3, T-6.4, T-5.3 sudah selesai.

Di `apps/buyer/`:

1. `src/routes/checkout/[slug]/+page.svelte` + `+page.server.ts` — Checkout page (protected):
   - Load function: fetch event detail (GET /events/:slug) untuk menampilkan info event + tier tiket.
   - Form: pilih tier (radio/card selection), pilih jumlah (number input, max = max_tickets_per_order).
   - Tombol "Reservasi Tiket" → call POST /reservations.
   - Jika sukses: tampilkan countdown timer (10 menit dari expires_at). Timer reactive Svelte (onMount + setInterval).
   - Tombol "Lanjut ke Pembayaran" → call POST /orders, lalu goto(`/payment/${orderId}`).
   - Jika SOLD_OUT: tampilkan alert "Tiket habis".
   - Tombol "Batalkan" → call DELETE /reservations/:id.

2. `src/routes/payment/[orderId]/+page.svelte` + `+page.server.ts` — Payment page (protected):
   - Load function: fetch order detail (GET /orders/:id).
   - Ringkasan: event name, tier, quantity, harga, total.
   - Pilih metode bayar (bank_transfer, e_wallet, credit_card, virtual_account).
   - Countdown batas waktu bayar (30 menit dari order.expires_at).
   - Tombol "Bayar Sekarang" → call POST /payments/:orderId/pay. Redirect ke payment gateway URL (atau show success jika mock).
```

### Task 6.7 — Order History UI (Buyer)

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-6.7`                                                   |
| Dependensi  | `T-6.3`, `T-5.2`                                          |
| Deliverables| Buyer order pages (B12–B13 dari PAGES.md)                  |

**Instruksi:**
1. `apps/buyer/src/routes/orders/+page.svelte` → list order + badge status.
2. `apps/buyer/src/routes/orders/[id]/+page.svelte` → detail order + items + payment info.

**Prompt:**
```
Referensi: PAGES.md (Buyer Portal Protected B12-B13: Order History).

Kerjakan Task T-6.7: Order History UI (Buyer).
Dependensi: T-6.3 dan T-5.2 sudah selesai.

Di `apps/buyer/`:

1. `src/routes/orders/+page.svelte` + `+page.server.ts` — Order list page (protected):
   - Load function: fetch GET /orders (paginated).
   - Tabel/card list: order_number, event name, tanggal order, total_amount, status (badge berwarna: pending=kuning, confirmed=hijau, expired=abu, cancelled=merah, refunded=biru).
   - Klik row → navigate ke /orders/[id].
   - Pagination.

2. `src/routes/orders/[id]/+page.svelte` + `+page.server.ts` — Order detail page (protected):
   - Load function: fetch GET /orders/:id.
   - Info order: order_number, status badge, tanggal.
   - Item list: tier name, quantity, unit_price, subtotal.
   - Payment info: method, status, paid_at.
   - Jika status confirmed: link ke tiket (/tickets).
   - Jika status pending: tombol "Bayar Sekarang" → redirect ke /payment/[orderId].

Protect kedua halaman: redirect ke /login jika belum login.
```

### Task 6.8 — Phase 6 API Tests (Transaction Flow)

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-6.8`                                                   |
| Dependensi  | `T-6.2`, `T-6.3`, `T-6.4`                                 |
| Deliverables| `apps/api/src/__tests__/reservation.test.ts`, `apps/api/src/__tests__/order.test.ts`, `apps/api/src/__tests__/payment.test.ts` |

**Instruksi:**
1. Test reservation flow: reserve → check status → cancel.
2. Test sold out scenario: reserve melebihi quota → 409.
3. Test order creation: dari reservasi valid → order + order_items terbuat.
4. Test payment flow: pay → webhook callback → status updated.
5. Test full transaction pipeline: reserve → order → pay → order confirmed.

**Prompt:**
```
Kerjakan Task T-6.8: Phase 6 API Tests (Transaction Flow).
Dependensi: T-6.2, T-6.3, dan T-6.4 sudah selesai.

Buat test files di `apps/api/src/__tests__/`:

1. `reservation.test.ts`:
   a. POST /reservations → reserve tiket, return 201 + reservation + expires_at.
   b. POST /reservations dengan quantity > sisa → 409 SOLD_OUT.
   c. DELETE /reservations/:id → cancel reservation, sold_count berkurang.
   d. POST /reservations tanpa login → 401 Unauthorized.

2. `order.test.ts`:
   a. POST /orders (dari reservation valid) → create order + order_items, return 201.
   b. POST /orders tanpa reservation aktif → 400 Bad Request.
   c. GET /orders → list user's orders, paginated.
   d. GET /orders/:id → order detail + items + payment.
   e. GET /orders/:id milik user lain → 403 Forbidden.

3. `payment.test.ts`:
   a. POST /payments/:orderId/pay → initiate payment, return payment_url.
   b. POST /webhooks/payment (valid signature) → update payment + order status.
   c. POST /webhooks/payment (invalid signature) → 401.
   d. Full pipeline: reserve → order → pay → verify order status = confirmed.

Gunakan Hono test helper (app.request()). Pastikan semua test pass.
```

**Checkpoint Phase 6:**
```bash
cd apps/api && pnpm test   # reservation + order + payment tests pass
# Full flow test: browse event → checkout → reserve → create order → pay
# Reservasi yang expired harus di-cleanup otomatis
```

---

## Phase 7: Post-Transaction — Tickets, Check-in, Notifications

**Tujuan:** Generate tiket setelah bayar, sistem check-in di venue, kirim notifikasi.

### Task 7.1 — Ticket Generation

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-7.1`                                                   |
| Dependensi  | `T-6.4`                                                   |
| Deliverables| `apps/api/src/services/ticket-generator.ts`, `apps/api/src/routes/tickets.ts`, `apps/api/src/schemas/ticket.schema.ts` |
| Endpoints   | E33–E34 (lihat PAGES.md)                                   |

**Instruksi:**
1. Service: `generateTickets(orderId)`:
   - Untuk setiap order_item, generate N tiket (sesuai quantity).
   - `ticket_code` = unique random string (misal: `JVX-` + nanoid 12 char).
   - Insert ke tabel `tickets`.
2. Dipanggil oleh Payment webhook (E32) setelah payment success.
3. API: `GET /tickets` → list tiket milik buyer.
4. API: `GET /tickets/:id` → detail tiket + QR data.

**Prompt:**
```
Referensi: PAGES.md (Ticket API E33-E34), DATABASE_DESIGN.md (tickets, order_items, orders).

Kerjakan Task T-7.1: Ticket Generation.
Dependensi: T-6.4 sudah selesai.

Buat 3 file:

**File 1: `apps/api/src/services/ticket-generator.ts`:**
- generateTickets(orderId): query order_items, loop quantity kali, generate ticket_code = 'JVX-' + nanoid(12), insert ke tickets. Return array of tickets.

**File 2: `apps/api/src/schemas/ticket.schema.ts`:**
- listTicketsQuerySchema: { page?, limit? }.openapi('ListTicketsQuery')

**File 3: `apps/api/src/routes/tickets.ts`** — buyer-only:
1. GET /tickets — List buyer tickets (join orders, order_items, ticket_tiers, events). Call ticketService.
2. GET /tickets/:id — Ticket detail + QR data. Validasi ownership.

Integrasikan di payment webhook: setelah payment success, panggil generateTickets(orderId).
Install nanoid: `pnpm add nanoid` di apps/api.
Mount di index.ts.
```

### Task 7.2 — Ticket UI (Buyer)

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-7.2`                                                   |
| Dependensi  | `T-7.1`, `T-5.2`                                          |
| Deliverables| Buyer ticket pages (B14–B15 dari PAGES.md)                 |

**Instruksi:**
1. `apps/buyer/src/routes/tickets/+page.svelte` → list tiket aktif.
2. `apps/buyer/src/routes/tickets/[id]/+page.svelte` → detail tiket + QR code rendered dari `ticket_code`. Gunakan QR code library (misal `qrcode`).

**Prompt:**
```
Referensi: PAGES.md (Buyer Portal Protected B14-B15: Tickets).

Kerjakan Task T-7.2: Ticket UI (Buyer).
Dependensi: T-7.1 dan T-5.2 sudah selesai.

Di `apps/buyer/`:

1. Install QR code library: pnpm add qrcode (di workspace apps/buyer).

2. `src/routes/tickets/+page.svelte` + `+page.server.ts` — Ticket list page (protected):
   - Load function: fetch GET /tickets.
   - Card grid: setiap tiket tampilkan event name, tier name, tanggal event, ticket_code (sebagian, misal JVX-XXXX****), status badge (valid=hijau, used=abu).
   - Klik card → navigate ke /tickets/[id].
   - Group by event (jika punya beberapa tiket untuk event yang sama).

3. `src/routes/tickets/[id]/+page.svelte` + `+page.server.ts` — Ticket detail page (protected):
   - Load function: fetch GET /tickets/:id.
   - Tampilkan: event name, event date & venue, tier name, ticket_code.
   - QR Code besar (render dari ticket_code menggunakan library qrcode). Gunakan onMount untuk QR rendering.
   - Status badge: valid/used.
   - Jika used: tampilkan checkin time.
   - Tombol "Download QR" (save as PNG).

Protect kedua halaman: redirect ke /login jika belum login.
```

### Task 7.3 — Check-in API & UI (Seller)

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-7.3`                                                   |
| Dependensi  | `T-7.1`, `T-4.4`                                          |
| Deliverables| Check-in API (`apps/api/src/services/checkin.service.ts`, `apps/api/src/schemas/checkin.schema.ts`, `apps/api/src/routes/seller/checkin.ts`) + Seller check-in page (S13, E35–E36) |

**Instruksi:**
1. API `POST /seller/events/:id/checkin` → terima `ticket_code`, validasi:
   - Tiket ada dan status `valid`.
   - Tiket milik event ini.
   - Belum pernah di-checkin (tidak ada record di ticket_checkins).
   - Insert ke `ticket_checkins`, update ticket status → `used`.
2. API `GET /seller/events/:id/checkin/stats` → total tiket, sudah check-in, belum.
3. UI: `apps/seller/src/routes/events/[id]/checkin/+page.svelte`:
   - Input field untuk scan/ketik `ticket_code`.
   - Tampilkan status: Valid ✅ / Already Used ⚠️ / Invalid ❌.
   - Live statistik check-in.

**Prompt:**
```
Referensi: PAGES.md (Seller Portal S13, Check-in API E35-E36), DATABASE_DESIGN.md (tickets, ticket_checkins).

Kerjakan Task T-7.3: Check-in API & UI (Seller).
Dependensi: T-7.1 dan T-4.4 sudah selesai.

Buat file API:

**File 1: `apps/api/src/schemas/checkin.schema.ts`:**
- checkinSchema: { ticket_code: string }.openapi('CheckinInput')

**File 2: `apps/api/src/services/checkin.service.ts`:**
- checkin(sellerId, eventId, ticketCode): validasi seller ownership, query ticket by code + event match, cek status valid vs used, insert ticket_checkins, update ticket status → 'used'. Return { status: 'SUCCESS'|'ALREADY_USED'|'INVALID', ... }.
- getStats(sellerId, eventId): total_tickets, checked_in, remaining, percentage.

**File 3: `apps/api/src/routes/seller/checkin.ts`** — seller-only:
1. POST /seller/events/:id/checkin — Check-in ticket. Call checkinService.checkin().
2. GET /seller/events/:id/checkin/stats — Check-in statistics. Call checkinService.getStats().

Di `apps/seller/`:

3. `src/routes/events/[id]/checkin/+page.svelte`:
   - Input field besar untuk scan/ketik ticket_code + tombol "Check-in".
   - Call POST /seller/events/:id/checkin.
   - Tampilkan hasil: SUCCESS (hijau + buyer name + tier), ALREADY_USED (kuning + waktu checkin), INVALID (merah).
   - Live statistik di sidebar: total, checked-in, remaining, progress bar.
   - History list: 10 terakhir check-in.

Mount API routes di index.ts.
```

### Task 7.4 — Notification System

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-7.4`                                                   |
| Dependensi  | `T-6.5`, `T-2.1`                                          |
| Deliverables| `apps/api/src/services/notification.service.ts`, `apps/api/src/routes/notifications.ts`, `apps/api/src/schemas/notification.schema.ts` (E41–E43, E61) |

**Instruksi:**
1. Service: `sendNotification(userId, type, title, body, metadata)` → insert ke `notifications`.
2. Di-trigger oleh:
   - Payment success → `order_confirmed` (ke buyer).
   - Reservation expiring soon → `payment_reminder` (ke buyer, via Queue).
   - Event H-1 → `event_reminder` (ke buyer, via Queue cron).
   - New order masuk → `new_order` (ke seller).
   - Event approved → `event_approved` (ke seller).
   - Event rejected → `event_rejected` (ke seller).
3. API: `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`.
4. Admin API: `POST /admin/notifications/broadcast`.

**Prompt:**
```
Referensi: PAGES.md (Notification API E41-E43, E61), DATABASE_DESIGN.md (notifications, notification_type enum).

Kerjakan Task T-7.4: Notification System.
Dependensi: T-6.5 dan T-2.1 sudah selesai.

**File 1: `apps/api/src/services/notification.service.ts`:**
- sendNotification(userId, type, title, body, metadata?): insert ke notifications, return record.

**File 2: `apps/api/src/schemas/notification.schema.ts`:**
- broadcastSchema: { title, body, target_role?: enum('buyer','seller','all') }.openapi('BroadcastNotificationInput')

**File 3: `apps/api/src/routes/notifications.ts`** — authenticated:
1. GET /notifications — List notifikasi milik user. Pagination. Sort by created_at DESC. Include unread count.
2. PATCH /notifications/:id/read — Mark as read. Validasi ownership.
3. PATCH /notifications/read-all — Mark all as read.

Admin route:
4. POST /admin/notifications/broadcast — Broadcast notification ke semua user atau by role.

Integrasikan trigger di:
   - `routes/payments.ts` (payment webhook success): sendNotification(buyerId, 'order_confirmed', 'Pesanan Dikonfirmasi', 'Order {order_number} berhasil dibayar.').
   - `routes/payments.ts` (payment webhook success): sendNotification(sellerId, 'new_order', 'Pesanan Baru', 'Ada pesanan baru untuk event {event_name}.').
   - `queues/reservation-cleanup.ts` (menjelang expire): sendNotification(buyerId, 'payment_reminder', 'Segera Bayar', 'Reservasi Anda akan expired dalam 2 menit.').
   - `routes/admin.ts` (approve event): sendNotification(sellerId, 'event_approved', 'Event Disetujui', 'Event {event_name} sudah dipublikasikan.').
   - `routes/admin.ts` (reject event): sendNotification(sellerId, 'event_rejected', 'Event Ditolak', 'Event {event_name} ditolak. Alasan: {reason}.').

Mount di index.ts.
```

### Task 7.5 — Seller Order View

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-7.5`                                                   |
| Dependensi  | `T-4.4`, `T-6.3`                                          |
| Deliverables| Seller order pages (S11–S12), `apps/api/src/services/seller-order.service.ts`, `apps/api/src/routes/seller/orders.ts`, `apps/api/src/schemas/seller-order.schema.ts` (E37–E38) |

**Instruksi:**
1. API: `GET /seller/orders` → list order untuk event milik seller.
2. API: `GET /seller/orders/:id` → detail order + buyer info.
3. UI: `apps/seller/src/routes/orders/+page.svelte` → tabel pesanan.
4. UI: `apps/seller/src/routes/orders/[id]/+page.svelte` → detail pesanan.

**Prompt:**
```
Referensi: PAGES.md (Seller Portal S11-S12, Seller Order API E37-E38), DATABASE_DESIGN.md (orders, order_items, events, ticket_tiers).

Kerjakan Task T-7.5: Seller Order View.
Dependensi: T-4.4 dan T-6.3 sudah selesai.

Buat file API:

**File 1: `apps/api/src/schemas/seller-order.schema.ts`:**
- listSellerOrdersQuerySchema: { event_id?, status?, page?, limit? }.openapi('ListSellerOrdersQuery')

**File 2: `apps/api/src/services/seller-order.service.ts`:**
- listOrders(sellerProfileId, query): orders JOIN order_items JOIN ticket_tiers JOIN events WHERE seller_id matches. Paginated + filter.
- getOrderDetail(sellerProfileId, orderId): detail + items + buyer info + payment. Validasi ownership.

**File 3: `apps/api/src/routes/seller/orders.ts`** — seller-only:
1. GET /seller/orders — List seller orders. Call sellerOrderService.listOrders().
2. GET /seller/orders/:id — Seller order detail. Call sellerOrderService.getOrderDetail().

Di `apps/seller/`:

3. `src/routes/orders/+page.svelte`:
   - Tabel pesanan: kolom order_number, event, buyer, total, status (badge), tanggal.
   - Filter dropdown: by event, by status.
   - Pagination.
   - Klik row → navigate ke /orders/[id].

4. `src/routes/orders/[id]/+page.svelte`:
   - Detail pesanan: order_number, status badge, tanggal.
   - Buyer info: nama, email.
   - Item list: tier, quantity, harga, subtotal.
   - Payment info: method, status, paid_at.

Mount API routes di index.ts.
```

### Task 7.6 — Seller Notification UI

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-7.6`                                                   |
| Dependensi  | `T-7.4`, `T-4.4`                                          |
| Deliverables| Seller notification page (S16 dari PAGES.md)               |

**Instruksi:**
1. `apps/seller/src/routes/notifications/+page.svelte` → daftar notifikasi seller.
2. Tampilkan notifikasi: pesanan baru, event approved/rejected, dll.
3. Mark as read / mark all as read.

**Prompt:**
```
Referensi: PAGES.md (Seller Portal S16: Notifications).

Kerjakan Task T-7.6: Seller Notification UI.
Dependensi: T-7.4 dan T-4.4 sudah selesai.

Di `apps/seller/`:

1. `src/routes/notifications/+page.svelte`:
   - Fetch GET /notifications (pagination).
   - List notifikasi: icon berdasarkan type (new_order=shopping-cart, event_approved=check-circle, event_rejected=x-circle, dll), title, body, waktu (relative: "5 menit lalu").
   - Notifikasi unread: background highlight (misalnya bg-blue-50).
   - Klik notifikasi → mark as read (PATCH /notifications/:id/read).
   - Tombol "Mark All as Read" di atas → PATCH /notifications/read-all.
   - Badge unread count di sidebar navigation (notification icon + count badge).

2. Update layout `src/routes/+layout.svelte`:
   - Di sidebar/topbar, tambahkan notification bell icon.
   - Fetch unread count dari GET /notifications (ambil total unread dari response).
   - Badge merah di atas bell icon jika ada unread.
   - Klik bell → navigate ke /notifications.
```

### Task 7.7 — Phase 7 API Tests (Post-Transaction)

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-7.7`                                                   |
| Dependensi  | `T-7.1`, `T-7.3`, `T-7.4`, `T-7.5`                       |
| Deliverables| `apps/api/src/__tests__/tickets.test.ts`, `apps/api/src/__tests__/checkin.test.ts`, `apps/api/src/__tests__/notifications.test.ts` |

**Instruksi:**
1. Test ticket generation: setelah payment success, tiket ter-generate dengan ticket_code.
2. Test ticket API: list buyer's tickets, ticket detail.
3. Test check-in: scan valid code → SUCCESS, scan ulang → ALREADY_USED, invalid code → INVALID.
4. Test notification CRUD: list, mark read, mark all read, broadcast.
5. Test seller order view: list orders, detail + buyer info.

**Prompt:**
```
Kerjakan Task T-7.7: Phase 7 API Tests (Post-Transaction).
Dependensi: T-7.1, T-7.3, T-7.4, dan T-7.5 sudah selesai.

Buat test files di `apps/api/src/__tests__/`:

1. `tickets.test.ts`:
   a. Setelah payment success, GET /tickets → tiket muncul dengan ticket_code format JVX-XXXXXXXXXXXX.
   b. GET /tickets/:id → ticket detail + event info.
   c. GET /tickets (user lain) → tidak bisa lihat tiket orang lain.

2. `checkin.test.ts`:
   a. POST /seller/events/:id/checkin { ticket_code } → status SUCCESS + buyer info.
   b. POST /seller/events/:id/checkin (kode yang sama) → status ALREADY_USED.
   c. POST /seller/events/:id/checkin { ticket_code: invalid } → status INVALID.
   d. GET /seller/events/:id/checkin/stats → total, checked_in, remaining.
   e. Seller lain tidak bisa check-in event bukan miliknya → 403.

3. `notifications.test.ts`:
   a. GET /notifications → list notifikasi milik user, paginated.
   b. PATCH /notifications/:id/read → mark as read.
   c. PATCH /notifications/read-all → semua jadi read.
   d. POST /admin/notifications/broadcast → broadcast ke semua user.
   e. Non-admin broadcast → 403 Forbidden.

4. `seller-orders.test.ts`:
   a. GET /seller/orders → list orders untuk event milik seller.
   b. GET /seller/orders/:id → detail + buyer info + items.
   c. Seller lain tidak bisa lihat orders seller lain → 403.

Gunakan Hono test helper (app.request()). Pastikan semua test pass.
```

**Checkpoint Phase 7:**
```bash
cd apps/api && pnpm test   # ticket + checkin + notification + seller-order tests pass
# Complete flow: buyer bayar → tiket generate → buyer lihat QR → seller scan check-in
# Notifikasi muncul setelah bayar
```

---

## Phase 8: Real-time — PartyKit WebSocket

**Tujuan:** Live update ketersediaan tiket tanpa polling database.

### Task 8.1 — PartyKit Server Setup

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-8.1`                                                   |
| Dependensi  | `T-6.1`                                                   |
| Deliverables| PartyKit server config + room logic                        |

**Instruksi:**
1. Setup PartyKit project (bisa sebagai bagian dari monorepo atau standalone).
2. Room per event: `event-{eventId}`.
3. Server broadcast message format: `{ type: "availability", data: { tierId: string, remaining: number }[] }`.
4. API → PartyKit: setelah Durable Object update availability, POST ke PartyKit room untuk broadcast ke semua connected clients.

**Prompt:**
```
Referensi: README.md (Real-time / PartyKit), DATABASE_DESIGN.md (ticket_tiers).

Kerjakan Task T-8.1: PartyKit Server Setup.
Dependensi: T-6.1 sudah selesai.

1. Setup PartyKit di monorepo:
   - Buat folder `apps/partykit/` (atau `packages/partykit/`).
   - `pnpm init` + install partykit: `pnpm add partykit partysocket`.
   - Buat `partykit.json`: { "name": "jeevatix-realtime", "main": "src/server.ts" }.

2. Buat `apps/partykit/src/server.ts`:
   - Export default class Server implements Party.Server.
   - Room naming: `event-{eventId}`.
   - onConnect(conn): kirim current availability ke client baru.
   - onMessage(message, sender): handle request dari API.
   - Method broadcastAvailability(data: { tierId: string, remaining: number }[]):
     - this.room.broadcast(JSON.stringify({ type: 'availability', data })).
   - HTTP handler (onRequest): menerima POST dari API untuk trigger broadcast.
     - Validasi secret token dari header (keamanan: hanya API yang boleh trigger).

3. Update Durable Object (`apps/api/src/durable-objects/ticket-reserver.ts`):
   - Setelah reserve() atau cancelReservation() berhasil: POST ke PartyKit room:
     fetch(`https://{PARTYKIT_HOST}/parties/main/event-{eventId}`, { method: 'POST', headers: { 'X-Party-Secret': env.PARTY_SECRET }, body: JSON.stringify({ type: 'availability', data: [{ tierId, remaining }] }) }).

4. Tambahkan script di root package.json: "dev:partykit": "cd apps/partykit && npx partykit dev".
```

### Task 8.2 — PartyKit Client Integration

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-8.2`                                                   |
| Dependensi  | `T-8.1`, `T-5.3`, `T-6.6`                                 |
| Deliverables| WebSocket integration di halaman Event Detail & Checkout   |

**Instruksi:**
1. `apps/buyer/src/routes/events/[slug]/+page.svelte` → connect ke PartyKit room, update jumlah tiket tersedia secara live.
2. `apps/buyer/src/routes/checkout/[slug]/+page.svelte` → live stock countdown, jika sold out saat checkout maka tampilkan alert.
3. Gunakan `partysocket` client library.

**Prompt:**
```
Referensi: PAGES.md (Buyer Portal B7: Event Detail, B10: Checkout).

Kerjakan Task T-8.2: PartyKit Client Integration.
Dependensi: T-8.1, T-5.3, dan T-6.6 sudah selesai.

Di `apps/buyer/`:

1. Install: pnpm add partysocket (di workspace apps/buyer).

2. Buat Svelte component `src/lib/components/LiveAvailability.svelte`:
   - Props: eventId (string), initialTiers (array of { tierId, remaining }).
   - onMount: connect ke PartyKit room menggunakan partysocket:
     const socket = new PartySocket({ host: PARTYKIT_HOST, room: `event-${eventId}` }).
   - socket.onmessage: parse JSON, jika type = 'availability' → update reactive state tiers.
   - onDestroy: socket.close().
   - Render: untuk setiap tier, tampilkan nama tier + "Sisa: {remaining} tiket" (warna berubah: hijau > 50%, kuning 10-50%, merah < 10%, hitam 0).

3. Update `src/routes/events/[slug]/+page.svelte`:
   - Import dan render LiveAvailability component.
   - Pass initialTiers dari load function data.

4. Update `src/routes/checkout/[slug]/+page.svelte`:
   - Embed LiveAvailability di bagian atas checkout.
   - Jika remaining = 0 saat user sedang checkout: tampilkan modal alert "Tiket habis, reservasi Anda mungkin tidak berhasil".
   - Disable tombol "Reservasi" jika remaining = 0.

Pastikan WebSocket auto-reconnect jika koneksi terputus.
```

**Checkpoint Phase 8:**
```bash
# Buka 2 browser tab di halaman event detail yang sama
# Beli tiket di tab 1 → stock di tab 2 harus realtime berkurang
```

---

## Phase 9: Dashboards & Admin Completion

**Tujuan:** Dashboard analytics untuk admin & seller, lengkapi semua halaman admin yang tersisa.

### Task 9.1 — Seller Dashboard

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-9.1`                                                   |
| Dependensi  | `T-7.5`                                                   |
| Deliverables| Seller dashboard page (S5 dari PAGES.md)                   |

**Instruksi:**
1. `apps/seller/src/routes/+page.svelte`:
   - Card: total event, total revenue, total tiket terjual, event upcoming.
   - Tabel: pesanan terbaru (5 terbaru).
   - Grafik: penjualan tiket per hari (30 hari terakhir).

**Prompt:**
```
Referensi: PAGES.md (Seller Portal S5: Dashboard, E39-E40).

Kerjakan Task T-9.1: Seller Dashboard.
Dependensi: T-7.5 sudah selesai.

Buat/tambahkan API:

**`apps/api/src/services/seller-dashboard.service.ts`:**
- getDashboard(sellerProfileId): aggregate total_events, total_revenue, total_tickets_sold, upcoming_events, recent_orders (5), daily_sales (30 hari).

**`apps/api/src/routes/seller/dashboard.ts`:**
1. GET /seller/dashboard — Get seller dashboard data. Call sellerDashboardService.getDashboard().

Di `apps/seller/`:

2. `src/routes/+page.svelte` (dashboard halaman utama):
   - Fetch GET /seller/dashboard di load function.
   - Cards (grid 2x2): Total Event, Total Revenue (format Rupiah), Total Tiket Terjual, Event Mendatang.
   - Tabel "Pesanan Terbaru": order_number, event, buyer, total, status, tanggal. Link ke /orders/[id].
   - Grafik line chart: penjualan tiket per hari 30 hari terakhir. Gunakan library chart sederhana (Chart.js atau custom SVG).

Install chart library jika perlu: pnpm add chart.js (di workspace apps/seller).
```

### Task 9.2 — Admin Dashboard

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-9.2`                                                   |
| Dependensi  | `T-3.5`                                                   |
| Deliverables| Admin dashboard page (A2 dari PAGES.md) + API E44          |

**Instruksi:**
1. API: `GET /admin/dashboard` → aggregate: total users, total events, total revenue, total tickets sold.
2. UI: `apps/admin/src/routes/+page.svelte`:
   - Cards: total user, total seller, total event, total revenue.
   - Grafik: transaksi harian (30 hari).
   - Tabel: event terbaru, pesanan terbaru.

**Prompt:**
```
Referensi: PAGES.md (Admin Portal A2: Dashboard, E44).

Kerjakan Task T-9.2: Admin Dashboard.
Dependensi: T-3.5 sudah selesai.

Buat/tambahkan API:

**`apps/api/src/services/admin-dashboard.service.ts`:**
- getDashboard(): aggregate total_users, total_sellers, total_buyers, total_events, total_events_published, total_revenue, total_tickets_sold, daily_transactions (30 hari), recent_events (5), recent_orders (5).

**`apps/api/src/routes/admin/dashboard.ts`** (admin-only):
1. GET /admin/dashboard — Get admin dashboard data. Call adminDashboardService.getDashboard().

Di `apps/admin/`:

2. `src/routes/+page.svelte` (dashboard):
   - Fetch GET /admin/dashboard di load function.
   - Cards (grid 2x3): Total User, Total Seller, Total Event, Total Revenue, Tiket Terjual, Event Published.
   - Grafik bar chart: transaksi harian 30 hari.
   - Tabel "Event Terbaru": name, seller, status, tanggal.
   - Tabel "Pesanan Terbaru": order_number, buyer, total, status.

Install chart library jika perlu.
```

### Task 9.3 — Admin Order & Payment Management

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-9.3`                                                   |
| Dependensi  | `T-3.2`, `T-6.3`, `T-6.4`                                 |
| Deliverables| Admin order & payment pages (A7–A12, A15) + API E50–E56, E62 |

**Instruksi:**
1. Admin Event pages: `A7` (list semua event), `A8` (detail event + ubah status).
2. Admin Order pages: `A9` (list order), `A10` (detail order + aksi refund/cancel).
3. Admin Payment pages: `A11` (list payment), `A12` (detail payment + update status).
4. Admin Notification page: `A14`.
5. Admin Reservation monitor: `A15`.
6. Implement semua API endpoints E50–E56, E62.

**Prompt:**
```
Referensi: PAGES.md (Admin Portal A7-A12, A14-A15, API E50-E56, E62), DATABASE_DESIGN.md (events, orders, payments, notifications, reservations).

Kerjakan Task T-9.3: Admin Order & Payment Management.
Dependensi: T-3.2, T-6.3, T-6.4 sudah selesai.

Buat/tambahkan API files:

**`apps/api/src/services/admin-event.service.ts`:**
- listEvents(query): filter status/seller/search, paginated.
- getEventDetail(id): + tiers + seller info.
- updateEventStatus(id, status): trigger notifikasi ke seller.

**`apps/api/src/services/admin-order.service.ts`:**
- listOrders, getOrderDetail, refundOrder, cancelOrder.

**`apps/api/src/services/admin-payment.service.ts`:**
- listPayments, getPaymentDetail, updatePaymentStatus.

**`apps/api/src/schemas/admin.schema.ts`:**
- Schemas untuk semua admin input validation.

**Route files:**
- `apps/api/src/routes/admin/events.ts` — GET /admin/events, GET /admin/events/:id, PATCH /admin/events/:id/status.
- `apps/api/src/routes/admin/orders.ts` — GET /admin/orders, GET /admin/orders/:id, POST /admin/orders/:id/refund, POST /admin/orders/:id/cancel.
- `apps/api/src/routes/admin/payments.ts` — GET /admin/payments, GET /admin/payments/:id, PATCH /admin/payments/:id/status.
- GET /admin/notifications, GET /admin/reservations — di routes yang sesuai.

Semua admin-only via roleMiddleware('admin').

Di `apps/admin/`, buat halaman untuk setiap fitur:
- A7: `src/routes/events/+page.svelte` — tabel event + filter.
- A8: `src/routes/events/[id]/+page.svelte` — detail event + aksi status.
- A9: `src/routes/orders/+page.svelte` — tabel order.
- A10: `src/routes/orders/[id]/+page.svelte` — detail order + aksi.
- A11: `src/routes/payments/+page.svelte` — tabel payment.
- A12: `src/routes/payments/[id]/+page.svelte` — detail payment.
- A14: `src/routes/notifications/+page.svelte` — broadcast notification.
- A15: `src/routes/reservations/+page.svelte` — monitoring.

Setiap halaman punya filter, pagination, dan aksi.
```

**Checkpoint Phase 9:**
```bash
# Dashboard seller menampilkan statistik penjualan
# Dashboard admin menampilkan ringkasan seluruh platform
# Admin bisa lihat & kelola semua order, payment, event
```

---

## Phase 10: Testing, QA & Deployment

**Tujuan:** Pastikan semua fitur berfungsi, aman, dan siap deploy.

### Task 10.1 — Coverage Verification & Gap Tests

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-10.1`                                                  |
| Dependensi  | Phase 1–9 selesai                                          |
| Deliverables| Coverage report, gap tests, Vitest setup di packages/core  |

**Instruksi:**
> **Catatan:** Unit/integration tests untuk setiap API sudah ditulis di fase masing-masing (T-2.4, T-3.6, T-4.7, T-5.5, T-6.8, T-7.7). Task ini fokus pada:

1. Pastikan Vitest sudah ter-setup di `packages/core` (jika belum).
2. Tambahkan **unit tests utilitas** yang belum ter-cover:
   - `packages/core/src/__tests__/password.test.ts`: hash & verify password.
   - `packages/core/src/__tests__/jwt.test.ts`: generate, verify, expired token.
   - `apps/api/src/__tests__/order-number.test.ts`: format JVX-YYYYMMDD-XXXXX, uniqueness.
   - `apps/api/src/__tests__/ticket-code.test.ts`: format JVX- + 12 char, uniqueness.
   - `apps/api/src/__tests__/ticket-reserver.test.ts`: Durable Object reservation logic (mock), concurrency, sold out.
3. Jalankan **coverage report**: `pnpm run test:coverage`.
4. Identifikasi gap (modules dengan coverage < 80%) dan tulis tests tambahan.
5. Target: minimal 80% coverage pada `apps/api`.

**Prompt:**
```
Kerjakan Task T-10.1: Coverage Verification & Gap Tests.
Dependensi: Phase 1–9 sudah selesai, termasuk test tasks T-2.4, T-3.6, T-4.7, T-5.5, T-6.8, T-7.7.

> Unit/integration tests per API sudah ada di fase masing-masing. Task ini fokus: utility unit tests + coverage gap.

1. Setup Vitest di packages/core (jika belum):
   - Install: pnpm add -D vitest di packages/core.
   - Tambahkan script: "test": "vitest run".

2. Utility unit tests:
   - `packages/core/src/__tests__/password.test.ts`: hash & verify password. Verify wrong password → false.
   - `packages/core/src/__tests__/jwt.test.ts`: generate, verify, expired token → throw.
   - `apps/api/src/__tests__/order-number.test.ts`: format JVX-YYYYMMDD-XXXXX.
   - `apps/api/src/__tests__/ticket-code.test.ts`: format JVX- + 12 char, uniqueness.
   - `apps/api/src/__tests__/ticket-reserver.test.ts`: Durable Object logic (mock), concurrency, sold out, cancel.

3. Coverage:
   - Install: pnpm add -D @vitest/coverage-v8 di root.
   - Run: pnpm run test:coverage.
   - Review output: identifikasi modules < 80%.
   - Tulis tests tambahan untuk menutup gap.

4. Target: minimal 80% line coverage di apps/api.
```

### Task 10.2 — E2E Tests (Playwright)

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-10.2`                                                  |
| Dependensi  | `T-10.1`                                                  |
| Deliverables| Playwright test suite per portal di `tests/e2e/`           |

**Instruksi:**
> **Note:** Playwright sudah di-setup di Phase 0 (T-0.10) — `playwright.config.ts`, `tests/e2e/`, dan `@playwright/test` sudah ter-install. Task ini fokus **menulis test cases**.

1. Test flows kritis:
   - **Admin:** Login → buat kategori → verifikasi seller → lihat dashboard.
   - **Seller:** Register → buat event + tier → lihat pesanan → scan check-in.
   - **Buyer:** Register → browse event → checkout → bayar → lihat tiket.
2. Minimal 1 E2E test per halaman.

**Prompt:**
```
Kerjakan Task T-10.2: E2E Tests (Playwright).
Dependensi: T-10.1 sudah selesai.

> Playwright sudah di-setup di T-0.10 (playwright.config.ts + tests/e2e/ + @playwright/test sudah ter-install).
> Fokus task ini: menulis E2E test cases.

Test files (buat di `tests/e2e/`):

1. `tests/e2e/admin-flow.spec.ts`:
   - Login sebagai admin.
   - Buat kategori baru.
   - Verifikasi seller → cek status seller berubah.
   - Lihat dashboard → cek cards tampil.
   - Logout.

2. `tests/e2e/seller-flow.spec.ts`:
   - Register sebagai seller.
   - Login.
   - Buat event baru + tier tiket.
   - Lihat event di list.
   - Lihat pesanan (setelah ada transaksi).
   - Scan check-in.
   - Logout.

3. `tests/e2e/buyer-flow.spec.ts`:
   - Register sebagai buyer.
   - Login.
   - Browse events di homepage.
   - Buka event detail.
   - Checkout: reservasi + order + bayar.
   - Lihat tiket → QR code muncul.
   - Lihat order history.
   - Logout.

Jalankan: pnpm run test:e2e. Semua tests harus pass.
```

### Task 10.3 — Load Testing (K6)

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-10.3`                                                  |
| Dependensi  | `T-10.1`                                                  |
| Deliverables| K6 script di root `tests/load/`                            |

**Instruksi:**
1. Simulasi **war ticket**: 1000 virtual users mencoba reservasi tiket yang sama secara bersamaan.
2. Verifikasi:
   - Tidak ada overselling (total sold ≤ quota).
   - Response time P95 < 2 detik.
   - Durable Object menangani concurrency dengan benar.
3. Simulasi checkout flow: 500 users end-to-end (reserve → order → pay).

**Prompt:**
```
Kerjakan Task T-10.3: Load Testing (K6).
Dependensi: T-10.1 sudah selesai.

1. Install K6 (brew install k6 atau download binary).
2. Buat folder `tests/load/`.

3. `tests/load/war-ticket.js`:
   - Import { check, sleep } from 'k6'.
   - Import http from 'k6/http'.
   - Options: { stages: [{ duration: '10s', target: 1000 }], thresholds: { http_req_duration: ['p(95)<2000'], http_req_failed: ['rate<0.3'] } }.
   - Setup: login sebagai pre-created test users (buat skrip seed 1000 test user).
   - Default function: POST /reservations { ticket_tier_id: TARGET_TIER, quantity: 1 }.
   - Setiap user coba reservasi 1 tiket ke tier yang sama.
   - Check: response status 200 atau 409 (sold out).
   - Teardown: query DB: SELECT sold_count FROM ticket_tiers WHERE id = TARGET_TIER. Assert: sold_count <= quota (TIDAK ADA OVERSELLING).

4. `tests/load/checkout-flow.js`:
   - 500 virtual users.
   - Flow: POST /reservations → POST /orders → POST /payments/:orderId/pay.
   - Verifikasi: setiap step return expected status.
   - Thresholds: P95 < 3 detik untuk full flow.

5. Tambahkan script: "test:load": "k6 run tests/load/war-ticket.js".
6. Jalankan dan analisis hasil.
```

### Task 10.4 — Security Review

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-10.4`                                                  |
| Dependensi  | `T-10.1`                                                  |
| Deliverables| Security checklist completed                               |

**Checklist:**
- [ ] Input validation di semua endpoint (zod).
- [ ] SQL injection prevention (Drizzle ORM parameterized queries).
- [ ] XSS prevention (sanitize HTML output di frontend).
- [ ] CSRF protection.
- [ ] Rate limiting di auth endpoints dan reservation endpoint.
- [ ] Webhook signature verification di payment callback.
- [ ] Authorization check: user hanya akses data miliknya.
- [ ] Seller hanya kelola event miliknya.
- [ ] Admin endpoint hanya bisa diakses role admin.
- [ ] Password hash menggunakan bcrypt/argon2 (bukan MD5/SHA).
- [ ] JWT expiry dan refresh strategy.
- [ ] CORS configuration.
- [ ] Sensitive data tidak masuk log.

**Prompt:**
```
Kerjakan Task T-10.4: Security Review.
Dependensi: T-10.1 sudah selesai.

Lakukan security review menyeluruh pada seluruh codebase. Gunakan checklist berikut:

1. Input Validation: Pastikan semua API endpoint menggunakan Zod schema validation.
   - Cek setiap route: apakah ada body/params/query validation.
   - Fix yang belum ada.

2. SQL Injection: Verifikasi semua query menggunakan Drizzle ORM (parameterized). Cari raw SQL query dan pastikan tidak ada string concatenation.

3. XSS Prevention: Di semua frontend (buyer, seller, admin), pastikan tidak ada {@html ...} tanpa sanitization untuk user-generated content.

4. CSRF Protection: Verifikasi token-based auth (JWT) sudah cukup atau perlu tambahan CSRF token untuk cookie-based sessions.

5. Rate Limiting: Tambahkan rate limiter di:
   - POST /auth/login (max 5 per menit per IP).
   - POST /auth/register (max 3 per menit per IP).
   - POST /reservations (max 10 per menit per user).
   Gunakan Cloudflare Rate Limiting atau implementation di middleware.

6. Webhook Security: Verifikasi POST /webhooks/payment memvalidasi signature header.

7. Authorization: Cek setiap endpoint: user hanya akses data miliknya, seller hanya event miliknya, admin check di semua admin routes.

8. Password: Verifikasi menggunakan bcrypt atau argon2 (BUKAN md5/sha).

9. JWT: Verifikasi expiry, refresh token rotation, dan token tidak mengandung sensitive data.

10. CORS: Verifikasi allowedOrigins hanya berisi domain yang valid.

11. Logging: Pastikan password, JWT token, dan data sensitif tidak masuk ke log/error tracking.

Buat file `SECURITY_REVIEW.md` berisi hasil review dan status setiap item.
```

### Task 10.5 — CI/CD Pipeline

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-10.5`                                                  |
| Dependensi  | `T-10.1`, `T-10.2`                                        |
| Deliverables| `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` |

**Instruksi:**
1. **CI pipeline** (on PR):
   - Install dependencies.
   - Format check (`pnpm run format:check`).
   - Lint (`pnpm run lint`).
   - Type check (`pnpm run typecheck`).
   - Unit & integration tests (`pnpm run test`).
   - Build all apps (`pnpm run build`).
2. **Deploy pipeline** (on merge to main):
   - Run CI.
   - Deploy via SST: `pnpm run deploy --stage production`.
   - Post-deploy: run smoke tests.

**Prompt:**
```
Kerjakan Task T-10.5: CI/CD Pipeline.
Dependensi: T-10.1 dan T-10.2 sudah selesai.

1. Buat `.github/workflows/ci.yml`:
   ```yaml
   name: CI
   on:
     pull_request:
       branches: [main]
   jobs:
     ci:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: pnpm
         - run: pnpm install --frozen-lockfile
         - run: pnpm run format:check
         - run: pnpm run lint
         - run: pnpm run typecheck
         - run: pnpm run test
         - run: pnpm run build
   ```

2. Buat `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: pnpm
         - run: pnpm install --frozen-lockfile
         - run: pnpm run format:check
         - run: pnpm run lint
         - run: pnpm run typecheck
         - run: pnpm run test
         - run: pnpm run build
         - run: pnpm run deploy --stage production
           env:
             CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
         - name: Smoke Test
           run: |
             curl -f https://api.jeevatix.com/health || exit 1
             curl -f https://jeevatix.com || exit 1
   ```

3. Tambahkan scripts di root package.json:
   - "format": "turbo run format"
   - "format:check": "turbo run format:check"
   - "lint": "turbo run lint"
   - "lint:fix": "turbo run lint:fix"
   - "typecheck": "turbo run typecheck"
   - "test": "turbo run test"
   - "test:e2e": "playwright test"
   - "build": "turbo run build"
   - "deploy": "sst deploy"

```

### Task 10.6 — Production Deploy

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-10.6`                                                  |
| Dependensi  | `T-10.5`                                                  |
| Deliverables| Platform live di Cloudflare                                |

**Instruksi:**
1. Set semua environment variables di Cloudflare dashboard / SST secrets.
2. Setup Cloudflare Hyperdrive → point ke production PostgreSQL.
3. Run database migration di production.
4. Deploy: `pnpm run deploy --stage production`.
5. Verify: semua 3 portal accessible, API responding, WebSocket connected.

**Prompt:**
```
Kerjakan Task T-10.6: Production Deploy.
Dependensi: T-10.5 sudah selesai.

1. Environment Variables — Set di Cloudflare Dashboard atau SST secrets:
   - DATABASE_URL: connection string PostgreSQL production.
   - JWT_SECRET: random 64 char string (generate dengan openssl rand -hex 32).
   - JWT_REFRESH_SECRET: random 64 char berbeda.
   - PARTY_SECRET: random string untuk PartyKit auth.
   - PAYMENT_WEBHOOK_SECRET: dari payment gateway.
   - RESEND_API_KEY: dari Resend (atau Mailgun API key).
   - R2_BUCKET_NAME: nama bucket R2.
   Jalankan: sst secret set JWT_SECRET "xxxxx" --stage production (untuk setiap secret).

2. Cloudflare Hyperdrive:
   - Buat Hyperdrive config di Cloudflare dashboard: point ke production PostgreSQL.
   - Update wrangler.toml / sst.config.ts: hyperdrive binding = production config ID.

3. Database Migration:
   - pnpm --filter api run db:migrate (terhadap production DB).
   - Verifikasi: 15 tabel + 10 enum terbuat.
   - Seed admin user: INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', 'admin@jeevatix.com', HASHED_PASSWORD, 'admin').

4. Deploy:
   - pnpm run deploy --stage production.
   - Atau: sst deploy --stage production.

5. Verify:
   - API: curl https://api.jeevatix.com/health → 200 OK.
   - Buyer: buka https://jeevatix.com → homepage load.
   - Admin: buka https://admin.jeevatix.com → login page.
   - Seller: buka https://seller.jeevatix.com → login page.
   - WebSocket: buka event detail, verifikasi PartyKit connection di DevTools.
```

### Task 10.7 — Monitoring & Error Tracking

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-10.7`                                                  |
| Dependensi  | `T-10.6`                                                  |
| Deliverables| Monitoring setup                                           |

**Instruksi:**
1. Setup error tracking (Sentry atau Cloudflare Logpush) di `apps/api`.
2. Konfigurasi Cloudflare Analytics untuk traffic monitoring.
3. Setup alert untuk error rate tinggi dan response time anomali.
4. Pastikan sensitive data (password, token) tidak masuk ke log.

**Prompt:**
```
Kerjakan Task T-10.7: Monitoring & Error Tracking.
Dependensi: T-10.6 sudah selesai.

1. Error Tracking (pilih salah satu):
   Option A — Sentry:
   - Install: pnpm add @sentry/cloudflare di apps/api.
   - Buat `apps/api/src/middleware/sentry.ts`: init Sentry dengan DSN dari env.
   - Wrap Hono app: app.use('*', sentryMiddleware).
   - Setup Sentry project di sentry.io untuk frontend juga:
     - pnpm add @sentry/svelte di apps/admin, apps/seller.
     - pnpm add @sentry/browser di apps/buyer.

   Option B — Cloudflare Logpush:
   - Aktifkan Logpush di Cloudflare dashboard.
   - Target: ke R2 bucket atau external logging service.

2. Cloudflare Analytics:
   - Aktifkan Cloudflare Web Analytics di dashboard untuk ketiga domain.
   - Tambahkan analytics snippet di layout HTML setiap portal.

3. Health Check Endpoint:
   - Pastikan GET /health ada di API: return { status: 'ok', timestamp, version }.
   - Setup uptime monitoring (Cloudflare Health Check atau UptimeRobot):
     - Monitor: https://api.jeevatix.com/health (interval: 1 menit).
     - Alert: email/Slack jika down.

4. Alerting:
   - Setup alert di Sentry: error rate > 10/menit → notifikasi.
   - Setup alert di Cloudflare: response time P95 > 3s → notifikasi.
   - Pastikan password_hash, JWT token, refresh_token tidak pernah muncul di log/error report.

5. Verifikasi: trigger error 500 (misal hit endpoint dengan invalid data). Cek apakah muncul di Sentry/Logpush.
```

**Checkpoint Phase 10:**
```bash
pnpm run test          # semua test pass (unit + integration dari Phase 2-7 + coverage gap)
pnpm run test:e2e      # Playwright pass
pnpm run test:load     # K6 pass, no overselling
pnpm run build         # build sukses
pnpm run deploy --stage production  # deploy sukses
```

---

## Task Dependency Graph

```mermaid
graph TD
    T01[T-0.1 Root Monorepo]
    T02[T-0.2 SST Config]
    T03[T-0.3 packages/types]
    T04[T-0.4 packages/core]
    T05[T-0.5 apps/api]
    T06[T-0.6 apps/buyer]
    T07[T-0.7 apps/admin]
    T08[T-0.8 apps/seller]
    T09[T-0.9 packages/ui]
    T010[T-0.10 Prettier/ESLint/Playwright]

    T11[T-1.1 Enum Definitions]
    T12[T-1.2 Table Schemas]
    T13[T-1.3 DB Connection]
    T14[T-1.4 Migration & Seed]

    T21[T-2.1 Auth Middleware]
    T22[T-2.2 Auth API]
    T23[T-2.3 User API]
    T24[T-2.4 Auth Tests]
    T25[T-2.5 File Upload R2]
    T26[T-2.6 Email Service]

    T31[T-3.1 Category Admin API]
    T32[T-3.2 Admin Auth UI]
    T33[T-3.3 Admin Category UI]
    T34[T-3.4 Admin User API]
    T35[T-3.5 Admin User UI]
    T36[T-3.6 Phase 3 Tests]

    T41[T-4.1 Seller Profile API]
    T42[T-4.2 Seller Event API]
    T43[T-4.3 Tier API]
    T44[T-4.4 Seller Auth UI]
    T45[T-4.5 Seller Event UI]
    T46[T-4.6 Seller Profile UI]
    T47[T-4.7 Phase 4 Tests]

    T51[T-5.1 Public Event API]
    T52[T-5.2 Buyer Auth UI]
    T53[T-5.3 Homepage & Explore]
    T54[T-5.4 Buyer Profile UI]
    T55[T-5.5 Phase 5 Tests]

    T61[T-6.1 Durable Object]
    T62[T-6.2 Reservation API]
    T63[T-6.3 Order API]
    T64[T-6.4 Payment API]
    T65[T-6.5 Queue Cleanup]
    T66[T-6.6 Checkout UI]
    T67[T-6.7 Order History UI]
    T68[T-6.8 Phase 6 Tests]

    T71[T-7.1 Ticket Generation]
    T72[T-7.2 Ticket UI]
    T73[T-7.3 Check-in]
    T74[T-7.4 Notifications]
    T75[T-7.5 Seller Orders]
    T76[T-7.6 Seller Notif UI]
    T77[T-7.7 Phase 7 Tests]

    T81[T-8.1 PartyKit Server]
    T82[T-8.2 PartyKit Client]

    T91[T-9.1 Seller Dashboard]
    T92[T-9.2 Admin Dashboard]
    T93[T-9.3 Admin Orders/Payments]

    T01 --> T02 & T03 & T04 & T05 & T06 & T07 & T08 & T09
    T01 & T05 & T06 & T07 & T08 --> T010
    T03 --> T04
    T04 --> T11
    T11 --> T12 --> T13 --> T14

    T05 & T13 --> T21 --> T22 --> T23
    T22 & T23 --> T24
    T21 --> T25
    T05 --> T26

    T21 --> T31
    T07 & T22 --> T32
    T31 & T32 --> T33
    T21 --> T34
    T34 & T32 --> T35
    T31 & T34 --> T36

    T22 --> T41
    T21 & T13 --> T42 --> T43
    T08 & T22 --> T44
    T42 & T43 & T44 --> T45
    T41 & T44 --> T46
    T41 & T42 & T43 --> T47

    T13 --> T51
    T06 & T22 --> T52
    T51 & T52 --> T53
    T52 & T23 --> T54
    T51 --> T55

    T05 & T13 --> T61 --> T62 --> T63 --> T64
    T62 --> T65
    T62 & T63 & T64 & T53 --> T66
    T63 & T52 --> T67
    T62 & T63 & T64 --> T68

    T64 --> T71
    T71 & T52 --> T72
    T71 & T44 --> T73
    T65 & T21 --> T74
    T44 & T63 --> T75
    T74 & T44 --> T76
    T71 & T73 & T74 & T75 --> T77

    T61 --> T81
    T81 & T53 & T66 --> T82

    T75 --> T91
    T35 --> T92
    T32 & T63 & T64 --> T93
```

> **Catatan:** Task T-10.7 (Monitoring) bergantung pada T-10.6 (Production Deploy). Tidak digambarkan di graph untuk menjaga keterbacaan.

---

## Quick Reference: File → Task Mapping

Tabel ini membantu AI agent menemukan task mana yang bertanggung jawab atas file/folder tertentu.

| Path                                   | Task ID        | Keterangan                         |
| -------------------------------------- | -------------- | ---------------------------------- |
| `package.json` (root)                  | T-0.1          | Root monorepo config               |
| `turbo.json`                           | T-0.1          | Turborepo pipeline                 |
| `eslint.config.js`                     | T-0.10         | ESLint flat config (shared)        |
| `.prettierrc`                          | T-0.10         | Prettier config (shared)           |
| `.prettierignore`                      | T-0.10         | Prettier ignore patterns           |
| `playwright.config.ts`                 | T-0.10         | Playwright E2E config              |
| `tests/e2e/`                           | T-0.10, T-10.2 | Playwright E2E test suites         |
| `docker-compose.yml`                   | T-0.1          | PostgreSQL lokal (Docker)          |
| `.github/copilot-instructions.md`      | T-0.1          | Workspace-wide AI agent rules      |
| `.github/instructions/`                | T-0.1          | File-specific AI instructions      |
| `.github/prompts/`                     | T-0.1          | Reusable AI prompt templates       |
| `.github/agents/`                      | T-0.1          | Custom AI agents (reviewer)        |
| `sst.config.ts`                        | T-0.2          | SST infrastructure                 |
| `packages/types/`                      | T-0.3          | Shared TypeScript types            |
| `packages/core/`                       | T-0.4          | DB connection & Drizzle config     |
| `packages/core/src/db/schema/`         | T-1.1, T-1.2   | Database schema                    |
| `packages/core/src/db/seed.ts`         | T-1.4          | Seed data                          |
| `packages/ui/`                         | T-0.9          | Shared UI components               |
| `apps/api/src/middleware/`             | T-2.1          | Auth & CORS middleware             |
| `apps/api/src/routes/auth.ts`          | T-2.2          | Auth endpoints (`createRoute()` + `app.openapi()`) |
| `apps/api/src/services/auth.service.ts` | T-2.2          | Auth business logic                |
| `apps/api/src/schemas/auth.schema.ts`  | T-2.2          | Auth validation schemas            |
| `apps/api/src/routes/users.ts`         | T-2.3          | User profile endpoints             |
| `apps/api/src/services/user.service.ts`| T-2.3          | User business logic                |
| `apps/api/src/schemas/user.schema.ts`  | T-2.3          | User validation schemas            |
| `apps/api/src/routes/upload.ts`        | T-2.5          | File upload (R2) endpoint          |
| `apps/api/src/services/upload.service.ts`| T-2.5        | Upload business logic              |
| `apps/api/src/routes/events.ts`        | T-5.1          | Public event endpoints             |
| `apps/api/src/services/public-event.service.ts`| T-5.1  | Public event business logic        |
| `apps/api/src/routes/seller/`          | T-4.1–T-4.3, T-7.5, T-9.1 | Seller route handlers     |
| `apps/api/src/services/event.service.ts`| T-4.2         | Seller event business logic        |
| `apps/api/src/services/tier.service.ts`| T-4.3          | Tier business logic                |
| `apps/api/src/routes/admin/`           | T-3.1, T-3.4, T-9.2, T-9.3 | Admin route handlers     |
| `apps/api/src/services/category.service.ts`| T-3.1      | Category business logic            |
| `apps/api/src/services/admin-user.service.ts`| T-3.4    | Admin user management logic        |
| `apps/api/src/routes/reservations.ts`  | T-6.2          | Reservation endpoints              |
| `apps/api/src/services/reservation.service.ts`| T-6.2   | Reservation business logic         |
| `apps/api/src/routes/orders.ts`        | T-6.3          | Order endpoints                    |
| `apps/api/src/services/order.service.ts`| T-6.3         | Order business logic               |
| `apps/api/src/routes/payments.ts`      | T-6.4          | Payment endpoints                  |
| `apps/api/src/services/payment.service.ts`| T-6.4       | Payment business logic             |
| `apps/api/src/routes/tickets.ts`       | T-7.1          | Ticket endpoints                   |
| `apps/api/src/durable-objects/`        | T-6.1          | Durable Object (TicketReserver)    |
| `apps/api/src/queues/`                 | T-6.5          | Cloudflare Queue consumers         |
| `apps/api/src/__tests__/`             | T-2.4, T-3.6, T-4.7, T-5.5, T-6.8, T-7.7, T-10.1 | API tests (per-phase + coverage gap) |
| `apps/api/src/services/`              | T-2.2–T-2.6, T-3.1, T-3.4, T-4.1–T-4.3, T-5.1, T-6.2–T-6.4, T-7.1, T-7.4, T-7.5, T-9.1–T-9.3 | Business logic services |
| `apps/api/src/schemas/`               | T-2.2–T-2.5, T-3.1, T-3.4, T-4.1–T-4.3, T-5.1, T-6.2–T-6.4, T-7.1, T-7.4, T-9.3 | Zod validation schemas (DTO)     |
| `apps/buyer/src/routes/`              | T-5.2–T-5.4, T-6.6–T-6.7, T-7.2 | Buyer pages         |
| `apps/admin/src/routes/`              | T-3.2–T-3.5, T-9.2–T-9.3 | Admin pages                |
| `apps/seller/src/routes/`             | T-4.4–T-4.6, T-7.3, T-7.5, T-7.6, T-9.1 | Seller pages   |
| `.github/workflows/`                  | T-10.5         | CI/CD pipelines                    |

---

## Notes for AI Agents

- **Selalu baca dokumen referensi** (DATABASE_DESIGN.md, PAGES.md) sebelum mengerjakan task. Jangan mengarang kolom, route, atau endpoint.
- **Satu task = satu commit** (jika memungkinkan). Commit message: `feat(T-X.X): <deskripsi singkat>`. Gunakan `git` CLI untuk version control.
- **Edge compatibility**: Semua library di `apps/api` HARUS compatible dengan Cloudflare Workers runtime (no Node.js-only APIs). Cek sebelum install.
- **Validasi input**: Gunakan `z` dari `@hono/zod-openapi` (BUKAN dari `zod` langsung) di semua API endpoint. Definisikan schema validasi di folder `schemas/` (`schemas/*.schema.ts`). Setiap schema harus diberi `.openapi('SchemaName')`. Route handler menggunakan `c.req.valid('json'|'query'|'param')` — BUKAN manual `schema.parse(await c.req.json())`.
- **Arsitektur 3-layer + OpenAPI**: Route (OpenAPIHono + `createRoute()` + `app.openapi()`) → Service (business logic + DB) → Schema (Zod + `.openapi()` = DTO + OpenAPI spec). Lihat Execution Rules #10 dan #11 untuk detail.
- **Code quality**: Jalankan `pnpm run format:check` dan `pnpm run lint` sebelum commit. ESLint flat config (`eslint.config.js`) + Prettier (`.prettierrc`). Lihat Execution Rules #12 dan #13.
- **Error handling**: Gunakan Hono error handler. Response format konsisten: `{ success: boolean, data?: T, error?: { code: string, message: string } }`.
- **Pagination**: Gunakan cursor-based atau offset pagination. Default limit: 20, max: 100. Response: `{ data: T[], meta: { total, page, limit, totalPages } }`.
- **Concurrent-safe**: Untuk operasi yang melibatkan `sold_count` pada `ticket_tiers`, SELALU gunakan Durable Object. JANGAN langsung update dari API handler.
- **File upload**: Semua upload gambar harus melalui `POST /upload` (T-2.5) ke Cloudflare R2. Jangan simpan file di filesystem lokal.
- **Email**: Semua pengiriman email harus async melalui Cloudflare Queue + email service (T-2.6). Jangan kirim email secara sinkron di request handler.
- **AI agent customization**: Rules dan instructions tersedia di `.github/` — `copilot-instructions.md` (always-on), `instructions/` (auto-attach per file pattern), `prompts/` (slash commands), `agents/` (custom agents). Lihat Execution Rules #14.

### MCP Tools Cheat Sheet

**Untuk task UI (semua task di Phase 3-9 yang membuat halaman frontend):**
```
# Lihat semua komponen shadcn/ui yang tersedia
shadcn-ui MCP → list_components

# Dapatkan source code komponen (misal: button, data-table, dialog, card)
shadcn-ui MCP → get_component(componentName: "button")
shadcn-ui MCP → get_component_demo(componentName: "data-table")

# Template block siap pakai (sangat berguna untuk dashboard, login, sidebar)
shadcn-ui MCP → list_blocks(category: "dashboard")  # untuk T-9.1, T-9.2
shadcn-ui MCP → list_blocks(category: "login")       # untuk T-3.2, T-4.4, T-5.2
shadcn-ui MCP → list_blocks(category: "sidebar")     # untuk layout admin/seller
shadcn-ui MCP → get_block(blockName: "dashboard-01")  # dapatkan source code block

# Tema visual
shadcn-ui MCP → list_themes
shadcn-ui MCP → apply_theme(query: "modern")          # untuk T-0.9
```

**Untuk lookup dokumentasi library:**
```
# Cari library ID
Context7 MCP → resolve-library-id(libraryName: "hono")
Context7 MCP → resolve-library-id(libraryName: "drizzle-orm")

# Ambil dokumentasi berdasarkan topik
Context7 MCP → get-library-docs(context7CompatibleLibraryID: "...", topic: "middleware")
Context7 MCP → get-library-docs(context7CompatibleLibraryID: "...", topic: "pgTable schema")
```

**Untuk version control:**
```bash
# Workflow per fase
git checkout -b feat/phase-0
git add . && git commit -m "feat(T-X.X): deskripsi"   # commit setiap task selesai
git push origin feat/phase-0 && gh pr create           # PR setelah fase selesai
```
