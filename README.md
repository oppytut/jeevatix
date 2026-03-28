# 🎟️ Jeevatix

> **Menghidupkan Setiap Momenmu.** > **Akses Cepat, Nyalakan Energimu.**

Jeevatix adalah platform jual beli tiket *event* berkinerja tinggi yang dirancang untuk menangani lonjakan *traffic* ekstrem (*war ticket*). Dibangun sepenuhnya di atas arsitektur *edge-computing* dan *serverless* untuk menjamin kecepatan, skalabilitas, dan keandalan transaksi secara *real-time*.

---

## 🚀 Tech Stack

Platform ini menggunakan pendekatan *monorepo* dengan perpaduan teknologi berikut:
* **Infrastructure as Code (IaC):** [SST (Serverless Stack)](https://sst.dev/)
* **Build System:** [Turborepo](https://turbo.build/) (Manajemen eksekusi *task* monorepo yang sangat cepat & *incremental*)
* **Edge Compute:** Cloudflare Workers
* **Backend / API:** [Hono](https://hono.dev/) (Super-fast, lightweight web framework)
* **Frontend:** [SvelteKit](https://svelte.dev/) (Portal Pembeli, Admin & Seller) + [shadcn-svelte](https://shadcn-svelte.com/)
* **Database & Connection Pooling:** PostgreSQL (Self-Hosted) + Cloudflare Hyperdrive
* **ORM & Database Client:** [Drizzle ORM](https://orm.drizzle.team/) (Edge-ready, Type-safe SQL builder)
* **State Management & Concurrency:** [Cloudflare Durable Objects](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/) (Mencegah *overselling* dan memastikan konsistensi transaksi)
* **Background Processing:** [Cloudflare Queues](https://developers.cloudflare.com/queues/) (Menangani tugas asinkron seperti antrean pengiriman email e-ticket dan pembaruan laporan analitik)
* **Real-time WebSocket:** [PartyKit](https://www.partykit.io/) (Menyiarkan status ketersediaan tiket secara *live* dan mengelola ruang antrean tanpa membebani database)

---

## 🏗️ Architecture Diagram

```mermaid
graph TD
    User([User / Browser])
    CF_Edge[Cloudflare Edge Network]
    
    subgraph Frontend & API
        Buyer[SvelteKit Buyer]
        Admin[SvelteKit Admin/Seller]
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
    CF_Edge -->|API Requests| API
    CF_Edge -->|Live Updates| PartyKit

    Buyer -->|Fetch/Mutate| API
    Admin -->|Fetch/Mutate| API
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

Repositori ini diatur ke dalam beberapa *workspace* untuk memisahkan logika bisnis, antarmuka pengguna, namun tetap berbagi gaya (UI) dan tipe data:

```
jeevatix/
├── apps/
│   ├── api/            # Hono backend API (berjalan di Cloudflare Workers)
│   ├── buyer/          # SvelteKit portal untuk pembeli tiket
│   ├── admin/          # SvelteKit portal untuk dashboard admin Jeevatix
│   └── seller/         # SvelteKit portal untuk penjual / penyelenggara event
├── packages/
│   ├── core/           # Logika bisnis utama, Drizzle schema, koneksi database
│   ├── ui/             # Shared UI components (TailwindCSS, shadcn-svelte)
│   └── types/          # Shared TypeScript interfaces (Event, Ticket, dll)
├── docker-compose.yml  # PostgreSQL untuk local development
├── sst.config.ts       # Konfigurasi infrastruktur SST
├── turbo.json          # Pipeline eksekusi Turborepo
├── package.json        # Root package (Workspaces config)
└── README.md
```

---

## 🛠️ Prerequisites

Sebelum memulai *development* di *environment* lokal Anda, pastikan Anda telah menginstal:
* **Node.js** (v22 atau lebih baru, lihat `.nvmrc`)
* **pnpm** (Direkomendasikan untuk manajemen *monorepo* yang efisien)
* **Docker & Docker Compose** (Untuk menjalankan PostgreSQL lokal)
* Akun **Cloudflare** (untuk konfigurasi *deployment* dan Hyperdrive)

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
Duplikat file `.env.example` menjadi `.env` di *root directory* dan isi variabel yang dibutuhkan:
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
Perintah ini akan memicu **Turborepo** untuk menjalankan *local environment* bagi seluruh aplikasi (Portal Pembeli, Admin, Seller & API) secara paralel sekaligus menyambungkannya ke *resource* cloud melalui SST:
```bash
pnpm run dev
```

Anda bisa mengakses aplikasi di port berikut:
* **Portal Pembeli (SvelteKit):** [http://localhost:4301](http://localhost:4301)
* **Portal Admin (SvelteKit):** [http://localhost:4302](http://localhost:4302)
* **Portal Penjual/Seller (SvelteKit):** [http://localhost:4303](http://localhost:4303)
* **Backend API (Hono):** `http://localhost:8787` (atau port dinamis wrangler)

---

## 🧪 Testing

Aplikasi berskala tinggi membutuhkan pengujian yang ketat. Anda dapat menjalankan beberapa tipe pengujian:

* **E2E Testing (Playwright):** Menjalankan pengujian UI / Layout untuk memastikan halaman berfungsi di browser. Contoh pada portal admin:
  ```bash
  cd apps/admin
  npx playwright test
  ```
* **Unit & Integration Test:** `pnpm run test` (menggunakan Vitest)
* **Load Testing:** `pnpm run test:load` (menggunakan K6 untuk mensimulasikan *war ticket*)

---

## 🌐 Deployment & CI/CD

Proses *deployment* ke *production* sepenuhnya diotomatisasi menggunakan **GitHub Actions**. Setiap PR atau *merge* ke *branch* `main` akan memicu *pipeline* CI/CD untuk memastikan semua *test* berlalu sebelum melakukan *build* dan *deploy* ke Cloudflare.
Namun, jika Anda perlu melakukan *deploy* manual dari mesin lokal, Anda dapat menjalankan:
```bash
pnpm run build
pnpm run deploy --stage production
```

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 🤖 AI Development Setup (MCP Servers)

Project ini dikonfigurasi dengan **Model Context Protocol (MCP) servers** untuk mempercepat development menggunakan AI agent. Konfigurasi tersimpan di `.vscode/mcp.json`.

| MCP Server | Fungsi | Penggunaan |
| ---------- | ------ | ---------- |
| **filesystem-mcp-server** | Operasi filesystem (baca, tulis, cari, navigasi file dalam project) | Membuat file, membaca struktur project, menulis kode |
| **shadcn-ui-mcp-server** | Referensi komponen, block, dan tema shadcn/ui | Mendapatkan source code komponen, contoh demo, block template (dashboard, login, sidebar), dan menerapkan tema |

### Kapabilitas MCP yang tersedia:

**shadcn-ui-mcp:**
- `list_components` — Daftar semua komponen shadcn/ui yang tersedia
- `get_component` / `get_component_demo` — Source code dan contoh penggunaan komponen
- `list_blocks` / `get_block` — Template block siap pakai (dashboard, login, sidebar, calendar, products)
- `list_themes` / `apply_theme` — Tema visual yang bisa diterapkan ke project

**filesystem-mcp:**
- Read, write, create, move files
- Directory tree & file search
- Multi-file read & edit operations