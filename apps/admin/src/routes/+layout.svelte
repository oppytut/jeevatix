<script lang="ts">
  import { browser } from '$app/environment';
  import { resolve } from '$app/paths';
  import { navigating } from '$app/stores';
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';

  import { logout } from '$lib/auth';
  import { apiGetEnvelope } from '$lib/api';
  import type { LayoutData } from './$types';
  import { DarkModeToggle } from '@jeevatix/ui';
  import { Menu, X } from '@lucide/svelte';

  let unreadCount = $state(0);
  let mobileNavOpen = $state(false);

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/',
      match: (pathname: string, routeId: string | null) => routeId === '/',
    },
    { label: 'Users', href: '/users', match: (pathname: string) => pathname.startsWith('/users') },
    {
      label: 'Sellers',
      href: '/sellers',
      match: (pathname: string) => pathname.startsWith('/sellers'),
    },
    {
      label: 'Events',
      href: '/events',
      match: (pathname: string) => pathname.startsWith('/events'),
    },
    {
      label: 'Orders',
      href: '/orders',
      match: (pathname: string) => pathname.startsWith('/orders'),
    },
    {
      label: 'Payments',
      href: '/payments',
      match: (pathname: string) => pathname.startsWith('/payments'),
    },
    {
      label: 'Categories',
      href: '/categories',
      match: (pathname: string) => pathname.startsWith('/categories'),
    },
    {
      label: 'Notifications',
      href: '/notifications',
      match: (pathname: string) => pathname.startsWith('/notifications'),
    },
    {
      label: 'Reservations',
      href: '/reservations',
      match: (pathname: string) => pathname.startsWith('/reservations'),
    },
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

  function isActive(item: (typeof menuItems)[number]) {
    return item.match(String(page.url.pathname), page.route.id ?? null);
  }

  async function handleLogout() {
    await logout();
    window.location.replace('/login');
  }

  async function fetchUnreadCount() {
    if (!browser || !currentUser) return;
    try {
      const result = await apiGetEnvelope<{ notifications: unknown[]; unread_count: number }>(
        '/notifications?limit=1',
      );
      unreadCount = result.data.unread_count;
    } catch {
      // Non-critical
    }
  }

  $effect(() => {
    fetchUnreadCount();
  });
</script>

<svelte:head>
  <title>Jeevatix Admin</title>
  <meta
    name="description"
    content="Dashboard admin Jeevatix untuk mengelola pengguna, seller, event, pesanan, dan kategori."
  />
  <link rel="icon" href={favicon} />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#f97316" />
  <meta property="og:site_name" content="Jeevatix" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Jeevatix Admin — Platform Management" />
  <meta
    property="og:description"
    content="Dashboard admin Jeevatix untuk mengelola pengguna, seller, event, pesanan, dan kategori."
  />
  <meta property="og:image" content="https://jeevatix.my.id/og-default.png" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

