# Pre-Deploy Task Plan

Dokumen ini merangkum langkah berikutnya sebelum deploy production berdasarkan kondisi repo per 2026-04-16.

## Current State

- Branch `main` sudah memuat stack SST production, seluruh workflow CI/CD, dan gate engineering utama berbasis repo/lokal sudah lulus (typecheck, lint, format:check, build, dan E2E lokal mock-backed).
- Staging deploy sukses ke domain target, dan smoke check utama untuk API/buyer/admin/seller lulus.
- Staging sekarang sudah berisi data event/katalog/seller representatif; validasi public browsing non-empty dan single checkout smoke di staging sudah berhasil dijalankan.
- Laporan staging validation terbaru (`STAGING_VALIDATION.md`) sekarang menyatakan **conditional go** untuk deploy production publik:
	1. Slice staging multi-user minimum yang approved sudah selesai dengan `5/5` flow checkout sukses, validasi DB hijau, dan cleanup synthetic data selesai.
	2. Warning yang tersisa adalah `http_req_duration p95 ~2.18s` pada slice staging tersebut, terutama dipicu reservation path; ini diperlakukan sebagai warning engineering/monitoring, bukan blocker rilis final otomatis.
	3. Benchmark checkout lokal `T-10.3` tetap di atas target historis (`full_flow_duration p95 ~6.02s`, `http_req_duration p95 ~3.20s`, `step_reservation_duration p95 ~3.44s` pada run balanced terbaru per 2026-04-16), tetapi setelah keputusan Opsi B benchmark ini diposisikan sebagai target engineering lokal, bukan blocker rilis final dengan sendirinya.
- Residual risk utama:
	- Release gate non-local sudah tertutup, tetapi slice staging minimum masih menunjukkan warning latency yang terkonsentrasi di reservation path.
	- Benchmark checkout lokal `T-10.3` masih berada di atas target historis dan tetap perlu dioptimasi sebagai backlog engineering.
	- Profiling terbaru menunjukkan sebagian tail checkout lokal masih dipengaruhi runner Node lokal satu-proses selain bottleneck reservation path aplikasi, sehingga benchmark lokal tidak boleh dibaca sebagai proxy final untuk runtime target.
	- Evidence readiness saat ini masih campuran antara gate lokal dan bukti staging remote; framing keputusan rilis harus tetap membedakan keduanya dengan tegas.
	- Perubahan lifecycle DB client (disable cache) sudah benar untuk Workers, tapi perlu terus dimonitor di staging.
- Next action:
	1. Owner: shared — lanjutkan benchmark checkout lokal `T-10.3` sebagai target engineering dan monitoring regressions melalui Task I, bukan blocker rilis final tunggal.
	2. Owner: shared — putuskan timing release dengan profil warning saat ini dan monitor reservation latency secara ketat bila deploy production dilanjutkan.
	3. Owner: shared — bila dibutuhkan confidence non-local yang lebih tinggi nanti, rencanakan slice staging yang lebih besar dengan paced token prefetch di bawah approval eksplisit terpisah.
	4. Owner: shared — gunakan `PRODUCTION_RELEASE_RUNBOOK.md` untuk menjalankan deploy production, smoke pascadeploy, dan rollback decision secara konsisten.
- Follow-up pasca-Task F dan keputusan Opsi B sekarang dipisah eksplisit: Task G menutup keputusan gate, Task H menangani release gate non-local, dan Task I menampung backlog optimisasi checkout lokal sebagai workstream engineering terpisah.

## Main Recommendation

Production deploy publik sekarang bisa dipertimbangkan dengan hati-hati.

Gate non-local utama sekarang sudah tertutup oleh slice staging 5-user yang approved. Warning yang tersisa berpusat pada reservation latency dan backlog optimisasi checkout lokal, jadi keputusan final release sebaiknya disertai monitoring ketat setelah deploy, bukan menunggu gap validasi non-local yang sebelumnya masih terbuka. Checklist operasionalnya sudah diringkas di `PRODUCTION_RELEASE_RUNBOOK.md`.

## Execution Order

1. Task A — Implement production stack di SST. [DONE]
2. Task B — Rapikan kontrak env dan secrets production. [DONE]
3. Task C — Selesaikan auth/email flow yang aman untuk production. [DONE]
4. Task D — Tutup hardening security yang masih tersisa. [DONE]
5. Task E — Pasang monitoring, health, dan alerting minimum. [DONE]
6. Task F — Jalankan staging validation dan tetapkan go/no-go deploy. [DONE]
7. Task G — Putuskan gate performa checkout dan tindak lanjuti baseline. [DONE]
8. Task H — Tetapkan strategi validasi multi-user staging yang aman dan jalankan ulang setelah approval. [DONE]
9. Task I — Lanjutkan optimisasi checkout lokal sebagai backlog engineering. [DONE]

## Task A — Implement Production Stack in SST

Status: done
Owner: AI agent
Last updated: 2026-04-15
Notes: `sst.config.ts` sudah mendefinisikan API worker, Durable Object `TicketReserver`, reservation cleanup queue + consumer, cron cleanup, R2 bucket, dan portal workers.

Catatan eksperimen 2026-04-20 terbaru sekali lagi (rejected, reverted): sampled per-request runner profiling di `scripts/run-api-local.ts` sempat dipersempit dari semua kategori non-`other` menjadi `reservation` saja untuk menguji apakah overhead harness lintas kategori bisa turun, mengingat deep auth/rate-limit profiling memang sudah reservation-only. Dua helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets), tetapi pair-nya tidak memberi win repeatable: baseline fresh sesi ini `full_flow/http_req/step_reservation ~10.91s/6.12s/6.75s`, run eksperimen #1 `~12.60s/8.14s/10.19s`, run #2 konfirmasi `~13.02s/6.10s/6.86s`. Karena `full_flow` tetap memburuk dan downstream run kedua juga melebar, patch harness direvert penuh.

Catatan eksperimen 2026-04-20 terbaru berikutnya lagi (rejected, reverted): preset `load-balanced` di `scripts/run-api-local.ts` sempat dinaikkan hanya pada `ticketReserverDbMaxConnections` dari `25` ke `32` untuk mengisolasi dampak pool DO pada `insert_reservation_pool_wait`. Focused validation suite tetap hijau sebelum perubahan dan pasca-revert (`31/31`), dan dua helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets). Baseline fresh sesi ini mencatat `full_flow/http_req/step_reservation ~12.71s/6.83s/7.39s`; run eksperimen #1 memberi `~12.44s/7.67s/9.63s`, run #2 konfirmasi memberi `~12.92s/4.79s/3.96s`. Analisis log menunjukkan contention hanya bergeser antara `eligibility_pool_wait` app-side dan `insert_reservation_pool_wait` DO, tanpa win repeatable pada workflow resmi, sehingga preset direvert penuh.

### Priority

P0 — blocker deploy.

### Why

Workflow deploy sudah memanggil `pnpm run deploy --stage production`, tetapi `sst.config.ts` masih placeholder dan belum mendefinisikan resource production yang nyata.

### Scope

- Definisikan resource SST untuk API worker production.
- Wire Durable Object `TicketReserver`.
- Wire queue untuk reservation cleanup.
- Wire binding untuk database production melalui Hyperdrive atau binding yang dipakai arsitektur final.
- Wire bucket R2 bila memang dibutuhkan oleh upload path.
- Pastikan domain/subdomain target dan env production dapat diinjeksikan dengan cara yang konsisten.

### Expected Output

- `sst.config.ts` tidak lagi placeholder.
- Terdapat resource graph production yang bisa dijalankan dengan `pnpm run deploy --stage production`.
- Semua binding runtime penting tersedia untuk API di production.
- Dokumentasi singkat deployment diperbarui bila ada perubahan nama secret atau binding.

### Definition of Done

- `sst.config.ts` mendefinisikan resource production secara nyata.
- Tidak ada placeholder `return {}` untuk stack final.
- Deploy command bisa dijalankan terhadap stage production tanpa gap konfigurasi yang jelas.
- API worker memiliki binding untuk DB, DO, queue, dan storage yang memang dipakai kode.

### Agent Prompt

```text
Kerjakan Task A: implementasi production stack SST untuk Jeevatix.

Konteks penting:
- Repo sudah memiliki workflow deploy yang memanggil `pnpm run deploy --stage production`.
- File `sst.config.ts` masih placeholder dan saat ini menjadi blocker utama deploy production.
- Arsitektur target: Cloudflare Workers + Durable Objects + Queues + Hyperdrive + R2.
- Jangan ubah stack teknologi inti.

Tujuan:
1. Ubah `sst.config.ts` dari placeholder menjadi definisi stack production yang nyata.
2. Pastikan API worker mendapatkan binding yang dibutuhkan kode runtime saat ini.
3. Pastikan Durable Object `TicketReserver`, reservation cleanup queue, database binding, dan upload storage sudah terhubung.
4. Jika ada konfigurasi domain/env/secret yang perlu disejajarkan, update dokumentasi yang relevan.

Aturan kerja:
- Baca file yang relevan sebelum mengedit.
- Gunakan perubahan sekecil mungkin tetapi lengkap.
- Pertahankan arsitektur Cloudflare + SST.
- Jangan menambah fitur baru di luar kebutuhan deploy.

Output yang diharapkan:
- Kode stack SST production siap direview.
- Ringkasan binding yang disediakan ke API.
- Catatan hal yang masih membutuhkan secret atau resource manual di Cloudflare dashboard.
```

## Task B — Align Production Env and Secret Contract

Status: done
Owner: AI agent
Last updated: 2026-04-15
Notes: canonical env sudah diselaraskan ke `EMAIL_API_KEY`, `JWT_SECRET`, `PUBLIC_API_BASE_URL`, dan `PUBLIC_PARTYKIT_HOST`; deploy workflow juga disesuaikan agar mengekspor env yang memang dibutuhkan stack saat ini.

### Priority

P0 — blocker deploy.

### Why

Ada risiko mismatch antara nama secret yang disebut dalam plan/dokumentasi dan yang benar-benar dibaca oleh runtime. Ini sering membuat deploy pertama gagal walaupun CI hijau.

### Scope

- Audit semua env yang dipakai runtime backend, frontend, upload, auth, payment, email, dan deploy.
- Samakan naming contract antara kode, `.env.example`, README, dan workflow/deploy docs.
- Buat daftar final env production yang wajib ada.
- Pastikan tidak ada nama lama yang tersisa seperti mismatch antara `RESEND_API_KEY` dan `EMAIL_API_KEY` bila runtime hanya mengenal salah satunya.

### Expected Output

- Satu kontrak env yang konsisten antara kode dan dokumentasi.
- `.env.example` diperbarui bila perlu.
- README/deploy notes menjelaskan secret yang wajib di-set.

### Definition of Done

- Semua env yang dibaca runtime terdokumentasi.
- Tidak ada mismatch nama secret yang akan membuat runtime gagal pada jalur penting.
- Agent atau engineer lain bisa menyiapkan production secrets tanpa menebak.

### Agent Prompt

```text
Kerjakan Task B: audit dan rapikan kontrak environment variables serta secrets production.

Konteks penting:
- Saat ini ada indikasi mismatch antara dokumentasi deploy dan runtime, khususnya di email secret naming.
- Tujuannya bukan menambah fitur, tetapi memastikan deploy production tidak gagal karena konfigurasi.

Tujuan:
1. Audit semua env yang dibaca runtime di backend, frontend, upload, payment, email, auth, dan deployment.
2. Samakan nama env di kode, `.env.example`, README, dan dokumen deploy.
3. Hapus ambiguitas atau nama lama yang tidak lagi dipakai.
4. Hasil akhir harus berupa kontrak env production yang jelas.

Aturan kerja:
- Cari berdasarkan penggunaan nyata di kode, bukan asumsi.
- Pertahankan nama env yang paling masuk akal jika harus memilih satu standar.
- Bila renaming berisiko besar, dokumentasikan kompatibilitas atau migration note.

Output yang diharapkan:
- File config/dokumentasi yang konsisten.
- Ringkasan daftar env production final.
- Catatan mismatch yang diperbaiki.
```

## Task C — Fix Production-Safe Auth and Email Flow

Status: done
Owner: AI agent
Last updated: 2026-04-15
Notes: response publik auth tidak lagi mengekspos `verify_email_token` atau `reset_token` secara default; register dan forgot-password sekarang memicu email delivery sebagai jalur utama, tersedia `GET /auth/verify-email?token=...` untuk link verifikasi email, dan mode local/test dipertahankan secara eksplisit melalui `AUTH_EXPOSE_DEBUG_TOKENS=1`.

### Priority

P0 — blocker public launch.

### Why

Flow auth saat ini masih memiliki mode test-friendly: token verifikasi email dan reset password masih bisa muncul di response. Ini tidak aman untuk production public. Selain itu, jalur email production harus benar-benar menjadi jalur utama, bukan fallback sementara.

### Scope

- Identifikasi semua response yang masih mengembalikan `verify_email_token` atau `reset_token` untuk frontend/smoke test.
- Ubah flow agar production tidak membocorkan token tersebut dalam response publik.
- Wire email delivery yang benar sesuai kontrak env final.
- Pastikan jalur register, register seller, forgot password, dan verify/reset flow tetap bisa diuji dengan cara yang aman.
- Jika perlu, pertahankan mode local/test secara eksplisit dan terisolasi dari production.

### Expected Output

- Response production tidak lagi membocorkan token verifikasi atau reset.
- Flow email menjadi jalur utama untuk verify/reset.
- Test yang relevan disesuaikan dengan perilaku final.

### Definition of Done

- Jalur production untuk register dan forgot-password tidak mengembalikan token sensitif.
- Email service atau queue flow yang dipilih benar-benar dipakai di jalur tersebut.
- Dokumentasi/testing strategy untuk local dev tetap jelas.

### Agent Prompt

```text
Kerjakan Task C: ubah auth dan email flow agar aman untuk production.

Konteks penting:
- Saat ini register/register-seller/forgot-password masih dapat mengembalikan token verifikasi atau reset di response.
- Ini boleh membantu local smoke test, tetapi tidak boleh menjadi perilaku production public.
- Tujuan task ini adalah memisahkan mode test/local dari mode production dengan aman.

Tujuan:
1. Temukan semua endpoint dan schema yang masih mengekspos `verify_email_token` atau `reset_token`.
2. Ubah perilaku production agar token sensitif tidak dikembalikan ke client publik.
3. Pastikan email delivery menjadi mekanisme utama untuk verify/reset.
4. Pertahankan cara pengujian local yang aman dan eksplisit bila masih dibutuhkan.
5. Update test dan dokumentasi yang terdampak.

Aturan kerja:
- Jangan merusak auth flow buyer/admin/seller yang sudah benar.
- Minimalkan breaking change yang tidak perlu.
- Jika perlu conditional behavior, buat eksplisit berbasis env/stage dan dokumentasikan.

Output yang diharapkan:
- Kode auth/email production-safe.
- Penjelasan mode production vs local/test.
- Ringkasan perubahan response contract bila ada.
```

## Task D — Complete Remaining Security Hardening

Status: done
Owner: AI agent
Last updated: 2026-04-15
Notes: rate limiting production path sekarang memakai Durable Object `RateLimiter` dengan fallback in-memory hanya untuk local/test; auth admin dan seller sudah dipindahkan ke cookie `httpOnly` + same-origin session endpoints; CORS sudah environment-driven lewat `CORS_ALLOWED_ORIGINS`. Validasi yang sudah lulus: auth/reservation API tests, typecheck API/admin/seller, format:check, lint, dan `eslint sst.config.ts`.

### Priority

P0 — strongly recommended before public launch.

### Why

Security review sudah selesai, tetapi backlog hardening yang tersisa justru menyentuh area production penting: rate limiting global/shared, token storage admin/seller, dan CORS production.

### Scope

- Ganti limiter in-memory dengan solusi yang cocok untuk scale production Cloudflare.
- Ubah admin dan seller auth storage agar tidak lagi bergantung pada JS-readable cookie untuk token session.
- Pindahkan CORS allowlist menjadi environment-driven configuration.
- Validasi bahwa perubahan ini tidak merusak flow login dan API calls portal.

### Expected Output

- Rate limiting production-grade.
- Admin/seller auth lebih hardened.
- CORS production bisa dikontrol via env/stage.

### Definition of Done

- Tidak ada lagi ketergantungan limiter in-memory sebagai mekanisme utama production.
- Admin/seller tidak menyimpan access/refresh token di cookie yang ditulis dari `document.cookie` untuk production path final.
- CORS origin production tidak lagi hardcoded statis di kode.

### Agent Prompt

```text
Kerjakan Task D: selesaikan hardening security yang tersisa sebelum public launch.

Konteks penting:
- Security review sudah mengidentifikasi tiga backlog utama: limiter global/shared, auth token storage admin/seller, dan CORS production berbasis env.
- Fokus task ini adalah hardening production, bukan refactor umum.

Tujuan:
1. Ganti mekanisme rate limiting yang saat ini in-memory dengan pendekatan yang cocok untuk production Cloudflare.
2. Hardening auth admin dan seller agar token tidak lagi disimpan dengan JS-readable cookie pada flow production final.
3. Ubah konfigurasi CORS menjadi environment-driven.
4. Pastikan login, refresh, logout, dan request authenticated tetap berjalan.

Aturan kerja:
- Pertahankan UX dan kontrak API semaksimal mungkin.
- Pastikan solusi tetap edge-compatible.
- Update dokumentasi/security notes bila perilaku auth berubah.

Output yang diharapkan:
- Perubahan kode hardening production.
- Ringkasan tradeoff bila ada perubahan flow auth.
- Daftar env/config baru yang diperlukan.
```

## Task E — Add Monitoring, Health, and Alerting Minimum

Status: done
Owner: AI agent
Last updated: 2026-04-15
Notes: endpoint `/health` sekarang mengembalikan `status`, `timestamp`, `version`, `environment`, dan `service` dengan `Cache-Control: no-store`; API worker menambahkan structured error logging ke Cloudflare Workers Logs lewat request-id aware observability middleware; deploy workflow production otomatis mengekspor `APP_VERSION` dari `github.sha` dan smoke test memverifikasi shape payload `/health`; README serta security notes sekarang memuat langkah verifikasi pascadeploy, uptime monitoring minimum, alerting baseline, dan jaminan redaksi data sensitif di log.

