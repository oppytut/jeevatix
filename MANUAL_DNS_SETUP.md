# Manual DNS Setup Guide - Jeevatix Staging

## Prerequisites
- Akses ke Cloudflare Dashboard
- Domain `jeevatix.my.id` sudah terdaftar di Cloudflare

## Step-by-Step Setup

### 1. Login ke Cloudflare Dashboard
1. Buka https://dash.cloudflare.com
2. Login dengan credentials Anda
3. Pilih domain **jeevatix.my.id** dari daftar

### 2. Buka DNS Management
1. Di sidebar kiri, klik **DNS**
2. Klik tab **Records**

### 3. Tambahkan DNS Records

#### Record 1: API Staging
```
Type:    CNAME
Name:    api
Target:  jeevatix-staging-api.ariefna95.workers.dev
Proxy:   ✅ Proxied (Orange Cloud)
TTL:     Auto
```

**Cara menambahkan:**
1. Klik tombol **Add record**
2. Pilih **Type**: CNAME
3. **Name**: ketik `api`
4. **Target**: ketik `jeevatix-staging-api.ariefna95.workers.dev`
5. Pastikan **Proxy status** adalah **Proxied** (ikon cloud berwarna orange)
6. Klik **Save**

#### Record 2: Seller Portal Staging
```
Type:    CNAME
Name:    seller
Target:  jeevatix-staging-seller.ariefna95.workers.dev
Proxy:   ✅ Proxied (Orange Cloud)
TTL:     Auto
```

#### Record 3: Admin Portal Staging
```
Type:    CNAME
Name:    admin
Target:  jeevatix-staging-admin.ariefna95.workers.dev
Proxy:   ✅ Proxied (Orange Cloud)
TTL:     Auto
```

#### Record 4: Buyer Portal Staging (Root Domain)
```
Type:    CNAME
Name:    @ (atau kosongkan untuk root domain)
Target:  jeevatix-staging-buyer.ariefna95.workers.dev
Proxy:   ✅ Proxied (Orange Cloud)
TTL:     Auto
```

**⚠️ Catatan untuk Root Domain:**
- Jika sudah ada A record untuk `@`, Anda perlu menghapusnya dulu
- CNAME untuk root domain hanya bisa ada satu
- Pastikan tidak ada conflict dengan record lain

### 4. Verifikasi DNS Records

Setelah menambahkan semua records, verifikasi di terminal:

```bash
# Check API
host api.jeevatix.my.id

# Check Seller Portal
host seller.jeevatix.my.id

# Check Admin Portal
host admin.jeevatix.my.id

# Check Buyer Portal (root)
host jeevatix.my.id
```

**Expected output:**
```
api.jeevatix.my.id is an alias for jeevatix-staging-api.ariefna95.workers.dev.
```

### 5. Test Endpoints

Setelah DNS propagate (5-10 menit), test endpoints:

```bash
# Test API
curl https://api.jeevatix.my.id/health

# Test Seller Portal
curl -I https://seller.jeevatix.my.id/login

# Test Admin Portal
curl -I https://admin.jeevatix.my.id/login

# Test Buyer Portal
curl -I https://jeevatix.my.id
```

### 6. Rebuild & Redeploy

Setelah DNS bekerja, rebuild seller portal dengan custom domain:

```bash
cd /home/debian/project/jeevatix

# Rebuild seller dengan API custom domain
PUBLIC_API_BASE_URL=https://api.jeevatix.my.id pnpm --filter seller run build

# Deploy ke staging
SKIP_DURABLE_OBJECT_MIGRATIONS=1 pnpm run deploy --stage staging
```

### 7. Run E2E Test

Update test untuk menggunakan custom domain:

```bash
# Edit test file
nano tests/e2e/staging-seller-login.spec.ts

# Ganti URL dari:
# https://jeevatix-staging-seller.ariefna95.workers.dev
# Menjadi:
# https://seller.jeevatix.my.id

# Run test
pnpm exec playwright test staging-seller-login.spec.ts --project=staging
```

## Troubleshooting

### DNS Belum Propagate
**Symptom:** `host` command mengembalikan `NXDOMAIN`

**Solution:** 
- Tunggu 5-10 menit
- Clear DNS cache: `sudo systemd-resolve --flush-caches` (Linux)
- Test dengan DNS checker online: https://dnschecker.org

### SSL Certificate Error
**Symptom:** `curl` mengembalikan SSL error

**Solution:**
- Cloudflare otomatis provision SSL certificate
- Tunggu beberapa menit untuk certificate activation
- Pastikan Proxy status adalah **Proxied** (orange cloud)

### 404 Error Setelah DNS Setup
**Symptom:** DNS resolve tapi endpoint mengembalikan 404

**Solution:**
- Pastikan SST deployment sudah selesai
- Cek custom domain di SST output: `seller: https://seller.jeevatix.my.id`
- Redeploy jika perlu

### Workers.dev URL Masih Digunakan
**Symptom:** Login masih gagal dengan error 1042

**Solution:**
- Rebuild seller portal dengan `PUBLIC_API_BASE_URL=https://api.jeevatix.my.id`
- Verifikasi di debug endpoint: `curl https://seller.jeevatix.my.id/debug`
- Pastikan `API_BASE_URL` menunjuk ke custom domain, bukan workers.dev

## Screenshot Locations

Untuk referensi visual, lihat screenshot di:
- Cloudflare DNS Management: `/tmp/cloudflare-dns-*.png` (jika ada)
- Successful login: `/tmp/seller-login-success.png`
- Failed login: `/tmp/seller-login-failed.png`

## Support

Jika masih ada masalah setelah mengikuti guide ini:
1. Cek logs di Cloudflare Dashboard → Workers → jeevatix-staging-seller → Logs
2. Run debug endpoint: `curl https://seller.jeevatix.my.id/debug | jq .`
3. Verifikasi API accessible: `curl https://api.jeevatix.my.id/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"seller@jeevatix.id","password":"Seller123!"}'`
