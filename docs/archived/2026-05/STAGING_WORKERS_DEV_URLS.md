# Staging Workers.dev URLs

**Generated:** 2026-05-03 09:46 UTC  
**Purpose:** Temporary workaround untuk DNS issue pada custom domain staging

## 🔗 Workers.dev URLs

Karena custom domain `jeevatix.my.id` mengalami DNS resolution issue (DNS records menggunakan `100::` yang tidak valid), workers.dev subdomain telah diaktifkan sebagai alternative access.

### API
- **URL:** https://jeevatix-staging-api.ariefna95.workers.dev
- **Health Check:** https://jeevatix-staging-api.ariefna95.workers.dev/health
- **Status:** ✅ Berfungsi dengan baik

### Admin Portal
- **URL:** https://jeevatix-staging-admin.ariefna95.workers.dev
- **Status:** ✅ Berfungsi (redirect ke /login)

### Seller Portal
- **URL:** https://jeevatix-staging-seller.ariefna95.workers.dev
- **Status:** ✅ Berfungsi (redirect ke /login)

### Buyer Portal
- **URL:** https://jeevatix-staging-buyer.ariefna95.workers.dev
- **Login:** https://jeevatix-staging-buyer.ariefna95.workers.dev/login ✅
- **Register:** https://jeevatix-staging-buyer.ariefna95.workers.dev/register ✅
- **Homepage:** ⚠️ HTTP 500 (SSR fetch issue)
- **Events Page:** ⚠️ 404 Request failed

## ✅ Konfigurasi yang Sudah Dilakukan

1. ✅ Workers.dev routes diaktifkan untuk semua workers
2. ✅ PUBLIC_API_BASE_URL diupdate ke `https://jeevatix-staging-api.ariefna95.workers.dev`
3. ✅ CORS_ALLOWED_ORIGINS dikonfigurasi dengan workers.dev origins
4. ✅ Rebuild dan redeploy semua workers

## ⚠️ Known Issues

### Buyer Portal Homepage (HTTP 500)
- **Issue:** Homepage melakukan SSR fetch yang gagal
- **Workaround:** Gunakan halaman lain yang berfungsi (login, register)
- **Root Cause:** Kemungkinan error handling di SvelteKit SSR load function
- **Solution:** Perlu debugging SvelteKit server-side load function di `apps/buyer/src/routes/+page.server.ts`

## 📋 Root Cause: DNS Issue

Custom domain `jeevatix.my.id` dan subdomainnya menggunakan DNS records dengan `100::` (IPv6 discard prefix) yang tidak valid untuk routing. DNS records ini adalah read-only karena dikelola oleh Cloudflare Workers custom domain system.

### Verifikasi DNS Issue:
```bash
# DNS tidak resolve
curl https://api.jeevatix.my.id/health
# Error: Could not resolve host: api.jeevatix.my.id

# Tapi workers berfungsi dengan --resolve
curl --resolve api.jeevatix.my.id:443:104.21.0.1 https://api.jeevatix.my.id/health
# Response: {"status":"ok",...}
```

### Solusi Permanen:

**Opsi A:** Kontak Cloudflare Support untuk memperbaiki DNS records `100::` → valid IP  
**Opsi B:** Hapus custom domain, buat DNS records manual, setup Worker routes manual  
**Opsi C:** Gunakan workers.dev URLs secara permanen (current workaround)

## 📝 Testing dengan Workers.dev URLs

### Test API Health:
```bash
curl https://jeevatix-staging-api.ariefna95.workers.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "api",
  "environment": "staging",
  "version": "manual-staging",
  "timestamp": "2026-05-03T09:46:44.918Z"
}
```

### Test Admin Portal:
```bash
curl -I https://jeevatix-staging-admin.ariefna95.workers.dev
```

Expected: HTTP 307 redirect to /login

### Test Seller Portal:
```bash
curl -I https://jeevatix-staging-seller.ariefna95.workers.dev
```

Expected: HTTP 307 redirect to /login

## ⚠️ Catatan Penting

1. **Workers.dev URLs adalah public** - siapa saja bisa mengakses jika tahu URL-nya
2. **Tidak ada custom domain** - URL menggunakan subdomain Cloudflare
3. **Buyer portal perlu rebuild** dengan PUBLIC_API_BASE_URL yang benar
4. **CORS configuration** mungkin perlu diupdate untuk menerima workers.dev origin

## 🔄 Next Steps

1. ✅ Workers.dev routes sudah diaktifkan
2. ⏳ Update PUBLIC_API_BASE_URL dan rebuild buyer portal
3. ⏳ Kontak Cloudflare support untuk memperbaiki DNS custom domain
4. ⏳ Update CORS_ALLOWED_ORIGINS jika diperlukan
