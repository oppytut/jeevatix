<script lang="ts">
  import { resolve } from '$app/paths';
  import './layout.css';
  import { Button } from '@jeevatix/ui';
  import favicon from '$lib/assets/favicon.svg';
  import { Menu, X } from '@lucide/svelte';

  let { data, children }: import('./$types').LayoutProps = $props();
  let mobileMenuOpen = $state(false);
</script>

<svelte:head>
  <title>Jeevatix — Platform Tiket Event Indonesia</title>
  <meta
    name="description"
    content="Temukan dan beli tiket event musik, festival, workshop, dan lainnya di seluruh Indonesia."
  />
  <link rel="icon" href={favicon} />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#f97316" />
  <meta property="og:site_name" content="Jeevatix" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Jeevatix — Platform Tiket Event Indonesia" />
  <meta
    property="og:description"
    content="Temukan dan beli tiket event musik, festival, workshop, dan lainnya di seluruh Indonesia."
  />
  <meta property="og:image" content="https://jeevatix.my.id/og-default.png" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="bg-background text-foreground min-h-screen">
  <div
    class="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#fffaf3_0%,#fffdf8_38%,#f6fbff_100%)]"
  >
    <div
      class="pointer-events-none absolute inset-0 opacity-90"
      style="background-image:
        radial-gradient(circle at 0% 0%, rgba(249,115,22,0.18), transparent 25%),
        radial-gradient(circle at 100% 12%, rgba(14,165,233,0.15), transparent 24%),
        radial-gradient(circle at 50% 100%, rgba(251,191,36,0.18), transparent 28%);"
    ></div>

    <header class="relative z-10 px-6 py-5 sm:px-10 lg:px-16">
      <div
        class="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-border bg-card/75 px-5 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur"
      >
        <a href={resolve('/')} class="flex items-center gap-3">
          <div
            class="flex size-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f97316,#facc15)] text-sm font-black text-foreground"
          >
            J
          </div>
          <div>
            <p class="text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase">
              Buyer Portal
            </p>
            <p class="text-lg font-semibold tracking-tight text-foreground">Jeevatix</p>
          </div>
        </a>

        <nav class="hidden items-center gap-5 text-sm font-medium text-muted-foreground md:flex">
          <a class="transition hover:text-foreground" href={resolve('/')}>Beranda</a>
          <a class="transition hover:text-foreground" href={resolve('/events')}>Explore</a>
          {#if data.currentUser}
            <a class="transition hover:text-foreground" href={resolve('/notifications')}
              >Notifikasi</a
            >
            <a class="transition hover:text-foreground" href={resolve('/profile')}>Profil</a>
          {:else}
            <a class="transition hover:text-foreground" href={resolve('/login')}>Login</a>
            <a class="transition hover:text-foreground" href={resolve('/register')}>Daftar</a>
          {/if}
        </nav>

        <div class="flex items-center gap-3">
          <button
            class="inline-flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted md:hidden"
            onclick={() => mobileMenuOpen = !mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={mobileMenuOpen}
          >
            {#if mobileMenuOpen}
              <X class="size-5" />
            {:else}
              <Menu class="size-5" />
            {/if}
          </button>
          {#if data.currentUser}
            <div class="hidden text-right sm:block">
              <p class="text-xs font-semibold tracking-[0.28em] text-muted-foreground uppercase">
                Signed In
              </p>
              <p class="text-sm font-medium text-foreground">{data.currentUser.full_name}</p>
            </div>
            <a href={resolve('/profile')}>
              <Button type="button" class="rounded-full px-5">Akun Saya</Button>
            </a>
          {:else}
            <a
              class="hidden text-sm font-medium text-muted-foreground transition hover:text-foreground sm:inline-flex"
              href={resolve('/login')}
            >
              Login
            </a>
            <a href={resolve('/register')}>
              <Button type="button" class="rounded-full px-5">Buat Akun</Button>
            </a>
          {/if}
        </div>
      </div>

      {#if mobileMenuOpen}
        <nav class="mx-auto mt-2 flex max-w-6xl flex-col gap-1 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur md:hidden">
          <a class="rounded-xl px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted" href={resolve('/')} onclick={() => mobileMenuOpen = false}>Beranda</a>
          <a class="rounded-xl px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted" href={resolve('/events')} onclick={() => mobileMenuOpen = false}>Explore</a>
          {#if data.currentUser}
            <a class="rounded-xl px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted" href={resolve('/notifications')} onclick={() => mobileMenuOpen = false}>Notifikasi</a>
            <a class="rounded-xl px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted" href={resolve('/profile')} onclick={() => mobileMenuOpen = false}>Profil</a>
          {:else}
            <a class="rounded-xl px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted" href={resolve('/login')} onclick={() => mobileMenuOpen = false}>Login</a>
            <a class="rounded-xl px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted" href={resolve('/register')} onclick={() => mobileMenuOpen = false}>Daftar</a>
          {/if}
        </nav>
      {/if}
    </header>

    <main class="relative z-10 px-6 pb-12 sm:px-10 lg:px-16">
      <div class="mx-auto max-w-6xl">
        {@render children()}
      </div>
    </main>
  </div>
</div>