### Priority

P1 — required before real cutover.

### Why

Tanpa monitoring dasar, deploy pertama ke production akan sulit dioperasikan dan sulit di-debug. Health endpoint saat ini terlalu minimal.

### Scope

- Perkaya endpoint `/health` dengan metadata minimum seperti timestamp dan version.
- Pilih dan pasang error tracking atau logging pipeline yang realistis untuk stack ini.
- Siapkan uptime monitoring.
- Siapkan alert minimum untuk error rate dan degradasi latency.
- Pastikan data sensitif tidak terkirim ke log/error tracking.

### Expected Output

- `/health` lebih berguna untuk smoke test dan monitoring.
- Ada satu jalur observability minimum yang sudah aktif.
- Ada petunjuk alert/uptime yang siap dipakai setelah deploy.

### Definition of Done

- Endpoint health memuat informasi minimum untuk operasi.
- Ada integrasi monitoring/error tracking yang nyata, bukan hanya catatan TODO.
- Ada instruksi verifikasi pascadeploy untuk health dan error reporting.

### Agent Prompt

```text
Kerjakan Task E: pasang monitoring, health, dan alerting minimum untuk production.

Konteks penting:
- Task T-10.7 di plan belum selesai.
- Endpoint `/health` sekarang terlalu minimal untuk operasi production.
- Kita membutuhkan baseline observability sebelum deploy publik.

Tujuan:
1. Tingkatkan endpoint `/health` agar mengembalikan status, timestamp, dan version minimum.
2. Pasang satu solusi error tracking/logging yang realistis untuk stack Cloudflare ini.
3. Siapkan dokumentasi uptime check dan alerting minimum.
4. Pastikan data sensitif tidak ikut terkirim ke logs/reports.

Aturan kerja:
- Jangan over-engineer; targetnya baseline production readiness.
- Gunakan integrasi yang masuk akal untuk stack yang sudah ada.
- Update dokumen deploy/operasional jika diperlukan.

Output yang diharapkan:
- Kode monitoring/health yang siap direview.
- Langkah verifikasi observability pascadeploy.
- Catatan secret/config tambahan bila ada.
```

## Task F — Staging Validation and Go/No-Go Review

Status: done
Owner: shared
Last updated: 2026-04-16
Notes: task ini selesai sebagai aktivitas review go/no-go dan dokumentasi. Bukti staging remote yang sekarang tervalidasi mencakup deploy, smoke API/buyer/admin/seller, public browsing non-empty, single checkout smoke, dan slice staging multi-user minimum yang approved pada Task H. `pnpm run test:e2e` dan `pnpm run test:load:checkout:local` tetap hanya supporting signal lokal. Posisi final di laporan staging sekarang adalah `conditional go`: blocker non-local sudah tertutup, tetapi warning reservation latency tetap harus dicatat.

### Priority

P1 — final gate sebelum deploy production.

### Why

Local benchmark sudah cukup untuk diagnosis, tetapi tidak cukup untuk menyatakan sistem siap production. Perlu satu lintasan validasi di environment yang lebih mirip runtime target.

### Scope

- Deploy ke staging atau environment non-public yang representatif.
- Jalankan smoke test untuk API dan 3 portal.
- Jalankan `pnpm run test:e2e` bila memang menjadi release gate final, tetapi catat eksplisit bila hasilnya masih berasal dari mode lokal/mock-backed.
- Jalankan satu load test terarah pada runtime yang lebih mendekati production hanya setelah konfirmasi eksplisit user sesuai policy load-test safety; bila belum bisa, dokumentasikan blocker dan rencana tindak lanjutnya.
- Buat keputusan go/no-go berbasis hasil nyata, bukan asumsi.

### Expected Output

- Laporan staging validation.
- Daftar pass/fail per gate, dengan pemisahan yang jelas antara gate lokal dan gate staging/remote.
- Keputusan jelas: siap deploy production atau masih ada blocker.

### Definition of Done

- Ada hasil validasi staging yang terdokumentasi.
- Semua gate utama punya status jelas.
- Jika masih ada blocker, blocker tersebut dinyatakan eksplisit beserta owner/next action, termasuk apakah blocker itu berasal dari gap lokal, staging remote, atau policy approval.

### Agent Prompt

```text
Kerjakan Task F: staging validation dan go/no-go review sebelum deploy production.

Konteks penting:
- Local checks utama sudah cukup baik, tetapi belum cukup untuk menyatakan production-ready.
- Repo sekarang mewajibkan konfirmasi eksplisit user sebelum remote load test atau synthetic traffic dijalankan.
- Target task ini adalah mendapatkan bukti operasional dari environment yang lebih mirip production.

Tujuan:
1. Deploy sistem ke staging atau environment non-public yang representatif.
2. Jalankan smoke check untuk API, buyer, admin, seller, dan jalur auth utama.
3. Jalankan release gate yang relevan seperti E2E dan minimal satu load scenario representatif jika approval eksplisit untuk remote load test memang tersedia; jika belum, dokumentasikan gap tersebut secara eksplisit.
4. Ringkas hasilnya menjadi keputusan go/no-go yang jelas.

Aturan kerja:
- Bedakan dengan tegas mana bukti lokal/mock-backed dan mana bukti staging/remote.
- Ikuti policy approval untuk remote load test; jangan eksekusi tanpa konfirmasi eksplisit user.
- Fokus pada validasi readiness, bukan eksperimen performa lokal lagi.
- Dokumentasikan hasil numerik penting, error yang muncul, dan residual risk.
- Jika ada blocker, jangan paksakan deploy; tulis next action yang spesifik beserta owner-nya.

Output yang diharapkan:
- Laporan staging validation.
- Status gate: pass/fail.
- Rekomendasi final: deploy production sekarang atau tunda dengan alasan teknis yang jelas.
```

## Task G — Resolve Checkout Performance Gate

Status: done
Owner: shared
Last updated: 2026-04-16
Notes: profiling teknis dan benchmark lokal resmi sudah dijalankan, lalu release owner memilih Opsi B. Keputusan finalnya: threshold checkout lokal `T-10.3` tetap dipertahankan sebagai target engineering/non-release benchmark, sementara release bar final dipindahkan ke correctness lokal, smoke staging, dan validasi multi-user non-local yang lebih representatif setelah Task H selesai.

### Priority

P0 — blocker keputusan release.

### Why

Rekomendasi `no-go` saat ini terutama ditopang oleh gate latency checkout yang masih merah. Selama acceptance bar checkout belum diputuskan secara eksplisit, status release akan tetap ambigu walaupun smoke staging sudah hijau.

Keputusan itu sekarang sudah diambil: benchmark checkout lokal tidak lagi diperlakukan sebagai blocker rilis final tunggal.

### Current Findings

- Asal threshold saat ini memang jelas: `DEVELOPMENT_PLAN.md` task `T-10.3` menetapkan target lokal `http_req_duration p95 < 2 detik` untuk load dan `full flow p95 < 3 detik` untuk checkout.
- Run lokal terbaru yang memakai helper resmi repo (`load-balanced`) konsisten dengan baseline yang sudah direkam di repo memory dan `DEVELOPMENT_PLAN.md`; hasilnya tidak menunjukkan noise ekstrem atau harness failure baru.
- Hot path checkout yang masih dominan tetap reservation step. Kode saat ini sudah memakai prepared statement pada eligibility query di [apps/api/src/services/reservation.service.ts](/home/ubuntu/bench/jeevatix/apps/api/src/services/reservation.service.ts) dan prepared insert pada [apps/api/src/durable-objects/ticket-reserver.ts](/home/ubuntu/bench/jeevatix/apps/api/src/durable-objects/ticket-reserver.ts), sehingga win besar yang paling jelas di path query-builder CPU sudah lebih dulu diambil.
- Order dan payment path di [apps/api/src/services/order.service.ts](/home/ubuntu/bench/jeevatix/apps/api/src/services/order.service.ts) dan [apps/api/src/services/payment.service.ts](/home/ubuntu/bench/jeevatix/apps/api/src/services/payment.service.ts) juga sudah memuat optimisasi yang sebelumnya terbukti, seperti reservation lookup di dalam transaksi order dan payment lookup/update di transaksi webhook.
- Profiling historis yang sudah tervalidasi di repo menunjukkan tail reservation saat ini lebih banyak datang dari queueing pada app pool dan insert path Durable Object, lalu diperbesar lagi oleh runner Node lokal satu-proses yang membuat waiting berpindah-pindah antar reservation, order, dan payment. Artinya, mengoptimisasi query kecil secara buta sekarang berisiko hanya memindahkan tail, bukan menurunkan full-flow p95 secara repeatable.

### Recommendation

- Keputusan yang disetujui: pertahankan threshold `T-10.3` saat ini sebagai target engineering aspiratif, tetapi jangan perlakukan kegagalan benchmark lokal itu sendirian sebagai blocker rilis final selama evidence worker-like/non-local yang representatif belum tersedia.
- Hard gate yang tetap layak dipertahankan sekarang: correctness checkout lokal harus tetap hijau, tidak boleh ada oversell, dan staging smoke + single checkout smoke harus tetap pass.
- Final performance gate untuk keputusan release sebaiknya dipindahkan ke evidence yang lebih representatif terhadap runtime target: staging multi-user validation yang aman setelah Task H dan approval eksplisit user, atau runtime worker-like lain yang tidak memakai runner Node lokal satu-proses.
- Jika nanti tetap dibutuhkan angka lokal sementara untuk guardrail reproducibility, kandidat re-baseline yang paling defensif untuk helper `load-balanced` saat ini adalah `full_flow_duration p95 <= 6.5s` dan `http_req_duration p95 <= 3.5s`, dengan reservation step tetap dimonitor terpisah. Angka ini belum diterapkan ke script karena keputusan yang disetujui saat ini belum memerlukan perubahan threshold di code-level benchmark.
- Rekomendasi implementasi untuk agent: jangan lanjut mengubah query/order/payment path tanpa profiling baru yang menunjukkan bottleneck aplikasi yang benar-benar repeatable; prioritas berikutnya lebih masuk akal ada pada keputusan gate dan validasi non-local, bukan micro-optimization tambahan yang spekulatif.

### Scope

- Audit definisi threshold checkout saat ini dan sumber target yang dipakai.
- Profiling jalur checkout representatif untuk mengidentifikasi bottleneck dominan.
- Bedakan secara tegas antara bukti correctness, latency lokal, dan bukti staging/remote.
- Susun rekomendasi: optimisasi agar lolos threshold saat ini atau re-baselining dengan justifikasi teknis.
- Update dokumen validasi bila keputusan gate berubah.

### Expected Output

- Ringkasan bottleneck utama checkout.
- Opsi keputusan yang jelas: pertahankan threshold atau re-baseline.
- Jika threshold dipertahankan, daftar optimisasi prioritas untuk mengejar target.

### Decision

- Opsi B disetujui: threshold lokal `T-10.3` diposisikan ulang sebagai target engineering/non-release benchmark.
- Release bar utama sekarang adalah correctness checkout lokal, staging smoke, single checkout smoke, dan validasi multi-user non-local yang approved saat Task H selesai.
- Task G dianggap selesai karena keputusan gate sudah tertulis; backlog optimisasi checkout lokal dipindahkan ke Task I agar tidak bercampur lagi dengan release gate.

### Definition of Done

- Ada keputusan tertulis apakah threshold checkout saat ini tetap menjadi blocker keras.
- Jika threshold diubah, nilai baru dan justifikasinya terdokumentasi.
- Jika threshold dipertahankan, backlog optimisasi checkout dan success criteria-nya jelas.
- Jika keputusan final masih menunggu manusia, status task harus mencatat bahwa analisis teknis sudah selesai dan blocker yang tersisa murni keputusan release owner.

### Agent Prompt

```text
Kerjakan Task G: selesaikan keputusan gate performa checkout sebelum release.

Konteks penting:
- Benchmark checkout representatif saat ini masih gagal threshold latency, tetapi evidence itu masih lokal.
- Staging smoke dan single checkout smoke sudah hijau, jadi fokus task ini adalah memperjelas acceptance bar performa checkout.
- Keputusan final release tetap membutuhkan penetapan eksplisit dari human/release owner.

Tujuan:
1. Audit definisi threshold checkout yang sedang dipakai.
2. Profiling atau baca hot path checkout untuk menemukan bottleneck dominan.
3. Susun opsi teknis yang jelas: optimisasi agar lolos threshold sekarang, atau re-baselining threshold dengan justifikasi.
4. Dokumentasikan rekomendasi yang bisa dipakai human/release owner untuk mengambil keputusan.

Aturan kerja:
- Jangan mencampur bukti lokal dengan bukti staging/remote.
- Fokus pada bottleneck nyata dan perbaikan root cause.
- Jangan menjalankan remote load test untuk task ini tanpa approval eksplisit user.

Output yang diharapkan:
- Ringkasan bottleneck checkout.
- Rekomendasi keep-threshold vs re-baseline.
- Jika ada optimisasi yang dipilih, daftar prioritas implementasinya.
```

## Task H — Approved Staging Multi-User Validation

Status: done
Owner: shared
Last updated: 2026-04-16
Notes: approval eksplisit user sudah dicatat melalui preflight di `STAGING_LOAD_TEST_PREFLIGHT.md`. Slice staging minimum 5 user kemudian dijalankan tanpa bypass limiter dan selesai dengan `checkout_flow_success=5`, `checkout_flow_failed=0`, `full_flow_duration p95 ~2.81s`, `http_req_duration p95 ~2.18s`, validasi DB hijau, dan cleanup synthetic data kembali nol. Task H selesai sebagai penutup gate non-local; residual yang tersisa adalah warning latency reservation, bukan blocker approval atau limiter lagi.

### Priority

P1 — final non-local validation gate.

### Why

Task ini dibutuhkan untuk menutup gap bukti multi-user non-local setelah deploy staging, smoke utama, browsing non-empty, dan single checkout smoke sudah hijau. Gap tersebut sekarang sudah tertutup oleh slice staging minimum yang approved.

### Scope

- Tentukan strategi validasi multi-user staging yang kompatibel dengan limiter auth.
- Nilai opsi seperti pre-generated tokens, pacing login, allowlist staging, atau setup auth alternatif yang tetap aman.
- Sebelum meminta approval, dokumentasikan target environment, skala traffic, service yang bisa terdampak billing, potensi side effect, dan cleanup plan.
- Setelah approval eksplisit user tersedia, jalankan satu skenario non-local yang minimal tetapi representatif lalu dokumentasikan hasilnya.

### Expected Output

- Strategi staging multi-user yang bisa dijalankan tanpa menabrak limiter auth.
- Ringkasan risiko biaya dan cleanup plan sebelum eksekusi.
- Laporan hasil rerun staging multi-user setelah approval tersedia.

### Definition of Done

- Ada strategi validasi multi-user staging yang terdokumentasi dan kompatibel dengan hardening auth.
- Approval eksplisit user untuk remote load test sudah dicatat sebelum eksekusi.
- Hasil pass/fail dari satu skenario non-local representatif sudah ditambahkan ke laporan staging.

### Agent Prompt

```text
Kerjakan Task H: siapkan dan jalankan validasi multi-user staging yang aman.

Konteks penting:
- Repo melarang remote load test tanpa approval eksplisit user di percakapan saat ini.
- Percobaan kecil sebelumnya ke staging gagal di setup login karena limiter auth berbasis IP.
- Tujuan task ini adalah menutup gap validasi non-local tanpa mengabaikan cost safety dan hardening yang sudah ada.

Tujuan:
1. Rancang strategi multi-user staging yang kompatibel dengan limiter auth.
2. Dokumentasikan dampak biaya, target environment, skala traffic, side effect, dan cleanup plan.
3. Minta approval eksplisit user sebelum eksekusi remote load.
4. Setelah approval tersedia, jalankan satu skenario minimum yang representatif dan catat hasilnya.

Aturan kerja:
- Jangan bypass limiter atau guardrail tanpa approval eksplisit user.
- Default aman: analisis script, rencana, dan estimasi biaya dulu.
- Jika approval belum ada, berhenti di tahap perencanaan dan dokumentasi blocker.

Output yang diharapkan:
- Strategi eksekusi staging multi-user yang aman.
- Checklist approval dan cleanup.
- Laporan hasil validasi non-local jika approval diberikan.
```

## Task I — Local Checkout Optimization Backlog

