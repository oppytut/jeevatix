<script lang="ts">
  import { resolve } from '$app/paths';
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';

  const menuItems = [
    'Dashboard',
    'Users',
    'Sellers',
    'Events',
    'Orders',
    'Payments',
    'Categories',
    'Notifications',
    'Reservations',
  ] as const;

  let { children } = $props();
</script>

<svelte:head>
  <title>Jeevatix Admin</title>
  <meta
    name="description"
    content="Dashboard admin Jeevatix untuk mengelola pengguna, seller, event, pesanan, dan kategori."
  />
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="bg-background text-foreground min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
  <aside
    class="border-border border-b bg-slate-950 text-slate-50 lg:min-h-screen lg:border-r lg:border-b-0"
  >
    <div class="flex h-full flex-col px-6 py-8">
      <div class="space-y-2 border-b border-white/10 pb-6">
        <p class="text-xs font-semibold tracking-[0.35em] text-slate-400 uppercase">Jeevatix</p>
        <h1 class="text-2xl font-semibold tracking-tight">Admin Console</h1>
        <p class="text-sm leading-6 text-slate-400">
          Kontrol pusat untuk operasional event, transaksi, dan verifikasi seller.
        </p>
      </div>

      <nav class="mt-6 flex-1 space-y-2">
        {#each menuItems as item (item)}
          <a
            href={resolve('/')}
            class="flex items-center justify-between rounded-2xl border border-white/5 px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-white/15 hover:bg-white/5 hover:text-white"
          >
            <span>{item}</span>
            <span class="text-xs tracking-[0.3em] text-slate-500 uppercase">Go</span>
          </a>
        {/each}
      </nav>

      <div class="rounded-3xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase">Phase 0</p>
        <p class="mt-2 text-sm leading-6 text-slate-300">
          Portal admin siap untuk fase CRUD, dashboard, dan workflow verifikasi.
        </p>
      </div>
    </div>
  </aside>

  <main class="min-w-0 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,1))]">
    <div class="mx-auto min-h-screen max-w-7xl px-6 py-8 sm:px-10 lg:px-12">
      {@render children()}
    </div>
  </main>
</div>
