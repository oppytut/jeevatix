# Jeevatix — Development Plan

> Dokumen ini adalah **rencana eksekusi pembangunan** platform Jeevatix dari nol.
> Setiap fase memiliki **task ID**, **deskripsi**, **deliverables**, **dependensi**, dan **referensi** ke dokumen lain.
> AI agent harus mengeksekusi task **secara berurutan per fase**, kecuali task dalam fase yang sama boleh paralel jika tidak ada dependensi.

**Dokumen referensi:**
- `README.md` — Tech stack, arsitektur, monorepo structure, MCP servers
- `DATABASE_DESIGN.md` — Skema database, 15 tabel, enum, ERD
- `PAGES.md` — 48 halaman frontend + 64 API endpoints

**MCP Tools tersedia:**
- `filesystem-mcp-server` — Operasi filesystem (baca/tulis/cari file dalam project)
- `shadcn-ui-mcp-server` — Referensi komponen, block, dan tema shadcn/ui (gunakan untuk semua task UI)

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
   - **filesystem MCP**: Untuk operasi file — gunakan `read_file`, `write_file`, `directory_tree`, `search_files` untuk navigasi dan manipulasi file project.
9. **Satu task = satu commit, satu branch per fase.** Gunakan `git` CLI untuk membuat branch `feat/phase-X` dan commit setiap task selesai.

---

## Phase Overview

```mermaid
gantt
    title Jeevatix Development Plan
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d
    
    section Phase 0 - Foundation
    Monorepo Setup           :p0, 2026-03-27, 2d
    
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
    
    section Phase 4 - Seller
    Event CRUD API + UI      :p4a, after p3c, 3d
    Tier Tiket API + UI      :p4b, after p4a, 1d
    Seller Dashboard         :p4c, after p4b, 1d
    
    section Phase 5 - Buyer Public
    Event List & Detail      :p5a, after p4c, 2d
    Homepage & Kategori      :p5b, after p5a, 1d
    
    section Phase 6 - Transaction
    Durable Objects + Reserve:p6a, after p5b, 3d
    Order & Payment API      :p6b, after p6a, 2d
    Checkout & Payment UI    :p6c, after p6b, 2d
    
    section Phase 7 - Post-Transaction
    Ticket Generation        :p7a, after p6c, 2d
    Check-in System          :p7b, after p7a, 1d
    Notification System      :p7c, after p7b, 1d
    Seller Notification UI   :p7d, after p7c, 1d
    
    section Phase 8 - Realtime
    PartyKit WebSocket       :p8, after p7d, 2d
    
    section Phase 9 - Polish
    Dashboards & Analytics   :p9a, after p8, 2d
    Admin Order & Payment    :p9b, after p9a, 1d
    
    section Phase 10 - QA & Deploy
    Testing                  :p10a, after p9b, 3d
    CI/CD & Deploy           :p10b, after p10a, 2d
    Monitoring               :p10c, after p10b, 1d
```

---

## Phase 0: Monorepo Foundation

**Tujuan:** Setup monorepo dari nol sehingga `pnpm install` dan `pnpm run dev` bisa berjalan tanpa error.

