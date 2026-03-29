---
description: "Use when creating or editing SvelteKit pages (.svelte files) in any portal (buyer, admin, seller). Covers shadcn-svelte components, load functions, API fetch patterns, and TailwindCSS."
applyTo: "apps/**/src/routes/**/*.svelte"
---
# SvelteKit Page Pattern

## Layout

- Semua portal menggunakan SvelteKit + TailwindCSS + shadcn-svelte.
- Buyer: `apps/buyer` (port 4301) — public-facing, SEO penting.
- Admin: `apps/admin` (port 4302) — sidebar layout, data tables.
- Seller: `apps/seller` (port 4303) — sidebar layout, event management.

## Component Usage

Gunakan shadcn-svelte components. Referensi via MCP:
- `shadcn-ui MCP → list_components()` — lihat semua komponen tersedia.
- `shadcn-ui MCP → get_component("component-name")` — dapatkan source code.
- `shadcn-ui MCP → get_component_demo("component-name")` — contoh penggunaan.
- `shadcn-ui MCP → list_blocks(category)` / `get_block(name)` — template siap pakai (dashboard, login, sidebar).

## Data Fetching Pattern

```typescript
// +page.ts (load function)
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch('http://localhost:8787/api/events?page=1&limit=20');
  const { data, meta } = await res.json();
  return { events: data, meta };
};
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import type { PageData } from './$types';

  export let data: PageData;
</script>
```

## Rules

- Ikuti PAGES.md untuk route paths dan komponen per halaman.
- JANGAN tambah halaman yang tidak ada di PAGES.md.
- Gunakan shadcn-svelte dari `$lib/components/ui/` — BUKAN install ulang.
- Semua form validation di client menggunakan schema yang sama dari API (atau subset).
- Protected routes: cek auth di `+page.ts` load function, redirect jika belum login.
