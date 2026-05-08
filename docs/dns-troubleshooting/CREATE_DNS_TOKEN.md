# Cara Membuat Cloudflare API Token untuk DNS Management

## Problem
Token yang ada (`CLOUDFLARE_API_TOKEN`) tidak memiliki permissions untuk DNS management, sehingga script setup DNS gagal dengan "Authentication error".

## Solution: Buat Token Baru dengan DNS Permissions

### Step 1: Buka Cloudflare API Tokens Page
1. Login ke https://dash.cloudflare.com
2. Klik profile icon di kanan atas
3. Pilih **My Profile**
4. Klik tab **API Tokens** di sidebar kiri
5. Atau langsung ke: https://dash.cloudflare.com/profile/api-tokens

### Step 2: Create Custom Token
1. Klik tombol **Create Token**
2. **JANGAN** pilih template yang ada
3. Scroll ke bawah dan klik **Create Custom Token**

### Step 3: Configure Token Permissions

**Token name:**
```
Jeevatix DNS Management
```

**Permissions:**
Tambahkan permissions berikut:

| Resource | Permission |
|----------|------------|
| Zone | DNS | Edit |
| Zone | Zone | Read |

**Cara menambahkan:**
1. Klik **+ Add more** di section Permissions
2. Pilih **Zone** dari dropdown pertama
3. Pilih **DNS** dari dropdown kedua
4. Pilih **Edit** dari dropdown ketiga
5. Klik **+ Add more** lagi
6. Pilih **Zone** → **Zone** → **Read**

**Zone Resources:**
```
Include | Specific zone | jeevatix.my.id
```

**Cara setting:**
1. Di section "Zone Resources"
2. Pilih **Include**
3. Pilih **Specific zone**
4. Pilih **jeevatix.my.id** dari dropdown

**IP Address Filtering:** (Optional)
- Leave as "All IP addresses" untuk development
- Atau restrict ke IP server jika untuk production

**TTL:** (Optional)
- Leave as default atau set expiration date

### Step 4: Create & Copy Token
1. Klik **Continue to summary**
2. Review permissions
3. Klik **Create Token**
4. **IMPORTANT:** Copy token sekarang! Token hanya ditampilkan sekali
5. Simpan token di tempat aman (password manager)

### Step 5: Test Token

```bash
# Export token baru
export CLOUDFLARE_API_TOKEN="your-new-token-here"

# Test token
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq .

# Expected output:
# {
#   "success": true,
#   "result": {
#     "id": "...",
#     "status": "active"
#   }
# }
```

### Step 6: Update Environment & Run Script

```bash
# Update .env file
echo "CLOUDFLARE_DNS_TOKEN=$CLOUDFLARE_API_TOKEN" >> .env

# Atau export langsung
export CLOUDFLARE_API_TOKEN="your-new-token-here"
export CLOUDFLARE_ZONE_ID="62848e83a5041bbd3913496ad26d7007"

# Run DNS setup script
./scripts/setup-staging-dns.sh
```

## Alternative: Use Existing Token with More Permissions

Jika Anda sudah punya token dengan permissions lebih luas (misalnya "Edit Cloudflare Workers"), Anda bisa:

1. Buka https://dash.cloudflare.com/profile/api-tokens
2. Find token yang ada
3. Klik **Edit**
4. Tambahkan permissions: Zone → DNS → Edit
5. Save changes
6. Token yang sama akan memiliki permissions tambahan

## Troubleshooting

### "Authentication error" masih muncul
- Pastikan token sudah di-copy dengan benar (no extra spaces)
- Pastikan Zone ID benar: `62848e83a5041bbd3913496ad26d7007`
- Test token dengan curl command di atas

### "Zone not found"
- Pastikan domain `jeevatix.my.id` ada di account Cloudflare Anda
- Pastikan Zone ID benar (cek di Cloudflare Dashboard → jeevatix.my.id → Overview → Zone ID)

### "Insufficient permissions"
- Token harus memiliki **DNS Edit** permission
- Token harus memiliki **Zone Read** permission
- Token harus di-scope ke zone `jeevatix.my.id`

## Security Best Practices

1. **Jangan commit token ke git**
   - Token sudah ada di `.gitignore`
   - Gunakan environment variables

2. **Rotate token secara berkala**
   - Set expiration date saat create token
   - Rotate setiap 90 hari

3. **Minimal permissions**
   - Hanya berikan permissions yang diperlukan
   - Scope ke specific zone, bukan "All zones"

4. **Separate tokens untuk different purposes**
   - Token untuk DNS management (ini)
   - Token untuk Workers deployment (yang sudah ada)
   - Token untuk CI/CD (jika berbeda)

## Next Steps After Token Created

1. Run DNS setup script: `./scripts/setup-staging-dns.sh`
2. Wait for DNS propagation (5-10 minutes)
3. Verify DNS: `host api.jeevatix.my.id`
4. Rebuild seller: `PUBLIC_API_BASE_URL=https://api.jeevatix.my.id pnpm --filter seller run build`
5. Deploy: `SKIP_DURABLE_OBJECT_MIGRATIONS=1 pnpm run deploy --stage staging`
6. Test login: `pnpm exec playwright test staging-seller-login.spec.ts --project=staging`