Status: in progress
Owner: shared
Last updated: 2026-04-26
Notes: task ini memisahkan optimisasi checkout lokal `T-10.3` dari release gate. Update 2026-04-24 terbaru: probe code-level yang membundel tiga insert `createOrder()` (`orders`, `order_items`, `payments`) menjadi satu raw CTE roundtrip di `apps/api/src/services/order.service.ts` sudah diuji lalu direvert penuh. Focused `order.test.ts` dan suite guardrail `31/31` tetap hijau saat eksperimen aktif, dan comparable helper `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32 --profile-services` juga tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets), tetapi aggregate regress keras ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~15.79s/4.41s/3.70s/4.55s/4.13s/2.01s`. Log run itu masih menunjukkan `payment.handleWebhook.transaction_queue_wait` sekitar `~1.12-1.17s` pada wave berat dan tidak memberi sampel `order.createOrder` yang bisa dipakai untuk membenarkan retain, sehingga probe ini ditolak; sesudah revert, `order.test.ts` kembali `7/7` dan focused suite `31/31` kembali hijau. Update 2026-04-24 lanjutan: probe kecil berikutnya yang mem-prefetch snapshot immutable reservation/tier di luar transaksi `createOrder()` sambil me-recheck field mutable (`userId`, `status`, `expiresAt`) di dalam transaksi juga sudah diuji lalu direvert penuh. Focused `order.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`7/7`). Comparable helper yang sama tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets), tetapi aggregate kembali regress ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~15.89s/5.22s/3.71s/5.44s/3.47s/2.12s`, sehingga probe ini juga ditolak. Timeout sementara itu ternyata artefak benchmark lokal: sesudah cleanup synthetic benchmark data dan pemakaian env eksplisit `JWT_SECRET` + `PAYMENT_WEBHOOK_SECRET`, `src/__tests__/queue-cleanup.test.ts` kembali `4/4` dan suite guardrail lebar kembali `31/31`, jadi failure sementara tersebut bukan regresi `order.service.ts`. Jangan buka lagi keluarga probe "reservation snapshot prefetch split" tanpa alasan teknis baru yang kuat. Update 2026-04-24 terbaru sesudah cleanup itu: probe kecil berikutnya yang hanya memangkas payload `RETURNING` sekunder pada insert `order_items` dan `payments` di `createOrder()` juga sudah diuji lalu direvert penuh. Focused `order.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`7/7`), tetapi comparable helper yang sama kembali correctness-green sambil regress keras ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~17.74s/6.08s/3.10s/5.50s/5.20s/3.52s`; log run itu juga tidak memberi sampel `order.createOrder` yang bisa dipakai untuk membenarkan retain. Jangan buka lagi keluarga probe "secondary RETURNING trim" tanpa alasan teknis baru yang kuat. Update 2026-04-24 terbaru sesudah itu: probe kecil berikutnya yang menghapus timestamp insert app-side redundan pada `orders` dan `payments` di `createOrder()` agar schema `defaultNow()` mengisi `createdAt`/`updatedAt` juga sudah diuji lalu direvert penuh. Focused `order.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`7/7`), dan suite guardrail lebar kembali `31/31` sesudah cleanup artefak benchmark. Namun comparable helper yang sama kembali correctness-green sambil regress keras ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~16.28s/7.26s/2.79s/3.70s/3.64s/2.39s`. Jangan buka lagi probe "insert timestamp defaultNow()" ini tanpa alasan teknis baru yang kuat. Update 2026-04-24 terbaru sesudah itu lagi: probe kecil berikutnya yang menangani collision `idx_orders_order_number` lewat nested transaction/savepoint di dalam `createOrder()` agar retry nomor order tidak keluar lagi ke antrean transaksi penuh juga sudah diuji lalu direvert penuh. Focused `order.test.ts` + `order-number.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`9/9`), dan suite guardrail lebar kembali `31/31` sesudah cleanup artefak benchmark. Namun comparable helper yang sama kembali correctness-green sambil regress ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~16.65s/6.34s/4.14s/4.41s/3.51s/2.39s`. Jangan buka lagi probe "order-number savepoint retry" ini tanpa alasan teknis baru yang kuat. Update 2026-04-24 terbaru sesudah itu lagi sekali lagi: probe kecil berikutnya yang membuat suffix `order_number` tetap unik di proses yang sama pada hari UTC yang sama, sambil mempertahankan format publik `JVX-YYYYMMDD-XXXXX`, juga sudah diuji lalu direvert penuh. Focused `order.test.ts` + `order-number.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`9/9`), dan suite guardrail lebar kembali `31/31` sesudah cleanup artefak benchmark. Namun comparable helper yang sama kembali correctness-green sambil regress lebih jauh ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~17.14s/5.09s/4.10s/5.34s/4.73s/3.04s`. Jangan ulang probe "local unique order-number suffix" ini tanpa alasan teknis baru yang kuat. Update 2026-04-26 terbaru sesudah itu: probe kecil berikutnya yang membiarkan default schema mengisi `orders.status`, `orders.serviceFee`, dan `payments.status` di `createOrder()` juga sudah diuji lalu direvert penuh. Focused `order.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`7/7`). Comparable helper yang sama tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets) dengan `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~13.26s/6.75s/2.56s/2.77s/2.46s/1.67s`, tetapi artifact run itu lagi-lagi tidak memberi sampel `order.createOrder` untuk hotspot target dan tidak ada pair control retained di sesi yang sama untuk membuktikan win repeatable. Probe ini ditolak dan direvert; sesudah cleanup, dry-run kembali `0` dan suite guardrail lebar kembali `31/31`. Jangan ulang probe "schema default insert values" ini tanpa alasan teknis baru yang kuat. Iterasi 2026-04-16 menghasilkan satu perubahan retained pada harness: `packages/core/scripts/run-local-checkout-benchmark.ts` sekarang memaksa env benchmark kanonis (`500` user, fresh checkout users, localhost runner) dan mengoverride runtime lokal dari `.env` agar shell yang sebelumnya memuat `.env.staging` tidak mencemari benchmark lokal. Eksperimen pemangkasan field pada reservation eligibility hot path ditolak dan direvert karena sempat memperbaiki reservation step tetapi memperburuk full-flow dan ticket issuance. Pada validasi manual kanonis 2026-04-17 dengan preset `load-balanced`, fixed localhost port, fresh checkout users, dan low-overhead runner sampling, correctness tetap hijau (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets) dengan `full_flow_duration p95 ~5.68s`, `http_req_duration p95 ~2.39s`, `step_reservation_duration p95 ~2.65s`, `step_order_duration p95 ~1.27s`, `step_payment_duration p95 ~1.85s`, dan `step_webhook_duration p95 ~1.11s`; cleanup sesudah run kembali ke `0`. Profiling dari run yang sama menunjukkan tail lokal masih terbagi antara admission delay di runner Node lokal satu-proses (`client_send_to_handler p95 ~1.24s`, overlap awal sangat tinggi) dan queueing di reservation path aplikasi (`eligibility_pool_wait p95 ~493ms`, `durable_object_reserve p95 ~882ms`, `ticketReserver.insert_reservation_pool_wait p95 ~804ms`). Validasi berikutnya pada helper resmi `pnpm run test:load:checkout:local:profile` sempat gagal secara correctness (`246/500` sukses) dan mengungkap divergence penting: saat `profile.enabled`, `apps/api/src/durable-objects/ticket-reserver.ts` mengeksekusi raw insert alih-alih prepared insert hot path, sehingga profiling tidak lagi representatif dan memicu banyak `409 INVALID_STATE` pada insert reservation. Pada satu iterasi sebelumnya, jalur profiling DO sempat diselaraskan ke prepared insert yang sama dengan baseline normal, memakai raw SQL hanya untuk debug probe timing, menambahkan logging tak terduga di route reservation, dan mengoreksi README bahwa helper resmi tetap kanonis `500` user. Sesudah fix tersebut, rerun resmi `pnpm run test:load:checkout:local:profile` kembali hijau untuk correctness (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets) dengan summary/helper plumbing lengkap (`runnerLogFile`, `local-checkout-summary`), sementara threshold performa masih gagal di `full_flow_duration p95 ~6.18s`, `http_req_duration p95 ~2.96s`, `step_reservation_duration p95 ~3.53s`, `step_order_duration p95 ~1.05s`, `step_payment_duration p95 ~1.75s`, dan `step_webhook_duration p95 ~1.13s`; cleanup sesudah run kembali ke `0`. Satu eksperimen lanjutan yang sempat dicoba adalah menggabungkan `confirmReservation()` dan `fulfillSuccessfulPayment()` menjadi satu deferred background task di `payment.service.ts` agar queue lokal tidak dipenuhi dua task sukses per order. Eksperimen itu tetap correctness-green dan payment tests lulus, tetapi official helper rerun justru memburuk (`full_flow_duration p95 ~6.74s`, `http_req_duration p95 ~3.11s`, `step_reservation_duration p95 ~3.55s`, `step_payment_duration p95 ~1.85s`) dibanding baseline helper valid sebelumnya, sehingga perubahan tersebut ditolak dan direvert. Iterasi retained terbaru berfokus pada observability harness lokal, bukan win performa baru: `packages/core/scripts/run-local-checkout-benchmark.ts` sekarang men-spawn runner langsung via `node_modules/.bin/tsx`, memberi grace `SIGTERM` lebih panjang, dan menulis log runner langsung ke file descriptor child agar helper tidak lagi meninggalkan orphan process atau kehilangan event akhir; `scripts/run-api-local.ts` sekarang memprofilkan semua kategori request non-`other`, melacak `waitUntil` secara global, dan melaporkan `pendingWaitUntilTasks` di runtime snapshot. `apps/api/src/services/payment.service.ts` juga kini melakukan sampling background task per label dan melaporkan hitungan antrean/slot aktif per label, sehingga backlog `sync_reservation_state` dan `fulfill_successful_payment` bisa dibedakan. Pada rerun diagnostik resmi pertama sesudah perbaikan harness, correctness tetap hijau (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets) dengan summary `full_flow_duration p95 ~9.94s`, `http_req_duration p95 ~5.60s`, `step_reservation_duration p95 ~7.57s`, `step_order_duration p95 ~1.81s`, `step_payment_duration p95 ~2.73s`, dan `step_webhook_duration p95 ~1.65s`; cleanup kembali ke `0`. Log runner yang dihasilkan lengkap (`673` baris), memuat `50` sampel untuk masing-masing kategori `reservation`, `order`, `payment`, dan `paymentWebhook`, log `payment.background_task` kembali muncul, tidak ada orphan runner sesudah helper selesai, dan `pendingWaitUntilTasks` memuncak sekitar `910` setelah seluruh HTTP request selesai sebelum turun bertahap menjelang shutdown. Rerun resmi berikutnya sesudah sampling per label juga tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets) dengan summary `full_flow_duration p95 ~9.30s`, `http_req_duration p95 ~4.62s`, `step_reservation_duration p95 ~6.96s`, `step_order_duration p95 ~1.84s`, `step_payment_duration p95 ~2.86s`, dan `step_webhook_duration p95 ~2.02s`; cleanup kembali ke `0`. Diagnosis yang kini tervalidasi: backlog deferred payment bukan didorong oleh `confirmReservation()` yang mahal, melainkan oleh FIFO global shared queue. Sampel `sync_reservation_state` menunjukkan `runDurationMs` umumnya sangat kecil (sekitar `5-19ms`, hanya outlier awal sekitar `392ms`), tetapi task ini tetap mengalami `queueWaitDurationMs ~3.7-7.6s` karena menunggu antrean yang sama dengan `fulfill_successful_payment`. Sebaliknya, slot aktif queue mayoritas ditempati `fulfill_successful_payment` (`activeTasksForLabelAtStart` sering `6-8` dari total `8`) dengan `runDurationMs` tipikal sekitar `70-170ms` dan beberapa outlier ratusan milidetik sampai sekitar `889ms`. Eksperimen lanjutan untuk memecah concurrency queue menjadi jatah label (`sync_reservation_state` maksimal `2`, `fulfill_successful_payment` maksimal `6`) juga ditolak dan direvert. Validasi lokal penuh tetap correctness-green dan focused payment tests tetap lulus (`9/9`), tetapi helper resmi memburuk secara keseluruhan dibanding baseline sampling-per-label sebelumnya: `full_flow_duration p95` naik dari `~9.30s` ke `~10.48s`, `step_order_duration p95` dari `~1.84s` ke `~3.12s`, `step_payment_duration p95` dari `~2.86s` ke `~4.42s`, dan `step_webhook_duration p95` dari `~2.02s` ke `~2.78s`, meskipun `http_req_duration p95` turun ke `~4.23s` dan `step_reservation_duration p95` turun ke `~5.18s`. Secara queue, eksperimen itu memang menahan `fulfill_successful_payment` di `6` slot aktif dan menurunkan rentang antrean `sync_reservation_state` menjadi sekitar `~2.75-7.68s`, tetapi harga yang dibayar adalah antrean fulfillment melebar dari sekitar `~3.73-7.55s` menjadi `~3.97-13.10s` dan full-flow checkout tetap lebih buruk. Outcome saat ini: benchmark lokal dan helper profiling resmi sama-sama trustworthy lagi, belum ada optimisasi aplikasi retained baru setelah baseline observability ini, dan diagnosis terbaru mempersempit target berikutnya ke isolasi/background-work separation yang lebih mendasar daripada sekadar pembagian slot dalam satu FIFO shared queue. Eksperimen spekulatif level query, sync DO, atau fairness tweak kecil pada queue yang sama sebaiknya tetap dihentikan sampai perubahan berikutnya benar-benar memisahkan fulfillment workload dari jalur latency utama.
Latest note 2026-04-26: probe kecil berikutnya yang membuat collection timed step `order.createOrder` hanya aktif saat `LOAD_TEST_PROFILE=1` juga sudah diuji lalu direvert penuh. Focused `order.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`7/7`). Dua run no-profile helper yang sama tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets), tetapi hasilnya mixed dan tidak layak retain: run #1 `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~11.41s/6.02s/2.33s/2.14s/1.84s/1.24s`, run #2 `~12.44s/5.98s/1.79s/2.78s/2.48s/1.80s`. Walau reservation/order/downstream sempat lebih murah, `http_req_duration p95` regress repeatable ke sekitar `~6s`, jadi probe ini ditolak dan direvert; sesudah cleanup, dry-run kembali `0` dan suite guardrail lebar kembali `31/31`. Jangan ulang probe "no-profile timed-step gating" ini tanpa alasan teknis baru yang kuat.
Latest note 2026-04-26 (later): probe kecil berikutnya yang menyiapkan `reservation_lookup` `createOrder()` sebagai prepared query di dalam transaksi juga sudah diuji lalu direvert penuh. Focused `order.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`7/7`). Comparable helper `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32 --profile-services` tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets), tetapi aggregate regress ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~13.87s/6.77s/2.43s/3.56s/3.33s/2.28s`, dan artifact run itu lagi-lagi tidak memberi sampel `order.createOrder` untuk hotspot target. Probe ini ditolak dan direvert; sesudah cleanup, dry-run kembali `0` dan suite guardrail lebar kembali `31/31`. Jangan ulang probe "prepared reservation lookup in tx" ini tanpa alasan teknis baru yang kuat. Latest note 2026-04-26 (later still): probe kecil berikutnya yang memberi `createOrder()` pool DB terpisah via env gate lokal `ORDER_SERVICE_DB_MAX_CONNECTIONS=8` juga sudah diuji lalu direvert penuh. Focused `order.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`7/7`). Comparable helper `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32 --profile-services` tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets), tetapi justru membalik keras: `order.createOrder.transaction_queue_wait` melonjak ke sekitar `~8.8s`, `step_order p95` ke `~8.95s`, dan aggregate regress ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~18.26s/8.82s/2.83s/8.95s/270ms/460ms`. Payment/webhook memang jadi murah, tetapi antrean order hancur total, jadi probe ini ditolak dan direvert; sesudah cleanup, dry-run kembali `0` dan suite guardrail lebar kembali `31/31`. Jangan ulang probe "dedicated createOrder DB pool" ini tanpa alasan teknis baru yang kuat.
Latest note 2026-04-26 (latest): probe kecil berikutnya yang memberi `handleWebhook()` pool DB terpisah via env gate lokal `PAYMENT_WEBHOOK_DB_MAX_CONNECTIONS=8` juga sudah diuji lalu direvert penuh. Focused `payment.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`6/6`). Comparable helper `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32 --profile-services` tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets), tetapi webhook queue justru pecah: `payment.handleWebhook.transaction_queue_wait` naik ke sekitar `~3.5s`, `step_webhook p95` ke `~8.55s`, dan aggregate regress ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~17.56s/8.85s/1.57s/1.89s/1.08s/8.55s`. Reservation/order/payment memang sempat lebih murah, tetapi antrean webhook jadi bottleneck baru yang jauh lebih buruk, jadi probe ini ditolak dan direvert; sesudah cleanup, dry-run kembali `0` dan suite guardrail lebar kembali `31/31`. Jangan ulang probe "dedicated payment webhook DB pool" ini tanpa alasan teknis baru yang kuat.
Latest note 2026-04-26 (control pair): baseline retained sekarang juga sudah punya pair same-session segar untuk pembanding berikutnya. No-profile control `load-fullflow + --prewarm-reservation-connection + DO32` kembali correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets) dengan `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~11.25s/3.91s/2.69s/2.94s/2.69s/1.72s`. Profile control dengan helper yang sama juga correctness-green dengan `~15.22s/4.61s/4.50s/4.58s/3.60s/2.02s`; sampled `payment.handleWebhook.transaction_queue_wait` terlihat di kisaran sekitar `~228-388ms` pada potongan awal run. Cleanup sesudah pair ini kembali `0`. Gunakan pair baseline segar ini sebagai pembanding same-session berikutnya.
Latest note 2026-04-26 (latest): probe kecil berikutnya yang menambah backoff berjitter pendek sebelum retry `createOrder()` untuk collision `idx_orders_order_number` dan retryable DB error juga sudah diuji lalu direvert penuh. Focused `order.test.ts` + `order-number.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`9/9`). Comparable helper no-profile `load-fullflow + --prewarm-reservation-connection + DO32` tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets) dan memang memangkas downstream `step_reservation/step_order/step_payment/step_webhook` ke `~1.64s/1.94s/1.60s/1.37s`, tetapi `http_req_duration p95` justru melonjak keras ke `~6.33s` terhadap control same-session `~3.91s`, sehingga win-nya tidak bersih pada metrik utama end-user. Patch ditolak dan direvert; sesudah cleanup, dry-run kembali `0` dan suite guardrail lebar kembali `31/31`. Jangan ulang probe "createOrder retry backoff" ini tanpa alasan teknis baru yang kuat.
Latest note 2026-04-26 (observability): helper lokal retained sekarang juga memecah HTTP timing flow menjadi `setup_login_http_duration`, `checkout_http_duration`, `prewarm_http_duration`, `payment_http_duration`, dan `webhook_http_duration`. Probe validasi baseline tetap `500/500` correctness-green dengan `full_flow/http_req/checkout_http/prewarm_http/step_reservation/step_order/step_payment/step_webhook ~12.61s/3.46s/3.99s/6.78s/3.35s/3.44s/3.15s/1.62s`, yang menegaskan bahwa `http_req_duration` lokal bisa terdorong kuat oleh prewarm `/health`; evaluasi eksperimen downstream sekarang harus melihat `checkout_http_duration` dan metric step spesifik, bukan `http_req_duration` saja.
Latest note 2026-04-26 (recheck): family `createOrder retry backoff` sempat diuji ulang dengan metric baru dan tetap ditutup. Run #1 tampak menang (`full_flow/http_req/checkout_http/prewarm_http/step_reservation/step_order/step_payment/step_webhook ~10.99s/3.33s/3.36s/2.34s/2.74s/3.55s/2.85s/1.70s`), tetapi run konfirmasi #2 regress keras (`~13.71s/6.11s/6.14s/8.42s/1.41s/2.60s/2.37s/1.43s`). Jadi bahkan dengan breakdown prewarm-vs-checkout yang lebih baik, probe ini tetap tidak repeatable; patch direvert penuh, cleanup kembali `0`, dan suite guardrail lebar kembali `31/31`.
Latest note 2026-04-26 (business flow): helper retained sekarang juga mengekspor `checkout_business_flow_duration` dan `checkout_business_http_duration` untuk memisahkan jalur bisnis checkout pasca-prewarm dari metric flow total yang masih tercampur prewarm `/health`. Validasi no-profile baseline tetap `500/500` correctness-green dengan `full_flow/checkout_business_flow/http_req/checkout_http/checkout_business_http/prewarm_http/step_reservation/step_order/step_payment/step_webhook ~11.76s/5.18s/6.12s/6.56s/1.83s/8.77s/1.04s/1.96s/1.65s/1.22s`. Implikasi praktisnya: untuk eksperimen downstream berikutnya, pembanding utama sekarang harus `checkout_business_flow_duration`, `checkout_business_http_duration`, dan metric step spesifik; `http_req_duration` dan `full_flow_duration` diperlakukan sebagai context metric selama prewarm tetap aktif.

