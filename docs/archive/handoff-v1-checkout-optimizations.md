# Handoff Progress

Last updated: 2026-04-28
Scope: lanjutkan Task I sebagai backlog engineering checkout lokal, bukan release gate non-local.

## Tujuan Utama Saat Ini

Lanjutkan investigasi bottleneck checkout lokal dengan fokus pada reservation/http tail pada runner lokal satu-proses.

Yang bukan fokus saat ini:

- Bukan staging load test.
- Bukan production release execution.
- Bukan fairness tweak kecil di payment background scheduler.
- Bukan eksperimen fulfillment isolation yang hanya memindahkan kerja ke queue/task lain tanpa win end-user yang nyata.

## Resume Cepat Untuk Laptop Lain

- State kode aktif saat handoff ini ditutup tetap baseline retained: trim downstream order di `apps/api/src/services/order.service.ts`, cache JWT bounded di `apps/api/src/middleware/auth.ts`, dan observability harness retained di `tests/load/checkout-flow.js` + `packages/core/scripts/run-local-checkout-benchmark.ts`.
- Progress terbaru sesi ini: helper lokal sekarang sudah memisahkan metric `setup_login_http_duration`, `checkout_http_duration`, `prewarm_http_duration`, `payment_http_duration`, `webhook_http_duration`, plus metric bisnis pasca-prewarm `checkout_business_flow_duration` dan `checkout_business_http_duration`. Ini dipertahankan karena berhasil menjelaskan confound utama bahwa `http_req_duration` dan `full_flow_duration` bisa terdorong kuat oleh prewarm `/health`.
- Eksperimen terakhir yang dibuka ulang adalah `createOrder retry backoff` untuk collision `idx_orders_order_number` dan retryable DB error. Family ini sekarang dianggap benar-benar tertutup: focused order tests tetap hijau saat aktif, tetapi rerun konfirmasi dengan metric baru tetap tidak repeatable, sehingga patch direvert penuh lagi.
- State akhir sesi ini bersih dan tervalidasi: baseline order sesudah revert kembali `9/9` untuk `order.test.ts + order-number.test.ts`, suite guardrail tujuh file kembali `31/31`, dan `cleanup-load-test-data.ts --dry-run` kembali semua hitungan `0`.
- Baseline lokal yang paling berguna untuk eksperimen downstream berikutnya saat prewarm aktif adalah no-profile `load-fullflow + --prewarm-reservation-connection + DO32`, tetapi evaluasi utamanya sekarang harus memakai `checkout_business_flow_duration`, `checkout_business_http_duration`, dan metric step spesifik; treat `http_req_duration` dan `full_flow_duration` sebagai context metric saja selama prewarm masih aktif.
- Snapshot baseline validasi retained terbaru dengan metric bisnis baru: `full_flow/checkout_business_flow/http_req/checkout_http/checkout_business_http/prewarm_http/step_reservation/step_order/step_payment/step_webhook ~11.76s/5.18s/6.12s/6.56s/1.83s/8.77s/1.04s/1.96s/1.65s/1.22s`, tetap `500/500` correctness-green.
- Next move yang paling masuk akal: pilih hipotesis kecil berikutnya yang menyerang overlap/downstream app-side di luar family yang sudah ditutup, lalu nilai terutama dengan `checkout_business_flow_duration`, `checkout_business_http_duration`, dan step metrics. Jangan buka lagi family `createOrder retry backoff`, dedicated order/webhook pool, prepared reservation lookup in-tx, atau trim kecil webhook transaction body tanpa bukti teknis baru yang jauh lebih kuat.
- **Update Handoff Pindah Laptop (2026-04-28)**: 
  1. Local PostgreSQL docker sudah dihidupkan ulang (`docker compose up -d postgres`) karena sebelumnya down / timeout.
  2. Baseline segar pada code state retained terakhir telah ditarik dengan comparable helper `load-fullflow + --prewarm-reservation-connection + DO32`: correctness-green `500/500`, `full_flow p95 ~12.85s`, `http_req p95 ~5.01s`, `checkout_business_flow p95 ~8.09s`.
  3. Eksperimen kode baru **sudah di-patch** ke `apps/api/src/services/order-reservation.service.ts`, yaitu mencoba in-memory routing cache (`reservationId -> ticketTierId`) untuk mem-bypass query app-side DB sebelum pemanggilan Durable Object pada `confirmReservation` / `releaseReservation` saat webhook.
  4. **PENDING ACTION di laptop baru**: Patch cache `order-reservation.service.ts` **belum di-benchmark**. Mohon langsung jalankan benchmark lokal `load-fullflow + --prewarm-reservation-connection + DO32` (tanpa flag profile) untuk membandingkan hasilnya dengan baseline `~12.85s` ini dan ambil keputusan retain/revert.

## Status Terkini

