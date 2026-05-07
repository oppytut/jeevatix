# Staging Dummy Data Seeding

**Date:** 2026-05-03  
**Purpose:** Populate staging database dengan data dummy yang realistis untuk testing dan demo

## ✅ Data yang Di-seed

### 📊 Summary
- **Categories:** 8 (Musik, Olahraga, Workshop, Konser, Festival, Seminar, Pameran, Teater)
- **Events:** 8 event realistis di berbagai kota
- **Users:** 2 (Admin & Seller)
- **Seller Profile:** 1 (EventPro Indonesia)

### 🎫 Events Created

1. **Jakarta Night Festival 2026** ⭐ Featured
   - Kategori: Musik, Festival, Konser
   - Venue: Istora Senayan, Jakarta
   - Tanggal: 20 Juni 2026
   - Tiers: Early Bird (Rp 175K), Regular (Rp 275K), VIP Lounge (Rp 650K)

2. **Bandung Jazz Festival 2026** ⭐ Featured
   - Kategori: Musik, Konser
   - Venue: Sabuga ITB, Bandung
   - Tanggal: 15 Juli 2026
   - Tiers: Festival Pass (Rp 250K), Premium Seat (Rp 450K)

3. **Surabaya Marathon 2026**
   - Kategori: Olahraga
   - Venue: Taman Bungkul, Surabaya
   - Tanggal: 2 Agustus 2026
   - Tiers: 5K (Rp 150K), 10K (Rp 200K), Half Marathon (Rp 300K), Full Marathon (Rp 400K)

4. **Digital Marketing Workshop 2026**
   - Kategori: Workshop, Seminar
   - Venue: The Kasablanka Hall, Jakarta
   - Tanggal: 10-11 Juni 2026
   - Tiers: General Pass (Rp 450K), Pro Pass (Rp 750K)

5. **Yogyakarta Art Exhibition 2026**
   - Kategori: Pameran
   - Venue: Jogja National Museum, Yogyakarta
   - Tanggal: 1-31 Juli 2026
   - Tiers: Single Entry (Rp 50K), Monthly Pass (Rp 150K)

6. **Bali Electronic Music Festival 2026** ⭐ Featured
   - Kategori: Musik, Festival
   - Venue: Potato Head Beach Club, Bali
   - Tanggal: 15-16 Agustus 2026
   - Tiers: Beach Access (Rp 500K), VIP Cabana (Rp 3.5M)

7. **Stand Up Comedy Night Jakarta**
   - Kategori: Teater
   - Venue: Balai Sarbini, Jakarta
   - Tanggal: 25 Juni 2026
   - Tiers: Regular Seat (Rp 200K), Premium Seat (Rp 350K)

8. **Tech Startup Summit 2026**
   - Kategori: Seminar, Workshop
   - Venue: JCC Senayan, Jakarta
   - Tanggal: 10-11 September 2026
   - Tiers: Startup Pass (Rp 500K), Investor Pass (Rp 1.5M)

### 👥 User Accounts

**Admin:**
- Email: `admin@jeevatix.id`
- Password: `Admin123!`
- Role: Admin
- Status: Active, Email Verified

**Seller:**
- Email: `seller@jeevatix.id`
- Password: `Seller123!`
- Role: Seller
- Organization: EventPro Indonesia
- Status: Active, Verified

## 🚀 How to Run

### Seed Staging Database

```bash
# Load staging environment
set -a && source .env.staging && set +a

# Run seed script
pnpm run seed:staging
```

### Re-seed (Idempotent)

Script is idempotent - running multiple times won't create duplicates. It will:
- Skip existing users
- Skip existing categories
- Skip existing events (by slug)
- Add missing data only

## 📁 Files

- **Seed Script:** `packages/core/src/db/seed-staging.ts`
- **Package Script:** `pnpm run seed:staging` (added to root package.json)

## ✅ Verification

### API Endpoints

```bash
# Check categories
curl https://jeevatix-staging-api.ariefna95.workers.dev/categories

# Check featured events
curl https://jeevatix-staging-api.ariefna95.workers.dev/events/featured

# Check all events
curl https://jeevatix-staging-api.ariefna95.workers.dev/events?limit=10

# Check specific event
curl https://jeevatix-staging-api.ariefna95.workers.dev/events/jakarta-night-festival-2026
```

