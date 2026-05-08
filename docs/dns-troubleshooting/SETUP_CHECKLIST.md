# Checklist: Setup Custom Domain untuk Jeevatix Staging

## ✅ Pre-requisites
- [x] Cloudflare account dengan akses ke domain jeevatix.my.id
- [x] Workers sudah deployed (jeevatix-staging-api, seller, admin, buyer)
- [x] DNS record `api.jeevatix.my.id` sudah ditambahkan (CNAME manual)

## 📋 Step-by-Step Checklist

### Phase 1: Hapus Custom Domain dari Workers (5 menit)

- [ ] Buka https://dash.cloudflare.com
- [ ] Klik **Workers & Pages** di sidebar
- [ ] **Worker: jeevatix-staging-seller**
  - [ ] Klik worker → Settings → Domains & Routes
  - [ ] Hapus domain: `seller.jeevatix.my.id`
  - [ ] Confirm deletion
- [ ] **Worker: jeevatix-staging-admin**
  - [ ] Klik worker → Settings → Domains & Routes
  - [ ] Hapus domain: `admin.jeevatix.my.id`
  - [ ] Confirm deletion
- [ ] **Worker: jeevatix-staging-buyer**
  - [ ] Klik worker → Settings → Domains & Routes
  - [ ] Hapus domain: `jeevatix.my.id`
  - [ ] Confirm deletion
- [ ] Verify: Kembali ke DNS → Records
  - [ ] Records untuk seller, admin, @ sudah hilang
  - [ ] Record `api` tetap ada

### Phase 2: Tambah CNAME Records (3 menit)

- [ ] Buka DNS → Records → Add record
- [ ] **Seller Portal**
  - [ ] Type: CNAME
  - [ ] Name: `seller`
  - [ ] Target: `jeevatix-staging-seller.ariefna95.workers.dev`
  - [ ] Proxy: ✅ ON (Orange Cloud)
  - [ ] Save
- [ ] **Admin Portal**
  - [ ] Type: CNAME
  - [ ] Name: `admin`
  - [ ] Target: `jeevatix-staging-admin.ariefna95.workers.dev`
  - [ ] Proxy: ✅ ON
  - [ ] Save
- [ ] **Buyer Portal**
  - [ ] Type: CNAME
  - [ ] Name: `@`
  - [ ] Target: `jeevatix-staging-buyer.ariefna95.workers.dev`
  - [ ] Proxy: ✅ ON
  - [ ] Save

### Phase 3: Setup Workers Routes (3 menit)

**Option A: Manual**
- [ ] Buka jeevatix.my.id → Workers Routes → Add route
- [ ] Route 1: `api.jeevatix.my.id/*` → `jeevatix-staging-api`
- [ ] Route 2: `seller.jeevatix.my.id/*` → `jeevatix-staging-seller`
- [ ] Route 3: `admin.jeevatix.my.id/*` → `jeevatix-staging-admin`
- [ ] Route 4: `jeevatix.my.id/*` → `jeevatix-staging-buyer`

**Option B: Automated**
- [ ] Run: `./scripts/setup-workers-routes.sh`

### Phase 4: Verify DNS & Endpoints (5 menit)

- [ ] Wait for DNS propagation: `sleep 180`
- [ ] Test DNS resolution:
  ```bash
  host api.jeevatix.my.id
  host seller.jeevatix.my.id
  host admin.jeevatix.my.id
  host jeevatix.my.id
  ```
- [ ] Test API endpoint:
  ```bash
  curl https://api.jeevatix.my.id/health
  ```
  Expected: `{"status":"ok",...}`
- [ ] Test Seller portal:
  ```bash
  curl -I https://seller.jeevatix.my.id/login
  ```
  Expected: `HTTP/2 200`
- [ ] Test debug endpoint:
  ```bash
  curl https://seller.jeevatix.my.id/debug | jq .
  ```
  Expected: `{"API_BASE_URL":"https://api.jeevatix.my.id",...}`

### Phase 5: Rebuild & Deploy (5 menit)

- [ ] Navigate to project:
  ```bash
  cd /home/debian/project/jeevatix
  ```
- [ ] Rebuild seller portal:
  ```bash
  PUBLIC_API_BASE_URL=https://api.jeevatix.my.id pnpm --filter seller run build
  ```
- [ ] Deploy to staging:
  ```bash
  SKIP_DURABLE_OBJECT_MIGRATIONS=1 pnpm run deploy --stage staging
  ```
- [ ] Verify deployment output shows custom domains

### Phase 6: Update & Run E2E Test (3 menit)

- [ ] Update test file: `tests/e2e/staging-seller-login.spec.ts`
  - [ ] Ganti `https://jeevatix-staging-seller.ariefna95.workers.dev`
  - [ ] Menjadi `https://seller.jeevatix.my.id`
  - [ ] Ganti `https://jeevatix-staging-api.ariefna95.workers.dev`
  - [ ] Menjadi `https://api.jeevatix.my.id`
- [ ] Run E2E test:
  ```bash
  pnpm exec playwright test staging-seller-login.spec.ts --project=staging
  ```
- [ ] Verify test results:
  - [ ] Direct API call test: ✅ PASSED
  - [ ] UI login test: ✅ PASSED
  - [ ] User redirected to dashboard

## 🎯 Success Criteria

- [ ] ✅ All DNS records resolve correctly
- [ ] ✅ All Workers Routes configured
- [ ] ✅ API accessible via `https://api.jeevatix.my.id`
- [ ] ✅ Seller portal accessible via `https://seller.jeevatix.my.id`
- [ ] ✅ Debug endpoint shows correct API_BASE_URL
- [ ] ✅ Seller login works successfully
- [ ] ✅ E2E test passes (2/2 tests)
- [ ] ✅ No error 1042 (Cloudflare origin error)
- [ ] ✅ No error 404 from API

## 📊 Progress Tracking

**Estimated Total Time:** ~25 minutes

- Phase 1: ⏱️ 5 min
- Phase 2: ⏱️ 3 min
- Phase 3: ⏱️ 3 min
- Phase 4: ⏱️ 5 min (includes DNS propagation wait)
- Phase 5: ⏱️ 5 min
- Phase 6: ⏱️ 3 min

## 🆘 Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| DNS not resolving | Wait 5-10 minutes, clear DNS cache |
| 404 on custom domain | Check Workers Routes configured |
| Login still fails | Verify API_BASE_URL in debug endpoint |
| SSL error | Wait for Cloudflare SSL provisioning (2-5 min) |
| Workers Routes not found | Verify worker names are correct |

## 📚 Documentation Reference

- **REMOVE_WORKERS_CUSTOM_DOMAIN.md** - Detailed guide
- **scripts/setup-workers-routes.sh** - Automated Workers Routes setup
- **RESOLUTION_GUIDE.md** - Complete resolution summary
- **DNS_SETUP_STAGING.md** - Technical explanation

## 🎉 After Completion

Setelah semua checklist selesai:

1. ✅ Seller login di staging akan bekerja dengan sempurna
2. ✅ Tidak ada lagi error 1042 (workers.dev limitation)
3. ✅ Custom domain fully functional
4. ✅ E2E test passes
5. ✅ Ready for production setup (gunakan pattern yang sama)

---

**Start Time:** ___________
**End Time:** ___________
**Total Duration:** ___________
**Status:** [ ] In Progress  [ ] Completed  [ ] Blocked

**Notes:**
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________