Catatan eksperimen 2026-04-17 berikutnya: memecah `fulfillSuccessfulPayment()` menjadi ticket issuance lebih dulu lalu menjadwalkan `post_payment_effects` sebagai deferred task terpisah juga ditolak dan sudah direvert. Focused payment tests tetap lulus (`9/9`) dan official helper tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets), tetapi helper resmi memburuk tajam ke `full_flow_duration p95 ~10.05s`, `http_req_duration p95 ~7.26s`, `step_reservation_duration p95 ~9.09s`, `step_order_duration p95 ~838ms`, `step_payment_duration p95 ~918ms`, dan `step_webhook_duration p95 ~823ms`. Sampling background-task menunjukkan label baru `post_payment_effects` hanya sempat tercatat `13` kali dengan `queueWaitDurationMs ~5.30-6.79s` dan `runDurationMs ~29-78ms`, sementara `fulfill_successful_payment` serta `sync_reservation_state` tetap menunggu hingga sekitar `~7.5s`; runtime snapshot juga memperlihatkan `pendingWaitUntilTasks` memuncak di atas `900` dan masih tersisa sekitar `367` saat shutdown helper. Kesimpulannya, pada runner lokal satu-proses, memecah post-payment effects ke task terpisah dalam scheduler yang sama hanya menambah backlog deferred work dan saturasi event loop, bukan memberi isolasi nyata terhadap jalur latency checkout.

Catatan eksperimen 2026-04-17 berikutnya lagi: memindahkan `post_payment_effects` ke consumer queue lokal proses-terpisah juga ditolak dan sudah direvert. Iterasi pertama memang memisahkan label tersebut dari scheduler payment utama, tetapi salah karena consumer mewarisi `DB_MAX_CONNECTIONS=52` dari runner dan membuat validasi pasca-run gagal dengan `too many clients already`; sesudah pool consumer dibatasi kecil dan rerun resmi dilakukan ulang, correctness kembali hijau (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets) tanpa orphan process dan tanpa error consumer. Namun win isolasi internal itu tetap tidak berubah menjadi win end-user: helper resmi masih lebih buruk dari baseline sampling-per-label sebelumnya, dengan `full_flow_duration p95 ~9.57s` (vs `~9.30s`), `http_req_duration p95 ~6.96s` (vs `~4.62s`), dan `step_reservation_duration p95 ~8.58s` (vs `~6.96s`), walaupun `step_order_duration p95 ~1.19s`, `step_payment_duration p95 ~1.07s`, dan `step_webhook_duration p95 ~877ms` membaik. Log menunjukkan `post_payment_effects` benar-benar hilang dari scheduler utama (`0` sampel label itu di `payment.background_task`), consumer menerima sekitar `500` enqueue dengan `68` batch proses, dan `pendingWaitUntilTasks` akhirnya turun sampai `0` saat shutdown; tetapi user-facing reservation/http tail justru memburuk. Kesimpulannya, bahkan isolasi yang lebih nyata lewat consumer lokal proses-terpisah tetap tidak layak dipertahankan untuk benchmark checkout lokal ini, karena biaya kontensi dan overlap baru yang muncul lebih besar daripada win downstream yang didapat.

Catatan eksperimen 2026-04-18: eksperimen non-fulfillment isolation untuk mengalihkan path profiling `reservation eligibility` di `apps/api/src/services/reservation.service.ts` ke prepared query hot path juga ditolak dan sudah direvert. Tujuan eksperimen ini adalah menurunkan reservation/http tail di helper resmi tanpa mengubah business logic. Focused payment/worker tests tetap hijau (`15/15`) dan helper resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets). Namun perbandingan helper sebelum/sesudah pada sesi ini menunjukkan tradeoff yang tidak acceptable: sebelum eksperimen `full_flow_duration p95 ~10.91s`, `http_req_duration p95 ~6.47s`, `step_reservation_duration p95 ~8.43s`, `step_order_duration p95 ~1.37s`, `step_payment_duration p95 ~2.00s`, `step_webhook_duration p95 ~1.31s`; sesudah eksperimen `full_flow_duration p95 ~11.62s`, `http_req_duration p95 ~4.88s`, `step_reservation_duration p95 ~6.29s`, `step_order_duration p95 ~2.52s`, `step_payment_duration p95 ~3.92s`, `step_webhook_duration p95 ~2.41s`. Walaupun reservation/http membaik, full-flow checkout dan downstream steps memburuk tajam, serta hasil tetap lebih buruk dari baseline helper trusted (`~9.30s` / `~4.62s`). Keputusan akhir: rejected + revert, baseline retained tidak berubah.

Catatan eksperimen 2026-04-18 berikutnya: rebalancing preset koneksi DB runner lokal ke jalur reservation (`load-reservation`, app DB `50`, ticket reserver DB `32`, background-task `8`) juga ditolak dan sudah direvert. Focused payment/worker tests tetap hijau (`15/15`) dan helper resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets). Namun hasil benchmark menunjukkan mismatch terhadap tujuan utama Task I: before (`load-balanced`) `full_flow_duration p95 ~13.8s`, `http_req_duration p95 ~7.04s`, `step_reservation_duration p95 ~8.10s`, `step_order_duration p95 ~2.50s`, `step_payment_duration p95 ~3.51s`, `step_webhook_duration p95 ~2.45s`; after (`load-reservation`) `full_flow_duration p95 ~11.49s`, `http_req_duration p95 ~7.29s`, `step_reservation_duration p95 ~9.44s`, `step_order_duration p95 ~1.81s`, `step_payment_duration p95 ~2.31s`, `step_webhook_duration p95 ~1.67s`. Walaupun downstream steps membaik, reservation/http tail justru memburuk, sehingga eksperimen ini diklasifikasikan regress untuk backlog ini dan tidak dipertahankan.