### Expected Results

**Categories:** 8 categories dengan event_count yang sesuai
```json
{
  "success": true,
  "data": [
    {"name": "Festival", "event_count": 2},
    {"name": "Konser", "event_count": 2},
    {"name": "Musik", "event_count": 3},
    ...
  ]
}
```

**Featured Events:** 3 featured events
```json
{
  "success": true,
  "data": [
    {"title": "Jakarta Night Festival 2026", "venue_city": "Jakarta"},
    {"title": "Bandung Jazz Festival 2026", "venue_city": "Bandung"},
    {"title": "Bali Electronic Music Festival 2026", "venue_city": "Bali"}
  ]
}
```

**All Events:** 12 total (8 seed + 3 old + 1 existing)

## 🎨 Design Considerations

### Realistic Data
- ✅ Berbagai kategori event (musik, olahraga, workshop, pameran, dll)
- ✅ Berbagai kota (Jakarta, Bandung, Surabaya, Yogyakarta, Bali)
- ✅ Range harga realistis (Rp 50K - Rp 3.5M)
- ✅ Tanggal future (Juni - September 2026)
- ✅ Venue names yang real
- ✅ Deskripsi yang informatif
- ✅ Multiple ticket tiers per event

### Diversity
- 3 Featured events (spread across cities)
- 5 Non-featured events
- 8 Categories (all populated)
- Price range: budget-friendly to premium
- Event types: festival, workshop, sports, exhibition, comedy, summit

### Images
- Menggunakan Unsplash URLs untuk banner dan gallery images
- High quality, relevant images untuk setiap event type

## 📝 Notes

### Buyer Portal Homepage Issue
- Homepage masih menampilkan empty state (0 events) karena SSR fetch issue
- **Data sudah ada** di database dan **API berfungsi dengan baik**
- Issue adalah di SvelteKit SSR fetch di Cloudflare Workers environment
- Workaround: Homepage sudah memiliki error handling yang graceful

### Testing Recommendations

1. **Test via API directly** - Semua endpoints berfungsi sempurna
2. **Test via Admin Portal** - Login sebagai admin untuk manage events
3. **Test via Seller Portal** - Login sebagai seller untuk create/edit events
4. **Test via Buyer Portal** - Login/register flow berfungsi, tapi homepage data kosong karena SSR issue

### Future Improvements

1. **Add more events** - Bisa tambah lebih banyak events dengan variasi
2. **Add buyer users** - Seed beberapa buyer accounts untuk testing
3. **Add orders/tickets** - Seed sample transactions untuk testing order flow
4. **Add reviews** - Jika ada fitur review, seed sample reviews
5. **Fix SSR fetch** - Investigate dan fix SvelteKit SSR fetch issue di Workers

## 🔄 Cleanup

Jika perlu cleanup data dummy:

```bash
# Connect to staging database
psql $DATABASE_URL

# Delete events (cascade will delete related data)
DELETE FROM events WHERE seller_profile_id IN (
  SELECT id FROM seller_profiles WHERE org_name = 'EventPro Indonesia'
);

# Or truncate all (CAREFUL!)
TRUNCATE TABLE events CASCADE;
TRUNCATE TABLE categories CASCADE;
```

## ✨ Benefits

1. **Realistic Testing** - Data yang mirip production untuk testing yang lebih akurat
2. **Demo Ready** - Staging siap untuk demo ke stakeholder
3. **Development** - Frontend developer bisa test dengan data yang beragam
4. **Load Testing** - Baseline data untuk performance testing
5. **Visual Verification** - Bisa lihat bagaimana UI menangani berbagai jenis data

## 🎯 Conclusion

Staging database sekarang memiliki **data dummy yang realistis dan beragam** untuk testing dan demo. API berfungsi dengan baik dan mengembalikan data yang sesuai. Buyer portal homepage memiliki SSR issue yang terpisah, tapi data sudah tersedia dan bisa diakses via API.
