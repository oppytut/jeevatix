<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';

  import { logout } from '$lib/auth';
  import type { LayoutData } from './$types';

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

  let {
    children,
    data,
  }: {
    children: Snippet;
    data: LayoutData;
  } = $props();

  const isLoginRoute = $derived(String(page.url.pathname) === '/login');
  const currentUser = $derived(data.currentUser ?? null);

  async function handleLogout() {
    await logout();
    await goto(resolve('/login'), { replaceState: true });
  }
</script>

<svelte:head>
  <title>Jeevatix Admin</title>
  <meta
    name="description"
    content="Dashboard admin Jeevatix untuk mengelola pengguna, seller, event, pesanan, dan kategori."
  />
  <link rel="icon" href={favicon} />
</svelte:head>

{#if isLoginRoute}
  <div
    class="min-h-screen bg-[linear-gradient(180deg,rgba(255,248,235,0.6),rgba(248,250,252,1))] px-4 py-4 sm:px-6 lg:px-8"
  >
    <div class="mx-auto max-w-7xl">
      {@render children()}
    </div>
  </div>
{:else}
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
              class={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition ${item === 'Dashboard' ? 'border-white/20 bg-white/10 text-white' : 'border-white/5 text-slate-300 hover:border-white/15 hover:bg-white/5 hover:text-white'}`}
            >
              <span>{item}</span>
              <span class="text-xs tracking-[0.3em] text-slate-500 uppercase">Go</span>
            </a>
          {/each}
        </nav>

        <div class="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div>
            <p class="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase">Session</p>
            <p class="mt-2 text-sm font-medium text-white">{currentUser?.full_name}</p>
            <p class="text-sm text-slate-400">{currentUser?.email}</p>
          </div>

          <button
            class="w-full rounded-2xl border border-white/10 px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            onclick={handleLogout}
            type="button"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>

    <main class="min-w-0 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,1))]">
      <div class="mx-auto min-h-screen max-w-7xl px-6 py-8 sm:px-10 lg:px-12">
        {@render children()}
      </div>
    </main>
  </div>
{/if}
