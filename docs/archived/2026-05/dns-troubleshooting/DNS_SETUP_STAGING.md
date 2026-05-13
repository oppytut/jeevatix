# DNS Setup Requirements untuk Jeevatix Staging

## Masalah yang Ditemukan

Cloudflare Workers **tidak bisa melakukan HTTP fetch ke workers.dev subdomain lain** dalam account yang sama. Error yang muncul:
- Status: 404
- Error code: 1042 ("Cloudflare was unable to reach your origin server")

Ini menyebabkan seller portal tidak bisa memanggil API karena keduanya menggunakan `*.workers.dev` URL.

## Solusi

Gunakan **custom domain** untuk API dan portal, bukan workers.dev URL.

## DNS Records yang Diperlukan

Untuk domain `jeevatix.my.id`, tambahkan DNS records berikut:

### 1. API (Staging)
```
Type: CNAME
Name: api
Target: jeevatix-staging-api.ariefna95.workers.dev
Proxy: Enabled (Orange Cloud)
```

### 2. Buyer Portal (Staging)
```
Type: CNAME
Name: @
Target: jeevatix-staging-buyer.ariefna95.workers.dev
Proxy: Enabled (Orange Cloud)
```

### 3. Admin Portal (Staging)
```
Type: CNAME
Name: admin
Target: jeevatix-staging-admin.ariefna95.workers.dev
Proxy: Enabled (Orange Cloud)
```

### 4. Seller Portal (Staging)
```
Type: CNAME
Name: seller
Target: jeevatix-staging-seller.ariefna95.workers.dev
Proxy: Enabled (Orange Cloud)
```

## Verifikasi DNS

Setelah menambahkan records, verifikasi dengan:

```bash
# Check API
host api.jeevatix.my.id

# Check Seller Portal
host seller.jeevatix.my.id

# Test API endpoint
curl https://api.jeevatix.my.id/health

# Test Seller Portal
curl https://seller.jeevatix.my.id/login
```

## Rebuild & Redeploy

Setelah DNS propagate, rebuild dengan custom domain URL:

```bash
# Rebuild seller portal dengan API custom domain
PUBLIC_API_BASE_URL=https://api.jeevatix.my.id pnpm --filter seller run build

# Deploy ke staging
SKIP_DURABLE_OBJECT_MIGRATIONS=1 pnpm run deploy --stage staging
```

## Environment Variables untuk Staging

Update `.env` atau CI/CD secrets:

```bash
# Staging domains (sudah dikonfigurasi di sst.config.ts)
STAGING_API_DOMAIN=api.jeevatix.my.id
STAGING_BUYER_DOMAIN=jeevatix.my.id
STAGING_ADMIN_DOMAIN=admin.jeevatix.my.id
STAGING_SELLER_DOMAIN=seller.jeevatix.my.id

# Public API URL untuk build
PUBLIC_API_BASE_URL=https://api.jeevatix.my.id
```

## Catatan Penting

1. **Workers.dev limitation**: Cloudflare Workers tidak support fetch antar workers.dev subdomain
2. **Custom domain required**: Untuk staging dan production, custom domain adalah **mandatory**
3. **DNS propagation**: Tunggu 5-10 menit setelah menambahkan DNS records
4. **SSL/TLS**: Cloudflare otomatis menyediakan SSL certificate untuk custom domain

## Alternatif Sementara (Tidak Direkomendasikan)

Jika DNS belum bisa di-setup, gunakan **Service Binding** di SST config:

```typescript
// Di sst.config.ts
const seller = new sst.cloudflare.Worker('SellerPortal', {
  // ...
  link: [api], // Bind API worker sebagai service
});
```

Lalu update `auth.ts` untuk menggunakan service binding alih-alih HTTP fetch. Namun ini memerlukan refactoring signifikan dan tidak direkomendasikan untuk production.
