<script lang="ts">
  import './layout.css';
  import { Button } from '@jeevatix/ui';
  import favicon from '$lib/assets/favicon.svg';

  let { data, children }: import('./$types').LayoutProps = $props();
</script>

<svelte:head>
  <title>Jeevatix Buyer</title>
  <meta
    name="description"
    content="Portal pembeli Jeevatix untuk menemukan dan membeli tiket event."
  />
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="bg-background text-foreground min-h-screen">
  <div class="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#fffaf3_0%,#fffdf8_38%,#f6fbff_100%)]">
    <div
      class="pointer-events-none absolute inset-0 opacity-90"
      style="background-image:
        radial-gradient(circle at 0% 0%, rgba(249,115,22,0.18), transparent 25%),
        radial-gradient(circle at 100% 12%, rgba(14,165,233,0.15), transparent 24%),
        radial-gradient(circle at 50% 100%, rgba(251,191,36,0.18), transparent 28%);"
    ></div>

    <header class="relative z-10 px-6 py-5 sm:px-10 lg:px-16">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-white/70 bg-white/75 px-5 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <a href="/" class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f97316,#facc15)] text-sm font-black text-slate-950">
            J
          </div>
          <div>
            <p class="text-xs font-semibold tracking-[0.3em] text-slate-500 uppercase">Buyer Portal</p>
            <p class="text-lg font-semibold tracking-tight text-slate-950">Jeevatix</p>
          </div>
        </a>

        <nav class="hidden items-center gap-5 text-sm font-medium text-slate-600 md:flex">
          <a class="transition hover:text-slate-950" href="/">Beranda</a>
          <a class="transition hover:text-slate-950" href="/events">Explore</a>
          <a class="transition hover:text-slate-950" href="/login">Login</a>
          <a class="transition hover:text-slate-950" href="/register">Daftar</a>
        </nav>

        <div class="flex items-center gap-3">
          {#if data.currentUser}
            <div class="hidden text-right sm:block">
              <p class="text-xs font-semibold tracking-[0.28em] text-slate-500 uppercase">Signed In</p>
              <p class="text-sm font-medium text-slate-900">{data.currentUser.full_name}</p>
            </div>
          {:else}
            <a class="hidden text-sm font-medium text-slate-600 transition hover:text-slate-950 sm:inline-flex" href="/login">
              Login
            </a>
            <a href="/register">
              <Button type="button" class="rounded-full px-5">Buat Akun</Button>
            </a>
          {/if}
        </div>
      </div>
    </header>

    <main class="relative z-10 px-6 pb-12 sm:px-10 lg:px-16">
      <div class="mx-auto max-w-6xl">
        {@render children()}
      </div>
    </main>
  </div>
</div>