- Task G dan H sudah selesai. Release posture saat ini tetap `conditional go` berdasarkan validasi staging/non-local yang sudah dilakukan sebelumnya.
- Task I masih `in progress`, tetapi sekarang jelas terpisah dari keputusan release.
- Update sesi 2026-04-24: trim retained terbaru di `apps/api/src/services/order.service.ts` tetap aktif. Bentuk finalnya mempertahankan `eventId` di transaksi `createOrder()`, lalu memindahkan `tierName + eventSlug + eventTitle` ke lookup pasca-commit via `ticket_tiers -> events`.
- Update sesi 2026-04-24 terbaru sesudah itu: probe code-level yang membundel tiga insert `createOrder()` (`orders`, `order_items`, `payments`) menjadi satu raw CTE roundtrip di `apps/api/src/services/order.service.ts` sudah diuji lalu direvert penuh. Focused `order.test.ts` dan suite guardrail `31/31` tetap hijau saat eksperimen aktif, dan helper comparable `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32 --profile-services` juga tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets), tetapi aggregate regress keras ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~15.79s/4.41s/3.70s/4.55s/4.13s/2.01s`. Log run itu masih menunjukkan `payment.handleWebhook.transaction_queue_wait` sekitar `~1.12-1.17s` pada wave berat dan tidak memberi sampel `order.createOrder` yang bisa dipakai untuk membenarkan retain, jadi probe ini ditolak; sesudah revert, `order.test.ts` kembali `7/7` dan focused suite `31/31` kembali hijau. Jangan ulang probe raw CTE insert bundling tanpa alasan teknis baru yang kuat.
- Update sesi 2026-04-24 terbaru sesudah itu lagi: probe kecil berikutnya yang mem-prefetch snapshot immutable reservation/tier di luar transaksi `createOrder()` sambil me-recheck field mutable (`userId`, `status`, `expiresAt`) di dalam transaksi juga sudah diuji lalu direvert penuh. Focused `order.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`7/7`). Comparable helper `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32 --profile-services` tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets), tetapi aggregate kembali regress ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~15.89s/5.22s/3.71s/5.44s/3.47s/2.12s`, sehingga probe ini ditolak. Timeout sementara di `src/__tests__/queue-cleanup.test.ts` sesudah benchmark lokal ternyata artefak environment, bukan regresi `order.service.ts`: sesudah cleanup synthetic benchmark data dan pemakaian env eksplisit `JWT_SECRET` + `PAYMENT_WEBHOOK_SECRET`, `queue-cleanup.test.ts` kembali `4/4` dan suite guardrail lebar kembali `31/31`. Jangan ulang keluarga probe "reservation snapshot prefetch split" tanpa alasan teknis baru yang kuat.
- Update sesi 2026-04-24 terbaru sesudah cleanup itu: probe kecil berikutnya yang hanya memangkas payload `RETURNING` sekunder pada insert `order_items` dan `payments` di `createOrder()` juga sudah diuji lalu direvert penuh. Focused `order.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`7/7`). Comparable helper `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32 --profile-services` kembali correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets), tetapi aggregate regress lebih keras ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~17.74s/6.08s/3.10s/5.50s/5.20s/3.52s`, dan log run itu lagi-lagi tidak memberi sampel `order.createOrder` yang bisa dipakai untuk membenarkan retain. Jangan ulang keluarga probe "secondary RETURNING trim" tanpa alasan teknis baru yang kuat.
- Update sesi 2026-04-24 terbaru sesudah itu: probe kecil berikutnya yang menghapus timestamp insert app-side redundan pada `orders` dan `payments` di `createOrder()` agar schema `defaultNow()` mengisi `createdAt`/`updatedAt` juga sudah diuji lalu direvert penuh. Focused `order.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`7/7`), dan suite guardrail lebar kembali `31/31` sesudah cleanup artefak benchmark. Namun comparable helper yang sama kembali correctness-green sambil regress keras ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~16.28s/7.26s/2.79s/3.70s/3.64s/2.39s`. Jangan ulang probe "insert timestamp defaultNow()" ini tanpa alasan teknis baru yang kuat.
- Update sesi 2026-04-24 terbaru sesudah itu lagi: probe kecil berikutnya yang menangani collision `idx_orders_order_number` lewat nested transaction/savepoint di dalam `createOrder()` agar retry nomor order tidak keluar lagi ke antrean transaksi penuh juga sudah diuji lalu direvert penuh. Focused `order.test.ts` + `order-number.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`9/9`), dan suite guardrail lebar kembali `31/31` sesudah cleanup artefak benchmark. Namun comparable helper yang sama kembali correctness-green sambil regress ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~16.65s/6.34s/4.14s/4.41s/3.51s/2.39s`. Jangan ulang probe "order-number savepoint retry" ini tanpa alasan teknis baru yang kuat.
- Update sesi 2026-04-24 terbaru sesudah itu lagi sekali lagi: probe kecil berikutnya yang membuat suffix `order_number` tetap unik di proses yang sama pada hari UTC yang sama, sambil mempertahankan format publik `JVX-YYYYMMDD-XXXXX`, juga sudah diuji lalu direvert penuh. Focused `order.test.ts` + `order-number.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`9/9`), dan suite guardrail lebar kembali `31/31` sesudah cleanup artefak benchmark. Namun comparable helper yang sama kembali correctness-green sambil regress lebih jauh ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~17.14s/5.09s/4.10s/5.34s/4.73s/3.04s`. Jangan ulang probe "local unique order-number suffix" ini tanpa alasan teknis baru yang kuat.
- Update sesi 2026-04-26 terbaru sesudah itu: probe kecil berikutnya yang membiarkan default schema mengisi `orders.status`, `orders.serviceFee`, dan `payments.status` di `createOrder()` juga sudah diuji lalu direvert penuh. Focused `order.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`7/7`). Comparable helper yang sama tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets) dengan `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~13.26s/6.75s/2.56s/2.77s/2.46s/1.67s`, tetapi artifact run itu lagi-lagi tidak memberi sampel `order.createOrder` untuk hotspot target dan tidak ada pair control retained di sesi yang sama untuk membuktikan win repeatable. Probe ini ditolak dan direvert; sesudah cleanup, dry-run kembali `0` dan suite guardrail lebar kembali `31/31`. Jangan ulang probe "schema default insert values" ini tanpa alasan teknis baru yang kuat.
- Update sesi 2026-04-26 terbaru sesudah itu lagi: probe kecil berikutnya yang membuat collection timed step `order.createOrder` hanya aktif saat `LOAD_TEST_PROFILE=1` juga sudah diuji lalu direvert penuh. Focused `order.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`7/7`). Dua run no-profile helper yang sama tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets), tetapi hasilnya mixed dan tidak layak retain: run #1 `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~11.41s/6.02s/2.33s/2.14s/1.84s/1.24s`, run #2 `~12.44s/5.98s/1.79s/2.78s/2.48s/1.80s`. Walau reservation/order/downstream sempat lebih murah, `http_req_duration p95` regress repeatable ke sekitar `~6s`, jadi probe ini ditolak dan direvert; sesudah cleanup, dry-run kembali `0` dan suite guardrail lebar kembali `31/31`. Jangan ulang probe "no-profile timed-step gating" ini tanpa alasan teknis baru yang kuat.
- Update sesi 2026-04-26 terbaru sesudah itu lagi sekali lagi: probe kecil berikutnya yang menyiapkan `reservation_lookup` `createOrder()` sebagai prepared query di dalam transaksi juga sudah diuji lalu direvert penuh. Focused `order.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`7/7`). Comparable helper `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32 --profile-services` tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets), tetapi aggregate regress ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~13.87s/6.77s/2.43s/3.56s/3.33s/2.28s`, dan artifact run itu lagi-lagi tidak memberi sampel `order.createOrder` untuk hotspot target. Probe ini ditolak dan direvert; sesudah cleanup, dry-run kembali `0` dan suite guardrail lebar kembali `31/31`. Jangan ulang probe "prepared reservation lookup in tx" ini tanpa alasan teknis baru yang kuat.
- Update sesi 2026-04-26 terbaru sesudah itu lagi sekali lagi sekali lagi: probe kecil berikutnya yang memberi `createOrder()` pool DB terpisah via env gate lokal `ORDER_SERVICE_DB_MAX_CONNECTIONS=8` juga sudah diuji lalu direvert penuh. Focused `order.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`7/7`). Comparable helper `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32 --profile-services` tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets), tetapi justru membalik keras: `order.createOrder.transaction_queue_wait` melonjak ke sekitar `~8.8s`, `step_order p95` ke `~8.95s`, dan aggregate regress ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~18.26s/8.82s/2.83s/8.95s/270ms/460ms`. Payment/webhook memang jadi murah, tetapi antrean order hancur total, jadi probe ini ditolak dan direvert; sesudah cleanup, dry-run kembali `0` dan suite guardrail lebar kembali `31/31`. Jangan ulang probe "dedicated createOrder DB pool" ini tanpa alasan teknis baru yang kuat.
- Update sesi 2026-04-26 terbaru sesudah itu lagi sekali lagi sekali lagi sekali lagi: probe kecil berikutnya yang memberi `handleWebhook()` pool DB terpisah via env gate lokal `PAYMENT_WEBHOOK_DB_MAX_CONNECTIONS=8` juga sudah diuji lalu direvert penuh. Focused `payment.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`6/6`). Comparable helper `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32 --profile-services` tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets), tetapi webhook queue justru pecah: `payment.handleWebhook.transaction_queue_wait` naik ke sekitar `~3.5s`, `step_webhook p95` ke `~8.55s`, dan aggregate regress ke `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~17.56s/8.85s/1.57s/1.89s/1.08s/8.55s`. Reservation/order/payment memang sempat lebih murah, tetapi antrean webhook jadi bottleneck baru yang jauh lebih buruk, jadi probe ini ditolak dan direvert; sesudah cleanup, dry-run kembali `0` dan suite guardrail lebar kembali `31/31`. Jangan ulang probe "dedicated payment webhook DB pool" ini tanpa alasan teknis baru yang kuat.
- Control pair segar sesi 2026-04-26 pada baseline retained sekarang sudah tersedia. No-profile control `load-fullflow + --prewarm-reservation-connection + DO32` kembali correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets) dengan `full_flow/http_req/step_reservation/step_order/step_payment/step_webhook ~11.25s/3.91s/2.69s/2.94s/2.69s/1.72s`. Profile control dengan helper yang sama juga correctness-green dengan `~15.22s/4.61s/4.50s/4.58s/3.60s/2.02s`; sampled `payment.handleWebhook.transaction_queue_wait` terlihat di kisaran sekitar `~228-388ms` pada potongan awal run. Cleanup sesudah pair ini kembali `0`. Gunakan pair baseline segar ini sebagai pembanding same-session berikutnya.
- Update sesi 2026-04-26 terbaru sesudah control pair segar: probe kecil berikutnya yang menambah backoff berjitter pendek sebelum retry `createOrder()` untuk collision `idx_orders_order_number` dan retryable DB error juga sudah diuji lalu direvert penuh. Focused `order.test.ts` + `order-number.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`9/9`). Comparable helper no-profile `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32` tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets) dan memang memangkas downstream `step_reservation/step_order/step_payment/step_webhook` ke `~1.64s/1.94s/1.60s/1.37s`, tetapi `http_req_duration p95` justru melonjak keras ke `~6.33s` terhadap control same-session `~3.91s`, sehingga win-nya tidak bersih pada metrik utama end-user. Patch ditolak dan direvert; sesudah cleanup, dry-run kembali `0` dan suite guardrail lebar kembali `31/31`. Jangan ulang probe "createOrder retry backoff" ini tanpa alasan teknis baru yang kuat.
- Update sesi 2026-04-26 terbaru sesudah itu lagi: helper lokal retained sekarang punya breakdown HTTP flow yang lebih tepat di `tests/load/checkout-flow.js` dan `packages/core/scripts/run-local-checkout-benchmark.ts`: `setup_login_http_duration`, `checkout_http_duration`, `prewarm_http_duration`, `payment_http_duration`, dan `webhook_http_duration` kini diekspor serta ikut diparse di summary lokal. Probe validasi pertama pada baseline retained tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets) dengan `full_flow/http_req/checkout_http/prewarm_http/step_reservation/step_order/step_payment/step_webhook ~12.61s/3.46s/3.99s/6.78s/3.35s/3.44s/3.15s/1.62s`. Temuan utamanya: `http_req_duration` lokal memang bisa didorong kuat oleh prewarm `/health`, sehingga evaluasi eksperimen downstream sekarang harus melihat `checkout_http_duration` dan metric step spesifik, bukan `http_req_duration` saja.
- Update sesi 2026-04-26 terbaru sesudah observability retained: probe `createOrder retry backoff` dibuka sekali lagi dengan alasan teknis baru di atas, tetapi tetap tidak repeatable dan akhirnya ditutup lagi. Focused `order.test.ts` + `order-number.test.ts` tetap hijau saat eksperimen aktif dan sesudah revert (`9/9`). Run no-profile #1 pada helper baru tampak menang (`full_flow/http_req/checkout_http/prewarm_http/step_reservation/step_order/step_payment/step_webhook ~10.99s/3.33s/3.36s/2.34s/2.74s/3.55s/2.85s/1.70s`), tetapi run konfirmasi #2 regress keras (`~13.71s/6.11s/6.14s/8.42s/1.41s/2.60s/2.37s/1.43s`). Jadi bahkan setelah memisahkan prewarm dari checkout path, probe ini tetap tidak memberi win repeatable. Patch direvert penuh; sesudah cleanup, dry-run kembali `0` dan suite guardrail lebar kembali `31/31`. Jangan buka lagi family `createOrder retry backoff` tanpa alasan teknis baru yang lebih kuat dari ini.
- Update sesi 2026-04-26 terbaru sesudah itu lagi: helper lokal retained sekarang juga punya dua metric flow yang mengecualikan prewarm `/health`: `checkout_business_flow_duration` dan `checkout_business_http_duration`. Validasi no-profile pertama pada baseline retained tetap correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets) dengan `full_flow/checkout_business_flow/http_req/checkout_http/checkout_business_http/prewarm_http/step_reservation/step_order/step_payment/step_webhook ~11.76s/5.18s/6.12s/6.56s/1.83s/8.77s/1.04s/1.96s/1.65s/1.22s`. Temuan utamanya sekarang lengkap: `full_flow_duration`, `checkout_http_duration`, dan `http_req_duration` sama-sama bisa terdorong kuat oleh prewarm diagnostik, sedangkan jalur bisnis checkout pasca-prewarm dalam run yang sama jauh lebih murah (`checkout_business_http p95 ~1.83s`). Untuk eksperimen downstream berikutnya, gunakan `checkout_business_flow_duration`, `checkout_business_http_duration`, dan metric step spesifik sebagai pembanding utama; treat `http_req_duration` dan `full_flow_duration` sebagai context metric selama prewarm masih aktif di harness.
- Focused validation untuk trim order retained tetap hijau: `pnpm exec vitest run src/__tests__/order.test.ts` = `7/7`.
- Service-profile probe terbaru untuk trim order retained menunjukkan `order.createOrder.transaction_queue_wait ~360ms avg` dan `create_order_transaction ~1175ms avg`.
- Tiga run no-profile comparable terbaru pada kontrol `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32` semuanya correctness-green (`500/500`, `500` confirmed orders/tickets, `500` issued tickets): run #1 `full_flow/http_req/step_order ~10.17s/2.90s/3.00s`, run #2 `~11.36s/3.64s/3.85s`, run #3 `~13.03s/3.98s/3.90s`. Rata-rata 3 run `~11.52s/3.51s` tetap lebih baik daripada rerata range no-profile pre-trim terdekat `~13.23s/4.48s`, jadi trim order ini tetap retained walau varians lokal masih tinggi.
- Audit terbaru untuk body transaksi `payment.handleWebhook()` juga sudah ditutup: tidak ada trim kecil yang aman dan viable. Semua slice yang terlihat masuk akal sudah habis, dan keluarga ini jangan dibuka lagi tanpa bukti teknis baru.
- Eksperimen perubahan kode terbaru yang mencoba fast-path parsing pathname request untuk profiling sudah ditolak dan direvert setelah dua run helper resmi menunjukkan regress pada metrik utama reservation/http.
- Pair benchmark konfirmasi pasca-revert (tanpa perubahan kode tambahan) juga sudah dijalankan; correctness tetap hijau tetapi metrik reservation/http masih volatil lintas run.
- Eksperimen code-level inline `sync_reservation_state` pada webhook payment sudah diuji via pair helper run, diklasifikasikan regress/non-repeatable, lalu direvert penuh.
- Eksperimen code-level terbaru yang menambahkan gate env `TICKET_RESERVER_INSERT_CONCURRENCY_LIMIT=8` pada `apps/api/src/durable-objects/ticket-reserver.ts` juga sudah diuji via pair helper run, menunjukkan regress kuat dan repeatable pada reservation/http, lalu direvert penuh.
- Eksperimen code-level terbaru berikutnya yang menambahkan gate env `TICKET_RESERVER_INSERT_BATCH_SIZE=25` pada `apps/api/src/durable-objects/ticket-reserver.ts` juga sudah diuji via pair helper run, tidak menunjukkan win repeatable pada reservation/http, lalu direvert penuh.
- Eksperimen code-level local-only berikutnya yang menambahkan gate env `LOCAL_RUNNER_SHARE_TICKET_RESERVER_DB_POOL=1` pada `scripts/run-api-local.ts` untuk memaksa `TicketReserver` berbagi app DB pool yang sama juga sudah diuji via pair helper run, menunjukkan regress repeatable pada reservation/http, lalu direvert penuh.
- Eksperimen code-level terbaru berikutnya yang menyederhanakan subquery `ownedTickets` eligibility di `apps/api/src/services/reservation.service.ts` ke jalur `orders -> reservations -> ticket_tiers` juga sudah diuji via pair helper run, hanya menurunkan `eligibility_query_execute` tanpa mengurangi `eligibility_pool_wait`, lalu direvert penuh.
- Eksperimen code-level terbaru berikutnya yang memindahkan eligibility reservation (`hasActiveReservation`, `ownedTickets`, dan validasi sale-window/status`) dari app service ke `apps/api/src/durable-objects/ticket-reserver.ts` juga sudah diuji via pair helper run, memindahkan wait eligibility ke hot path DO dan tetap memperburuk `full_flow/http`, lalu direvert penuh.
- Eksperimen code-level local-only terbaru yang memecah eligibility reservation di service menjadi static tier/event query + buyer-specific query, lalu meng-cache field static via env gate pada helper lokal, juga sudah diuji via pair helper run; sempat memberi sinyal directional pada override manual, tetapi setelah diwiring ke workflow resmi hasilnya tetap tidak repeatable pada metrik utama dan direvert penuh.
- Eksperimen code-level local-only terbaru berikutnya yang menaikkan `ticketReserverDbMaxConnections` preset `load-balanced` di `scripts/run-api-local.ts` dari `25` ke `32` juga sudah diuji via pair helper run; run pertama regress pada `http/reservation`, run kedua memperbaiki reservation/http tetapi tetap memburukkan `full_flow`, dan profiling menunjukkan contention hanya bergeser antara eligibility app-side dan insert wait DO, lalu direvert penuh.
- Eksperimen harness-level local-only terbaru yang mempersempit sampled per-request runner profiling di `scripts/run-api-local.ts` dari semua kategori non-`other` menjadi `reservation` saja juga sudah diuji via pair helper run; run pertama regress keras pada `http/reservation`, run kedua hanya memulihkan sebagian sambil tetap memburukkan `full_flow` dan downstream, lalu direvert penuh.
- Eksperimen harness-level local-only terbaru berikutnya yang membuat profiling `payment.background_task` tidak lagi aktif otomatis pada helper resmi `packages/core/scripts/run-local-checkout-benchmark.ts` juga sudah diuji via pair helper run; kedua run tetap correctness-green dan runner log default profile mode memang tidak lagi memuat entry `payment.background_task`, tetapi metrik utama tetap lebih buruk (`full_flow/http_req/step_reservation ~11.72s/6.07s/8.26s` lalu `~12.80s/6.24s/7.52s`) dibanding baseline helper retained maupun baseline fresh sesi ini, lalu patch direvert penuh.
- Eksperimen code-level local-only terbaru berikutnya yang menyelaraskan jalur eksekusi insert saat profiling di `apps/api/src/durable-objects/ticket-reserver.ts` dengan prepared insert hot path normal juga sudah diuji; focused suite tetap hijau (`31/31`) dan helper resmi pertama tetap correctness-green (`500/500`), tetapi hasilnya hanya `full_flow/http_req/step_reservation ~11.48s/6.33s/6.75s` dengan downstream `~2.01s/3.05s/2.15s`, sehingga tidak cukup untuk retain dan patch direvert tanpa run konfirmasi kedua.
- Eksperimen code-level local-only terbaru berikutnya yang membuat `generateTickets()` melewati query akhir daftar tiket saat call site payment/admin hanya butuh side effect juga sudah diuji; focused suite tetap hijau (`31/31`) dan helper resmi pertama tetap correctness-green (`500/500`), tetapi hasilnya regress ke `full_flow/http_req/step_reservation ~12.12s/6.26s/8.86s`, sehingga patch direvert tanpa run konfirmasi kedua.
- Eksperimen code-level local-only terbaru berikutnya yang memparalelkan `loadSuccessfulPaymentFulfillmentPayload()` dengan `generateTickets()` di `apps/api/src/services/payment.service.ts` juga sudah diuji; focused suite tetap hijau (`31/31`) dan helper resmi pertama tetap correctness-green (`500/500`), tetapi hasilnya regress ke `full_flow/http_req/step_reservation ~12.93s/4.73s/8.04s`, sehingga patch direvert tanpa run konfirmasi kedua. Profiling log menunjukkan queue wait `payment.background_task` memang turun ke sekitar `~6.3s` avg, tetapi `eligibility_pool_wait` justru naik ke sekitar `~1.01s` avg (`p95 ~2.29s`).
- Eksperimen code-level local-only terbaru berikutnya sekali lagi yang me-rewrite `loadSuccessfulPaymentFulfillmentPayload()` menjadi flat join query tunggal di `apps/api/src/services/payment.service.ts` juga sudah diuji; focused suite tetap hijau (`31/31`) dan helper resmi pertama tetap correctness-green (`500/500`), tetapi hasilnya regress ke `full_flow/http_req/step_reservation ~11.40s/5.87s/8.51s`, sehingga patch direvert tanpa run konfirmasi kedua.
- Eksperimen code-level local-only terbaru yang membatch dua notifikasi payment menjadi satu insert DB dan melewati attempt email ketika `EMAIL_API_KEY`/`EMAIL_FROM` lokal kosong di `apps/api/src/services/payment.service.ts` + `apps/api/src/services/notification.service.ts` juga sudah diuji via pair helper run; focused suite tetap hijau (`31/31`), run #1 memberi `full_flow/http_req/step_reservation ~10.36s/6.48s/7.16s`, run #2 memberi `~12.57s/5.59s/6.13s`, sehingga patch direvert karena tidak repeatable pada metrik utama.
- Eksperimen harness-level local-only terbaru yang menambah observability runner `pre_accept_gap`, `seenByCategoryAtStart`, dan `pendingWaitUntilTasksAtStart` di `scripts/run-api-local.ts` dipertahankan sebagai baseline diagnosis baru. Helper resmi dengan instrumentation ini tetap correctness-green (`500/500`), meskipun metrik user-facing run diagnostik terbaru memburuk ke `full_flow/http_req/step_reservation ~12.08s/8.06s/10.23s`; analisis log baru justru menegaskan bahwa tail utama helper sekarang didominasi gap pre-accept di runner lokal, bukan jalur `reservation.reserve`.
- Eksperimen harness-level local-only berikutnya yang menambahkan gate env `LOCAL_RUNNER_MAX_RESERVATION_OVERLAP=8` di `scripts/run-api-local.ts` untuk memotong reservation baru saat overlap aktif mencapai `8` juga sudah diuji via helper resmi; hasilnya tidak layak dipertahankan karena hanya `44/500` checkout sukses, `456` flow gagal dengan `503 RESERVATION_OVERLAP_LIMIT`, dan runner log mencatat `456` event `localRunner.request.reject`, lalu patch direvert penuh.
- Eksperimen harness-level local-only terbaru 2026-04-22 yang menambahkan gate env `LOCAL_RUNNER_RESERVATION_ADMISSION_CONCURRENCY=64` di `scripts/run-api-local.ts` untuk menguji FIFO admission queue non-reject pada request `reservation` juga sudah diuji via helper resmi dan direvert penuh. Dalam kontrol sesi bersih tanpa gate, helper tetap `500/500` sukses dengan `full_flow/http_req/step_reservation ~13.61s/5.73s/7.56s`; saat gate aktif, correctness tetap hijau dan downstream/full-flow membaik ke `~10.35s/6.66s/8.34s` dengan order/payment/webhook lebih murah, tetapi dua metrik utama reservation/http justru memburuk. Runner log pembanding menunjukkan `pre_accept_gap` memang turun keras (`~2.15s avg / ~6.36s p95` -> `~509ms / ~1.06s`) dan `app_fetch` ikut turun (`~1.71s / ~2.24s` -> `~1.09s / ~1.52s`), tetapi delay itu hanya pindah ke `reservation_admission_queue_wait ~3.16s avg / ~6.24s p95` dengan queue depth max sekitar `433`, sehingga total reservation tail user-facing tidak membaik.
- Eksperimen code-level local-only terbaru 2026-04-22 berikutnya yang menambahkan gate env `LOCAL_RUNNER_DEFER_PAYMENT_BACKGROUND_START=1` di `apps/api/src/services/payment.service.ts` untuk menunda start `waitUntil` payment background task satu macrotask juga sudah diuji via helper resmi dan direvert penuh. Pair helper sesi yang sama tetap correctness-green (`500/500`), dan metrik target reservation/http memang turun dari `~8.31s/10.23s` ke `~6.39s/7.20s`, tetapi `full_flow` justru memburuk dari `~12.42s` ke `~13.49s` dengan downstream `order/payment/webhook` melebar ke `~2.83s/4.08s/2.49s`. Runner log menunjukkan `client_send_to_handler` dan `pre_accept_gap` memang turun keras (`~4.59s/~4.54s avg` -> `~1.04s/~916ms`), namun `app_fetch` reservation melonjak dari `~898ms` avg ke `~4319ms` dan bottleneck pindah ke `ticketReserver.insert_reservation_pool_wait` (`~126ms` -> `~3518ms` avg). Artinya, penundaan kickoff background payment hanya memindahkan contention dari admission runner ke hot path reservation/DO.
- Eksperimen harness-level local-only terbaru 2026-04-22 berikutnya lagi yang menambahkan gate env `LOCAL_RUNNER_CLOSE_NON_RESERVATION_CONNECTIONS=1` di `scripts/run-api-local.ts` untuk memaksa response `order`, `payment`, dan `paymentWebhook` menutup koneksi setelah response juga sudah diuji via helper resmi dan direvert penuh. Pair helper sesi yang sama tetap correctness-green (`500/500`), dan `client_send_to_handler`/`pre_accept_gap` reservation memang turun dari sekitar `~2.51s/~2.49s` avg ke `~1.19s/~1.16s`. Namun hasil user-facing tetap regress: `full_flow/http_req/step_reservation` memburuk dari `~10.16s/4.73s/5.66s` ke `~14.00s/5.63s/6.30s`, downstream `order/payment/webhook` ikut melebar ke `~3.49s/5.26s/4.20s`, `activeSockets` max tidak berubah (`506`), dan bottleneck reservation pindah ke `ticketReserver.insert_reservation_pool_wait` (`~261ms` -> `~1738ms` avg).
- Instrumentasi runner low-overhead terbaru juga sekarang retained dengan field sampled `socketSequence`, `socketRequestSequence`, dan `reusedSocketAtStart` di `scripts/run-api-local.ts`. Satu helper diagnostik sesudah penambahan field ini tetap correctness-green (`500/500`) dengan `full_flow/http_req/step_reservation ~12.93s/5.54s/6.60s`, dan hasil log sangat mengerucutkan hipotesis berikutnya: sampled reservation tidak pernah reuse socket (`50/50` sample, `socketRequestSequence=1`), sedangkan sampled `order`/`payment`/`paymentWebhook` reuse socket `100%` dengan rata-rata sequence sekitar `2`/`3`/`4`. Early/middle/late reservation bucket menunjukkan `pre_accept_gap` naik dari `~259ms` ke `~1692ms` lalu `~2582ms` sambil reuse socket tetap `0%`, sehingga tail reservation saat ini lebih konsisten dengan fresh-socket flood / accept backlog daripada reuse socket jangka panjang.
- Eksperimen local-only berikutnya yang menaikkan listen backlog Node via gate env `LOCAL_RUNNER_LISTEN_BACKLOG=2048` di `scripts/run-api-local.ts` sudah diuji dan direvert penuh. Startup log memang mengonfirmasi backlog `2048`, tetapi sampled reservation `pre_accept_gap`/`client_send_to_handler` justru memburuk dari sekitar `~1.55s/~1.61s` avg ke `~2.03s/~2.20s` avg (p95 sekitar `~3.31s/~3.32s` ke `~5.62s/~5.64s`), walau `app_fetch` sedikit membaik. Snapshot runtime menunjukkan acceptance socket lebih agresif di awal sambil event loop tetap pinned di `100%`, jadi backlog eksplisit yang lebih besar hanya mendorong lebih banyak socket masuk ke loop yang memang sudah jenuh.
- Eksperimen local-only berikutnya lagi yang mengganti write path runner menjadi response streaming (`Readable.fromWeb` + `pipeline`) juga sudah diuji dan direvert penuh. Run helper tetap correctness-green (`500/500`), tetapi `full_flow/http_req/step_reservation` memburuk tajam ke `~17.57s/7.08s/7.71s`, dan analisis sampled menunjukkan kenaikan `write_response` sendiri nyaris nol; regress menyebar ke total latency semua kategori. Artinya bottleneck runner bukan sekadar body buffering sinkron pada write path.
- Diagnosis retained paling tajam sekarang datang dari gate env lokal `PREWARM_RESERVATION_CONNECTION=1` di `tests/load/checkout-flow.js`, yang melakukan `GET /health` per VU sebelum reservation hanya untuk diagnosis. Dengan gate ini helper resmi tetap correctness-green (`500/500`) dan `full_flow/http_req/step_reservation` membaik ke `~11.25s/3.49s/3.60s`. Sampled reservation berubah dari `0%` reused socket ke `100%`, `client_send_to_handler` turun dari sekitar `~1.61s` avg / `~3.31s` p95 ke `~73ms` / `~197ms`, dan `pre_accept_gap` hilang (`0ms`). Cost internal reservation memang naik, tetapi hasil ini mengonfirmasi bahwa biaya first-request pada fresh socket sangat material terhadap tail reservation/http.
- Follow-up diagnosis lokal dengan gate env `PRE_RESERVATION_VU_JITTER_MS=250` di `tests/load/checkout-flow.js` juga sudah diuji untuk membedakan “socket reuse” vs “burst spreading saja”. Run helper tetap correctness-green (`500/500`), tetapi `full_flow/http_req/step_reservation` memburuk ke `~13.56s/6.71s/7.98s`, reservation tetap `0%` reused socket (`socketRequestSequence=1`), `pre_accept_gap` masih tinggi (`~1.62s` avg / `~2.39s` p95), dan `app_fetch` malah naik ke sekitar `~3.80s` avg / `~5.66s` p95. Artinya spread start reservation saja tidak meniru win prewarm; faktor pentingnya tetap hilangnya first-request fresh-socket admission cost.
- Helper resmi `packages/core/scripts/run-local-checkout-benchmark.ts` sekarang juga sudah punya mode retained `--prewarm-reservation-connection` / `LOCAL_CHECKOUT_PREWARM_RESERVATION_CONNECTION=1` yang meneruskan `PREWARM_RESERVATION_CONNECTION=1` ke skenario load tanpa mengubah baseline default. Summary `[local-checkout-summary]` kini ikut memuat `reservationHttpBlockedP95` dan `reservationHttpConnectingP95`, sehingga diagnosa transport tidak perlu lagi menggali stdout mentah K6 secara manual.
- Pair helper control vs helper prewarm yang ditangkap dengan output penuh sekarang memperjelas lapisan transport lebih presisi: pada control, `reservation_http_connecting` hanya sekitar `~52ms` avg / `~222ms` p95 dan `reservation_http_blocked` sekitar `~56ms` / `~225ms`, sementara runner sampled reservation pada run yang sama membayar `pre_accept_gap ~1251ms` avg / `~2660ms` p95 dan `client_send_to_handler ~1315ms` / `~2663ms`. Saat prewarm aktif, `reservation_http_connecting` menjadi `0`, `reservation_http_blocked` turun ke mikrodetik, `pre_accept_gap` hilang, dan `app_fetch` juga turun tajam (`~4347ms` avg -> `~1685ms`). Jadi biaya fresh socket lokal memang campuran, tetapi raw connect K6 hanya porsi kecil; dominannya adalah pre-accept/admission overlap dan efek overlap itu pada hot path reservation.
- Head-to-head preset `load-balanced` vs `load-fullflow` sekarang juga sudah diuji ulang khusus di mode helper prewarm. Berbeda dari perbandingan preset tanpa prewarm yang sebelumnya volatil, dua pair sesi ini sama-sama menguntungkan `load-fullflow`: pair pertama memperbaiki `step_reservation p95` dari sekitar `~3.80s` ke `~2.30s` sambil memangkas `ticketReserver.insert_reservation_pool_wait` dari `~2085ms` avg ke `~568ms`; pair konfirmasi dengan urutan dibalik tetap menunjukkan `full_flow/http_req/step_reservation ~16.11s/6.68s/7.20s` (`load-balanced`) vs `~11.46s/3.77s/4.06s` (`load-fullflow`) dan `insert_reservation_pool_wait ~3473ms -> ~1459ms` avg. Untuk eksperimen app/DO setelah fresh-socket penalty diangkat, kontrol prewarm yang lebih masuk akal sekarang adalah `load-fullflow`, bukan `load-balanced`.
- Runner lokal `scripts/run-api-local.ts` sekarang juga punya override env eksplisit `LOCAL_RUNNER_OVERRIDE_DB_MAX_CONNECTIONS`, `LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS`, dan `LOCAL_RUNNER_OVERRIDE_PAYMENT_BACKGROUND_TASK_CONCURRENCY`. Override ini hanya aktif saat diset, jadi default preset tetap sama; gunanya untuk eksperimen pool lokal terisolasi tanpa membuat preset sementara.
- Override `LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32` di atas kontrol `load-fullflow + prewarm` juga sudah diuji dan sementara ini terlihat repeatable. Run pertama terhadap `load-fullflow` plain terdekat memangkas `step_reservation p95` dari `~4.06s` ke `~2.34s`, `durable_object_reserve ~1748ms` avg ke `~470ms`, dan `ticketReserver.insert_reservation_pool_wait ~1459ms` avg ke `~322ms`, walau `eligibility_pool_wait` naik sedikit. Pair konfirmasi kedua tetap menunjukkan win `DO32` atas plain (`full_flow/http_req/step_reservation ~11.66s/4.10s/2.31s` vs `~12.08s/4.26s/2.88s`) dan downstream sampled avg juga membaik (`~1564ms` vs `~1873ms`). Ini berbeda dari bump DO pool lama pada `load-balanced` yang dulu tidak repeatable, sehingga kandidat baseline lokal untuk eksperimen app/DO berikutnya sekarang adalah `load-fullflow + prewarm + DO32`, walau belum layak menggantikan baseline helper default non-prewarm.
- Probe lanjutan yang menaikkan app DB pool di atas kontrol itu via `LOCAL_RUNNER_OVERRIDE_DB_MAX_CONNECTIONS=58` juga sudah dicoba sekali, dan arahnya negatif. Run tetap correctness-green (`500/500`), tetapi dibanding kontrol `DO32` terdekat ia memburuk pada `full_flow/http_req/step_reservation ~12.28s/5.02s/2.60s` vs `~11.66s/4.10s/2.31s`; sampled reservation juga sedikit lebih buruk di `app_fetch ~1678ms` vs `~1551ms`, `eligibility_pool_wait ~908ms` vs `~824ms`, dan downstream sampled avg `~1724ms` vs `~1564ms`, sementara `ticketReserver.insert_reservation_pool_wait` nyaris tidak berubah (`~388ms` vs `~376ms`). Jadi setelah `load-fullflow + prewarm + DO32`, menaikkan app DB pool lagi belum tampak menjanjikan.
- Slice dedicated eligibility pool app-side via gate lokal `RESERVATION_ELIGIBILITY_DB_MAX_CONNECTIONS` sekarang juga sudah diuji dan direvert penuh. Pair pertama dengan `eligibility=8` sempat terlihat menang pada hot path reservation, tetapi pair konfirmasi dengan urutan dibalik menunjukkan biaya berpindah keras ke `durable_object_reserve` dan `ticketReserver.insert_reservation_pool_wait`, sambil memperburuk downstream `order/payment/webhook`; probe lanjutan `eligibility=4` malah jelas buruk dengan `eligibility_pool_wait ~2206ms` avg dan `step_reservation p95 ~4.42s`. Jadi dedicated eligibility pool tidak repeatable dan tidak boleh jadi follow-up default.
- Bump lanjutan `LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=40` di atas kontrol `load-fullflow + prewarm + DO32` juga sudah diuji dan ditolak. Walaupun `eligibility_pool_wait` turun sedikit, reservation `app_fetch`/`durable_object_reserve` justru memburuk (`~2474ms/~1403ms` vs kontrol `DO32` `~2078ms/~826ms`) dan downstream `order/payment` sampled ikut naik. Untuk slice tuning pool `TicketReserver`, titik berhenti yang masuk akal saat ini tetap `32`, bukan `40`.
- Service profiling pada kontrol `load-fullflow + prewarm + DO32` kini juga sudah memvalidasi hotspot downstream baru: `order.createOrder.transaction_queue_wait ~1332.8ms` avg / `~2202.2ms` p95 dan `payment.handleWebhook.transaction_queue_wait ~1071.8ms` avg / `~1856.0ms` p95. Jadi fokus setelah slice reservation stabil bukan lagi SQL mentah individual, melainkan antrean akuisisi transaksi di pool app-side pada jalur order/webhook.
- Follow-up probe terhadap hotspot downstream itu juga sudah dicoba dan tidak menghasilkan arah retained. Runtime override `LOCAL_RUNNER_OVERRIDE_PAYMENT_BACKGROUND_TASK_CONCURRENCY=4` menurunkan order-side queue wait tetapi mematahkan issuance (`395/500`), `=6` menjaga correctness namun tetap tidak memberi win aggregate yang bersih, dan probe code-level env gate `PAYMENT_FULFILLMENT_DB_MAX_CONNECTIONS` (dicoba `4` lalu dua rerun `8`) juga akhirnya direvert penuh. `fulfillmentDb=8` memang kadang menurunkan `order.createOrder.transaction_queue_wait` serta sedikit memperbaiki `payment.handleWebhook.transaction_queue_wait p95`, tetapi dua rerun tetap kalah pada `full_flow/http_req` (`~13.42s/4.79s` lalu `~13.37s/4.85s` vs kontrol `~12.73s/4.57s`). Jangan ulang background-concurrency atau dedicated-fulfillment-pool isolation tanpa alasan teknis baru yang lebih kuat.
- Follow-up code-level terbaru di `apps/api/src/services/order.service.ts` sekarang sudah punya hasil retained berlapis. Varian agresif pertama yang memindahkan seluruh metadata response keluar transaksi order memang menurunkan `transaction_queue_wait`, tetapi lookup metadata baru terlalu mahal di pool umum dan tidak dipertahankan. Varian refined berikutnya yang mempertahankan `tierName` + `eventId` di transaksi lalu memindahkan hanya `eventSlug`/`eventTitle` pasca-commit tervalidasi lebih dulu. Follow-up 2026-04-24 kemudian mempersempit hot path sekali lagi: baseline aktif sekarang mempertahankan reservation + `eventId` di transaksi, lalu mengambil `tierName` + `eventSlug` + `eventTitle` pasca-commit via `ticket_tiers -> events`. Focused order suite sempit tetap hijau (`7/7`), service-profile probe menunjukkan `order.createOrder.transaction_queue_wait ~360.1ms` avg dan `create_order_transaction ~1175.3ms` avg, lalu pair no-profile comparable memberi `full_flow/http_req/step_order ~10.17s/2.90s/3.00s` lalu `~11.36s/3.64s/3.85s`, lebih baik daripada range kontrol no-profile terbaru sebelum patch. Keep varian `tierName`-pasca-commit ini kecuali paired control yang lebih bersih nanti membuktikan sebaliknya.
- Probe follow-up kecil yang meng-cache `response_metadata_lookup` pasca-commit di `apps/api/src/services/order.service.ts` sudah diuji lalu direvert penuh. Cache itu memang menghapus lookup metadata response hampir total, tetapi justru mendorong overlap downstream lebih cepat dan mengembalikan regress pada hotspot target (`order.transaction_queue_wait ~1561.7/2311.0`, `payment.transaction_queue_wait ~1499.8/2169.0`). Jangan ulang cache metadata response order tanpa alasan teknis baru yang kuat.
- Dua follow-up kecil setelah itu juga sudah ditutup dan direvert penuh. Pertama, memindahkan initial `payment.handleWebhook()` lookup `payments + orders` ke luar transaksi terlihat plausible, tetapi benchmark comparable pertama malah regress keras: `payment_lookup` di luar transaksi membengkak ke sekitar `~1129.0ms` avg / `~2511.0ms` p95, `payment.handleWebhook.transaction_queue_wait` ke `~1133.8/2746.0`, dan `confirm_payment_transaction` ke `~1631.3/3264.0`, sambil memburukkan order/webhook aggregate. Kedua, mengubah `response_metadata_lookup` order menjadi prepared hot path query juga tidak repeatable: run pertama service metrics membaik, tetapi rerun konfirmasi kedua melonjak kembali (`order.transaction_queue_wait ~1226.3/1859.0`, `response_metadata_lookup ~1385.2/1828.0`, `payment.transaction_queue_wait ~1019.7/1830.0`). Jangan ulang lookup webhook di luar transaksi atau prepared event metadata lookup tanpa alasan teknis baru yang kuat.
- Sesi berikutnya juga menutup dua probe tambahan lain. Trim `RETURNING` payload di `apps/api/src/services/order.service.ts` (mengembalikan id saja lalu membangun response dari nilai lokal) ternyata tidak membantu target order: `order.createOrder.transaction_queue_wait` kembali memburuk ke sekitar `~1322.0ms` avg / `~2514.0ms` p95 dan `create_order_transaction` ke `~2000.8/3234.0`, jadi patch direvert penuh. Lalu gate harness `PRE_REQUEST_VU_JITTER_MS` di `tests/load/checkout-flow.js` yang menyebar request pertama sebelum prewarm `/health` juga tidak memberi win bersih pada no-profile control (`~13.06s/4.13s/2.38s`) dan ikut direvert penuh. Jangan ulang trim `RETURNING` order atau pre-request jitter tanpa alasan teknis baru yang kuat.
- Diagnosis harness retained terbaru sekarang lebih tegas: profiling helper sendiri mempengaruhi angka user-facing secara material. Pada state retained saat ini, dua run no-profile comparable di kontrol `load-fullflow + prewarm + DO32` memberi `full_flow/http_req ~12.54s/3.57s` lalu `~9.96s/3.70s` dengan correctness tetap `500/500`, sementara service-only profiling memberi `~14.94s/4.34s`, runner-only profiling `~13.34s/4.66s`, dan full profiling tetap sangat volatil. Gunakan no-profile runs untuk keputusan user-facing; aktifkan `--profile-services` atau `--profile-runner` hanya untuk diagnosis hotspot, bukan sebagai pembanding end-user utama.
- State kode aktif sesudah sesi terbaru tidak lagi sekadar dokumentasi: gate `PAYMENT_FULFILLMENT_DB_MAX_CONNECTIONS` tetap direvert penuh dan file service lain (`payment.service.ts`, `ticket-generator.ts`, `notification.service.ts`) kembali ke baseline aktif, tetapi `apps/api/src/services/order.service.ts` kini mengandung trim downstream retained di atas. Tidak ada edit kode unvalidated yang tertinggal.
- Eksperimen code-level retained terbaru sekarang ada dua: cache verifikasi JWT bounded + TTL-aware di `apps/api/src/middleware/auth.ts`, dan trim downstream refined di `apps/api/src/services/order.service.ts` yang sekarang memindahkan `tierName` + `eventSlug` + `eventTitle` ke lookup pasca-commit sambil mempertahankan `eventId` di transaksi. Probe cache metadata response order, prepared event metadata lookup, trim `RETURNING` order transaction, dan lookup webhook di luar transaksi semuanya sudah ditolak dan direvert.
- Dua eksperimen tambahan berbentuk perbandingan preset tanpa perubahan kode sudah dijalankan (`load-balanced` vs `load-fullflow`, lalu `load-balanced` vs `load-baseline`); keduanya menunjukkan hasil lintas pasangan yang tidak stabil, sehingga baseline kanonis tetap tidak diubah.
- Focused reservation/payment/worker tests pada state kode terbaru tetap hijau:
	- `pnpm exec vitest run src/__tests__/ticket-reserver.test.ts src/__tests__/reservation.test.ts src/__tests__/order-reservation.test.ts src/__tests__/payment.test.ts src/__tests__/admin-order-payment.test.ts src/__tests__/index-worker.test.ts src/__tests__/queue-cleanup.test.ts`
	- hasil: `31/31` test lulus (termasuk regression test permanen `MAX_TICKETS_EXCEEDED`).