Catatan eksperimen 2026-04-18 lanjutan: perbandingan helper resmi head-to-head `load-balanced` vs `load-fullflow` (tanpa perubahan kode) menunjukkan sinyal positif untuk preset `load-fullflow`, tetapi belum dipromosikan sebagai baseline kanonis karena baru satu pasangan sampel. Guardrail tetap hijau (`15/15` focused tests; kedua run `500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets). Before (`load-balanced`) menghasilkan `full_flow_duration p95 ~12.19s`, `http_req_duration p95 ~4.60s`, `step_reservation_duration p95 ~6.53s`, `step_order_duration p95 ~3.17s`, `step_payment_duration p95 ~4.37s`, `step_webhook_duration p95 ~2.37s`; after (`load-fullflow`) menghasilkan `full_flow_duration p95 ~11.23s`, `http_req_duration p95 ~4.48s`, `step_reservation_duration p95 ~5.18s`, `step_order_duration p95 ~2.91s`, `step_payment_duration p95 ~4.18s`, `step_webhook_duration p95 ~2.23s`. Karena varians lokal masih tinggi dan keduanya tetap gagal threshold historis, keputusan saat ini adalah mencatat hasil sebagai candidate directional saja dan tetap memakai baseline helper kanonis yang ada sampai ada konfirmasi repeatability berpasangan minimal 2x di sesi bersih.

Catatan eksperimen 2026-04-18 repeatability berikutnya: pasangan run kedua `load-balanced` vs `load-fullflow` sudah dijalankan dengan helper resmi yang sama, dan hasilnya membatalkan sinyal directional pair pertama untuk metrik utama reservation/http. Correctness tetap hijau (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets). Pair kedua menghasilkan before (`load-balanced`) `full_flow_duration p95 ~11.73s`, `http_req_duration p95 ~4.44s`, `step_reservation_duration p95 ~6.96s`, `step_order_duration p95 ~2.94s`, `step_payment_duration p95 ~4.41s`, `step_webhook_duration p95 ~1.97s`; after (`load-fullflow`) `full_flow_duration p95 ~11.03s`, `http_req_duration p95 ~7.27s`, `step_reservation_duration p95 ~8.19s`, `step_order_duration p95 ~1.87s`, `step_payment_duration p95 ~2.81s`, `step_webhook_duration p95 ~1.91s`. Walaupun `full_flow` dan sebagian downstream membaik, `http_req_duration` serta `step_reservation_duration` memburuk tajam, sehingga perubahan baseline preset dinyatakan tidak repeatable dan tidak dipertahankan; baseline helper kanonis tetap.

Catatan eksperimen 2026-04-19 lanjutan: uji kandidat preset `load-baseline` (app DB `50`) melawan `load-balanced` (app DB `52`) juga tidak repeatable lintas pasangan run, jadi baseline preset tetap tidak diubah. Pair pertama (`load-balanced` -> `load-baseline`) correctness-green penuh (`500/500`) dan terlihat win kuat untuk reservation/http (`http_req_duration p95 ~7.75s -> ~4.44s`, `step_reservation_duration p95 ~9.59s -> ~5.01s`, `full_flow_duration p95 ~13.16s -> ~11.23s`) dengan tradeoff downstream (`step_order p95 ~1.86s -> ~2.52s`, `step_payment p95 ~2.81s -> ~3.92s`). Namun pair kedua dengan urutan dibalik (`load-baseline` -> `load-balanced`) juga correctness-green penuh tetapi hasil berbalik: run `load-baseline` memburuk (`full_flow_duration p95 ~15.31s`, `http_req_duration p95 ~7.88s`, `step_reservation_duration p95 ~8.49s`) lalu `load-balanced` menjadi lebih baik relatif (`full_flow_duration p95 ~13.18s`, `http_req_duration p95 ~5.71s`, `step_reservation_duration p95 ~6.60s`) meski downstream-nya ikut berat (`step_order p95 ~3.76s`, `step_payment p95 ~5.11s`, `step_webhook p95 ~3.70s`). Kesimpulan: ruang tuning preset lokal sangat volatil di setup satu-proses ini; sampai ada bukti repeatable yang konsisten untuk reservation/http, baseline helper kanonis tetap dipertahankan dan prioritas kembali ke hipotesis level service/DO/harness.

Catatan eksperimen 2026-04-19 berikutnya (code-level, retained): menambahkan cache verifikasi JWT bounded + TTL-aware di `apps/api/src/middleware/auth.ts` untuk mengurangi signature verify berulang pada token yang sama selama token masih valid. Guardrail correctness tetap hijau: focused payment/worker tests `15/15` lulus, dan semua helper run tetap `500/500` checkout sukses dengan `500` confirmed orders/tickets dan `500` issued tickets. Dibanding run `load-balanced` terakhir sebelum patch (`full_flow_duration p95 ~13.18s`, `http_req_duration p95 ~5.71s`, `step_reservation_duration p95 ~6.60s`, `step_order_duration p95 ~3.76s`, `step_payment_duration p95 ~5.11s`, `step_webhook_duration p95 ~3.70s`), dua sample after menunjukkan perbaikan konsisten: after #1 `full_flow_duration p95 ~10.79s`, `http_req_duration p95 ~4.35s`, `step_reservation_duration p95 ~5.00s`, `step_order_duration p95 ~2.61s`, `step_payment_duration p95 ~4.25s`, `step_webhook_duration p95 ~2.63s`; after #2 `full_flow_duration p95 ~11.42s`, `http_req_duration p95 ~3.97s`, `step_reservation_duration p95 ~4.80s`, `step_order_duration p95 ~2.34s`, `step_payment_duration p95 ~3.95s`, `step_webhook_duration p95 ~2.27s`. Keputusan: perubahan ini dipertahankan sebagai incremental win yang repeatable terhadap before terdekat, namun belum menutup gap target historis Task I.

Catatan eksperimen 2026-04-19 lanjutan: micro-optimasi parsing pathname request untuk profiling (`apps/api/src/lib/load-test-profile.ts` + pemakaian helper yang sama di logging `apps/api/src/middleware/auth.ts`) ditolak dan sudah direvert penuh. Guardrail correctness tetap hijau (`15/15` focused tests lulus; helper run tetap `500/500` checkout sukses dengan `500` confirmed orders/tickets dan `500` issued tickets), tetapi dua helper run konfirmasi menunjukkan regress konsisten pada metrik utama reservation/http dibanding baseline retained cache JWT. After #1 dengan patch aktif: `full_flow_duration p95 ~11.97s`, `http_req_duration p95 ~6.9s`, `step_reservation_duration p95 ~8.37s`, `step_order_duration p95 ~2.04s`, `step_payment_duration p95 ~3.13s`, `step_webhook_duration p95 ~2.14s`. After #2 (rerun konfirmasi): `full_flow_duration p95 ~10.69s`, `http_req_duration p95 ~5.5s`, `step_reservation_duration p95 ~8.1s`, `step_order_duration p95 ~2.04s`, `step_payment_duration p95 ~2.88s`, `step_webhook_duration p95 ~2.01s`. Dibanding rentang baseline retained sesudah cache JWT (`http_req_duration p95 ~3.97-4.35s`, `step_reservation_duration p95 ~4.80-5.00s`), patch ini diklasifikasikan regress untuk Task I dan tidak dipertahankan.

Catatan eksperimen 2026-04-19 berikutnya lagi: pair benchmark helper resmi pasca-revert fast-path (tanpa perubahan kode tambahan) selesai dengan correctness penuh (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets) namun tetap menunjukkan volatilitas reservation/http lintas run. Run #1 pasca-revert mencatat `full_flow_duration p95 ~10.83s`, `http_req_duration p95 ~4.16s`, `step_reservation_duration p95 ~6.85s`, `step_order_duration p95 ~2.85s`, `step_payment_duration p95 ~4.09s`, `step_webhook_duration p95 ~2.60s`. Run #2 konfirmasi mencatat `full_flow_duration p95 ~11.96s`, `http_req_duration p95 ~5.93s`, `step_reservation_duration p95 ~8.99s`, `step_order_duration p95 ~2.31s`, `step_payment_duration p95 ~3.40s`, `step_webhook_duration p95 ~2.38s`. Keputusan tetap: patch fast-path tetap rejected+reverted; baseline code retained tetap cache JWT, dan eksperimen lanjutan wajib dibandingkan via pasangan run karena varians lokal masih tinggi.

Catatan eksperimen 2026-04-20 (rejected, reverted): gate env `PAYMENT_WEBHOOK_SYNC_RESERVATION_INLINE=1` sempat ditambahkan di `apps/api/src/services/payment.service.ts` untuk menguji jalur webhook sukses yang meng-inline `confirmReservation()` (step `sync_reservation_state_inline`) sebagai alternatif dari jalur deferred `sync_reservation_state`. Pair run helper resmi pada sesi yang sama tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets), tetapi hasil tidak menunjukkan win reservation/http yang repeatable: baseline #1 (env off) `full_flow_duration p95 ~15.79s`, `http_req_duration p95 ~7.04s`, `step_reservation_duration p95 ~7.01s`; eksperimen #1 (env on) `~13.93s`, `~4.85s`, `~5.6s`; eksperimen #2 konfirmasi (env on) `~14.00s`, `~6.4s`, `~8.74s`; baseline #2 konfirmasi (env off) `~11.51s`, `~4.15s`, `~4.07s`. Karena baseline konfirmasi pada sesi yang sama justru lebih baik jelas di metrik utama, eksperimen diklasifikasikan regress/non-repeatable dan direvert penuh. Focused payment/worker tests pasca-revert tetap hijau (`15/15`). Catatan eksperimen 2026-04-20 terbaru (rejected, reverted): gate env `TICKET_RESERVER_INSERT_CONCURRENCY_LIMIT=8` sempat ditambahkan di `apps/api/src/durable-objects/ticket-reserver.ts` untuk membatasi concurrency persistence insert reservasi pada hot path DO. Focused validation suite yang diperluas (`ticket-reserver`, `reservation`, `order-reservation`, `payment`, `admin-order-payment`, `index-worker`, `queue-cleanup`) tetap hijau sebelum dan sesudah eksperimen (`30/30`). Namun pair helper resmi dengan gate aktif tetap menunjukkan regress kuat dan repeatable pada metrik utama reservation/http dibanding baseline sesi yang sama (`full_flow_duration p95 ~11.7s`, `http_req_duration p95 ~4.73s`, `step_reservation_duration p95 ~5.25s`): run #1 `~11.78s / ~7.53s / ~8.93s`, run #2 konfirmasi `~12.61s / ~7.51s / ~9.81s`. Analisis log menunjukkan bottleneck hanya berpindah dari `insert_reservation_pool_wait` ke `insert_reservation_scheduler_wait`, sehingga limiter app-side pada insert DO diklasifikasikan regress dan direvert penuh. Catatan eksperimen 2026-04-20 berikutnya lagi (rejected, reverted): gate env `TICKET_RESERVER_INSERT_BATCH_SIZE=25` sempat ditambahkan di `apps/api/src/durable-objects/ticket-reserver.ts` untuk menguji micro-batching insert persistence reservasi pada hot path DO. Focused validation suite tetap hijau sebelum eksperimen (`30/30`), saat gate aktif (`31/31` termasuk satu test eksperimen tambahan), dan pasca-revert (`30/30`), serta kedua helper run tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets). Namun hasil helper tidak memberi win repeatable pada metrik target dibanding baseline sesi yang sama (`full_flow_duration p95 ~11.87s`, `http_req_duration p95 ~4.67s`, `step_reservation_duration p95 ~4.65s`): run #1 `~11.37s / ~5.41s / ~5.73s`, run #2 konfirmasi `~11.49s / ~4.19s / ~7.41s`. Sampling log juga tidak menunjukkan `insert_reservation_batch_wait` yang berarti pada sampel, sementara `insert_reservation_pool_wait` tetap dominan; karena reservation p95 tidak membaik secara konsisten, eksperimen ini diklasifikasikan non-repeatable dan direvert penuh. Catatan eksperimen 2026-04-20 berikutnya sekali lagi (rejected, reverted): gate env `LOCAL_RUNNER_SHARE_TICKET_RESERVER_DB_POOL=1` sempat ditambahkan di `scripts/run-api-local.ts` untuk memaksa `TicketReserver` lokal berbagi app DB pool yang sama sebagai upaya menurunkan `insert_reservation_pool_wait` tanpa mengubah runtime produksi. Focused validation suite tetap hijau sebelum eksperimen dan pasca-revert (`30/30`). Namun dua helper run resmi dengan gate aktif tetap lebih buruk di metrik utama dibanding baseline retained/helper sesi terdekat: run #1 `full_flow/http_req/step_reservation ~13.97s/7.60s/7.86s`, run #2 konfirmasi `~12.09s/6.69s/7.08s`. Analisis runner log menunjukkan `insert_reservation_pool_wait` tetap dominan (`~1.28-2.55s` avg, `p90 ~3.83-4.09s`), `eligibility_pool_wait` juga membesar (`~1.0-1.3s` avg), dan antrean task background tetap panjang (`queueWaitDurationMs` naik sampai `~2.5-5.6s+`). Kesimpulan: shared pool hanya mendistribusikan contention ke pool bersama dan overlap downstream, bukan memberi win reservation/http, sehingga eksperimen direvert penuh. Catatan eksperimen 2026-04-20 terbaru sekali lagi (rejected, reverted): subquery `ownedTickets` pada `apps/api/src/services/reservation.service.ts` sempat diubah dari `orders -> order_items -> ticket_tiers` menjadi `orders -> reservations -> ticket_tiers` untuk mengurangi kerja eligibility query sambil tetap menghitung hanya order berstatus `confirmed`. Focused validation suite tetap hijau saat eksperimen aktif (`31/31`, termasuk satu regression test sementara `MAX_TICKETS_EXCEEDED`) dan pasca-revert (`30/30`), dan dua helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets). Namun pair helper tidak memberi win repeatable pada metrik utama dibanding baseline retained (`full_flow/http_req/step_reservation ~9.30s/4.62s/6.96s`): run #1 `~11.66s/7.37s/9.21s`, run #2 konfirmasi `~9.74s/5.73s/6.85s`. Analisis log menunjukkan `eligibility_query_execute` memang turun (`~106.9ms -> ~75.8ms` avg) dan `insert_reservation_execute` ikut sedikit membaik, tetapi `eligibility_pool_wait` tidak turun dan tail-nya justru melebar, `insert_reservation_pool_wait` membesar, dan wait background task tetap sekitar `~7.7s`. Kesimpulan: query CPU lebih ringan saja tidak cukup; contention pool tetap menjadi bottleneck dominan, sehingga eksperimen direvert penuh. Catatan eksperimen 2026-04-20 terbaru berikutnya (rejected, reverted): eligibility reservation penuh sempat dipindahkan dari `apps/api/src/services/reservation.service.ts` ke `apps/api/src/durable-objects/ticket-reserver.ts` agar query eligibility hilang dari app DB pool dan validasi sale-window/status memakai cache state tier/event di DO. Focused suite tetap hijau saat eksperimen aktif (`32/32`) dan pasca-revert (`31/31`, karena regression test permanen `MAX_TICKETS_EXCEEDED` tetap dipertahankan). Namun pair helper run resmi tetap regress dibanding baseline sesi yang sama (`full_flow/http_req/step_reservation ~11.93s/4.14s/6.86s`): run #1 `~12.74s/8.43s/9.04s`, run #2 konfirmasi `~12.21s/5.17s/5.91s`. Analisis log konfirmasi menunjukkan query eligibility memang hilang dari app service, tetapi `ticketReserver.reserve` kini membayar `eligibility_pool_wait ~1015ms` avg (`p95 ~1801ms`) sambil tetap membawa `insert_reservation_pool_wait ~1180ms` avg (`p95 ~1846ms`) pada hot path yang sama. Kesimpulan: contention tidak berkurang; ia hanya ditumpuk ke dalam DO bersama insert wait, sehingga eksperimen direvert penuh. Catatan eksperimen 2026-04-20 terbaru berikutnya lagi (rejected, reverted): eligibility reservation di `apps/api/src/services/reservation.service.ts` sempat dipecah menjadi static tier/event query + buyer-specific query, lalu field static di-cache lewat env gate bounded TTL untuk helper lokal resmi. Focused validation suite tetap hijau saat eksperimen aktif dan pasca-revert (`31/31`). Override manual TTL `5s` memberi hasil campuran (`full_flow/http_req/step_reservation ~13.46s/6.59s/7.20s` lalu `~11.09s/5.12s/5.75s`), lalu override manual TTL `60s` sempat memberi sinyal lebih baik (`~11.75s/4.62s/6.36s` lalu `~11.06s/5.55s/5.87s`). Namun setelah helper resmi `pnpm run test:load:checkout:local:profile` dipatch ke env yang sama, pair command resmi tetap tidak repeatable pada metrik utama (`~12.10s/8.21s/9.33s` lalu `~14.20s/5.91s/7.45s`), sehingga eksperimen ini diklasifikasikan ad hoc/non-repeatable dan direvert penuh.

Catatan eksperimen 2026-04-20 terbaru sekali lagi (rejected, reverted): sampled per-request runner profiling di `scripts/run-api-local.ts` sempat dipersempit dari semua kategori non-`other` menjadi `reservation` saja untuk menguji apakah overhead harness lintas kategori bisa turun, mengingat deep auth/rate-limit profiling memang sudah reservation-only. Dua helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets), tetapi pair-nya tidak memberi win repeatable: baseline fresh sesi ini `full_flow/http_req/step_reservation ~10.91s/6.12s/6.75s`, run eksperimen #1 `~12.60s/8.14s/10.19s`, run #2 konfirmasi `~13.02s/6.10s/6.86s`. Karena `full_flow` tetap memburuk, `step_order/payment/webhook` run kedua ikut melebar, dan pengurangan scope sampling saja tidak cukup memperbaiki metrik utama, patch harness direvert penuh.

Catatan eksperimen 2026-04-20 terbaru berikutnya (rejected, reverted): `packages/core/scripts/run-local-checkout-benchmark.ts` sempat diubah agar helper resmi `pnpm run test:load:checkout:local:profile` tidak lagi otomatis menyalakan `LOAD_TEST_PROFILE_PAYMENT_BACKGROUND`, sehingga profiling `payment.background_task` menjadi opt-in dan diharapkan mengurangi overhead observability default. Dua helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets), dan runner log default profile mode memang tidak lagi memuat entry `payment.background_task`. Namun hasil pair tetap lebih buruk dari baseline fresh sesi ini (`full_flow/http_req/step_reservation ~10.91s/6.12s/6.75s`): run eksperimen #1 `~11.72s/6.07s/8.26s`, run #2 konfirmasi `~12.80s/6.24s/7.52s`, sementara downstream (`step_payment`, `step_webhook`, dan sebagian `step_order`) juga melebar. Kesimpulan: overhead observability background payment bukan akar utama tail helper saat ini; patch helper direvert penuh.

Catatan eksperimen 2026-04-21 terbaru (rejected, reverted): jalur insert saat profiling di `apps/api/src/durable-objects/ticket-reserver.ts` sempat diselaraskan lagi agar mengeksekusi prepared insert hot path yang sama dengan jalur normal sambil tetap memakai query builder hanya untuk debug probe timing. Focused validation suite baseline tetap hijau (`31/31`), dan helper resmi pertama tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets). Namun dibanding baseline fresh sesi ini (`full_flow/http_req/step_reservation ~10.91s/6.12s/6.75s`), hasil helper tidak memberi win yang layak dipertahankan: `~11.48s/6.33s/6.75s`, dengan downstream `step_order/step_payment/step_webhook ~2.01s/3.05s/2.15s`. Karena `full_flow` jelas lebih buruk, `http_req` sedikit lebih buruk, dan `step_reservation` hanya setara baseline fresh sambil tetap jauh dari baseline trusted helper (`~9.30s/4.62s/6.96s`), eksperimen ini diklasifikasikan tidak layak retain dan direvert penuh tanpa run konfirmasi kedua.

Catatan eksperimen 2026-04-21 terbaru berikutnya (rejected, reverted): `generateTickets()` di `apps/api/src/services/ticket-generator.ts` sempat diubah agar flow payment/admin bisa melewati query akhir `tickets.findMany()` dan mapping hasil ketika caller hanya butuh side effect penerbitan tiket. Semua call site internal payment/admin dipindah ke mode itu. Focused validation suite tetap hijau (`31/31`), dan helper resmi pertama tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets). Namun dibanding baseline fresh sesi ini (`full_flow/http_req/step_reservation ~10.91s/6.12s/6.75s`), hasil helper justru regress ke `~12.12s/6.26s/8.86s`, dengan downstream `step_order/step_payment/step_webhook ~2.41s/3.46s/2.13s`. Karena `step_reservation` melonjak jauh, `http_req` tidak membaik, dan `full_flow` ikut memburuk, eksperimen ini diklasifikasikan tidak layak retain dan direvert penuh tanpa run konfirmasi kedua.

Catatan eksperimen 2026-04-21 terbaru berikutnya lagi (rejected, reverted): `apps/api/src/services/payment.service.ts` sempat mengubah `fulfillSuccessfulPayment()` agar `loadSuccessfulPaymentFulfillmentPayload()` dan `generateTickets()` berjalan paralel lewat `Promise.all(...)` sebelum `enqueuePostPaymentEffects()`. Focused validation suite tetap hijau (`31/31`), dan helper resmi pertama tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets), tetapi metrik utama tetap regress terhadap baseline helper trusted: `full_flow/http_req/step_reservation ~12.93s/4.73s/8.04s`, dengan downstream `~2.88s/4.26s/2.56s`. Analisis runner log menunjukkan queue wait `payment.background_task` memang turun ke sekitar `~6.3s` avg untuk kedua label dan runtime `fulfill_successful_payment` turun ke sekitar `~169ms` avg, tetapi `eligibility_pool_wait` naik ke sekitar `~1.01s` avg (`p95 ~2.29s`), sehingga contention berpindah kembali ke jalur reservation app-side. Karena user-facing metrik utama tetap lebih buruk, eksperimen ini direvert penuh tanpa run konfirmasi kedua.

Catatan eksperimen 2026-04-21 terbaru berikutnya sekali lagi (rejected, reverted): `loadSuccessfulPaymentFulfillmentPayload()` di `apps/api/src/services/payment.service.ts` sempat direwrite dari relational `database.query.orders.findFirst({ with: ... })` menjadi satu flat join query `orders -> users -> order_items -> ticket_tiers -> events -> seller_profiles` untuk mengurangi overhead lookup payload fulfillment tanpa menambah overlap baru di `fulfillSuccessfulPayment()`. Focused validation suite tetap hijau (`31/31`), dan helper resmi pertama tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets). Namun dibanding baseline helper trusted (`full_flow/http_req/step_reservation ~9.30s/4.62s/6.96s`), hasil helper tetap regress ke `~11.40s/5.87s/8.51s`, dengan downstream `step_order/step_payment/step_webhook ~2.29s/3.31s/2.04s`. Analisis runner log menunjukkan queue wait `payment.background_task` masih sekitar `~6.56-6.58s` avg (`p95 ~10.25-10.26s`), `reservation.reserve` tetap tinggi (`~1763ms` avg), dan `insert_reservation_pool_wait` justru membesar ke sekitar `~629ms` avg (`p95 ~1.69s`). Karena pengurangan nesting query di fulfillment ini tetap tidak memperbaiki reservation/http tail dan sinyal helper pertama sudah negatif, eksperimen direvert penuh tanpa run konfirmasi kedua.

Catatan eksperimen 2026-04-21 terbaru terakhir (rejected, reverted): dua notifikasi post-payment di `apps/api/src/services/payment.service.ts` + `apps/api/src/services/notification.service.ts` sempat dibatch menjadi satu insert DB, lalu `sendEmail()` hanya dijalankan jika `EMAIL_API_KEY` dan `EMAIL_FROM` benar-benar tersedia. Tujuannya mengurangi kerja serial kecil di `enqueuePostPaymentEffects()` tanpa menambah overlap DB baru. Focused validation suite tetap hijau (`31/31`), dan dua helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets). Run #1 memberi `full_flow/http_req/step_reservation ~10.36s/6.48s/7.16s` dengan downstream `~1.31s/1.80s/1.19s`; log run #1 juga menunjukkan `reservation.reserve ~935ms` avg, `eligibility_pool_wait ~485ms` avg, dan `insert_reservation_pool_wait ~203ms` avg. Namun run #2 konfirmasi bergeser ke `~12.57s/5.59s/6.13s` dengan downstream `~2.75s/4.12s/1.73s`, sehingga pair helper tidak repeatable pada metrik utama dan tetap gagal mengalahkan baseline helper trusted (`~9.30s/4.62s/6.96s`). Karena win user-facing tidak konsisten, eksperimen direvert penuh.

Catatan diagnosis 2026-04-21 terbaru: analisis lanjutan terhadap log run #1 eksperimen batch-notification menunjukkan tail utama helper saat ini bukan lagi jalur `reservation.reserve` itu sendiri. Untuk reservation sample pada log `/tmp/jeevatix-local-checkout-profile-1776756946070.log`, `localRunner.request client_send_to_handler` mencapai sekitar `~3611ms` avg (`p95 ~5583ms`), sedangkan `app_fetch`, `rateLimit.middleware`, `reservation.route.create`, dan `reservation.reserve` semuanya hanya sekitar `~935-948ms` avg (`p95 ~1658-1677ms`). Step internal rate limit sendiri negligible (`key_generator` dan `consume_in_memory_bucket` sekitar `~0.02ms`). Sample reservation terlambat juga mulai ketika order/payment sudah overlap cukup besar (`34-48` order dan `60-80` payment in-flight). Kesimpulan kerja terbaru: sebelum mencoba micro-optimasi fulfillment atau query service lain, eksperimen berikutnya harus mengukur atau mengurangi gap pre-handler / overlap kategori request pada runner lokal.

Catatan diagnosis 2026-04-21 terbaru berikutnya: `scripts/run-api-local.ts` sekarang retained dengan observability low-overhead tambahan untuk sampled request berupa `pre_accept_gap`, `seenByCategoryAtStart`, dan `pendingWaitUntilTasksAtStart`. Satu helper resmi diagnostik baru tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets) tetapi metrik user-facing run itu memburuk ke `full_flow/http_req/step_reservation ~12.08s/8.06s/10.23s`, sehingga data ini dipakai murni sebagai diagnosis, bukan kandidat baseline performa baru. Analisis reservation sample pada log `/tmp/jeevatix-local-checkout-profile-1776758761777.log` menunjukkan `localRunner.request pre_accept_gap ~5247ms` avg (`p95 ~9216ms`), `client_send_to_handler ~5282ms` avg (`p95 ~9226ms`), `socket_accept_to_handler ~35ms` avg (`p95 ~75ms`), dan `app_fetch ~540ms` avg (`p95 ~1107ms`). Bucket sample memperlihatkan gap ini tumbuh seiring overlap: early reservation `pre_accept_gap ~888ms` avg dengan `pendingWaitUntilTasksAtStart ~0`, middle `~4656ms` dengan `~174` pending tasks, late `~8018ms` dengan `~483` pending tasks dan overlap order/payment jauh lebih besar. Kesimpulan kerja terbaru: bottleneck helper saat ini terutama berada pada admission/overlap runner sebelum socket diterima, bukan pada hot path `reservation.reserve` atau middleware reservation.

Catatan eksperimen 2026-04-21 terbaru berikutnya lagi (rejected, reverted): `scripts/run-api-local.ts` sempat diberi gate env `LOCAL_RUNNER_MAX_RESERVATION_OVERLAP=8` untuk menolak reservation baru ketika overlap in-flight sudah mencapai `8`, dengan tujuan menguji apakah tail `pre_accept_gap` bisa dipersempit di admission paling awal. Eksperimen dijalankan ulang lewat helper resmi `pnpm run test:load:checkout:local:profile` agar target tier tetap UUID hasil helper, bukan skenario ad hoc. Hasilnya langsung tidak layak dipertahankan karena correctness runtuh: hanya `44/500` checkout sukses, `456` flow gagal, dan validasi DB berakhir di `44` confirmed orders/tickets. Metrik yang tersisa memang tampak pendek (`full_flow_duration p95 ~2.52s`, `http_req_duration p95 ~1.56s`, `step_reservation_duration p95 ~1.56s`), tetapi runner log `/tmp/jeevatix-local-checkout-profile-1776761690530.log` memuat `456` entry `localRunner.request.reject` dengan `reason=max_reservation_overlap`, sehingga tail turun hanya karena mayoritas request dipotong `503 RESERVATION_OVERLAP_LIMIT`. Sampel reservation yang lolos memang menunjukkan `pre_accept_gap` lebih rendah (sekitar `~371ms`, `~543ms`, `~822ms`, lalu `~1132ms` saat overlap mulai naik), tetapi tradeoff correctness/throughput ini tidak acceptable. Kesimpulan: hard reject gate di admission runner bukan arah yang valid; eksperimen direvert penuh dan hipotesis runner berikutnya harus memakai queue atau measurement, bukan penolakan request.

Catatan eksperimen 2026-04-22 terbaru (rejected, reverted): `scripts/run-api-local.ts` sempat diberi gate env `LOCAL_RUNNER_RESERVATION_ADMISSION_CONCURRENCY=64` untuk menguji admission queue FIFO non-reject pada request `reservation`. Kontrol sesi-bersih pada helper resmi tanpa gate tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets) dengan `full_flow_duration p95 ~13.61s`, `http_req_duration p95 ~5.73s`, `step_reservation_duration p95 ~7.56s`, `step_order_duration p95 ~2.10s`, `step_payment_duration p95 ~2.98s`, dan `step_webhook_duration p95 ~2.13s`. Run eksperimen dengan gate aktif juga tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets), dan memang memperbaiki downstream/full-flow ke `full_flow_duration p95 ~10.35s`, `step_order_duration p95 ~1.59s`, `step_payment_duration p95 ~2.30s`, `step_webhook_duration p95 ~1.41s`. Namun dua metrik utama backlog ini justru memburuk menjadi `http_req_duration p95 ~6.66s` dan `step_reservation_duration p95 ~8.34s`. Runner log pembanding menunjukkan delay hanya berpindah tempat: pada control, reservation sample masih didominasi `client_send_to_handler ~2291ms` avg / `p95 ~6386ms`, `pre_accept_gap ~2151ms` avg / `p95 ~6362ms`, dan `app_fetch ~1711ms` avg / `p95 ~2240ms`; pada eksperimen, `client_send_to_handler` turun ke `~634ms` avg / `p95 ~1064ms`, `pre_accept_gap` turun ke `~509ms` avg / `p95 ~1063ms`, dan `app_fetch` turun ke `~1088ms` avg / `p95 ~1517ms`, tetapi muncul `reservation_admission_queue_wait ~3164ms` avg / `p95 ~6241ms` dengan queue depth max sekitar `433` (runtime max `382`). Kesimpulan: admission queue non-reject ini tidak mengurangi tail user-facing; ia hanya memindahkan `pre_accept_gap` ke antrean internal runner. Eksperimen direvert penuh, dan hipotesis runner berikutnya harus menurunkan total reservation/http tail, bukan sekadar memindahkan lokasi wait.

Catatan eksperimen 2026-04-22 terbaru berikutnya (rejected, reverted): `apps/api/src/services/payment.service.ts` sempat diberi gate env `LOCAL_RUNNER_DEFER_PAYMENT_BACKGROUND_START=1` untuk menunda start `waitUntil` payment background task satu macrotask, dengan hipotesis bahwa jalur webhook/payment yang langsung hidup di event loop runner lokal ikut memperlebar `pre_accept_gap` reservation. Focused payment tests tetap hijau sebelum dan sesudah revert (`9/9`). Pair helper resmi pada sesi yang sama juga tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets), tetapi hasil user-facing tetap tidak layak dipertahankan: control tanpa gate memberi `full_flow_duration p95 ~12.42s`, `http_req_duration p95 ~8.31s`, `step_reservation_duration p95 ~10.23s`, `step_order_duration p95 ~1.56s`, `step_payment_duration p95 ~1.96s`, dan `step_webhook_duration p95 ~1.45s`; eksperimen dengan gate aktif memperbaiki dua metrik target menjadi `http_req_duration p95 ~6.39s` dan `step_reservation_duration p95 ~7.20s`, tetapi `full_flow_duration p95` justru memburuk ke `~13.49s` dengan downstream `step_order/step_payment/step_webhook ~2.83s/4.08s/2.49s`. Runner log membenarkan hipotesis runner-level hanya sebagian: `client_send_to_handler` turun dari `~4594ms` avg / `p95 ~9624ms` ke `~1039ms` / `~1912ms`, dan `pre_accept_gap` turun dari `~4541ms` / `~9564ms` ke `~916ms` / `~1907ms`. Namun biaya tidak hilang; ia berpindah ke jalur reservation app/DO sendiri. Sample reservation menunjukkan `app_fetch` naik dari `~898ms` avg / `p95 ~1533ms` ke `~4319ms` / `~5316ms`, `reservation.route.create` dari `~887ms` ke `~4294ms`, `durable_object_reserve` dari `~269ms` ke `~3882ms`, dan `ticketReserver.insert_reservation_pool_wait` melonjak dari `~126ms` ke `~3518ms` sementara `insert_reservation_execute` hanya naik ke sekitar `~304ms`. Queue wait `payment.background_task` memang sedikit turun (`~11.6s` avg -> `~8.85s`), tetapi tradeoff akhirnya adalah contention reservation pindah dari admission runner ke hot path DO/database. Kesimpulan: menunda kickoff payment background task di runner lokal bukan win retained; ia hanya memindahkan contention ke `insert_reservation_pool_wait` dan memperburuk `full_flow`, sehingga eksperimen direvert penuh.

Catatan eksperimen 2026-04-22 terbaru berikutnya lagi (rejected, reverted): `scripts/run-api-local.ts` sempat diberi gate env `LOCAL_RUNNER_CLOSE_NON_RESERVATION_CONNECTIONS=1` untuk memaksa response `order`, `payment`, dan `paymentWebhook` menutup koneksi (`Connection: close`) setelah response, dengan hipotesis bahwa keep-alive downstream sedang menahan accept backlog reservation dan memperlebar `pre_accept_gap`. Pair helper resmi pada sesi yang sama tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets), tetapi hasilnya regress jelas: control tanpa gate memberi `full_flow_duration p95 ~10.16s`, `http_req_duration p95 ~4.73s`, `step_reservation_duration p95 ~5.66s`, `step_order_duration p95 ~1.76s`, `step_payment_duration p95 ~2.68s`, dan `step_webhook_duration p95 ~1.56s`; eksperimen dengan gate aktif memburuk ke `~14.00s / ~5.63s / ~6.30s / ~3.49s / ~5.26s / ~4.20s`. Runner log menunjukkan accept-side delay memang turun: reservation `client_send_to_handler` dari `~2511ms` avg / `p95 ~4137ms` ke `~1189ms` / `~1740ms`, dan `pre_accept_gap` dari `~2485ms` / `~4136ms` ke `~1158ms` / `~1738ms`. Namun `activeSockets` max tidak berubah (`506` pada dua run), `pendingWaitUntilTasks` juga tetap setara (`~956` vs `~960`), dan biaya langsung berpindah ke jalur reservation sendiri: reservation `app_fetch` naik dari `~1217ms` avg / `p95 ~1686ms` ke `~3062ms` / `~4582ms`; `reservation.route.create` dari `~1212ms` / `~1683ms` ke `~3053ms` / `~4580ms`; `durable_object_reserve` dari `~430ms` / `~840ms` ke `~2019ms` / `~3264ms`; dan `ticketReserver.insert_reservation_pool_wait` melonjak dari `~261ms` / `~731ms` ke `~1738ms` / `~2985ms`. Downstream sampled totals ikut memburuk (`order ~1361ms/1669ms -> ~2174ms/3448ms`, `payment ~2018ms/2643ms -> ~2934ms/4495ms`, `paymentWebhook ~1246ms/1539ms -> ~1983ms/3736ms`). Kesimpulan: memaksa close pada koneksi non-reservation memang memotong accept-side delay, tetapi tidak mengurangi tail end-user; ia hanya mendorong contention lebih dalam ke hot path reservation/DO dan memperburuk semua step sesudahnya. Eksperimen direvert penuh.

Catatan diagnosis 2026-04-22 terbaru: `scripts/run-api-local.ts` sekarang retained dengan observability tambahan `socketSequence`, `socketRequestSequence`, dan `reusedSocketAtStart` pada sampled request untuk membedakan fresh socket vs reused socket per kategori. Satu helper resmi diagnostik setelah perubahan ini tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets) dengan `full_flow_duration p95 ~12.93s`, `http_req_duration p95 ~5.54s`, `step_reservation_duration p95 ~6.60s`, `step_order_duration p95 ~3.39s`, `step_payment_duration p95 ~4.78s`, dan `step_webhook_duration p95 ~2.62s`; data ini dipakai sebagai diagnosis, bukan baseline performa baru. Analisis log menunjukkan pola yang sekarang paling penting untuk hipotesis berikutnya: sampled request `reservation` tidak pernah reuse socket (`50/50` sample, `reusedSocketAtStart=false`, `socketRequestSequence=1`), sedangkan sampled `order`, `payment`, dan `paymentWebhook` reuse socket `100%` dengan rata-rata `socketRequestSequence` sekitar `2`, `3`, dan `4`. Pada reservation sendiri, bucket early/middle/late menunjukkan `pre_accept_gap` naik dari sekitar `~259ms` ke `~1692ms` lalu `~2582ms`, sementara `client_send_to_handler` naik dari `~401ms` ke `~1704ms` lalu `~2600ms`, tetapi reuse socket tetap `0%` di semua bucket. Kesimpulan kerja terbaru: tail reservation helper lokal saat ini lebih konsisten dengan fresh-socket flood / accept backlog untuk reservation baru, bukan dengan reservation yang menunggu di socket reused jangka panjang.

Catatan eksperimen 2026-04-22 terbaru lagi (rejected, reverted): `scripts/run-api-local.ts` sempat diberi gate env `LOCAL_RUNNER_LISTEN_BACKLOG=2048` untuk memaksa Node HTTP server listen dengan backlog eksplisit yang lebih besar, dengan hipotesis bahwa reservation tail sedang menabrak backlog listen implisit saat 500 fresh socket masuk serempak. Helper resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets), tetapi hasilnya tidak membantu: startup log memang mengonfirmasi backlog `2048`, namun `full_flow_duration/http_req_duration/step_reservation_duration p95` bergerak ke `~10.90s/~5.42s/~7.09s`, dan analisis sampled reservation memperlihatkan `client_send_to_handler` naik dari `~1609ms` avg / `~3315ms` p95 ke `~2198ms` / `~5638ms`, `pre_accept_gap` dari `~1554ms` / `~3314ms` ke `~2034ms` / `~5619ms`, serta `socket_accept_to_handler` dari `~56ms` / `~218ms` ke `~164ms` / `~576ms`. Memang ada sedikit perbaikan di `app_fetch` dan `reservation.route.create`, tetapi win itu tertelan penuh oleh front-side socket delay yang membesar. Snapshot runtime juga menunjukkan acceptance lebih agresif di awal (`acceptedSockets` lebih tinggi pada snapshot awal) sambil event loop tetap pinned di `100%`, sehingga backlog lebih besar hanya mempercepat masuknya socket ke loop yang memang sudah jenuh. Eksperimen direvert penuh.

Catatan eksperimen 2026-04-22 terbaru berikutnya (rejected, reverted): `scripts/run-api-local.ts` sempat diubah untuk menulis response body secara streaming (`Readable.fromWeb` + `pipeline`) alih-alih mem-buffer `response.arrayBuffer()` penuh sebelum `nodeResponse.end()`, dengan hipotesis bahwa buffer response sinkron di runner sedang menahan event loop dan memperlebar accept tail reservation. Satu helper resmi sesudah patch ini tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets), tetapi regress sangat jelas: `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook p95` memburuk ke `~17.57s/7.08s/7.71s/4.46s/6.55s/4.07s`. Analisis sampled request memperlihatkan kenaikan `write_response` sendiri nyaris nol (masih sub-milidetik), sedangkan `totalDurationMs` semua kategori melebar besar (`reservation ~2149ms -> ~4778ms`, `payment ~3626ms -> ~4912ms`, `paymentWebhook ~1653ms -> ~2142ms` avg). Kesimpulan: streaming response runner tidak menyelesaikan bottleneck write path lokal; ia justru memperlebar latency lintas kategori lewat jalur lain. Eksperimen direvert penuh.

Catatan diagnosis 2026-04-22 terbaru retained: `tests/load/checkout-flow.js` sekarang memiliki gate env lokal `PREWARM_RESERVATION_CONNECTION=1` yang melakukan `GET /health` per VU tepat sebelum reservation untuk diagnosis fresh-vs-reused socket. Satu helper resmi dengan gate ini tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets) dan memberi sinyal paling kuat sejauh ini: `full_flow_duration/http_req_duration/step_reservation_duration p95` membaik ke `~11.25s/~3.49s/~3.60s`, sementara sampled reservation berubah dari `0%` reused socket menjadi `100%`, `socketRequestSequence` dari `1` ke `2`, `client_send_to_handler` dari `~1609ms` avg / `~3315ms` p95 ke `~73ms` / `~197ms`, dan `pre_accept_gap` hilang (`~1554ms/~3314ms -> 0/0`). Cost internal reservation memang naik pada run ini (`durable_object_reserve` dan pool wait membesar), tetapi pola lama “fresh socket admission delay” terbukti sangat material: begitu reservation bukan lagi first request pada socket baru, tail reservation/http turun besar tanpa perlu close-connection hack. Gate ini retained untuk diagnosis lokal, bukan untuk baseline helper resmi, dan implikasi kerjanya jelas: hipotesis berikutnya harus menarget cara mengurangi biaya first-request/fresh-socket admission untuk reservation, bukan downstream keep-alive reuse yang sudah terbukti bukan lapisan utamanya.

Catatan diagnosis 2026-04-22 terbaru berikutnya: `tests/load/checkout-flow.js` juga sempat diberi gate env lokal `PRE_RESERVATION_VU_JITTER_MS` untuk menyebar start reservation secara deterministik per VU tanpa melakukan prewarm koneksi, dengan tujuan mengecek apakah win `PREWARM_RESERVATION_CONNECTION=1` sebenarnya hanya berasal dari burst spreading, bukan reuse socket. Helper resmi dengan `PRE_RESERVATION_VU_JITTER_MS=250` tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets), tetapi hasilnya justru regress ke `full_flow_duration/http_req_duration/step_reservation_duration p95 ~13.56s/~6.71s/~7.98s`. Analisis sampled reservation menunjukkan gate ini tidak mengubah lapisan socket sama sekali: reservation tetap `0%` reused socket dengan `socketRequestSequence=1`, `client_send_to_handler` tetap tinggi (`~1645ms` avg / `~2392ms` p95), `pre_accept_gap` juga tetap tinggi (`~1622ms` / `~2390ms`), sementara `app_fetch` malah memburuk tajam (`~3795ms` avg / `~5656ms` p95). Kesimpulan kerja yang sekarang lebih kuat: burst spreading saja tidak menjelaskan win prewarm; faktor dominannya tetap first-request pada fresh socket, bukan sekadar reservasi datang sedikit lebih tersebar.

Catatan diagnosis/helper retained 2026-04-22 terbaru: `packages/core/scripts/run-local-checkout-benchmark.ts` sekarang punya flag/helper mode resmi `--prewarm-reservation-connection` (atau env `LOCAL_CHECKOUT_PREWARM_RESERVATION_CONNECTION=1`) yang meneruskan `PREWARM_RESERVATION_CONNECTION=1` ke skenario load tanpa mengubah baseline default. Helper juga sekarang menambahkan `reservationHttpBlockedP95` dan `reservationHttpConnectingP95` ke `[local-checkout-summary]`, sehingga diagnosa transport tidak lagi perlu menggali file output mentah manual. Validasi helper dengan flag baru tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets) dan summary langsung menunjukkan `stepReservationP95 ~3.08s`, `reservationHttpBlockedP95 ~17.85µs`, dan `reservationHttpConnectingP95 0s` pada run prewarm.

Diagnosis refined 2026-04-22 dari pair helper control vs prewarm yang sekarang paling penting: biaya “fresh socket first request” pada helper lokal bukan didominasi raw TCP connect K6, melainkan antrian sebelum request diterima runner/app. Pada pair sesi yang sama, control mencatat `reservation_http_connecting ~52ms` avg / `~222ms` p95 dan `reservation_http_blocked ~56ms` / `~225ms`, sedangkan runner sampled reservation menunjukkan `pre_accept_gap ~1251ms` avg / `~2660ms` p95, `client_send_to_handler ~1315ms` / `~2663ms`, dan `app_fetch ~4347ms` / `~5521ms`. Ketika prewarm aktif, `reservation_http_connecting` turun ke `0`, `reservation_http_blocked` ke mikrodetik, sampled reservation berubah menjadi `100%` reused socket, `pre_accept_gap` hilang (`0/0`), `client_send_to_handler` turun ke `~57ms` avg / `~159ms` p95, dan `app_fetch` ikut turun ke `~1685ms` / `~2177ms`. Implikasi kerja terbaru: transport-side fresh socket penalty memang nyata, tetapi komponen raw connect client hanya sebagian kecil; dominan lokalnya tetap pre-accept/admission overlap sebelum handler dan efek overlap yang ditimbulkannya pada hot path reservation.

Catatan diagnosis 2026-04-22 terbaru lagi: perbandingan preset runner lokal `load-balanced` vs `load-fullflow` kini juga diuji ulang khusus dalam mode helper prewarm (`--prewarm-reservation-connection`) untuk menghilangkan noise fresh-socket admission sebelum menilai bottleneck app/DO. Berbeda dari head-to-head preset tanpa prewarm yang sebelumnya volatil, dua pair sesi ini menunjukkan sinyal yang konsisten bahwa `load-fullflow` lebih baik daripada `load-balanced` untuk slice prewarm: pair pertama memberi `full_flow/http_req/step_reservation p95 ~13.61s/3.67s/3.80s` (`load-balanced`) vs `~11.46s/4.99s/2.30s` (`load-fullflow`), dan runner log menunjukkan `app_fetch ~2944ms -> ~1572ms`, `durable_object_reserve ~2374ms -> ~779ms`, serta `ticketReserver.insert_reservation_pool_wait ~2085ms -> ~568ms`, walau `eligibility_pool_wait` naik (`~410ms -> ~677ms`). Pair konfirmasi dengan urutan dibalik juga tetap menguntungkan `load-fullflow`: `full_flow/http_req/step_reservation p95 ~16.11s/6.68s/7.20s` (`load-balanced`) vs `~11.46s/3.77s/4.06s` (`load-fullflow`), dan sampled reservation menunjukkan `ticketReserver.insert_reservation_pool_wait ~3473ms -> ~1459ms` avg. Kesimpulan kerja terbaru: setelah transport fresh-socket penalty diangkat, bottleneck utama reservation memang lebih responsif terhadap app/DO pool shape, dan preset `load-fullflow` sekarang menjadi kontrol prewarm yang lebih masuk akal untuk eksperimen app/DO berikutnya daripada `load-balanced`.

Catatan eksperimen/helper retained 2026-04-22 terbaru berikutnya: `scripts/run-api-local.ts` sekarang mendukung override env lokal eksplisit `LOCAL_RUNNER_OVERRIDE_DB_MAX_CONNECTIONS`, `LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS`, dan `LOCAL_RUNNER_OVERRIDE_PAYMENT_BACKGROUND_TASK_CONCURRENCY` yang mengalahkan preset runner hanya ketika benar-benar diset. Default preset tidak berubah. Tujuan utamanya untuk memungkinkan eksperimen pool lokal terisolasi tanpa menambah preset sementara atau mengubah baseline permanen.

Catatan eksperimen 2026-04-22 terbaru berikutnya lagi (retained, local-only diagnostic baseline candidate untuk eksperimen app/DO): dengan helper prewarm + preset `load-fullflow`, menaikkan `TICKET_RESERVER_DB_MAX_CONNECTIONS` dari `25` ke `32` via `LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32` kini menunjukkan win yang jauh lebih repeatable daripada eksperimen bump DO pool lama pada `load-balanced`. Run pertama terhadap `load-fullflow` plain terdekat memberi `step_reservation p95 ~2.34s` vs `~4.06s`, dengan runner sampled reservation `app_fetch ~1757ms` vs `~2845ms`, `durable_object_reserve ~470ms` vs `~1748ms`, dan `ticketReserver.insert_reservation_pool_wait ~322ms` vs `~1459ms`; tradeoff-nya `eligibility_pool_wait` naik sedikit (`~1086ms` vs `~897ms`). Pair konfirmasi kedua juga tetap memenangkan mode `DO32`: `full_flow/http_req/step_reservation p95 ~11.66s/4.10s/2.31s` (`DO32`) vs `~12.08s/4.26s/2.88s` (`plain`), sampled reservation `app_fetch ~1551ms` vs `~1910ms`, `durable_object_reserve ~559ms` vs `~911ms`, `ticketReserver.insert_reservation_pool_wait ~376ms` vs `~666ms`, dan downstream sampled avg `~1564ms` vs `~1873ms`. Karena sinyal ini sekarang muncul lagi pada pair konfirmasi, arah berikutnya yang paling masuk akal adalah memakai kontrol `load-fullflow + prewarm`, lalu memperlakukan `LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32` sebagai kandidat baseline lokal untuk eksperimen app/DO lanjutan, sambil tetap berhati-hati bahwa hasil ini baru tervalidasi di mode prewarm dan bukan baseline helper kanonis default.

Catatan probe 2026-04-22 terbaru: sesudah kontrol `load-fullflow + prewarm + DO32` terlihat stabil, satu bump kecil app DB pool lewat `LOCAL_RUNNER_OVERRIDE_DB_MAX_CONNECTIONS=58` diuji di atas kontrol yang sama untuk mengecek apakah bottleneck berikutnya benar-benar app-side `eligibility_pool_wait`. Run tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets), tetapi hasilnya tidak mengalahkan kontrol `DO32` terdekat: `full_flow/http_req/step_reservation p95 ~12.28s/5.02s/2.60s` vs `~11.66s/4.10s/2.31s`, sampled reservation `app_fetch ~1678ms` vs `~1551ms`, `eligibility_pool_wait ~908ms` vs `~824ms`, `durable_object_reserve ~621ms` vs `~559ms`, dan downstream sampled avg `~1724ms` vs `~1564ms`. `ticketReserver.insert_reservation_pool_wait` hanya nyaris datar (`~388ms` vs `~376ms`) sehingga tambahan app DB pool ini tidak memberi win bersih. Kesimpulan kerja terbaru: sesudah `load-fullflow + prewarm + DO32`, menaikkan app DB pool lagi bukan kandidat langkah berikutnya yang menjanjikan.

Catatan eksperimen 2026-04-22 terbaru lagi (rejected, reverted): `apps/api/src/services/reservation.service.ts` sempat diberi gate env lokal `RESERVATION_ELIGIBILITY_DB_MAX_CONNECTIONS` untuk memaksa query eligibility reservation memakai pool app DB terpisah dari pool app umum, dengan hipotesis bahwa `eligibility_pool_wait` di kontrol `load-fullflow + prewarm + DO32` berasal dari antrean query app lain dan bisa dipotong tanpa menyentuh flow lain. Eksperimen pertama dengan `RESERVATION_ELIGIBILITY_DB_MAX_CONNECTIONS=8` memang terlihat menang pada satu pair (`step_reservation p95 ~3.07s` vs kontrol terdekat `~3.22s`, sampled `app_fetch ~1321ms` vs `~2382ms`, `durable_object_reserve ~390ms` vs `~1367ms`, `ticketReserver.insert_reservation_pool_wait ~180ms` vs `~1136ms`), tetapi pair konfirmasi dengan urutan dibalik membuktikan cost shift besar: reservation hanya membaik tipis (`~2.69s` vs `~2.80s`) sementara sampled `durable_object_reserve` melonjak (`~1726ms` vs `~826ms`), `ticketReserver.insert_reservation_pool_wait` membesar (`~1425ms` vs `~611ms`), dan downstream `order/payment/webhook` sampled ikut regress keras. Probe lanjutan dengan `RESERVATION_ELIGIBILITY_DB_MAX_CONNECTIONS=4` malah jelas buruk: `step_reservation p95 ~4.42s`, `eligibility_pool_wait ~2206ms` avg, dan reservation path keseluruhan kalah dari kontrol `DO32`. Karena slice ini tidak repeatable dan hanya memindahkan biaya antara app eligibility dan DO insert/downstream, gate eksperimen direvert penuh dari codebase.

Catatan eksperimen 2026-04-22 terbaru berikutnya (rejected): di atas kontrol terbaik saat ini (`load-fullflow + prewarm + DO32`), bump lanjutan `LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=40` juga sudah diuji untuk mengecek apakah `insert_reservation_pool_wait` masih bisa ditekan lagi. Run tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets), tetapi hasilnya memburuk terhadap kontrol `DO32`: `full_flow/http_req/step_reservation p95 ~12.29s/4.18s/3.36s` vs `~13.44s/4.49s/2.80s` pada kontrol terdekat memang tampak campur aduk di summary, tetapi runner log menunjukkan reservation `app_fetch ~2474ms` vs `~2078ms`, `reservation.reserve ~2415ms` vs `~2030ms`, `durable_object_reserve ~1403ms` vs `~826ms`, dan downstream `order/payment` sampled juga memburuk. `eligibility_pool_wait` memang turun sedikit (`~904ms` vs `~1072ms`), tetapi win kecil itu tertelan oleh regress DO/path lain. Kesimpulan: tuning pool `TicketReserver` sebaiknya berhenti di `32` untuk kontrol prewarm saat ini; `40` tidak memberi win bersih.

Catatan diagnosis downstream 2026-04-22 terbaru berikutnya: setelah helper resmi ditambah `--profile-services`, kontrol `load-fullflow + prewarm + DO32` akhirnya membuka hotspot baru setelah slice reservation cukup stabil. Profiling menunjukkan `order.createOrder.transaction_queue_wait ~1332.8ms` avg / `~2202.2ms` p95 di dalam `create_order_transaction ~1829.3ms` avg / `~2547.1ms` p95, dan `payment.handleWebhook.transaction_queue_wait ~1071.8ms` avg / `~1856.0ms` p95 di dalam `confirm_payment_transaction ~1295.6ms` avg / `~2177.0ms` p95. Ini menggeser fokus lokal dari pool DO semata ke antrean akuisisi transaksi app-side pada jalur order/webhook.

Catatan eksperimen downstream 2026-04-22 terbaru berikutnya lagi (mixed/rejected, local-only): dua probe follow-up terhadap hotspot `transaction_queue_wait` sudah diuji dan tidak menghasilkan arah retained. Probe runtime `LOCAL_RUNNER_OVERRIDE_PAYMENT_BACKGROUND_TASK_CONCURRENCY=4` memang menurunkan `order.createOrder.transaction_queue_wait` ke sekitar `~1164.7ms` avg / `~1878.1ms` p95, tetapi mematahkan correctness issuance (`issuedTickets 395/500`) dan memburukkan metrik utama. Probe runtime yang lebih moderat `LOCAL_RUNNER_OVERRIDE_PAYMENT_BACKGROUND_TASK_CONCURRENCY=6` menjaga correctness (`500/500` issued tickets) dan tetap menurunkan `order.createOrder.transaction_queue_wait` ke sekitar `~1158.0ms` avg / `~2048.9ms` p95, tetapi `payment.handleWebhook.transaction_queue_wait` tidak ikut membaik secara berarti dan hasil aggregate tetap campur aduk (`full_flow/http_req p95 ~12.12s/4.91s` vs kontrol `~12.73s/4.57s`). Probe code-level berikutnya yang sempat menambah gate env `PAYMENT_FULFILLMENT_DB_MAX_CONNECTIONS` untuk mengisolasi DB work `fulfillSuccessfulPayment()` juga akhirnya ditolak dan direvert penuh: `fulfillmentDb=4` gagal keras (`issuedTickets 185/500`, `full_flow/http_req ~15.61s/5.06s`), sedangkan dua rerun `fulfillmentDb=8` tetap correctness-green dan kadang menurunkan `order.createOrder.transaction_queue_wait` (`~1170.4/1717.0` lalu `~1321.0/2011.0` vs kontrol `~1332.8/2202.2`) serta sedikit memperbaiki `payment.handleWebhook.transaction_queue_wait p95` (`~1758ms`), tetapi aggregate user-facing tetap kalah pada `full_flow/http_req` (`~13.42s/4.79s` lalu `~13.37s/4.85s` vs kontrol `~12.73s/4.57s`). Kesimpulan kerja terbaru: isolasi fulfillment/background concurrency memang bisa mempengaruhi antrean transaksi downstream, tetapi pada harness lokal sekarang win itu tidak translate menjadi kemenangan end-user yang repeatable; jangan lanjutkan keluarga eksperimen ini tanpa alasan teknis baru yang lebih kuat.

Catatan eksperimen downstream 2026-04-23 terbaru (retained, local-only, code-level trim pada `apps/api/src/services/order.service.ts`): follow-up berikutnya menargetkan body transaksi `orderService.createOrder()` secara lebih lokal. Varian pertama yang memindahkan seluruh metadata response (`tierName`, `eventId`, `eventSlug`, `eventTitle`) ke lookup pasca-commit memang langsung memangkas antrean transaksi order (`transaction_queue_wait ~1057.1ms` avg / `~1586.0ms` p95; `create_order_transaction ~1509.6ms` avg / `~2101.0ms` p95), tetapi ternyata terlalu agresif karena lookup metadata baru ikut antre besar di pool app umum (`response_metadata_lookup ~1415.9ms` avg / `~1755.0ms` p95). Varian itu tidak dipertahankan sebagai bentuk final. Bentuk refined berikutnya memindahkan hanya `eventSlug`/`eventTitle` ke lookup `events` pasca-commit sambil mempertahankan `tierName` + `eventId` di transaksi. Focused suite `order.test.ts` + `order-reservation.test.ts` tetap hijau (`11/11`). Pada helper comparable pertama di atas kontrol `load-fullflow + prewarm + DO32`, perubahan refined ini menurunkan `order.createOrder.transaction_queue_wait` ke sekitar `~907.2ms` avg / `~1399.0ms` p95 dan `create_order_transaction` ke `~1376.2ms` avg / `~1802.0ms` p95, sambil ikut menurunkan `payment.handleWebhook.transaction_queue_wait` ke `~919.8ms` avg / `~1656.0ms` p95; summary user-facing juga membaik pada `http_req/order/payment/webhook p95 ~4.30s/3.17s/2.76s/2.03s` vs kontrol `~4.57s/4.08s/3.99s/2.27s`, sedangkan `full_flow p95` tetap nyaris flat/noisy (`~12.86s` vs `~12.73s`). Rerun konfirmasi kedua tetap correctness-green dan menurunkan hotspot yang sama lebih jauh lagi (`order.transaction_queue_wait ~448.9ms` avg / `~687.0ms` p95`, `create_order_transaction ~937.6ms` avg / `~1253.0ms` p95`, `payment.transaction_queue_wait ~429.8ms` avg / `~744.0ms` p95`), tetapi helper aggregate tetap volatil (`full_flow/http_req ~14.36s/8.50s` walau `stepOrder/stepPayment/stepWebhook` turun ke `~1.85s/~1.43s/~1.28s`). Varian refined itu menjadi baseline awal, lalu follow-up 2026-04-24 mempersempit hot path sekali lagi dengan mengeluarkan `tierName` dari lookup reservation di dalam transaksi dan mengambil `tierName` pasca-commit bersama `eventSlug`/`eventTitle` via `ticket_tiers -> events`, sambil tetap mempertahankan `eventId` di hot path. Focused validation sempit tetap hijau (`pnpm exec vitest run src/__tests__/order.test.ts` = `7/7`), service-profile probe menunjukkan `order.createOrder.transaction_queue_wait ~360.1ms` avg dan `create_order_transaction ~1175.3ms` avg, lalu pair no-profile comparable tetap correctness-green (`500/500`) dan memberi `full_flow/http_req/step_order ~10.17s/2.90s/3.00s` lalu `~11.36s/3.64s/3.85s`, lebih baik daripada range kontrol no-profile terbaru sebelum patch (`~12.66s/4.19s`, `~14.29s/5.37s`, `~13.09s/3.77s`, `~12.87s/4.59s` untuk `full_flow/http_req`). Kesimpulan kerja terbaru: baseline aktif order trim sekarang mempertahankan reservation + `eventId` di transaksi, lalu mengambil `tierName` + `eventSlug` + `eventTitle` pasca-commit.

