# Solusi: Hapus Workers-Managed DNS Records

## Problem
Error: "A DNS record managed by Workers already exists on that host."

Ini terjadi karena SST sudah membuat DNS records otomatis saat deploy dengan `domain` config, dan records tersebut **managed by Cloudflare Workers** sehingga tidak bisa di-edit manual.

## Root Cause
Di `sst.config.ts`, kita sudah set custom domain:
```typescript
domain: deployedDomains?.seller  // seller.jeevatix.my.id
```

SST otomatis membuat DNS records, tapi karena workers.dev limitation, records ini tidak berfungsi untuk inter-worker communication.

## Solution: Hapus Workers-Managed Records & Buat Manual CNAME

### Step 1: Identifikasi Records yang Conflict

Di Cloudflare Dashboard → jeevatix.my.id → DNS → Records, cari records dengan:
- **Icon**: ⚙️ (gear icon) atau label "Managed by Workers"
- **Name**: seller, admin, @ (root)
- **Type**: Biasanya AAAA atau A record

### Step 2: Hapus Workers-Managed Records

**⚠️ PENTING: Jangan hapus record `api` yang sudah berhasil ditambahkan!**

Untuk setiap record yang conflict (seller, admin, @):

1. **Klik record** yang ingin dihapus
2. Klik **Edit**
3. Scroll ke bawah
4. Klik **Delete** (biasanya ada di bawah form)
5. Confirm deletion

**Atau via Cloudflare Dashboard:**
1. Hover over record
2. Klik icon **⋮** (three dots) di kanan
3. Pilih **Delete**
4. Confirm

### Step 3: Tambahkan CNAME Records Manual

Setelah menghapus workers-managed records, tambahkan CNAME manual:

#### Seller Portal
```
Type:    CNAME
Name:    seller
Target:  jeevatix-staging-seller.ariefna95.workers.dev
Proxy:   ✅ ON (Orange Cloud)
```

#### Admin Portal
```
Type:    CNAME
Name:    admin
Target:  jeevatix-staging-admin.ariefna95.workers.dev
Proxy:   ✅ ON (Orange Cloud)
```

#### Buyer Portal (Root)
```
Type:    CNAME
Name:    @ (atau kosongkan)
Target:  jeevatix-staging-buyer.ariefna95.workers.dev
Proxy:   ✅ ON (Orange Cloud)
```

### Step 4: Update SST Config (Prevent Auto-Creation)

Untuk mencegah SST membuat workers-managed records lagi, kita perlu update `sst.config.ts`:

```typescript
// Temporary: Disable custom domain untuk portal
// Setelah DNS manual setup, kita bisa enable lagi

const buyer = new sst.cloudflare.Worker('BuyerPortal', {
  handler: 'apps/buyer/.svelte-kit/cloudflare/_worker.js',
  assets: {
    directory: 'apps/buyer/.svelte-kit',
  },
  url: true,  // Force workers.dev URL
  // domain: deployedDomains?.buyer,  // Commented out
  transform: {
    worker(args) {
      applyPortalWorkerTransform(args, buyerScriptName);
    },
  },
});

// Same untuk admin dan seller
```

**Tapi ini bukan solusi ideal** karena kita tetap butuh custom domain.

## Alternative Solution: Use Workers Routes (Recommended)

Alih-alih menggunakan SST `domain` config, kita bisa setup **Workers Routes** manual di Cloudflare Dashboard:

### Step 1: Hapus `domain` Config dari SST

Edit `sst.config.ts`:

```typescript
const seller = new sst.cloudflare.Worker('SellerPortal', {
  handler: 'apps/seller/.svelte-kit/cloudflare/_worker.js',
  assets: {
    directory: 'apps/seller/.svelte-kit',
  },
  url: true,  // Keep workers.dev URL
  // domain: deployedDomains?.seller,  // Remove this
  transform: {
    worker(args) {
      applyPortalWorkerTransform(args, sellerScriptName);
    },
  },
});
```

### Step 2: Deploy Ulang (Akan Hapus Workers-Managed Records)

```bash
SKIP_DURABLE_OBJECT_MIGRATIONS=1 pnpm run deploy --stage staging
```

### Step 3: Setup DNS Records Manual (Sekarang Tidak Ada Conflict)

Tambahkan CNAME records seperti di Step 3 di atas.

### Step 4: Setup Workers Routes di Cloudflare Dashboard

1. Buka Cloudflare Dashboard → jeevatix.my.id
2. Klik **Workers Routes** di sidebar
3. Klik **Add route**

**Route 1: Seller Portal**
```
Route:   seller.jeevatix.my.id/*
Worker:  jeevatix-staging-seller
```

**Route 2: Admin Portal**
```
Route:   admin.jeevatix.my.id/*
Worker:  jeevatix-staging-admin
```

**Route 3: Buyer Portal**
```
Route:   jeevatix.my.id/*
Worker:  jeevatix-staging-buyer
```

**Route 4: API**
```
Route:   api.jeevatix.my.id/*
Worker:  jeevatix-staging-api
```

### Step 5: Verify

```bash
# Test API
curl https://api.jeevatix.my.id/health

# Test Seller Portal
curl -I https://seller.jeevatix.my.id/login

# Test debug endpoint
curl https://seller.jeevatix.my.id/debug | jq .
```

## Quick Fix Script

Saya akan buat script untuk otomatis setup Workers Routes:

```bash
./scripts/setup-workers-routes.sh
```

## Which Solution to Use?

**Recommended: Alternative Solution (Workers Routes)**
- ✅ Lebih flexible
- ✅ Tidak conflict dengan SST
- ✅ Bisa di-manage manual
- ✅ Support multiple workers per domain

**Original Solution (Delete & Re-add)**
- ⚠️ Bisa conflict lagi saat deploy
- ⚠️ Perlu disable `domain` di SST
- ⚠️ Less flexible

## Next Steps

1. Pilih solution yang mau digunakan
2. Follow steps di atas
3. Rebuild seller dengan custom domain API
4. Test login

Saya akan buat script untuk Alternative Solution sekarang.