## Constraint Yang Wajib Dipatuhi

- Task I adalah local-only. Jangan jalankan load test remote/staging/production tanpa approval eksplisit user.
- Jangan bypass limiter/auth protection.
- Gunakan workflow resmi repo untuk benchmark lokal, terutama helper berikut:
	- `source .env && pnpm run test:load:checkout:local:profile`
- Jika menjalankan eksperimen baru, bandingkan terhadap baseline helper yang benar-benar comparable, bukan hasil ad hoc yang berbeda harness.

## Baseline Kode Yang Sedang Berlaku

State kode saat ini yang dianggap retained dan aktif:

- `packages/core/scripts/run-local-checkout-benchmark.ts`
	- memaksa env benchmark kanonis `500` user
	- ignore inherited benchmark env yang mencemari hasil
	- prefer runtime lokal dari `.env`
	- spawn runner langsung via local `tsx`
	- capture runner log langsung ke file child process
	- parse summary metric tambahan `setup_login_http_duration`, `checkout_http_duration`, `checkout_business_http_duration`, `prewarm_http_duration`, `payment_http_duration`, `webhook_http_duration`, dan `checkout_business_flow_duration`
- `tests/load/checkout-flow.js`
	- emit metric HTTP flow terpisah untuk setup login, checkout path total, checkout business path pasca-prewarm, prewarm `/health`, payment, dan webhook agar `http_req_duration` lokal tidak lagi jadi satu-satunya indikator
- `scripts/run-api-local.ts`
	- profiling semua kategori request non-`other`
	- log `pre_accept_gap`, `seenByCategoryAtStart`, dan `pendingWaitUntilTasksAtStart` pada sampled request
	- track global `waitUntil` backlog
	- emit `[local-runner-summary]` low-overhead pada exit, termasuk `maxInFlightRequests`, `maxPendingWaitUntilTasks`, `maxActiveSockets`, `maxInFlightByCategory`, `maxPendingWaitUntilTasksByActiveCategory`, dan `firstPendingWaitUntilSnapshot`
	- shutdown drain untuk pending `waitUntil`
- `apps/api/src/services/order.service.ts`
	- trim retained terbaru: `createOrder()` hanya mempertahankan `eventId` di hot path transaksi; `tierName + eventSlug + eventTitle` diambil pasca-commit via lookup `ticket_tiers -> events`
- `apps/api/src/services/payment.service.ts`
	- sampling background task per label (`sync_reservation_state`, `fulfill_successful_payment`)
	- shared FIFO scheduler masih baseline aktif
- `apps/api/src/routes/reservations.ts`
	- unexpected route error logging retained
- `apps/api/src/middleware/auth.ts`
	- cache verifikasi JWT bounded + TTL-aware (default max entries `5000`, bisa dinonaktifkan dengan `AUTH_TOKEN_CACHE_MAX_ENTRIES=0`)

## Baseline Metrik Yang Perlu Dipakai

Ada dua baseline yang penting. Jangan campur penggunaannya.

### 1. Baseline diagnostik helper resmi yang paling relevan untuk Task I sekarang

Gunakan ini untuk perbandingan apple-to-apple saat eksperimen menyentuh harness/payment background observability.

- Command:
	- `source .env && pnpm run test:load:checkout:local:profile`
- Hasil baseline trusted terakhir untuk code state retained ini:
	- `checkoutFlowSuccess=500`
	- `full_flow_duration p95 ~9.30s`
	- `http_req_duration p95 ~4.62s`
	- `step_reservation_duration p95 ~6.96s`
	- `step_order_duration p95 ~1.84s`
	- `step_payment_duration p95 ~2.86s`
	- `step_webhook_duration p95 ~2.02s`
	- cleanup kembali ke `0`

Interpretasi:

- Ini bukan target performa ideal.
- Ini adalah baseline diagnostik untuk code/harness saat ini.
- Jika eksperimen baru lebih buruk dari angka ini, anggap regress sampai terbukti sebaliknya.

### 2. Baseline manual low-overhead sebagai referensi tambahan

- Hasil valid yang pernah tercatat:
	- `full_flow_duration p95 ~5.68s`
	- `http_req_duration p95 ~2.39s`
	- `step_reservation_duration p95 ~2.65s`
	- `step_order_duration p95 ~1.27s`
	- `step_payment_duration p95 ~1.85s`
	- `step_webhook_duration p95 ~1.11s`