Catatan eksperimen downstream 2026-04-23 follow-up berikutnya (rejected, reverted): sesudah varian refined di atas retained, satu probe kecil lain diuji di file yang sama untuk meng-cache `response_metadata_lookup` event pasca-commit dengan cache TTL bounded in-memory. Hipotesisnya sederhana: jika lookup event yang sama untuk ratusan order burst bisa dihilangkan, `order.createOrder.totalDurationMs` dan pressure app DB pool akan ikut turun tanpa menyentuh transaksi. Focused suite tetap hijau (`11/11`), tetapi benchmark comparable pertama langsung memfalsifikasi hipotesis itu. `response_metadata_lookup` memang turun ke nyaris nol (`~0.2ms` avg / `~0.0ms` p95), namun hotspot utama justru memburuk melewati kontrol dan varian retained: `order.createOrder.transaction_queue_wait ~1561.7ms` avg / `~2311.0ms` p95 dan `create_order_transaction ~2029.7ms` avg / `~2698.0ms` p95, sementara `payment.handleWebhook.transaction_queue_wait` ikut naik ke `~1499.8ms` avg / `~2169.0ms` p95. Sampled runner overlap juga bergerak ke arah yang konsisten dengan regress ini: pada start request `order`, `inflight_reservation` naik dari sekitar `~66` ke `~125`, dan pada start request `payment`, `inflight_payment` naik dari sekitar `~124` ke `~152`. Interpretasi kerja terbaru: lookup metadata response pasca-commit yang kecil itu tampaknya ikut memberi pacing lokal; menghilangkannya justru mempercepat overlap downstream dan mengembalikan antrean transaksi app-side. Karena win sempitnya tidak translate ke hotspot target, cache ini direvert penuh dan jangan diulang tanpa alasan teknis baru yang lebih kuat.

