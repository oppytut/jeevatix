# Quick Fix: Workers-Managed DNS Conflict

## Situasi Saat Ini
- ✅ `api.jeevatix.my.id` berhasil ditambahkan (CNAME manual)
- ❌ `seller`, `admin`, `@` tidak bisa ditambahkan (conflict dengan workers-managed records)

## Solusi Tercepat: Manual Setup via Dashboard

### Step 1: Hapus Workers-Managed Records

Di Cloudflare Dashboard → jeevatix.my.id → DNS → Records:

1. **Cari records dengan icon ⚙️ (gear) atau label "Managed by Workers"**
   - Biasanya untuk: `seller`, `admin`, `@` (root domain)
   - Type: AAAA atau A record

2. **Untuk setiap record yang conflict:**
   - Klik record
   - Klik **Delete** di bawah form
   - Atau klik icon **⋮** (three dots) → Delete
   - Confirm deletion

**⚠️ JANGAN hapus record `api` yang sudah berhasil ditambahkan!**

### Step 2: Tambahkan CNAME Records

Setelah menghapus workers-managed records, tambahkan CNAME:

**Seller Portal:**
```
Type:    CNAME
Name:    seller
Target:  jeevatix-staging-seller.ariefna95.workers.dev
Proxy:   ✅ ON
```

**Admin Portal:**
```
Type:    CNAME
Name:    admin
Target:  jeevatix-staging-admin.ariefna95.workers.dev
Proxy:   ✅ ON
```

**Buyer Portal (Root):**
```
Type:    CNAME
Name:    @
Target:  jeevatix-staging-buyer.ariefna95.workers.dev
Proxy:   ✅ ON
```

### Step 3: Setup Workers Routes

Setelah DNS records ditambahkan, setup Workers Routes:

1. Buka Cloudflare Dashboard → jeevatix.my.id
2. Klik **Workers Routes** di sidebar
3. Klik **Add route** untuk setiap route:

**API:**
```
Route:   api.jeevatix.my.id/*
Worker:  jeevatix-staging-api
```

**Seller:**
```
Route:   seller.jeevatix.my.id/*
Worker:  jeevatix-staging-seller
```

**Admin:**
```
Route:   admin.jeevatix.my.id/*
Worker:  jeevatix-staging-admin
```

**Buyer:**
```
Route:   jeevatix.my.id/*
Worker:  jeevatix-staging-buyer
```

### Step 4: Verify DNS

```bash
# Wait 2-3 minutes for DNS propagation
sleep 180

# Test DNS
host api.jeevatix.my.id
host seller.jeevatix.my.id
host admin.jeevatix.my.id
host jeevatix.my.id
```

### Step 5: Test Endpoints

```bash
# Test API
curl https://api.jeevatix.my.id/health

# Test Seller Portal
curl -I https://seller.jeevatix.my.id/login

# Test debug endpoint
curl https://seller.jeevatix.my.id/debug | jq .
```

### Step 6: Rebuild & Deploy

```bash
cd /home/debian/project/jeevatix

# Rebuild seller dengan custom domain API
PUBLIC_API_BASE_URL=https://api.jeevatix.my.id pnpm --filter seller run build

# Deploy (tidak akan create workers-managed records lagi karena sudah ada manual CNAME)
SKIP_DURABLE_OBJECT_MIGRATIONS=1 pnpm run deploy --stage staging
```

### Step 7: Update Test & Run

```bash
# Update test file
nano tests/e2e/staging-seller-login.spec.ts

# Ganti URL dari:
# https://jeevatix-staging-seller.ariefna95.workers.dev
# Menjadi:
# https://seller.jeevatix.my.id

# Run test
pnpm exec playwright test staging-seller-login.spec.ts --project=staging
```

## Alternative: Automated Workers Routes Setup

Jika Anda sudah selesai Step 1-2 (DNS records sudah ditambahkan), jalankan:

```bash
./scripts/setup-workers-routes.sh
```

Script ini akan otomatis setup Workers Routes untuk semua services.

## Troubleshooting

### Tidak Bisa Hapus Workers-Managed Record
**Solution:** Deploy ulang dengan custom domain disabled

```bash
# Edit sst.config.ts - comment out domain config
# Lalu deploy:
SKIP_DURABLE_OBJECT_MIGRATIONS=1 pnpm run deploy --stage staging

# Setelah deploy, workers-managed records akan terhapus otomatis
# Lalu tambahkan CNAME manual
```

### Workers Routes Tidak Muncul
**Check:** Pastikan worker name benar
- `jeevatix-staging-api`
- `jeevatix-staging-seller`
- `jeevatix-staging-admin`
- `jeevatix-staging-buyer`

**Verify:** Buka Cloudflare Dashboard → Workers & Pages → Overview
Lihat daftar workers yang ada.

### DNS Resolve Tapi 404
**Check:** Workers Routes sudah di-setup?
**Solution:** Setup Workers Routes di Step 3

### Login Masih Gagal
**Check:** API_BASE_URL di seller portal
```bash
curl https://seller.jeevatix.my.id/debug | jq .API_BASE_URL
```

**Should return:** `"https://api.jeevatix.my.id"`

**If not:** Rebuild dengan `PUBLIC_API_BASE_URL=https://api.jeevatix.my.id`

## Expected Timeline

- Step 1-2 (Delete & Add DNS): 5 minutes
- Step 3 (Workers Routes): 3 minutes
- Step 4 (DNS Propagation): 2-3 minutes
- Step 5 (Test): 2 minutes
- Step 6 (Rebuild & Deploy): 5 minutes
- Step 7 (Test E2E): 2 minutes

**Total: ~20 minutes**

## Success Criteria

✅ All DNS records resolve correctly
✅ All Workers Routes configured
✅ API accessible via custom domain
✅ Seller portal accessible via custom domain
✅ Debug endpoint shows correct API_BASE_URL
✅ Login works successfully
✅ E2E test passes
