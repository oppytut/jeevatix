# Jeevatix — Development Plan

> Dokumen ini adalah **rencana eksekusi pembangunan** platform Jeevatix dari nol.
> Setiap fase memiliki **task ID**, **deskripsi**, **deliverables**, **dependensi**, dan **referensi** ke dokumen lain.
> AI agent harus mengeksekusi task **secara berurutan per fase**, kecuali task dalam fase yang sama boleh paralel jika tidak ada dependensi.

**Dokumen referensi:**
- `README.md` — Tech stack, arsitektur, monorepo structure
- `DATABASE_DESIGN.md` — Skema database, 14 tabel, enum, ERD
- `PAGES.md` — 47 halaman frontend + 62 API endpoints

---

## Execution Rules for AI Agents

1. **Kerjakan per fase.** Jangan loncat ke fase berikutnya sebelum semua task di fase sekarang selesai.
2. **Setiap task harus menghasilkan deliverable yang bisa diverifikasi** (file, test, atau command yang berjalan tanpa error).
3. **Jangan buat file yang tidak diminta.** Ikuti monorepo structure di README.md.
4. **Gunakan exact tech stack** yang tercantum di README.md. Jangan ganti framework/library.
5. **Ikuti DATABASE_DESIGN.md** untuk skema database. Jangan modifikasi kolom/tabel tanpa instruksi eksplisit.
6. **Ikuti PAGES.md** untuk route dan API endpoint. Jangan tambah/kurangi halaman tanpa instruksi.
7. **Setiap fase punya checkpoint.** Jalankan checkpoint command sebelum lanjut ke fase berikutnya.

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
    
    section Phase 8 - Realtime
    PartyKit WebSocket       :p8, after p7c, 2d
    
    section Phase 9 - Polish
    Dashboards & Analytics   :p9a, after p8, 2d
    Admin Order & Payment    :p9b, after p9a, 1d
    
    section Phase 10 - QA & Deploy
    Testing                  :p10a, after p9b, 3d
    CI/CD & Deploy           :p10b, after p10a, 2d
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

### Task 0.6 — Create App: `apps/buyer`

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-0.6`                                                   |
| Dependensi  | `T-0.1`                                                   |
| Deliverables| `apps/buyer/` (Astro project yang bisa `dev`)              |

**Instruksi:**
1. Initialize Astro project di `apps/buyer` dengan template `minimal`.
2. Tambah TailwindCSS integration.
3. Setup `astro.config.mjs` — output `server` (SSR), adapter Cloudflare.
4. Buat layout dasar: `src/layouts/BaseLayout.astro` dengan `<slot />`.
5. Buat `src/pages/index.astro` → placeholder homepage.
6. Port dev: `4301`.

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

**Checkpoint Phase 0:**
```bash
pnpm install          # harus sukses tanpa error
pnpm run build        # semua app harus build sukses
pnpm run dev          # semua app harus start di port masing-masing
```

---

## Phase 1: Database Schema & Migration

**Tujuan:** Definisikan seluruh 14 tabel + 10 enum di Drizzle ORM, jalankan push ke PostgreSQL.

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
| `users.ts`              | `users`, `seller_profiles`                   |
| `events.ts`             | `events`, `event_categories`, `event_images`, `categories` |
| `tickets.ts`            | `ticket_tiers`, `tickets`, `ticket_checkins` |
| `orders.ts`             | `orders`, `order_items`, `payments`          |
| `reservations.ts`       | `reservations`                               |
| `notifications.ts`      | `notifications`                              |
| `index.ts`              | Re-export semua schema + enums               |

Setiap file harus:
- Definisikan `relations()` (Drizzle relational query builder).
- Export tabel dan relations.

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

### Task 1.4 — Run Migration

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-1.4`                                                   |
| Dependensi  | `T-1.3`                                                   |
| Deliverables| Database PostgreSQL lokal berisi 14 tabel + 10 enum        |

**Instruksi:**
1. Jalankan `pnpm drizzle-kit push` dari `packages/core` untuk development.
2. Verifikasi semua tabel sudah terbuat dengan `pnpm drizzle-kit studio`.
3. Buat seed script: `packages/core/src/db/seed.ts`:
   - 1 admin user (email: `admin@jeevatix.id`).
   - 5 kategori dummy (Musik, Olahraga, Workshop, Konser, Festival).
   - 1 seller user + seller_profile.
   - 2 events dummy dengan masing-masing 2-3 ticket_tiers.

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

