---
description: "Generate a new SvelteKit page with shadcn-svelte components, load function, and proper routing following PAGES.md spec."
agent: "agent"
argument-hint: "Describe the page: portal (buyer/admin/seller), route path, purpose (e.g., admin /events - event list with data table)"
---
Generate a new SvelteKit page for the Jeevatix project following the established patterns.

## Steps

1. **Read context**: Baca `PAGES.md` untuk spek halaman (komponen, data yang ditampilkan, API endpoint yang digunakan).

2. **Determine route path**: Tentukan path di `apps/<portal>/src/routes/` sesuai PAGES.md.

3. **Create load function** (`+page.ts`):
   - Fetch data dari API endpoint yang sesuai.
   - Handle authentication jika halaman protected.
   - Return typed data.

4. **Create page component** (`+page.svelte`):
   - Gunakan shadcn-svelte components.
   - Untuk mengetahui komponen yang tersedia, gunakan **shadcn-ui MCP**:
     - `list_components()` — daftar lengkap.
     - `get_component("nama")` — source code komponen.
     - `get_component_demo("nama")` — contoh penggunaan.
     - `list_blocks(category: "dashboard"|"login"|"sidebar")` / `get_block("nama")` — template siap pakai.
   - Layout: gunakan TailwindCSS utility classes.
   - Data tables: gunakan shadcn `data-table` component.
   - Forms: gunakan shadcn `form`, `input`, `select`, `button` components.

5. **Verify**: Pastikan halaman terintegrasi dengan layout portal dan navigasi sidebar (admin/seller).

## Output Format

Generate `+page.ts` (load function) dan `+page.svelte` (component). Ikuti konvensi dari PAGES.md persis.