Catatan eksperimen downstream 2026-04-23 follow-up berikutnya lagi (rejected, reverted): satu probe lokal yang memindahkan `payment.handleWebhook()` initial `payments + orders` lookup ke luar `database.transaction(...)` juga sudah diuji dan ditutup. Hipotesisnya: transaksi webhook saat ini mungkin terlalu lama menahan slot app DB pool untuk read awal yang sebenarnya bisa dijaga cukup dengan conditional update di dalam transaksi. Focused suite `payment.test.ts` tetap hijau (`6/6`), tetapi benchmark comparable pertama langsung regress keras pada semua metrik penting walau correctness tetap `500/500`: summary memburuk ke `full_flow/http_req/order/payment/webhook ~17.10s/6.50s/4.81s/4.60s/4.86s`. Service profiling juga memfalsifikasi hipotesis ini dengan jelas: `payment_lookup` di luar transaksi justru melebar ke sekitar `~1129.0ms` avg / `~2511.0ms` p95, `payment.handleWebhook.transaction_queue_wait` memburuk ke `~1133.8ms` avg / `~2746.0ms` p95, dan `confirm_payment_transaction` naik ke `~1631.3ms` avg / `~3264.0ms` p95. Downstream order ikut ketarik buruk (`order.createOrder.transaction_queue_wait ~993.3ms` avg / `~2329.0ms` p95). Kesimpulan kerja terbaru: read awal webhook memang terlihat “sekadar lookup”, tetapi memindahkannya ke luar transaksi hanya menambah antrean pool baru tanpa mengurangi contention total; eksperimen ini direvert penuh dan jangan diulang tanpa alasan teknis baru yang lebih kuat.