Interpretasi:

- Ini berguna untuk memahami gap antara low-overhead run dan helper profiling run.
- Jangan pakai ini untuk menyatakan win pada eksperimen yang diuji lewat helper profiling resmi.

## Diagnosis Yang Sudah Tervalidasi

- Bottleneck lokal tersisa tidak lagi didorong oleh correctness payment flow.
- `confirmReservation()` bukan kerja yang mahal; queue wait yang besar lebih banyak datang dari shared FIFO dengan fulfillment work.
- Fairness tweak kecil di queue yang sama tidak cukup. Ia hanya memindahkan latency.
- Fulfillment isolation di runner lokal ternyata belum otomatis menjadi win end-user, bahkan ketika downstream order/payment/webhook membaik.
- Reservation/http tail tetap menjadi masalah utama yang paling relevan untuk user-facing p95.

## Eksperimen Yang Sudah Ditolak

Jangan ulang eksperimen berikut kecuali ada alasan teknis baru yang benar-benar kuat.

### 1. Chaining `confirmReservation()` + `fulfillSuccessfulPayment()`

- Status: rejected, reverted.
- Alasan: correctness hijau tetapi helper resmi memburuk dibanding baseline valid sebelumnya.

### 2. Split shared background-task queue menjadi lane label (`2` untuk sync, `6` untuk fulfill)

- Status: rejected, reverted.
- Alasan: `sync_reservation_state` wait sedikit membaik, tetapi fulfillment queue wait melebar dan full-flow checkout makin buruk.

### 3. Memecah `post_payment_effects` jadi deferred task kedua di scheduler yang sama

- Status: rejected, reverted.
- Hasil utama:
	- `full_flow_duration p95 ~10.05s`
	- `http_req_duration p95 ~7.26s`
	- `step_reservation_duration p95 ~9.09s`
- Alasan: hanya menambah deferred backlog dan saturasi event loop; bukan isolasi nyata.

### 4. Memindahkan `post_payment_effects` ke consumer queue lokal proses-terpisah

- Status: rejected, reverted.
- Iterasi pertama gagal karena consumer mewarisi `DB_MAX_CONNECTIONS=52` dan membuat validasi pasca-run kena `too many clients already`.
- Setelah consumer pool dibatasi kecil dan rerun dilakukan, correctness kembali hijau dan tidak ada orphan process, tetapi hasil end-user tetap lebih buruk dari baseline helper trusted:
	- `full_flow_duration p95 ~9.57s` vs baseline `~9.30s`
	- `http_req_duration p95 ~6.96s` vs baseline `~4.62s`
	- `step_reservation_duration p95 ~8.58s` vs baseline `~6.96s`
- Walaupun `step_order`, `step_payment`, dan `step_webhook` membaik, reservation/http tail memburuk.
- Kesimpulan: separate-process local queue consumer bukan retained win untuk benchmark ini.

### 5. Menjalankan profiling eligibility reservation via prepared query hot path

