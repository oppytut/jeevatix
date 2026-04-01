<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { Bell } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';

  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import { apiGetResponse } from '$lib/api';
  import { logout } from '$lib/auth';
  import type { SellerAuthUser } from '$lib/auth';

  const menuItems = [
    { label: 'Dashboard', href: '/', enabled: true },
    { label: 'Events', href: '/events', enabled: true },
    { label: 'Orders', href: '/orders', enabled: true },
    { label: 'Check-in', href: '/events/checkin', enabled: false },
    { label: 'Notifications', href: '/notifications', enabled: true },
    { label: 'Profile', href: '/profile', enabled: true },
  ] as const;

  const authRoutes = new Set(['/login', '/register', '/forgot-password', '/reset-password']);

  let {
    children,
    data,
  }: {
    children: Snippet;
    data: {
      currentUser: SellerAuthUser | null;
    };
  } = $props();

  const isAuthRoute = $derived(authRoutes.has(String(page.url.pathname)));
  const currentUser = $derived(data.currentUser ?? null);
  let unreadCount = $state(0);

  async function loadUnreadCount() {
    if (!browser || isAuthRoute) {
      return;
    }

    try {
      const response = await apiGetResponse<
        { notifications: Array<unknown>; unread_count: number },
        { total: number; page: number; limit: number; totalPages: number }
      >('/notifications?page=1&limit=20');
      unreadCount = response.data.unread_count;
    } catch {
      unreadCount = 0;
    }
  }

  function isActive(href: string) {
    if (href === '/') {
      return page.route.id === '/';
    }

    if (href === '/events/checkin') {
      return page.url.pathname.includes('/checkin');
    }

    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    await logout();
    await goto(resolve('/login'), { replaceState: true });
  }

  onMount(() => {
    if (!browser || isAuthRoute) {
      return;
    }

    void loadUnreadCount();

    const handleNotificationUpdate = () => {
      void loadUnreadCount();
    };

    window.addEventListener('seller-notifications-updated', handleNotificationUpdate);

    return () => {
      window.removeEventListener('seller-notifications-updated', handleNotificationUpdate);
    };
  });
</script>

<svelte:head>
  <title>Jeevatix Seller</title>
  <meta
    name="description"
    content="Dashboard seller Jeevatix untuk mengelola event, pesanan, check-in, dan notifikasi operasional."
  />
  <link rel="icon" href={favicon} />
</svelte:head>

