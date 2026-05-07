#!/bin/bash
# Quick manual DNS setup guide - print to terminal

cat << 'EOF'
╔══════════════════════════════════════════════════════════════════════════════╗
║                    MANUAL DNS SETUP - QUICK GUIDE                            ║
╔══════════════════════════════════════════════════════════════════════════════╗

API Token tidak memiliki DNS permissions. Setup DNS secara manual lebih cepat:

┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Buka Cloudflare Dashboard                                           │
└──────────────────────────────────────────────────────────────────────────────┘

1. Buka: https://dash.cloudflare.com
2. Login dengan credentials Anda
3. Pilih domain: jeevatix.my.id
4. Klik tab: DNS → Records

┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Tambahkan 4 DNS Records                                             │
└──────────────────────────────────────────────────────────────────────────────┘

Klik "Add record" untuk setiap record berikut:

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ RECORD 1: API Staging                                                      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
Type:    CNAME
Name:    api
Target:  jeevatix-staging-api.ariefna95.workers.dev
Proxy:   ✅ Proxied (Orange Cloud ON)
TTL:     Auto

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ RECORD 2: Seller Portal Staging                                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
Type:    CNAME
Name:    seller
Target:  jeevatix-staging-seller.ariefna95.workers.dev
Proxy:   ✅ Proxied (Orange Cloud ON)
TTL:     Auto

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ RECORD 3: Admin Portal Staging                                            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
Type:    CNAME
Name:    admin
Target:  jeevatix-staging-admin.ariefna95.workers.dev
Proxy:   ✅ Proxied (Orange Cloud ON)
TTL:     Auto

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ RECORD 4: Buyer Portal Staging (Root Domain)                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
Type:    CNAME
Name:    @ (atau kosongkan)
Target:  jeevatix-staging-buyer.ariefna95.workers.dev
Proxy:   ✅ Proxied (Orange Cloud ON)
TTL:     Auto

⚠️  PENTING: Jika sudah ada A record untuk @, hapus dulu sebelum tambah CNAME

┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Verifikasi DNS (tunggu 5-10 menit)                                 │
└──────────────────────────────────────────────────────────────────────────────┘

Setelah menambahkan records, tunggu beberapa menit lalu test:

EOF

echo "host api.jeevatix.my.id"
echo "host seller.jeevatix.my.id"
echo "host admin.jeevatix.my.id"
echo "host jeevatix.my.id"
echo ""

cat << 'EOF'
┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Rebuild & Deploy                                                    │
└──────────────────────────────────────────────────────────────────────────────┘

Setelah DNS propagate, jalankan:

EOF

echo "cd /home/debian/project/jeevatix"
echo ""
echo "# Rebuild seller dengan API custom domain"
echo "PUBLIC_API_BASE_URL=https://api.jeevatix.my.id pnpm --filter seller run build"
echo ""
echo "# Deploy ke staging"
echo "SKIP_DURABLE_OBJECT_MIGRATIONS=1 pnpm run deploy --stage staging"
echo ""
echo "# Test login"
echo "pnpm exec playwright test staging-seller-login.spec.ts --project=staging"
echo ""

cat << 'EOF'
┌──────────────────────────────────────────────────────────────────────────────┐
│ TROUBLESHOOTING                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

DNS belum propagate?
→ Tunggu 5-10 menit lagi
→ Clear DNS cache: sudo systemd-resolve --flush-caches

SSL error?
→ Cloudflare otomatis provision SSL, tunggu beberapa menit
→ Pastikan Proxy status ON (orange cloud)

Login masih gagal?
→ Pastikan rebuild dengan PUBLIC_API_BASE_URL=https://api.jeevatix.my.id
→ Cek debug endpoint: curl https://seller.jeevatix.my.id/debug | jq .

╚══════════════════════════════════════════════════════════════════════════════╝

Untuk detail lengkap, lihat: MANUAL_DNS_SETUP.md
Untuk membuat DNS token: CREATE_DNS_TOKEN.md

EOF
