---
description: "Prepare a load-test approval request and cost-risk preflight before any remote load test, stress test, benchmark, synthetic traffic run, or bulk load-test data operation."
agent: "agent"
argument-hint: "Describe the target environment, scenario, and scale you want to evaluate"
---
Siapkan preflight sebelum menjalankan load test atau traffic generator remote.

## Tujuan

- Ringkas risiko biaya dan side effect sebelum ada eksekusi.
- Minta konfirmasi eksplisit user.
- Jangan jalankan command load test apa pun pada langkah ini.

## Langkah

1. Identifikasi target environment:
   - local, staging, preview, atau production
   - domain / worker / service yang akan disentuh

2. Ringkas skala yang direncanakan:
   - jumlah virtual users / request / durasi / concurrency
   - apakah ada login burst, webhook burst, upload, queueing, atau cleanup besar

3. Ringkas surface billing atau risiko resource:
   - Workers / CPU time
   - Durable Objects / duration
   - Queues operations
   - R2 operations atau storage
   - Hyperdrive / database origin load
   - third-party costs jika ada

4. Ringkas side effect:
   - data synthetic yang dibuat
   - email / payment / webhook / notification side effect
   - rate limit atau anti-abuse protections yang mungkin terpukul

5. Ringkas cleanup plan:
   - data apa yang akan dibersihkan
   - command atau script cleanup yang relevan
   - apakah ada state yang tidak bisa dipulihkan otomatis

6. Akhiri dengan permintaan konfirmasi eksplisit user.

## Output Format

Gunakan struktur ringkas berikut:

- Environment
- Planned Scale
- Billing Surfaces
- Side Effects
- Cleanup Plan
- Approval Request

Pada bagian akhir, tanyakan langsung apakah user menyetujui eksekusi load test tersebut.