{#if isLoginRoute}
  <div class="min-h-screen bg-[var(--gradient-page)] px-4 py-4 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-7xl">
      {@render children()}
    </div>
  </div>
{:else}
  <div class="bg-background text-foreground min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
    <aside
      class="border-border border-b bg-slate-950 text-slate-50 lg:min-h-screen lg:border-r lg:border-b-0"
    >
      <!-- Mobile header bar -->
      <div class="flex items-center justify-between px-6 py-4 lg:hidden">
        <div>
          <p class="text-muted-foreground/70 text-xs font-semibold tracking-[0.35em] uppercase">
            Jeevatix
          </p>
          <p class="text-lg font-semibold text-slate-50">Admin Console</p>
        </div>
        <button
          class="inline-flex size-10 items-center justify-center rounded-full border border-white/10 text-slate-50 transition hover:bg-white/10"
          onclick={() => (mobileNavOpen = !mobileNavOpen)}
          aria-label={mobileNavOpen ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={mobileNavOpen}
          type="button"
        >
          {#if mobileNavOpen}
            <X class="size-5" />
          {:else}
            <Menu class="size-5" />
          {/if}
        </button>
      </div>

      <!-- Desktop sidebar content -->
      <div class="hidden h-full flex-col px-6 py-8 lg:flex">
        <div class="space-y-2 border-b border-white/10 pb-6">
          <p class="text-muted-foreground/70 text-xs font-semibold tracking-[0.35em] uppercase">
            Jeevatix
          </p>
          <h1 class="text-2xl font-semibold tracking-tight">Admin Console</h1>
          <p class="text-muted-foreground/70 text-sm leading-6">
            Kontrol pusat untuk operasional event, transaksi, dan verifikasi seller.
          </p>
        </div>

        <nav class="mt-6 flex-1 space-y-2">
          {#each menuItems as item (item.label)}
            <a
              href={resolve(item.href)}
              class={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition ${isActive(item) ? 'border-white/20 bg-white/10 text-white' : 'border-white/5 text-slate-300 hover:border-white/15 hover:bg-white/5 hover:text-white'}`}
            >
              <span>{item.label}</span>
              {#if item.label === 'Notifications' && unreadCount > 0}
                <span
                  class="inline-flex min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] leading-none font-bold text-white"
                  >{unreadCount > 99 ? '99+' : unreadCount}</span
                >
              {:else}
                <span class="text-muted-foreground text-xs tracking-[0.3em] uppercase">Go</span>
              {/if}
            </a>
          {/each}
        </nav>

        <div class="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div>
            <p class="text-muted-foreground/70 text-xs font-semibold tracking-[0.3em] uppercase">
              Session
            </p>
            <p class="mt-2 text-sm font-medium text-white">{currentUser?.full_name}</p>
            <p class="text-muted-foreground/70 text-sm">{currentUser?.email}</p>
          </div>

          <div class="flex items-center gap-2">
            <DarkModeToggle />
            <button
              class="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              onclick={handleLogout}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile nav (when open) -->
      {#if mobileNavOpen}
        <div class="border-t border-white/10 px-6 py-6 lg:hidden">
          <nav class="space-y-2">
            {#each menuItems as item (item.label)}
              <a
                href={resolve(item.href)}
                class={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition ${isActive(item) ? 'border-white/20 bg-white/10 text-white' : 'border-white/5 text-slate-300 hover:border-white/15 hover:bg-white/5 hover:text-white'}`}
                onclick={() => (mobileNavOpen = false)}
              >
                <span>{item.label}</span>
                {#if item.label === 'Notifications' && unreadCount > 0}
                  <span
                    class="inline-flex min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] leading-none font-bold text-white"
                    >{unreadCount > 99 ? '99+' : unreadCount}</span
                  >
                {:else}
                  <span class="text-muted-foreground text-xs tracking-[0.3em] uppercase">Go</span>
                {/if}
              </a>
            {/each}
          </nav>

          <div class="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div>
              <p class="text-muted-foreground/70 text-xs font-semibold tracking-[0.3em] uppercase">
                Session
              </p>
              <p class="mt-2 text-sm font-medium text-white">{currentUser?.full_name}</p>
              <p class="text-muted-foreground/70 text-sm">{currentUser?.email}</p>
            </div>

            <div class="flex items-center gap-2">
              <DarkModeToggle />
              <button
                class="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                onclick={handleLogout}
                type="button"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      {/if}
    </aside>

    <main class="min-w-0 bg-[var(--gradient-section-alt)]">
      {#if $navigating}
        <div class="bg-muted fixed inset-x-0 top-0 z-50 h-1 overflow-hidden">
          <div class="bg-jeevatix-500 h-full w-1/3 animate-pulse rounded-full"></div>
        </div>
      {/if}
      <div class="mx-auto min-h-screen max-w-7xl px-6 py-8 sm:px-10 lg:px-12">
        {@render children()}
      </div>
    </main>
  </div>
{/if}
