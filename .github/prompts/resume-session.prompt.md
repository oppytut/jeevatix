---
name: resume-session
description: "Panggil prompt ini saat pertama kali membuka workspace atau berganti laptop (via Remote SSH) untuk melanjutkan progress dengan optimal"
agent: agent
---
# Resume Session (Handoff Synchronization)

Saya menggunakan Remote SSH dan baru saja berganti environment fisik (laptop), namun saya berada di workspace yang sama. Tiga tujuan utama kita saat ini adalah rekalkulasi konteks, memastikan tidak ada progress terputus, dan merencanakan langkah harian. 

Tolong ikuti urutan operasional berikut ini tanpa *skip*, gunakan parallel tools jika perlu:

1. **Sinkronisasi Repo**:
   - Jalankan `git status` dan `git log -1` untuk melihat status *working tree* dan commit terakhir. Pastikan tak ada yang *dangling*.
2. **Pembacaan Memori Proyek**:
   - Baca dokumen utama penyimpan *state* yaitu `handoff.md`.
   - Cek referensi dokumen terkait yang dirujuk oleh handoff tersebut (contoh: `DEVELOPMENT_PLAN.md` atau `PRODUCTION_RELEASE_RUNBOOK.md`).
3. **Analisis Konteks Berjalan**:
   - Tentukan *Tugas Aktif* (*Active Task*) yang sedang berjalan berdasarkan `handoff.md` atau pesan terakhir dari pengguna.
   - Jika terdapat *blocking issue* sebelumnya, asumsikan itu target prioritas saat ini.
4. **Berikan Resume Harian untuk Saya**:
   Tuliskan respons ringkas dengan format:
   - **Terkini**: Di mana posisi terakhir proyek (Branch & Status Git).
   - **Fokus Transisi**: Ringkasan singkat info *handoff*.
   - **Langkah Pertama**: Apa file pertama yang harus kita ubah/tulis/eksekusi sesuai *TODO* selanjutnya.

Diakhiri dengan pertanyaan "Apakah siap melanjutkan eksekusi langkah pertama?"