### Task 0.1 — Initialize Root Monorepo

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-0.1`                                                   |
| Dependensi  | Tidak ada                                                  |
| Deliverables| `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.nvmrc`, `tsconfig.base.json` |

**Instruksi:**
1. Init `package.json` dengan `"private": true` dan `"packageManager": "pnpm@9.x"`.
2. Buat `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
   ```
3. Buat `turbo.json` dengan pipeline `build`, `dev`, `lint`, `test`.
4. Buat `tsconfig.base.json` (shared TypeScript config, `strict: true`, paths alias `@jeevatix/*`).
5. Buat `.nvmrc` → `22`.
6. Buat `.gitignore` (node_modules, .env, dist, .turbo, .sst).
7. Buat `.env.example` dengan variabel:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/jeevatix
   CLOUDFLARE_ACCOUNT_ID=
   CLOUDFLARE_API_TOKEN=
   JWT_SECRET=
   ```

**Prompt:**
```
Baca file README.md untuk memahami tech stack dan monorepo structure project Jeevatix.

Kerjakan Task T-0.1: Initialize Root Monorepo.

Buat file-file berikut di root project:
1. `package.json` — private: true, packageManager: pnpm@9.x, scripts kosong (build, dev, lint, test via turbo).
2. `pnpm-workspace.yaml` — packages: ["apps/*", "packages/*"].
3. `turbo.json` — pipeline: build, dev, lint, test.
4. `tsconfig.base.json` — strict: true, paths alias @jeevatix/* ke packages/*.
5. `.nvmrc` — isi: 22.
6. `.gitignore` — node_modules, .env, dist, .turbo, .sst, .wrangler.
7. `.env.example` — variabel: DATABASE_URL, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, JWT_SECRET.

Jangan buat folder apps/ atau packages/ dulu — itu task berikutnya.
Pastikan `pnpm install` bisa berjalan tanpa error setelah selesai.
```

### Task 0.2 — Setup SST Config

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
Baca file README.md untuk memahami arsitektur Jeevatix.

Kerjakan Task T-0.2: Setup SST Config.
Dependensi: T-0.1 sudah selesai.

1. Install SST: `pnpm add -Dw sst@latest aws-cdk-lib constructs`.
2. Buat file `sst.config.ts` di root project.
3. Definisikan app name: "jeevatix", stage dari environment variable.
4. Tambahkan placeholder/komentar untuk resource yang akan dibuat nanti: Cloudflare Workers (API), Hyperdrive (DB connection pooling), Durable Objects (TicketReserver), Queues (email, reservation cleanup).

Pastikan file valid TypeScript dan tidak ada error.
```

### Task 0.3 — Create Package: `packages/types`

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
Baca file DATABASE_DESIGN.md untuk memahami semua enum dan tabel.

Kerjakan Task T-0.3: Create Package packages/types.
Dependensi: T-0.1 sudah selesai.

1. Buat folder `packages/types/` dengan `package.json` (name: @jeevatix/types) dan `tsconfig.json` (extends root tsconfig.base.json).
2. Buat `packages/types/src/index.ts` yang meng-export:
   a. TypeScript enum/union types untuk semua 10 enum di DATABASE_DESIGN.md: UserRole, UserStatus, EventStatus, TicketTierStatus, OrderStatus, PaymentStatus, PaymentMethod, ReservationStatus, TicketStatus, NotificationType.
   b. Interface untuk setiap entity: User, SellerProfile, Event, Category, EventCategory, EventImage, TicketTier, Reservation, Order, OrderItem, Payment, Ticket, TicketCheckin, Notification, RefreshToken.
   c. Generic API response types: ApiResponse<T>, PaginatedResponse<T>, ErrorResponse.

Gunakan exact kolom dan tipe dari DATABASE_DESIGN.md. Jangan mengarang field.
```

### Task 0.4 — Create Package: `packages/core`

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

### Task 0.5 — Create App: `apps/api`

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-0.5`                                                   |
| Dependensi  | `T-0.1`, `T-0.4`                                          |
| Deliverables| `apps/api/package.json`, `apps/api/src/index.ts`, `apps/api/wrangler.toml` |

**Instruksi:**
1. Buat package `@jeevatix/api`.
2. `pnpm add hono` di `apps/api`.
3. Buat `src/index.ts` — Hono app dengan health check route `GET /health` → `{ status: "ok" }`.
4. Buat `wrangler.toml` — config untuk Cloudflare Workers.
5. Setup script: `"dev": "wrangler dev src/index.ts"`.

**Prompt:**
```
Baca file README.md untuk memahami tech stack API (Hono + Cloudflare Workers).

Kerjakan Task T-0.5: Create App apps/api.
Dependensi: T-0.1 dan T-0.4 sudah selesai.

1. Buat folder `apps/api/` dengan `package.json` (name: @jeevatix/api).
2. Install: `pnpm add hono` di apps/api.
3. Install dev: `pnpm add -D wrangler @cloudflare/workers-types` di apps/api.
4. Buat `apps/api/tsconfig.json` (extends root, types: @cloudflare/workers-types).
5. Buat `apps/api/wrangler.toml` — name: jeevatix-api, compatibility_date terbaru, main: src/index.ts.
6. Buat `apps/api/src/index.ts` — Hono app dengan satu route: GET /health → { status: "ok" }. Export default app.
7. Tambahkan script di package.json: "dev": "wrangler dev src/index.ts".

Verifikasi: `cd apps/api && pnpm dev` harus start tanpa error, GET http://localhost:8787/health harus return { status: "ok" }.
```

### Task 0.6 — Create App: `apps/buyer`

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
Baca file README.md untuk memahami tech stack Buyer portal (SvelteKit + Cloudflare).

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

### Task 0.7 — Create App: `apps/admin`

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
Baca file README.md untuk memahami tech stack Admin portal (SvelteKit + shadcn-svelte).

Kerjakan Task T-0.7: Create App apps/admin.
Dependensi: T-0.1 sudah selesai.

1. Initialize SvelteKit project di `apps/admin/`.
2. Tambahkan TailwindCSS + shadcn-svelte.
3. Setup `apps/admin/svelte.config.js` — adapter: @sveltejs/adapter-cloudflare.
4. Buat layout: `src/routes/+layout.svelte` dengan sidebar navigation (menu: Dashboard, Users, Sellers, Events, Orders, Payments, Categories, Notifications, Reservations).
5. Buat `src/routes/+page.svelte` — placeholder dashboard "Admin Dashboard".
6. Konfigurasi dev port: 4302 di vite.config.ts (server.port: 4302).

⚡ MCP Tools:
- Gunakan shadcn-ui MCP → list_components() untuk melihat semua komponen shadcn-svelte yang tersedia.
- Gunakan shadcn-ui MCP → get_component("sidebar") untuk mendapatkan source code sidebar component.
- Gunakan shadcn-ui MCP → list_blocks(category: "sidebar") lalu get_block() untuk mendapatkan template sidebar layout.

Verifikasi: `cd apps/admin && pnpm dev` harus start di http://localhost:4302 tanpa error.
```

### Task 0.8 — Create App: `apps/seller`

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
Baca file README.md untuk memahami tech stack Seller portal (SvelteKit + shadcn-svelte).

Kerjakan Task T-0.8: Create App apps/seller.
Dependensi: T-0.1 sudah selesai.

1. Initialize SvelteKit project di `apps/seller/`.
2. Tambahkan TailwindCSS + shadcn-svelte.
3. Setup `apps/seller/svelte.config.js` — adapter: @sveltejs/adapter-cloudflare.
4. Buat layout: `src/routes/+layout.svelte` dengan sidebar navigation (menu: Dashboard, Events, Orders, Check-in, Notifications, Profile).
5. Buat `src/routes/+page.svelte` — placeholder "Seller Dashboard".
6. Konfigurasi dev port: 4303 di vite.config.ts (server.port: 4303).

⚡ MCP Tools:
- Gunakan shadcn-ui MCP → list_components() untuk melihat semua komponen shadcn-svelte yang tersedia.
- Gunakan shadcn-ui MCP → get_component("sidebar") untuk mendapatkan source code sidebar component.
- Gunakan shadcn-ui MCP → list_blocks(category: "sidebar") lalu get_block() untuk mendapatkan template sidebar layout.

Verifikasi: `cd apps/seller && pnpm dev` harus start di http://localhost:4303 tanpa error.
```

### Task 0.9 — Create Package: `packages/ui`

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

⚡ MCP Tools:
- Gunakan shadcn-ui MCP → list_components() untuk melihat daftar lengkap semua komponen shadcn-svelte.
- Gunakan shadcn-ui MCP → get_component("button"), get_component("input"), get_component("card"), dll untuk mendapatkan source code setiap komponen.
- Gunakan shadcn-ui MCP → list_themes() dan apply_theme() untuk setup tema brand Jeevatix.
- Gunakan shadcn-ui MCP → get_component_demo("data-table") untuk melihat contoh penggunaan DataTable.
```

**Checkpoint Phase 0:**
```bash
pnpm install          # harus sukses tanpa error
pnpm run build        # semua app harus build sukses
pnpm run dev          # semua app harus start di port masing-masing
```

---

## Phase 1: Database Schema & Migration

**Tujuan:** Definisikan seluruh 15 tabel + 10 enum di Drizzle ORM, jalankan push ke PostgreSQL.

### Task 1.1 — Drizzle Enum Definitions

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
Baca file DATABASE_DESIGN.md bagian "Enum Definitions" untuk melihat semua 10 enum yang harus dibuat.

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

### Task 1.2 — Drizzle Table Schemas

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
Baca file DATABASE_DESIGN.md bagian "Tables" secara lengkap untuk melihat semua 15 tabel beserta kolom, tipe, constraint, dan index.

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

### Task 1.3 — Database Connection

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

### Task 1.4 — Run Migration

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

1. Pastikan PostgreSQL lokal sudah running dan DATABASE_URL di .env sudah benar.
2. Jalankan `cd packages/core && pnpm drizzle-kit push` untuk membuat semua tabel di database.
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

### Task 2.1 — Auth Middleware & Utilities

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
Baca file DATABASE_DESIGN.md (tabel users, refresh_tokens) dan PAGES.md (Auth API E1-E7, E63).

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

### Task 2.2 — Auth API Endpoints

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-2.2`                                                   |
| Dependensi  | `T-2.1`                                                   |
| Deliverables| `apps/api/src/routes/auth.ts`                              |
| Endpoints   | E1–E7, E63 (lihat PAGES.md → Auth API)                     |

**Instruksi:**
1. Buat Hono router di `routes/auth.ts`.
2. Implementasi:
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
Baca file PAGES.md bagian Auth API (E1-E7, E63) dan DATABASE_DESIGN.md (tabel users, seller_profiles, refresh_tokens).

Kerjakan Task T-2.2: Auth API Endpoints.
Dependensi: T-2.1 sudah selesai (middleware auth, password, jwt sudah ada).

Buat file `apps/api/src/routes/auth.ts` sebagai Hono router:

1. POST /auth/register — Input: {email, password, full_name, phone?}. Validasi dengan zod (email valid, password min 8 char). Hash password, insert ke users (role: buyer). Return access token + refresh token.
2. POST /auth/register/seller — Input: {email, password, full_name, phone?, org_name, org_description?}. Insert ke users (role: seller) + insert ke seller_profiles. Return tokens.
3. POST /auth/login — Input: {email, password}. Cek email ada, verify password. Simpan refresh token hash ke tabel refresh_tokens. Return {access_token, refresh_token, user}.
4. POST /auth/refresh — Input: {refresh_token}. Verify token, cek hash ada di refresh_tokens dan belum expired/revoked. Generate access token baru + rotate refresh token baru. Revoke token lama.
5. POST /auth/forgot-password — Input: {email}. Generate reset token, placeholder untuk enqueue email.
6. POST /auth/reset-password — Input: {token, password}. Verify token, update password_hash.
7. POST /auth/verify-email — Input: {token}. Update email_verified_at = now().
8. POST /auth/logout — Revoke refresh token di tabel refresh_tokens. Hapus/expire.

Install zod: `pnpm add zod` di apps/api.
Semua response format: { success: boolean, data?: T, error?: { code: string, message: string } }.
Mount router di apps/api/src/index.ts.
```

### Task 2.3 — User API Endpoints

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-2.3`                                                   |
| Dependensi  | `T-2.2`                                                   |
| Deliverables| `apps/api/src/routes/users.ts`                             |
| Endpoints   | E8–E10 (lihat PAGES.md → User API)                         |

**Instruksi:**
1. `GET /users/me` → return current user dari JWT context.
2. `PATCH /users/me` → update full_name, phone, avatar_url.
3. `PATCH /users/me/password` → verify old password, hash & update new password.

**Prompt:**
```
Baca file PAGES.md bagian User API (E8-E10) dan DATABASE_DESIGN.md (tabel users).

Kerjakan Task T-2.3: User API Endpoints.
Dependensi: T-2.2 sudah selesai.

Buat file `apps/api/src/routes/users.ts` sebagai Hono router:

1. GET /users/me — Protected (authMiddleware). Return current user data dari JWT context (id, email, full_name, phone, avatar_url, role, status, email_verified_at, created_at). Jangan return password_hash.
2. PATCH /users/me — Protected. Input: {full_name?, phone?, avatar_url?}. Validasi dengan zod. Update fields yang dikirim saja.
3. PATCH /users/me/password — Protected. Input: {old_password, new_password}. Verify old_password terhadap hash di DB. Hash new_password dan update.

Mount router di apps/api/src/index.ts.
```

### Task 2.4 — Auth Unit Tests

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

### Task 2.5 — File Upload Service (Cloudflare R2)

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-2.5`                                                   |
| Dependensi  | `T-2.1`                                                   |
| Deliverables| `apps/api/src/routes/upload.ts`, R2 bucket config di `wrangler.toml` |
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
2. Buat file `apps/api/src/routes/upload.ts` sebagai Hono router:
   - POST /upload — Protected (authMiddleware).
   - Terima multipart form data dengan field "file".
   - Validasi: tipe file hanya image/jpeg, image/png, image/webp. Max size: 5MB.
   - Generate key unik: `uploads/{uuid}.{extension}`.
   - Upload ke R2 bucket via c.env.BUCKET.put(key, file).
   - Return { success: true, data: { url: "https://{R2_PUBLIC_URL}/{key}" } }.
3. Mount router di apps/api/src/index.ts.

Endpoint ini akan digunakan oleh semua form upload gambar: avatar user, logo seller, banner event, galeri event.
```

### Task 2.6 — Email Service

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
# Manual test:
curl -X POST http://localhost:8787/auth/register -d '{"email":"test@test.com","password":"Test123!","full_name":"Test"}'
curl -X POST http://localhost:8787/auth/login -d '{"email":"test@test.com","password":"Test123!"}'
```

---

## Phase 3: Admin Portal — Category & User Management

**Tujuan:** Admin bisa login, kelola kategori (CRUD), dan kelola user/seller.

### Task 3.1 — Category API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-3.1`                                                   |
| Dependensi  | `T-2.1`                                                   |
| Deliverables| `apps/api/src/routes/admin/categories.ts`                  |
| Endpoints   | E14, E15, E57–E60 (lihat PAGES.md)                         |

**Instruksi:**
1. Public: `GET /categories` (list), `GET /categories/:slug/events` (events by category).
2. Admin: CRUD `POST/PATCH/DELETE /admin/categories`.
3. Auto-generate slug dari name.
4. Validasi: jangan hapus kategori yang masih punya event.

**Prompt:**
```
Baca file PAGES.md bagian Event API Public (E14-E15) dan Admin API (E57-E60) dan DATABASE_DESIGN.md (tabel categories, event_categories).

Kerjakan Task T-3.1: Category API.
Dependensi: T-2.1 sudah selesai.

Buat file `apps/api/src/routes/admin/categories.ts` sebagai Hono router:

1. GET /categories — Public. List semua kategori. Return: id, name, slug, icon.
2. GET /categories/:slug/events — Public. List events berdasarkan kategori slug. Hanya events status published/ongoing. Include ticket_tiers info. Pagination.
3. GET /admin/categories — Admin only. List kategori + jumlah event per kategori.
4. POST /admin/categories — Admin only. Input: {name, icon?}. Auto-generate slug dari name (lowercase, replace spasi dengan dash). Validasi: name unique.
5. PATCH /admin/categories/:id — Admin only. Input: {name?, icon?}. Re-generate slug jika name berubah.
6. DELETE /admin/categories/:id — Admin only. Validasi: jangan hapus jika masih ada event yang terhubung via event_categories. Return error jika masih ada.

Gunakan zod untuk validasi input. Mount di index.ts.
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
Baca file PAGES.md bagian Admin Portal Auth (A1).

Kerjakan Task T-3.2: Admin Auth UI (Login).
Dependensi: T-0.7 dan T-2.2 sudah selesai.

Di `apps/admin/`:

1. Buat `src/lib/api.ts` — HTTP client wrapper (fetch) untuk call API di localhost:8787. Fungsi: apiGet, apiPost, apiPatch, apiDelete. Otomatis attach Authorization header dari stored token. Handle error response.
2. Buat `src/lib/auth.ts` — fungsi login(email, password), logout(), getUser(), isAuthenticated(). Simpan access_token dan refresh_token di cookie (httpOnly) atau localStorage. Implementasi auto-refresh: jika access token expired, panggil POST /auth/refresh.
3. Buat `src/routes/login/+page.svelte` — form email + password + tombol Login. Panggil API POST /auth/login. Jika sukses dan role=admin, redirect ke /. Jika role bukan admin, tampilkan error.
4. Buat auth guard di `src/routes/+layout.server.ts` atau `+layout.ts` — cek apakah user sudah login dan role=admin. Jika belum, redirect ke /login. Exclude halaman /login dari guard.

Gunakan shadcn-svelte components (Button, Input, Card) dari @jeevatix/ui jika tersedia.

⚡ MCP Tools:
- Gunakan shadcn-ui MCP → list_blocks(category: "login") untuk melihat template login page.
- Gunakan shadcn-ui MCP → get_block("login-01") untuk mendapatkan source code login page lengkap.
- Gunakan shadcn-ui MCP → get_component("button"), get_component("input"), get_component("card") untuk referensi komponen.
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
Baca file PAGES.md bagian Admin Portal (A13 — Manajemen Kategori).

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

Gunakan shadcn-svelte components: DataTable, Button, Input, Dialog/Modal, Toast.

⚡ MCP Tools:
- Gunakan shadcn-ui MCP → get_component("data-table") dan get_component_demo("data-table") untuk referensi dan contoh DataTable.
- Gunakan shadcn-ui MCP → get_component("dialog"), get_component("toast"), get_component("input") untuk source code komponen.
```

### Task 3.4 — Admin User Management API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-3.4`                                                   |
| Dependensi  | `T-2.1`                                                   |
| Deliverables| `apps/api/src/routes/admin/users.ts`                       |
| Endpoints   | E45–E49 (lihat PAGES.md → Admin API)                       |

**Instruksi:**
1. `GET /admin/users` → list + filter by role, status + search by name/email + pagination.
2. `GET /admin/users/:id` → detail user + seller_profile (jika seller).
3. `PATCH /admin/users/:id/status` → ubah status (active/suspended/banned).
4. `GET /admin/sellers` → list seller + is_verified status.
5. `PATCH /admin/sellers/:id/verify` → set is_verified = true/false.

**Prompt:**
```
Baca file PAGES.md bagian Admin API (E45-E49) dan DATABASE_DESIGN.md (tabel users, seller_profiles).

Kerjakan Task T-3.4: Admin User Management API.
Dependensi: T-2.1 sudah selesai.

Buat file `apps/api/src/routes/admin/users.ts` sebagai Hono router (semua endpoint admin-only via roleMiddleware('admin')):

1. GET /admin/users — List users. Query params: role (filter), status (filter), search (ILIKE name/email), page, limit. Return paginated response dengan meta: {total, page, limit, totalPages}.
2. GET /admin/users/:id — Detail user. Join seller_profiles jika role=seller. Include order count dan ticket count.
3. PATCH /admin/users/:id/status — Input: {status: 'active'|'suspended'|'banned'}. Update user status. Jangan bisa ubah status admin sendiri.
4. GET /admin/sellers — List seller (users dengan role=seller) + join seller_profiles. Filter: is_verified (true/false). Pagination.
5. PATCH /admin/sellers/:id/verify — Input: {is_verified: boolean}. Update seller_profiles.is_verified, set verified_at = now() dan verified_by = current admin user id jika true. Set verified_at = null dan verified_by = null jika false.

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
Baca file PAGES.md bagian Admin Portal (A3-A6: Users dan Sellers).

Kerjakan Task T-3.5: Admin User Management UI.
Dependensi: T-3.4 dan T-3.2 sudah selesai.

Di `apps/admin/`:

1. `src/routes/users/+page.svelte` — DataTable semua user. Filter dropdown: role (all/buyer/seller/admin), status (all/active/suspended/banned). Search bar. Pagination. Klik row → navigate ke /users/[id].
2. `src/routes/users/[id]/+page.svelte` — Detail user: info profil, seller profile (jika seller), statistik order/tiket. Tombol aksi: Suspend, Ban, Activate (PATCH /admin/users/:id/status). Konfirmasi dialog sebelum aksi.
3. `src/routes/sellers/+page.svelte` — DataTable seller. Filter: verified/unverified. Kolom: Nama Organisasi, Email, Status Verifikasi, Jumlah Event. Klik row → navigate ke /sellers/[id].
4. `src/routes/sellers/[id]/+page.svelte` — Detail seller: data organisasi, data bank, daftar event. Tombol "Verify" (set is_verified=true) dan "Reject" (set is_verified=false). Konfirmasi dialog.

Gunakan shadcn-svelte components dari @jeevatix/ui.
```

**Checkpoint Phase 3:**
```bash
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
| Deliverables| `apps/api/src/routes/seller/profile.ts`                    |
| Endpoints   | E39–E40 (lihat PAGES.md)                                   |

**Instruksi:**
1. `GET /seller/profile` → return seller_profiles + users data.
2. `PATCH /seller/profile` → update org_name, org_description, logo_url, bank info.

**Prompt:**
```
Baca file PAGES.md bagian Seller Profile API (E39-E40) dan DATABASE_DESIGN.md (tabel users, seller_profiles).

Kerjakan Task T-4.1: Seller Auth & Profile API.
Dependensi: T-2.2 sudah selesai.

Buat file `apps/api/src/routes/seller/profile.ts` sebagai Hono router (semua endpoint via authMiddleware + roleMiddleware('seller')):

1. GET /seller/profile — Return data gabungan: user fields (full_name, email, phone, avatar_url) + seller_profiles fields (org_name, org_description, logo_url, bank_name, bank_account_number, bank_account_holder, is_verified, verified_at). Join users dan seller_profiles berdasarkan user_id dari JWT.
2. PATCH /seller/profile — Input: {org_name?, org_description?, logo_url?, bank_name?, bank_account_number?, bank_account_holder?}. Validasi dengan zod. Update fields yang dikirim saja di tabel seller_profiles.

Mount di apps/api/src/index.ts dengan prefix /seller.
```

### Task 4.2 — Seller Event CRUD API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-4.2`                                                   |
| Dependensi  | `T-2.1`, `T-1.3`                                          |
| Deliverables| `apps/api/src/routes/seller/events.ts`                     |
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
Baca file PAGES.md bagian Seller Event API (E16-E20) dan DATABASE_DESIGN.md (tabel events, event_categories, event_images, ticket_tiers, seller_profiles).

Kerjakan Task T-4.2: Seller Event CRUD API.
Dependensi: T-2.1 dan T-1.3 sudah selesai.

Buat file `apps/api/src/routes/seller/events.ts` sebagai Hono router (seller-only):

1. GET /seller/events — List events milik seller (berdasarkan seller_profile_id dari JWT user). Filter query param: status. Join ticket_tiers untuk statistik: total_quota, total_sold. Pagination.
2. POST /seller/events — Input: {title, description, venue_name, venue_address, venue_city, venue_latitude?, venue_longitude?, start_at, end_at, sale_start_at, sale_end_at, banner_url?, max_tickets_per_order?, category_ids: number[], images: {image_url, sort_order}[], tiers: {name, description?, price, quota, sort_order, sale_start_at?, sale_end_at?}[]}. Database transaction: insert event (status: draft) + event_categories + event_images + ticket_tiers. Auto-generate slug dari title. Validasi temporal: end_at > start_at, sale_end_at > sale_start_at, sale_start_at <= start_at.
3. GET /seller/events/:id — Detail event + images + categories + tiers + statistik penjualan per tier. Validasi: event milik seller ini.
4. PATCH /seller/events/:id — Update event fields. Validasi ownership. Jika seller submit untuk review, ubah status draft/rejected → pending_review.
5. DELETE /seller/events/:id — Hapus event. Hanya boleh jika status = draft. Cascade: delete event_categories, event_images, ticket_tiers.

Event status flow: draft → pending_review (seller submit) → published/rejected (admin review). Seller bisa edit event rejected lalu submit ulang ke pending_review.
Mount di index.ts.
```

### Task 4.3 — Ticket Tier CRUD API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-4.3`                                                   |
| Dependensi  | `T-4.2`                                                   |
| Deliverables| `apps/api/src/routes/seller/tiers.ts`                      |
| Endpoints   | E21–E24 (lihat PAGES.md → Ticket Tier API Seller)          |

**Instruksi:**
1. CRUD tier tiket untuk event tertentu.
2. Validasi: jangan hapus tier yang sudah ada penjualan (sold_count > 0).
3. Validasi: seller hanya bisa kelola tier dari eventnya sendiri.

**Prompt:**
```
Baca file PAGES.md bagian Ticket Tier API (E21-E24) dan DATABASE_DESIGN.md (tabel ticket_tiers).

Kerjakan Task T-4.3: Ticket Tier CRUD API.
Dependensi: T-4.2 sudah selesai.

Buat file `apps/api/src/routes/seller/tiers.ts` sebagai Hono router (seller-only):

1. GET /seller/events/:id/tiers — List semua tier tiket dari event tertentu. Validasi: event milik seller ini. Return: id, name, description, price, quota, sold_count, sort_order, status, sale_start_at, sale_end_at.
2. POST /seller/events/:id/tiers — Input: {name, description?, price, quota, sort_order?, sale_start_at?, sale_end_at?}. Validasi ownership. Insert ke ticket_tiers dengan event_id.
3. PATCH /seller/events/:id/tiers/:tierId — Input: {name?, description?, price?, quota?, sort_order?, status?, sale_start_at?, sale_end_at?}. Validasi ownership. Jangan izinkan quota < sold_count. Jangan izinkan ubah price jika sold_count > 0.
4. DELETE /seller/events/:id/tiers/:tierId — Validasi ownership. Jangan hapus tier jika sold_count > 0 (return error).

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
Baca file PAGES.md bagian Seller Portal Auth (S1-S4).

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

Gunakan shadcn-svelte components.

⚡ MCP Tools:
- Gunakan shadcn-ui MCP → list_blocks(category: "login") lalu get_block() untuk mendapatkan template halaman login.
- Gunakan shadcn-ui MCP → list_blocks(category: "sidebar") lalu get_block() untuk template sidebar layout.
- Gunakan shadcn-ui MCP → get_component("button"), get_component("input"), get_component("card") untuk referensi komponen.
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
Baca file PAGES.md bagian Seller Portal (S6-S10: Event Management).

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

Gunakan shadcn-svelte components. Upload gambar via POST /upload (T-2.5).

⚡ MCP Tools:
- Gunakan shadcn-ui MCP → get_component("data-table") dan get_component_demo("data-table") untuk referensi DataTable.
- Gunakan shadcn-ui MCP → get_component("tabs"), get_component("form"), get_component("select") untuk multi-step form components.
- Gunakan shadcn-ui MCP → get_component("badge") untuk status badges.
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
Baca file PAGES.md bagian Seller Portal (S14-S15: Profile & Settings).

Kerjakan Task T-4.6: Seller Profile UI.
Dependensi: T-4.1 dan T-4.4 sudah selesai.

Di `apps/seller/`:

1. `src/routes/profile/+page.svelte` — Form edit profil organisasi. Fetch GET /seller/profile saat load. Fields:
   - Org Name, Org Description (textarea), Logo (upload via POST /upload, preview gambar).
   - Data Bank: Bank Name, Account Number, Account Holder.
   - Tampilkan status verifikasi: Verified ✅ / Pending ⏳.
   - Tombol Simpan → PATCH /seller/profile.
2. `src/routes/profile/password/+page.svelte` — Form ubah password: Old Password, New Password, Confirm New Password. Submit PATCH /users/me/password.

Gunakan shadcn-svelte components.
```

**Checkpoint Phase 4:**
```bash
# Seller bisa login, buat event, kelola tier, edit profil
open http://localhost:4303/login
open http://localhost:4303/events/create  # buat event + tier
open http://localhost:4303/events         # list events
```

---

## Phase 5: Buyer Portal — Public Pages

**Tujuan:** Buyer bisa browse event, lihat detail, search & filter.

### Task 5.1 — Public Event API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-5.1`                                                   |
| Dependensi  | `T-1.3`                                                   |
| Deliverables| `apps/api/src/routes/events.ts`                            |
| Endpoints   | E11–E15 (lihat PAGES.md → Event API Public)                |

**Instruksi:**
1. `GET /events` → list published events + filter (category, city, date range, price range) + search (title) + pagination.
2. `GET /events/featured` → events where `is_featured = true`.
3. `GET /events/:slug` → detail event by slug, join semua relasi.
4. `GET /categories` → list semua kategori.
5. `GET /categories/:slug/events` → events by kategori.
6. Hanya return events dengan `status = 'published'` atau `'ongoing'` untuk endpoint publik.
7. **Search strategy:** Gunakan PostgreSQL `ILIKE` untuk pencarian title. Untuk performa lebih baik, tambahkan `tsvector` column + GIN index pada `events.title` dan `events.description` untuk full-text search.

**Prompt:**
```
Baca file PAGES.md bagian Event API Public (E11-E15) dan DATABASE_DESIGN.md (tabel events, categories, event_categories, event_images, ticket_tiers, seller_profiles).

Kerjakan Task T-5.1: Public Event API.
Dependensi: T-1.3 sudah selesai.

Buat file `apps/api/src/routes/events.ts` sebagai Hono router (semua public/tanpa auth):

1. GET /events — List events (hanya status published/ongoing). Query params:
   - search: ILIKE pada title (contoh: WHERE title ILIKE '%keyword%').
   - category: filter by category slug (join event_categories + categories).
   - city: filter by venue_city.
   - date_from, date_to: filter by start_at range.
   - price_min, price_max: filter event yang punya tier dengan price dalam range.
   - page, limit (default 20, max 100).
   Return: events + min_price dari ticket_tiers + kategori names. Paginated response.
2. GET /events/featured — Events where is_featured = true, status published/ongoing. Limit 10. Include event_images (banner).
3. GET /events/:slug — Detail event by slug. Join: event_images, event_categories + categories, ticket_tiers (with availability: quota - sold_count), seller_profiles (org_name, logo_url). Return semua data.
4. GET /categories — List semua kategori (id, name, slug, icon).
5. GET /categories/:slug/events — Events by kategori slug. Hanya published/ongoing. Pagination.

Search strategy: gunakan ILIKE untuk sekarang. Jika perlu performa lebih baik, tambahkan tsvector + GIN index di events.title nanti.
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
Baca file PAGES.md bagian Buyer Portal Auth (B1-B5).

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
5. Gunakan komponen shadcn-svelte (Button, Input, Card) dari @jeevatix/ui.

Desain bersih dan responsive. Gunakan TailwindCSS.

⚡ MCP Tools:
- Gunakan shadcn-ui MCP → list_blocks(category: "login") lalu get_block() untuk mendapatkan template halaman login/register.
- Gunakan shadcn-ui MCP → get_component("button"), get_component("input"), get_component("card") untuk referensi komponen.
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
Baca file PAGES.md bagian Buyer Portal Public (B6-B9).

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

Desain modern, responsive. Gunakan TailwindCSS + shadcn-svelte components. Buat reusable Svelte component: EventCard.svelte di `src/lib/components/`.

⚡ MCP Tools:
- Gunakan shadcn-ui MCP → get_component("card") dan get_component_demo("card") untuk referensi dan contoh Card component.
- Gunakan shadcn-ui MCP → get_component("carousel") untuk featured events carousel.
- Gunakan shadcn-ui MCP → get_component("badge"), get_component("pagination") untuk komponen pendukung.
- Gunakan shadcn-ui MCP → list_blocks() untuk melihat apakah ada block template yang cocok untuk layout homepage.
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
Baca file PAGES.md bagian Buyer Portal Protected (B16-B17).

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

Gunakan shadcn-svelte components. Protect halaman: redirect ke /login jika belum login (via +page.server.ts load guard atau hooks).

⚡ MCP Tools:
- Gunakan shadcn-ui MCP → get_component("avatar"), get_component("form"), get_component("input") untuk halaman profil.
- Gunakan shadcn-ui MCP → get_component("badge") untuk badge notifikasi unread.
```

**Checkpoint Phase 5:**
```bash
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
Baca file DATABASE_DESIGN.md bagian "Concurrency & War Ticket Flow" (sequence diagram) dan tabel reservations, ticket_tiers.

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
| Deliverables| `apps/api/src/routes/reservations.ts`                      |
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
Baca file PAGES.md bagian Reservation API (E25-E27) dan DATABASE_DESIGN.md (tabel reservations, ticket_tiers, events).

Kerjakan Task T-6.2: Reservation API.
Dependensi: T-6.1 sudah selesai.

Buat file `apps/api/src/routes/reservations.ts` sebagai Hono router (buyer-only via authMiddleware + roleMiddleware('buyer')):

1. POST /reservations — Input: {ticket_tier_id, quantity}. Logika:
   - Cek user tidak punya active reservation lain untuk event yang sama.
   - Anti-abuse: query total tiket user untuk event ini (dari orders confirmed + reservations active). Tolak jika total + quantity > events.max_tickets_per_order.
   - Dapatkan Durable Object instance: c.env.TICKET_RESERVER.get(c.env.TICKET_RESERVER.idFromName(tierId)).
   - Delegate ke TicketReserver.reserve(userId, tierId, quantity).
   - Return { reservation_id, expires_at } atau error SOLD_OUT (409).

2. GET /reservations/:id — Return reservation data + remaining time (expires_at - now). Validasi: reservation milik user ini.

3. DELETE /reservations/:id — Validasi: reservation milik user ini, status masih active. Delegate ke TicketReserver.cancelReservation().

Set expires_at = now + 10 menit.
Mount di index.ts.
```

### Task 6.3 — Order API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-6.3`                                                   |
| Dependensi  | `T-6.2`                                                   |
| Deliverables| `apps/api/src/routes/orders.ts`                            |
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
Baca file PAGES.md bagian Order API (E28-E30) dan DATABASE_DESIGN.md (tabel orders, order_items, payments, reservations, ticket_tiers).

Kerjakan Task T-6.3: Order API.
Dependensi: T-6.2 sudah selesai.

Buat file `apps/api/src/routes/orders.ts` sebagai Hono router (buyer-only):

1. POST /orders — Input: {reservation_id}. Logika dalam database transaction:
   - Validasi reservation: status = active, expires_at > now, milik user ini.
   - Ambil data reservation: ticket_tier_id, quantity.
   - Ambil data tier: price.
   - Generate order_number: format JVX-YYYYMMDD-XXXXX (XXXXX = 5 digit random angka).
   - Insert order: user_id, reservation_id, order_number, total_amount = price * quantity, service_fee = 0, status = pending, expires_at = now + 30 menit.
   - Insert order_items: order_id, ticket_tier_id, quantity, unit_price = price, subtotal = price * quantity.
   - Insert payment: order_id, method = default, status = pending, amount = total_amount.
   - Update reservation: status = converted.
   - Return order data.

2. GET /orders — List order milik buyer. Pagination (page, limit). Join: order_items, payments, events (via ticket_tiers). Return status, order_number, total_amount, created_at.

3. GET /orders/:id — Detail order + order_items (join ticket_tiers, events) + payment + tickets. Validasi: order milik user.

Mount di index.ts.
```

### Task 6.4 — Payment API

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-6.4`                                                   |
| Dependensi  | `T-6.3`                                                   |
| Deliverables| `apps/api/src/routes/payments.ts`                          |
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
Baca file PAGES.md bagian Payment API (E31-E32) dan DATABASE_DESIGN.md (tabel payments, orders, tickets, order_items).

Kerjakan Task T-6.4: Payment API.
Dependensi: T-6.3 sudah selesai.

Buat file `apps/api/src/routes/payments.ts` sebagai Hono router:

1. POST /payments/:orderId/pay — Buyer-only. Input: {method: 'bank_transfer'|'e_wallet'|'credit_card'|'virtual_account'}. Logika:
   - Validasi: order milik user, status = pending, expires_at > now.
   - Update payment method.
   - Integrasikan dengan payment gateway (GUNAKAN MOCK/PLACEHOLDER dulu: langsung set payment status = success untuk development).
   - Return { payment_url } atau { status: 'success' } jika mock.

2. POST /webhooks/payment — Public (tapi verify webhook signature). Logika:
   - Verify webhook signature dari payment gateway header (keamanan!).
   - Idempotency: cek payment.status — jika sudah success, return 200 OK tanpa aksi. Gunakan external_ref sebagai idempotency key.
   - Update payment: status = success, paid_at = now, external_ref = dari gateway.
   - Update order: status = confirmed, confirmed_at = now.
   - Call ticket generation service: generateTickets(orderId) — dari T-7.1 (placeholder dulu, implementasi di Phase 7).
   - Enqueue email via Cloudflare Queue: kirim e-ticket ke buyer.
   - Enqueue notification: sendNotification(buyer, 'order_confirmed', ...) — placeholder.

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
Baca file DATABASE_DESIGN.md (tabel reservations, ticket_tiers) dan diagram "Concurrency & War Ticket Flow".

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
Baca file PAGES.md bagian Buyer Portal Protected (B10-B11: Checkout & Payment).

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

Gunakan shadcn-svelte components (Button, Card, RadioGroup, Input).

⚡ MCP Tools:
- Gunakan shadcn-ui MCP → get_component("radio-group"), get_component("card"), get_component("button") untuk referensi komponen checkout.
- Gunakan shadcn-ui MCP → get_component("alert") untuk alert sold out.
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
Baca file PAGES.md bagian Buyer Portal Protected (B12-B13: Order History).

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

**Checkpoint Phase 6:**
```bash
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
| Deliverables| `apps/api/src/services/ticket-generator.ts`                |
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
Baca file PAGES.md bagian Ticket API (E33-E34) dan DATABASE_DESIGN.md (tabel tickets, order_items, orders).

Kerjakan Task T-7.1: Ticket Generation.
Dependensi: T-6.4 sudah selesai.

Buat file `apps/api/src/services/ticket-generator.ts`:

1. Export fungsi generateTickets(orderId: string):
   - Query order_items WHERE order_id = orderId (join ticket_tiers untuk nama tier).
   - Untuk setiap order_item, loop quantity kali:
     - Generate ticket_code = 'JVX-' + nanoid(12) (install nanoid).
     - Insert ke tabel tickets: order_item_id, ticket_code, status = 'valid'.
   - Return array of generated tickets.

2. Integrasikan di payment webhook (apps/api/src/routes/payments.ts):
   - Setelah payment status = success dan order = confirmed, panggil generateTickets(orderId).

Buat file `apps/api/src/routes/tickets.ts` sebagai Hono router (buyer-only):

3. GET /tickets — List semua tiket milik buyer (join orders, order_items, ticket_tiers, events). Filter: orders.user_id = currentUser.id. Return: ticket_code, event name, tier name, status, event date.

4. GET /tickets/:id — Detail tiket: ticket_code (untuk QR), event info, tier info, status, checkin info jika ada. Validasi: tiket milik user.

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
Baca file PAGES.md bagian Buyer Portal Protected (B14-B15: Tickets).

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
| Deliverables| Check-in API + Seller check-in page (S13, E35–E36)         |

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
Baca file PAGES.md bagian Seller Portal (S13) dan Check-in API (E35-E36), DATABASE_DESIGN.md (tabel tickets, ticket_checkins).

Kerjakan Task T-7.3: Check-in API & UI (Seller).
Dependensi: T-7.1 dan T-4.4 sudah selesai.

Buat/tambahkan di `apps/api/src/routes/seller.ts` (atau file terpisah `seller-checkin.ts`):

1. POST /seller/events/:id/checkin — Input: {ticket_code}. Logika:
   - Validasi: seller adalah pemilik event ini.
   - Query ticket by ticket_code (join order_items, ticket_tiers) WHERE ticket_tiers.event_id = :id.
   - Cek: ticket ada → jika tidak: return { status: 'INVALID' }.
   - Cek: ticket.status = 'valid' → jika 'used': return { status: 'ALREADY_USED', checkin_time }.
   - Insert ke ticket_checkins: ticket_id, checked_in_by = seller.id, checked_in_at = now.
   - Update ticket: status = 'used'.
   - Return { status: 'SUCCESS', ticket_code, buyer_name, tier_name }.

2. GET /seller/events/:id/checkin/stats — Return:
   - total_tickets: count tickets for this event.
   - checked_in: count tickets with status = 'used'.
   - remaining: total_tickets - checked_in.
   - percentage: (checked_in / total_tickets * 100).

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
| Deliverables| Notification service + API endpoints (E41–E43, E61)        |

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
Baca file PAGES.md bagian Notification API (E41-E43, E61) dan DATABASE_DESIGN.md (tabel notifications, enum notification_type).

Kerjakan Task T-7.4: Notification System.
Dependensi: T-6.5 dan T-2.1 sudah selesai.

Buat file `apps/api/src/services/notification-service.ts`:

1. Export fungsi sendNotification(userId: string, type: NotificationType, title: string, body: string, metadata?: object):
   - Insert ke tabel notifications: user_id, type, title, body, metadata (jsonb), is_read = false.
   - Return notification record.

2. Integrasikan trigger di berbagai tempat (update file yang sudah ada):
   - `routes/payments.ts` (payment webhook success): sendNotification(buyerId, 'order_confirmed', 'Pesanan Dikonfirmasi', 'Order {order_number} berhasil dibayar.').
   - `routes/payments.ts` (payment webhook success): sendNotification(sellerId, 'new_order', 'Pesanan Baru', 'Ada pesanan baru untuk event {event_name}.').
   - `queues/reservation-cleanup.ts` (menjelang expire): sendNotification(buyerId, 'payment_reminder', 'Segera Bayar', 'Reservasi Anda akan expired dalam 2 menit.').
   - `routes/admin.ts` (approve event): sendNotification(sellerId, 'event_approved', 'Event Disetujui', 'Event {event_name} sudah dipublikasikan.').
   - `routes/admin.ts` (reject event): sendNotification(sellerId, 'event_rejected', 'Event Ditolak', 'Event {event_name} ditolak. Alasan: {reason}.').

Buat file `apps/api/src/routes/notifications.ts` sebagai Hono router (authenticated):

3. GET /notifications — List notifikasi milik user. Pagination. Sort by created_at DESC. Include unread count.
4. PATCH /notifications/:id/read — Mark satu notifikasi as read. Validasi: milik user.
5. PATCH /notifications/read-all — Mark semua notifikasi user as read.

Buat di admin routes:
6. POST /admin/notifications/broadcast — Admin kirim notifikasi ke semua user atau by role. Input: {title, body, target_role?: 'buyer'|'seller'|'all'}.

Mount di index.ts.
```

### Task 7.5 — Seller Order View

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-7.5`                                                   |
| Dependensi  | `T-4.4`, `T-6.3`                                          |
| Deliverables| Seller order pages (S11–S12, E37–E38)                      |

**Instruksi:**
1. API: `GET /seller/orders` → list order untuk event milik seller.
2. API: `GET /seller/orders/:id` → detail order + buyer info.
3. UI: `apps/seller/src/routes/orders/+page.svelte` → tabel pesanan.
4. UI: `apps/seller/src/routes/orders/[id]/+page.svelte` → detail pesanan.

**Prompt:**
```
Baca file PAGES.md bagian Seller Portal (S11-S12) dan Seller Order API (E37-E38), DATABASE_DESIGN.md (tabel orders, order_items, events, ticket_tiers).

Kerjakan Task T-7.5: Seller Order View.
Dependensi: T-4.4 dan T-6.3 sudah selesai.

Buat/tambahkan di `apps/api/src/routes/seller.ts`:

1. GET /seller/orders — List order untuk event milik seller. Logika:
   - Query orders JOIN order_items JOIN ticket_tiers JOIN events WHERE events.seller_id = currentUser.seller_profile_id.
   - Pagination (page, limit). Filter by: event_id (optional), status (optional).
   - Return: order_number, buyer name, event name, total_amount, status, created_at.

2. GET /seller/orders/:id — Detail order. Validasi: order untuk event milik seller.
   - Return: order data + order_items (tier name, quantity, unit_price) + buyer info (name, email) + payment status.

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
Baca file PAGES.md bagian Seller Portal (S16: Notifications).

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

**Checkpoint Phase 7:**
```bash
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
Baca file README.md bagian "Real-time" (PartyKit) dan DATABASE_DESIGN.md (tabel ticket_tiers).

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
Baca file PAGES.md bagian Buyer Portal (B7: Event Detail, B10: Checkout).

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
Baca file PAGES.md bagian Seller Portal (S5: Dashboard, E39-E40).

Kerjakan Task T-9.1: Seller Dashboard.
Dependensi: T-7.5 sudah selesai.

Buat/tambahkan API di `apps/api/src/routes/seller.ts`:

1. GET /seller/dashboard — Aggregate data untuk seller:
   - total_events: count events WHERE seller_id = current.
   - total_revenue: sum orders.total_amount WHERE order status = confirmed, event milik seller.
   - total_tickets_sold: sum order_items.quantity WHERE order confirmed, event milik seller.
   - upcoming_events: count events WHERE start_date > now, seller_id = current.
   - recent_orders: 5 order terbaru (join events).
   - daily_sales: array of { date, tickets_sold, revenue } untuk 30 hari terakhir (GROUP BY DATE(orders.created_at)).

Di `apps/seller/`:

2. `src/routes/+page.svelte` (dashboard halaman utama):
   - Fetch GET /seller/dashboard di load function.
   - Cards (grid 2x2): Total Event, Total Revenue (format Rupiah), Total Tiket Terjual, Event Mendatang.
   - Tabel "Pesanan Terbaru": order_number, event, buyer, total, status, tanggal. Link ke /orders/[id].
   - Grafik line chart: penjualan tiket per hari 30 hari terakhir. Gunakan library chart sederhana (Chart.js atau custom SVG).

Install chart library jika perlu: pnpm add chart.js (di workspace apps/seller).

⚡ MCP Tools:
- Gunakan shadcn-ui MCP → list_blocks(category: "dashboard") lalu get_block() untuk mendapatkan template dashboard layout.
- Gunakan shadcn-ui MCP → get_component("card"), get_component("data-table") untuk komponen statistik dan tabel.
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
Baca file PAGES.md bagian Admin Portal (A2: Dashboard, E44).

Kerjakan Task T-9.2: Admin Dashboard.
Dependensi: T-3.5 sudah selesai.

Buat/tambahkan API di `apps/api/src/routes/admin.ts`:

1. GET /admin/dashboard — Aggregate seluruh platform:
   - total_users: count users.
   - total_sellers: count users WHERE role = seller.
   - total_buyers: count users WHERE role = buyer.
   - total_events: count events.
   - total_events_published: count events WHERE status = published.
   - total_revenue: sum orders.total_amount WHERE status = confirmed.
   - total_tickets_sold: sum order_items.quantity WHERE order confirmed.
   - daily_transactions: array of { date, orders_count, revenue } 30 hari (GROUP BY DATE).
   - recent_events: 5 event terbaru.
   - recent_orders: 5 order terbaru.

Di `apps/admin/`:

2. `src/routes/+page.svelte` (dashboard):
   - Fetch GET /admin/dashboard di load function.
   - Cards (grid 2x3): Total User, Total Seller, Total Event, Total Revenue, Tiket Terjual, Event Published.
   - Grafik bar chart: transaksi harian 30 hari.
   - Tabel "Event Terbaru": name, seller, status, tanggal.
   - Tabel "Pesanan Terbaru": order_number, buyer, total, status.

Install chart library jika perlu.

⚡ MCP Tools:
- Gunakan shadcn-ui MCP → list_blocks(category: "dashboard") lalu get_block() untuk mendapatkan template dashboard layout.
- Gunakan shadcn-ui MCP → get_component("card"), get_component("data-table") untuk komponen statistik dan tabel.
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
Baca file PAGES.md bagian Admin Portal (A7-A12, A14-A15) dan API (E50-E56, E62).
Baca file DATABASE_DESIGN.md (tabel events, orders, payments, notifications, reservations).

Kerjakan Task T-9.3: Admin Order & Payment Management.
Dependensi: T-3.2, T-6.3, T-6.4 sudah selesai.

Buat/tambahkan API di `apps/api/src/routes/admin.ts`:

1. Event Management:
   - GET /admin/events — List semua event. Filter: status, seller_id, search. Pagination.
   - GET /admin/events/:id — Detail event + tiers + seller info.
   - PATCH /admin/events/:id/status — Ubah status (publish, reject, dll). Trigger notifikasi ke seller.

2. Order Management:
   - GET /admin/orders — List semua order. Filter: status, event_id, search. Pagination.
   - GET /admin/orders/:id — Detail order + items + payment + buyer info.
   - POST /admin/orders/:id/refund — Proses refund: update order status = refunded, payment status = refunded. Trigger notifikasi.
   - POST /admin/orders/:id/cancel — Cancel order: update order, restore stok.

3. Payment Management:
   - GET /admin/payments — List payments. Filter: status, method. Pagination.
   - GET /admin/payments/:id — Detail payment.
   - PATCH /admin/payments/:id/status — Manual update status (untuk resolve masalah).

4. Notification Management:
   - GET /admin/notifications — List semua notifikasi platform.

5. Reservation Monitor:
   - GET /admin/reservations — List active reservations. Monitor health.

Di `apps/admin/`, buat halaman untuk setiap fitur:
- A7: `src/routes/events/+page.svelte` — tabel event + filter.
- A8: `src/routes/events/[id]/+page.svelte` — detail event + aksi status.
- A9: `src/routes/orders/+page.svelte` — tabel order.
- A10: `src/routes/orders/[id]/+page.svelte` — detail order + aksi.
- A11: `src/routes/payments/+page.svelte` — tabel payment.
- A12: `src/routes/payments/[id]/+page.svelte` — detail payment.
- A14: `src/routes/notifications/+page.svelte` — broadcast notification.
- A15: `src/routes/reservations/+page.svelte` — monitoring.

Gunakan komponen tabel dari shadcn-svelte. Setiap halaman punya filter, pagination, dan aksi.

⚡ MCP Tools:
- Gunakan shadcn-ui MCP → get_component("data-table") dan get_component_demo("data-table") untuk referensi DataTable.
- Gunakan shadcn-ui MCP → get_component("badge"), get_component("dialog"), get_component("select") untuk komponen pendukung.
- Gunakan shadcn-ui MCP → get_component("pagination") untuk navigasi halaman.
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

### Task 10.1 — Unit & Integration Tests

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-10.1`                                                  |
| Dependensi  | Phase 1–9 selesai                                          |
| Deliverables| Test files di setiap app & package                         |

**Instruksi:**
1. Setup Vitest di semua apps & packages.
2. **Unit test** untuk:
   - Password hashing & verification.
   - JWT generation & verification.
   - Order number generation.
   - Ticket code generation.
   - Durable Object reservation logic.
3. **Integration test** untuk setiap API route group:
   - Auth flow (register → verify → login → refresh).
   - Event CRUD (seller create → admin publish → buyer list).
   - Transaction flow (reserve → order → pay → ticket generated).
   - Check-in flow (scan code → validate → record).
4. Target: minimal 80% coverage pada `apps/api`.

**Prompt:**
```
Baca file DEVELOPMENT_PLAN.md secara keseluruhan untuk memahami semua fitur yang sudah diimplementasi.

Kerjakan Task T-10.1: Unit & Integration Tests.
Dependensi: Phase 1–9 sudah selesai.

1. Setup Vitest di semua apps & packages:
   - Install: pnpm add -D vitest @vitest/coverage-v8 di root.
   - Buat vitest.config.ts di apps/api, packages/core.
   - Tambahkan script: "test": "vitest run", "test:coverage": "vitest run --coverage".

2. Unit tests (buat di folder __tests__/ di setiap module):
   - `packages/core/src/__tests__/password.test.ts`: hash & verify password.
   - `packages/core/src/__tests__/jwt.test.ts`: generate, verify, expired token.
   - `apps/api/src/__tests__/order-number.test.ts`: format JVX-YYYYMMDD-XXXXX.
   - `apps/api/src/__tests__/ticket-code.test.ts`: format JVX- + 12 char, uniqueness.
   - `apps/api/src/__tests__/ticket-reserver.test.ts`: Durable Object reservation logic (mock), concurrency, sold out, cancel.

3. Integration tests (gunakan Vitest + miniflare atau mock DB):
   - `apps/api/src/__tests__/auth.integration.test.ts`: register → verify email → login → refresh token → access protected endpoint.
   - `apps/api/src/__tests__/events.integration.test.ts`: seller create event → admin approve → buyer list (should appear) → buyer detail.
   - `apps/api/src/__tests__/transaction.integration.test.ts`: reserve → order → pay → ticket generated.
   - `apps/api/src/__tests__/checkin.integration.test.ts`: scan code → validate → record → scan again (already used).

4. Run: pnpm run test. Target: minimal 80% coverage di apps/api.
```

### Task 10.2 — E2E Tests (Playwright)

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-10.2`                                                  |
| Dependensi  | `T-10.1`                                                  |
| Deliverables| Playwright test suite per portal                           |

**Instruksi:**
1. Setup Playwright di `apps/admin`, `apps/seller`, `apps/buyer`.
2. Test flows kritis:
   - **Admin:** Login → buat kategori → verifikasi seller → lihat dashboard.
   - **Seller:** Register → buat event + tier → lihat pesanan → scan check-in.
   - **Buyer:** Register → browse event → checkout → bayar → lihat tiket.
3. Minimal 1 E2E test per halaman.

**Prompt:**
```
Kerjakan Task T-10.2: E2E Tests (Playwright).
Dependensi: T-10.1 sudah selesai.

1. Setup Playwright:
   - Install: pnpm add -D @playwright/test di root.
   - npx playwright install (install browsers).
   - Buat playwright.config.ts di root: baseURL per portal (buyer :4301, admin :4302, seller :4303).
   - Buat folder `tests/e2e/`.

2. Test files:
   - `tests/e2e/admin-flow.spec.ts`:
     - Login sebagai admin.
     - Buat kategori baru.
     - Verifikasi seller → cek status seller berubah.
     - Lihat dashboard → cek cards tampil.
     - Logout.

   - `tests/e2e/seller-flow.spec.ts`:
     - Register sebagai seller.
     - Login.
     - Buat event baru + tier tiket.
     - Lihat event di list.
     - Lihat pesanan (setelah ada transaksi).
     - Scan check-in.
     - Logout.

   - `tests/e2e/buyer-flow.spec.ts`:
     - Register sebagai buyer.
     - Login.
     - Browse events di homepage.
     - Buka event detail.
     - Checkout: reservasi + order + bayar.
     - Lihat tiket → QR code muncul.
     - Lihat order history.
     - Logout.

3. Tambahkan script: "test:e2e": "playwright test".
4. Jalankan: pnpm run test:e2e.
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
   - "lint": "turbo run lint"
   - "typecheck": "turbo run typecheck"
   - "test": "turbo run test"
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
pnpm run test          # semua test pass
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

    T31[T-3.1 Category API]
    T32[T-3.2 Admin Auth UI]
    T33[T-3.3 Admin Category UI]
    T34[T-3.4 Admin User API]
    T35[T-3.5 Admin User UI]

    T41[T-4.1 Seller Profile API]
    T42[T-4.2 Seller Event API]
    T43[T-4.3 Tier API]
    T44[T-4.4 Seller Auth UI]
    T45[T-4.5 Seller Event UI]
    T46[T-4.6 Seller Profile UI]

    T51[T-5.1 Public Event API]
    T52[T-5.2 Buyer Auth UI]
    T53[T-5.3 Homepage & Explore]
    T54[T-5.4 Buyer Profile UI]

    T61[T-6.1 Durable Object]
    T62[T-6.2 Reservation API]
    T63[T-6.3 Order API]
    T64[T-6.4 Payment API]
    T65[T-6.5 Queue Cleanup]
    T66[T-6.6 Checkout UI]
    T67[T-6.7 Order History UI]

    T71[T-7.1 Ticket Generation]
    T72[T-7.2 Ticket UI]
    T73[T-7.3 Check-in]
    T74[T-7.4 Notifications]
    T75[T-7.5 Seller Orders]
    T76[T-7.6 Seller Notif UI]

    T81[T-8.1 PartyKit Server]
    T82[T-8.2 PartyKit Client]

    T91[T-9.1 Seller Dashboard]
    T92[T-9.2 Admin Dashboard]
    T93[T-9.3 Admin Orders/Payments]

    T01 --> T02 & T03 & T04 & T05 & T06 & T07 & T08 & T09
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

    T22 --> T41
    T21 & T13 --> T42 --> T43
    T08 & T22 --> T44
    T42 & T43 & T44 --> T45
    T41 & T44 --> T46

    T13 --> T51
    T06 & T22 --> T52
    T51 & T52 --> T53
    T52 & T23 --> T54

    T05 & T13 --> T61 --> T62 --> T63 --> T64
    T62 --> T65
    T62 & T63 & T64 & T53 --> T66
    T63 & T52 --> T67

    T64 --> T71
    T71 & T52 --> T72
    T71 & T44 --> T73
    T65 & T21 --> T74
    T44 & T63 --> T75
    T74 & T44 --> T76

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
| `sst.config.ts`                        | T-0.2          | SST infrastructure                 |
| `packages/types/`                      | T-0.3          | Shared TypeScript types            |
| `packages/core/`                       | T-0.4          | DB connection & Drizzle config     |
| `packages/core/src/db/schema/`         | T-1.1, T-1.2   | Database schema                    |
| `packages/core/src/db/seed.ts`         | T-1.4          | Seed data                          |
| `packages/ui/`                         | T-0.9          | Shared UI components               |
| `apps/api/src/middleware/`             | T-2.1          | Auth & CORS middleware             |
| `apps/api/src/routes/auth.ts`          | T-2.2          | Auth endpoints                     |
| `apps/api/src/routes/users.ts`         | T-2.3          | User profile endpoints             |
| `apps/api/src/routes/upload.ts`        | T-2.5          | File upload (R2) endpoint          |
| `apps/api/src/routes/events.ts`        | T-5.1          | Public event endpoints             |
| `apps/api/src/routes/seller/`          | T-4.1–T-4.3    | Seller endpoints                   |
| `apps/api/src/routes/admin/`           | T-3.1, T-3.4   | Admin endpoints                    |
| `apps/api/src/routes/reservations.ts`  | T-6.2          | Reservation endpoints              |
| `apps/api/src/routes/orders.ts`        | T-6.3          | Order endpoints                    |
| `apps/api/src/routes/payments.ts`      | T-6.4          | Payment endpoints                  |
| `apps/api/src/routes/tickets.ts`       | T-7.1          | Ticket endpoints                   |
| `apps/api/src/durable-objects/`        | T-6.1          | Durable Object (TicketReserver)    |
| `apps/api/src/queues/`                 | T-6.5          | Cloudflare Queue consumers         |
| `apps/api/src/services/`              | T-2.6, T-7.1, T-7.4 | Business logic & email services    |
| `apps/buyer/src/routes/`              | T-5.2–T-5.4, T-6.6–T-6.7, T-7.2 | Buyer pages         |
| `apps/admin/src/routes/`              | T-3.2–T-3.5, T-9.2–T-9.3 | Admin pages                |
| `apps/seller/src/routes/`             | T-4.4–T-4.6, T-7.3, T-7.5, T-7.6, T-9.1 | Seller pages   |
| `.github/workflows/`                  | T-10.5         | CI/CD pipelines                    |

---

## Notes for AI Agents

- **Selalu baca dokumen referensi** (DATABASE_DESIGN.md, PAGES.md) sebelum mengerjakan task. Jangan mengarang kolom, route, atau endpoint.
- **Satu task = satu commit** (jika memungkinkan). Commit message: `feat(T-X.X): <deskripsi singkat>`. Gunakan `git` CLI untuk version control.
- **Edge compatibility**: Semua library di `apps/api` HARUS compatible dengan Cloudflare Workers runtime (no Node.js-only APIs). Cek sebelum install.
- **Validasi input**: Gunakan `zod` di semua API endpoint. Definisikan schema validasi berdekatan dengan route handler.
- **Error handling**: Gunakan Hono error handler. Response format konsisten: `{ success: boolean, data?: T, error?: { code: string, message: string } }`.
- **Pagination**: Gunakan cursor-based atau offset pagination. Default limit: 20, max: 100. Response: `{ data: T[], meta: { total, page, limit, totalPages } }`.
- **Concurrent-safe**: Untuk operasi yang melibatkan `sold_count` pada `ticket_tiers`, SELALU gunakan Durable Object. JANGAN langsung update dari API handler.
- **File upload**: Semua upload gambar harus melalui `POST /upload` (T-2.5) ke Cloudflare R2. Jangan simpan file di filesystem lokal.
- **Email**: Semua pengiriman email harus async melalui Cloudflare Queue + email service (T-2.6). Jangan kirim email secara sinkron di request handler.

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

**Untuk file operations:**
```
# Navigasi project
filesystem MCP → directory_tree(path: "/home/gmedia/bench/jeevatix")
filesystem MCP → search_files(path: "...", pattern: "*.svelte")
filesystem MCP → read_file / write_file / edit_file
```

**Untuk version control:**
```bash
# Workflow per fase
git checkout -b feat/phase-0
git add . && git commit -m "feat(T-X.X): deskripsi"   # commit setiap task selesai
git push origin feat/phase-0 && gh pr create           # PR setelah fase selesai
```