### Task 2.2 — Auth API Endpoints

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-2.2`                                                   |
| Dependensi  | `T-2.1`                                                   |
| Deliverables| `apps/api/src/routes/auth.ts`                              |
| Endpoints   | E1–E7 (lihat PAGES.md → Auth API)                          |

**Instruksi:**
1. Buat Hono router di `routes/auth.ts`.
2. Implementasi:
   - `POST /auth/register` → validasi input, hash password, insert ke `users`, return JWT.
   - `POST /auth/register/seller` → insert ke `users` (role=seller) + insert ke `seller_profiles`.
   - `POST /auth/login` → cek email+password, return JWT + user data.
   - `POST /auth/forgot-password` → generate token, enqueue email (placeholder).
   - `POST /auth/reset-password` → verify token, update password_hash.
   - `POST /auth/verify-email` → update `email_verified_at`.
   - `POST /auth/logout` → invalidate (jika stateful) atau no-op (jika stateless JWT).
3. Input validation menggunakan `zod` (pnpm add zod di apps/api).

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

### Task 4.6 — Seller Profile UI

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-4.6`                                                   |
| Dependensi  | `T-4.1`, `T-4.4`                                          |
| Deliverables| Seller profile pages (S14–S15 dari PAGES.md)               |

**Instruksi:**
1. `apps/seller/src/routes/profile/+page.svelte` → edit profil organisasi.
2. `apps/seller/src/routes/profile/password/+page.svelte` → ubah password.

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

### Task 5.2 — Buyer Auth Pages

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-5.2`                                                   |
| Dependensi  | `T-0.6`, `T-2.2`                                          |
| Deliverables| Buyer auth pages (B1–B5 dari PAGES.md)                     |

**Instruksi:**
1. Buat halaman Astro: register, login, forgot-password, reset-password, verify-email.
2. Gunakan client-side fetch ke API (Astro island dengan Svelte/React atau vanilla JS).
3. Simpan JWT di cookie (httpOnly jika SSR).

### Task 5.3 — Homepage & Explore

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-5.3`                                                   |
| Dependensi  | `T-5.1`, `T-5.2`                                          |
| Deliverables| Buyer public pages (B6–B9 dari PAGES.md)                   |

**Instruksi:**
1. `apps/buyer/src/pages/index.astro` → Hero banner, featured events carousel, kategori grid, upcoming events.
2. `apps/buyer/src/pages/events/index.astro` → Daftar event + filter sidebar (kategori, kota, tanggal, harga) + search bar + pagination.
3. `apps/buyer/src/pages/events/[slug].astro` → Detail event: deskripsi, galeri, map, tier tiket + harga, info seller. Tombol "Beli Tiket" (link ke checkout).
4. `apps/buyer/src/pages/categories/[slug].astro` → Event per kategori.

### Task 5.4 — Buyer Profile & Notifications UI

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-5.4`                                                   |
| Dependensi  | `T-5.2`, `T-2.3`                                          |
| Deliverables| Buyer profile & notification pages (B16–B17 dari PAGES.md) |

**Instruksi:**
1. `apps/buyer/src/pages/profile.astro` → edit profil buyer.
2. `apps/buyer/src/pages/notifications.astro` → daftar notifikasi.

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
2. `GET /orders` → list order milik buyer + pagination.
3. `GET /orders/:id` → detail order + items + payment + tickets.

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
   - Update payment status → `success`.
   - Update order status → `confirmed`.
   - Trigger ticket generation (Phase 7).
   - Enqueue email send via Cloudflare Queue.

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

### Task 6.6 — Checkout & Payment UI (Buyer)

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-6.6`                                                   |
| Dependensi  | `T-6.2`, `T-6.3`, `T-6.4`, `T-5.3`                       |
| Deliverables| Buyer checkout & payment pages (B10–B11 dari PAGES.md)     |

**Instruksi:**
1. `apps/buyer/src/pages/checkout/[slug].astro` → pilih tier, jumlah → submit reservation → show countdown timer (10 menit) → redirect ke payment.
2. `apps/buyer/src/pages/payment/[orderId].astro` → ringkasan order, pilih metode bayar, submit → redirect ke payment gateway.
3. Countdown timer yang real-time (Svelte island atau JS).

### Task 6.7 — Order History UI (Buyer)

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-6.7`                                                   |
| Dependensi  | `T-6.3`, `T-5.2`                                          |
| Deliverables| Buyer order pages (B12–B13 dari PAGES.md)                  |

**Instruksi:**
1. `apps/buyer/src/pages/orders/index.astro` → list order + badge status.
2. `apps/buyer/src/pages/orders/[id].astro` → detail order + items + payment info.

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

### Task 7.2 — Ticket UI (Buyer)

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-7.2`                                                   |
| Dependensi  | `T-7.1`, `T-5.2`                                          |
| Deliverables| Buyer ticket pages (B14–B15 dari PAGES.md)                 |