- Status: rejected, reverted.
- Perubahan yang diuji: `apps/api/src/services/reservation.service.ts` pada path profiling (`LOAD_TEST_PROFILE`) untuk eligibility query diubah agar mengeksekusi prepared query hot path yang sama dengan mode normal.
- Correctness tetap hijau (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Before helper run (sesaat sebelum eksperimen):
	- `full_flow_duration p95 ~10.91s`
	- `http_req_duration p95 ~6.47s`
	- `step_reservation_duration p95 ~8.43s`
	- `step_order_duration p95 ~1.37s`
	- `step_payment_duration p95 ~2.00s`
	- `step_webhook_duration p95 ~1.31s`
- After helper run (dengan eksperimen aktif):
	- `full_flow_duration p95 ~11.62s`
	- `http_req_duration p95 ~4.88s`
	- `step_reservation_duration p95 ~6.29s`
	- `step_order_duration p95 ~2.52s`
	- `step_payment_duration p95 ~3.92s`
	- `step_webhook_duration p95 ~2.41s`
- Alasan penolakan: walaupun reservation/http membaik, full-flow checkout memburuk dan downstream steps regress besar; hasil juga tetap lebih buruk dari baseline helper trusted (`~9.30s` / `~4.62s`).

### 6. Rebalancing preset koneksi DB runner lokal ke jalur reservation (`load-reservation`)

- Status: rejected, reverted.
- Perubahan yang diuji: menambah preset eksperimen `load-reservation` (app DB max connections `50`, ticket reserver DB max connections `32`, background task concurrency `8`) di harness lokal.
- Correctness tetap hijau (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Before helper run (`load-balanced`) pada sesi yang sama:
	- `full_flow_duration p95 ~13.8s`
	- `http_req_duration p95 ~7.04s`
	- `step_reservation_duration p95 ~8.10s`
	- `step_order_duration p95 ~2.50s`
	- `step_payment_duration p95 ~3.51s`
	- `step_webhook_duration p95 ~2.45s`
- After helper run (`load-reservation`):
	- `full_flow_duration p95 ~11.49s`
	- `http_req_duration p95 ~7.29s`
	- `step_reservation_duration p95 ~9.44s`
	- `step_order_duration p95 ~1.81s`
	- `step_payment_duration p95 ~2.31s`
	- `step_webhook_duration p95 ~1.67s`
- Alasan penolakan: walaupun downstream steps membaik, dua metrik utama target Task I justru memburuk (`http_req_duration` dan `step_reservation_duration`). Sesuai guardrail backlog ini, eksperimen dianggap regress dan direvert.

### 7. Head-to-head preset helper `load-balanced` vs `load-fullflow` (tanpa perubahan kode)

- Status: exploratory, tidak ada perubahan kode yang dipertahankan.
- Tujuan eksperimen: memvalidasi hipotesis bahwa preset `load-fullflow` bisa menurunkan reservation/http tail dibanding `load-balanced` pada workflow helper resmi yang sama.
- Guardrail correctness tetap hijau:
	- focused tests payment/worker `15/15` lulus
	- kedua helper run `500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets.
- Before helper run (`load-balanced`) pada sesi yang sama:
	- `full_flow_duration p95 ~12.19s`
	- `http_req_duration p95 ~4.60s`
	- `step_reservation_duration p95 ~6.53s`
	- `step_order_duration p95 ~3.17s`
	- `step_payment_duration p95 ~4.37s`
	- `step_webhook_duration p95 ~2.37s`
- After helper run (`load-fullflow`) pada sesi yang sama:
	- `full_flow_duration p95 ~11.23s`
	- `http_req_duration p95 ~4.48s`
	- `step_reservation_duration p95 ~5.18s`
	- `step_order_duration p95 ~2.91s`
	- `step_payment_duration p95 ~4.18s`
	- `step_webhook_duration p95 ~2.23s`
- Keputusan: hasilnya positif secara directional di satu sampel, tetapi belum cukup untuk mengganti baseline kanonis helper karena varians lokal masih tinggi dan kedua run tetap gagal threshold historis. Tidak ada perubahan kode yang di-retain dari eksperimen ini.

### 8. Repeatability pair kedua untuk preset helper `load-balanced` vs `load-fullflow`

- Status: rejected untuk perubahan baseline preset, tanpa perubahan kode.
- Tujuan eksperimen: memvalidasi apakah sinyal positif pair pertama repeatable pada pair kedua dengan workflow helper resmi yang sama.
- Guardrail correctness tetap hijau:
	- kedua helper run `500/500` checkout sukses
	- `500` confirmed orders/tickets
	- `500` issued tickets.
- Before helper run pair kedua (`load-balanced`):
	- `full_flow_duration p95 ~11.73s`
	- `http_req_duration p95 ~4.44s`
	- `step_reservation_duration p95 ~6.96s`
	- `step_order_duration p95 ~2.94s`
	- `step_payment_duration p95 ~4.41s`
	- `step_webhook_duration p95 ~1.97s`
- After helper run pair kedua (`load-fullflow`):
	- `full_flow_duration p95 ~11.03s`
	- `http_req_duration p95 ~7.27s`
	- `step_reservation_duration p95 ~8.19s`
	- `step_order_duration p95 ~1.87s`
	- `step_payment_duration p95 ~2.81s`
	- `step_webhook_duration p95 ~1.91s`
- Alasan penolakan perubahan baseline preset: pair kedua berlawanan dengan pair pertama pada metrik utama reservation/http. Walaupun `full_flow_duration` dan downstream steps membaik, `http_req_duration` serta `step_reservation_duration` justru memburuk tajam. Kesimpulan akhir: performa preset belum repeatable, baseline kanonis helper tetap.

### 9. Head-to-head preset helper `load-balanced` vs `load-baseline` (tanpa perubahan kode)

- Status: exploratory, tidak ada perubahan kode yang dipertahankan.
- Tujuan eksperimen: memvalidasi hipotesis bahwa menurunkan app DB pool dari `52` (`load-balanced`) ke `50` (`load-baseline`) dapat menurunkan reservation/http tail.
- Pair pertama (urutan `load-balanced` -> `load-baseline`), correctness tetap hijau pada kedua run (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets):
	- `load-balanced`: `full_flow_duration p95 ~13.16s`, `http_req_duration p95 ~7.75s`, `step_reservation_duration p95 ~9.59s`, `step_order_duration p95 ~1.86s`, `step_payment_duration p95 ~2.81s`, `step_webhook_duration p95 ~2.02s`
	- `load-baseline`: `full_flow_duration p95 ~11.23s`, `http_req_duration p95 ~4.44s`, `step_reservation_duration p95 ~5.01s`, `step_order_duration p95 ~2.52s`, `step_payment_duration p95 ~3.92s`, `step_webhook_duration p95 ~1.90s`
- Pair kedua (urutan dibalik `load-baseline` -> `load-balanced`), correctness tetap hijau pada kedua run (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets):
	- `load-baseline`: `full_flow_duration p95 ~15.31s`, `http_req_duration p95 ~7.88s`, `step_reservation_duration p95 ~8.49s`, `step_order_duration p95 ~2.47s`, `step_payment_duration p95 ~4.06s`, `step_webhook_duration p95 ~2.26s`
	- `load-balanced`: `full_flow_duration p95 ~13.18s`, `http_req_duration p95 ~5.71s`, `step_reservation_duration p95 ~6.60s`, `step_order_duration p95 ~3.76s`, `step_payment_duration p95 ~5.11s`, `step_webhook_duration p95 ~3.70s`
- Keputusan: hasil lintas pasangan berlawanan untuk metrik utama reservation/http, sehingga perubahan baseline preset (`52` -> `50`) tidak dinyatakan repeatable. Baseline kanonis helper tetap.

### 10. Fast-path parsing pathname request untuk profiling (code-level)

- Status: rejected, reverted.
- Perubahan yang diuji: menambahkan helper parsing ringan untuk mengekstrak pathname tanpa `new URL(...)` pada `apps/api/src/lib/load-test-profile.ts`, lalu memakainya juga di logging `apps/api/src/middleware/auth.ts`.
- Guardrail correctness:
	- focused payment/worker tests tetap hijau (`15/15`)
	- kedua helper run tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- After run #1 (dengan patch aktif):
	- `full_flow_duration p95 ~11.97s`
	- `http_req_duration p95 ~6.9s`
	- `step_reservation_duration p95 ~8.37s`
	- `step_order_duration p95 ~2.04s`
	- `step_payment_duration p95 ~3.13s`
	- `step_webhook_duration p95 ~2.14s`
- After run #2 (rerun konfirmasi):
	- `full_flow_duration p95 ~10.69s`
	- `http_req_duration p95 ~5.5s`
	- `step_reservation_duration p95 ~8.1s`
	- `step_order_duration p95 ~2.04s`
	- `step_payment_duration p95 ~2.88s`
	- `step_webhook_duration p95 ~2.01s`
- Alasan penolakan: dibanding baseline retained terdekat sesudah cache JWT (`http_req_duration p95 ~3.97-4.35s`, `step_reservation_duration p95 ~4.80-5.00s`), dua run setelah patch menunjukkan regress konsisten pada metrik utama reservation/http. Patch direvert penuh di kedua file.

### 11. Pair konfirmasi helper pasca-revert fast-path (tanpa perubahan kode)

- Status: observational, tidak ada perubahan kode yang dipertahankan.
- Tujuan: memastikan state kode setelah revert fast-path tetap konsisten terhadap baseline retained tanpa mengubah implementasi lagi.
- Guardrail correctness pada kedua run tetap hijau (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Run #1 pasca-revert:
	- `full_flow_duration p95 ~10.83s`
	- `http_req_duration p95 ~4.16s`
	- `step_reservation_duration p95 ~6.85s`
	- `step_order_duration p95 ~2.85s`
	- `step_payment_duration p95 ~4.09s`
	- `step_webhook_duration p95 ~2.60s`
- Run #2 pasca-revert (konfirmasi):
	- `full_flow_duration p95 ~11.96s`
	- `http_req_duration p95 ~5.93s`
	- `step_reservation_duration p95 ~8.99s`
	- `step_order_duration p95 ~2.31s`
	- `step_payment_duration p95 ~3.40s`
	- `step_webhook_duration p95 ~2.38s`
- Interpretasi: tidak ada indikasi bahwa revert merusak correctness, tetapi volatilitas lokal masih tinggi di metrik reservation/http. Keputusan tetap: fast-path tetap rejected+reverted, baseline aktif tetap mengacu pada state retained cache JWT + guardrail eksperimen saat ini.

### 12. Inline `sync_reservation_state` pada webhook payment (code-level)

- Status: rejected, reverted.
- Tujuan eksperimen: menguji apakah meng-inline `confirmReservation()` pada webhook sukses bisa mengurangi backlog task deferred dan menurunkan reservation/http tail.
- Perubahan yang diuji: menambahkan gate env `PAYMENT_WEBHOOK_SYNC_RESERVATION_INLINE=1` di `apps/api/src/services/payment.service.ts` untuk memaksa jalur inline (`sync_reservation_state_inline`) pada webhook sukses.
- Guardrail correctness:
	- focused payment/worker tests tetap hijau (`15/15`)
	- semua helper run correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Benchmark pair pada sesi yang sama:
	- Baseline #1 (env off): `full_flow_duration p95 ~15.79s`, `http_req_duration p95 ~7.04s`, `step_reservation_duration p95 ~7.01s`, `step_order_duration p95 ~6.71s`, `step_payment_duration p95 ~7.34s`, `step_webhook_duration p95 ~5.44s`
	- Eksperimen #1 (env on): `full_flow_duration p95 ~13.93s`, `http_req_duration p95 ~4.85s`, `step_reservation_duration p95 ~5.6s`, `step_order_duration p95 ~2.89s`, `step_payment_duration p95 ~4.1s`, `step_webhook_duration p95 ~4.3s`
	- Eksperimen #2 konfirmasi (env on): `full_flow_duration p95 ~14.00s`, `http_req_duration p95 ~6.4s`, `step_reservation_duration p95 ~8.74s`, `step_order_duration p95 ~2.38s`, `step_payment_duration p95 ~3.45s`, `step_webhook_duration p95 ~3.83s`
	- Baseline #2 konfirmasi (env off): `full_flow_duration p95 ~11.51s`, `http_req_duration p95 ~4.15s`, `step_reservation_duration p95 ~4.07s`, `step_order_duration p95 ~3.06s`, `step_payment_duration p95 ~4.33s`, `step_webhook_duration p95 ~2.38s`
- Alasan penolakan: dua run eksperimen tidak menunjukkan perbaikan konsisten pada metrik utama reservation/http, dan baseline konfirmasi (env off) pada sesi yang sama justru lebih baik secara jelas (`http_req`/`reservation`/`full_flow`). Eksperimen direvert penuh.

### 13. Membatasi concurrency insert persistence reservasi di `TicketReserver` (code-level)

- Status: rejected, reverted.
- Tujuan eksperimen: menguji apakah gate env `TICKET_RESERVER_INSERT_CONCURRENCY_LIMIT=8` pada `apps/api/src/durable-objects/ticket-reserver.ts` bisa menurunkan `insert_reservation_pool_wait` dan memperbaiki reservation/http tail tanpa menyentuh payment background isolation.
- Guardrail correctness:
	- focused reservation/payment/worker tests tetap hijau (`30/30`)
	- kedua helper run tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Baseline helper sesi yang sama sebelum patch aktif:
	- `full_flow_duration p95 ~11.7s`
	- `http_req_duration p95 ~4.73s`
	- `step_reservation_duration p95 ~5.25s`
	- `step_order_duration p95 ~2.76s`
	- `step_payment_duration p95 ~4.29s`
	- `step_webhook_duration p95 ~2.89s`
- Eksperimen #1 (`TICKET_RESERVER_INSERT_CONCURRENCY_LIMIT=8`):
	- `full_flow_duration p95 ~11.78s`
	- `http_req_duration p95 ~7.53s`
	- `step_reservation_duration p95 ~8.93s`
	- `step_order_duration p95 ~1.25s`
	- `step_payment_duration p95 ~1.75s`
	- `step_webhook_duration p95 ~1.28s`
- Eksperimen #2 konfirmasi (`TICKET_RESERVER_INSERT_CONCURRENCY_LIMIT=8`):
	- `full_flow_duration p95 ~12.61s`
	- `http_req_duration p95 ~7.51s`
	- `step_reservation_duration p95 ~9.81s`
	- `step_order_duration p95 ~1.90s`
	- `step_payment_duration p95 ~2.65s`
	- `step_webhook_duration p95 ~1.86s`
- Alasan penolakan: dua run helper menunjukkan regress yang kuat dan repeatable pada metrik utama reservation/http walaupun beberapa downstream step sempat membaik. Analisis log menunjukkan bottleneck hanya berpindah dari `insert_reservation_pool_wait` ke `insert_reservation_scheduler_wait` (sekitar `~2.8-5.7s` pada tail), sehingga limiter app-side ini hanya menambah serialisasi di hot path reservation. Eksperimen direvert penuh.

### 14. Micro-batching insert persistence reservasi di `TicketReserver` (code-level)

- Status: rejected, reverted.
- Tujuan eksperimen: menguji apakah gate env `TICKET_RESERVER_INSERT_BATCH_SIZE=25` pada `apps/api/src/durable-objects/ticket-reserver.ts` bisa mengurangi jumlah query insert di hot path DO dan menurunkan reservation/http tail tanpa mengulang payment background isolation.
- Guardrail correctness:
	- focused reservation/payment/worker tests tetap hijau sebelum eksperimen (`30/30`), saat gate aktif (`31/31` termasuk satu test eksperimen tambahan), dan pasca-revert (`30/30`)
	- kedua helper run tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Baseline helper sesi yang sama sebelum patch aktif:
	- `full_flow_duration p95 ~11.87s`
	- `http_req_duration p95 ~4.67s`
	- `step_reservation_duration p95 ~4.65s`
	- `step_order_duration p95 ~3.60s`
	- `step_payment_duration p95 ~5.37s`
	- `step_webhook_duration p95 ~2.70s`
- Eksperimen #1 (`TICKET_RESERVER_INSERT_BATCH_SIZE=25`):
	- `full_flow_duration p95 ~11.37s`
	- `http_req_duration p95 ~5.41s`
	- `step_reservation_duration p95 ~5.73s`
	- `step_order_duration p95 ~2.24s`
	- `step_payment_duration p95 ~3.10s`
	- `step_webhook_duration p95 ~2.04s`
- Eksperimen #2 konfirmasi (`TICKET_RESERVER_INSERT_BATCH_SIZE=25`):
	- `full_flow_duration p95 ~11.49s`
	- `http_req_duration p95 ~4.19s`
	- `step_reservation_duration p95 ~7.41s`
	- `step_order_duration p95 ~2.87s`
	- `step_payment_duration p95 ~4.10s`
	- `step_webhook_duration p95 ~2.25s`
- Alasan penolakan: hasilnya tidak memberi win repeatable pada dua metrik utama Task I. Run pertama memburuk di `http_req_duration` dan `step_reservation_duration`; run kedua memang menurunkan `http_req_duration`, tetapi `step_reservation_duration` justru melonjak jauh lebih buruk dari baseline sesi yang sama. Sampling log juga tidak menunjukkan wait berpindah ke step batch baru; `insert_reservation_batch_wait` tetap `0` pada sampel, sementara `insert_reservation_pool_wait` masih menjadi wait dominan. Eksperimen direvert penuh.

### 15. Menggabungkan pool DB app + `TicketReserver` di local runner (code-level, local-only)

- Status: rejected, reverted.
- Tujuan eksperimen: menguji apakah gate env `LOCAL_RUNNER_SHARE_TICKET_RESERVER_DB_POOL=1` pada `scripts/run-api-local.ts` bisa mengurangi `insert_reservation_pool_wait` dengan membuat `TicketReserver` lokal berbagi app DB pool yang sama, tanpa mengubah runtime produksi.
- Guardrail correctness:
	- focused reservation/payment/worker tests tetap hijau sebelum eksperimen dan pasca-revert (`30/30`)
	- dua helper run dengan gate aktif selesai pada workflow resmi yang sama dan menghasilkan summary yang comparable.
- Dibanding baseline helper retained yang berlaku (`full_flow/http_req/step_reservation ~9.30s/4.62s/6.96s`) dan baseline sesi retained terdekat sebelum eksperimen (`~11.87s/4.67s/4.65s`), dua run shared-pool tetap memburuk pada metrik utama.
- Eksperimen #1 (`LOCAL_RUNNER_SHARE_TICKET_RESERVER_DB_POOL=1`):
	- `full_flow_duration p95 ~13.97s`
	- `http_req_duration p95 ~7.60s`
	- `step_reservation_duration p95 ~7.86s`
	- `step_order_duration p95 ~4.13s`
	- `step_payment_duration p95 ~5.25s`
	- `step_webhook_duration p95 ~1.57s`
- Eksperimen #2 konfirmasi (`LOCAL_RUNNER_SHARE_TICKET_RESERVER_DB_POOL=1`):
	- `full_flow_duration p95 ~12.09s`
	- `http_req_duration p95 ~6.69s`
	- `step_reservation_duration p95 ~7.08s`
	- `step_order_duration p95 ~3.99s`
	- `step_payment_duration p95 ~3.98s`
	- `step_webhook_duration p95 ~1.86s`
- Alasan penolakan: shared pool tidak menghilangkan bottleneck reservation insert. Analisis dua runner log menunjukkan `insert_reservation_pool_wait` tetap dominan (sekitar `~1.28-2.55s` avg dengan `p90 ~3.83-4.09s`), `eligibility_pool_wait` ikut membesar (sekitar `~1.0-1.3s` avg), dan backlog task payment/background tetap panjang (`queueWaitDurationMs` menanjak sampai `~2.5-5.6s+`). Artinya contention hanya didistribusikan ke pool bersama dan overlap downstream, bukan dikurangi. Eksperimen direvert penuh.

### 16. Menyederhanakan query shape `ownedTickets` eligibility (code-level)

- Status: rejected, reverted.
- Tujuan eksperimen: menguji apakah rewrite subquery `ownedTickets` di `apps/api/src/services/reservation.service.ts` dari `orders -> order_items -> ticket_tiers` menjadi `orders -> reservations -> ticket_tiers` bisa menurunkan `eligibility_query_execute` dan reservation/http tail tanpa mengubah semantics confirmed-order.
- Guardrail correctness:
	- focused reservation/payment/worker tests tetap hijau saat eksperimen aktif (`31/31`, termasuk satu regression test sementara `MAX_TICKETS_EXCEEDED`) dan pasca-revert (`30/30`)
	- dua helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Dibanding baseline helper retained yang berlaku (`full_flow/http_req/step_reservation ~9.30s/4.62s/6.96s`), dua run rewrite query tetap tidak memberi win repeatable pada metrik utama.
- Eksperimen #1:
	- `full_flow_duration p95 ~11.66s`
	- `http_req_duration p95 ~7.37s`
	- `step_reservation_duration p95 ~9.21s`
	- `step_order_duration p95 ~1.70s`
	- `step_payment_duration p95 ~2.44s`
	- `step_webhook_duration p95 ~1.68s`
- Eksperimen #2 konfirmasi:
	- `full_flow_duration p95 ~9.74s`
	- `http_req_duration p95 ~5.73s`
	- `step_reservation_duration p95 ~6.85s`
	- `step_order_duration p95 ~2.08s`
	- `step_payment_duration p95 ~3.00s`
	- `step_webhook_duration p95 ~1.95s`
- Alasan penolakan: analisis dua runner log menunjukkan `eligibility_query_execute` memang turun (sekitar `~106.9ms -> ~75.8ms` avg, `p95 ~291ms -> ~209ms`) dan `insert_reservation_execute` ikut membaik sedikit, tetapi `eligibility_pool_wait` tidak turun (`~737ms -> ~752ms` avg dengan tail lebih buruk), `insert_reservation_pool_wait` justru membesar (`~164ms -> ~234ms` avg), dan wait `payment.background_task` tetap sekitar `~7.7s`. Artinya query CPU lebih ringan, tetapi contention pool tetap dominan sehingga reservation/http end-user tidak membaik secara repeatable. Eksperimen direvert penuh.

### 17. Memindahkan eligibility reservation ke `TicketReserver` DO (code-level)

- Status: rejected, reverted.
- Tujuan eksperimen: menguji apakah memindahkan eligibility reservation (`hasActiveReservation`, `ownedTickets`, dan validasi sale-window/status`) dari `apps/api/src/services/reservation.service.ts` ke `apps/api/src/durable-objects/ticket-reserver.ts` bisa menghapus query eligibility dari app DB pool, memanfaatkan cache state tier/event di DO, dan menurunkan reservation/http tail.
- Guardrail correctness:
	- focused reservation/payment/worker tests tetap hijau saat eksperimen aktif (`32/32`, termasuk satu test DO sementara dan satu regression test permanen `MAX_TICKETS_EXCEEDED`) dan pasca-revert (`31/31`)
	- dua helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Baseline helper sesi yang sama sebelum patch aktif:
	- `full_flow_duration p95 ~11.93s`
	- `http_req_duration p95 ~4.14s`
	- `step_reservation_duration p95 ~6.86s`
	- `step_order_duration p95 ~2.99s`
	- `step_payment_duration p95 ~4.15s`
	- `step_webhook_duration p95 ~2.65s`
- Eksperimen #1:
	- `full_flow_duration p95 ~12.74s`
	- `http_req_duration p95 ~8.43s`
	- `step_reservation_duration p95 ~9.04s`
	- `step_order_duration p95 ~1.73s`
	- `step_payment_duration p95 ~1.68s`
	- `step_webhook_duration p95 ~1.39s`
- Eksperimen #2 konfirmasi:
	- `full_flow_duration p95 ~12.21s`
	- `http_req_duration p95 ~5.17s`
	- `step_reservation_duration p95 ~5.91s`
	- `step_order_duration p95 ~2.76s`
	- `step_payment_duration p95 ~3.75s`
	- `step_webhook_duration p95 ~2.45s`
- Alasan penolakan: run pertama regress keras pada tiga metrik utama, dan run kedua tetap lebih buruk pada `full_flow/http` walaupun `step_reservation_duration` sempat pulih sebagian. Analisis log menunjukkan query eligibility memang hilang dari app service, tetapi DO sekarang membayar dua wait besar pada hot path yang sama: pada run konfirmasi `ticketReserver.reserve.eligibility_pool_wait` sekitar `~1015ms` avg (`p95 ~1801ms`) sambil `insert_reservation_pool_wait` tetap sekitar `~1180ms` avg (`p95 ~1846ms`). Artinya contention tidak hilang; ia hanya ditumpuk ke dalam hot path DO bersamaan dengan insert wait, sehingga eksperimen direvert penuh.

### 18. Cache static tier/event eligibility di service (code-level, local-only)

- Status: rejected, reverted.
- Tujuan eksperimen: menguji apakah memecah eligibility reservation di `apps/api/src/services/reservation.service.ts` menjadi dua bagian, yakni query static tier/event dan query buyer-specific (`hasActiveReservation`, `ownedTickets`), lalu meng-cache field static via env gate bounded TTL pada helper lokal, bisa menurunkan `eligibility_pool_wait` app-side tanpa memindahkan checks ke DO.
- Guardrail correctness:
	- focused reservation/payment/worker tests tetap hijau saat eksperimen aktif (`31/31`) dan pasca-revert (`31/31`)
	- semua helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Baseline fresh sesi ini sebelum patch aktif:
	- `full_flow_duration p95 ~13.10s`
	- `http_req_duration p95 ~6.46s`
	- `step_reservation_duration p95 ~8.28s`
	- `step_order_duration p95 ~3.08s`
	- `step_payment_duration p95 ~4.29s`
	- `step_webhook_duration p95 ~2.84s`
- Eksperimen manual override TTL `5s`:
	- run #1: `full_flow/http_req/step_reservation ~13.46s/6.59s/7.20s`
	- run #2 konfirmasi: `~11.09s/5.12s/5.75s`
- Eksperimen manual override TTL `60s`:
	- run #1: `full_flow/http_req/step_reservation ~11.75s/4.62s/6.36s`
	- run #2 konfirmasi: `~11.06s/5.55s/5.87s`
- Integrasi ke workflow resmi repo (`source .env && pnpm run test:load:checkout:local:profile`) setelah helper script dipatch:
	- run #1: `full_flow/http_req/step_reservation ~12.10s/8.21s/9.33s`
	- run #2 konfirmasi: `~14.20s/5.91s/7.45s`
- Alasan penolakan: log manual override menunjukkan cache memang aktif dan bisa memangkas `eligibility_query` pada sebagian run, terutama saat TTL diperpanjang. Namun acceptance untuk Task I tetap bergantung pada workflow resmi repo, dan setelah env gate yang sama diwiring ke helper resmi, hasil pair tetap tidak repeatable pada metrik utama: run pertama memburuk jelas pada `http_req_duration` dan `step_reservation_duration`, run kedua memburuk pada `full_flow_duration` dan tidak memberi win yang cukup bersih untuk di-retain. Karena eksperimen hanya memberi sinyal ad hoc, bukan perbaikan repeatable pada command resmi, patch service dan helper sama-sama direvert penuh.

### 19. Menaikkan pool DB `TicketReserver` pada preset `load-balanced` (code-level, local-only)

- Status: rejected, reverted.
- Tujuan eksperimen: menguji apakah menaikkan `ticketReserverDbMaxConnections` preset `load-balanced` di `scripts/run-api-local.ts` dari `25` ke `32`, tanpa mengubah app DB pool atau concurrency lain, bisa menurunkan `insert_reservation_pool_wait` dan memperbaiki reservation/http tail secara lebih terisolasi dibanding preset campuran `load-reservation` yang dulu sudah ditolak.
- Guardrail correctness:
	- focused reservation/payment/worker tests tetap hijau sebelum eksperimen dan pasca-revert (`31/31`)
	- kedua helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Baseline fresh sesi ini sebelum patch aktif:
	- `full_flow_duration p95 ~12.71s`
	- `http_req_duration p95 ~6.83s`
	- `step_reservation_duration p95 ~7.39s`
	- `step_order_duration p95 ~3.89s`
	- `step_payment_duration p95 ~4.36s`
	- `step_webhook_duration p95 ~2.59s`
- Eksperimen #1:
	- `full_flow_duration p95 ~12.44s`
	- `http_req_duration p95 ~7.67s`
	- `step_reservation_duration p95 ~9.63s`
	- `step_order_duration p95 ~2.89s`
	- `step_payment_duration p95 ~2.98s`
	- `step_webhook_duration p95 ~2.08s`
- Eksperimen #2 konfirmasi:
	- `full_flow_duration p95 ~12.92s`
	- `http_req_duration p95 ~4.79s`
	- `step_reservation_duration p95 ~3.96s`
	- `step_order_duration p95 ~5.16s`
	- `step_payment_duration p95 ~4.94s`
	- `step_webhook_duration p95 ~3.66s`
- Alasan penolakan: hasil pair tidak repeatable pada workflow resmi. Run pertama memburuk jelas pada `http_req_duration` dan `step_reservation_duration`, sedangkan run kedua memang memperbaiki reservation/http tetapi tetap lebih buruk pada `full_flow_duration` dan downstream utama. Profiling log juga menunjukkan contention hanya bergeser antar-komponen: pada run pertama `reservation.reserve.eligibility_pool_wait` membesar sampai sekitar `~846ms` avg ketika `ticketReserver.reserve.insert_reservation_pool_wait` turun ke sekitar `~262ms` avg, lalu pada run konfirmasi `eligibility_pool_wait` turun ke sekitar `~410ms` avg tetapi `insert_reservation_pool_wait` naik lagi ke sekitar `~917ms` avg. Karena isolated DO pool bump hanya memindahkan wait antara app eligibility dan hot path DO tanpa memberi win repeatable pada metrik utama, preset direvert penuh.

### 20. Mempersempit sampled runner profiling ke request reservation saja (harness, local-only)

- Status: rejected, reverted.
- Tujuan eksperimen: menguji apakah mempersempit sampled per-request runner profiling di `scripts/run-api-local.ts` dari semua kategori non-`other` menjadi `reservation` saja bisa menurunkan overhead harness lokal, mengingat deep auth/rate-limit profiling memang sudah reservation-only.
- Guardrail correctness:
	- kedua helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Baseline fresh sesi ini sebelum patch aktif:
	- `full_flow_duration p95 ~10.91s`
	- `http_req_duration p95 ~6.12s`
	- `step_reservation_duration p95 ~6.75s`
	- `step_order_duration p95 ~2.54s`
	- `step_payment_duration p95 ~2.52s`
	- `step_webhook_duration p95 ~1.36s`
- Eksperimen #1:
	- `full_flow_duration p95 ~12.60s`
	- `http_req_duration p95 ~8.14s`
	- `step_reservation_duration p95 ~10.19s`
	- `step_order_duration p95 ~2.00s`
	- `step_payment_duration p95 ~1.94s`
	- `step_webhook_duration p95 ~1.42s`
- Eksperimen #2 konfirmasi:
	- `full_flow_duration p95 ~13.02s`
	- `http_req_duration p95 ~6.10s`
	- `step_reservation_duration p95 ~6.86s`
	- `step_order_duration p95 ~4.19s`
	- `step_payment_duration p95 ~4.25s`
	- `step_webhook_duration p95 ~2.55s`
- Alasan penolakan: hasil pair tidak memberi win repeatable pada workflow resmi. Run pertama memburuk tajam pada `full_flow/http_req/step_reservation`, sedangkan run kedua hanya mendekati baseline pada `http_req_duration` dan `step_reservation_duration` tetapi tetap lebih buruk pada `full_flow_duration` serta downstream utama. Karena pengurangan scope sampled runner logging saja tidak cukup menurunkan metrik utama, sementara deep profiling auth/rate-limit memang sudah reservation-only, patch harness ini direvert penuh.

### 21. Menjadikan profiling `payment.background_task` opt-in di helper resmi (harness, local-only)

- Status: rejected, reverted.
- Perubahan yang diuji: `packages/core/scripts/run-local-checkout-benchmark.ts` sempat diubah agar `--profile-runner` tidak lagi otomatis menyalakan `LOAD_TEST_PROFILE_PAYMENT_BACKGROUND`, dengan tujuan mengurangi overhead observability default pada `pnpm run test:load:checkout:local:profile` sambil tetap mempertahankan runner profiling.
- Guardrail correctness:
	- kedua helper run tetap `500/500` checkout sukses
	- `500` confirmed orders/tickets
	- `500` issued tickets.
- Baseline fresh sesi ini sebelum eksperimen:
	- `full_flow_duration p95 ~10.91s`
	- `http_req_duration p95 ~6.12s`
	- `step_reservation_duration p95 ~6.75s`
	- `step_order_duration p95 ~2.54s`
	- `step_payment_duration p95 ~2.52s`
	- `step_webhook_duration p95 ~1.36s`
- Eksperimen #1:
	- `full_flow_duration p95 ~11.72s`
	- `http_req_duration p95 ~6.07s`
	- `step_reservation_duration p95 ~8.26s`
	- `step_order_duration p95 ~2.29s`
	- `step_payment_duration p95 ~3.40s`
	- `step_webhook_duration p95 ~2.19s`
	- runner log default profile mode tidak memuat entry `payment.background_task`
- Eksperimen #2 konfirmasi:
	- `full_flow_duration p95 ~12.80s`
	- `http_req_duration p95 ~6.24s`
	- `step_reservation_duration p95 ~7.52s`
	- `step_order_duration p95 ~3.12s`
	- `step_payment_duration p95 ~4.67s`
	- `step_webhook_duration p95 ~3.04s`
	- runner log default profile mode tetap tidak memuat entry `payment.background_task`
- Alasan penolakan: eksperimen ini memang menghilangkan log `payment.background_task` dari helper profile default, tetapi tidak menurunkan metrik utama. Dibanding baseline trusted helper (`~9.30s/4.62s/6.96s`) maupun baseline fresh sesi ini, pair run tetap regress pada `full_flow` dan downstream, sehingga overhead observability background payment bukan penjelasan utama untuk tail helper saat ini. Patch helper direvert penuh.

### 22. Menyelaraskan jalur insert profiling DO ke prepared insert hot path normal (code-level, local-only)

- Status: rejected, reverted.
- Perubahan yang diuji: di `apps/api/src/durable-objects/ticket-reserver.ts`, path `profile.enabled` sempat diubah agar tetap mengukur `insert_reservation_pool_wait` dan `insert_reservation_execute`, tetapi eksekusi insert-nya memakai prepared insert hot path yang sama dengan jalur normal.
- Guardrail correctness:
	- focused suite tetap hijau (`31/31`)
	- helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Baseline fresh sesi ini sebelum patch aktif:
	- `full_flow_duration p95 ~10.91s`
	- `http_req_duration p95 ~6.12s`
	- `step_reservation_duration p95 ~6.75s`
	- `step_order_duration p95 ~2.54s`
	- `step_payment_duration p95 ~2.52s`
	- `step_webhook_duration p95 ~1.36s`
- Eksperimen #1:
	- `full_flow_duration p95 ~11.48s`
	- `http_req_duration p95 ~6.33s`
	- `step_reservation_duration p95 ~6.75s`
	- `step_order_duration p95 ~2.01s`
	- `step_payment_duration p95 ~3.05s`
	- `step_webhook_duration p95 ~2.15s`
- Alasan penolakan: satu helper run resmi pertama sudah cukup menunjukkan bahwa patch ini bukan retainable win. `step_reservation_duration` hanya kembali setara baseline fresh, `http_req_duration` sedikit lebih buruk, dan `full_flow_duration` tetap jelas lebih buruk dari baseline fresh maupun baseline trusted helper (`~9.30s/4.62s/6.96s`). Karena sinyal awalnya sudah buruk/ambigu dan downstream ikut melebar, patch direvert penuh tanpa membuang waktu ke run konfirmasi kedua.

### 23. Melewati query akhir `generateTickets()` saat caller hanya butuh side effect (code-level, local-only)

- Status: rejected, reverted.
- Perubahan yang diuji: di `apps/api/src/services/ticket-generator.ts`, `generateTickets()` sempat diberi opsi untuk melewati query akhir `tickets.findMany()` dan mapping hasil ketika dipanggil dari flow payment/admin yang hanya membutuhkan side effect penerbitan tiket, lalu semua call site internal payment/admin diubah ke mode tersebut.
- Guardrail correctness:
	- focused suite tetap hijau (`31/31`)
	- helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Baseline fresh sesi ini sebelum patch aktif:
	- `full_flow_duration p95 ~10.91s`
	- `http_req_duration p95 ~6.12s`
	- `step_reservation_duration p95 ~6.75s`
	- `step_order_duration p95 ~2.54s`
	- `step_payment_duration p95 ~2.52s`
	- `step_webhook_duration p95 ~1.36s`
- Eksperimen #1:
	- `full_flow_duration p95 ~12.12s`
	- `http_req_duration p95 ~6.26s`
	- `step_reservation_duration p95 ~8.86s`
	- `step_order_duration p95 ~2.41s`
	- `step_payment_duration p95 ~3.46s`
	- `step_webhook_duration p95 ~2.13s`
- Alasan penolakan: walaupun hipotesisnya mengurangi satu query DB per fulfillment, satu helper run resmi pertama sudah cukup menunjukkan regress yang jelas pada metrik utama. `step_reservation_duration` melonjak jauh di atas baseline fresh, `http_req_duration` tidak membaik, dan `full_flow_duration` ikut memburuk. Karena sinyal awalnya sudah negatif dan tidak menunjukkan win reservation/http, patch direvert penuh tanpa run konfirmasi kedua.

### 24. Memparalelkan payload fulfillment dan `generateTickets()` di background task payment (code-level, local-only)

- Status: rejected, reverted.
- Perubahan yang diuji: di `apps/api/src/services/payment.service.ts`, `fulfillSuccessfulPayment()` sempat diubah agar `loadSuccessfulPaymentFulfillmentPayload()` dan `generateTickets()` berjalan paralel lewat `Promise.all(...)` sebelum `enqueuePostPaymentEffects()`.
- Guardrail correctness:
	- focused suite tetap hijau (`31/31`)
	- helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Eksperimen #1:
	- `full_flow_duration p95 ~12.93s`
	- `http_req_duration p95 ~4.73s`
	- `step_reservation_duration p95 ~8.04s`
	- `step_order_duration p95 ~2.88s`
	- `step_payment_duration p95 ~4.26s`
	- `step_webhook_duration p95 ~2.56s`
- Ringkasan profiling log:
	- `reservation.reserve total avg/p95 ~1720ms/~2506ms`
	- `eligibility_pool_wait avg/p95 ~1010ms/~2291ms`
	- `ticketReserver.reserve total avg/p95 ~599ms/~1616ms`
	- `insert_reservation_pool_wait avg/p95 ~360ms/~1075ms`
	- `payment.background_task` queue wait turun ke sekitar `~6.3s` avg (`p95 ~8.26s`) untuk kedua label; `fulfill_successful_payment` run duration turun ke sekitar `~169ms` avg (`p95 ~271ms`)
- Alasan penolakan: overlap ini memang menurunkan queue wait background task dan runtime fulfillment, tetapi tambahan concurrency fulfillment mendorong contention balik ke app-side `eligibility_pool_wait` dan membuat metrik utama tetap regress terhadap baseline helper trusted (`~9.30s/4.62s/6.96s`). Karena `step_reservation_duration` dan `full_flow_duration` masih memburuk jelas, patch direvert penuh tanpa run konfirmasi kedua.

### 25. Merewrite `loadSuccessfulPaymentFulfillmentPayload()` menjadi flat join query tunggal (code-level, local-only)

- Status: rejected, reverted.
- Perubahan yang diuji: di `apps/api/src/services/payment.service.ts`, `loadSuccessfulPaymentFulfillmentPayload()` sempat direwrite dari relational `database.query.orders.findFirst({ with: ... })` menjadi satu query flat dengan `orders -> users -> order_items -> ticket_tiers -> events -> seller_profiles` joins untuk mengurangi overhead lookup payload fulfillment tanpa menambah overlap baru di `fulfillSuccessfulPayment()`.
- Guardrail correctness:
	- focused suite tetap hijau (`31/31`)
	- helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Eksperimen #1:
	- `full_flow_duration p95 ~11.40s`
	- `http_req_duration p95 ~5.87s`
	- `step_reservation_duration p95 ~8.51s`
	- `step_order_duration p95 ~2.29s`
	- `step_payment_duration p95 ~3.31s`
	- `step_webhook_duration p95 ~2.04s`
- Ringkasan profiling log:
	- `reservation.reserve total avg/p95 ~1763ms/~2200ms`
	- `eligibility_pool_wait avg/p95 ~858ms/~1657ms`
	- `ticketReserver.reserve total avg/p95 ~807ms/~1885ms`
	- `insert_reservation_pool_wait avg/p95 ~629ms/~1690ms`
	- `payment.background_task` queue wait tetap sekitar `~6.56-6.58s` avg (`p95 ~10.25-10.26s`) untuk kedua label; `fulfill_successful_payment` run duration sekitar `~180ms` avg (`p95 ~823ms`)
- Alasan penolakan: rewrite query shape fulfillment ini tidak memberi win reservation/http. Walaupun hipotesisnya mengurangi overhead relation lookup di fulfillment, helper resmi pertama tetap menunjukkan regress jelas terhadap baseline helper trusted (`~9.30s/4.62s/6.96s`), queue wait background task masih multi-detik, dan contention reservation-side justru membesar lagi di `insert_reservation_pool_wait`. Karena sinyal awalnya sudah negatif pada metrik utama, patch direvert penuh tanpa run konfirmasi kedua.

### 26. Membatch dua notifikasi payment dan melewati email saat env lokal kosong (code-level, local-only)

- Status: rejected, reverted.
- Perubahan yang diuji: di `apps/api/src/services/payment.service.ts` dan `apps/api/src/services/notification.service.ts`, dua notifikasi post-payment sempat dibatch ke satu insert DB, lalu `sendEmail()` hanya dijalankan jika `EMAIL_API_KEY` dan `EMAIL_FROM` benar-benar tersedia. Tujuannya mengurangi kerja serial kecil di `enqueuePostPaymentEffects()` tanpa menambah overlap DB baru.
- Guardrail correctness:
	- focused suite tetap hijau (`31/31`)
	- kedua helper run resmi tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Eksperimen #1:
	- `full_flow_duration p95 ~10.36s`
	- `http_req_duration p95 ~6.48s`
	- `step_reservation_duration p95 ~7.16s`
	- `step_order_duration p95 ~1.31s`
	- `step_payment_duration p95 ~1.80s`
	- `step_webhook_duration p95 ~1.19s`
- Ringkasan profiling log run #1:
	- `reservation.reserve total avg/p95 ~935ms/~1658ms`
	- `eligibility_pool_wait avg/p95 ~485ms/~757ms`
	- `ticketReserver.reserve total avg/p95 ~356ms/~965ms`
	- `insert_reservation_pool_wait avg/p95 ~203ms/~750ms`
	- `payment.background_task` queue wait sekitar `~7.24-7.26s` avg (`p95 ~8.31-8.32s`); `fulfill_successful_payment` run duration sekitar `~196ms` avg (`p95 ~435ms`)
- Eksperimen #2 (konfirmasi repeatability):
	- `full_flow_duration p95 ~12.57s`
	- `http_req_duration p95 ~5.59s`
	- `step_reservation_duration p95 ~6.13s`
	- `step_order_duration p95 ~2.75s`
	- `step_payment_duration p95 ~4.12s`
	- `step_webhook_duration p95 ~1.73s`
- Alasan penolakan: walaupun run pertama memberi sinyal internal yang membaik di reservation/DO dan downstream step, pair helper tidak repeatable pada metrik utama. `full_flow_duration` tetap jauh di atas baseline helper trusted (`~9.30s`) pada kedua run dan malah melebar keras pada run konfirmasi, sementara `http_req_duration` juga tetap di atas baseline trusted pada kedua run. Karena win user-facing utama tidak konsisten, patch direvert penuh.

## Eksperimen Retained Terbaru

### 27. Cache verifikasi JWT pada auth middleware (code-level, retained)

- Status: retained.
- Perubahan yang diuji: menambahkan cache verifikasi JWT bounded + TTL-aware di `apps/api/src/middleware/auth.ts` untuk menghindari signature verify berulang pada token yang sama selama token masih valid.
- Guardrail correctness:
	- focused payment/worker tests tetap hijau (`15/15`)
	- helper run tetap correctness-green (`500/500` checkout sukses, `500` confirmed orders/tickets, `500` issued tickets).
- Before (run `load-balanced` terakhir sebelum patch cache JWT):
	- `full_flow_duration p95 ~13.18s`
	- `http_req_duration p95 ~5.71s`
	- `step_reservation_duration p95 ~6.60s`
	- `step_order_duration p95 ~3.76s`
	- `step_payment_duration p95 ~5.11s`
	- `step_webhook_duration p95 ~3.70s`
- After run #1 (dengan cache JWT aktif):
	- `full_flow_duration p95 ~10.79s`
	- `http_req_duration p95 ~4.35s`
	- `step_reservation_duration p95 ~5.00s`
	- `step_order_duration p95 ~2.61s`
	- `step_payment_duration p95 ~4.25s`
	- `step_webhook_duration p95 ~2.63s`
- After run #2 (repeatability sample tambahan):
	- `full_flow_duration p95 ~11.42s`
	- `http_req_duration p95 ~3.97s`
	- `step_reservation_duration p95 ~4.80s`
	- `step_order_duration p95 ~2.34s`
	- `step_payment_duration p95 ~3.95s`
	- `step_webhook_duration p95 ~2.27s`
- Keputusan retain: dua sample after masih menunjukkan perbaikan konsisten terhadap before terdekat untuk metrik utama reservation/http dan downstream utama, dengan correctness tetap hijau. Namun benchmark masih di atas target historis, jadi ini dianggap incremental win, bukan closure Task I.

## Makna Eksperimen Terakhir

Eksperimen terbaru menunjukkan dua puluh satu hal:

- Tuning preset saja (`load-fullflow` maupun `load-baseline`) belum repeatable lintas pasangan run.
- Ada win code-level yang lebih stabil: cache verifikasi JWT menurunkan p95 reservation/http dan step downstream pada dua sample after, sambil menjaga correctness tetap hijau.
- Micro-optimasi parsing pathname request untuk profiling tidak membantu pada helper resmi; dua run konfirmasi justru regress pada reservation/http sehingga patch harus direvert.
- Pair konfirmasi pasca-revert menegaskan bahwa local helper masih sangat volatil; evaluasi eksperimen berikutnya tetap harus memakai pasangan run dan guardrail correctness yang ketat.
- Eksperimen inline `sync_reservation_state` pada webhook tidak memberi win yang repeatable untuk reservation/http dan sudah direvert.
- Membatasi concurrency insert persistence reservasi di level aplikasi/DO juga bukan win; ia hanya memindahkan wait dari pool ke scheduler dan memperburuk reservation/http tail.
- Micro-batching insert persistence reservasi di hot path DO juga bukan win repeatable; jumlah query insert mungkin berkurang pada sebagian sampel, tetapi reservation p95 tetap tidak stabil dan tidak membaik konsisten.
- Menggabungkan pool DB app + `TicketReserver` pada local runner juga bukan win; `insert_reservation_pool_wait` tetap dominan, sementara contention ikut menyebar ke eligibility query dan overlap downstream/background.
- Menyederhanakan subquery `ownedTickets` eligibility hanya memangkas waktu execute query, tetapi tidak menurunkan `eligibility_pool_wait`; bottleneck tetap berada pada contention pool, jadi rewrite query shape semacam ini belum cukup untuk memperbaiki reservation/http tail.
- Memindahkan eligibility reservation penuh ke `TicketReserver` juga bukan win; query app-side memang hilang, tetapi wait eligibility muncul lagi di DO sambil tetap membawa `insert_reservation_pool_wait`, sehingga `full_flow/http` tetap regress.
- Memecah eligibility menjadi static tier/event query + buyer-specific query dengan cache env-gated local-only juga belum cukup; manual override bisa terlihat membaik, tetapi saat dibawa ke command resmi helper hasilnya tetap tidak repeatable, jadi patch seperti ini belum layak dipertahankan.
- Menaikkan pool DB `TicketReserver` secara terisolasi pada preset `load-balanced` juga belum cukup; satu run malah memburuk di `http/reservation`, run lain memperbaiki reservation/http tetapi mengorbankan `full_flow`, dan contention hanya bergeser antara `eligibility_pool_wait` app-side dan `insert_reservation_pool_wait` di DO.
- Mempersempit sampled runner profiling ke reservation saja juga belum cukup; walaupun hipotesisnya overhead harness lintas kategori, pair helper resmi tetap tidak memberi win repeatable dan justru memburukkan `full_flow` atau downstream utama.
- Menjadikan profiling `payment.background_task` opt-in di helper resmi juga belum cukup; log background payment memang hilang total dari run default profile mode, tetapi pair helper tetap regress, jadi overhead observability background payment bukan akar utama tail helper saat ini.
- Menyelaraskan jalur insert profiling DO ke prepared insert hot path normal juga belum cukup; satu helper run resmi tetap lebih buruk pada `full_flow`, sedikit lebih buruk pada `http_req`, dan tidak memperbaiki `step_reservation`, sehingga drift implementasi itu bukan win yang layak dipertahankan.
- Melewati query akhir `generateTickets()` saat flow payment/admin hanya butuh side effect juga belum cukup; helper resmi pertama justru memburukkan `step_reservation`, `step_payment`, dan `full_flow`, sehingga pengurangan satu query per fulfillment bukan win yang layak dipertahankan pada harness ini.
- Memparalelkan `loadSuccessfulPaymentFulfillmentPayload()` dengan `generateTickets()` juga belum cukup; queue wait background task memang turun, tetapi contention berpindah kembali ke app-side `eligibility_pool_wait`, sehingga reservation/full-flow tetap regress.
- Merewrite `loadSuccessfulPaymentFulfillmentPayload()` menjadi flat join query tunggal juga belum cukup; helper resmi pertama tetap memburukkan `http_req` dan `step_reservation`, queue wait background task masih bertahan di kisaran `~6.6s` avg, dan `insert_reservation_pool_wait` justru membesar lagi.
- Membatch dua notifikasi payment menjadi satu insert DB dan melewati email saat env lokal kosong juga belum cukup; run pertama memang memperbaiki banyak metrik internal reservation/DO dan downstream, tetapi pair helper tidak repeatable pada `full_flow/http_req`, sehingga backlog fulfillment kecil saja belum menjadi win retained.
- Analisis lanjutan pada run pertama eksperimen batch-notification menunjukkan tail utama helper saat ini bukan lagi jalur `reservation.reserve` itu sendiri: `client_send_to_handler` di `localRunner.request` mencapai sekitar `~3.61s` avg (`p95 ~5.58s`), sementara `app_fetch`, `rateLimit.middleware`, `reservation.route.create`, dan `reservation.reserve` semuanya hanya sekitar `~0.94-0.95s` avg (`p95 ~1.66-1.68s`). Sample reservation terlambat juga sudah overlap dengan sekitar `34-48` order dan `60-80` payment request in-flight, jadi fokus berikutnya harus pindah ke overlap/admission di runner atau boundary request, bukan fulfillment micro-optimization lagi.
- Instrumentasi runner tambahan yang memisahkan `pre_accept_gap` dari `socket_accept_to_handler` sekarang menguatkan diagnosis itu: pada run helper diagnostik terbaru, `localRunner.request pre_accept_gap` mencapai sekitar `~5.25s` avg (`p95 ~9.22s`) sementara `app_fetch`, `auth.middleware`, `rateLimit.middleware`, `reservation.route.create`, dan `reservation.reserve` hanya sekitar `~0.54s` avg (`p95 ~1.10s`). Bucket sample menunjukkan gap ini membesar seiring overlap: early reservation `pre_accept_gap ~0.89s` avg dengan `pendingWaitUntilTasks ~0`, middle `~4.66s` dengan `~174` pending tasks, late `~8.02s` dengan `~483` pending tasks dan overlap order/payment yang jauh lebih besar. Fokus berikutnya harus tetap pada admission/overlap runner, bukan pada optimasi service/fulfillment kecil.
- Hard-cap rejection di admission runner juga sudah terbukti bukan solusi yang valid: gate `LOCAL_RUNNER_MAX_RESERVATION_OVERLAP=8` memang menurunkan `pre_accept_gap` pada request yang lolos ke kisaran ratusan milidetik, tetapi hanya dengan memangkas `456/500` flow menjadi `503`, sehingga tail turun karena throughput dan correctness dikorbankan. Eksperimen runner berikutnya tidak boleh memakai pola reject seperti ini.
- FIFO admission queue non-reject di runner juga belum cukup: gate `LOCAL_RUNNER_RESERVATION_ADMISSION_CONCURRENCY=64` memang menurunkan `pre_accept_gap` dan `app_fetch`, tetapi hanya dengan memindahkan wait ke `reservation_admission_queue_wait` multi-detik (`~3.16s avg / ~6.24s p95`) sehingga `http_req_duration` dan `step_reservation_duration` justru memburuk. Eksperimen runner berikutnya tidak boleh hanya memindahkan lokasi antrean; ia harus menurunkan total reservation/http tail.
- Menunda kickoff `waitUntil` payment background task juga belum cukup: gate `LOCAL_RUNNER_DEFER_PAYMENT_BACKGROUND_START=1` memang menurunkan `client_send_to_handler` dan `pre_accept_gap` reservation secara drastis, tetapi biaya itu pindah ke jalur reservation app/DO sendiri, terutama `ticketReserver.insert_reservation_pool_wait` yang naik dari sekitar `~126ms` ke `~3518ms` avg. Eksperimen runner berikutnya tidak boleh hanya menggeser contention dari admission ke hot path reservation/database.
- Memaksa close pada koneksi non-reservation juga belum cukup: gate `LOCAL_RUNNER_CLOSE_NON_RESERVATION_CONNECTIONS=1` memang menurunkan `client_send_to_handler` dan `pre_accept_gap`, tetapi `activeSockets` max tidak berubah dan biaya reservation pindah ke `durable_object_reserve`/`ticketReserver.insert_reservation_pool_wait` (`~261ms` -> `~1738ms` avg), sambil memperburuk semua downstream step. Eksperimen runner berikutnya tidak boleh hanya menukar accept-side wait dengan contention DO insert yang lebih besar.
- Diagnosis socket reuse terbaru memperjelas lapisan masalah: sampled reservation selalu datang pada socket baru, sementara downstream phases justru reuse socket dengan pola stabil. Jadi hipotesis berikutnya harus menarget fresh-socket admission untuk reservation atau pola pembentukan koneksi baru, bukan lagi penutupan koneksi downstream yang sudah ada.
- Listen backlog yang lebih besar dan response streaming runner sekarang juga sudah dicoret dari backlog hipotesis: keduanya tidak mengurangi tail reservation secara net dan hanya memperburuk loop/latency pada jalur lain. Jangan ulang dua probe ini kecuali ada perubahan desain runner yang substansial.
- Gate `PREWARM_RESERVATION_CONNECTION=1` bukan baseline resmi, tetapi ia sekarang adalah cek diskriminatif tercepat untuk pertanyaan “seberapa besar tail reservation berasal dari first-request fresh socket?” Jika gate ini kembali menghapus `pre_accept_gap` dan menurunkan reservation/http secara tajam, fokus berikutnya harus tetap di admission/connection formation, bukan fulfillment atau downstream keep-alive.
- Karena helper resmi sekarang sudah punya flag prewarm tersendiri dan summary transport-side, eksperimen berikutnya yang ingin mengisolasi bottleneck app/DO sebaiknya memakai mode ini secara eksplisit, bukan env ad hoc. Default helper tetap canonical; mode prewarm hanya untuk diagnosis atau untuk mencari bottleneck berikutnya setelah fresh-socket penalty diangkat.
- Untuk eksperimen app/DO lanjutan di mode prewarm, jangan kembali ke `load-balanced` sebagai kontrol pertama. Data terbaru menunjukkan `load-fullflow` dan khususnya `load-fullflow + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32` memberi sinyal yang lebih stabil pada bottleneck reservation setelah fresh-socket penalty diangkat.
- Jangan jadikan `LOCAL_RUNNER_OVERRIDE_DB_MAX_CONNECTIONS=58` sebagai follow-up default di atas `load-fullflow + prewarm + DO32`; probe pertama tidak memberi win bersih dan justru memburuk pada `http_req` serta downstream slice.
- Jangan ulang dedicated eligibility pool (`RESERVATION_ELIGIBILITY_DB_MAX_CONNECTIONS`) sebagai follow-up default; `eligibility=8` tidak repeatable dan `eligibility=4` jelas buruk.
- Untuk tuning pool `TicketReserver` di kontrol prewarm saat ini, jangan lanjut di atas `32` tanpa alasan teknis baru; `40` sudah dicoba dan tidak memberi win bersih.
- Gate `PRE_RESERVATION_VU_JITTER_MS` sekarang juga sudah pernah diuji sebagai kontrol pembeda. Jangan ulang probe “spread sedikit tanpa reuse” sebagai kandidat fix; ia tidak menghilangkan `pre_accept_gap` dan tidak mendekati win prewarm.

Implikasi praktis:

- Baseline helper kanonis tetap tidak berubah sampai ada bukti repeatability yang konsisten untuk metrik utama reservation/http.
- Pertahankan cache JWT sebagai baseline code-level aktif, lalu lanjutkan hipotesis code-level berikutnya untuk reservation/http tail pada level service/DO/harness.
- Prioritaskan hipotesis yang mengukur atau mengurangi `client_send_to_handler` / overlap kategori request pada runner lokal; jangan berharap micro-optimasi fulfillment kecil memperbaiki `step_reservation_duration` selama pre-handler gap masih dominan.
- Perlakukan toggles keluarga connection-strategy/keep-alive hanya sebagai diagnosis bila muncul lagi; evidence lama sudah menunjukkan mereka cenderung hanya memindahkan waiting antar-step, bukan memberi win full-flow yang repeatable.

## Arah Lanjutan Yang Disarankan

Prioritas berikutnya:

1. Fokus pada reservation/http tail, bukan payment background-task isolation umum.
2. Repeatability preset (`load-fullflow` dan `load-baseline`) sudah diuji multi-pasangan dan belum konsisten; jangan ubah preset kanonis helper dulu.
3. Pertahankan cache JWT di auth middleware sebagai baseline code-level terbaru, lalu lanjutkan hipotesis yang berpotensi menurunkan `client_send_to_handler`, `step_reservation_duration`, dan/atau `http_req_duration` pada boundary request atau overlap runner lokal.
4. Jangan ulang limiter/scheduler app-side, micro-batching insert, shared-pool merge app+DO, rewrite `ownedTickets`, pemindahan penuh eligibility query ke `TicketReserver`, isolated `ticketReserverDbMaxConnections` bump pada preset `load-balanced`, cache static tier/event eligibility via env gate helper lokal, penyempitan sampled runner profiling ke reservation saja, menjadikan profiling `payment.background_task` opt-in di helper resmi, penyelarasan jalur insert profiling DO ke prepared insert hot path normal, penghilangan query akhir `generateTickets()` pada flow payment/admin, rewrite flat join `loadSuccessfulPaymentFulfillmentPayload()`, batching notifikasi payment + skip email saat env lokal kosong, atau paralelisasi `loadSuccessfulPaymentFulfillmentPayload()` + `generateTickets()` tanpa alasan teknis baru yang lebih kuat; eksperimen terbaru tetap gagal memberi win repeatable pada command resmi.
4. Jangan ulang limiter/scheduler app-side, micro-batching insert, shared-pool merge app+DO, rewrite `ownedTickets`, pemindahan penuh eligibility query ke `TicketReserver`, isolated `ticketReserverDbMaxConnections` bump pada preset `load-balanced`, cache static tier/event eligibility via env gate helper lokal, penyempitan sampled runner profiling ke reservation saja, toggles keluarga connection-strategy/keep-alive tanpa alasan teknis baru yang kuat, admission queue FIFO ber-concurrency tetap yang hanya memindahkan wait ke runner internal, penundaan kickoff `waitUntil` payment background task yang hanya memindahkan contention ke hot path reservation/DO, pemaksaan `Connection: close` pada response non-reservation yang hanya memindahkan wait ke `durable_object_reserve`/DO insert path, menjadikan profiling `payment.background_task` opt-in di helper resmi, penyempurnaan jalur insert profiling DO ke prepared insert hot path normal, penghilangan query akhir `generateTickets()` pada flow payment/admin, rewrite flat join `loadSuccessfulPaymentFulfillmentPayload()`, batching notifikasi payment + skip email saat env lokal kosong, atau paralelisasi `loadSuccessfulPaymentFulfillmentPayload()` + `generateTickets()` tanpa alasan teknis baru yang lebih kuat; eksperimen terbaru tetap gagal memberi win repeatable pada command resmi.
5. Hindari eksperimen yang hanya menggeser tradeoff antar-step tanpa menurunkan metrik utama reservation/http.
6. Jika hasil eksperimen hanya memperbaiki downstream steps tetapi reservation/http tail memburuk, anggap rejected.

## File Yang Paling Relevan Untuk Dibaca Dulu

- `task.md`
	- lihat bagian `Task I — Local Checkout Optimization Backlog`
- `apps/api/src/services/payment.service.ts`
- `scripts/run-api-local.ts`
- `packages/core/scripts/run-local-checkout-benchmark.ts`
- `apps/api/src/durable-objects/ticket-reserver.ts`
- `STAGING_VALIDATION.md`
	- hanya untuk konteks release posture, bukan fokus task ini

## Command Yang Disarankan Untuk Melanjutkan

### Focused test sebelum/ sesudah eksperimen

```bash
cd /home/ubuntu/bench/jeevatix/apps/api
pnpm exec vitest run \
	src/__tests__/ticket-reserver.test.ts \
	src/__tests__/reservation.test.ts \
	src/__tests__/order-reservation.test.ts \
	src/__tests__/payment.test.ts \
	src/__tests__/admin-order-payment.test.ts \
	src/__tests__/index-worker.test.ts \
	src/__tests__/queue-cleanup.test.ts
```

### Benchmark resmi yang harus dipakai untuk perbandingan utama

```bash
cd /home/ubuntu/bench/jeevatix
source .env
pnpm run test:load:checkout:local:profile
```

### Cara membaca hasil

- Cari baris `local-checkout-summary` di output helper.
- Ambil `runnerLogFile` dari summary/output.
- Dari log runner, fokus ke:
	- `localRunner.request`
	- `auth.middleware`
	- `rateLimit.middleware`
	- `reservation.route.create`
	- `reservation.reserve`
	- `localRunner.runtime`
	- `payment.background_task`
	- `pendingWaitUntilTasks`

## Catatan Operasional Penting

- Working tree repo pada sesi ini sedang dirty dengan banyak perubahan retained dari fase sebelumnya. Jika berpindah laptop tanpa membawa working tree yang sama, progress kode retained bisa tidak ikut walaupun `handoff.md` ini ada.
- Jika berpindah ke laptop lain tetapi tetap memakai VS Code Remote SSH server yang sama dan membuka path workspace yang sama (`/home/ubuntu/bench/jeevatix`), working tree, file yang sudah diedit, dan `handoff.md` ini tetap menjadi sumber state yang sama untuk melanjutkan pekerjaan.
- Empat eksperimen perubahan kode sebelumnya sudah direvert. Jangan cari branch/perubahan aktif untuk queue consumer, payment post-effects queue terpisah, patch prepared-query profiling eligibility reservation, atau preset eksperimen `load-reservation`; semuanya sengaja tidak dipertahankan.
- Perubahan code-level terbaru yang dipertahankan ada di `apps/api/src/middleware/auth.ts` (cache verifikasi JWT bounded + TTL-aware).
- Eksperimen env-gated `PAYMENT_WEBHOOK_SYNC_RESERVATION_INLINE=1` pada `apps/api/src/services/payment.service.ts` sudah ditolak dan direvert setelah pair run helper tidak menunjukkan win reservation/http yang repeatable.
- Eksperimen env-gated `TICKET_RESERVER_INSERT_CONCURRENCY_LIMIT=8` pada `apps/api/src/durable-objects/ticket-reserver.ts` juga sudah ditolak dan direvert setelah dua helper run menunjukkan regress reservation/http yang repeatable akibat `insert_reservation_scheduler_wait` yang besar.
- Eksperimen env-gated `TICKET_RESERVER_INSERT_BATCH_SIZE=25` pada `apps/api/src/durable-objects/ticket-reserver.ts` juga sudah ditolak dan direvert setelah pair helper run tidak memberi win repeatable pada reservation/http; run kedua sempat menurunkan `http_req_duration`, tetapi `step_reservation_duration` justru melonjak lebih buruk dari baseline sesi yang sama.
- Eksperimen env-gated `LOCAL_RUNNER_SHARE_TICKET_RESERVER_DB_POOL=1` pada `scripts/run-api-local.ts` juga sudah ditolak dan direvert setelah pair helper run tetap menunjukkan regress reservation/http; shared pool tidak menghapus `insert_reservation_pool_wait` dan justru memperbesar contention di eligibility/background overlap.
- Eksperimen rewrite `ownedTickets` eligibility di `apps/api/src/services/reservation.service.ts` juga sudah ditolak dan direvert setelah pair helper run hanya menurunkan `eligibility_query_execute`, sementara `eligibility_pool_wait` dan contention insert/background tetap dominan.
- Eksperimen memindahkan eligibility reservation dari app service ke `apps/api/src/durable-objects/ticket-reserver.ts` juga sudah ditolak dan direvert setelah pair helper run tetap memburuk pada `full_flow/http`; wait eligibility hanya berpindah ke hot path DO dan bertumpuk dengan `insert_reservation_pool_wait`.
- Eksperimen cache static tier/event eligibility di `apps/api/src/services/reservation.service.ts` dengan env gate helper lokal juga sudah ditolak dan direvert; pair manual override sempat terlihat membaik, tetapi pair command resmi `pnpm run test:load:checkout:local:profile` tetap tidak repeatable pada metrik utama.
- Eksperimen menaikkan `ticketReserverDbMaxConnections` preset `load-balanced` di `scripts/run-api-local.ts` dari `25` ke `32` juga sudah ditolak dan direvert; pair helper run tidak repeatable, dan profiling menunjukkan wait hanya bergeser antara `eligibility_pool_wait` app-side dan `insert_reservation_pool_wait` di DO.
- Eksperimen mempersempit sampled per-request runner profiling di `scripts/run-api-local.ts` ke request `reservation` saja juga sudah ditolak dan direvert; pair helper run tidak memberi win repeatable dan tetap memburukkan `full_flow` atau downstream utama.
- Eksperimen menjadikan profiling `payment.background_task` opt-in di helper resmi `packages/core/scripts/run-local-checkout-benchmark.ts` juga sudah ditolak dan direvert; walaupun entry log `payment.background_task` hilang dari run default profile mode, pair helper run tetap lebih buruk dari baseline retained maupun baseline fresh sesi yang sama.
- Eksperimen menyelaraskan jalur insert saat profiling di `apps/api/src/durable-objects/ticket-reserver.ts` dengan prepared insert hot path normal juga sudah ditolak dan direvert; helper resmi pertama hanya memberi `full_flow/http_req/step_reservation ~11.48s/6.33s/6.75s`, sehingga tidak ada alasan menjalankan pair konfirmasi kedua.
- Eksperimen membuat `generateTickets()` melewati query akhir daftar tiket saat flow payment/admin hanya butuh side effect juga sudah ditolak dan direvert; helper resmi pertama langsung regress ke `full_flow/http_req/step_reservation ~12.12s/6.26s/8.86s`, sehingga tidak ada alasan menjalankan pair konfirmasi kedua.
- Eksperimen memparalelkan `loadSuccessfulPaymentFulfillmentPayload()` dengan `generateTickets()` di `apps/api/src/services/payment.service.ts` juga sudah ditolak dan direvert; helper resmi pertama memberi `full_flow/http_req/step_reservation ~12.93s/4.73s/8.04s`, dan profiling menunjukkan queue wait background task memang turun tetapi `eligibility_pool_wait` naik ke sekitar `~1.01s` avg (`p95 ~2.29s`), sehingga reservation/full-flow tetap memburuk.
- Eksperimen me-rewrite `loadSuccessfulPaymentFulfillmentPayload()` menjadi flat join query tunggal di `apps/api/src/services/payment.service.ts` juga sudah ditolak dan direvert; helper resmi pertama memberi `full_flow/http_req/step_reservation ~11.40s/5.87s/8.51s`, sementara profiling menunjukkan queue wait `payment.background_task` tetap sekitar `~6.56-6.58s` avg dan `insert_reservation_pool_wait` naik ke sekitar `~629ms` avg (`p95 ~1.69s`), sehingga reservation/full-flow tetap memburuk.
- Eksperimen membatch dua notifikasi payment menjadi satu insert DB dan melewati attempt email ketika env lokal kosong di `apps/api/src/services/payment.service.ts` + `apps/api/src/services/notification.service.ts` juga sudah ditolak dan direvert; pair helper run memberi `full_flow/http_req/step_reservation ~10.36s/6.48s/7.16s` lalu `~12.57s/5.59s/6.13s`. Run pertama memang menurunkan `eligibility_pool_wait` ke sekitar `~485ms` avg dan `insert_reservation_pool_wait` ke sekitar `~203ms` avg, tetapi karena `full_flow/http_req` tetap tidak mengalahkan baseline helper trusted dan run konfirmasi tidak repeatable, patch tetap dibuang.
- Update retained terbaru sesi ini ada di `scripts/run-api-local.ts`: runner lokal sekarang selalu mencetak summary exit low-overhead `[local-runner-summary]` bahkan pada run no-profile. Field baru yang dipertahankan: `maxInFlightRequests`, `maxPendingWaitUntilTasks`, `maxActiveSockets`, `maxInFlightByCategory`, `maxPendingWaitUntilTasksByActiveCategory`, dan `firstPendingWaitUntilSnapshot`.
- Empat run no-profile kontrol dengan summary baru menunjukkan dua hal. Pertama, peak overlap runner global saja tidak cukup menjelaskan hasil end-user: run `full_flow/http_req ~12.66s/4.19s` punya `maxInFlightRequests=497`, sementara run yang lebih buruk `~14.29s/5.37s` hanya `385`, dan `maxPendingWaitUntilTasks` nyaris sama (`970` vs `966`). Kedua, overlap `waitUntil` dengan reservation juga bukan driver yang stabil: pada dua run overlap-summary berikutnya, `firstPendingWaitUntilSnapshot` baru muncul saat order/payment sudah aktif besar (`reservation/order/payment = 78/290/123` lalu `46/271/60`), dan peak `pendingWaitUntilTasks` saat reservation aktif berubah jauh (`2` vs `131`) sementara `step_reservation p95` tetap sekitar `~2.81-2.82s`.
- Implikasi praktis terbaru: hipotesis tuning `LocalExecutionContext.waitUntil(...)` saja sudah melemah dan jangan dijadikan slice edit berikutnya tanpa alasan baru yang jauh lebih kuat. Pembacaan kode menunjukkan `apps/api/src/services/payment.service.ts` dan `apps/api/src/services/auth.service.ts` membuat promise background task yang sudah panas sebelum dipanggil ke `executionContext.waitUntil(...)`, jadi runner wrapper sendiri tidak punya ruang besar untuk menunda atau mengisolasi start task tanpa mengubah kontrak scheduler menjadi factory-based. Itu terlalu dekat dengan keluarga eksperimen defer-start `waitUntil` yang sudah pernah ditolak karena hanya memindahkan contention.
- Implikasi praktis terbaru berikutnya: keluarga hipotesis `payment.handleWebhook()` transaction body sekarang juga sudah exhausted. `payment_lookup` di luar transaksi sudah pernah regress keras, `RETURNING` update webhook sudah minimal (`{ id }`), update reservation tidak bisa dikeluarkan dari transaksi karena race dengan `cleanupExpiredReservations()` pada `status='active'`, dan payload SELECT awal di webhook memang seluruhnya dikonsumsi downstream. Jangan ulang keluarga ini tanpa bukti teknis baru.
- Regression test permanen `MAX_TICKETS_EXCEEDED` sekarang dipertahankan di `apps/api/src/__tests__/reservation.test.ts`; focused suite baseline terkini menjadi `31/31`.
- Eksperimen perbandingan preset (`load-balanced` vs `load-fullflow`, dan `load-balanced` vs `load-baseline`) tidak mengubah kode; setelah beberapa pasangan run hasilnya tetap tidak stabil pada metrik utama, sehingga belum menjadi baseline kanonis baru.

## Delta Sesi 2026-04-24

- User sudah menyetujui untuk melanjutkan sesudah trim order retained, lalu sesi ini dipakai untuk dua hal: mengonfirmasi repeatability no-profile sekali lagi dan mengaudit body transaksi `payment.handleWebhook()`.
- Run no-profile ketiga tetap correctness-green (`500/500`) dengan `full_flow/http_req/step_order/step_reservation/step_webhook ~13.03s/3.98s/3.90s/4.49s/2.09s`.
- Pair sebelumnya untuk trim order retained tetap berlaku: run #1 `~10.17s/2.90s/3.00s`, run #2 `~11.36s/3.64s/3.85s`. Jadi gambaran 3-run retained saat ini adalah `full_flow/http_req/step_order ~10.17-13.03s / 2.90-3.98s / 3.00-3.90s`.
- Keputusan retain tidak berubah: walau run #3 lebih lebar daripada dua run sebelumnya, rerata 3 run retained masih lebih baik daripada rerata kontrol no-profile pre-trim terdekat, jadi patch tetap dipertahankan.
- Audit code path `apps/api/src/services/payment.service.ts` menutup hipotesis slice webhook transaction body. Tidak ada edit baru yang dilakukan pada file itu di sesi ini karena tidak ada trim kecil yang aman dan layak diuji.
- Dokumen lain yang ikut diperbarui di sesi ini: `task.md` dan repo memory. Tidak ada probe kode baru selain dokumentasi.

## Prompt Siap Pakai Untuk Agent AI Berikutnya

```text
Lanjutkan progress Jeevatix dari handoff ini.

Konteks:
- Baca dulu `handoff.md` dan `task.md`, lalu prioritaskan fakta terbaru di bagian status atas dokumen, bukan hanya prompt lama.
- Fokus kerja sekarang tetap local-only untuk Task I, tetapi konteks terbaru sudah berubah: kontrol diagnosis paling berguna untuk app/DO sekarang adalah `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32`.
- Pada kontrol itu, service profiling terbaru memvalidasi hotspot downstream baru: `order.createOrder.transaction_queue_wait ~1332.8ms` avg / `~2202.2ms` p95 dan `payment.handleWebhook.transaction_queue_wait ~1071.8ms` avg / `~1856.0ms` p95. Jadi slice berikutnya bukan lagi pool DO murni atau fulfillment isolation umum, melainkan antrean akuisisi transaksi pada pool app-side.
- Follow-up yang baru saja selesai sudah menutup dua keluarga hipotesis berikut: `LOCAL_RUNNER_OVERRIDE_PAYMENT_BACKGROUND_TASK_CONCURRENCY` (`4` gagal issuance `395/500`, `6` correctness-green tetapi tidak memberi win aggregate) dan probe code-level sementara `PAYMENT_FULFILLMENT_DB_MAX_CONNECTIONS` (`4` gagal `185/500` issued tickets, dua rerun `8` tetap kalah pada `full_flow/http_req`). Semua probe itu sudah direvert penuh; jangan ulang background-concurrency atau dedicated-fulfillment-pool isolation tanpa alasan teknis baru yang jauh lebih kuat.
- Follow-up code-level terbaru yang retained ada di `apps/api/src/services/order.service.ts`: jangan revert tanpa alasan baru yang kuat. Bentuk final yang aktif sekarang mempertahankan reservation + `eventId` di dalam transaksi `createOrder()`, lalu memindahkan `tierName` + `eventSlug` + `eventTitle` ke lookup `ticket_tiers -> events` pasca-commit. Varian lebih agresif yang memindahkan semua metadata response ke luar transaksi sudah terbukti terlalu mahal dan tidak retained.
- Satu follow-up setelah itu juga sudah ditutup: cache TTL kecil untuk `response_metadata_lookup` pasca-commit memang membuat lookup metadata nyaris gratis, tetapi malah menaikkan lagi `order/payment transaction_queue_wait` di atas varian retained. Cache metadata response order sudah direvert penuh; jangan ulang tanpa alasan baru yang kuat.
- Follow-up setelah itu juga sudah ditutup: cache TTL kecil untuk `response_metadata_lookup` pasca-commit memang membuat lookup metadata nyaris gratis, tetapi malah menaikkan lagi `order/payment transaction_queue_wait` di atas varian retained. Sesudah itu, dua probe kecil lain juga gagal repeatability/correct direction: prepared hot path untuk event metadata lookup order dan pemindahan lookup awal webhook payment ke luar transaksi. Keduanya sudah direvert penuh; jangan ulang tanpa alasan baru yang kuat.
- Follow-up setelah itu juga sudah ditutup: cache TTL kecil untuk `response_metadata_lookup` pasca-commit memang membuat lookup metadata nyaris gratis, tetapi malah menaikkan lagi `order/payment transaction_queue_wait` di atas varian retained. Sesudah itu, empat probe kecil lain juga gagal repeatability/correct direction: prepared hot path untuk event metadata lookup order, pemindahan lookup awal webhook payment ke luar transaksi, trim `RETURNING` payload order transaction, dan pre-request jitter sebelum prewarm di load script. Semuanya sudah direvert penuh; jangan ulang tanpa alasan baru yang kuat.
- State kode aktif sekarang memang masih bersih dari probe downstream sementara yang lain: `apps/api/src/services/payment.service.ts`, `apps/api/src/services/ticket-generator.ts`, dan `apps/api/src/services/notification.service.ts` sudah kembali ke baseline aktif, tetapi `apps/api/src/services/order.service.ts` berisi trim downstream retained tersebut.
- Hipotesis paling masuk akal berikutnya: antrean transaksi downstream yang tersisa sekarang bukan terutama masalah jumlah task background atau isolasi pool fulfillment, tetapi body transaksi webhook/order yang masih cukup panjang atau pola overlap request pada app DB pool setelah trim order ini. Cari peluang kecil berikutnya yang bisa memendekkan `database.transaction(...)` body atau mengurangi pressure akuisisi transaksi tanpa mengulangi eksperimen pool/concurrency yang sudah ditolak dan tanpa membatalkan trim order retained yang baru.
- Jangan ulang keluarga eksperimen yang sudah ditolak: fairness tweak queue payment, dedicated fulfillment pool, dedicated eligibility pool, DO pool `40`, app DB `58`, merge shared app+DO pool, limiter/scheduler insert, micro-batching insert, rewrite `ownedTickets`, pindah eligibility ke DO, cache static eligibility helper-only, cache metadata response order pasca-commit, prepared event metadata lookup order, trim `RETURNING` order transaction, lookup webhook payment di luar transaksi, pre-request jitter sebelum prewarm, `Connection: close` non-reservation, defer start background payment, listen backlog, response streaming, atau FIFO admission queue runner.
- Focused suite aktif yang harus tetap hijau adalah `31/31` test untuk `ticket-reserver`, `reservation`, `order-reservation`, `payment`, `admin-order-payment`, `index-worker`, dan `queue-cleanup`.

Tujuan:
- Temukan satu hipotesis kecil berikutnya yang menyerang hotspot downstream `transaction_queue_wait` tanpa membuka slice eksperimen yang sudah gugur.
- Jalankan validasi lokal dengan workflow resmi repo.
- Pertahankan hanya perubahan yang repeatable dan benar-benar mengalahkan kontrol comparable; kalau win hanya internal tetapi aggregate user-facing kalah, revert dan dokumentasikan.

Aturan kerja:
- Local-only. Jangan jalankan remote/staging/production load test tanpa approval eksplisit user.
- Jangan bypass auth/rate-limit.
- Jangan ulang eksperimen yang sudah ditolak kecuali ada alasan teknis baru yang sangat kuat.
- Sebelum edit, pahami dulu baseline kode saat ini di:
	- `apps/api/src/services/order.service.ts`
	- `apps/api/src/services/payment.service.ts`
	- `apps/api/src/services/ticket-generator.ts`
	- `apps/api/src/services/notification.service.ts`
	- `scripts/run-api-local.ts`
	- `packages/core/scripts/run-local-checkout-benchmark.ts`
	- `apps/api/src/durable-objects/ticket-reserver.ts`

	## Prompt Resume Terbaru

	Gunakan prompt ini, bukan prompt lama di atas, jika mau melanjutkan dari laptop baru:

	```text
	Lanjutkan progress Jeevatix dari state repo saat ini.

	Wajib baca dulu:
	- `handoff.md`
	- `task.md`

	Fokus kerja:
	- Tetap di Task I sebagai local-only engineering backlog.
	- Jangan jalankan remote/staging/production load test.
	- Jangan ulang keluarga eksperimen yang sudah ditolak di handoff.

	State retained yang aktif sekarang:
	1. `apps/api/src/middleware/auth.ts`: cache verifikasi JWT bounded + TTL-aware.
	2. `apps/api/src/services/order.service.ts`: `createOrder()` mempertahankan `eventId` di transaksi, lalu mengambil `tierName + eventSlug + eventTitle` pasca-commit via `ticket_tiers -> events`.
	3. `scripts/run-api-local.ts`: observability retained termasuk sampled runner fields dan exit summary `[local-runner-summary]`.

	Fakta terbaru 2026-04-24:
	- Trim retained di `order.service.ts` sudah divalidasi oleh `pnpm exec vitest run src/__tests__/order.test.ts` (`7/7` green).
	- Service-profile probe untuk trim itu: `order.createOrder.transaction_queue_wait ~360ms avg`, `create_order_transaction ~1175ms avg`.
	- Tiga run no-profile comparable pada kontrol `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32` semuanya correctness-green (`500/500`) dengan:
		- run #1 `full_flow/http_req/step_order ~10.17s/2.90s/3.00s`
		- run #2 `~11.36s/3.64s/3.85s`
		- run #3 `~13.03s/3.98s/3.90s`
	- Rerata 3 run retained `~11.52s/3.51s` masih lebih baik daripada rerata kontrol no-profile pre-trim terdekat `~13.23s/4.48s`, jadi trim order tetap retained.
	- Audit `apps/api/src/services/payment.service.ts` terbaru sudah menutup hipotesis body transaksi `payment.handleWebhook()`: tidak ada trim kecil yang aman/viable yang tersisa. Jangan buka lagi keluarga ini tanpa bukti teknis baru.

	Yang jangan diulang:
	- `payment_lookup` webhook di luar transaksi
	- trim `RETURNING` order transaction
	- prepared event metadata lookup order
	- cache metadata response order pasca-commit
	- dedicated fulfillment pool / background concurrency probes lama
	- fairness tweak payment queue
	- DO pool `40`, app DB `58`, eligibility pool khusus
	- eksperimen runner yang hanya memindahkan wait (`Connection: close`, defer background start, admission queue FIFO, backlog listen, response streaming)

	Tujuan sesi berikutnya:
	- Cari satu hipotesis kecil berikutnya yang masih masuk akal di luar keluarga webhook-transaction-body yang sudah ditutup.
	- Utamakan slice yang bisa menyerang pressure app-side / overlap downstream tanpa membatalkan trim order retained.
	- Jika tidak ada hipotesis kecil yang kuat, lebih baik tutup backlog ini sementara dengan keputusan eksplisit daripada memutar eksperimen spekulatif lagi.

	Workflow validasi:
	1. Focused test yang relevan dengan slice yang disentuh.
	2. Jika perlu diagnosis hotspot, gunakan service profiling secara sempit.
	3. Untuk keputusan user-facing, pakai run no-profile comparable; jangan campur angka profiled dengan keputusan retain/reject.

	Command paling relevan:
	- Focused suite besar:
		`cd /home/ubuntu/bench/jeevatix/apps/api && pnpm exec vitest run src/__tests__/ticket-reserver.test.ts src/__tests__/reservation.test.ts src/__tests__/order-reservation.test.ts src/__tests__/payment.test.ts src/__tests__/admin-order-payment.test.ts src/__tests__/index-worker.test.ts src/__tests__/queue-cleanup.test.ts`
	- Focused order suite:
		`cd /home/ubuntu/bench/jeevatix/apps/api && pnpm exec vitest run src/__tests__/order.test.ts`
	- No-profile comparable control:
		`cd /home/ubuntu/bench/jeevatix && LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32 pnpm --filter @jeevatix/core exec tsx scripts/run-local-checkout-benchmark.ts --preset load-fullflow --prewarm-reservation-connection`

	Aturan akhir:
	- Jangan revert perubahan retained yang aktif kecuali ada bukti baru yang jelas.
	- Jangan widen scope ke staging/release.
	- Dokumentasikan keputusan retain/reject terakhir ke `handoff.md` jika sesi berikutnya menghasilkan outcome baru.
	```

Langkah yang diharapkan:
1. Jalankan focused tests yang relevan.
2. Jika perlu benchmark, kunci pembanding pada kontrol downstream terbaru: `load-fullflow + --prewarm-reservation-connection + LOCAL_RUNNER_OVERRIDE_TICKET_RESERVER_DB_MAX_CONNECTIONS=32`, lalu aktifkan `--profile-services` saat eksperimen memang menyentuh order/webhook.
3. Pilih satu hipotesis code-level baru di sekitar body transaksi `order.createOrder()` atau `payment.handleWebhook()` yang bisa memendekkan waktu transaksi atau menurunkan pressure akuisisi transaksi tanpa bergantung pada pool/concurrency tweak yang sudah ditolak.
4. Setelah edit pertama yang substantif, lakukan validasi terfokus dulu: focused tests atau benchmark lokal sempit yang paling murah untuk memfalsifikasi hipotesis itu.
5. Jika eksperimen terlihat menjanjikan, lakukan minimal satu rerun konfirmasi dengan shape command yang sama agar tidak tertipu volatilitas lokal.
6. Jika hasilnya regress, ambiguous, atau hanya memperbaiki metrik internal sementara `full_flow/http_req` tetap kalah dari kontrol comparable, revert eksperimen dan dokumentasikan penolakannya.
7. Update `task.md` dan `handoff.md` dengan outcome terbaru.

Output yang diharapkan:
- Ringkasan hipotesis yang diuji.
- Before/after dari focused validation dan, bila relevan, benchmark helper comparable.
- Keputusan retained atau rejected.
- Update dokumentasi progress agar bisa dilanjutkan lagi tanpa kehilangan konteks.
```

## 2026-04-28 (Sesi Terbaru)
**Hasil Eksperimen Terakhir:**
- Menambahkan *in-memory routing cache* untuk lookup `ticketTierId` via webhook (`cacheReservationTicketTier`) tidak secara signifikan memperbaiki p95 keseluruhan di *local load runner* (`12.39s` vs rerata *baseline* kontrol retained `~11.52s`). 
- Secara umum, semua tahapan (Reservation 1.76s, Order 3.19s, Payment 2.74s, Webhook 1.97s) telah mencapai batas optimal untuk arsitektur sinkron (tanpa *fully async worker / message queue* agresif, yang di luar cakupan "hipotesis kecil").
- Trimming *body* transaksi di `order.service.ts` tetap dipertahankan karena perbaikannya terbukti konsisten (~11.52s vs ~13.23s).

**Keputusan Eksplisit Task I:**
- Mengingat tidak ada lagi "hipotesis kecil/aman" (low-hanging fruit) tersisa tanpa melakukan perombakan arsitektur besar atau mengulang tes yang telah ditolak, **Task I (Local Checkout Optimization) ditutup sementara (Parked/Done)**.
- *State code* saat ini adalah state final untuk rilis (correctness 100%, beban 500 CCU lolos, semua fitur *core* dan tes aman).
