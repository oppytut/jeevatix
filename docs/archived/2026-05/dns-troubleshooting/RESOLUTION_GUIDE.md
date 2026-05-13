# Jeevatix Staging Login Issue - Complete Resolution Guide

## 🔍 Root Cause Analysis

**Problem:** Seller login di staging gagal dengan error 404

**Root Cause:** Cloudflare Workers **tidak bisa melakukan HTTP fetch ke `*.workers.dev` subdomain lain** dalam account yang sama.

**Error Details:**
- HTTP Status: 404
- Cloudflare Error Code: 1042 ("Unable to reach origin server")
- Terjadi saat seller portal (workers.dev) mencoba fetch ke API (workers.dev)

## ✅ Perbaikan yang Sudah Dilakukan

### 1. Enhanced Error Handling (`apps/seller/src/lib/auth.ts`)
- Deteksi non-JSON responses (HTML error pages)
- Logging detail untuk debugging
- Error messages informatif untuk user

### 2. Comprehensive Logging (`apps/seller/src/routes/login/+page.server.ts`)
- Log setiap tahap login flow
- Log errors dengan detail lengkap
- Memudahkan troubleshooting

### 3. Debug Endpoint (`apps/seller/src/routes/debug/+server.ts`)
- Test fetch dari seller portal ke API
- Menampilkan API_BASE_URL yang digunakan
- Membantu diagnose connectivity issues

### 4. SST Config Update (`sst.config.ts`)
- Update assets directory untuk include server output
- Memastikan semua files ter-deploy dengan benar

### 5. Dokumentasi Lengkap
- `DNS_SETUP_STAGING.md` - Technical explanation
- `MANUAL_DNS_SETUP.md` - Step-by-step manual setup
- `CREATE_DNS_TOKEN.md` - API token creation guide

## 🎯 Solusi: Setup Custom Domain

### Mengapa Custom Domain Diperlukan?
Cloudflare Workers limitation: tidak support fetch antar `*.workers.dev` subdomain. Custom domain adalah **mandatory** untuk staging dan production.

### DNS Records yang Diperlukan

| Subdomain | Type  | Target                                        | Proxy |
|-----------|-------|-----------------------------------------------|-------|
| api       | CNAME | jeevatix-staging-api.ariefna95.workers.dev    | ✅ ON |
| seller    | CNAME | jeevatix-staging-seller.ariefna95.workers.dev | ✅ ON |
| admin     | CNAME | jeevatix-staging-admin.ariefna95.workers.dev  | ✅ ON |
| @         | CNAME | jeevatix-staging-buyer.ariefna95.workers.dev  | ✅ ON |

## 📋 Action Items untuk Anda

### Option 1: Manual Setup (Recommended - Paling Cepat)

1. **Buka Cloudflare Dashboard**
   ```
   https://dash.cloudflare.com
   → Login
   → Pilih domain: jeevatix.my.id
   → DNS → Records
   ```

2. **Tambahkan 4 DNS Records**
   - Klik "Add record" untuk setiap record di tabel di atas
   - Pastikan Proxy status ON (orange cloud)
   - Save setiap record

3. **Tunggu DNS Propagate (5-10 menit)**
   ```bash
   # Verifikasi DNS
   host api.jeevatix.my.id
   host seller.jeevatix.my.id
   ```

4. **Rebuild & Deploy**
   ```bash
   cd /home/debian/project/jeevatix
   
   # Rebuild dengan custom domain
   PUBLIC_API_BASE_URL=https://api.jeevatix.my.id pnpm --filter seller run build
   
   # Deploy
   SKIP_DURABLE_OBJECT_MIGRATIONS=1 pnpm run deploy --stage staging
   ```

5. **Test Login**
   ```bash
   # Update test file untuk gunakan custom domain
   # Edit: tests/e2e/staging-seller-login.spec.ts
   # Ganti URL ke: https://seller.jeevatix.my.id
   
   pnpm exec playwright test staging-seller-login.spec.ts --project=staging
   ```

### Option 2: Automated Setup (Jika Punya DNS Token)

1. **Buat API Token dengan DNS Permissions**
   - Follow guide di `CREATE_DNS_TOKEN.md`
   - Permissions required: Zone → DNS → Edit, Zone → Zone → Read
   - Scope: jeevatix.my.id

2. **Run Automated Script**
   ```bash
   export CLOUDFLARE_API_TOKEN="your-new-token-with-dns-permissions"
   export CLOUDFLARE_ZONE_ID="62848e83a5041bbd3913496ad26d7007"
   
   ./scripts/setup-staging-dns.sh
   ```

3. **Continue with steps 3-5 dari Option 1**

## 📚 Reference Documents

| File | Purpose |
|------|---------|
| `DNS_SETUP_STAGING.md` | Technical explanation & requirements |
| `MANUAL_DNS_SETUP.md` | Detailed step-by-step manual setup |
| `CREATE_DNS_TOKEN.md` | How to create Cloudflare API token |
| `scripts/setup-staging-dns.sh` | Automated DNS setup script |
| `scripts/manual-dns-guide.sh` | Quick reference guide (run to display) |

## 🔧 Troubleshooting

### DNS Belum Propagate
```bash
# Wait 5-10 minutes
# Clear DNS cache
sudo systemd-resolve --flush-caches

# Check with online tool
# https://dnschecker.org
```

### SSL Certificate Error
- Cloudflare auto-provision SSL (takes a few minutes)
- Ensure Proxy status is ON (orange cloud)

### Login Masih Gagal Setelah DNS Setup
```bash
# 1. Verify API_BASE_URL in deployed worker
curl https://seller.jeevatix.my.id/debug | jq .

# 2. Should show:
# {
#   "API_BASE_URL": "https://api.jeevatix.my.id",
#   ...
# }

# 3. If still shows workers.dev URL, rebuild:
PUBLIC_API_BASE_URL=https://api.jeevatix.my.id pnpm --filter seller run build
SKIP_DURABLE_OBJECT_MIGRATIONS=1 pnpm run deploy --stage staging
```

### Test API Directly
```bash
# Test API endpoint
curl -X POST https://api.jeevatix.my.id/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seller@jeevatix.id","password":"Seller123!"}' | jq .

# Should return:
# {
#   "success": true,
#   "data": {
#     "access_token": "...",
#     "user": { "role": "seller", ... }
#   }
# }
```

## ✨ Expected Result After DNS Setup

1. ✅ DNS records resolve correctly
2. ✅ API accessible via `https://api.jeevatix.my.id`
3. ✅ Seller portal accessible via `https://seller.jeevatix.my.id`
4. ✅ Seller login works successfully
5. ✅ E2E test passes
6. ✅ User redirected to dashboard after login

## 📞 Need Help?

Jika masih ada masalah setelah setup DNS:

1. Check debug endpoint: `curl https://seller.jeevatix.my.id/debug | jq .`
2. Check Cloudflare Workers logs di Dashboard
3. Verify DNS propagation: `host api.jeevatix.my.id`
4. Test API directly dengan curl command di atas

---

**Status:** Ready for DNS setup
**Next Action:** Setup DNS records di Cloudflare Dashboard (Option 1 recommended)
**ETA:** 15-20 minutes (including DNS propagation)
