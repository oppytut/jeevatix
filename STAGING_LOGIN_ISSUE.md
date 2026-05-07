# Staging Login Issue - Cloudflare Workers SSR Limitation

**Date:** 2026-05-03  
**Status:** Investigating  
**Affected:** Seller Portal, Admin Portal, Buyer Portal (SSR pages)

## Problem

Login gagal di seller/admin portal dengan error "Login gagal. Silakan coba lagi." meskipun credentials benar.

## Root Cause

**SvelteKit SSR fetch di Cloudflare Workers environment tidak dapat melakukan external HTTP calls** ke API worker lain, bahkan dalam subdomain yang sama (workers.dev).

### Evidence

1. ✅ API `/auth/login` berfungsi dengan baik ketika diakses langsung via curl
2. ✅ Credentials benar (seller@jeevatix.id / Seller123!)
3. ✅ CORS dikonfigurasi dengan benar
4. ❌ SSR server action gagal melakukan fetch ke API

### Technical Details

```typescript
// apps/seller/src/routes/login/+page.server.ts
export const actions = {
  default: async ({ request, fetch, cookies }) => {
    // SvelteKit's fetch di Workers SSR environment
    // tidak bisa call external URL
    await login(fetch, cookies, email, password);
  }
}
```

## Attempted Solutions

### 1. ✅ Use globalThis.fetch
```typescript
await login(globalThis.fetch, cookies, email, password);
```
**Status:** Deployed, testing in progress

### 2. ⏳ Use native fetch in Workers environment
```typescript
const fetchFn = typeof globalThis !== 'undefined' ? globalThis.fetch : fetch;
await login(fetchFn, cookies, email, password);
```
**Status:** Deployed, testing in progress

## Workarounds

### Option A: Direct API Testing (Temporary)

Test API functionality directly:

```bash
# Test login
curl -X POST https://jeevatix-staging-api.ariefna95.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seller@jeevatix.id","password":"Seller123!"}'

# Response should include access_token and user data
```

### Option B: Use Postman/Insomnia

1. Import API endpoints from `/doc` (OpenAPI spec)
2. Test all endpoints directly
3. Use tokens manually for authenticated requests

### Option C: Local Development

```bash
# Run locally where SSR fetch works
pnpm run dev

# Access seller portal at http://localhost:4303
# Login will work in local environment
```

## Permanent Solutions

### Solution 1: API Proxy Route (Recommended)

Create internal API proxy in each portal:

```typescript
// apps/seller/src/routes/api/[...path]/+server.ts
export async function POST({ params, request }) {
  const response = await fetch(
    `${API_BASE_URL}/${params.path}`,
    {
      method: 'POST',
      headers: request.headers,
      body: await request.text()
    }
  );
  return response;
}
```

Then login calls `/api/auth/login` instead of external API.

### Solution 2: Client-Side Login

Convert login to client-side only (no SSR):

```typescript
// +page.ts (not +page.server.ts)
export const ssr = false;
```

Use browser fetch API for login.

### Solution 3: Service Bindings

Use Cloudflare Workers Service Bindings to call API worker directly without HTTP:

```toml
# wrangler.toml
[[services]]
binding = "API"
service = "jeevatix-staging-api"
```

```typescript
// In worker code
const response = await env.API.fetch(request);
```

## Current Status

**Latest Deploy:** 2026-05-03 10:50 UTC  
**Changes:** Using `globalThis.fetch` instead of SvelteKit's `fetch`  
**Testing:** Awaiting user confirmation

## Testing Instructions

1. Open: https://jeevatix-staging-seller.ariefna95.workers.dev/login
2. Enter:
   - Email: `seller@jeevatix.id`
   - Password: `Seller123!`
3. Click "Login"
4. Expected: Redirect to dashboard
5. If still fails: Report error message

## Alternative Access

While login is being fixed, you can:

1. **Test API directly** via curl/Postman
2. **Use local development** environment
3. **Wait for permanent solution** implementation

## Next Steps

1. ⏳ Confirm if `globalThis.fetch` fix works
2. If not → Implement API proxy route (Solution 1)
3. Update admin and buyer portals with same fix
4. Document final solution in README

## Related Files

- `apps/seller/src/routes/login/+page.server.ts`
- `apps/admin/src/routes/login/+page.server.ts`
- `apps/buyer/src/routes/+page.server.ts` (homepage SSR)
- `apps/*/src/lib/auth.ts`

## References

- [Cloudflare Workers Fetch API](https://developers.cloudflare.com/workers/runtime-apis/fetch/)
- [SvelteKit Server-Side Fetch](https://kit.svelte.dev/docs/load#making-fetch-requests)
- [Workers Service Bindings](https://developers.cloudflare.com/workers/configuration/bindings/about-service-bindings/)
