# CRITICAL: Domain jeevatix.my.id Belum Dikonfigurasi

## Problem yang Ditemukan

DNS query untuk `jeevatix.my.id` mengembalikan **NXDOMAIN** (domain tidak ditemukan).

Hasil diagnostic:
```
Status: 3 (NXDOMAIN)
NS Records: None
SOA Record: None
A Record: None
```

Ini berarti **domain belum dikonfigurasi dengan benar**.

## Root Cause

Ada 2 kemungkinan:

### Kemungkinan 1: Domain Belum Terdaftar
Domain `jeevatix.my.id` belum didaftarkan di registrar domain (.my.id).

**Cara cek:**
1. Buka https://mynic.my (registrar untuk domain .my.id)
2. Cek apakah domain sudah terdaftar atas nama Anda
3. Cek expiry date

### Kemungkinan 2: Nameservers Belum Pointing ke Cloudflare
Domain sudah terdaftar, tapi nameservers masih default registrar, belum di-set ke Cloudflare.

**Cara cek:**
1. Login ke registrar domain (tempat Anda beli domain)
2. Cek nameservers yang terpasang
3. Seharusnya pointing ke Cloudflare nameservers

## Solution

### Step 1: Verify Domain Registration

**Cek di Cloudflare Dashboard:**
1. Login ke https://dash.cloudflare.com
2. Cek apakah `jeevatix.my.id` ada di daftar domains
3. Cek status domain:
   - ✅ **Active** = Domain sudah terkonfigurasi
   - ⚠️ **Pending** = Nameservers belum di-update
   - ❌ **Not found** = Domain belum ditambahkan ke Cloudflare

### Step 2: Add Domain ke Cloudflare (Jika Belum Ada)

1. Buka https://dash.cloudflare.com
2. Klik **Add a Site**
3. Masukkan: `jeevatix.my.id`
4. Pilih plan: **Free**
5. Cloudflare akan scan DNS records existing
6. Review dan confirm
7. **PENTING:** Catat Cloudflare nameservers yang diberikan:
   ```
   Example:
   ns1.cloudflare.com
   ns2.cloudflare.com
   ```

### Step 3: Update Nameservers di Registrar

**Untuk domain .my.id (Malaysia):**

1. Login ke registrar tempat Anda beli domain
   - Biasanya: MyNIC, Exabytes, Shinjiru, atau registrar lain
2. Cari menu: **Domain Management** atau **DNS Settings**
3. Pilih domain: `jeevatix.my.id`
4. Update **Nameservers** ke Cloudflare nameservers:
   ```
   Nameserver 1: ns1.cloudflare.com (atau yang diberikan Cloudflare)
   Nameserver 2: ns2.cloudflare.com
   ```
5. Save changes
6. **Wait 24-48 hours** untuk propagation (biasanya 2-4 jam)

### Step 4: Verify Nameservers Update

Setelah update nameservers, tunggu beberapa jam lalu cek:

```bash
# Cek nameservers
host -t NS jeevatix.my.id

# Expected output:
# jeevatix.my.id name server ns1.cloudflare.com.
# jeevatix.my.id name server ns2.cloudflare.com.
```

### Step 5: Setelah Nameservers Active

Setelah nameservers pointing ke Cloudflare dan status domain **Active**:

1. **Tambahkan DNS Records** (ikuti guide sebelumnya)
2. **Setup Workers Routes**
3. **Rebuild & Deploy**
4. **Test login**

## Alternative: Gunakan Domain Lain (Quick Fix)

Jika `jeevatix.my.id` belum ready atau masih dalam proses registrasi, Anda bisa:

### Option A: Gunakan Subdomain dari Domain yang Sudah Ada

Jika Anda punya domain lain yang sudah di Cloudflare (misalnya `example.com`):

```
staging-api.example.com     → jeevatix-staging-api.ariefna95.workers.dev
staging-seller.example.com  → jeevatix-staging-seller.ariefna95.workers.dev
staging-admin.example.com   → jeevatix-staging-admin.ariefna95.workers.dev
staging-buyer.example.com   → jeevatix-staging-buyer.ariefna95.workers.dev
```

### Option B: Gunakan Cloudflare Pages Custom Domain

Cloudflare Pages menyediakan free subdomain:

```
jeevatix-api.pages.dev
jeevatix-seller.pages.dev
```

Tapi ini memerlukan setup berbeda.

### Option C: Temporary - Gunakan Workers.dev dengan Service Binding

Untuk testing sementara, kita bisa setup **Service Binding** di SST agar seller portal bisa call API tanpa HTTP fetch.

**Edit `sst.config.ts`:**

```typescript
const api = new sst.cloudflare.Worker('Api', {
  // ... existing config
});

const seller = new sst.cloudflare.Worker('SellerPortal', {
  handler: 'apps/seller/.svelte-kit/cloudflare/_worker.js',
  assets: {
    directory: 'apps/seller/.svelte-kit',
  },
  url: true,
  link: [api],  // Add this - bind API as service
  transform: {
    worker(args) {
      applyPortalWorkerTransform(args, sellerScriptName);
      
      // Add service binding
      args.serviceBindings = [
        {
          name: 'API',
          service: api.nodes.worker.name,
        },
      ];
    },
  },
});
```

**Update `apps/seller/src/lib/auth.ts`:**

```typescript
export async function login(
  fetchFn: typeof fetch,
  cookies: Cookies,
  email: string,
  password: string,
) {
  // Use service binding if available, fallback to HTTP
  const apiUrl = typeof API !== 'undefined' 
    ? 'http://api-internal/auth/login'  // Service binding
    : `${API_BASE_URL}/auth/login`;      // HTTP fetch
  
  const response = await fetchFn(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  
  // ... rest of code
}
```

Tapi ini **tidak recommended** untuk production.

## Recommended Action

**Prioritas 1: Setup Domain dengan Benar**

1. ✅ Verify domain `jeevatix.my.id` sudah terdaftar
2. ✅ Add domain ke Cloudflare
3. ✅ Update nameservers di registrar
4. ✅ Wait for propagation (2-48 hours)
5. ✅ Lanjutkan dengan DNS setup

**Prioritas 2: Jika Domain Belum Ready**

Gunakan domain lain yang sudah ada atau tunggu domain ready.

## Status Check Commands

Setelah update nameservers, monitor dengan:

```bash
# Check nameservers
host -t NS jeevatix.my.id

# Check if domain resolves
host jeevatix.my.id

# Check Cloudflare status
curl -s "https://dns.google/resolve?name=jeevatix.my.id&type=NS" | jq .
```

## Timeline Estimate

- Domain registration: Instant - 24 hours
- Add to Cloudflare: 5 minutes
- Nameserver update: 5 minutes
- **Nameserver propagation: 2-48 hours** (usually 2-4 hours)
- DNS records setup: 10 minutes
- Workers Routes setup: 5 minutes
- Rebuild & deploy: 5 minutes
- Testing: 5 minutes

**Total: 2-48 hours** (mostly waiting for nameserver propagation)

## Next Steps

1. **Cek status domain di Cloudflare Dashboard**
2. **Jika domain belum ada:** Add domain ke Cloudflare
3. **Update nameservers** di registrar
4. **Wait for propagation**
5. **Lanjutkan dengan DNS setup** setelah nameservers active

Beri tahu saya status domain di Cloudflare Dashboard, dan saya akan guide next steps yang tepat!
