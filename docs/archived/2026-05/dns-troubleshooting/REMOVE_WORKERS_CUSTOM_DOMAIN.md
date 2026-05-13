# Solusi: Hapus Custom Domain dari Workers Settings

## Problem
DNS records untuk seller, admin, dan buyer adalah **read-only** (managed by Workers) dan tidak bisa dihapus manual dari DNS Records page.

## Solution: Hapus Custom Domain dari Workers Settings

### Step 1: Hapus Custom Domain dari Seller Worker

1. Buka Cloudflare Dashboard
2. Klik **Workers & Pages** di sidebar
3. Cari worker: **jeevatix-staging-seller**
4. Klik worker tersebut
5. Klik tab **Settings**
6. Scroll ke section **Domains & Routes**
7. Cari domain: **seller.jeevatix.my.id**
8. Klik **Remove** atau **Delete** di sebelah domain
9. Confirm deletion

### Step 2: Hapus Custom Domain dari Admin Worker

1. Kembali ke Workers & Pages
2. Cari worker: **jeevatix-staging-admin**
3. Klik worker → Settings → Domains & Routes
4. Hapus domain: **admin.jeevatix.my.id**
5. Confirm

### Step 3: Hapus Custom Domain dari Buyer Worker

1. Kembali ke Workers & Pages
2. Cari worker: **jeevatix-staging-buyer**
3. Klik worker → Settings → Domains & Routes
4. Hapus domain: **jeevatix.my.id** (root domain)
5. Confirm

### Step 4: Verify DNS Records Terhapus

1. Kembali ke DNS → Records
2. Verify bahwa records untuk seller, admin, dan @ (buyer) sudah terhapus
3. Record `api` tetap ada (karena ditambahkan manual)

### Step 5: Tambah CNAME Records Manual

Sekarang Anda bisa menambahkan CNAME records tanpa conflict:

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

**Buyer Portal:**
```
Type:    CNAME
Name:    @
Target:  jeevatix-staging-buyer.ariefna95.workers.dev
Proxy:   ✅ ON
```

### Step 6: Setup Workers Routes

Setelah DNS records ditambahkan, setup Workers Routes:

**Option A: Manual via Dashboard**

1. Cloudflare Dashboard → jeevatix.my.id
2. Klik **Workers Routes** di sidebar
3. Klik **Add route**

Tambahkan 4 routes:

```
Route 1:
  Pattern: api.jeevatix.my.id/*
  Worker:  jeevatix-staging-api

Route 2:
  Pattern: seller.jeevatix.my.id/*
  Worker:  jeevatix-staging-seller

Route 3:
  Pattern: admin.jeevatix.my.id/*
  Worker:  jeevatix-staging-admin

Route 4:
  Pattern: jeevatix.my.id/*
  Worker:  jeevatix-staging-buyer
```

**Option B: Automated Script**

```bash
./scripts/setup-workers-routes.sh
```

### Step 7: Verify & Test

```bash
# Wait for DNS propagation
sleep 180

# Test DNS
host api.jeevatix.my.id
host seller.jeevatix.my.id
host admin.jeevatix.my.id
host jeevatix.my.id

# Test endpoints
curl https://api.jeevatix.my.id/health
curl https://seller.jeevatix.my.id/login -I
curl https://seller.jeevatix.my.id/debug | jq .
```

### Step 8: Rebuild & Deploy

```bash
cd /home/debian/project/jeevatix

# Rebuild seller dengan custom domain API
PUBLIC_API_BASE_URL=https://api.jeevatix.my.id pnpm --filter seller run build

# Deploy
SKIP_DURABLE_OBJECT_MIGRATIONS=1 pnpm run deploy --stage staging

# Update test file untuk gunakan custom domain
nano tests/e2e/staging-seller-login.spec.ts
# Ganti URL ke: https://seller.jeevatix.my.id

# Run test
pnpm exec playwright test staging-seller-login.spec.ts --project=staging
```

## Why This Solution is Better

✅ **Safer**: Tidak perlu edit SST config
✅ **Cleaner**: Menghapus dari source (Workers settings) bukan dari DNS
✅ **Proper**: Mengikuti Cloudflare best practices
✅ **Reversible**: Bisa add custom domain lagi kapan saja via Workers settings

## Alternative: Update SST Config (Not Recommended Now)

Jika Anda ingin mencegah SST membuat custom domain lagi di future deployments, edit `sst.config.ts`:

```typescript
// Comment out domain config untuk portal
const seller = new sst.cloudflare.Worker('SellerPortal', {
  handler: 'apps/seller/.svelte-kit/cloudflare/_worker.js',
  assets: {
    directory: 'apps/seller/.svelte-kit',
    // ...
  },
  url: true,  // Force workers.dev URL
  // domain: deployedDomains?.seller,  // Commented out
  transform: {
    worker(args) {
      applyPortalWorkerTransform(args, sellerScriptName);
    },
  },
});
```

Tapi ini **tidak perlu dilakukan sekarang** karena:
1. Workers Routes akan override custom domain dari SST
2. Manual CNAME + Workers Routes lebih flexible
3. Tidak perlu rebuild/redeploy SST config

## Troubleshooting

### Custom Domain Tidak Muncul di Workers Settings
**Possible cause**: Domain sudah dihapus atau tidak pernah di-set via Workers
**Solution**: Langsung ke Step 5 (tambah CNAME manual)

### Tidak Bisa Hapus Custom Domain
**Error**: "Domain is in use"
**Solution**: 
1. Hapus Workers Routes yang menggunakan domain tersebut dulu
2. Lalu hapus custom domain dari Workers settings

### DNS Records Masih Read-Only Setelah Hapus Custom Domain
**Solution**: 
1. Refresh page DNS Records
2. Wait 1-2 minutes
3. Jika masih read-only, contact Cloudflare support

### Workers Routes Tidak Bekerja
**Check**: 
1. DNS records sudah resolve? `host seller.jeevatix.my.id`
2. Workers Routes sudah di-setup? Check di Dashboard
3. Worker name benar? `jeevatix-staging-seller` (bukan `jeevatix-staging-seller-test`)

## Expected Timeline

- Step 1-3 (Remove custom domains): 3 minutes
- Step 4 (Verify): 1 minute
- Step 5 (Add CNAME): 3 minutes
- Step 6 (Workers Routes): 3 minutes
- Step 7 (Verify & Test): 5 minutes
- Step 8 (Rebuild & Deploy): 5 minutes

**Total: ~20 minutes**

## Success Criteria

✅ Custom domains removed from Workers settings
✅ DNS records no longer read-only
✅ CNAME records added successfully
✅ Workers Routes configured
✅ All endpoints accessible via custom domain
✅ Seller login works
✅ E2E test passes