{#if isAuthRoute}
  <div
    class="min-h-screen bg-[linear-gradient(180deg,rgba(236,253,245,0.72),rgba(255,255,255,1)_18%,rgba(255,251,235,0.72))] px-4 py-4 sm:px-6 lg:px-8"
  >
    <div class="mx-auto max-w-7xl">
      {@render children()}
    </div>
  </div>
{:else}
  <div class="bg-background text-foreground min-h-screen lg:grid lg:grid-cols-[300px_1fr]">
    <aside
      class="border-b border-emerald-950/20 bg-[radial-gradient(circle_at_top,#134e4a_0%,#052e2b_55%,#021918_100%)] text-emerald-50 lg:min-h-screen lg:border-r lg:border-b-0"
    >
      <div class="flex h-full flex-col px-6 py-8">
        <div class="space-y-3 border-b border-white/10 pb-6">
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-3">
              <p class="text-xs font-semibold tracking-[0.35em] text-emerald-200/70 uppercase">
                Jeevatix
              </p>
              <h1 class="text-2xl font-semibold tracking-tight">Seller Studio</h1>
              <p class="text-sm leading-6 text-emerald-100/70">
                Ruang kerja seller untuk memantau penjualan, check-in, dan performa event secara
                real-time.
              </p>
            </div>

            {#if !isAuthRoute}
              <button
                type="button"
                class="relative inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-emerald-50 transition hover:border-white/20 hover:bg-white/12 hover:text-white"
                onclick={() => goto(resolve('/notifications'))}
                aria-label="Buka notifikasi seller"
              >
                <Bell class="size-5" />
                {#if unreadCount > 0}
                  <span class="absolute -right-1 -top-1 inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 py-1 text-[0.7rem] font-semibold leading-none text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                {/if}
              </button>
            {/if}
          </div>
        </div>

        <nav class="mt-6 flex-1 space-y-2">
          {#each menuItems as item (item.href)}
            {#if item.enabled}
              {#if item.href === '/'}
                <a
                  href={resolve('/')}
                  class={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition ${isActive(item.href) ? 'border-white/20 bg-white/12 text-white' : 'border-white/10 bg-white/5 text-emerald-50/85 hover:border-amber-300/30 hover:bg-white/10 hover:text-white'}`}
                >
                  <span>{item.label}</span>
                  <span class="text-xs tracking-[0.3em] text-amber-200/60 uppercase">Live</span>
                </a>
              {:else if item.href === '/events'}
                <a
                  href={resolve('/events')}
                  class={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition ${isActive(item.href) ? 'border-white/20 bg-white/12 text-white' : 'border-white/10 bg-white/5 text-emerald-50/85 hover:border-amber-300/30 hover:bg-white/10 hover:text-white'}`}
                >
                  <span>{item.label}</span>
                  <span class="text-xs tracking-[0.3em] text-amber-200/60 uppercase">Live</span>
                </a>
              {:else if item.href === '/orders'}
                <a
                  href={resolve('/orders')}
                  class={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition ${isActive(item.href) ? 'border-white/20 bg-white/12 text-white' : 'border-white/10 bg-white/5 text-emerald-50/85 hover:border-amber-300/30 hover:bg-white/10 hover:text-white'}`}
                >
                  <span>{item.label}</span>
                  <span class="text-xs tracking-[0.3em] text-amber-200/60 uppercase">Live</span>
                </a>
              {:else if item.href === '/notifications'}
                <a
                  href={resolve('/notifications')}
                  class={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition ${isActive(item.href) ? 'border-white/20 bg-white/12 text-white' : 'border-white/10 bg-white/5 text-emerald-50/85 hover:border-amber-300/30 hover:bg-white/10 hover:text-white'}`}
                >
                  <span>{item.label}</span>
                  {#if unreadCount > 0}
                    <span class="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 py-1 text-[0.7rem] font-semibold leading-none text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  {:else}
                    <span class="text-xs tracking-[0.3em] text-amber-200/60 uppercase">Live</span>
                  {/if}
                </a>
              {:else}
                <a
                  href={resolve('/profile')}
                  class={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition ${isActive(item.href) ? 'border-white/20 bg-white/12 text-white' : 'border-white/10 bg-white/5 text-emerald-50/85 hover:border-amber-300/30 hover:bg-white/10 hover:text-white'}`}
                >
                  <span>{item.label}</span>
                  <span class="text-xs tracking-[0.3em] text-amber-200/60 uppercase">Live</span>
                </a>
              {/if}
            {:else}
              <div class="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-emerald-50/85">
                <span>{item.label}</span>
                <span class="text-xs tracking-[0.3em] text-amber-200/60 uppercase">Soon</span>
              </div>
            {/if}
          {/each}
        </nav>

        <div class="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
          <div>
            <p class="text-xs font-semibold tracking-[0.3em] text-amber-200/70 uppercase">Session</p>
            <p class="mt-2 text-sm font-medium text-white">{currentUser?.full_name}</p>
            <p class="text-sm text-emerald-100/75">{currentUser?.email}</p>
          </div>

          <button
            class="w-full rounded-2xl border border-white/10 px-4 py-3 text-left text-sm font-medium text-emerald-50 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            onclick={handleLogout}
            type="button"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>

    <main
      class="min-w-0 bg-[linear-gradient(180deg,rgba(254,252,232,0.65),rgba(255,255,255,1)_22%,rgba(236,253,245,0.8)_100%)]"
    >
      <div class="mx-auto min-h-screen max-w-7xl px-6 py-8 sm:px-10 lg:px-12">
        {@render children()}
      </div>
    </main>
  </div>
{/if}