Catatan eksperimen downstream 2026-04-23 follow-up berikutnya sekali lagi (rejected, reverted): sesudah itu, lookup metadata event pasca-commit di `apps/api/src/services/order.service.ts` juga sempat diuji ulang dalam bentuk prepared hot path query bounded per-DB cache, bukan cache hasil. Tujuannya lebih sempit dari eksperimen cache TTL: mempertahankan pacing query yang sama, tetapi memangkas overhead query-builder / statement parse pada `response_metadata_lookup`. Focused suite `order.test.ts` + `order-reservation.test.ts` tetap hijau (`11/11`). Run comparable pertama tampak menjanjikan secara service profiling (`order.createOrder.totalDurationMs ~1406.5ms avg / ~1918.0ms p95`, `create_order_transaction ~883.2ms / ~1201.0ms`, `payment.handleWebhook.totalDurationMs ~756.5ms / ~1221.0ms`) walau summary aggregate tetap campur aduk (`full_flow/http_req ~12.40s/6.60s`). Namun rerun konfirmasi kedua mematahkan sinyal itu: `order.createOrder.transaction_queue_wait` melonjak kembali ke `~1226.3ms` avg / `~1859.0ms` p95, `create_order_transaction` ke `~1790.2ms` avg / `~2420.0ms` p95, `response_metadata_lookup` ke `~1385.2ms` avg / `~1828.0ms` p95, dan `payment.handleWebhook.transaction_queue_wait` ikut kembali naik ke `~1019.7ms` avg / `~1830.0ms` p95. Karena win run pertama tidak repeatable pada paired comparable rerun, prepared lookup ini direvert penuh. Kesimpulan kerja terbaru: jangan ulang keluarga "prepared event metadata lookup" tanpa alasan teknis baru yang lebih kuat.

Catatan eksperimen downstream 2026-04-23 follow-up berikutnya sekali lagi (rejected, reverted): satu trim lain di `apps/api/src/services/order.service.ts` yang mengurangi payload `RETURNING` pada insert `orders`/`order_items`/`payments` ke id saja lalu membangun response object dari nilai yang sudah diketahui lokal juga sudah diuji dan ditutup. Hipotesisnya: `createOrder()` masih membayar payload `RETURNING` yang terlalu lebar di dalam transaksi, padahal sebagian besar field (`status`, `amount`, `timestamps`, `orderNumber`) sudah diketahui dalam memori request. Focused suite `order.test.ts` + `order-reservation.test.ts` tetap hijau (`11/11`), tetapi benchmark comparable pertama menunjukkan arah yang salah pada hotspot target: `order.createOrder.transaction_queue_wait` naik kembali ke sekitar `~1322.0ms` avg / `~2514.0ms` p95, `create_order_transaction` ke `~2000.8ms` avg / `~3234.0ms` p95, dan `response_metadata_lookup` ikut melebar ke `~1226.8ms` avg / `~1720.0ms` p95. Memang `payment.handleWebhook` sedikit membaik (`transaction_queue_wait ~863.4ms` avg / `~1539.0ms` p95), tetapi target order justru hampir kembali ke kontrol buruk dan aggregate user-facing juga regress (`full_flow/http_req/order/payment ~13.95s/5.73s/4.93s/4.60s`). Karena cost hanya bergeser dan slice target order memburuk, trim `RETURNING` ini direvert penuh.

Catatan diagnosis harness 2026-04-23 terbaru (retained, local-only): helper observability penuh sekarang terbukti menjadi confounder material untuk metrik user-facing pada kontrol `load-fullflow + prewarm + DO32`. Pada state kode retained saat ini, dua run no-profile comparable tetap correctness-green (`500/500`) dan memberi `full_flow/http_req ~12.54s/3.57s` lalu `~9.96s/3.70s`. Sebaliknya, helper service-only profiling memberi `~14.94s/4.34s`, runner-only profiling memberi `~13.34s/4.66s`, dan run-profile penuh retained sebelumnya berada di rentang `~12.86s/4.30s` sampai `~14.36s/8.50s`. Kesimpulan kerja terbaru: untuk win/loss user-facing pada harness lokal, gunakan comparable no-profile runs; aktifkan `--profile-services` atau `--profile-runner` hanya saat benar-benar perlu diagnosis hotspot, lalu jangan campurkan angka profiled itu langsung dengan keputusan end-user.

Catatan eksperimen harness 2026-04-23 terbaru berikutnya (rejected, reverted): `tests/load/checkout-flow.js` sempat ditambah gate lokal kecil `PRE_REQUEST_VU_JITTER_MS` untuk menyebar request pertama tiap VU sebelum prewarm `/health`, dengan hipotesis bahwa `PRE_RESERVATION_VU_JITTER_MS` yang lama gagal karena wave socket/prewarm tetap serentak. Eksperimen ini berbeda dari jitter lama karena sleep terjadi sebelum request apa pun. Namun benchmark no-profile pertama dengan `PRE_REQUEST_VU_JITTER_MS=250` tidak mengalahkan dua no-profile control retained: hasilnya tetap correctness-green (`500/500`), tetapi hanya memberi `full_flow/http_req/step_reservation ~13.06s/4.13s/2.38s`, kalah dari no-profile terbaik terdekat (`~9.96s/3.70s/1.77s`) dan juga tidak jelas mengalahkan sample no-profile satunya (`~12.54s/3.57s/3.02s`). Karena sinyal awal tidak mendukung hipotesis dan gate ini hanya menambah permukaan harness, patch direvert penuh. Kesimpulan kerja terbaru: jangan ulang `PRE_REQUEST_VU_JITTER_MS` tanpa alasan teknis baru yang lebih kuat.

Catatan eksperimen 2026-04-24 (retained, code-level trim lanjutan pada `apps/api/src/services/order.service.ts`): sesudah varian refined sebelumnya (`tierName + eventId` di transaksi, `eventSlug/eventTitle` pasca-commit), trim berikutnya memindahkan `tierName` juga ke pasca-commit, sehingga transaksi `createOrder()` sekarang hanya mempertahankan `eventId` dari JOIN reservation, dan `loadOrderCreationResponseMetadata()` mengambil `tierName + eventSlug + eventTitle` bersama via `ticket_tiers JOIN events`. Focused `order.test.ts` tetap hijau (`7/7`). Service-profile probe menunjukkan `order.createOrder.transaction_queue_wait ~360ms avg` dan `create_order_transaction ~1175ms avg`. Tiga no-profile comparable runs (kontrol `load-fullflow + prewarm + DO32`) semuanya correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets): run #1 `full_flow/http_req/step_order p95 ~10.17s/2.90s/3.00s`, run #2 konfirmasi `~11.36s/3.64s/3.85s`, run #3 konfirmasi lanjutan `~13.03s/3.98s/3.90s`. Rata-rata tiga run dengan trim (~`11.52s/3.51s`) tetap lebih baik dari rentang pre-trim no-profile sebelumnya (~`12.66-14.29s/3.77-5.37s`). Varians lokal masih tinggi. Perubahan ini dipertahankan sebagai incremental win.

Catatan analisis 2026-04-24 body transaksi `payment.handleWebhook()`: setelah audit menyeluruh terhadap `apps/api/src/services/payment.service.ts`, tidak ditemukan trim yang aman dan viable pada webhook transaction body. Semua kandidat sudah tertutup: `payment_lookup` luar transaksi → hard regress (`~17.10s/6.50s`, rejected 2026-04-23); `RETURNING` clause pada update `payments`/`orders` sudah minimal (`{ id }`); reservation update di dalam transaksi tidak bisa diangkat karena `cleanupExpiredReservations()` query dengan `status='active'` akan race pada gap antara commit dan background `confirmReservation()`; payload SELECT awal (`payments.id, orderId, status, externalRef + orders.id, reservationId, status, expiresAt`) seluruhnya dipakai downstream. Tidak ada slice baru yang akan dibuka untuk keluarga ini.


### Priority

P2 — engineering improvement backlog, bukan blocker release langsung.

### Why

Setelah Opsi B disetujui, benchmark checkout lokal tetap penting sebagai alat diagnosis dan regression guard. Namun pekerjaan tuning lokal tidak lagi boleh mengaburkan status readiness release, yang sekarang bertumpu pada correctness lokal dan validasi staging/non-local yang lebih representatif.

### Scope

- Lanjutkan profiling jalur checkout lokal dengan fokus pada tail reservation, queueing app pool, dan interaksi runner Node lokal satu-proses.
- Uji perubahan hanya dengan workflow benchmark lokal resmi repo seperti `pnpm run test:load:checkout:local:balanced` dan preset lain bila diperlukan untuk diagnosis.
- Pertahankan correctness benchmark lokal: tidak ada oversell, `checkout_flow_success` tetap penuh, dan post-run validation tetap hijau.
- Dokumentasikan hanya win yang repeatable; eksperimen yang tidak stabil harus ditolak atau direvert.
- Update catatan benchmark, plan, atau repo memory bila ada optimisasi retained yang benar-benar terbukti.
- Jangan menjalankan remote load test, synthetic traffic non-local, atau bypass guardrail auth/rate-limit dalam task ini.

### Expected Output

- Daftar hipotesis bottleneck lokal yang tervalidasi atau ditolak.
- Jika ada win yang retained, perubahan kode yang terukur dengan before/after benchmark lokal resmi.
- Jika tidak ada win stabil, catatan keputusan untuk berhenti agar backlog tidak berputar tanpa arah.

### Definition of Done

- Ada minimal satu outcome yang jelas: optimisasi retained yang repeatable, atau keputusan eksplisit bahwa eksperimen terbaru tidak layak dipertahankan.
- Setiap perubahan yang dipertahankan menjaga correctness checkout lokal dan cleanup benchmark tetap sehat.
- Dokumentasi benchmark lokal hanya diperbarui bila ada perubahan retained yang sudah tervalidasi.

### Agent Prompt

```text
Kerjakan Task I: lanjutkan optimisasi checkout lokal sebagai backlog engineering terpisah.

Konteks penting:
- Threshold checkout lokal `T-10.3` tidak lagi menjadi blocker release final tunggal.
- Benchmark lokal tetap dipakai sebagai regression signal dan alat diagnosis performa.
- Fokus task ini adalah win engineering yang repeatable, bukan keputusan go/no-go release.
- Update terbaru: eksperimen code-level local-only yang membatch dua notifikasi post-payment menjadi satu insert DB dan melewati `sendEmail()` ketika `EMAIL_API_KEY`/`EMAIL_FROM` lokal kosong sudah diuji dan direvert. Focused suite tetap hijau (`31/31`) dan dua helper run resmi tetap correctness-green (`500/500`), tetapi hasilnya tidak repeatable pada metrik utama: run #1 `full_flow/http_req/step_reservation ~10.36s/6.48s/7.16s`, run #2 `~12.57s/5.59s/6.13s`. Walaupun run pertama memperbaiki `eligibility_pool_wait` dan `insert_reservation_pool_wait`, pair helper tetap gagal mengalahkan baseline helper trusted (`~9.30s/4.62s/6.96s`), sehingga tidak layak retain.
- Analisis lanjutan pada log run #1 menunjukkan gap utama saat ini ada di depan handler: `client_send_to_handler ~3611ms` avg (`p95 ~5583ms`), sedangkan `app_fetch`, `rateLimit.middleware`, `reservation.route.create`, dan `reservation.reserve` hanya sekitar `~935-948ms` avg (`p95 ~1658-1677ms`). Sample reservation terlambat juga overlap dengan `34-48` order dan `60-80` payment in-flight, sementara step internal rate limit sendiri negligible. Ini menggeser fokus berikutnya dari fulfillment micro-optimization ke overlap/admission boundary pada runner lokal.
- Update terbaru berikutnya: instrumentation runner low-overhead di `scripts/run-api-local.ts` sekarang juga mencatat `pre_accept_gap`, `seenByCategoryAtStart`, dan `pendingWaitUntilTasksAtStart` pada sampled request. Helper resmi diagnostik dengan instrumentation ini tetap correctness-green (`500/500`), tetapi hasil user-facing run tersebut memburuk ke `full_flow/http_req/step_reservation ~12.08s/8.06s/10.23s`; data itu dipakai untuk diagnosis, bukan sebagai baseline performa baru.
- Analisis log diagnostik terbaru menunjukkan gap utama helper benar-benar terjadi sebelum socket diterima: `pre_accept_gap ~5247ms` avg (`p95 ~9216ms`), `client_send_to_handler ~5282ms` avg (`p95 ~9226ms`), sedangkan `socket_accept_to_handler ~35ms` avg (`p95 ~75ms`) dan `app_fetch ~540ms` avg (`p95 ~1107ms`). Bucket reservation sample menunjukkan gap ini meningkat bersama overlap order/payment dan `pendingWaitUntilTasksAtStart`, dari early `~888ms/0` ke middle `~4656ms/174` lalu late `~8018ms/483`.
- State terbaru: baseline kode aktif kini mempertahankan instrumentation runner tambahan itu, sementara eksperimen `generateTickets()` skip-query, rewrite flat join `loadSuccessfulPaymentFulfillmentPayload()`, batching notifikasi payment + skip email saat env lokal kosong, alignment insert profiling DO, helper `payment.background_task` opt-in, sampled runner profiling reservation-only, kenaikan `ticketReserverDbMaxConnections`, cache static tier/event eligibility, pemindahan eligibility ke `TicketReserver`, rewrite `ownedTickets`, env-gated `LOCAL_RUNNER_SHARE_TICKET_RESERVER_DB_POOL=1`, `TICKET_RESERVER_INSERT_BATCH_SIZE=25`, `TICKET_RESERVER_INSERT_CONCURRENCY_LIMIT=8`, paralelisasi payload fulfillment + `generateTickets()`, dan inline sync webhook semuanya tetap sudah direvert; eksperimen berikutnya sebaiknya fokus ke gap pre-handler / overlap runner, bukan fulfillment micro-opt lain.
- Update terbaru berikutnya: `scripts/run-api-local.ts` sekarang retained dengan summary exit low-overhead `[local-runner-summary]` yang tetap muncul pada run no-profile. Summary ini melaporkan `maxInFlightRequests`, `maxPendingWaitUntilTasks`, `maxActiveSockets`, `maxInFlightByCategory`, `maxPendingWaitUntilTasksByActiveCategory`, dan `firstPendingWaitUntilSnapshot`, sehingga kontrol no-profile bisa dibandingkan tanpa mengaktifkan sampled runner profiling.
- Dua run kontrol no-profile pertama dengan summary global saja menunjukkan puncak overlap mentah tidak bergerak searah dengan metrik user-facing: run `~12.66s/4.19s` justru punya `maxInFlightRequests=497`, sedangkan run yang lebih buruk `~14.29s/5.37s` hanya `385`, sementara `maxPendingWaitUntilTasks` tetap hampir sama (`970` vs `966`). Ini menolak hipotesis bahwa peak backlog runner global saja cukup menjelaskan variasi end-user saat ini.
- Follow-up overlap summary menunjukkan `waitUntil` pertama kali muncul ketika order/payment sudah berjalan, bukan saat reservation masih dominan. Pada dua run konfirmasi no-profile berikutnya, `firstPendingWaitUntilSnapshot` tercatat saat reservation aktif hanya `78` lalu `46`, sementara order aktif sudah `290` lalu `271`; peak `pendingWaitUntilTasks` selama reservation aktif juga tidak stabil (`2` vs `131`) walaupun `step_reservation_duration p95` tetap hampir sama (`~2.81-2.82s`). Kesimpulan kerja baru: overlap `waitUntil` dengan reservation bukan penjelasan utama tail no-profile saat ini.
- Pembacaan kode setelah itu menegaskan batas leverage runner: `apps/api/src/services/payment.service.ts` dan `apps/api/src/services/auth.service.ts` sama-sama membentuk promise background task yang sudah panas (`enqueueBackgroundTask(taskFactory)` / `taskFactory().catch(...)`) sebelum diserahkan ke `executionContext.waitUntil(...)`. Jadi perubahan pada `LocalExecutionContext.waitUntil(...)` saja tidak akan benar-benar mendecouple start kerja background tanpa mengubah kontrak scheduler menjadi factory-based, dan itu terlalu dekat dengan keluarga eksperimen penundaan kickoff `waitUntil` yang sudah ditolak.

Tujuan:
1. Profiling benchmark checkout lokal resmi untuk menemukan bottleneck dominan yang masih realistis untuk diperbaiki.
2. Pilih satu hipotesis baru yang menarget reservation/http tail atau gap `client_send_to_handler` / `pre_accept_gap` tanpa mengulang eksperimen yang sudah ditolak.
3. Pertahankan hanya perubahan yang benar-benar repeatable dan tidak merusak correctness.
4. Dokumentasikan before/after atau alasan penolakan eksperimen dengan jelas.

Aturan kerja:
- Jangan mencampur hasil task ini dengan release gate staging/non-local.
- Jangan menjalankan remote load test atau bypass guardrail auth/rate-limit.
- Jika bottleneck yang tersisa terutama berasal dari keterbatasan harness lokal, dokumentasikan itu dan hentikan eksperimen spekulatif pada service/fulfillment; utamakan boundary-request atau runner-overlap analysis terlebih dahulu, dan perlakukan toggles keluarga connection-strategy/keep-alive hanya sebagai diagnosis bila benar-benar diperlukan.

Output yang diharapkan:
- Ringkasan bottleneck lokal yang masih relevan.
- Daftar optimisasi retained atau eksperimen yang ditolak.
- Jika ada win retained, bukti benchmark before/after dari workflow lokal resmi.
```

## Suggested Agent Working Rules

- Kerjakan task sesuai urutan kecuali ada dependency yang lebih kuat dari hasil inspeksi kode.
- Setelah menyelesaikan satu task, update dokumen ini dengan status `todo`, `in progress`, atau `done`.
- Jangan mulai deploy production sebelum Task A, B, dan C selesai.
- Jangan menganggap local load benchmark sebagai satu-satunya bukti production readiness.
- Jika sebuah task memerlukan keputusan produk atau infra eksternal, catat secara eksplisit sebagai blocker, jangan diam-diam menebak.

## Suggested Status Template

Gunakan format ini saat memperbarui progres:

```text
Status: todo | in progress | done | blocked
Owner: AI agent | human | shared
Last updated: YYYY-MM-DD
Notes: singkat, faktual, dan menyebut blocker jika ada
```
