# 🎟️ Jeevatix

> **Menghidupkan Setiap Momenmu.** > **Akses Cepat, Nyalakan Energimu.**

Jeevatix adalah platform jual beli tiket _event_ berkinerja tinggi yang dirancang untuk menangani lonjakan _traffic_ ekstrem (_war ticket_). Dibangun sepenuhnya di atas arsitektur _edge-computing_ dan _serverless_ untuk menjamin kecepatan, skalabilitas, dan keandalan transaksi secara _real-time_.

---

## 🚀 Tech Stack

Platform ini menggunakan pendekatan _monorepo_ dengan perpaduan teknologi berikut:

- **Infrastructure as Code (IaC):** [SST (Serverless Stack)](https://sst.dev/)
- **Build System:** [Turborepo](https://turbo.build/) (Manajemen eksekusi _task_ monorepo yang sangat cepat & _incremental_)
- **Edge Compute:** Cloudflare Workers
- **Backend / API:** [Hono](https://hono.dev/) (Super-fast, lightweight web framework)
- **API Contract & Documentation:** [`@hono/zod-openapi`](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) (OpenAPI spec dari Zod schemas) + [Scalar](https://scalar.com/) (Interactive API Reference UI di `/reference`)
- **Frontend:** [SvelteKit](https://svelte.dev/) (Portal Pembeli, Admin & Seller) + [shadcn-svelte](https://shadcn-svelte.com/)
- **Database & Connection Pooling:** PostgreSQL (Self-Hosted) + Cloudflare Hyperdrive
- **ORM & Database Client:** [Drizzle ORM](https://orm.drizzle.team/) (Edge-ready, Type-safe SQL builder)
- **State Management & Concurrency:** [Cloudflare Durable Objects](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/) (Mencegah _overselling_ dan memastikan konsistensi transaksi)
- **Background Processing:** [Cloudflare Queues](https://developers.cloudflare.com/queues/) (Menangani tugas asinkron seperti antrean pengiriman email e-ticket dan pembaruan laporan analitik)
- **Real-time WebSocket:** [PartyKit](https://www.partykit.io/) (Menyiarkan status ketersediaan tiket secara _live_ dan mengelola ruang antrean tanpa membebani database)
- **File Storage:** [Cloudflare R2](https://developers.cloudflare.com/r2/) (Object storage untuk gambar event, avatar, dan aset lainnya)
- **Code Quality:** [ESLint](https://eslint.org/) (Flat Config) + [Prettier](https://prettier.io/) (`prettier-plugin-svelte`, `prettier-plugin-tailwindcss`)
- **Testing:** [Vitest](https://vitest.dev/) (Unit & Integration) + [Playwright](https://playwright.dev/) (E2E) + [K6](https://k6.io/) (Load Testing)

---

## 🏗️ Architecture Diagram

```mermaid
graph TD
    User([User / Browser])
    CF_Edge[Cloudflare Edge Network]

    subgraph Frontend & API
        Buyer[SvelteKit Buyer]
        Admin[SvelteKit Admin]
        Seller[SvelteKit Seller]
        PartyKit[PartyKit WebSocket]
        API[Hono API + Drizzle ORM]
    end

    subgraph Edge State & Workers
        DO[Durable Objects <br> Concurrency/Lock]
        Queue[Cloudflare Queues <br> Background Jobs]
    end

    subgraph Data Layer
        Hyperdrive[Cloudflare Hyperdrive]
        DB[(PostgreSQL)]
    end

    User -->|HTTP & WS| CF_Edge
    CF_Edge -->|Serve UI| Buyer
    CF_Edge -->|Serve UI| Admin
    CF_Edge -->|Serve UI| Seller
    CF_Edge -->|API Requests| API
    CF_Edge -->|Live Updates| PartyKit

    Buyer -->|Fetch/Mutate| API
    Admin -->|Fetch/Mutate| API
    Seller -->|Fetch/Mutate| API
    Buyer -.->|Listen to Status| PartyKit

    API -->|Reserve Ticket| DO
    API -->|Async Tasks| Queue
    API -->|Query via Drizzle| Hyperdrive
    DO -->|Sync State| Hyperdrive
    Queue -.->|Process| API

    Hyperdrive -->|Execute SQL| DB
```

---

## 📂 Monorepo Structure

Repositori ini diatur ke dalam beberapa _workspace_ untuk memisahkan logika bisnis, antarmuka pengguna, namun tetap berbagi gaya (UI) dan tipe data:

```
jeevatix/
├── apps/
│   ├── api/            # Hono backend API (berjalan di Cloudflare Workers)
│   │   └── src/
│   │       ├── routes/          # Thin HTTP handlers (parse request → call service → return response)
│   │       ├── services/        # Business logic & DB operations (*.service.ts)
│   │       ├── schemas/         # Zod validation schemas = request/response DTO (*.schema.ts)
│   │       ├── middleware/      # Auth, CORS, error handler
│   │       ├── durable-objects/ # Cloudflare Durable Objects (TicketReserver)
│   │       ├── queues/          # Cloudflare Queue consumers
│   │       └── lib/             # Pure utilities (jwt, password, helpers)
│   ├── buyer/          # SvelteKit portal untuk pembeli tiket
│   ├── admin/          # SvelteKit portal untuk dashboard admin Jeevatix
│   └── seller/         # SvelteKit portal untuk penjual / penyelenggara event
├── packages/
│   ├── core/           # Logika bisnis utama, Drizzle schema, koneksi database
│   ├── ui/             # Shared UI components (TailwindCSS, shadcn-svelte)
│   └── types/          # Shared TypeScript interfaces (Event, Ticket, dll)
├── .github/
│   ├── copilot-instructions.md  # Workspace-wide AI agent rules (always active)
│   ├── instructions/            # File-specific AI instructions (auto-attach by pattern)
│   ├── prompts/                 # Reusable AI prompt templates (/slash commands)
│   └── agents/                  # Custom AI agents (reviewer, etc.)
├── tests/
│   ├── e2e/            # Playwright E2E test suites
│   └── load/           # K6 load testing scripts
├── docker-compose.yml  # PostgreSQL untuk local development
├── sst.config.ts       # Konfigurasi infrastruktur SST
├── turbo.json          # Pipeline eksekusi Turborepo
├── eslint.config.js    # ESLint flat config (shared)
├── .prettierrc         # Prettier config (shared)
├── playwright.config.ts # Playwright E2E config
├── package.json        # Root package (Workspaces config)
└── README.md
```

---

## 🛠️ Prerequisites

Sebelum memulai _development_ di _environment_ lokal Anda, pastikan Anda telah menginstal:

- **Node.js** (v22 atau lebih baru, lihat `.nvmrc`)
- **pnpm** (Direkomendasikan untuk manajemen _monorepo_ yang efisien)
- **Docker & Docker Compose** (Untuk menjalankan PostgreSQL lokal)
- Akun **Cloudflare** (untuk konfigurasi _deployment_ dan Hyperdrive)

---

## 💻 Getting Started

Ikuti langkah-langkah berikut untuk menjalankan Jeevatix di mesin lokal Anda:

### 1. Clone Repository & Install Dependencies

```bash
git clone https://github.com/oppytut/jeevatix.git
cd jeevatix
pnpm install
```

### 2. Setup Environment Variables

Duplikat file `.env.example` menjadi `.env` di _root directory_ dan isi variabel yang dibutuhkan:

```bash
cp .env.example .env
```

### 3. Jalankan PostgreSQL (Docker Compose)

Jalankan PostgreSQL menggunakan Docker Compose. Database akan otomatis terbuat sesuai konfigurasi di `docker-compose.yml`:

```bash
docker compose up -d
```

Default connection string: `postgresql://jeevatix:jeevatix@localhost:5432/jeevatix` (sudah tercantum di `.env.example`).

Untuk menghentikan database:

```bash
docker compose down        # stop container (data tetap ada di volume)
docker compose down -v     # stop & hapus volume (reset data)
```

### 4. Jalankan Local Development (Turborepo)

Perintah ini akan memicu **Turborepo** untuk menjalankan _local environment_ bagi seluruh aplikasi (Portal Pembeli, Admin, Seller & API) secara paralel sekaligus menyambungkannya ke _resource_ cloud melalui SST:

```bash
pnpm run dev
```

Anda bisa mengakses aplikasi di port berikut:

- **Portal Pembeli (SvelteKit):** [http://localhost:4301](http://localhost:4301)
- **Portal Admin (SvelteKit):** [http://localhost:4302](http://localhost:4302)
- **Portal Penjual/Seller (SvelteKit):** [http://localhost:4303](http://localhost:4303)
- **Backend API (Hono):** `http://localhost:8787` (atau port dinamis wrangler)

### 5. Catatan Runtime Auth Lokal

Beberapa detail implementasi auth di `apps/api` perlu dipahami karena perilakunya spesifik ke Cloudflare Workers + local smoke test:

- Script `pnpm --filter @jeevatix/api dev` memuat `.env` root melalui `dotenv-cli`, jadi `DATABASE_URL` dan `JWT_SECRET` harus tersedia di root project sebelum menjalankan Wrangler lokal.
- `apps/api/wrangler.toml` memakai `compatibility_flags = ["nodejs_compat", "no_handle_cross_request_promise_resolution"]` untuk menghindari error I/O lintas request saat memakai postgres-js di runtime Worker lokal.
- JWT auth memakai algoritma `HS256` secara eksplisit. Saat ini access token, refresh token, verify-email token, dan reset-password token semuanya memakai `JWT_SECRET`; tidak ada `JWT_REFRESH_SECRET` terpisah di runtime. Access token berlaku 15 menit, refresh token 7 hari, dan setiap token membawa `jti` agar rotasi token tidak bentrok walau dibuat pada detik yang sama.
- Refresh token disimpan di tabel `refresh_tokens` sebagai hash SHA-256 deterministik, bukan bcrypt. Ini disengaja supaya lookup, rotation, dan revocation tetap akurat untuk string JWT yang panjang.
- Koneksi DB untuk Worker tidak di-cache sebagai singleton lintas request. Gunakan `getDb(databaseUrl?)` dari `packages/core/src/db/index.ts` bila butuh akses DB dari runtime API.
- Response publik `register`, `register-seller`, dan `forgot-password` tidak lagi mengembalikan `verify_email_token` atau `reset_token` secara default. Jalur utama sekarang adalah email verifikasi dan email reset password.
- Link verifikasi email dikirim ke route browser-safe `GET /auth/verify-email?token=...` di API. Link reset password tetap diarahkan ke portal buyer atau seller melalui `BUYER_APP_URL` dan `SELLER_APP_URL` jika perlu override explicit.
- Jika local debugging masih perlu melihat token sensitif di response, aktifkan `AUTH_EXPOSE_DEBUG_TOKENS=1` secara eksplisit. Flag ini hanya untuk local/test dan tidak boleh dipakai di deployment public.
- Portal admin dan seller sekarang menyimpan access token, refresh token, dan user session hanya di cookie `httpOnly`. Kode browser mengambil access token segar lewat endpoint same-origin internal `/session/access-token`, sehingga token tidak lagi dipersist di cookie yang bisa dibaca JavaScript.

Smoke test terakhir yang sudah diverifikasi: `login -> refresh -> logout -> refresh token lama` harus berakhir dengan `401 Unauthorized` pada langkah terakhir.

---

## 🧪 Code Quality & Testing

Project ini menggunakan ESLint + Prettier untuk menjaga konsistensi kode, dan tiga level pengujian:

```bash
# Linting & Formatting
pnpm run lint              # ESLint — cek semua apps & packages
pnpm run lint:fix          # ESLint — auto-fix
pnpm run format:check      # Prettier — cek formatting
pnpm run format            # Prettier — auto-format

# Testing
pnpm run test              # Vitest — unit & integration tests
pnpm run test:e2e          # Playwright — alias ke mode lokal mock-backed
pnpm run test:e2e:local    # Playwright — E2E lokal dengan mock API + portal dev mode
pnpm run test:e2e:headed   # Playwright — E2E lokal mode headed
pnpm run test:e2e:report   # Buka report HTML Playwright terakhir
pnpm run test:load         # K6 — load testing (war ticket simulation)
```

- **Linting (ESLint):** Flat config (`eslint.config.js`) dengan `@typescript-eslint` + `eslint-plugin-svelte`. Semua apps & packages di-lint via Turborepo.
- **Formatting (Prettier):** Shared `.prettierrc` dengan `prettier-plugin-svelte` + `prettier-plugin-tailwindcss` (plugin order matters).
- **Unit & Integration Test (Vitest):** Target minimal 80% coverage pada `apps/api`.
- **E2E Testing (Playwright):** Test flows kritis di ketiga portal (Buyer :4301, Admin :4302, Seller :4303).
  Suite lokal menjalankan mock API in-memory dari `tests/e2e/mock-api-server.mjs`, dan portal dijalankan dengan mode dev E2E (`PLAYWRIGHT_E2E=1`) agar tidak bergantung pada `workerd` saat development host tidak kompatibel.
  `pnpm run test:e2e` saat ini memang ditujukan untuk mode lokal tersebut.
- **Load Testing (K6):** Simulasi _war ticket_ dengan 1000 virtual users untuk memastikan tidak ada _overselling_.

Untuk investigasi performa checkout lokal dengan runner Node tunggal di `scripts/run-api-local.ts`, tersedia preset runner eksplisit agar benchmark tetap reproducible tanpa mengubah default local dev:

```bash
pnpm run dev:api:local:load:baseline   # app=50, DO=25, background tasks=8
pnpm run dev:api:local:load:balanced   # app=52, DO=25, background tasks=8
pnpm run dev:api:local:load:fullflow   # app=55, DO=25, background tasks=8
```

Ketiga preset itu hanya berlaku saat dipilih eksplisit. `pnpm run dev:api:local` tetap memakai env biasa tanpa override preset.

Untuk membuat target event/tier benchmark checkout baru tanpa inline script manual:

```bash
pnpm run test:load:checkout:target
```

Perintah itu akan mencetak JSON berisi `targetEventSlug` dan `targetTier`, yang lalu bisa dipakai untuk `pnpm run test:load:checkout`.

Untuk menjalankan benchmark checkout lokal end-to-end dalam satu command, gunakan preset berikut. Helper ini akan memilih port lokal yang kosong, start runner preset, membuat target event/tier benchmark baru, menjalankan `checkout-flow`, lalu menghentikan runner saat selesai:

```bash
pnpm run test:load:checkout:local
pnpm run test:load:checkout:local:baseline
pnpm run test:load:checkout:local:balanced
pnpm run test:load:checkout:local:fullflow
```

Alias `pnpm run test:load:checkout:local` saat ini sengaja menunjuk ke preset `load-balanced`, karena itu adalah kompromi default terbaik yang sudah tervalidasi sejauh ini antara `full_flow_duration` dan regresi reservation/http tail pada runner Node lokal.

Helper benchmark lokal di atas juga otomatis men-seed batch fresh checkout users jika caller belum memberi `CHECKOUT_LOAD_TEST_PREFIX`, sehingga hasil run lebih reproducible. Runner generik `pnpm run test:load:checkout` tidak melakukan fresh-user seeding kecuali Anda mengaktifkannya eksplisit dengan `CHECKOUT_LOAD_TEST_FRESH_USERS=1`.

Jika perlu smoke test yang lebih cepat, override jumlah user saat memanggil command, misalnya `TOTAL_USERS=10 CHECKOUT_LOAD_TEST_USER_COUNT=10 pnpm run test:load:checkout:local:balanced`.

Di akhir run, helper akan mencetak satu baris JSON berawalan `local-checkout-summary` yang merangkum preset, target, dan metrik utama p95 agar hasil lebih mudah dibandingkan antar run.

### Menjalankan E2E Lokal

Untuk host Linux baru, install browser dan dependency sistem Playwright sekali:

```bash
pnpm exec playwright install chromium
pnpm exec playwright install-deps chromium
```

Lalu jalankan suite:

```bash
pnpm run test:e2e
```

Catatan:

- Config Playwright akan menyalakan `tests/e2e/mock-api-server.mjs` otomatis.
- Buyer, Admin, dan Seller portal dijalankan otomatis lewat `webServer` di `playwright.config.ts`.
- Mode ini khusus untuk local E2E stability. Deployment target tetap Cloudflare adapter seperti biasa.

---

## 🌐 Deployment & CI/CD

Proses _deployment_ ke _production_ sepenuhnya diotomatisasi menggunakan **GitHub Actions**. Setiap PR atau _merge_ ke _branch_ `main` akan memicu _pipeline_ CI/CD untuk memastikan semua _test_ berlalu sebelum melakukan _build_ dan _deploy_ ke Cloudflare.
Namun, jika Anda perlu melakukan _deploy_ manual dari mesin lokal, Anda dapat menjalankan:

```bash
pnpm run build
pnpm run deploy --stage production
```

### Resource Yang Sekarang Dikelola SST

Stack SST production sekarang mencakup resource inti berikut:

- API worker Cloudflare dari `apps/api/src/index.ts`
- Durable Object binding + migration untuk `TicketReserver`
- Queue `reservation-cleanup` beserta consumer worker-nya
- Cron worker untuk enqueue cleanup setiap menit
- Bucket R2 untuk upload gambar
- Tiga portal Cloudflare Workers untuk Buyer, Admin, dan Seller dari artefak build SvelteKit Cloudflare adapter

### Environment Variables Yang Harus Ada Saat Deploy

Sebelum menjalankan `pnpm run deploy --stage production`, pastikan environment berikut tersedia di shell/CI karena saat ini stack deploy membacanya langsung dari environment deploy.

Deploy/SST setup:

```bash
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

API runtime required:

```bash
DATABASE_URL
JWT_SECRET
PAYMENT_WEBHOOK_SECRET
EMAIL_API_KEY
EMAIL_FROM
UPLOAD_PUBLIC_URL
```

Frontend public build-time env:

```bash
PUBLIC_API_BASE_URL
PUBLIC_PARTYKIT_HOST
```

`PUBLIC_API_BASE_URL` sebaiknya selalu diekspor eksplisit saat `pnpm run build`, walau portal saat ini masih punya fallback production default. `PUBLIC_PARTYKIT_HOST` diperlukan jika fitur live availability buyer ingin aktif setelah deploy.

Optional runtime/deploy override:

```bash
PARTY_SECRET
PARTYKIT_HOST
TICKET_RESERVER_DATABASE_URL
TICKET_RESERVER_DB_MAX_CONNECTIONS
BUYER_APP_URL
SELLER_APP_URL
CORS_ALLOWED_ORIGINS
AUTH_EXPOSE_DEBUG_TOKENS
R2_BUCKET_NAME
PRODUCTION_API_DOMAIN
PRODUCTION_BUYER_DOMAIN
PRODUCTION_ADMIN_DOMAIN
PRODUCTION_SELLER_DOMAIN
RESERVATION_CLEANUP_QUEUE_NAME
```

Catatan kompatibilitas:

- Nama canonical project untuk account Cloudflare adalah `CLOUDFLARE_ACCOUNT_ID`.
- `sst.config.ts` masih menerima `CLOUDFLARE_DEFAULT_ACCOUNT_ID` sebagai fallback kompatibilitas dengan dokumentasi SST, tetapi nama itu bukan nama utama yang dipakai project ini.
- Nama canonical secret email di repo ini adalah `EMAIL_API_KEY`, bukan `RESEND_API_KEY`, walau provider email saat ini memang Resend.
- `CORS_ALLOWED_ORIGINS` menerima daftar origin dipisahkan koma. Bila tidak diisi, stack SST mengisi otomatis dengan domain portal production pada stage `production`, sedangkan local fallback tetap terbatas ke origin `localhost` portal.

### Catatan Manual Yang Masih Perlu Diperhatikan

- `PARTYKIT_HOST` masih mengarah ke deployment PartyKit terpisah; stack SST ini belum membuat atau mendeploy PartyKit server.
- Runtime API saat ini masih membaca `DATABASE_URL` langsung. Jika ingin memakai Hyperdrive sebagai binding runtime penuh, kontrak koneksi aplikasi perlu disejajarkan dulu dengan implementasi binding tersebut.
- Portal workers mengasumsikan `pnpm run build` sudah menghasilkan artefak `.svelte-kit/cloudflare/_worker.js` sebelum `sst deploy` dijalankan.
- Workflow GitHub Actions sekarang juga perlu menyediakan env build-time public (`PUBLIC_API_BASE_URL`, opsional `PUBLIC_PARTYKIT_HOST`) selain secret runtime API saat langkah deploy dijalankan.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 🤖 AI Development Setup

Project ini dikonfigurasi dengan **AI agent customization** dan **MCP servers** untuk mempercepat development.

### Agent Customization (`.github/`)

AI agent secara otomatis memuat rules dan instructions dari folder `.github/`:

| File                                          | Fungsi                                                                       | Trigger                                                |
| --------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| `copilot-instructions.md`                     | Workspace-wide rules (tech stack, arsitektur 3-layer, OpenAPI, code quality) | Selalu aktif di setiap chat                            |
| `instructions/api-routes.instructions.md`     | Pattern OpenAPIHono untuk route handlers                                     | Auto-attach saat edit `apps/api/src/routes/**`         |
| `instructions/api-services.instructions.md`   | Convention untuk business logic services                                     | Auto-attach saat edit `apps/api/src/services/**`       |
| `instructions/api-schemas.instructions.md`    | Zod + OpenAPI schema patterns                                                | Auto-attach saat edit `apps/api/src/schemas/**`        |
| `instructions/svelte-pages.instructions.md`   | SvelteKit + shadcn-svelte page patterns                                      | Auto-attach saat edit `apps/**/src/routes/**/*.svelte` |
| `instructions/drizzle-schema.instructions.md` | Drizzle ORM schema conventions                                               | Auto-attach saat edit `packages/core/src/db/**`        |
| `prompts/new-api-endpoint.prompt.md`          | Generate endpoint baru (3 file: route + service + schema)                    | Slash command `/new-api-endpoint`                      |
| `prompts/new-svelte-page.prompt.md`           | Generate halaman SvelteKit baru                                              | Slash command `/new-svelte-page`                       |
| `prompts/phase-checkpoint.prompt.md`          | Jalankan validasi checkpoint fase                                            | Slash command `/phase-checkpoint`                      |
| `agents/reviewer.agent.md`                    | Code review agent (read-only, no edit)                                       | Pilih di agent selector                                |

### MCP Servers (`.vscode/mcp.json`)

Konfigurasi tersimpan di `.vscode/mcp.json`.

| MCP Server               | Fungsi                                        | Penggunaan                                                                                                     |
| ------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **shadcn-ui-mcp-server** | Referensi komponen, block, dan tema shadcn/ui | Mendapatkan source code komponen, contoh demo, block template (dashboard, login, sidebar), dan menerapkan tema |
| **context7**             | Lookup dokumentasi library terbaru            | Referensi API docs Hono, Drizzle, SvelteKit, SST, Zod, dll secara real-time                                    |

### Kapabilitas MCP yang tersedia:

**shadcn-ui-mcp:**

- `list_components` — Daftar semua komponen shadcn/ui yang tersedia
- `get_component` / `get_component_demo` — Source code dan contoh penggunaan komponen
- `list_blocks` / `get_block` — Template block siap pakai (dashboard, login, sidebar, calendar, products)
- `list_themes` / `apply_theme` — Tema visual yang bisa diterapkan ke project

**context7:**

- `resolve-library-id` — Resolve nama library ke ID Context7
- `get-library-docs` — Ambil dokumentasi terbaru berdasarkan topik/query