**Instruksi:**
1. `apps/buyer/src/pages/tickets/index.astro` → list tiket aktif.
2. `apps/buyer/src/pages/tickets/[id].astro` → detail tiket + QR code rendered dari `ticket_code`. Gunakan QR code library (misal `qrcode`).

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

### Task 7.4 — Notification System

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-7.4`                                                   |
| Dependensi  | `T-6.5`, `T-2.1`                                          |
| Deliverables| Notification service + API endpoints (E41–E43, E61)        |

**Instruksi:**
1. Service: `sendNotification(userId, type, title, body, metadata)` → insert ke `notifications`.
2. Di-trigger oleh:
   - Payment success → `order_confirmed`.
   - Reservation expiring soon → `payment_reminder` (via Queue).
   - Event H-1 → `event_reminder` (via Queue cron).
3. API: `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`.
4. Admin API: `POST /admin/notifications/broadcast`.

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

### Task 8.2 — PartyKit Client Integration

| Key         | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| ID          | `T-8.2`                                                   |
| Dependensi  | `T-8.1`, `T-5.3`, `T-6.6`                                 |
| Deliverables| WebSocket integration di halaman Event Detail & Checkout   |

**Instruksi:**
1. `apps/buyer/src/pages/events/[slug].astro` → Svelte island yang connect ke PartyKit room, update jumlah tiket tersedia secara live.
2. `apps/buyer/src/pages/checkout/[slug].astro` → live stock countdown, jika sold out saat checkout maka tampilkan alert.
3. Gunakan `partysocket` client library.

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

    T61 --> T81
    T81 & T53 & T66 --> T82

    T75 --> T91
    T35 --> T92
    T32 & T63 & T64 --> T93
```

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
| `apps/api/src/middleware/`             | T-2.1          | Auth middleware                    |
| `apps/api/src/routes/auth.ts`          | T-2.2          | Auth endpoints                     |
| `apps/api/src/routes/users.ts`         | T-2.3          | User profile endpoints             |
| `apps/api/src/routes/events.ts`        | T-5.1          | Public event endpoints             |
| `apps/api/src/routes/seller/`          | T-4.1–T-4.3    | Seller endpoints                   |
| `apps/api/src/routes/admin/`           | T-3.1, T-3.4   | Admin endpoints                    |
| `apps/api/src/routes/reservations.ts`  | T-6.2          | Reservation endpoints              |
| `apps/api/src/routes/orders.ts`        | T-6.3          | Order endpoints                    |
| `apps/api/src/routes/payments.ts`      | T-6.4          | Payment endpoints                  |
| `apps/api/src/routes/tickets.ts`       | T-7.1          | Ticket endpoints                   |
| `apps/api/src/durable-objects/`        | T-6.1          | Durable Object (TicketReserver)    |
| `apps/api/src/queues/`                 | T-6.5          | Cloudflare Queue consumers         |
| `apps/api/src/services/`              | T-7.1, T-7.4   | Business logic services            |
| `apps/buyer/src/pages/`               | T-5.2–T-5.4, T-6.6–T-6.7, T-7.2 | Buyer pages         |
| `apps/admin/src/routes/`              | T-3.2–T-3.5, T-9.2–T-9.3 | Admin pages                |
| `apps/seller/src/routes/`             | T-4.4–T-4.6, T-7.3, T-7.5, T-9.1 | Seller pages          |
| `.github/workflows/`                  | T-10.5         | CI/CD pipelines                    |

---

## Notes for AI Agents

- **Selalu baca dokumen referensi** (DATABASE_DESIGN.md, PAGES.md) sebelum mengerjakan task. Jangan mengarang kolom, route, atau endpoint.
- **Satu task = satu commit** (jika memungkinkan). Commit message: `feat(T-X.X): <deskripsi singkat>`.
- **Edge compatibility**: Semua library di `apps/api` HARUS compatible dengan Cloudflare Workers runtime (no Node.js-only APIs). Cek sebelum install.
- **Validasi input**: Gunakan `zod` di semua API endpoint. Definisikan schema validasi berdekatan dengan route handler.
- **Error handling**: Gunakan Hono error handler. Response format konsisten: `{ success: boolean, data?: T, error?: { code: string, message: string } }`.
- **Pagination**: Gunakan cursor-based atau offset pagination. Default limit: 20, max: 100. Response: `{ data: T[], meta: { total, page, limit, totalPages } }`.
- **Concurrent-safe**: Untuk operasi yang melibatkan `sold_count` pada `ticket_tiers`, SELALU gunakan Durable Object. JANGAN langsung update dari API handler.
